import {
  batchAge,
  formatNumber,
  liveBirds,
  totalMortality,
  unallocatedBirds,
} from '../flock.js';
import LoadStatus from './LoadStatus.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function BatchList({ batches, loading, error, onRetry, onManage, onEnter }) {
  if (loading || error) return <LoadStatus loading={loading} error={error} onRetry={onRetry} />;

  if (batches.length === 0) {
    return (
      <div className="status">
        <p>No batches yet.</p>
        <button type="button" className="primary" onClick={onEnter}>
          ＋ Enter Batch
        </button>
      </div>
    );
  }

  return (
    <div className="manage">
      <div className="list-head">
        <h2>
          Batches <span>{batches.length}</span>
        </h2>
        <button type="button" className="primary small" onClick={onEnter}>
          ＋ Enter Batch
        </button>
      </div>

      <ul className="batch-list">
        {batches.map((batch) => {
          const live = liveBirds(batch);
          const mortality = totalMortality(batch);
          const unallocated = unallocatedBirds(batch);
          const livability = batch.numberOfBirds > 0 ? (live / batch.numberOfBirds) * 100 : 0;

          return (
            <li key={batch._id}>
              {/* The whole card opens the batch page */}
              <button type="button" className="card batch" onClick={() => onManage(batch._id)}>
                <span className="batch-head">
                  <span className="batch-title">
                    <strong>{batch.batchName}</strong>
                    <small>
                      Started {formatDate(batch.startDate)}
                      {batch.shiftToFarm && ` · ${batch.shiftToFarm}`}
                    </small>
                  </span>
                  <span className="badges">
                    <span className="badge">{batch.breed}</span>
                    <span className="badge age">Age {batchAge(batch)}</span>
                  </span>
                </span>

                <span className="batch-figures">
                  <span className="batch-live">
                    <b>{formatNumber(live)}</b>
                    live birds
                  </span>
                  <span className="batch-side">
                    <span>
                      <b>{formatNumber(batch.numberOfBirds)}</b> received
                    </span>
                    <span>
                      <b>{formatNumber(mortality)}</b> mortality
                    </span>
                  </span>
                </span>

                <span className="bar">
                  <span style={{ width: `${livability}%` }} />
                </span>
                <span className="batch-livability">{livability.toFixed(1)}% livability</span>

                <span className="batch-foot">
                  <span className="chips">
                    <span className="chip">
                      {batch.coops.length} {batch.coops.length === 1 ? 'coop' : 'coops'}
                    </span>
                    {unallocated > 0 ? (
                      <span className="chip pending-chip">
                        {formatNumber(unallocated)} to allocate
                      </span>
                    ) : (
                      <span className="chip">Fully allocated</span>
                    )}
                  </span>
                  <span className="alert-go" aria-hidden="true">
                    ›
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
