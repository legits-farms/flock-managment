import { formatNumber } from '../flock.js';

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

// Everything saved with one shift of birds between coops
export default function ShiftDetail({ shift, onBack, onOpenBatch }) {
  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All records
      </button>

      <section className="card">
        <h2 className="eyebrow">Shift</h2>
        <div className="batch-head manage-head">
          <h3>{formatNumber(shift.birds)} birds</h3>
          <span className="badge">{formatDate(shift.date)}</span>
        </div>

        <div className="shift-route">
          <div>
            <small>From</small>
            <strong>{shift.fromCoopName}</strong>
            <span>{shift.fromFarm || 'No farm'}</span>
          </div>
          <span className="shift-arrow" aria-hidden="true">
            →
          </span>
          <div>
            <small>To</small>
            <strong>{shift.toCoopName}</strong>
            <span>{shift.toFarm || 'No farm'}</span>
          </div>
        </div>

        <dl className="batch-details detail">
          <div>
            <dt>Batch</dt>
            <dd>
              {shift.batch ? (
                <button
                  type="button"
                  className="link inline"
                  onClick={() => onOpenBatch(shift.batch._id)}
                >
                  {shift.batch.batchName}
                </button>
              ) : (
                'Deleted batch'
              )}
            </dd>
          </div>
          <div>
            <dt>Birds</dt>
            <dd>{formatNumber(shift.birds)} shifted</dd>
          </div>
          <div>
            <dt>Shift Date</dt>
            <dd>{formatDate(shift.date)}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{shift.reason}</dd>
          </div>
          <div>
            <dt>Entered By</dt>
            <dd>{shift.createdBy?.name ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Entered On</dt>
            <dd>{formatDateTime(shift.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
