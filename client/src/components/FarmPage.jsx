import { useState } from 'react';
import { addCoopName } from '../api.js';
import {
  batchAge,
  broodingAge,
  coopGroups,
  coopLive,
  farmSummary,
  formatNumber,
  liveBirds,
  totalMortality,
  vaccinatedBirds,
} from '../flock.js';
import useBatchRecords from '../useBatchRecords.js';
import BatchRecords from './BatchRecords.jsx';
import NameSheet from './NameSheet.jsx';

const VIEWS = [
  { id: 'coops', label: 'Coops' },
  { id: 'batches', label: 'Batches' },
  { id: 'mortality', label: 'Mortality' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'activity', label: 'Activity Logs' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// `allBatches` is every batch; the page works out what is on this farm.
// `coopNames` is the farm's listed coops.
export default function FarmPage({
  farm,
  allBatches,
  coopNames,
  onOptions,
  onBack,
  onOpenBatch,
  onOpenCoop,
}) {
  const [view, setView] = useState('coops');
  const [addingCoop, setAddingCoop] = useState(false);
  const { home, entries, present: batches, live, mortality } = farmSummary(allBatches, farm);
  const { records, error } = useBatchRecords(batches.map((batch) => batch._id));

  const inUse = coopGroups(allBatches).filter((group) => sameName(group.farm, farm));
  // Every listed coop of the farm, in list order, then any in use that are not listed
  const coops = [
    ...coopNames.map((name) => ({
      name,
      group: inUse.find((group) => sameName(group.name, name)),
    })),
    ...inUse
      .filter((group) => !coopNames.some((name) => sameName(name, group.name)))
      .map((group) => ({ name: group.name, group })),
  ];
  // null until the vaccination records have loaded
  const vaccinated = records
    ? vaccinatedBirds({ coops: entries.map(({ coop }) => coop) }, records.vaccinations)
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
          <div className="section-head">
            <h2 className="eyebrow">Coops ({coops.length})</h2>
            <button type="button" className="primary small" onClick={() => setAddingCoop(true)}>
              ＋ Add Coop
            </button>
          </div>
          {coops.length === 0 ? (
            <p className="empty">No coops on this farm yet. Add the first one.</p>
          ) : (
            <ul className="recent-list">
              {coops.map(({ name, group }) => {
                if (!group) {
                  return (
                    <li key={name}>
                      <div>
                        <strong>{name}</strong>
                        <small>Empty</small>
                      </div>
                    </li>
                  );
                }
                const coopBirds = group.entries.reduce((sum, { coop }) => sum + coopLive(coop), 0);
                return (
                  <li key={group.key}>
                    <div>
                      <strong>
                        {group.name}
                        {broodingAge(group.name, group.entries) && (
                          <>
                            {' '}
                            <span className="badge age">
                              Age {broodingAge(group.name, group.entries)}
                            </span>
                          </>
                        )}
                      </strong>
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

      {addingCoop && (
        <NameSheet
          title={`Add a Coop to ${farm}`}
          label="Coop Name"
          submitLabel="Add Coop"
          onSubmit={async (name) => onOptions(await addCoopName(farm, name))}
          onClose={() => setAddingCoop(false)}
        />
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
                      {batch.breed} · Age {batchAge(batch)} · Started {formatDate(batch.startDate)}
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
        <BatchRecords
          view={view}
          farmBatches={home}
          entries={entries}
          records={records}
          error={error}
        />
      )}
    </div>
  );
}
