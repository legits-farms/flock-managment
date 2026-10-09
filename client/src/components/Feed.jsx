import { useEffect, useState } from 'react';
import { getAllFeeds, getFeedPurchases, getOptions } from '../api.js';
import { formatKg, formatNumber, formatRupees } from '../flock.js';
import EntryDetail from './EntryDetail.jsx';
import FeedPurchaseForm from './FeedPurchaseForm.jsx';

const VIEWS = [
  { id: 'procurement', label: 'Procurement Cost' },
  { id: 'consumption', label: 'Feed Consumption' },
];

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// YYYY-MM-DD in local time
const dayOf = (value) => new Date(value).toLocaleDateString('en-CA');

// "Today", "Yesterday" or the date, for the headings between days
function dayLabel(day) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dayOf(new Date())) return 'Today';
  if (day === dayOf(yesterday)) return 'Yesterday';
  return formatDate(`${day}T00:00`);
}

// Entries split into days, newest day first: [[day, entries]]
function byDay(list) {
  const days = new Map();
  for (const entry of list) {
    const day = dayOf(entry.date);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return [...days].sort(([a], [b]) => b.localeCompare(a));
}

const kgIn = (list) => list.reduce((sum, entry) => sum + entry.quantityKg, 0);

// The feed store, one line per feed type: what was bought, what the birds were
// given and what is left. [{ feedType, boughtKg, usedKg, stockKg, cost }]
function inventory(purchases, feeds) {
  const types = new Map();
  const of = (feedType) => {
    const key = feedType.trim().toLowerCase();
    if (!types.has(key)) types.set(key, { feedType, boughtKg: 0, usedKg: 0, cost: 0 });
    return types.get(key);
  };
  for (const purchase of purchases) {
    const type = of(purchase.feedType);
    type.boughtKg += purchase.quantityKg;
    type.cost += purchase.amount;
  }
  for (const feed of feeds) of(feed.feedType).usedKg += feed.quantityKg;
  return [...types.values()].map((type) => ({ ...type, stockKg: type.boughtKg - type.usedKg }));
}

// The feed store: what was bought and what it cost, and what the birds were given
export default function Feed({ onOpenBatch }) {
  const [view, setView] = useState(VIEWS[0].id);
  // { purchases, feeds, feedTypes }, null until loaded
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  // Feed entry whose details are open, or null
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFeedPurchases(), getAllFeeds(), getOptions()])
      .then(([purchases, feeds, options]) => {
        if (!cancelled) setData({ purchases, feeds, feedTypes: options.feedTypes ?? [] });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (adding) {
    return (
      <FeedPurchaseForm
        addedFeedTypes={data.feedTypes}
        onFeedTypes={(feedTypes) => setData((prev) => ({ ...prev, feedTypes }))}
        onSaved={(purchases) => {
          setData((prev) => ({ ...prev, purchases: [...purchases, ...prev.purchases] }));
          setAdding(false);
        }}
        onCancel={() => setAdding(false)}
      />
    );
  }

  if (selected) {
    return (
      <EntryDetail
        kind="feed"
        record={selected}
        backLabel="Feed Consumption"
        onBack={() => setSelected(null)}
        onOpenBatch={onOpenBatch}
      />
    );
  }

  const stock = data ? inventory(data.purchases, data.feeds) : [];
  const cost = data ? data.purchases.reduce((sum, purchase) => sum + purchase.amount, 0) : 0;

  return (
    <div className="manage">
      <div className="list-head">
        <h2>Feed</h2>
        {data && view === 'procurement' && (
          <button type="button" className="primary small" onClick={() => setAdding(true)}>
            ＋ Add Purchase
          </button>
        )}
      </div>

      <div className="segments" role="tablist">
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

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!error && !data && <p className="status">Loading…</p>}

      {data && view === 'procurement' && (
        <>
          <section className="hero">
            <p className="hero-label">Procurement Cost</p>
            <p className="hero-value">{formatRupees(cost)}</p>
            <dl className="hero-stats">
              <div>
                <dt>Purchased</dt>
                <dd>{formatKg(kgIn(data.purchases))}</dd>
              </div>
              <div>
                <dt>Consumed</dt>
                <dd>{formatKg(kgIn(data.feeds))}</dd>
              </div>
              <div>
                <dt>In Stock</dt>
                <dd>{formatKg(kgIn(data.purchases) - kgIn(data.feeds))}</dd>
              </div>
            </dl>
          </section>

          {stock.length > 0 && (
            <section className="card">
              <h2 className="eyebrow">Feed Inventory</h2>
              <ul className="recent-list">
                {stock.map((type) => (
                  <li key={type.feedType}>
                    <div>
                      <strong>{type.feedType}</strong>
                      <small>
                        {formatKg(type.boughtKg)} bought · {formatKg(type.usedKg)} consumed
                        {type.boughtKg > 0 &&
                          ` · avg ${formatRupees(type.cost / type.boughtKg)}/kg`}
                      </small>
                      {/* More given to the birds than was ever bought: a purchase is missing */}
                      {type.stockKg < 0 && (
                        <small className="short">
                          {formatKg(-type.stockKg)} consumed without a purchase. Add the purchase.
                        </small>
                      )}
                    </div>
                    <span className={type.stockKg < 0 ? 'short' : ''}>
                      {formatKg(Math.max(type.stockKg, 0))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.purchases.length === 0 ? (
            <p className="status">No feed purchased yet.</p>
          ) : (
            <ul className="record-list">
              {byDay(data.purchases).map(([day, purchases]) => (
                <li key={day}>
                  <h3 className="record-day">{dayLabel(day)}</h3>
                  <ul className="record-list">
                    {purchases.map((p) => (
                      <li key={p._id}>
                        <div className="card record">
                          <span className="record-icon feeds" aria-hidden="true">
                            ₹
                          </span>
                          <span className="record-body">
                            <span className="record-top">
                              <strong>
                                {formatKg(p.quantityKg)} · {p.feedType}
                              </strong>
                              <small>{formatRupees(p.amount)}</small>
                            </span>
                            <span className="record-place">
                              {p.feedCompany || 'No company entered'}
                            </span>
                            <span className="record-meta">
                              {[
                                `${formatRupees(p.ratePerKg)}/kg`,
                                p.extraCharges > 0 &&
                                  `+ ${formatRupees(p.extraCharges)} ${p.extraChargeLabel}`,
                                p.remarks,
                                p.createdBy?.name && `By ${p.createdBy.name}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {data && view === 'consumption' && data.feeds.length === 0 && (
        <p className="status">No feed entered yet.</p>
      )}

      {data && view === 'consumption' && data.feeds.length > 0 && (
        <>
          <dl className="batch-stats record-stats">
            <div>
              <dt>Feedings</dt>
              <dd>{formatNumber(data.feeds.length)}</dd>
            </div>
            <div>
              <dt>Feed Given</dt>
              <dd>{formatKg(kgIn(data.feeds))}</dd>
            </div>
          </dl>

          <ul className="record-list">
            {byDay(data.feeds).map(([day, feeds]) => (
              <li key={day}>
                <h3 className="record-day">
                  {dayLabel(day)} · {formatKg(kgIn(feeds))}
                </h3>
                <ul className="record-list">
                  {feeds.map((r) => (
                    <li key={r._id}>
                      <button type="button" className="card record" onClick={() => setSelected(r)}>
                        <span className="record-icon feeds" aria-hidden="true">
                          ≡
                        </span>
                        <span className="record-body">
                          <span className="record-top">
                            <strong>
                              {formatKg(r.quantityKg)} · {r.feedType}
                            </strong>
                          </span>
                          <span className="record-place">
                            {r.batch?.batchName ?? 'Deleted batch'} · {r.coopName}
                          </span>
                          <span className="record-meta">
                            {[r.feedCompany, r.createdBy?.name && `By ${r.createdBy.name}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="alert-go" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
