import { useState } from 'react';
import {
  coopGroups,
  coopLive,
  formatNumber,
  liveBirds,
  totalMortality,
  vaccinatedBirds,
} from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchRecords from './BatchRecords.jsx';

const VIEWS = [
  { id: 'coops', label: 'Coops' },
  { id: 'batches', label: 'Batches' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'activity', label: 'Activity Logs' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// `batches` is every batch on this farm
export default function FarmPage({ farm, batches, onBack, onOpenBatch, onOpenCoop }) {
  const [view, setView] = useState('coops');
  const { records, error } = useBatchRecords(batches.map((batch) => batch._id));

  const coops = coopGroups(batches);
  const live = batches.reduce((sum, batch) => sum + liveBirds(batch), 0);
  const mortality = batches.reduce((sum, batch) => sum + totalMortality(batch), 0);
  // null until the vaccination records have loaded
  const vaccinated = records
    ? batches.reduce((sum, batch) => sum + vaccinatedBirds(batch, records.vaccinations), 0)
    : null;

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All farms
      </button>

      <section className="card">
        <h2 className="eyebrow">Farm</h2>
        <div className="batch-head manage-head">
          <h3>{farm}</h3>
          <span className="badge">
            {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
          </span>
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

      {view === 'coops' && (
        <section className="card">
          <h2 className="eyebrow">Coops ({coops.length})</h2>
          {coops.length === 0 ? (
            <p className="empty">No coops in use on this farm yet.</p>
          ) : (
            <ul className="recent-list">
              {coops.map((group) => {
                const coopBirds = group.entries.reduce((sum, { coop }) => sum + coopLive(coop), 0);
                return (
                  <li key={group.key}>
                    <div>
                      <strong>{group.name}</strong>
                      <small>
                        {formatNumber(coopBirds)} live ·{' '}
                        {group.entries.map(({ batch }) => batch.batchName).join(', ')}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="photo-link"
                      onClick={() => onOpenCoop(group.key)}
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {view === 'batches' && (
        <section className="card">
          <h2 className="eyebrow">Batches ({batches.length})</h2>
          {batches.length === 0 ? (
            <p className="empty">No batches on this farm yet.</p>
          ) : (
            <ul className="recent-list">
              {batches.map((batch) => (
                <li key={batch._id}>
                  <div>
                    <strong>{batch.batchName}</strong>
                    <small>
                      {batch.breed} · Started {formatDate(batch.startDate)}
                      <br />
                      {formatNumber(liveBirds(batch))} live · {formatNumber(totalMortality(batch))}{' '}
                      mortality
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
          )}
        </section>
      )}

      {view !== 'coops' && view !== 'batches' && (
        <BatchRecords view={view} farmBatches={batches} records={records} error={error} />
      )}
    </div>
  );
}
