import { formatKg, formatNumber, formatRupees, formatWeight } from '../flock.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// What one batch has eaten so far and what it cost: the totals, the split by
// feed type and every feeding, newest first. `fed` is the batch's feedCost and
// `live` its live birds.
export default function BatchFeed({ feeds, fed, live }) {
  if (feeds.length === 0) {
    return <p className="status">No feed entered for this batch yet.</p>;
  }

  const mostKg = Math.max(...fed.types.map((type) => type.kg));
  // Latest feeding day first; within a day, the latest entry first
  const newestFirst = [...feeds].sort(
    (a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt),
  );

  return (
    <>
      <section className="card">
        <h2 className="eyebrow">Feed Consumption</h2>
        <p className="chart-figure">
          <strong>{formatRupees(fed.cost)}</strong>
          <span>feed cost so far</span>
        </p>

        <dl className="batch-stats">
          <div>
            <dt>Consumed</dt>
            <dd>{formatKg(fed.kg)}</dd>
          </div>
          <div>
            <dt>Feed per Bird</dt>
            {/* Feed consumed divided by the live birds, in g up to a kilo and kg from there */}
            <dd>
              {live > 0 ? formatWeight(Number(((fed.kg * 1000) / live).toFixed(1))) : '—'}
            </dd>
          </div>
          <div>
            <dt>Cost per Bird</dt>
            <dd>{live > 0 ? formatRupees(fed.cost / live) : '—'}</dd>
          </div>
        </dl>

        <ul className="breed-list">
          {fed.types.map((type) => (
            <li key={type.feedType}>
              <div className="breed-row">
                <span className="breed-name">{type.feedType}</span>
                <span className="breed-count">
                  {formatKg(type.kg)}
                  <small>{type.cost === null ? 'No price yet' : formatRupees(type.cost)}</small>
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${(type.kg / mostKg) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>

        {fed.unpricedKg > 0 && (
          <p className="notice">
            {formatKg(fed.unpricedKg)} of the feed has no purchase price yet, so it is not in the
            cost. Add the purchase in the Feed tab.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="eyebrow">Feedings ({formatNumber(feeds.length)})</h2>
        <ul className="recent-list">
          {newestFirst.map((feed) => (
            <li key={feed._id}>
              <div>
                <strong>
                  {formatKg(feed.quantityKg)} · {feed.feedType}
                </strong>
                <small>
                  {feed.coopName} · {formatDate(feed.date)}
                  {feed.feedCompany && ` · ${feed.feedCompany}`}
                  {feed.createdBy?.name && ` · By ${feed.createdBy.name}`}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
