import { useEffect, useState } from 'react';
import {
  getAllFeeds,
  getAllMortalities,
  getAllSales,
  getAllShifts,
  getAllVaccinations,
  getAllWeights,
} from '../api.js';
import {
  MORTALITY_LABELS,
  PAYMENT_STATUS_LABELS,
  RECORD_MORTALITY_TYPES,
  coopGroups,
  coopLive,
  formatKg,
  formatNumber,
  formatRupees,
  formatWeight,
  mortalityLabel,
  mortalityType,
  vaccinatedBirds,
} from '../flock.js';
import Dropdown from './Dropdown.jsx';
import EntryDetail from './EntryDetail.jsx';
import RecordDetail from './RecordDetail.jsx';
import RecordForm from './RecordForm.jsx';
import SaleDetail from './SaleDetail.jsx';
import ShiftDetail from './ShiftDetail.jsx';

// View ids match the API path and the RecordDetail `kind`
const VIEWS = [
  { id: 'mortalities', label: 'Mortality' },
  { id: 'feeds', label: 'Feeding' },
  { id: 'weights', label: 'Weight' },
  { id: 'vaccinations', label: 'Vaccinations' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'sales', label: 'Sales' },
];

// The EntryDetail `kind` of the views it shows
const ENTRY_KINDS = { feeds: 'feed', weights: 'weight' };

const ICONS = { vaccinations: '+', mortalities: '−', shifts: '⇄', sales: '₹', feeds: '≡', weights: '⚖' };

const NO_FILTERS = { batchId: '', coopName: '', mortalityType: '', person: '', from: '', to: '' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// YYYY-MM-DD in local time, comparable with <input type="date"> values
const dayOf = (value) => new Date(value).toLocaleDateString('en-CA');

// Mortality entered before it had a date of its own is dated by when it was registered
const recordDate = (kind, r) => (kind === 'mortalities' ? (r.date ?? r.createdAt) : r.date);

// A shift involves two coops and a sale one per set, the other records one
const coopsOf = (r) =>
  [r.coopName, r.fromCoopName, r.toCoopName, ...(r.sets ?? []).map((set) => set.coopName)].filter(
    Boolean,
  );

// A sale can take birds from several batches, the other records are about one
const batchesOf = (r) => [r.batch, ...(r.sets ?? []).map((set) => set.batch)].filter(Boolean);

const EMPTY = {
  vaccinations: 'No vaccinations added yet.',
  mortalities: 'No mortality registered yet.',
  shifts: 'No birds shifted yet.',
  sales: 'No birds sold yet.',
  feeds: 'No feed entered yet.',
  weights: 'No weight entered yet.',
};

// The figure next to the record count: [label, value] for the listed records.
// Records come newest first, so the first weight is the latest one.
const SUMMARY = {
  vaccinations: (list) => ['Birds Vaccinated', formatNumber(birdsIn(list))],
  mortalities: (list) => ['Birds Lost', formatNumber(birdsIn(list))],
  shifts: (list) => ['Birds Shifted', formatNumber(birdsIn(list))],
  sales: (list) => ['Sale Amount', formatRupees(list.reduce((sum, r) => sum + r.amount, 0))],
  feeds: (list) => ['Feed Given', formatKg(list.reduce((sum, r) => sum + r.quantityKg, 0))],
  weights: (list) => ['Latest Avg Weight', formatWeight(list[0].avgWeightG)],
};

const birdsIn = (list) => list.reduce((sum, r) => sum + r.birds, 0);

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// "Today", "Yesterday" or the date, for the headings between days
function dayLabel(day) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === dayOf(new Date())) return 'Today';
  if (day === dayOf(yesterday)) return 'Yesterday';
  return formatDate(`${day}T00:00`);
}

// Records of one kind split into days, newest day first: [[day, records]]
function byDay(kind, list) {
  const days = new Map();
  for (const record of list) {
    const day = dayOf(recordDate(kind, record));
    days.set(day, [...(days.get(day) ?? []), record]);
  }
  return [...days].sort(([a], [b]) => b.localeCompare(a));
}

const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

function matches(kind, r, filters) {
  const day = dayOf(recordDate(kind, r));
  return (
    (!filters.batchId || batchesOf(r).some((batch) => batch._id === filters.batchId)) &&
    (!filters.coopName || coopsOf(r).includes(filters.coopName)) &&
    // Only mortality records have a mortality type
    (!filters.mortalityType ||
      kind !== 'mortalities' ||
      mortalityType(r) === filters.mortalityType) &&
    (!filters.person || r.createdBy?.name === filters.person) &&
    (!filters.from || day >= filters.from) &&
    (!filters.to || day <= filters.to)
  );
}

// Coops that still hold birds without a vaccine, most birds first:
// [{ key, name, farm, live, pending, batchNames, vaccinable }], where
// `vaccinable` is those batches, each with just this coop, for the vaccination form
function coopsToVaccinate(batches, vaccinations, filters) {
  return coopGroups(batches)
    .map((group) => {
      const entries = group.entries
        .filter(
          ({ batch, coop }) =>
            (!filters.batchId || batch._id === filters.batchId) &&
            (!filters.coopName || coop.name === filters.coopName),
        )
        .map(({ batch, coop }) => ({
          batch,
          coop,
          live: coopLive(coop),
          pending: coopLive(coop) - vaccinatedBirds({ coops: [coop] }, vaccinations),
        }))
        .filter((entry) => entry.pending > 0);
      return {
        ...group,
        live: entries.reduce((sum, entry) => sum + entry.live, 0),
        pending: entries.reduce((sum, entry) => sum + entry.pending, 0),
        batchNames: entries.map((entry) => entry.batch.batchName),
        vaccinable: entries.map((entry) => ({ ...entry.batch, coops: [entry.coop] })),
      };
    })
    .filter((group) => group.pending > 0)
    .sort((a, b) => b.pending - a.pending);
}

// Full vaccination, mortality, shift, sale, feed and weight history across every batch,
// newest first.
// Tapping a record opens its details. `batches` are the current batches, used to
// work out which coops still need vaccinating; tapping one of those coops opens
// the vaccination form for it.
export default function Records({ batches, onOpenBatch, onUpdated }) {
  // Key of the coop a vaccination is being added for, or null
  const [vaccinating, setVaccinating] = useState(null);
  // Bumped after a vaccination is added, to load the records again
  const [saves, setSaves] = useState(0);
  const [view, setView] = useState(VIEWS[0].id);
  // The vaccinations view has two halves: what was given, and what is still due
  const [vaccinationView, setVaccinationView] = useState('history');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAllVaccinations(),
      getAllMortalities(),
      getAllShifts(),
      getAllSales(),
      getAllFeeds(),
      getAllWeights(),
    ])
      .then(([vaccinations, mortalities, shifts, sales, feeds, weights]) => {
        if (!cancelled) setRecords({ vaccinations, mortalities, shifts, sales, feeds, weights });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [saves]);

  if (selected && view === 'shifts') {
    return (
      <ShiftDetail shift={selected} onBack={() => setSelected(null)} onOpenBatch={onOpenBatch} />
    );
  }

  if (selected && view === 'sales') {
    return <SaleDetail sale={selected} onBack={() => setSelected(null)} onOpenBatch={onOpenBatch} />;
  }

  if (selected && ENTRY_KINDS[view]) {
    return (
      <EntryDetail
        kind={ENTRY_KINDS[view]}
        record={selected}
        backLabel="All records"
        onBack={() => setSelected(null)}
        onOpenBatch={onOpenBatch}
      />
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
    ? VIEWS.flatMap((v) => records[v.id])
    : [];
  const batchNames = new Map(
    everything.flatMap(batchesOf).map((batch) => [batch._id, batch.batchName]),
  );
  const batchOptions = [
    { value: '', label: 'All batches' },
    ...[...batchNames].map(([value, label]) => ({ value, label })),
  ];
  const inBatch = everything.filter(
    (r) => !filters.batchId || batchesOf(r).some((batch) => batch._id === filters.batchId),
  );
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
  // The date and person filters describe records, not coops, so they do not apply here
  const toVaccinate = records ? coopsToVaccinate(batches, records.vaccinations, filters) : [];
  const showPending = view === 'vaccinations' && vaccinationView === 'pending';
  const pendingBirds = toVaccinate.reduce((sum, coop) => sum + coop.pending, 0);
  const pendingLive = toVaccinate.reduce((sum, coop) => sum + coop.live, 0);

  const vaccinatingCoop = toVaccinate.find((coop) => coop.key === vaccinating);
  if (vaccinatingCoop) {
    return (
      <RecordForm
        type="vaccination"
        batches={vaccinatingCoop.vaccinable}
        backLabel="Need to be Vaccinated"
        onSaved={(batch) => {
          onUpdated(batch);
          setSaves((count) => count + 1);
          setVaccinating(null);
        }}
        onCancel={() => setVaccinating(null)}
      />
    );
  }

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
              <label htmlFor="filter-mortality-type">Mortality Type</label>
              <Dropdown
                id="filter-mortality-type"
                value={filters.mortalityType}
                options={[
                  { value: '', label: 'All types' },
                  ...RECORD_MORTALITY_TYPES.map((value) => ({
                    value,
                    label: MORTALITY_LABELS[value],
                  })),
                ]}
                onChange={setFilter('mortalityType')}
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

      {view === 'vaccinations' && (
        <div className="segments" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!showPending}
            className={showPending ? '' : 'active'}
            onClick={() => setVaccinationView('history')}
          >
            History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showPending}
            className={showPending ? 'active' : ''}
            onClick={() => setVaccinationView('pending')}
          >
            Need to be Vaccinated
            {records && toVaccinate.length > 0 && <span>{toVaccinate.length}</span>}
          </button>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!error && !records && <p className="status">Loading…</p>}

      {showPending && records && toVaccinate.length === 0 && (
        <p className="status">
          {filters.batchId || filters.coopName
            ? 'No coops matching these filters need vaccinating.'
            : 'Every coop is vaccinated.'}
        </p>
      )}

      {showPending && toVaccinate.length > 0 && (
        <>
          <section className="hero">
            <p className="hero-label">Birds to Vaccinate</p>
            <p className="hero-value">{formatNumber(pendingBirds)}</p>
            <dl className="hero-stats">
              <div>
                <dt>Coops</dt>
                <dd>{formatNumber(toVaccinate.length)}</dd>
              </div>
              <div>
                <dt>Live Birds</dt>
                <dd>{formatNumber(pendingLive)}</dd>
              </div>
              <div>
                <dt>Vaccinated</dt>
                <dd>{(((pendingLive - pendingBirds) / pendingLive) * 100).toFixed(0)}%</dd>
              </div>
            </dl>
          </section>

          <ul className="batch-list">
            {toVaccinate.map((coop) => {
              const covered = ((coop.live - coop.pending) / coop.live) * 100;
              return (
                <li key={coop.key}>
                  <button
                    type="button"
                    className="card batch"
                    onClick={() => setVaccinating(coop.key)}
                  >
                    <span className="batch-head">
                      <span className="batch-title">
                        <strong>{coop.name}</strong>
                      </span>
                      {coop.farm && <span className="badge">{coop.farm}</span>}
                    </span>

                    <span className="batch-figures">
                      <span className="batch-live">
                        <b>{formatNumber(coop.pending)}</b>
                        to vaccinate
                      </span>
                      <span className="batch-side">
                        <span>
                          <b>{formatNumber(coop.live)}</b> live birds
                        </span>
                        <span>
                          <b>{formatNumber(coop.live - coop.pending)}</b> vaccinated
                        </span>
                      </span>
                    </span>

                    <span className="bar">
                      <span style={{ width: `${covered}%` }} />
                    </span>
                    <span className="batch-livability">{covered.toFixed(0)}% vaccinated</span>

                    <span className="batch-foot">
                      <span className="chips">
                        {coop.batchNames.map((name) => (
                          <span key={name} className="chip">
                            {name}
                          </span>
                        ))}
                      </span>
                      <span className="card-action">＋ Add</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!showPending && list && list.length === 0 && (
        <div className="status">
          <p>{activeFilters > 0 ? 'No records match these filters.' : EMPTY[view]}</p>
          {activeFilters > 0 && (
            <button type="button" className="secondary" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {!showPending && list && list.length > 0 && (
        <>
          <dl className="batch-stats record-stats">
            <div>
              <dt>Records</dt>
              <dd>{formatNumber(list.length)}</dd>
            </div>
            <div>
              <dt>{SUMMARY[view](list)[0]}</dt>
              <dd>{SUMMARY[view](list)[1]}</dd>
            </div>
          </dl>

          <ul className="record-list">
            {byDay(view, list).map(([day, dayRecords]) => (
              <li key={day}>
                <h3 className="record-day">{dayLabel(day)}</h3>
                <ul className="record-list">
                  {dayRecords.map((r) => (
                    <li key={r._id}>
                      <button type="button" className="card record" onClick={() => setSelected(r)}>
                        <span className={`record-icon ${view}`} aria-hidden="true">
                          {ICONS[view]}
                        </span>

                        <span className="record-body">
                          <span className="record-top">
                            <strong>
                              {view === 'vaccinations'
                                ? r.vaccine
                                : view === 'feeds'
                                  ? `${formatKg(r.quantityKg)} · ${r.feedType}`
                                  : view === 'weights'
                                    ? `${formatWeight(r.avgWeightG)} avg`
                                    : `${formatNumber(r.birds)} birds`}
                            </strong>
                            {ENTRY_KINDS[view] && <small>{formatTime(r.createdAt)}</small>}
                            {view === 'vaccinations' && (
                              <small>{formatNumber(r.birds)} birds</small>
                            )}
                            {view === 'mortalities' && <small>{mortalityLabel(r)}</small>}
                            {view === 'sales' && <small>{formatRupees(r.amount)}</small>}
                            {view === 'shifts' && r.mortality > 0 && (
                              <small>{formatNumber(r.mortality)} shift mortality</small>
                            )}
                          </span>
                          <span className="record-place">
                            {view === 'shifts' ? (
                              <>
                                {r.fromFarm && `${r.fromFarm} · `}
                                {r.fromCoopName} → {r.toFarm && `${r.toFarm} · `}
                                {r.toCoopName}
                              </>
                            ) : view === 'sales' ? (
                              `${r.customer.name} · ${[...new Set(coopsOf(r))].join(', ')}`
                            ) : (
                              `${r.batch?.batchName ?? 'Deleted batch'} · ${r.coopName}`
                            )}
                          </span>
                          <span className="record-meta">
                            {[
                              view === 'shifts' && (r.batch?.batchName ?? 'Deleted batch'),
                              r.reason,
                              view === 'sales' &&
                                [...new Set(batchesOf(r).map((batch) => batch.batchName))].join(', '),
                              view === 'sales' && formatKg(r.weightKg),
                              view === 'sales' &&
                                PAYMENT_STATUS_LABELS[r.payment?.status ?? 'unpaid'],
                              view === 'weights' &&
                                `${formatNumber(r.birds)} birds weighed · ${formatKg(r.totalWeightKg)}`,
                              r.createdBy?.name && `By ${r.createdBy.name}`,
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
