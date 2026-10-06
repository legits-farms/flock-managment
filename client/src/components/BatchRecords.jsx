import { formatNumber } from '../flock.js';
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

// A MongoDB id starts with the time it was created at, in seconds
const idTime = (id) => new Date(parseInt(id.slice(0, 8), 16) * 1000);

// Records made before logins existed have no person attached
const byName = (who) => who?.name ?? '';

// Vaccinations / Mortality / Activity Logs tabs, shared by three pages.
// `records` is { mortalities, vaccinations, shifts }, or null while loading.
// Pass one of:
//   batch                 – a batch page
//   entries               – a coop page: the { batch, coop } pairs of every batch in that coop
//   farmBatches + entries – a farm page: the batches registered to the farm, and
//                           the { batch, coop } pairs of every coop on it
export default function BatchRecords({ view, batch, entries, farmBatches, records, error }) {
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
  const shifts = (records.shifts ?? []).filter(
    (s) => !coopIds || coopIds.has(s.fromCoopId) || coopIds.has(s.toCoopId),
  );
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
                <PhotoLink url={`/vaccinations/${r._id}/photo`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (view === 'mortality') {
    const registered = mortalities.reduce((sum, r) => sum + r.birds, 0);
    const onArrival = batches.reduce((sum, b) => sum + b.boxMortality, 0);
    return (
      <section className="card">
        <h2 className="eyebrow">Mortality ({formatNumber(registered + onArrival)} birds)</h2>
        {mortalities.length === 0 && batches.length === 0 && (
          <p className="empty">No mortality registered for this {scope} yet.</p>
        )}
        <ul className="recent-list">
          {mortalities.map((r) => (
            <li key={r._id}>
              <div>
                <strong>
                  {formatNumber(r.birds)} birds · {label(r)}
                </strong>
                <small>
                  {formatDateTime(r.createdAt)}
                  {byName(r.createdBy) && ` · By ${byName(r.createdBy)}`}
                  <br />
                  {r.reason}
                </small>
              </div>
              <PhotoLink url={`/mortalities/${r._id}/photo`} />
            </li>
          ))}
          {batches.map((b) => (
            <li key={b._id}>
              <div>
                <strong>
                  {formatNumber(b.boxMortality)} birds · On arrival
                  {scope === 'farm' && ` · ${b.batchName}`}
                </strong>
                <small>{formatDate(b.startDate)} · Entered with the batch</small>
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
      detail: `${formatNumber(b.numberOfBirds)} birds · ${formatNumber(b.boxMortality)} mortality on arrival`,
      by: byName(b.createdBy),
    })),
    // Coops created by a shift show up as the shift itself, further down
    ...placements
      .filter((entry) => !entry.coop.fromShift)
      .map((entry) => ({
        key: entry.coop._id,
        when: idTime(entry.coop._id),
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
      detail: `${scope === 'batch' ? '' : `${batchName(s)} · `}${formatNumber(s.birds)} birds · ${s.reason}`,
      by: byName(s.createdBy),
    })),
    ...mortalities.map((r) => ({
      key: r._id,
      when: new Date(r.createdAt),
      title: `Mortality registered · ${label(r)}`,
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
