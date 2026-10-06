import { useState } from 'react';
import { createMortality, createVaccination } from '../api.js';
import { coopLive, formatNumber } from '../flock.js';
import Dropdown from './Dropdown.jsx';
import PhotoCapture from './PhotoCapture.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

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

// Dashboard form for a mortality or vaccination record against one coop
export default function RecordForm({ type, batches, onSaved, onCancel, onNavigate }) {
  const config = FORMS[type];
  const [batchId, setBatchId] = useState('');
  const [coopId, setCoopId] = useState('');
  const [birds, setBirds] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [vaccine, setVaccine] = useState('');
  const [remarks, setRemarks] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Only batches that already have coops can take a record
  const batchOptions = batches
    .filter((b) => b.coops.length > 0)
    .map((b) => ({
      value: b._id,
      label: b.shiftToFarm ? `${b.shiftToFarm} · ${b.batchName}` : b.batchName,
    }));

  const batch = batches.find((b) => b._id === batchId);
  const coop = batch?.coops.find((c) => c._id === coopId);
  const coopOptions = (batch?.coops ?? []).map((c) => ({
    value: c._id,
    label: `${c.name}${c.farm ? ` · ${c.farm}` : ''} (${formatNumber(coopLive(c))} live)`,
  }));

  function chooseBatch(id) {
    setBatchId(id);
    setCoopId('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!batch) return setError('Please select a farm & batch.');
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

  if (batchOptions.length === 0) {
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
        ‹ Dashboard
      </button>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>{config.title}</h2>

        <div className="field">
          <label htmlFor="record-batch">Farm &amp; Batch</label>
          <Dropdown
            id="record-batch"
            value={batchId}
            options={batchOptions}
            onChange={chooseBatch}
            placeholder="Select farm & batch"
          />
        </div>

        <div className="field">
          <label htmlFor="record-coop">Coop</label>
          <Dropdown
            id="record-coop"
            value={coopId}
            options={coopOptions}
            onChange={setCoopId}
            placeholder={batch ? 'Select coop' : 'Select farm & batch first'}
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
