import { useEffect, useState } from 'react';
import { addCoop, addCoopName, getFeedPurchases } from '../api.js';
import {
  coopFarm,
  coopKey,
  coopOccupant,
  coopLive,
  BROODING_DAYS,
  batchAge,
  batchAgeDays,
  broodingDue,
  coopsForBatch,
  coopsOnFarm,
  feedCost,
  formatKg,
  formatNumber,
  formatRupees,
  liveBirds,
  totalMortality,
  totalSold,
  unallocatedBirds,
  vaccinatedBirds,
} from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchFeed from './BatchFeed.jsx';
import BatchRecords from './BatchRecords.jsx';
import Dropdown from './Dropdown.jsx';
import OptionSelect from './OptionSelect.jsx';
import SoldList from './SoldList.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const VIEWS = [
  { id: 'coops', label: 'Coops' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'feed', label: 'Feed' },
  { id: 'sold', label: 'Sold' },
  { id: 'activity', label: 'Activity Logs' },
];

export default function ManageFlock({
  batch,
  allBatches,
  farms,
  coopsByFarm,
  onOptions,
  onUpdated,
  onBack,
  onOpenCoop,
  onShift,
}) {
  // A batch can be spread over several farms; its own is offered first
  const [farm, setFarm] = useState(batch.shiftToFarm ?? '');
  const [name, setName] = useState('');
  const [birds, setBirds] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('coops');
  const { records, error: recordsError } = useBatchRecords(batch._id);
  // Feed bought into the store, which prices what the batch was fed; null until loaded
  const [purchases, setPurchases] = useState(null);

  useEffect(() => {
    getFeedPurchases()
      .then(setPurchases)
      // The page still works without the feed cost
      .catch(() => {});
  }, []);

  // What the batch has eaten so far and what that feed cost; null until both have loaded
  const fed = records && purchases ? feedCost(records.feeds, purchases) : null;

  const unallocated = unallocatedBirds(batch);
  // The batch's brooding houses still holding birds past the brooding period
  const brooding = batch.coops.flatMap((coop) => broodingDue(coop.name, [{ batch, coop }]));
  const broodingBirds = brooding.reduce((sum, entry) => sum + entry.birds, 0);
  // A coop can only be used once per batch
  const used = new Set(batch.coops.map((coop) => coopKey(batch, coop)));
  // … and a coop holds only one batch at a time
  const freeCoops = coopsForBatch(coopsOnFarm(coopsByFarm, farm), batch).filter(
    (coop) =>
      !used.has(coopKey({ shiftToFarm: farm }, { name: coop })) &&
      !coopOccupant(allBatches, farm, coop, batch)
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
          <span className="badges">
            <span className="badge">{batch.breed}</span>
            <span className="badge age">Age {batchAge(batch)}</span>
          </span>
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
            <dt>Sold Birds</dt>
            <dd>{formatNumber(totalSold(batch))}</dd>
          </div>
          <div>
            <dt>Not Vaccinated</dt>
            <dd className={vaccinated !== null && live > vaccinated ? 'pending' : ''}>
              {vaccinated === null ? '…' : formatNumber(live - vaccinated)}
            </dd>
          </div>
        </dl>

        {/* What the batch has eaten so far; the Feed tab below has the details */}
        <button type="button" className="feed-strip" onClick={() => setView('feed')}>
          <span>
            <small>Feed Consumed</small>
            <b>{fed ? formatKg(fed.kg) : '…'}</b>
          </span>
          <span>
            <small>Feed Cost</small>
            <b>{fed ? formatRupees(fed.cost) : '…'}</b>
          </span>
          <span className="alert-go" aria-hidden="true">
            ›
          </span>
        </button>

        {unallocated > 0 && (
          <p className="notice">{formatNumber(unallocated)} birds not yet allocated to coops</p>
        )}

        {brooding.length > 0 && (
          <p className="notice">
            The brooding period has ended. Shift the {formatNumber(broodingBirds)} birds in{' '}
            {brooding.map(({ coop }) => coop.name).join(' and ')} to coops.{' '}
            <button
              type="button"
              className="link inline"
              onClick={() =>
                onShift({ coopKey: coopKey(batch, brooding[0].coop), batchId: batch._id })
              }
            >
              Open shift form ›
            </button>
          </p>
        )}
        {brooding.length === 0 && unallocated > 0 && batchAgeDays(batch) >= BROODING_DAYS && (
          <p className="notice">The brooding period has ended. Allocate these birds to coops.</p>
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
              <dt>Age Now</dt>
              <dd>{batchAge(batch, { weeks: true })}</dd>
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

      {view === 'feed' &&
        (fed ? (
          <BatchFeed feeds={records.feeds} fed={fed} live={live} />
        ) : (
          <p className="status">{recordsError || 'Loading…'}</p>
        ))}

      {view === 'sold' && (
        <SoldList
          batchIds={[batch._id]}
          includes={(set) => set.batch?._id === batch._id}
          showCoop
          scope="batch"
        />
      )}

      {view !== 'coops' && view !== 'feed' && view !== 'sold' && (
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
                      {coop.mortality > 0 && ` · ${formatNumber(coop.mortality)} mortality`}
                      {coop.sold > 0 && ` · ${formatNumber(coop.sold)} sold`}
                      {coopLive(coop) !== coop.birds && ` · ${formatNumber(coopLive(coop))} live`}
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
