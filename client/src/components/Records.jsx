import { useEffect, useState } from 'react';
import { getAllMortalities, getAllShifts, getAllVaccinations } from '../api.js';
import { formatNumber } from '../flock.js';
import Dropdown from './Dropdown.jsx';
import RecordDetail from './RecordDetail.jsx';
import ShiftDetail from './ShiftDetail.jsx';

// View ids match the API path and the RecordDetail `kind`
const VIEWS = [
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'mortalities', label: 'Mortality' },
  { id: 'shifts', label: 'Shifts' },
];

const NO_FILTERS = { batchId: '', coopName: '', person: '', from: '', to: '' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// YYYY-MM-DD in local time, comparable with <input type="date"> values
const dayOf = (value) => new Date(value).toLocaleDateString('en-CA');

// Vaccinations and shifts are dated by the day given; mortality by when it was registered
const recordDate = (kind, r) => (kind === 'mortalities' ? r.createdAt : r.date);

// A shift involves two coops, the other records one
const coopsOf = (r) => [r.coopName, r.fromCoopName, r.toCoopName].filter(Boolean);

const EMPTY = {
  vaccinations: 'No vaccinations added yet.',
  mortalities: 'No mortality registered yet.',
  shifts: 'No birds shifted yet.',
};

const SUMMARY = { vaccinations: 'vaccinated', mortalities: 'lost', shifts: 'shifted' };

const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function matches(kind, r, filters) {
  const day = dayOf(recordDate(kind, r));
  return (
    (!filters.batchId || r.batch?._id === filters.batchId) &&
    (!filters.coopName || coopsOf(r).includes(filters.coopName)) &&
    (!filters.person || r.createdBy?.name === filters.person) &&
    (!filters.from || day >= filters.from) &&
    (!filters.to || day <= filters.to)
  );
}

// Full vaccination, mortality and shift history across every batch, newest first.
// Tapping a record opens its details.
export default function Records({ onOpenBatch }) {
  const [view, setView] = useState('vaccinations');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllVaccinations(), getAllMortalities(), getAllShifts()])
      .then(([vaccinations, mortalities, shifts]) => {
        if (!cancelled) setRecords({ vaccinations, mortalities, shifts });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (selected && view === 'shifts') {
    return (
      <ShiftDetail shift={selected} onBack={() => setSelected(null)} onOpenBatch={onOpenBatch} />
    );
  }

  if (selected) {
    return (
      <RecordDetail
        kind={view}
        record={selected}
        onBack={() => setSelected(null)}
        onOpenBatch={onOpenBatch}
      />
    );
  }

  const setFilter = (field) => (value) => setFilters((prev) => ({ ...prev, [field]: value }));
  const activeFilters = Object.values(filters).filter(Boolean).length;

  // Filter choices come from the records themselves
  const everything = records
    ? [...records.vaccinations, ...records.mortalities, ...records.shifts]
    : [];
  const batchNames = new Map(
    everything.filter((r) => r.batch).map((r) => [r.batch._id, r.batch.batchName]),
  );
  const batchOptions = [
    { value: '', label: 'All batches' },
    ...[...batchNames].map(([value, label]) => ({ value, label })),
  ];
  const inBatch = everything.filter((r) => !filters.batchId || r.batch?._id === filters.batchId);
  const coopOptions = [
    { value: '', label: 'All coops' },
    ...unique(inBatch.flatMap(coopsOf)).map((name) => ({ value: name, label: name })),
  ];
  const personOptions = [
    { value: '', label: 'Everyone' },
    ...unique(everything.map((r) => r.createdBy?.name)).map((name) => ({
      value: name,
      label: name,
    })),
  ];

  const filtered = (kind) => records[kind].filter((r) => matches(kind, r, filters));
  const list = records && filtered(view);
  const totalBirds = list?.reduce((sum, r) => sum + r.birds, 0) ?? 0;

  return (
    <div className="manage">
      <div className="list-head">
        <h2>Records</h2>
        <button
          type="button"
          className={`filter-toggle ${showFilters || activeFilters ? 'active' : ''}`}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((prev) => !prev)}
        >
          Filters{activeFilters > 0 && ` (${activeFilters})`}
        </button>
      </div>

      {showFilters && (
        <div className="sheet-backdrop" onClick={() => setShowFilters(false)}>
          <section
            className="sheet form"
            role="dialog"
            aria-modal="true"
            aria-label="Filter records"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <h2>Filters</h2>
              {activeFilters > 0 && (
                <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>
                  Clear all
                </button>
              )}
            </div>

            <div className="field">
              <label htmlFor="filter-batch">Batch</label>
              <Dropdown
                id="filter-batch"
                value={filters.batchId}
                options={batchOptions}
                onChange={(batchId) => setFilters((prev) => ({ ...prev, batchId, coopName: '' }))}
              />
            </div>

            <div className="field">
              <label htmlFor="filter-coop">Coop</label>
              <Dropdown
                id="filter-coop"
                value={filters.coopName}
                options={coopOptions}
                onChange={setFilter('coopName')}
              />
            </div>

            <div className="field">
              <label htmlFor="filter-person">Entered By</label>
              <Dropdown
                id="filter-person"
                value={filters.person}
                options={personOptions}
                onChange={setFilter('person')}
              />
            </div>

            <div className="field-row">
              <label className="field">
                <span>From</span>
                <input
                  type="date"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(e) => setFilter('from')(e.target.value)}
                />
              </label>
              <label className="field">
                <span>To</span>
                <input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(e) => setFilter('to')(e.target.value)}
                />
              </label>
            </div>

            <button type="button" className="primary" onClick={() => setShowFilters(false)}>
              {records ? `Show ${formatNumber(filtered(view).length)} records` : 'Done'}
            </button>
          </section>
        </div>
      )}

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
            {records && ` (${filtered(v.id).length})`}
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
        <div className="status">
          <p>{activeFilters > 0 ? 'No records match these filters.' : EMPTY[view]}</p>
          {activeFilters > 0 && (
            <button type="button" className="secondary" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {list && list.length > 0 && (
        <>
          <p className="record-summary">
            <b>{formatNumber(list.length)}</b> {list.length === 1 ? 'record' : 'records'} ·{' '}
            <b>{formatNumber(totalBirds)}</b> birds {SUMMARY[view]}
          </p>

          <ul className="record-list">
            {view === 'shifts' &&
              list.map((s) => (
                <li key={s._id}>
                  <button type="button" className="card record" onClick={() => setSelected(s)}>
                    <span className="record-icon" aria-hidden="true">
                      ⇄
                    </span>

                    <span className="record-body">
                      <span className="record-top">
                        <strong>{formatNumber(s.birds)} birds</strong>
                        <small>{formatDate(s.date)}</small>
                      </span>
                      <span className="record-place">
                        {s.fromFarm && `${s.fromFarm} · `}
                        {s.fromCoopName} → {s.toFarm && `${s.toFarm} · `}
                        {s.toCoopName}
                      </span>
                      <span className="record-meta">
                        {s.batch?.batchName ?? 'Deleted batch'} · {s.reason}
                        {s.createdBy?.name && ` · By ${s.createdBy.name}`}
                      </span>
                    </span>

                    <span className="alert-go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}

            {view !== 'shifts' &&
              list.map((r) => (
                <li key={r._id}>
                  <button type="button" className="card record" onClick={() => setSelected(r)}>
                    <span className={`record-icon ${view}`} aria-hidden="true">
                      {view === 'vaccinations' ? '+' : '−'}
                    </span>

                    <span className="record-body">
                      <span className="record-top">
                        <strong>
                          {view === 'vaccinations' ? r.vaccine : `${formatNumber(r.birds)} birds`}
                        </strong>
                        <small>{formatDate(recordDate(view, r))}</small>
                      </span>
                      <span className="record-place">
                        {r.batch?.batchName ?? 'Deleted batch'} · {r.coopName}
                      </span>
                      <span className="record-meta">
                        {view === 'vaccinations' ? `${formatNumber(r.birds)} birds` : r.reason}
                        {r.createdBy?.name && ` · By ${r.createdBy.name}`}
                      </span>
                    </span>

                    <span className="alert-go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
