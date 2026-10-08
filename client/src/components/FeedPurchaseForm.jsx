import { useState } from 'react';
import { addFeedType, createFeedPurchase } from '../api.js';
import { FEED_TYPES, formatRupees } from '../flock.js';
import OptionSelect from './OptionSelect.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Form for feed bought into the store. `addedFeedTypes` are the feed types
// added by hand, listed after the standard ones; `onFeedTypes` takes the
// updated list when another is added here.
export default function FeedPurchaseForm({ addedFeedTypes, onFeedTypes, onSaved, onCancel }) {
  const [date, setDate] = useState(today);
  const [feedType, setFeedType] = useState('');
  const [feedCompany, setFeedCompany] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const feedTypes = [...FEED_TYPES, ...addedFeedTypes];
  const amount = (Number(quantityKg) || 0) * (Number(ratePerKg) || 0);

  async function saveFeedType(name) {
    if (feedTypes.some((other) => sameName(other, name))) {
      throw new Error(`Feed type "${name}" is already on the list`);
    }
    const options = await addFeedType(name);
    onFeedTypes(options.feedTypes);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feedType) return setError('Please select the feed type.');

    setSubmitting(true);
    setError('');
    try {
      onSaved(
        await createFeedPurchase({
          date,
          feedType,
          feedCompany,
          quantityKg: Number(quantityKg),
          ratePerKg: Number(ratePerKg),
          remarks,
        }),
      );
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onCancel}>
        ‹ Feed
      </button>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>Add Feed Purchase</h2>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <div className="field">
          <label htmlFor="purchase-feed-type">Feed Type</label>
          <OptionSelect
            id="purchase-feed-type"
            value={feedType}
            names={feedTypes}
            onChange={setFeedType}
            placeholder="Select feed type"
            addLabel="Add feed type"
            onAdd={saveFeedType}
          />
        </div>

        <label className="field">
          <span>Feed Company</span>
          <input
            type="text"
            value={feedCompany}
            onChange={(e) => setFeedCompany(e.target.value)}
            placeholder="Company the feed is from"
            required
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Quantity (kg)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.001"
              step="any"
              value={quantityKg}
              onChange={(e) => setQuantityKg(e.target.value)}
              placeholder="0"
              required
            />
          </label>
          <label className="field">
            <span>Price per kg (₹)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={ratePerKg}
              onChange={(e) => setRatePerKg(e.target.value)}
              placeholder="0"
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Total Cost</span>
          <input type="text" value={formatRupees(amount)} readOnly />
        </label>

        <label className="field">
          <span>Remarks</span>
          <textarea
            rows="2"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional"
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add Feed Purchase'}
        </button>
      </form>
    </div>
  );
}
