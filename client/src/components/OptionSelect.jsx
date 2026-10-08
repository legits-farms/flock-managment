import { useState } from 'react';
import Dropdown from './Dropdown.jsx';

const ADD = '__add__';

// Dropdown over a fixed list of names, with a last "Add …" entry that lets the
// person type a new one. `onAdd(name)` saves it and may reject with an Error.
// `options` ({ value, label, note }) replaces `names` when the entries carry a
// note; `noteLabel` then asks for the new one's note too, passed on as
// `onAdd(name, note)`, which resolves to the value to select.
export default function OptionSelect({
  id,
  value,
  names = [],
  options: listed,
  onChange,
  placeholder,
  addLabel,
  noteLabel,
  onAdd,
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const options = [
    ...(listed ?? names.map((name) => ({ value: name, label: name }))),
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
      const added = await onAdd(name, newNote.trim());
      onChange(added ?? name);
      setAdding(false);
      setNewName('');
      setNewNote('');
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

  // Enter adds the name instead of submitting the form around it
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  };

  return (
    <div className="option-add">
      <input
        id={id}
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={addLabel}
        maxLength={40}
        autoFocus
      />
      {noteLabel && (
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={noteLabel}
          aria-label={noteLabel}
          maxLength={40}
        />
      )}
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
