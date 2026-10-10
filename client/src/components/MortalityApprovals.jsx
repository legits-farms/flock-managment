import { useEffect, useState } from 'react';
import { useIsAdmin } from '../admin.js';
import { decideMortality, getPendingMortalities } from '../api.js';
import { formatNumber, mortalityLabel, photoCount } from '../flock.js';
import PhotoLink from './PhotoLink.jsx';
import RecordDetail from './RecordDetail.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Mortality registered by security that waits for the admin. The birds are only
// taken off the coop once it is approved; rejected, they never are. Shows nothing
// to anyone else, or when nothing is waiting. Pressing an entry opens everything
// saved with it, in place of the dashboard (`onViewing` says when).
export default function MortalityApprovals({ onUpdated, onViewing }) {
  const isAdmin = useIsAdmin();
  const [records, setRecords] = useState([]);
  // Id of the record being approved or rejected, so it cannot be pressed twice
  const [deciding, setDeciding] = useState('');
  const [error, setError] = useState('');
  // Id of the record opened in full, or ''
  const [viewingId, setViewingId] = useState('');

  function view(id) {
    setViewingId(id);
    setError('');
    onViewing(Boolean(id));
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    getPendingMortalities()
      .then((pending) => {
        if (!cancelled) setRecords(pending);
      })
      // The dashboard still works without this list
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function decide(record, decision) {
    setDeciding(record._id);
    setError('');
    try {
      const { batch } = await decideMortality(record._id, decision);
      setRecords((prev) => prev.filter((other) => other._id !== record._id));
      onUpdated(batch);
      if (viewingId) view('');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeciding('');
    }
  }

  if (!isAdmin || records.length === 0) return null;

  const decisions = (record) => (
    <div className="option-add-actions">
      <button
        type="button"
        className="secondary reject"
        disabled={deciding === record._id}
        onClick={() => decide(record, 'reject')}
      >
        Reject
      </button>
      <button
        type="button"
        className="primary"
        disabled={deciding === record._id}
        onClick={() => decide(record, 'approve')}
      >
        Approve
      </button>
    </div>
  );

  const viewing = records.find((record) => record._id === viewingId);
  if (viewing) {
    return (
      <div className="manage approval-detail">
        <RecordDetail kind="mortalities" record={viewing} onBack={() => view('')} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {decisions(viewing)}
      </div>
    );
  }

  return (
    <section className="card approvals">
      <h2 className="eyebrow">
        Mortality to Approve <span className="approvals-count">{records.length}</span>
      </h2>
      <p className="help">
        Registered by security. The birds are taken off the coop only when you approve.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul>
        {records.map((record) => (
          <li key={record._id}>
            <div className="approval-head">
              <button type="button" onClick={() => view(record._id)}>
                <strong>
                  {formatNumber(record.birds)} birds · {record.coopName}
                </strong>
                <small>
                  {mortalityLabel(record)} · {record.batch?.batchName ?? 'Deleted batch'} ·{' '}
                  {formatDate(record.date ?? record.createdAt)}
                  <br />
                  {record.reason}
                  {record.createdBy?.name && ` · By ${record.createdBy.name}`}
                </small>
                <span className="link">View details ›</span>
              </button>
              <PhotoLink url={`/mortalities/${record._id}/photo`} count={photoCount(record)} />
            </div>
            {decisions(record)}
          </li>
        ))}
      </ul>
    </section>
  );
}
