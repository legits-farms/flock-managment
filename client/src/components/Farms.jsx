import { useState } from 'react';
import { addFarm } from '../api.js';
import { farmSummary, formatNumber } from '../flock.js';
import NameSheet from './NameSheet.jsx';

// The list of farms, what each one currently holds, and a way to add another.
// Each card opens that farm's page.
export default function Farms({ farms, batches, onOptions, onOpen }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="manage">
      <div className="list-head">
        <h2>
          Farms <span>{farms.length}</span>
        </h2>
        <button type="button" className="primary small" onClick={() => setAdding(true)}>
          ＋ Add Farm
        </button>
      </div>

      {farms.length === 0 && <p className="status">No farms yet. Add your first farm.</p>}

      <ul className="batch-list">
        {farms.map((farm) => {
          const { present: onFarm, live, mortality, coopCount } = farmSummary(batches, farm);

          return (
            <li key={farm}>
              <button type="button" className="card batch" onClick={() => onOpen(farm)}>
                <span className="batch-head">
                  <span className="batch-title">
                    <strong>{farm}</strong>
                  </span>
                  <span className="badge">
                    {onFarm.length} {onFarm.length === 1 ? 'batch' : 'batches'}
                  </span>
                </span>

                <span className="batch-figures">
                  <span className="batch-live">
                    <b>{formatNumber(live)}</b>
                    live birds
                  </span>
                  <span className="batch-side">
                    <span>
                      <b>{coopCount}</b> {coopCount === 1 ? 'coop' : 'coops'} in use
                    </span>
                    <span>
                      <b>{formatNumber(mortality)}</b> mortality
                    </span>
                  </span>
                </span>

                <span className="batch-foot">
                  <span className="chips">
                    {onFarm.length === 0 && <span className="chip">No batches yet</span>}
                    {onFarm.map((batch) => (
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

      {adding && (
        <NameSheet
          title="Add a Farm"
          label="Farm Name"
          submitLabel="Add Farm"
          onSubmit={async (name) => onOptions(await addFarm(name))}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
