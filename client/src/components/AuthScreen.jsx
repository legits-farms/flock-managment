import { useState } from 'react';
import { login, signup } from '../api.js';
import logo from '../assets/logo.webp';

// Log in / sign up screen shown until someone is logged in
export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const signingUp = mode === 'signup';

  function switchMode(next) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const user = signingUp
        ? await signup({ name, phone, password })
        : await login({ phone, password });
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="app auth">
      <img className="auth-logo" src={logo} alt="Energy Eggs" />
      <p className="eyebrow">Flock Management</p>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="subtabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!signingUp}
            className={signingUp ? '' : 'active'}
            onClick={() => switchMode('login')}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={signingUp}
            className={signingUp ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {signingUp && (
          <label className="field">
            <span>Your Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label className="field">
          <span>Phone Number</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={signingUp ? 6 : undefined}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            placeholder={signingUp ? 'At least 6 characters' : ''}
            required
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Please wait…' : signingUp ? 'Create Account' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
