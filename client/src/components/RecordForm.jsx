import { useState } from 'react';
import { createFeed, createMortality, createVaccination, createWeight } from '../api.js';
import {
  MORTALITY_LABELS,
  RECORD_MORTALITY_TYPES,
  coopFarm,
  coopLive,
  formatNumber,
  formatWeight,
  placeType,
} from '../flock.js';
import Dropdown from './Dropdown.jsx';
import PhotoCapture, { evidencePayload } from './PhotoCapture.jsx';

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

// `birdsLabel` is left out when the record is not about a number of birds, and
// `photo` is set for the records that need live photo evidence
const FORMS = {
  mortality: {
    title: 'Register Mortality',
    birdsLabel: 'Mortality (No. of Birds)',
    photo: true,
    save: createMortality,
  },
  vaccination: {
    title: 'Add Vaccination',
    birdsLabel: 'No. of Birds Administered',
    photo: true,
    save: createVaccination,
  },
  feed: {
    title: 'Enter Feed',
    save: createFeed,
  },
  weight: {
    title: 'Enter Avg Weight',
    birdsLabel: 'No. of Birds Weighed',
    save: createWeight,
  },
};

// Average weight per bird, in grams, or null until both numbers are filled in
function averageGrams(totalKg, birds) {
  if (!(Number(totalKg) > 0 && Number(birds) > 0)) return null;
  return Math.round((Number(totalKg) * 1000) / Number(birds));
}

// Form for a mortality, vaccination, feed or weight record against one coop.
// Opened from the dashboard, or from a coop page with only that coop's batches
// to choose from.
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
  // Mortality type picked by hand; until then it follows the chosen coop
  const [pickedType, setPickedType] = useState('');
  const [birds, setBirds] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [vaccine, setVaccine] = useState('');
  const [remarks, setRemarks] = useState('');
  const [feedType, setFeedType] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const farmBatches = batchesOn(batches, farm);
  const batch = farmBatches.find((b) => b._id === batchId);
  const batchCoops = batch ? coopsOn(batch, farm) : [];
  const coop = batchCoops.find((c) => c._id === coopId);
  const mortalityType = pickedType || (coop ? placeType(coop.name) : '');
  const average = averageGrams(totalWeightKg, birds);

  function chooseBatch(id, onFarm = farm) {
    const chosen = batches.find((b) => b._id === id);
    setBatchId(id);
    chooseCoop((chosen && only(coopsOn(chosen, onFarm))?._id) ?? '');
  }

  function chooseCoop(id) {
    setCoopId(id);
    setPickedType('');
  }

  function chooseFarm(next) {
    setFarm(next);
    chooseBatch(only(batchesOn(batches, next))?._id ?? '', next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!batch) return setError('Please select a farm and a batch.');
    if (!coop) return setError('Please select a coop.');
    if (config.birdsLabel && Number(birds) > coopLive(coop)) {
      return setError(`Only ${formatNumber(coopLive(coop))} live birds are in ${coop.name}.`);
    }
    if (config.photo && evidence.length === 0) return setError('Please take a live photo.');

    setSubmitting(true);
    setError('');
    try {
      const details = {
        mortality: { birds: Number(birds), type: mortalityType, reason },
        vaccination: { birds: Number(birds), date, vaccine, remarks },
        feed: { date, feedType, quantityKg: Number(quantityKg), remarks },
        weight: { birds: Number(birds), date, totalWeightKg: Number(totalWeightKg), remarks },
      }[type];
      const saved = await config.save({
        batchId,
        coopId,
        ...details,
        ...evidencePayload(evidence),
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

  const remarksField = (
    <label className="field">
      <span>Remarks</span>
      <textarea
        rows="2"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Optional"
      />
    </label>
  );

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
            onChange={chooseCoop}
            placeholder={batch ? 'Select coop' : 'Select batch first'}
          />
        </div>

        {type === 'mortality' && (
          <>
            <div className="field">
              <label htmlFor="record-mortality-type">Mortality Type</label>
              <Dropdown
                id="record-mortality-type"
                value={mortalityType}
                options={RECORD_MORTALITY_TYPES.map((value) => ({
                  value,
                  label: MORTALITY_LABELS[value],
                }))}
                onChange={setPickedType}
                placeholder={coop ? 'Select type' : 'Select coop first'}
              />
            </div>
            <p className="hint">Box mortality is entered with the batch itself.</p>
          </>
        )}

        {type !== 'mortality' && (
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        )}

        {type === 'vaccination' && (
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
        )}

        {type === 'feed' && (
          <>
            <label className="field">
              <span>Feed Type</span>
              <input
                type="text"
                value={feedType}
                onChange={(e) => setFeedType(e.target.value)}
                placeholder="e.g. Starter"
                required
              />
            </label>

            <label className="field">
              <span>Feed Quantity (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="0"
                required
              />
            </label>
          </>
        )}

        {type === 'vaccination' && remarksField}

        {config.birdsLabel && (
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
        )}

        {type === 'weight' && (
          <>
            <label className="field">
              <span>Total Weight (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={totalWeightKg}
                onChange={(e) => setTotalWeightKg(e.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label className="field">
              <span>Avg Weight per Bird</span>
              <input
                type="text"
                value={average === null ? '' : formatWeight(average)}
                placeholder="Worked out from the two above"
                readOnly
              />
            </label>
          </>
        )}

        {(type === 'feed' || type === 'weight') && remarksField}

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

        {config.photo && (
          <div className="field">
            <span>Photos (live, geotagged with time stamp)</span>
            <PhotoCapture value={evidence} onChange={setEvidence} />
          </div>
        )}

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
