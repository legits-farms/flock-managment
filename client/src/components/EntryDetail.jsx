import { formatKg, formatNumber, formatWeight } from '../flock.js';

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

// Everything saved with one feed or weight entry. `kind` is 'feed' or 'weight'.
export default function EntryDetail({ kind, record, backLabel, onBack, onOpenBatch }) {
  const feed = kind === 'feed';
  // Entries made before the farm was saved with them go by their batch's farm
  const farm = record.farm || record.batch?.shiftToFarm || '';

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ {backLabel}
      </button>

      <section className="card">
        <h2 className="eyebrow">{feed ? 'Feed' : 'Avg Weight'}</h2>
        <div className="batch-head manage-head">
          <h3>{feed ? formatKg(record.quantityKg) : `${formatWeight(record.avgWeightG)} avg`}</h3>
          <span className="badge">
            {farm && `${farm} · `}
            {record.coopName}
          </span>
        </div>

        <dl className="batch-details detail">
          <div>
            <dt>Batch</dt>
            <dd>
              {record.batch ? (
                <button
                  type="button"
                  className="link inline"
                  onClick={() => onOpenBatch(record.batch._id)}
                >
                  {record.batch.batchName}
                </button>
              ) : (
                'Deleted batch'
              )}
            </dd>
          </div>
          <div>
            <dt>Farm</dt>
            <dd>{farm || 'No farm'}</dd>
          </div>
          <div>
            <dt>Coop</dt>
            <dd>{record.coopName}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(record.date)}</dd>
          </div>
          {feed ? (
            <>
              <div>
                <dt>Feed Type</dt>
                <dd>{record.feedType}</dd>
              </div>
              {record.feedCompany && (
                <div>
                  <dt>Feed Company</dt>
                  <dd>{record.feedCompany}</dd>
                </div>
              )}
              <div>
                <dt>Quantity</dt>
                <dd>{formatKg(record.quantityKg)}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Birds Weighed</dt>
                <dd>{formatNumber(record.birds)}</dd>
              </div>
              <div>
                <dt>Total Weight</dt>
                <dd>{formatKg(record.totalWeightKg)}</dd>
              </div>
              <div>
                <dt>Avg Weight per Bird</dt>
                <dd>{formatWeight(record.avgWeightG)}</dd>
              </div>
            </>
          )}
          {record.remarks && (
            <div>
              <dt>Remarks</dt>
              <dd>{record.remarks}</dd>
            </div>
          )}
          <div>
            <dt>Entered By</dt>
            <dd>{record.createdBy?.name ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Entered On</dt>
            <dd>{formatDateTime(record.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
