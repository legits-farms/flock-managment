import { coopGroups, coopLive, formatNumber } from '../flock.js';
import LoadStatus from './LoadStatus.jsx';

// Every coop across all batches; each card opens that coop's page
export default function CoopList({ batches, loading, error, onRetry, onOpen, onNavigate }) {
  if (loading || error) return <LoadStatus loading={loading} error={error} onRetry={onRetry} />;

  const groups = coopGroups(batches);

  if (groups.length === 0) {
    return (
      <div className="status">
        <p>No coops yet. Open a batch and allocate its birds to coops.</p>
        <button type="button" className="primary" onClick={() => onNavigate('batches')}>
          Go to Batches
        </button>
      </div>
    );
  }

  return (
    <div className="manage">
      <div className="list-head">
        <h2>
          Coops <span>{groups.length}</span>
        </h2>
      </div>

      <ul className="batch-list">
        {groups.map((group) => {
          const entered = group.entries.reduce((sum, { coop }) => sum + coop.birds, 0);
          const live = group.entries.reduce((sum, { coop }) => sum + coopLive(coop), 0);
          const livability = entered > 0 ? (live / entered) * 100 : 0;

          return (
            <li key={group.key}>
              <button type="button" className="card batch" onClick={() => onOpen(group.key)}>
                <span className="batch-head">
                  <span className="batch-title">
                    <strong>{group.name}</strong>
                    {group.farm && <small>{group.farm}</small>}
                  </span>
                  <span className="badge">
                    {group.entries.length} {group.entries.length === 1 ? 'batch' : 'batches'}
                  </span>
                </span>

                <span className="batch-figures">
                  <span className="batch-live">
                    <b>{formatNumber(live)}</b>
                    live birds
                  </span>
                  <span className="batch-side">
                    <span>
                      <b>{formatNumber(entered)}</b> entered
                    </span>
                    <span>
                      <b>{formatNumber(entered - live)}</b> mortality
                    </span>
                  </span>
                </span>

                <span className="bar">
                  <span style={{ width: `${livability}%` }} />
                </span>
                <span className="batch-livability">{livability.toFixed(1)}% livability</span>

                <span className="batch-foot">
                  <span className="chips">
                    {group.entries.map(({ batch }) => (
                      <span key={batch._id} className="chip">
                        {batch.batchName} · {batch.breed}
                      </span>
                    ))}
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
