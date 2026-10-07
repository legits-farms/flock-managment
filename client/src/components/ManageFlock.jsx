import { useState } from 'react';
import { addCoop, addCoopName } from '../api.js';
import {
  coopFarm,
  coopKey,
  coopLive,
  coopsOnFarm,
  formatNumber,
  liveBirds,
  totalMortality,
  unallocatedBirds,
  vaccinatedBirds,
} from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchRecords from './BatchRecords.jsx';
import Dropdown from './Dropdown.jsx';
import OptionSelect from './OptionSelect.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const VIEWS = [
  { id: 'coops', label: 'Coops' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'activity', label: 'Activity Logs' },
];

export default function ManageFlock({
  batch,
  farms,
  coopsByFarm,
  onOptions,
  onUpdated,
  onBack,
  onOpenCoop,
}) {
  // A batch can be spread over several farms; its own is offered first
  const [farm, setFarm] = useState(batch.shiftToFarm ?? '');
  const [name, setName] = useState('');
  const [birds, setBirds] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('coops');
  const { records, error: recordsError } = useBatchRecords(batch._id);

  const unallocated = unallocatedBirds(batch);
  // A coop can only be used once per batch
  const used = new Set(batch.coops.map((coop) => coopKey(batch, coop)));
  const freeCoops = coopsOnFarm(coopsByFarm, farm).filter(
    (coop) => !used.has(coopKey({ shiftToFarm: farm }, { name: coop }))
  );

  function chooseFarm(next) {
    setFarm(next);
    setName('');
  }
  const live = liveBirds(batch);
  // null until the batch's vaccination records have loaded
  const vaccinated = records ? vaccinatedBirds(batch, records.vaccinations) : null;

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      onUpdated(await action());
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!farm || !name) {
      setError('Please select a farm and a coop.');
      return;
    }
    const count = Number(birds);
    if (count > unallocated) {
      setError(`Only ${formatNumber(unallocated)} birds are left to allocate.`);
      return;
    }
    if (await run(() => addCoop(batch._id, { farm, name, birds: count }))) {
      setName('');
      setBirds('');
    }
  }

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All batches
      </button>

      <section className="card">
        <h2 className="eyebrow">Allocate / Manage the Flock</h2>
        <div className="batch-head manage-head">
          <h3>{batch.batchName}</h3>
          <span className="badge">{batch.breed}</span>
        </div>

        <dl className="batch-stats five">
          <div className="lead">
            <dt>Birds Received</dt>
            <dd>{formatNumber(batch.numberOfBirds)}</dd>
          </div>
          <div className="lead">
            <dt>Live Birds</dt>
            <dd>{formatNumber(live)}</dd>
          </div>
          <div>
            <dt>Mortality</dt>
            <dd>{formatNumber(totalMortality(batch))}</dd>
          </div>
          <div>
            <dt>Vaccinated</dt>
            <dd>{vaccinated === null ? '…' : formatNumber(vaccinated)}</dd>
          </div>
          <div>
            <dt>Not Vaccinated</dt>
            <dd className={vaccinated !== null && live > vaccinated ? 'pending' : ''}>
              {vaccinated === null ? '…' : formatNumber(live - vaccinated)}
            </dd>
          </div>
        </dl>

        {unallocated > 0 && (
          <p className="notice">{formatNumber(unallocated)} birds not yet allocated to coops</p>
        )}

        <details className="batch-more">
          <summary>Batch details</summary>
          <dl className="batch-details">
            <div>
              <dt>Start Date</dt>
              <dd>{formatDate(batch.startDate)}</dd>
            </div>
            <div>
              <dt>Age at Entry</dt>
              <dd>
                {batch.age} {batch.ageUnit}
              </dd>
            </div>
            <div>
              <dt>Vendor</dt>
              <dd>
                {batch.vendor.name}
                {batch.vendor.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${batch.vendor.phone}`}>{batch.vendor.phone}</a>
                  </>
                )}
                {batch.vendor.details && <small>{batch.vendor.details}</small>}
              </dd>
            </div>
            {batch.shiftToFarm && (
              <div>
                <dt>Shift to Farm</dt>
                <dd>{batch.shiftToFarm}</dd>
              </div>
            )}
            {batch.createdBy?.name && (
              <div>
                <dt>Entered By</dt>
                <dd>{batch.createdBy.name}</dd>
              </div>
            )}
          </dl>
        </details>
      </section>

      <div className="subtabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view !== 'coops' && (
        <BatchRecords view={view} batch={batch} records={records} error={recordsError} />
      )}

      {view === 'coops' && unallocated > 0 && (
        <form className="card form" onSubmit={handleAdd}>
          <h2>Add a Coop</h2>

          <div className="field">
            <label htmlFor="coop-farm">Farm</label>
            <Dropdown
              id="coop-farm"
              value={farm}
              options={farms.map((option) => ({ value: option, label: option }))}
              onChange={chooseFarm}
              placeholder="Select farm"
            />
          </div>

          <div className="field">
            <label htmlFor="coop">Coop</label>
            <OptionSelect
              id="coop"
              value={name}
              names={freeCoops}
              onChange={setName}
              placeholder={farm ? 'Select coop' : 'Select farm first'}
              addLabel="Add a coop"
              onAdd={async (coop) => onOptions(await addCoopName(farm, coop))}
            />
          </div>

          <label className="field">
            <span>Number of Birds</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={unallocated}
              step="1"
              value={birds}
              onChange={(e) => setBirds(e.target.value)}
              placeholder={`Up to ${formatNumber(unallocated)}`}
              required
            />
          </label>

          <button type="button" className="link fill" onClick={() => setBirds(String(unallocated))}>
            Use all {formatNumber(unallocated)} remaining
          </button>

          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Add Coop'}
          </button>
        </form>
      )}

      {view === 'coops' && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {view === 'coops' && (
        <section className="card">
          <h2 className="eyebrow">Coops ({batch.coops.length})</h2>
          {batch.coops.length === 0 ? (
            <p className="empty">No coops yet. Add a coop above to start allocating birds.</p>
          ) : (
            <ul className="recent-list">
              {batch.coops.map((coop) => (
                <li key={coop._id}>
                  <div>
                    <strong>{coop.name}</strong>
                    <small>
                      {coopFarm(batch, coop) && `${coopFarm(batch, coop)} · `}
                      {formatNumber(coop.birds)} birds
                      {coop.mortality > 0 &&
                        ` · ${formatNumber(coop.mortality)} mortality · ${formatNumber(coopLive(coop))} live`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="photo-link"
                    onClick={() => onOpenCoop(coopKey(batch, coop))}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
