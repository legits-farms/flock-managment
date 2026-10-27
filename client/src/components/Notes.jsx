import { useEffect, useState } from 'react';
import { addNote, deleteNote, getNotes } from '../api.js';

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// The notes tab of a batch's page (`page` is { batchId }) or a coop's page
// ({ farm, coop }): write a note, and read the ones before it, newest first
export default function Notes({ page }) {
  const [notes, setNotes] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // The note waiting for a second tap to delete it
  const [deleting, setDeleting] = useState(null);
  const key = JSON.stringify(page);

  useEffect(() => {
    let current = true;
    setNotes(null);
    setLoadError('');
    getNotes(JSON.parse(key))
      .then((list) => current && setNotes(list))
      .catch((err) => current && setLoadError(err.message));
    return () => {
      current = false;
    };
  }, [key]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!draft.trim()) return setError('Write the note first.');
    setSaving(true);
    setError('');
    try {
      const note = await addNote(page, draft);
      setNotes((list) => [note, ...(list ?? [])]);
      setDraft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (deleting !== id) return setDeleting(id);
    setError('');
    try {
      await deleteNote(id);
      setNotes((list) => list.filter((note) => note._id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="notes">
      <form className="card form note-form" onSubmit={handleAdd}>
        <label className="field">
          <span>Add a Note</span>
          <textarea
            rows="3"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Anything to remember about this…"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary small" disabled={saving}>
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </form>

      {notes === null ? (
        <p className="status">{loadError || 'Loading…'}</p>
      ) : notes.length === 0 ? (
        <p className="status">No notes yet.</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note._id} className="card note">
              <p className="note-text">{note.text}</p>
              <div className="note-meta">
                <span>
                  {note.createdBy?.name ?? 'Someone'} · {formatDateTime(note.createdAt)}
                </span>
                {note.canDelete && (
                  <button
                    type="button"
                    className={`link ${deleting === note._id ? 'danger' : ''}`}
                    onClick={() => handleDelete(note._id)}
                    onBlur={() => setDeleting(null)}
                  >
                    {deleting === note._id ? 'Tap again to delete' : 'Delete'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
