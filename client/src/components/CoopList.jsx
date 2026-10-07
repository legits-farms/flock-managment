import { useState } from 'react';
import { addCoopName } from '../api.js';
import { coopGroups, coopLive, coopsOnFarm, formatNumber } from '../flock.js';
import LoadStatus from './LoadStatus.jsx';
import NameSheet from './NameSheet.jsx';

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The coops of each farm, one farm per tab. A coop holding birds opens its page.
export default function CoopList({
  batches,
  farms,
  coopsByFarm,
  onOptions,
  loading,
  error,
  onRetry,
  onOpen,
}) {
  const [chosenFarm, setChosenFarm] = useState(null);
  const [adding, setAdding] = useState(false);

  if (loading || error) return <LoadStatus loading={loading} error={error} onRetry={onRetry} />;
  if (farms.length === 0) return <p className="status">No farms yet. Add one in the Farms tab.</p>;

  const farm = chosenFarm ?? farms[0];
  const groups = coopGroups(batches).filter((group) => sameName(group.farm, farm));
  const listed = coopsOnFarm(coopsByFarm, farm);

  // Every listed coop of the farm, in list order, then any in use that are not listed
  const coops = [
    ...listed.map((name) => ({
      name,
      group: groups.find((group) => sameName(group.name, name)),
    })),
    ...groups
      .filter((group) => !listed.some((name) => sameName(name, group.name)))
      .map((group) => ({ name: group.name, group })),
  ];

  return (
    <div className="manage">
      <div className="list-head">
        <h2>
          Coops <span>{coops.length}</span>
        </h2>
        <button type="button" className="primary small" onClick={() => setAdding(true)}>
          ＋ Add Coop
        </button>
      </div>

      <div className="subtabs" role="tablist">
        {farms.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === farm}
            className={name === farm ? 'active' : ''}
            onClick={() => setChosenFarm(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {coops.length === 0 && <p className="status">No coops on {farm} yet. Add the first one.</p>}

      {adding && (
        <NameSheet
          title={`Add a Coop to ${farm}`}
          label="Coop Name"
          submitLabel="Add Coop"
          onSubmit={async (name) => onOptions(await addCoopName(farm, name))}
          onClose={() => setAdding(false)}
        />
      )}

      <ul className="batch-list">
        {coops.map(({ name, group }) => {
          // A coop no batch has been in shows the same card, all zeros
          const entries = group?.entries ?? [];
          const entered = entries.reduce((sum, { coop }) => sum + coop.birds, 0);
          const live = entries.reduce((sum, { coop }) => sum + coopLive(coop), 0);
          const livability = entered > 0 ? (live / entered) * 100 : 0;

          const card = (
            <>
              <span className="batch-head">
                <span className="batch-title">
                  <strong>{name}</strong>
                </span>
                <span className="badge">
                  {entries.length} {entries.length === 1 ? 'batch' : 'batches'}
                </span>
              </span>

              <span className="batch-figures">
                <span className="batch-live">
                  <b>{formatNumber(live)}</b>
                  live birds
                </span>
                <span className="batch-side">
                  <span>
                    <b>{formatNumber(entered)}</b> in coop
                  </span>
                  <span>
                    <b>{formatNumber(entered - live)}</b> mortality
                  </span>
                </span>
              </span>

              <span className="bar">
                <span style={{ width: `${livability}%` }} />
              </span>
              <span className="batch-livability">{livability.toFixed(1)}% livability</span>

              {group && (
                <span className="batch-foot">
                  <span className="chips">
                    {entries.map(({ batch }) => (
                      <span key={batch._id} className="chip">
                        {batch.batchName} · {batch.breed}
                      </span>
                    ))}
                  </span>
                  <span className="alert-go" aria-hidden="true">
                    ›
                  </span>
                </span>
              )}
            </>
          );

          return (
            <li key={group?.key ?? name}>
              {group ? (
                <button type="button" className="card batch" onClick={() => onOpen(group.key)}>
                  {card}
                </button>
              ) : (
                // Nothing to open until a batch is allocated here
                <div className="card batch static">{card}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
