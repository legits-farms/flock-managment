import { useCallback, useEffect, useState } from 'react';
import { getUsers, setUserRole } from '../api.js';

const ROLE_LABELS = { admin: 'Admin', user: 'Staff', security: 'Security' };

// What each role may do, said under the name
const ROLE_NOTES = {
  admin: 'Everything, and approves mortality',
  user: 'Everything',
  security: 'Mortality only',
};

// The roles an account can be switched between
const SWITCHABLE = ['user', 'security'];

// [label, extra class of the chip] by account status
const STATUS = {
  pending: ['Waiting for approval', ''],
  approved: ['Approved', 'done'],
  rejected: ['Rejected', 'due'],
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Everyone with an account and what they may do. Only an admin gets here.
export default function Users({ me, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Id of the user whose role is being saved
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(user, role) {
    if (user.role === role) return;
    setSaving(user._id);
    setError('');
    try {
      const updated = await setUserRole(user._id, role);
      setUsers((prev) => prev.map((other) => (other._id === updated._id ? updated : other)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  const count = (role) => users.filter((user) => user.role === role).length;

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ Dashboard
      </button>

      <section className="card users">
        <h2 className="eyebrow">Users</h2>
        <dl className="batch-stats">
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <div key={role}>
              <dt>{label}</dt>
              <dd>{count(role)}</dd>
            </div>
          ))}
        </dl>

        {loading && <p className="status">Loading users…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <ul>
          {users.map((user) => (
            <li key={user._id}>
              <div className="user-head">
                <div>
                  <strong>
                    {user.name}
                    {user._id === me.id && ' (you)'}
                  </strong>
                  <small>
                    {user.phone} · Joined {formatDate(user.createdAt)}
                  </small>
                  <small>
                    {ROLE_LABELS[user.role] ?? user.role} · {ROLE_NOTES[user.role] ?? ''}
                  </small>
                </div>
                <span className={`status-chip ${STATUS[user.status]?.[1] ?? ''}`}>
                  {STATUS[user.status]?.[0] ?? user.status}
                </span>
              </div>

              {/* An admin is made by hand, so only the other two can be switched */}
              {user.role !== 'admin' && (
                <div className="choice" role="group" aria-label={`Role of ${user.name}`}>
                  {SWITCHABLE.map((role) => (
                    <button
                      key={role}
                      type="button"
                      aria-pressed={user.role === role}
                      className={user.role === role ? 'active' : ''}
                      disabled={saving === user._id}
                      onClick={() => changeRole(user, role)}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
