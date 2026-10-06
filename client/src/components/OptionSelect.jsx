import { useState } from 'react';
import Dropdown from './Dropdown.jsx';

const ADD = '__add__';

// Dropdown over a fixed list of names, with a last "Add …" entry that lets the
// person type a new one. `onAdd(name)` saves it and may reject with an Error.
export default function OptionSelect({ id, value, names, onChange, placeholder, addLabel, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = [
    ...names.map((name) => ({ value: name, label: name })),
    { value: ADD, label: `＋ ${addLabel}` },
  ];

  function choose(next) {
    if (next === ADD) {
      setAdding(true);
      setError('');
    } else {
      onChange(next);
    }
  }

  async function save() {
    const name = newName.trim();
    if (!name) return setError('Enter a name.');

    setSaving(true);
    setError('');
    try {
      await onAdd(name);
      onChange(name);
      setAdding(false);
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <Dropdown
        id={id}
        value={value}
        options={options}
        onChange={choose}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className="option-add">
      <input
        id={id}
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        // Enter adds the name instead of submitting the form around it
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        placeholder={addLabel}
        maxLength={40}
        autoFocus
      />
      <div className="option-add-actions">
        <button
          type="button"
          className="secondary"
          disabled={saving}
          onClick={() => setAdding(false)}
        >
          Cancel
        </button>
        <button type="button" className="primary" disabled={saving} onClick={save}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
