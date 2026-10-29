import { useState } from 'react';
import { nextPartLabel as nextLetter, partName } from '../flock.js';
import Dropdown from './Dropdown.jsx';

// Bottom-sheet popup adding a part to one of `coops` ([{ name, parts }]), the
// next letter filled in. `onSubmit(name)` saves the part's full name, "Coop 1B".
export default function PartSheet({ coops, initialCoop, onSubmit, onClose }) {
  const [coopName, setCoopName] = useState(initialCoop ?? '');
  const coop = coops.find((other) => other.name === coopName);
  const [label, setLabel] = useState(coop ? nextLetter(coop) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function chooseCoop(name) {
    setCoopName(name);
    setLabel(nextLetter(coops.find((other) => other.name === name)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!coop) return setError('Select the coop.');
    if (!label.trim()) return setError('Enter a name for the part.');
    setSaving(true);
    setError('');
    try {
      await onSubmit(partName(coop.name, label));
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form
        className="sheet form"
        role="dialog"
        aria-modal="true"
        aria-label="Add a Part"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Add a Part</h2>

        <div className="field">
          <label htmlFor="part-coop">Coop</label>
          <Dropdown
            id="part-coop"
            value={coopName}
            options={coops.map((other) => ({
              value: other.name,
              label: other.name,
              note: other.parts.length > 0 ? `${other.parts.length} parts` : undefined,
            }))}
            onChange={chooseCoop}
            placeholder="Select coop"
          />
        </div>

        <label className="field">
          <span>Part Name, e.g. B or Sonali</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={30}
            required
          />
        </label>
        {coop && label.trim() && <p className="hint">Adds {partName(coop.name, label)}</p>}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="option-add-actions">
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Adding…' : 'Add Part'}
          </button>
        </div>
      </form>
    </div>
  );
}
