import { useCallback, useEffect, useState } from 'react';
import { getAllSales } from '../api.js';
import { formatKg, formatNumber, formatRupees, PAYMENT_STATUS_LABELS } from '../flock.js';
import SaleDetail from './SaleDetail.jsx';
import SaleForm from './SaleForm.jsx';

// Which sales are listed, by how far they are paid
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partly Paid' },
  { id: 'paid', label: 'Paid' },
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

// Sales split into days, newest day first: [[day, sales]]
function byDay(list) {
  const days = new Map();
  for (const sale of list) {
    const day = dayOf(sale.date);
    days.set(day, [...(days.get(day) ?? []), sale]);
  }
  return [...days].sort(([a], [b]) => b.localeCompare(a));
}

const statusOf = (sale) => sale.payment?.status ?? 'unpaid';
const paidOf = (sale) => sale.payment?.amountPaid ?? 0;
const sum = (list, value) => list.reduce((total, sale) => total + value(sale), 0);

// Every sale on every farm the user can see, newest first, with what they came
// to and what is still to be paid. A sale opens its bill; New Sale opens the
// sale form, and `onUpdated` takes each batch the birds were sold out of.
export default function Sales({ batches, onOpenBatch, onUpdated, onNavigate }) {
  // null until loaded
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setError('');
    return getAllSales()
      .then(setSales)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (adding) {
    return (
      <SaleForm
        batches={batches}
        onSaved={(sold) => {
          sold.forEach(onUpdated);
          setAdding(false);
          load();
        }}
        onCancel={() => setAdding(false)}
        onNavigate={onNavigate}
      />
    );
  }

  if (selected) {
    return <SaleDetail sale={selected} onBack={() => setSelected(null)} onOpenBatch={onOpenBatch} />;
  }

  const all = sales ?? [];
  const query = search.trim().toLowerCase();
  const shown = all
    .filter((sale) => filter === 'all' || statusOf(sale) === filter)
    .filter(
      (sale) =>
        !query ||
        [sale.customer.name, sale.customer.business, sale.customer.phone].some((text) =>
          (text ?? '').toLowerCase().includes(query),
        ),
    )
    .sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt),
    );
  const amount = sum(shown, (sale) => sale.amount);
  const received = sum(shown, paidOf);

  return (
    <div className="manage wide">
      <div className="list-head">
        <h2>
          Sales {sales && <span>{all.length}</span>}
        </h2>
        <button type="button" className="primary small" onClick={() => setAdding(true)}>
          ＋ New Sale
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}{' '}
          <button type="button" className="link inline" onClick={load}>
            Try again
          </button>
        </p>
      )}
      {!error && !sales && <p className="status">Loading…</p>}

      {sales && (
        <>
          <section className="hero">
            <p className="hero-label">
              {filter === 'all' && !query ? 'Total Sales' : 'Sales Shown'}
            </p>
            <p className="hero-value">{formatRupees(amount)}</p>
            <dl className="hero-stats">
              <div>
                <dt>Birds</dt>
                <dd>{formatNumber(sum(shown, (sale) => sale.birds))}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{formatRupees(received)}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{formatRupees(Math.max(0, amount - received))}</dd>
              </div>
            </dl>
          </section>

          <input
            type="search"
            className="users-search"
            placeholder="Search by customer, business or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search sales"
          />

          <div className="subtabs" role="tablist" aria-label="Show by payment">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={filter === f.id ? 'active' : ''}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="status">{all.length === 0 ? 'No birds sold yet.' : 'No sales match.'}</p>
          ) : (
            <ul className="record-list">
              {byDay(shown).map(([day, list]) => (
                <li key={day}>
                  <h3 className="record-day">
                    {dayLabel(day)} · {formatRupees(sum(list, (sale) => sale.amount))}
                  </h3>
                  <ul className="record-list">
                    {list.map((sale) => {
                      const due = Math.max(0, sale.amount - paidOf(sale));
                      return (
                        <li key={sale._id}>
                          <button
                            type="button"
                            className="card record"
                            onClick={() => setSelected(sale)}
                          >
                            <span className="record-icon" aria-hidden="true">
                              ₹
                            </span>
                            <span className="record-body">
                              <span className="record-top">
                                <strong>{sale.customer.name}</strong>
                                <small>{formatRupees(sale.amount)}</small>
                              </span>
                              <span className="record-place">
                                {[
                                  `${formatNumber(sale.birds)} birds`,
                                  sale.weightKg > 0 && formatKg(sale.weightKg),
                                  [...new Set(sale.sets.map((set) => set.coopName))].join(', '),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              <span className="record-meta">
                                {[
                                  PAYMENT_STATUS_LABELS[statusOf(sale)],
                                  statusOf(sale) !== 'paid' && `${formatRupees(due)} due`,
                                  sale.customer.business,
                                  sale.createdBy?.name && `By ${sale.createdBy.name}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                            <span className="alert-go" aria-hidden="true">
                              ›
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
