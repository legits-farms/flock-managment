import { useCallback, useEffect, useState } from 'react';
import { getAllMortalities } from '../api.js';
import { formatNumber, photoCount } from '../flock.js';
import LoadStatus from './LoadStatus.jsx';
import PhotoLink from './PhotoLink.jsx';
import RecordDetail from './RecordDetail.jsx';
import RecordForm from './RecordForm.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// YYYY-MM-DD in local time
const dayOf = (value) => new Date(value).toLocaleDateString('en-CA');

// Mortality entered before it had a date of its own is dated by when it was registered
const whenOf = (record) => record.date ?? record.createdAt;

// What became of a record: [label, extra class of its chip]
const STATUS = {
  pending: ['Waiting', ''],
  approved: ['Approved', 'done'],
  rejected: ['Rejected', 'due'],
};

// The entries the list can be narrowed to: [status or '' for all, label]
const FILTERS = [
  ['', 'All'],
  ['pending', 'Waiting'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
];

// The whole app of a security guard: registering mortality, and the mortality
// registered so far. They see nothing else of the flock. What they register
// waits for an admin: the birds are only taken off the coop once it is approved.
export default function SecurityHome({ batches, loading, error, onRetry, onUpdated }) {
  // The mortality form is open
  const [adding, setAdding] = useState(false);
  // The record being looked at, or null
  const [viewing, setViewing] = useState(null);
  const [records, setRecords] = useState([]);
  const [listError, setListError] = useState('');
  // Said once a record is sent off, so it is clear it went somewhere
  const [sent, setSent] = useState(false);
  // Status the list is narrowed to, or '' for every entry
  const [filter, setFilter] = useState('');

  const loadRecords = useCallback(async () => {
    setListError('');
    try {
      setRecords(await getAllMortalities());
    } catch (err) {
      setListError(err.message);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  if (adding) {
    return (
      <RecordForm
        type="mortality"
        batches={batches}
        backLabel="Mortality"
        onSaved={(batch) => {
          onUpdated(batch);
          setAdding(false);
          setSent(true);
          loadRecords();
        }}
        onCancel={() => setAdding(false)}
        onNavigate={() => setAdding(false)}
      />
    );
  }

  if (viewing) {
    return <RecordDetail kind="mortalities" record={viewing} onBack={() => setViewing(null)} />;
  }

  const hasCoops = batches.some((batch) => batch.coops.length > 0);
  const today = dayOf(new Date());
  const lostToday = records
    .filter((record) => record.status === 'approved' && dayOf(whenOf(record)) === today)
    .reduce((sum, record) => sum + record.birds, 0);
  const countOf = (status) => records.filter((record) => record.status === status).length;
  const listed = filter ? records.filter((record) => record.status === filter) : records;

  return (
    <div className="dashboard security">
      <LoadStatus loading={loading} error={error} onRetry={onRetry} />

      {!loading && !error && (
        <section className="hero security-hero">
          <p className="hero-label">Mortality</p>
          <h2>Found dead birds?</h2>
          <p>Register them here with a photo. The admin checks every entry.</p>
          {hasCoops ? (
            <button type="button" onClick={() => setAdding(true)}>
              <span aria-hidden="true">+</span> Register Mortality
            </button>
          ) : (
            <p className="security-none">There are no birds in the coops yet.</p>
          )}
          {sent && <p className="security-sent">✓ Sent to the admin. It is counted once approved.</p>}
        </section>
      )}

      <dl className="security-stats">
        <div className="waiting">
          <dt>Waiting</dt>
          <dd>{formatNumber(countOf('pending'))}</dd>
        </div>
        <div className="approved">
          <dt>Approved Today</dt>
          <dd>
            {formatNumber(lostToday)} <small>birds</small>
          </dd>
        </div>
        <div className="rejected">
          <dt>Rejected</dt>
          <dd>{formatNumber(countOf('rejected'))}</dd>
        </div>
      </dl>

      <section className="security-records">
        <h2 className="eyebrow">Mortality Registered</h2>

        <div className="security-filter" role="group" aria-label="Show which entries">
          {FILTERS.map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? 'active' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {listError && (
          <div className="status">
            <p className="error" role="alert">
              {listError}
            </p>
            <button type="button" className="secondary" onClick={loadRecords}>
              Try again
            </button>
          </div>
        )}
        {!listError && listed.length === 0 && (
          <p className="empty">
            {records.length === 0 ? 'No mortality registered yet.' : 'Nothing here.'}
          </p>
        )}

        <ul>
          {listed.map((record) => (
            <li key={record._id} className={record.status}>
              {/* The entry itself is pressed to open everything saved with it */}
              <button type="button" className="security-entry" onClick={() => setViewing(record)}>
                <span className="security-birds">
                  {formatNumber(record.birds)}
                  <small>birds</small>
                </span>
                <span className="security-text">
                  <strong>{record.coopName}</strong>
                  <small>
                    {record.batch?.batchName ?? 'Deleted batch'} · {formatDate(whenOf(record))}
                  </small>
                  <small>
                    {record.reason}
                    {record.createdBy?.name && ` · By ${record.createdBy.name}`}
                  </small>
                </span>
              </button>
              <div className="security-side">
                <span className={`status-chip ${STATUS[record.status]?.[1] ?? ''}`}>
                  {STATUS[record.status]?.[0] ?? record.status}
                </span>
                <PhotoLink url={`/mortalities/${record._id}/photo`} count={photoCount(record)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
