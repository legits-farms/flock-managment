import { useState } from 'react';
import { coopLive, formatNumber, vaccinatedBirds } from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchRecords from './BatchRecords.jsx';

const VIEWS = [
  { id: 'batches', label: 'Batches' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'activity', label: 'Activity Logs' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// `group` is one coop from coopGroups(): every batch that has been in it
export default function CoopPage({ group, onBack, onOpenBatch }) {
  const [view, setView] = useState('batches');
  const { entries } = group;
  const { records, error } = useBatchRecords(entries.map(({ batch }) => batch._id));

  const coops = entries.map(({ coop }) => coop);
  const live = coops.reduce((sum, coop) => sum + coopLive(coop), 0);
  const mortality = coops.reduce((sum, coop) => sum + (coop.mortality ?? 0), 0);
  // null until the vaccination records have loaded
  const vaccinated = records ? vaccinatedBirds({ coops }, records.vaccinations) : null;

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All coops
      </button>

      <section className="card">
        <h2 className="eyebrow">Coop</h2>
        <div className="batch-head manage-head">
          <h3>{group.name}</h3>
          {group.farm && <span className="badge">{group.farm}</span>}
        </div>

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
        </dl>
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

      {view === 'batches' ? (
        <section className="card">
          <h2 className="eyebrow">Batches ({entries.length})</h2>
          <ul className="recent-list">
            {entries.map(({ batch, coop }) => (
              <li key={coop._id}>
                <div>
                  <strong>{batch.batchName}</strong>
                  <small>
                    {batch.breed} · Started {formatDate(batch.startDate)}
                    <br />
                    {formatNumber(coop.birds)} entered · {formatNumber(coopLive(coop))} live ·{' '}
                    {formatNumber(coop.mortality ?? 0)} mortality
                  </small>
                </div>
                <button
                  type="button"
                  className="photo-link"
                  onClick={() => onOpenBatch(batch._id)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <BatchRecords view={view} entries={entries} records={records} error={error} />
      )}
    </div>
  );
}
