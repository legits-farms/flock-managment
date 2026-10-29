import { useState } from 'react';
import { addCoopName, addFarm } from '../api.js';
import {
  coopAge,
  broodingDue,
  coopGroups,
  coopLive,
  coopsOnFarm,
  coopsWithParts,
  farmSummary,
  formatNumber,
  canSplit,
  partOf,
  placeType,
} from '../flock.js';
import LoadStatus from './LoadStatus.jsx';
import NameSheet from './NameSheet.jsx';
import PartSheet from './PartSheet.jsx';

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The house a coop is part of: "Coop 1A" and "Coop 1 Sonali" are both in
// "Coop 1", and "Brooding A" and its part "Brooding A2" are in "Brooding"
const houseOf = (name) => (partOf(name)?.coop ?? name).trim().replace(/\s+[a-z]$/i, '');

// The farms and their coops on one screen: pick a farm, see what it holds, then
// its coops, one card each: those holding birds first, then the empty ones with
// every figure at zero. A coop that has held birds opens its page. `onOpenFarm`
// opens the farm's page. `canAddFarm` is off for a farm manager, who has their
// own farm alone.
export default function CoopList({
  batches,
  farms,
  coopsByFarm,
  canAddFarm = true,
  onOptions,
  loading,
  error,
  onRetry,
  onOpen,
  onOpenFarm,
}) {
  const [chosenFarm, setChosenFarm] = useState(null);
  const [chosenHouse, setChosenHouse] = useState(null);
  // Name sheet open: 'coop' | 'part' | 'farm' | null
  const [adding, setAdding] = useState(null);

  if (loading || error) return <LoadStatus loading={loading} error={error} onRetry={onRetry} />;

  const farmSheet = adding === 'farm' && (
    <NameSheet
      title="Add a Farm"
      label="Farm Name"
      submitLabel="Add Farm"
      onSubmit={async (name) => {
        onOptions(await addFarm(name));
        setChosenFarm(name);
        setChosenHouse(null);
      }}
      onClose={() => setAdding(null)}
    />
  );

  if (farms.length === 0) {
    return (
      <div className="status">
        <p>
          {canAddFarm
            ? 'No farms yet. Add your first farm.'
            : 'Your farm is not on the list any more. Ask the admin.'}
        </p>
        {canAddFarm && (
          <button type="button" className="primary" onClick={() => setAdding('farm')}>
            ＋ Add Farm
          </button>
        )}
        {farmSheet}
      </div>
    );
  }

  // A farm just added is chosen by the name typed, whatever its listed spelling
  const farm = farms.find((name) => chosenFarm && sameName(name, chosenFarm)) ?? farms[0];
  const groups = coopGroups(batches).filter((group) => sameName(group.farm, farm));
  // A coop split into parts is listed as its parts, unless birds were put in it whole
  const withParts = coopsWithParts(coopsOnFarm(coopsByFarm, farm));
  const split = withParts.filter((coop) => coop.parts.length > 0);
  const listed = coopsOnFarm(coopsByFarm, farm).filter(
    (name) =>
      !split.some((coop) => sameName(coop.name, name)) ||
      groups.some((group) => sameName(group.name, name))
  );
  const summary = farmSummary(batches, farm);

  // Every listed coop of the farm, in list order, then any in use that are not listed
  const coops = [
    ...listed.map((name) => ({
      name,
      group: groups.find((group) => sameName(group.name, name)),
    })),
    ...groups
      .filter((group) => !listed.some((name) => sameName(name, group.name)))
      .map((group) => ({ name: group.name, group })),
  ].map((coop) => ({
    ...coop,
    live: (coop.group?.entries ?? []).reduce((sum, entry) => sum + coopLive(entry.coop), 0),
  }));

  // Only worth filtering by when the farm's coops are split into partitions
  const houses = coops.reduce(
    (found, { name }) =>
      found.some((other) => sameName(other, houseOf(name))) ? found : [...found, houseOf(name)],
    []
  );
  const canFilter = houses.length > 1 && houses.length < coops.length;
  const house = canFilter ? chosenHouse : null;
  const shown = house ? coops.filter(({ name }) => sameName(houseOf(name), house)) : coops;
  const inUse = shown.filter((coop) => coop.live > 0);
  const empty = shown.filter((coop) => coop.live === 0);

  // The coops a part can be added to ("Coop 5A", "Coop 5 Sonali"), in number order:
  // brooding houses first, while each has parts to spare. Birds already in the
  // coop as a whole stay there and can be shifted into its parts.
  const splittable = withParts
    // Parts are named after a coop's number or a brooding house's letter
    .filter(canSplit)
    .sort(
      (a, b) =>
        (placeType(a.name) === 'brooding' ? 0 : 1) - (placeType(b.name) === 'brooding' ? 0 : 1) ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  // With one coop picked, the part goes to that coop
  const houseCoop = house && splittable.find((coop) => sameName(coop.name, house));

  return (
    <div className="manage wide">
      <div className="list-head">
        <h2>Farms &amp; Coops</h2>
        <span className="list-head-actions">
          {splittable.length > 0 && (
            <button type="button" className="secondary small" onClick={() => setAdding('part')}>
              ＋ Add Part
            </button>
          )}
          <button type="button" className="primary small" onClick={() => setAdding('coop')}>
            ＋ Add Coop
          </button>
        </span>
      </div>

      <div className="subtabs" role="tablist" aria-label="Farm">
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
        {canAddFarm && (
          <button type="button" className="add" onClick={() => setAdding('farm')}>
            ＋ Farm
          </button>
        )}
      </div>

      <section className="hero">
        <button type="button" className="hero-action" onClick={() => onOpenFarm(farm)}>
          Farm Details ›
        </button>
        <p className="hero-label">{farm}</p>
        <p className="hero-value">{formatNumber(summary.live)}</p>
        <dl className="hero-stats">
          <div>
            <dt>Coops in Use</dt>
            <dd>
              {formatNumber(coops.filter((coop) => coop.live > 0).length)}
              <small>of {formatNumber(coops.length)}</small>
            </dd>
          </div>
          <div>
            <dt>Batches</dt>
            <dd>{formatNumber(summary.present.length)}</dd>
          </div>
          <div>
            <dt>Mortality</dt>
            <dd>{formatNumber(summary.mortality)}</dd>
          </div>
        </dl>
      </section>

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

      {adding === 'coop' && (
        <NameSheet
          title={`Add a Coop to ${farm}`}
          label="Coop Name"
          submitLabel="Add Coop"
          onSubmit={async (name) => onOptions(await addCoopName(farm, name))}
          onClose={() => setAdding(null)}
        />
      )}
      {adding === 'part' && (
        <PartSheet
          coops={splittable}
          initialCoop={houseCoop?.name}
          onSubmit={async (name) => onOptions(await addCoopName(farm, name))}
          onClose={() => setAdding(null)}
        />
      )}
      {farmSheet}

      {[
        ['With Birds', inUse],
        ['Empty', empty],
      ]
        .filter(([, list]) => list.length > 0)
        .map(([title, list]) => (
          <section className="coop-section" key={title}>
            <h3 className="record-day">
              {title} ({list.length})
            </h3>
            <ul className="batch-list">
              {list.map(({ name, group, live }) => {
                // A coop no batch has been in shows the same card, all zeros
                const entries = group?.entries ?? [];
                const current = entries.filter(({ coop }) => coopLive(coop) > 0);
                const entered = entries.reduce((sum, { coop }) => sum + coop.birds, 0);
                const mortality = entries.reduce((sum, { coop }) => sum + (coop.mortality ?? 0), 0);
                // Sold birds left alive, so they do not count against the coop
                const livability = entered > 0 ? ((entered - mortality) / entered) * 100 : 0;

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
                        {coopAge(entries) && (
                          <span className="badge age">Age {coopAge(entries)}</span>
                        )}
                        {group && (
                          <span className="alert-go" aria-hidden="true">
                            ›
                          </span>
                        )}
                      </span>
                    </span>

                    {/* An empty coop is a single line: its figures would all be zero */}
                    {live > 0 && (
                      <>
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
                              <b>{formatNumber(mortality)}</b> mortality
                            </span>
                          </span>
                        </span>

                        <span className="bar">
                          <span style={{ width: `${livability}%` }} />
                        </span>
                        <span className="batch-livability">
                          {livability.toFixed(1)}% livability
                        </span>
                      </>
                    )}

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
                      <button
                        type="button"
                        className={`card batch ${live > 0 ? '' : 'compact'}`}
                        onClick={() => onOpen(group.key)}
                      >
                        {card}
                      </button>
                    ) : (
                      // Nothing to open until a batch is allocated here
                      <div className="card batch static compact">{card}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
