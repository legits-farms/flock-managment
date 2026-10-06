import { useState } from 'react';

// Bottom-sheet popup asking for one name (a new farm, a new coop).
// `onSubmit(name)` saves it and may reject with an Error, which is shown.
export default function NameSheet({ title, label, submitLabel, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(name);
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
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>{title}</h2>

        <label className="field">
          <span>{label}</span>
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
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Adding…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
