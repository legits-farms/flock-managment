import { useEffect, useState } from 'react';
import { getAllMortalities, getAllVaccinations } from '../api.js';
import { formatNumber } from '../flock.js';
import RecordDetail from './RecordDetail.jsx';

const VIEWS = [
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'mortality', label: 'Mortality' },
];

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

const place = (r) => `${r.batch?.batchName ?? 'Deleted batch'} · ${r.coopName}`;

const by = (r) => (r.createdBy?.name ? ` · By ${r.createdBy.name}` : '');

// Full vaccination and mortality history across every batch, newest first.
// Tapping a record opens its details.
export default function Records({ onOpenBatch }) {
  const [view, setView] = useState('vaccinations');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllVaccinations(), getAllMortalities()])
      .then(([vaccinations, mortalities]) => {
        if (!cancelled) setRecords({ vaccinations, mortalities });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kind = view === 'vaccinations' ? 'vaccinations' : 'mortalities';
  const list = records?.[kind];

  if (selected) {
    return (
      <RecordDetail
        kind={kind}
        record={selected}
        onBack={() => setSelected(null)}
        onOpenBatch={onOpenBatch}
      />
    );
  }

  return (
    <div className="manage">
      <div className="subtabs" role="tablist">
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
            {records &&
              ` (${records[v.id === 'vaccinations' ? 'vaccinations' : 'mortalities'].length})`}
          </button>
        ))}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!error && !records && <p className="status">Loading…</p>}

      {list && list.length === 0 && (
        <p className="status">
          {view === 'vaccinations' ? 'No vaccinations added yet.' : 'No mortality registered yet.'}
        </p>
      )}

      {list && list.length > 0 && (
        <section className="card">
          <ul className="recent-list flush">
            {list.map((r) => (
              <li
                key={r._id}
                className="clickable"
                role="button"
                tabIndex={0}
                onClick={() => setSelected(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(r);
                  }
                }}
              >
                {view === 'vaccinations' ? (
                  <div>
                    <strong>{r.vaccine}</strong>
                    <small>
                      {place(r)}
                      <br />
                      {formatDate(r.date)} · {formatNumber(r.birds)} birds{by(r)}
                      {r.remarks && (
                        <>
                          <br />
                          {r.remarks}
                        </>
                      )}
                    </small>
                  </div>
                ) : (
                  <div>
                    <strong>{formatNumber(r.birds)} birds</strong>
                    <small>
                      {place(r)}
                      <br />
                      {formatDateTime(r.createdAt)}
                      {by(r)}
                      <br />
                      {r.reason}
                    </small>
                  </div>
                )}
                <span className="alert-go" aria-hidden="true">
                  ›
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
