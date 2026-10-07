import { useState } from 'react';
import { addCoopName } from '../api.js';
import {
  broodingAge,
  broodingDue,
  coopGroups,
  coopLive,
  coopsOnFarm,
  formatNumber,
} from '../flock.js';
import LoadStatus from './LoadStatus.jsx';
import NameSheet from './NameSheet.jsx';

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The house a coop is part of: its name without the partition letter, so
// "Coop 1A" … "Coop 1H" are all "Coop 1" and "Brooding A" is "Brooding"
const houseOf = (name) => name.trim().replace(/(\s+|(?<=\d))[a-z]$/i, '');

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
  const [chosenHouse, setChosenHouse] = useState(null);
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

  // Only worth filtering by when the farm's coops are split into partitions
  const houses = coops.reduce(
    (found, { name }) =>
      found.some((other) => sameName(other, houseOf(name))) ? found : [...found, houseOf(name)],
    []
  );
  const canFilter = houses.length > 1 && houses.length < coops.length;
  const house = canFilter ? chosenHouse : null;
  const shown = house ? coops.filter(({ name }) => sameName(houseOf(name), house)) : coops;

  return (
    <div className="manage">
      <div className="list-head">
        <h2>
          Coops <span>{shown.length}</span>
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
            onClick={() => {
              setChosenFarm(name);
              setChosenHouse(null);
            }}
          >
            {name}
          </button>
        ))}
      </div>

      {canFilter && (
        <div className="subtabs" role="group" aria-label="Filter coops">
          {[null, ...houses].map((name) => (
            <button
              key={name ?? ''}
              type="button"
              aria-pressed={name === house}
              className={name === house ? 'active' : ''}
              onClick={() => setChosenHouse(name)}
            >
              {name ?? 'All'}
            </button>
          ))}
        </div>
      )}

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
        {shown.map(({ name, group }) => {
          // A coop no batch has been in shows the same card, all zeros
          const entries = group?.entries ?? [];
          const current = entries.filter(({ coop }) => coopLive(coop) > 0);
          const entered = entries.reduce((sum, { coop }) => sum + coop.birds, 0);
          const live = entries.reduce((sum, { coop }) => sum + coopLive(coop), 0);
          const livability = entered > 0 ? (live / entered) * 100 : 0;

          const card = (
            <>
              <span className="batch-head">
                <span className="batch-title">
                  <strong>{name}</strong>
                  {/* The batch in the coop now: one at a time, but older data may have more */}
                  <small>
                    {current.length === 0
                      ? 'Empty'
                      : current
                          .map(({ batch }) => `${batch.batchName} · ${batch.breed}`)
                          .join(', ')}
                  </small>
                </span>
                <span className="badges">
                  {broodingAge(name, entries) && (
                    <span className="badge age">Age {broodingAge(name, entries)}</span>
                  )}
                  {group && (
                    <span className="alert-go" aria-hidden="true">
                      ›
                    </span>
                  )}
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

              {broodingDue(name, entries).length > 0 && (
                <span className="due-note">
                  The brooding period has ended. Shift these birds to coops.
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
