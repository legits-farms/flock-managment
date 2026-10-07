import { useState } from 'react';
import {
  FEEDS_PER_DAY,
  batchAge,
  broodingAge,
  broodingDue,
  coopLive,
  feedStatus,
  formatNumber,
  formatWeight,
  vaccinatedBirds,
} from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchRecords from './BatchRecords.jsx';
import EntryDetail from './EntryDetail.jsx';
import RecordForm from './RecordForm.jsx';

const VIEWS = [
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'feeding', label: 'Feeding' },
  { id: 'weight', label: 'Weight' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'activity', label: 'Activity Logs' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// `group` is one coop from coopGroups(): every batch that has been in it
export default function CoopPage({ group, onBack, onOpenBatch, onUpdated }) {
  const [view, setView] = useState(VIEWS[0].id);
  // Record form open over the page: 'vaccination' | 'mortality' | 'feed' | 'weight' | null
  const [adding, setAdding] = useState(null);
  // Feed or weight entry being viewed: { kind, record }, or null
  const [opened, setOpened] = useState(null);
  // Bumped after a record is added, to load the records again
  const [saves, setSaves] = useState(0);
  const { entries } = group;
  const { records, error } = useBatchRecords(
    entries.map(({ batch }) => batch._id),
    saves,
  );

  const coops = entries.map(({ coop }) => coop);
  // The entries whose batch still has live birds here
  const current = entries.filter(({ coop }) => coopLive(coop) > 0);
  const live = coops.reduce((sum, coop) => sum + coopLive(coop), 0);
  const mortality = coops.reduce((sum, coop) => sum + (coop.mortality ?? 0), 0);
  // null until the vaccination records have loaded
  const vaccinated = records ? vaccinatedBirds({ coops }, records.vaccinations) : null;

  // This coop's own feed and weight entries, newest first; null until loaded.
  // The batches' records cover their other coops too.
  const coopIds = new Set(coops.map((coop) => coop._id));
  const inCoop = (list) => (list ?? []).filter((r) => coopIds.has(r.coopId));
  const lastWeight = records && inCoop(records.weights)[0];
  const feeding = records && feedStatus(inCoop(records.feeds));

  // Records are only added for birds still alive in this coop
  const vaccinable = entries
    .filter(({ coop }) => coopLive(coop) > 0)
    .map(({ batch, coop }) => ({ ...batch, coops: [coop] }));

  if (opened) {
    return (
      <EntryDetail
        kind={opened.kind}
        record={opened.record}
        backLabel={group.name}
        onBack={() => setOpened(null)}
        onOpenBatch={onOpenBatch}
      />
    );
  }

  if (adding) {
    return (
      <RecordForm
        type={adding}
        batches={vaccinable}
        backLabel={group.name}
        onSaved={(batch) => {
          onUpdated(batch);
          setSaves((count) => count + 1);
          setAdding(null);
        }}
        onCancel={() => setAdding(null)}
      />
    );
  }

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All coops
      </button>

      {broodingDue(group.name, entries).map(({ batch, age, birds }) => (
        <p key={batch._id} className="alert" role="status">
          <span>
            <strong>{batch.batchName}</strong> is {formatNumber(age)} days old. The brooding
            period has ended. Shift its {formatNumber(birds)} birds to coops.
          </span>
        </p>
      ))}

      <section className="card">
        <h2 className="eyebrow">Coop</h2>
        <div className="batch-head manage-head">
          <h3>{group.name}</h3>
          <span className="badges">
            {group.farm && <span className="badge">{group.farm}</span>}
            {broodingAge(group.name, entries) && (
              <span className="badge age">Age {broodingAge(group.name, entries)}</span>
            )}
          </span>
        </div>

        {/* The batch in the coop now. A coop holds one at a time, but older data may have more. */}
        <ul className="coop-batches">
          {current.length === 0 && <li>No batch in this coop now</li>}
          {current.map(({ batch }) => (
            <li key={batch._id}>
              <button type="button" className="link inline" onClick={() => onOpenBatch(batch._id)}>
                {batch.batchName}
              </button>
              <span>
                {batch.breed} · Age {batchAge(batch)} · Started {formatDate(batch.startDate)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="batch-stats four">
          <div>
            <dt>Live Birds</dt>
            <dd>{formatNumber(live)}</dd>
          </div>
          <div>
            <dt>Mortality</dt>
            <dd>{formatNumber(mortality)}</dd>
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
          <div>
            <dt>Last Avg Weight</dt>
            <dd>{!records ? '…' : lastWeight ? formatWeight(lastWeight.avgWeightG) : '—'}</dd>
          </div>
          <div>
            <dt>Fed Today</dt>
            <dd className={feeding?.due && live > 0 ? 'pending' : ''}>
              {feeding ? `${feeding.count} / ${FEEDS_PER_DAY}` : '…'}
            </dd>
          </div>
        </dl>

        {/* Nothing left to say once the day's feeds are done */}
        {feeding && live > 0 && feeding.count < FEEDS_PER_DAY && (
          <p className={feeding.due ? 'feed-note due' : 'feed-note'}>{feeding.text}</p>
        )}
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

      {/* Nothing to add once every live bird is vaccinated */}
      {view === 'vaccinations' && vaccinated !== null && live > vaccinated && (
        <button type="button" className="primary small add-record" onClick={() => setAdding('vaccination')}>
          ＋ Add Vaccination
        </button>
      )}
      {view === 'feeding' && live > 0 && (
        <button type="button" className="primary small add-record" onClick={() => setAdding('feed')}>
          ＋ Enter Feed
        </button>
      )}
      {view === 'weight' && live > 0 && (
        <button type="button" className="primary small add-record" onClick={() => setAdding('weight')}>
          ＋ Enter Avg Weight
        </button>
      )}
      {view === 'mortality' && live > 0 && (
        <button
          type="button"
          className="primary small add-record"
          onClick={() => setAdding('mortality')}
        >
          ＋ Register Mortality
        </button>
      )}

      <BatchRecords
        view={view}
        entries={entries}
        records={records}
        error={error}
        onOpenEntry={(kind, record) => setOpened({ kind, record })}
      />
    </div>
  );
}
