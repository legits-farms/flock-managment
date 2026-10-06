import { useState } from 'react';
import { addFarm } from '../api.js';
import { batchesOnFarm, formatNumber, liveBirds, totalMortality } from '../flock.js';

// The list of farms, what each one currently holds, and a way to add another.
// Each card opens that farm's page.
export default function Farms({ farms, batches, onOptions, onOpen }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function closeSheet() {
    setAdding(false);
    setName('');
    setError('');
  }

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      onOptions(await addFarm(name));
      closeSheet();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

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
          const onFarm = batchesOnFarm(batches, farm);
          const live = onFarm.reduce((sum, batch) => sum + liveBirds(batch), 0);
          const mortality = onFarm.reduce((sum, batch) => sum + totalMortality(batch), 0);
          const coops = new Set(
            onFarm.flatMap((batch) => batch.coops.map((coop) => coop.name.toLowerCase())),
          );

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
                      <b>{coops.size}</b> {coops.size === 1 ? 'coop' : 'coops'} in use
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
        <div className="sheet-backdrop" onClick={closeSheet}>
          <form
            className="sheet form"
            role="dialog"
            aria-modal="true"
            aria-label="Add a farm"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAdd}
          >
            <h2>Add a Farm</h2>

            <label className="field">
              <span>Farm Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
                required
              />
            </label>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="option-add-actions">
              <button type="button" className="secondary" disabled={saving} onClick={closeSheet}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add Farm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
