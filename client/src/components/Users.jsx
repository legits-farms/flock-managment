import { useCallback, useEffect, useState } from 'react';
import { getOptions, getUsers, setUserRole } from '../api.js';

const ROLE_LABELS = { admin: 'Admin', user: 'Staff', security: 'Security', manager: 'Manager' };

// What each role may do, said under the name
const ROLE_NOTES = {
  admin: 'Can do everything',
  user: 'Can do everything',
  security: 'Registers mortality only',
};

// Admins first, then the rest
const ROLE_ORDER = ['admin', 'user', 'manager', 'security'];

// A manager is said with their farm, which is all they see
const roleLabel = (user) =>
  user.role === 'manager' && user.farm
    ? `${user.farm} Manager`
    : (ROLE_LABELS[user.role] ?? user.role);
const roleNote = (user) =>
  user.role === 'manager' ? `Sees ${user.farm ?? 'no farm'} only` : (ROLE_NOTES[user.role] ?? '');

// The value of a role in the role picker: "user", "security" or "manager:<farm>"
const roleValue = (user) => (user.role === 'manager' ? `manager:${user.farm ?? ''}` : user.role);

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

// "+91 81053 69922", or "98765 43210" for a number saved without the country code
function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const local = digits.slice(-10);
  if (local.length < 10) return phone;
  const code = digits.slice(0, -10);
  return `${code ? `+${code} ` : ''}${local.slice(0, 5)} ${local.slice(5)}`;
}

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Everyone with an account and what they may do. Only an admin gets here.
export default function Users({ me, onBack }) {
  const [users, setUsers] = useState([]);
  // A manager is of one farm, so there is that role to give for each farm
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  // The role the list is narrowed to, or '' for everyone
  const [filter, setFilter] = useState('');
  // Id of the user whose role is being saved, and of the one just saved
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, options] = await Promise.all([getUsers(), getOptions()]);
      setUsers(list);
      setFarms(options.farms);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(user, value) {
    if (value === roleValue(user)) return;
    const [role, ...farm] = value.split(':');
    setSaving(user._id);
    setSaved('');
    setError('');
    try {
      const updated = await setUserRole(user._id, role, farm.join(':') || undefined);
      setUsers((prev) => prev.map((other) => (other._id === updated._id ? updated : other)));
      setSaved(user._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  const count = (role) => users.filter((user) => user.role === role).length;
  const query = search.trim().toLowerCase();
  const digits = query.replace(/\D/g, '');
  const shown = users
    .filter((user) => !filter || user.role === filter)
    .filter(
      (user) =>
        !query ||
        user.name.toLowerCase().includes(query) ||
        (digits && user.phone.includes(digits))
    )
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)
    );

  const filters = [['', 'All', users.length], ...ROLE_ORDER.map((role) => [role, ROLE_LABELS[role], count(role)])];

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ Dashboard
      </button>

      <section className="card users">
        <div className="users-title">
          <div>
            <h2 className="eyebrow">Users</h2>
            <p>
              {users.length} {users.length === 1 ? 'person' : 'people'} can log in
            </p>
          </div>
        </div>

        <input
          type="search"
          className="users-search"
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />

        <div className="users-filters" role="tablist" aria-label="Show by role">
          {filters.map(([role, label, total]) => (
            <button
              key={role || 'all'}
              type="button"
              role="tab"
              aria-selected={filter === role}
              className={filter === role ? 'active' : ''}
              onClick={() => setFilter(role)}
            >
              {label} <span>{total}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="error users-error" role="alert">
            <span>{error}</span>
            <button type="button" className="link" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {loading && users.length === 0 && <p className="status">Loading users…</p>}
        {!loading && !error && shown.length === 0 && (
          <p className="users-empty">
            {users.length === 0 ? 'No one has an account yet.' : 'No one matches.'}
          </p>
        )}

        <ul className="users-list">
          {shown.map((user) => {
            const isMe = user._id === me.id;
            return (
              <li key={user._id} className={`role-${user.role}`}>
                <div className="users-person">
                  <span className="users-avatar" aria-hidden="true">
                    {initials(user.name)}
                  </span>
                  <div className="users-info">
                    <strong>
                      {user.name}
                      {isMe && <span className="users-you">You</span>}
                    </strong>
                    <small>
                      <a href={`tel:${user.phone}`}>{formatPhone(user.phone)}</a> · Joined{' '}
                      {formatDate(user.createdAt)}
                    </small>
                  </div>
                  <span className={`users-role role-${user.role}`}>{roleLabel(user)}</span>
                </div>

                <p className="users-note">
                  {roleNote(user)}
                  {user.canApproveMortality && (
                    <span className="users-badge">✓ Approves mortality</span>
                  )}
                </p>

                {/* An admin is made by hand, so only the others can be switched */}
                {user.role !== 'admin' && (
                  <label className="users-change">
                    <span>Role</span>
                    <select
                      value={roleValue(user)}
                      disabled={saving === user._id}
                      onChange={(e) => changeRole(user, e.target.value)}
                    >
                      <option value="user">Staff — can do everything</option>
                      <option value="security">Security — mortality only</option>
                      {farms.map((farm) => (
                        <option key={farm} value={`manager:${farm}`}>
                          {farm} Manager — {farm} only
                        </option>
                      ))}
                    </select>
                    <em aria-live="polite">
                      {saving === user._id ? 'Saving…' : saved === user._id ? '✓ Saved' : ''}
                    </em>
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
