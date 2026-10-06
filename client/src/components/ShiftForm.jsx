import { useState } from 'react';
import { createShift } from '../api.js';
import { coopGroups, coopLive, coopsOnFarm, formatNumber } from '../flock.js';
import Dropdown from './Dropdown.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Dashboard form for moving live birds from one coop to another
export default function ShiftForm({ batches, farms, coopsByFarm, onSaved, onCancel, onNavigate }) {
  // Only coops that still hold live birds can be shifted from
  const groups = coopGroups(batches)
    .map((group) => ({
      ...group,
      entries: group.entries.filter(({ coop }) => coopLive(coop) > 0),
    }))
    .filter((group) => group.entries.length > 0);

  const fromFarms = [...new Map(groups.map((g) => [g.farm.toLowerCase(), g.farm])).values()];

  const [fromFarm, setFromFarm] = useState(fromFarms.length === 1 ? fromFarms[0] : null);
  const [fromKey, setFromKey] = useState('');
  const [batchId, setBatchId] = useState('');
  const [toFarm, setToFarm] = useState('');
  const [toCoop, setToCoop] = useState('');
  const [birds, setBirds] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fromGroups = groups.filter((g) => fromFarm !== null && sameName(g.farm, fromFarm));
  const group = fromGroups.find((g) => g.key === fromKey);
  // A coop holding a single batch needs no batch choice
  const entry =
    group?.entries.length === 1
      ? group.entries[0]
      : group?.entries.find(({ batch }) => batch._id === batchId);
  const available = entry ? coopLive(entry.coop) : 0;

  // Every coop of the destination farm except the one the birds are leaving
  const toCoops = coopsOnFarm(coopsByFarm, toFarm).filter(
    (name) => !(group && sameName(name, group.name) && sameName(toFarm, group.farm)),
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
    if (!toFarm || !toCoop) return setError('Please select the farm and coop to shift to.');
    if (Number(birds) > available) {
      return setError(`Only ${formatNumber(available)} live birds are in ${group.name}.`);
    }

    setSubmitting(true);
    setError('');
    try {
      const saved = await createShift({
        batchId: entry.batch._id,
        fromCoopId: entry.coop._id,
        toFarm,
        toCoop,
        birds: Number(birds),
        reason,
        date,
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

          {group && group.entries.length > 1 && (
            <div className="field">
              <label htmlFor="shift-batch">Batch</label>
              <Dropdown
                id="shift-batch"
                value={batchId}
                options={group.entries.map(({ batch, coop }) => ({
                  value: batch._id,
                  label: `${batch.batchName} (${formatNumber(coopLive(coop))} live)`,
                }))}
                onChange={setBatchId}
                placeholder="Select batch"
              />
            </div>
          )}

          {entry && group.entries.length === 1 && (
            <p className="hint">
              Batch: {entry.batch.batchName} · {entry.batch.breed}
            </p>
          )}
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
              value={toCoop}
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
