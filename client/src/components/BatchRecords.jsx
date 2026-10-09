import { useState } from 'react';
import {
  MORTALITY_LABELS,
  photoCount,
  formatKg,
  formatNumber,
  formatRupees,
  formatWeight,
  mortalityLabel,
  saleSetBill,
  mortalityType,
} from '../flock.js';
import PhotoLink from './PhotoLink.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// A feed or weight row: the whole row opens the entry when the page can show it
function EntryRow({ onOpen, children }) {
  if (!onOpen) return <div>{children}</div>;
  return (
    <button type="button" className="row-button" onClick={onOpen}>
      <span>{children}</span>
      <span className="alert-go" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

// Records made before logins existed have no person attached
const byName = (who) => who?.name ?? '';

// Vaccinations / Feeding / Weight / Mortality / Activity Logs tabs, shared by three pages.
// `records` is { mortalities, vaccinations, shifts, feeds, weights, sales }, or null while loading.
// Pass one of:
//   batch                 – a batch page
//   entries               – a coop page: the { batch, coop } pairs of every batch in that coop
//   farmBatches + entries – a farm page: the batches registered to the farm, and
//                           the { batch, coop } pairs of every coop on it
// `onOpenEntry(kind, record)` makes feed and weight rows open their details.
export default function BatchRecords({
  view,
  batch,
  entries,
  farmBatches,
  records,
  error,
  onOpenEntry,
}) {
  // Mortality type shown on the Mortality tab: '' for all of them
  const [shownType, setShownType] = useState('');

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!records) return <p className="status">Loading…</p>;

  const scope = farmBatches ? 'farm' : entries ? 'coop' : 'batch';
  // Batches whose registration and on-arrival mortality belong on this page.
  // A coop page has none: those belong to the batch, not to any one coop.
  const batches = farmBatches ?? (batch ? [batch] : []);
  const placements = entries ?? batches.flatMap((b) => b.coops.map((coop) => ({ batch: b, coop })));

  const coopIds = entries && new Set(entries.map((entry) => entry.coop._id));
  const inScope = (r) => !coopIds || coopIds.has(r.coopId);
  const mortalities = records.mortalities.filter(inScope);
  const vaccinations = records.vaccinations.filter(inScope);
  const feeds = (records.feeds ?? []).filter(inScope);
  const weights = (records.weights ?? []).filter(inScope);
  const shifts = (records.shifts ?? []).filter(
    (s) => !coopIds || coopIds.has(s.fromCoopId) || coopIds.has(s.toCoopId),
  );
  // Each sale with just the sets weighed out of this page's coops: a sale can
  // also hold birds from other batches and coops
  const placedIds = new Set(placements.map((entry) => entry.coop._id));
  const sales = (records.sales ?? [])
    .map((sale) => ({ sale, sets: sale.sets.filter((set) => placedIds.has(set.coopId)) }))
    .filter(({ sets }) => sets.length > 0);
  // Farms are only worth naming when a shift crosses between them
  const shiftPlace = (s, name, farm) =>
    s.fromFarm.toLowerCase() === s.toFarm.toLowerCase() || !farm ? name : `${name} (${farm})`;

  // Name whatever the page itself does not already imply
  const batchName = (r) => r.batch?.batchName ?? 'Batch';
  const label = (r) =>
    scope === 'batch'
      ? r.coopName
      : scope === 'coop'
        ? batchName(r)
        : `${batchName(r)} · ${r.coopName}`;

  if (view === 'vaccinations') {
    return (
      <section className="card">
        <h2 className="eyebrow">Vaccinations ({vaccinations.length})</h2>
        {vaccinations.length === 0 ? (
          <p className="empty">No vaccinations added for this {scope} yet.</p>
        ) : (
          <ul className="recent-list">
            {vaccinations.map((r) => (
              <li key={r._id}>
                <div>
                  <strong>{r.vaccine}</strong>
                  <small>
                    {label(r)} · {formatDate(r.date)} · {formatNumber(r.birds)} birds
                    {r.remarks && (
                      <>
                        <br />
                        {r.remarks}
                      </>
                    )}
                    {byName(r.createdBy) && (
                      <>
                        <br />
                        By {byName(r.createdBy)}
                      </>
                    )}
                  </small>
                </div>
                <PhotoLink url={`/vaccinations/${r._id}/photo`} count={photoCount(r)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (view === 'feeding') {
    const totalKg = feeds.reduce((sum, r) => sum + r.quantityKg, 0);
    return (
      <section className="card">
        <h2 className="eyebrow">Feeding ({formatKg(totalKg)})</h2>
        {feeds.length === 0 ? (
          <p className="empty">No feed entered for this {scope} yet.</p>
        ) : (
          <ul className="recent-list">
            {feeds.map((r) => (
              <li key={r._id}>
                <EntryRow onOpen={onOpenEntry && (() => onOpenEntry('feed', r))}>
                  <strong>
                    {formatKg(r.quantityKg)} · {r.feedType}
                  </strong>
                  <small>
                    {label(r)} · {formatDate(r.date)}, {formatTime(r.createdAt)}
                    {byName(r.createdBy) && ` · By ${byName(r.createdBy)}`}
                    {r.remarks && (
                      <>
                        <br />
                        {r.remarks}
                      </>
                    )}
                  </small>
                </EntryRow>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (view === 'weight') {
    return (
      <section className="card">
        <h2 className="eyebrow">
          Avg Weight{weights.length > 0 && ` (latest ${formatWeight(weights[0].avgWeightG)})`}
        </h2>
        {weights.length === 0 ? (
          <p className="empty">No weight entered for this {scope} yet.</p>
        ) : (
          <ul className="recent-list">
            {weights.map((r) => (
              <li key={r._id}>
                <EntryRow onOpen={onOpenEntry && (() => onOpenEntry('weight', r))}>
                  <strong>{formatWeight(r.avgWeightG)} avg</strong>
                  <small>
                    {label(r)} · {formatDate(r.date)}, {formatTime(r.createdAt)}
                    {byName(r.createdBy) && ` · By ${byName(r.createdBy)}`}
                    <br />
                    {formatNumber(r.birds)} birds weighed · {formatKg(r.totalWeightKg)} in total
                    {r.remarks && (
                      <>
                        <br />
                        {r.remarks}
                      </>
                    )}
                  </small>
                </EntryRow>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (view === 'mortality') {
    // Birds lost per type. Box mortality comes with the batches, the rest are records.
    const lost = { box: batches.reduce((sum, b) => sum + b.boxMortality, 0) };
    for (const r of mortalities) lost[mortalityType(r)] = (lost[mortalityType(r)] ?? 0) + r.birds;
    const total = Object.values(lost).reduce((sum, birds) => sum + birds, 0);

    const shownRecords = mortalities.filter((r) => !shownType || mortalityType(r) === shownType);
    const shownBatches = !shownType || shownType === 'box' ? batches : [];
    return (
      <section className="card">
        <h2 className="eyebrow">Mortality ({formatNumber(total)} birds)</h2>
        <div className="segments" role="tablist">
          {['', 'brooding', 'box', 'shift', 'coop'].map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={shownType === type}
              className={shownType === type ? 'active' : ''}
              onClick={() => setShownType(type)}
            >
              {type ? MORTALITY_LABELS[type] : 'All'}
              {(type ? lost[type] : total) > 0 && (
                <span>{formatNumber(type ? lost[type] : total)}</span>
              )}
            </button>
          ))}
        </div>
        {shownRecords.length === 0 && shownBatches.length === 0 && (
          <p className="empty">
            {shownType === 'box' && scope === 'coop'
              ? 'Box mortality is counted on the batch, not on a coop.'
              : `No ${shownType ? `${MORTALITY_LABELS[shownType].toLowerCase()} ` : ''}mortality registered for this ${scope} yet.`}
          </p>
        )}
        <ul className="recent-list">
          {shownRecords.map((r) => (
            <li key={r._id}>
              <div>
                <strong>
                  {formatNumber(r.birds)} birds · {label(r)}
                </strong>
                <small>
                  {mortalityLabel(r)} · {formatDateTime(r.date ?? r.createdAt)}
                  {byName(r.createdBy) && ` · By ${byName(r.createdBy)}`}
                  <br />
                  {r.reason}
                </small>
              </div>
              <PhotoLink url={`/mortalities/${r._id}/photo`} count={photoCount(r)} />
            </li>
          ))}
          {shownBatches.map((b) => (
            <li key={b._id}>
              <div>
                <strong>
                  {formatNumber(b.boxMortality)} birds · On arrival
                  {scope === 'farm' && ` · ${b.batchName}`}
                </strong>
                <small>Box mortality · {formatDate(b.startDate)} · Entered with the batch</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const activity = [
    ...batches.map((b) => ({
      key: b._id,
      when: new Date(b.createdAt),
      title: scope === 'farm' ? `Batch registered · ${b.batchName}` : 'Batch registered',
      detail: `${formatNumber(b.numberOfBirds)} birds · ${formatNumber(b.boxMortality)} box mortality`,
      by: b.enteredBy || byName(b.createdBy),
    })),
    // Coops created by a shift show up as the shift itself, further down
    ...placements
      .filter((entry) => !entry.coop.fromShift)
      .map((entry) => ({
        key: entry.coop._id,
        when: new Date(entry.coop.createdAt),
        title:
          scope === 'coop'
            ? `Batch entered · ${entry.batch.batchName}`
            : scope === 'farm'
              ? `Coop added · ${entry.batch.batchName} · ${entry.coop.name}`
              : `Coop added · ${entry.coop.name}`,
        detail: `${formatNumber(entry.coop.birds)} birds in the coop now`,
        by: byName(entry.coop.addedBy),
      })),
    ...shifts.map((s) => ({
      key: s._id,
      when: new Date(s.createdAt),
      title: `Birds shifted · ${shiftPlace(s, s.fromCoopName, s.fromFarm)} → ${shiftPlace(s, s.toCoopName, s.toFarm)}`,
      detail: `${scope === 'batch' ? '' : `${batchName(s)} · `}${formatNumber(s.birds)} birds${
        s.mortality > 0 ? ` · ${formatNumber(s.mortality)} shift mortality` : ''
      } · ${s.reason}`,
      by: byName(s.createdBy),
    })),
    ...mortalities.map((r) => ({
      key: r._id,
      when: new Date(r.createdAt),
      title: `${mortalityLabel(r)} registered · ${label(r)}`,
      detail: `${formatNumber(r.birds)} birds · ${r.reason}`,
      by: byName(r.createdBy),
    })),
    ...vaccinations.map((r) => ({
      key: r._id,
      when: new Date(r.createdAt),
      title: `Vaccination added · ${label(r)}`,
      detail: `${r.vaccine} · ${formatNumber(r.birds)} birds`,
      by: byName(r.createdBy),
    })),
    ...feeds.map((r) => ({
      key: r._id,
      when: new Date(r.createdAt),
      title: `Feed entered · ${label(r)}`,
      detail: `${formatKg(r.quantityKg)} · ${r.feedType}`,
      by: byName(r.createdBy),
    })),
    ...weights.map((r) => ({
      key: r._id,
      when: new Date(r.createdAt),
      title: `Weight entered · ${label(r)}`,
      detail: `${formatWeight(r.avgWeightG)} avg · ${formatNumber(r.birds)} birds weighed`,
      by: byName(r.createdBy),
    })),
    ...sales.map(({ sale, sets }) => {
      const birds = sets.reduce((sum, set) => sum + set.birds, 0);
      const weightKg = sets.reduce((sum, set) => sum + set.weightKg, 0);
      const amount = sets.reduce((sum, set) => sum + saleSetBill(sale, set), 0);
      // Where the birds came from, named the way `label` names a record
      const from = [
        ...new Set(sets.map((set) => label({ batch: set.batch, coopName: set.coopName }))),
      ];
      return {
        key: sale._id,
        when: new Date(sale.createdAt),
        title: `Birds sold · ${from.join(', ')}`,
        detail: `${formatNumber(birds)} birds · ${formatKg(weightKg)} · ${formatRupees(amount)} · To ${sale.customer.name}`,
        by: byName(sale.createdBy),
      };
    }),
  ].sort((a, b) => b.when - a.when);

  return (
    <section className="card">
      <h2 className="eyebrow">Activity Logs</h2>
      {activity.length === 0 && <p className="empty">Nothing has happened on this {scope} yet.</p>}
      <ul className="recent-list">
        {activity.map((entry) => (
          <li key={entry.key}>
            <div>
              <strong>{entry.title}</strong>
              <small>
                {formatDateTime(entry.when)}
                {entry.by && ` · By ${entry.by}`}
                <br />
                {entry.detail}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
