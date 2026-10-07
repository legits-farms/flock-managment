import { useState } from 'react';
import { createShift } from '../api.js';
import {
  coopGroups,
  coopLive,
  coopOccupant,
  coopsForBatch,
  coopsOnFarm,
  formatNumber,
} from '../flock.js';
import Dropdown from './Dropdown.jsx';
import PhotoCapture, { evidencePayload } from './PhotoCapture.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Dashboard form for moving live birds from one coop to another. `from`
// ({ coopKey, batchId }) fills in the coop and batch to shift out of.
export default function ShiftForm({
  from,
  batches,
  farms,
  coopsByFarm,
  onSaved,
  onCancel,
  onNavigate,
}) {
  // Only coops that still hold live birds can be shifted from
  const groups = coopGroups(batches)
    .map((group) => ({
      ...group,
      entries: group.entries.filter(({ coop }) => coopLive(coop) > 0),
    }))
    .filter((group) => group.entries.length > 0);

  const fromFarms = [...new Map(groups.map((g) => [g.farm.toLowerCase(), g.farm])).values()];

  const preset = from && groups.find((g) => g.key === from.coopKey);
  const [fromFarm, setFromFarm] = useState(
    preset ? preset.farm : fromFarms.length === 1 ? fromFarms[0] : null,
  );
  const [fromKey, setFromKey] = useState(preset?.key ?? '');
  const [batchId, setBatchId] = useState(preset ? from.batchId : '');
  const [toFarm, setToFarm] = useState('');
  const [toCoop, setToCoop] = useState('');
  const [birds, setBirds] = useState('');
  // Birds that died on the way, and the photo that goes with them
  const [mortality, setMortality] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fromGroups = groups.filter((g) => fromFarm !== null && sameName(g.farm, fromFarm));
  const group = fromGroups.find((g) => g.key === fromKey);
  // With a single batch in the coop it is chosen already; otherwise the person picks
  const entry =
    group?.entries.length === 1
      ? group.entries[0]
      : group?.entries.find(({ batch }) => batch._id === batchId);
  const available = entry ? coopLive(entry.coop) : 0;
  const lost = Number(mortality) || 0;

  // Every coop of the destination farm the batch can go to, except the one the
  // birds are leaving and any that another batch is in
  const toCoops = coopsForBatch(coopsOnFarm(coopsByFarm, toFarm), entry?.batch).filter(
    (name) =>
      !(group && sameName(name, group.name) && sameName(toFarm, group.farm)) &&
      !(entry && coopOccupant(batches, toFarm, name, entry.batch)),
  );

  function chooseFromFarm(farm) {
    setFromFarm(farm);
    setFromKey('');
    setBatchId('');
  }

  function chooseFromCoop(key) {
    setFromKey(key);
    setBatchId('');
  }

  function chooseToFarm(farm) {
    setToFarm(farm);
    setToCoop('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!group) return setError('Please select the farm and coop to shift from.');
    if (!entry) return setError('Please select the batch to shift.');
    if (!toFarm || !toCoops.includes(toCoop)) return setError('Please select the farm and coop to shift to.');
    if (Number(birds) > available) {
      return setError(`Only ${formatNumber(available)} live birds are in ${group.name}.`);
    }
    if (lost >= Number(birds)) {
      return setError('Shift mortality must be less than the number of birds shifted.');
    }
    if (lost > 0 && evidence.length === 0) return setError('Please take a live photo of the shift mortality.');

    setSubmitting(true);
    setError('');
    try {
      const saved = await createShift({
        batchId: entry.batch._id,
        fromCoopId: entry.coop._id,
        toFarm,
        toCoop,
        birds: Number(birds),
        mortality: lost,
        reason,
        date,
        ...(lost > 0 ? evidencePayload(evidence) : {}),
      });
      onSaved(saved.batch);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="status">
        <p>No birds in coops yet. Allocate a batch to coops before shifting birds.</p>
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
        <h2>Shift Birds</h2>

        <fieldset className="group">
          <legend>From</legend>

          <div className="field">
            <label htmlFor="shift-from-farm">Farm</label>
            <Dropdown
              id="shift-from-farm"
              value={fromFarm}
              options={fromFarms.map((farm) => ({ value: farm, label: farm || 'No farm' }))}
              onChange={chooseFromFarm}
              placeholder="Select farm"
            />
          </div>

          <div className="field">
            <label htmlFor="shift-from-coop">Coop</label>
            <Dropdown
              id="shift-from-coop"
              value={fromKey}
              options={fromGroups.map((g) => ({
                value: g.key,
                label: `${g.name} (${formatNumber(
                  g.entries.reduce((sum, { coop }) => sum + coopLive(coop), 0),
                )} live)`,
              }))}
              onChange={chooseFromCoop}
              placeholder={fromFarm === null ? 'Select farm first' : 'Select coop'}
            />
          </div>

          {/* Always asked: a coop can hold more than one batch */}
          <div className="field">
            <label htmlFor="shift-batch">Batch</label>
            <Dropdown
              id="shift-batch"
              value={entry?.batch._id ?? ''}
              options={(group?.entries ?? []).map(({ batch, coop }) => ({
                value: batch._id,
                label: `${batch.batchName} · ${batch.breed} (${formatNumber(coopLive(coop))} live)`,
              }))}
              onChange={setBatchId}
              placeholder={group ? 'Select batch' : 'Select coop first'}
            />
          </div>
        </fieldset>

        <fieldset className="group">
          <legend>To</legend>

          <div className="field">
            <label htmlFor="shift-to-farm">Farm</label>
            <Dropdown
              id="shift-to-farm"
              value={toFarm}
              options={farms.map((farm) => ({ value: farm, label: farm }))}
              onChange={chooseToFarm}
              placeholder="Select farm"
            />
          </div>

          <div className="field">
            <label htmlFor="shift-to-coop">Coop</label>
            <Dropdown
              id="shift-to-coop"
              value={toCoops.includes(toCoop) ? toCoop : ''}
              options={toCoops.map((name) => ({ value: name, label: name }))}
              onChange={setToCoop}
              placeholder={toFarm ? 'Select coop' : 'Select farm first'}
            />
          </div>
        </fieldset>

        <label className="field">
          <span>Number of Birds</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max={entry ? available : undefined}
            step="1"
            value={birds}
            onChange={(e) => setBirds(e.target.value)}
            placeholder={entry ? `Up to ${formatNumber(available)}` : '0'}
            required
          />
        </label>

        <label className="field">
          <span>Shift Mortality (birds that died on the way)</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max={Number(birds) > 0 ? Number(birds) - 1 : undefined}
            step="1"
            value={mortality}
            onChange={(e) => setMortality(e.target.value)}
            placeholder="0"
          />
        </label>

        {lost > 0 && lost < Number(birds) && (
          <p className="hint">
            {formatNumber(Number(birds) - lost)} birds will reach {toCoop || 'the coop'}
          </p>
        )}

        {lost > 0 && (
          <div className="field">
            <span>Photos of the mortality (live, geotagged with time stamp)</span>
            <PhotoCapture value={evidence} onChange={setEvidence} />
          </div>
        )}

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label className="field">
          <span>Reason</span>
          <textarea
            rows="2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Overcrowding"
            required
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Shift Birds'}
        </button>
      </form>
    </div>
  );
}
