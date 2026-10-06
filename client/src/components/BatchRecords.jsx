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

function buildActivity(batch, entries, mortalities, vaccinations) {
  const placement = entries
    ? entries.map((entry) => ({
        key: entry.coop._id,
        when: idTime(entry.coop._id),
        title: `Batch entered · ${entry.batch.batchName}`,
        detail: `${formatNumber(entry.coop.birds)} birds allocated`,
        by: byName(entry.coop.addedBy),
      }))
    : [
        {
          key: batch._id,
          when: new Date(batch.createdAt),
          title: 'Batch registered',
          detail: `${formatNumber(batch.numberOfBirds)} birds · ${formatNumber(batch.boxMortality)} mortality on arrival`,
          by: byName(batch.createdBy),
        },
        ...batch.coops.map((c) => ({
          key: c._id,
          when: idTime(c._id),
          title: `Coop added · ${c.name}`,
          detail: `${formatNumber(c.birds)} birds allocated`,
          by: byName(c.addedBy),
        })),
      ];

  // On a coop page every record is in that coop, so name the batch instead
  const label = (r) => (entries ? (r.batch?.batchName ?? 'Batch') : r.coopName);

  const log = [
    ...placement,
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
  ];
  return log.sort((a, b) => b.when - a.when);
}

// Vaccinations / Mortality / Activity Logs tabs of the batch and coop pages.
// `records` is { mortalities, vaccinations }, or null while loading.
// A batch page passes `batch`. A coop page passes `entries` instead: the
// { batch, coop } pairs of every batch that has been in that coop.
export default function BatchRecords({ view, batch, entries, records, error }) {
  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!records) return <p className="status">Loading…</p>;

  const coopIds = entries && new Set(entries.map((entry) => entry.coop._id));
  const inScope = (r) => !coopIds || coopIds.has(r.coopId);
  const label = (r) => (entries ? (r.batch?.batchName ?? 'Batch') : r.coopName);
  const mortalities = records.mortalities.filter(inScope);
  const vaccinations = records.vaccinations.filter(inScope);
  const scope = entries ? 'coop' : 'batch';

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
    // Mortality on arrival belongs to the batch, not to any one coop
    const total = entries ? registered : batch.boxMortality + registered;
    return (
      <section className="card">
        <h2 className="eyebrow">Mortality ({formatNumber(total)} birds)</h2>
        {entries && mortalities.length === 0 && (
          <p className="empty">No mortality registered for this coop yet.</p>
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
          {!entries && (
            <li>
              <div>
                <strong>{formatNumber(batch.boxMortality)} birds · On arrival</strong>
                <small>{formatDate(batch.startDate)} · Entered with the batch</small>
              </div>
            </li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="eyebrow">Activity Logs</h2>
      <ul className="recent-list">
        {buildActivity(batch, entries, mortalities, vaccinations).map((entry) => (
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
