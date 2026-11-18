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

// One batch's card; a batch with no live birds left is shown as closed
function BatchCard({ batch, onManage }) {
  const live = liveBirds(batch);
  const closed = live <= 0;
  const mortality = totalMortality(batch);
  const unallocated = unallocatedBirds(batch);
  // Sold birds left alive, so they do not count against the batch
  const livability =
    batch.numberOfBirds > 0 ? ((batch.numberOfBirds - mortality) / batch.numberOfBirds) * 100 : 0;

  return (
    <li>
      {/* The whole card opens the batch page */}
      <button
        type="button"
        className={`card batch${closed ? ' closed' : ''}`}
        onClick={() => onManage(batch._id)}
      >
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
            {closed ? (
              <span className="badge closed">Closed</span>
            ) : (
              <span className="badge age">Age {batchAge(batch)}</span>
            )}
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
              {batch.coops.length > 0 && `: ${batch.coops.map((coop) => coop.name).join(', ')}`}
            </span>
            {unallocated > 0 ? (
              <span className="chip pending-chip">{formatNumber(unallocated)} to allocate</span>
            ) : (
              !closed && <span className="chip">Fully allocated</span>
            )}
          </span>
          <span className="alert-go" aria-hidden="true">
            ›
          </span>
        </span>
      </button>
    </li>
  );
}

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

  // Batches with no live birds left are closed and go to the bottom
  const open = batches.filter((batch) => liveBirds(batch) > 0);
  const closed = batches.filter((batch) => liveBirds(batch) <= 0);

  return (
    <div className="manage wide">
      <div className="list-head">
        <h2>
          Batches <span>{open.length}</span>
        </h2>
        <button type="button" className="primary small" onClick={onEnter}>
          ＋ Enter Batch
        </button>
      </div>

      <ul className="batch-list">
        {open.map((batch) => (
          <BatchCard key={batch._id} batch={batch} onManage={onManage} />
        ))}
      </ul>

      {closed.length > 0 && (
        <>
          <h3 className="batch-group">
            Closed batches <span>{closed.length}</span>
          </h3>
          <ul className="batch-list">
            {closed.map((batch) => (
              <BatchCard key={batch._id} batch={batch} onManage={onManage} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
