import { useEffect, useState } from 'react';
import { getSales } from '../api.js';
import { formatKg, formatNumber, formatRupees, saleSetBill } from '../flock.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const GENDER_LABELS = { male: 'Male', female: 'Female' };

// The birds sold out of one batch or one coop, newest sale first. `batchIds` are
// the batches to load the sales of and `includes(set)` picks the weighed sets
// that count: a sale can also hold birds from other batches and coops.
// `showCoop` names each set's coop, for a page that covers several.
export default function SoldList({ batchIds, includes, showCoop = false, scope }) {
  // null until loaded
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  const key = batchIds.join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.all(key.split(',').filter(Boolean).map((id) => getSales(id)))
      .then((lists) => {
        if (cancelled) return;
        // A sale out of two of these batches comes back once per batch
        const unique = new Map(lists.flat().map((sale) => [sale._id, sale]));
        setSales(
          [...unique.values()].sort(
            (a, b) =>
              new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt),
          ),
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!sales) return <p className="status">Loading…</p>;

  // Each sale with just the sets that are from here
  const sold = sales
    .map((sale) => {
      const sets = sale.sets.filter(includes);
      return {
        sale,
        sets,
        birds: sets.reduce((sum, set) => sum + set.birds, 0),
        weightKg: sets.reduce((sum, set) => sum + set.weightKg, 0),
        amount: sets.reduce((sum, set) => sum + saleSetBill(sale, set), 0),
      };
    })
    .filter((entry) => entry.sets.length > 0);

  if (sold.length === 0) return <p className="status">No birds sold from this {scope} yet.</p>;

  const total = (field) => sold.reduce((sum, entry) => sum + entry[field], 0);

  return (
    <section className="card">
      <h2 className="eyebrow">Sold ({formatNumber(sold.length)})</h2>

      <dl className="batch-stats">
        <div>
          <dt>Birds Sold</dt>
          <dd>{formatNumber(total('birds'))}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{formatKg(total('weightKg'))}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatRupees(total('amount'))}</dd>
        </div>
      </dl>

      <ul className="recent-list">
        {sold.map(({ sale, sets, birds, weightKg, amount }) => (
          <li key={sale._id}>
            <div>
              <strong>
                {formatNumber(birds)} birds · {formatKg(weightKg)}
              </strong>
              <small>
                {sale.customer.name} · {sale.customer.phone} · {formatDate(sale.date)}
              </small>
              <small className="sold-sets">
                {sets
                  .map(
                    (set) =>
                      `${set.gender ? `${GENDER_LABELS[set.gender]} ` : ''}${formatNumber(
                        set.birds,
                      )} birds · ${formatKg(set.weightKg)}${
                        showCoop ? ` from ${set.coopName}` : ''
                      }`,
                  )
                  .join(' · ')}
                {sale.createdBy?.name && ` · By ${sale.createdBy.name}`}
              </small>
            </div>
            <span>{formatRupees(amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
