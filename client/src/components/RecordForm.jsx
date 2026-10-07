import { useState } from 'react';
import { createMortality, createVaccination } from '../api.js';
import { coopFarm, coopLive, formatNumber } from '../flock.js';
import Dropdown from './Dropdown.jsx';
import PhotoCapture from './PhotoCapture.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The coops of a batch that are on the given farm. A batch can be spread over
// several farms, so the farm is chosen first and narrows the batches and coops.
const coopsOn = (batch, farm) =>
  farm === null ? [] : batch.coops.filter((coop) => sameName(coopFarm(batch, coop), farm));

const batchesOn = (batches, farm) => batches.filter((batch) => coopsOn(batch, farm).length > 0);

// With a single choice there is nothing to pick
const only = (list) => (list.length === 1 ? list[0] : null);

const FORMS = {
  mortality: {
    title: 'Register Mortality',
    birdsLabel: 'Mortality (No. of Birds)',
    save: createMortality,
  },
  vaccination: {
    title: 'Add Vaccination',
    birdsLabel: 'No. of Birds Administered',
    save: createVaccination,
  },
};

// Form for a mortality or vaccination record against one coop. Opened from the
// dashboard, or from a coop page with only that coop's batches to choose from.
export default function RecordForm({
  type,
  batches,
  onSaved,
  onCancel,
  onNavigate,
  backLabel = 'Dashboard',
}) {
  const config = FORMS[type];
  // Every farm that has a coop to record against
  const farms = [
    ...new Map(
      batches.flatMap((b) => b.coops.map((c) => coopFarm(b, c))).map((f) => [f.toLowerCase(), f]),
    ).values(),
  ];

  const onlyFarm = only(farms);
  const onlyBatch = only(batchesOn(batches, onlyFarm));
  const [farm, setFarm] = useState(onlyFarm);
  const [batchId, setBatchId] = useState(onlyBatch?._id ?? '');
  const [coopId, setCoopId] = useState(
    (onlyBatch && only(coopsOn(onlyBatch, onlyFarm))?._id) ?? '',
  );
  const [birds, setBirds] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [vaccine, setVaccine] = useState('');
  const [remarks, setRemarks] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const farmBatches = batchesOn(batches, farm);
  const batch = farmBatches.find((b) => b._id === batchId);
  const batchCoops = batch ? coopsOn(batch, farm) : [];
  const coop = batchCoops.find((c) => c._id === coopId);

  function chooseBatch(id, onFarm = farm) {
    const chosen = batches.find((b) => b._id === id);
    setBatchId(id);
    setCoopId((chosen && only(coopsOn(chosen, onFarm))?._id) ?? '');
  }

  function chooseFarm(next) {
    setFarm(next);
    chooseBatch(only(batchesOn(batches, next))?._id ?? '', next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!batch) return setError('Please select a farm and a batch.');
    if (!coop) return setError('Please select a coop.');
    if (Number(birds) > coopLive(coop)) {
      return setError(`Only ${formatNumber(coopLive(coop))} live birds are in ${coop.name}.`);
    }
    if (!evidence) return setError('Please take a live photo.');

    setSubmitting(true);
    setError('');
    try {
      const details =
        type === 'mortality' ? { reason } : { date, vaccine, remarks };
      const saved = await config.save({
        batchId,
        coopId,
        birds: Number(birds),
        ...details,
        ...evidence,
      });
      onSaved(saved.batch);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (farms.length === 0) {
    return (
      <div className="status">
        <p>No coops yet. Allocate a batch to coops before adding records.</p>
        <button type="button" className="primary" onClick={() => onNavigate('batches')}>
          Go to Batches
        </button>
      </div>
    );
  }

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onCancel}>
        ‹ {backLabel}
      </button>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>{config.title}</h2>

        <div className="field">
          <label htmlFor="record-farm">Farm</label>
          <Dropdown
            id="record-farm"
            value={farm}
            options={farms.map((name) => ({ value: name, label: name || 'No farm' }))}
            onChange={chooseFarm}
            placeholder="Select farm"
          />
        </div>

        <div className="field">
          <label htmlFor="record-batch">Batch</label>
          <Dropdown
            id="record-batch"
            value={batchId}
            options={farmBatches.map((b) => ({ value: b._id, label: b.batchName }))}
            onChange={chooseBatch}
            placeholder={farm === null ? 'Select farm first' : 'Select batch'}
          />
        </div>

        <div className="field">
          <label htmlFor="record-coop">Coop</label>
          <Dropdown
            id="record-coop"
            value={coopId}
            options={batchCoops.map((c) => ({
              value: c._id,
              label: `${c.name} (${formatNumber(coopLive(c))} live)`,
            }))}
            onChange={setCoopId}
            placeholder={batch ? 'Select coop' : 'Select batch first'}
          />
        </div>

        {type === 'vaccination' && (
          <>
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            <label className="field">
              <span>Vaccine</span>
              <input
                type="text"
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value)}
                placeholder="e.g. Lasota"
                required
              />
            </label>

            <label className="field">
              <span>Remarks</span>
              <textarea
                rows="2"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </>
        )}

        <label className="field">
          <span>{config.birdsLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={coop ? coopLive(coop) : undefined}
            step="1"
            value={birds}
            onChange={(e) => setBirds(e.target.value)}
            placeholder={coop ? `Up to ${formatNumber(coopLive(coop))}` : '0'}
            required
          />
        </label>

        {type === 'mortality' && (
          <label className="field">
            <span>Reason</span>
            <textarea
              rows="2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Heat stress"
              required
            />
          </label>
        )}

        <div className="field">
          <span>Photo (live, geotagged with time stamp)</span>
          <PhotoCapture value={evidence} onChange={setEvidence} />
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : config.title}
        </button>
      </form>
    </div>
  );
}
