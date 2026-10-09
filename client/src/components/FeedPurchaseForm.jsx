import { useState } from 'react';
import { addFeedType, createFeedPurchase } from '../api.js';
import { FEED_TYPES, formatRupees } from '../flock.js';
import OptionSelect from './OptionSelect.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const emptyItem = () => ({ feedType: '', quantityKg: '', ratePerKg: '' });

const itemCost = (item) => (Number(item.quantityKg) || 0) * (Number(item.ratePerKg) || 0);

// Form for feed bought into the store, one or more feed types at a time.
// `addedFeedTypes` are the feed types added by hand, listed after the standard
// ones; `onFeedTypes` takes the updated list when another is added here.
// `onSaved` takes the purchases made, one per feed type.
export default function FeedPurchaseForm({ addedFeedTypes, onFeedTypes, onSaved, onCancel }) {
  const [date, setDate] = useState(today);
  const [items, setItems] = useState(() => [emptyItem()]);
  const [feedCompany, setFeedCompany] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const feedTypes = [...FEED_TYPES, ...addedFeedTypes];
  const amount = items.reduce((sum, item) => sum + itemCost(item), 0);

  const setItem = (index, field) => (value) =>
    setItems((prev) => prev.map((item, at) => (at === index ? { ...item, [field]: value } : item)));

  async function saveFeedType(name) {
    if (feedTypes.some((other) => sameName(other, name))) {
      throw new Error(`Feed type "${name}" is already on the list`);
    }
    const options = await addFeedType(name);
    onFeedTypes(options.feedTypes);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.some((item) => !item.feedType)) {
      return setError(
        items.length === 1 ? 'Please select the feed type.' : 'Please select every feed type.',
      );
    }

    setSubmitting(true);
    setError('');
    try {
      onSaved(
        await createFeedPurchase({
          date,
          feedCompany,
          remarks,
          items: items.map((item) => ({
            feedType: item.feedType,
            quantityKg: Number(item.quantityKg),
            ratePerKg: Number(item.ratePerKg),
          })),
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

        {items.map((item, i) => (
          <fieldset className="group" key={i}>
            <legend>{items.length === 1 ? 'Feed' : `Feed ${i + 1}`}</legend>

            <div className="field">
              <label htmlFor={`purchase-feed-type-${i}`}>Feed Type</label>
              <OptionSelect
                id={`purchase-feed-type-${i}`}
                value={item.feedType}
                names={feedTypes}
                onChange={setItem(i, 'feedType')}
                placeholder="Select feed type"
                addLabel="Add feed type"
                onAdd={saveFeedType}
              />
            </div>

            <div className="field-row">
              <label className="field">
                <span>Quantity (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  step="any"
                  value={item.quantityKg}
                  onChange={(e) => setItem(i, 'quantityKg')(e.target.value)}
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
                  value={item.ratePerKg}
                  onChange={(e) => setItem(i, 'ratePerKg')(e.target.value)}
                  placeholder="0"
                  required
                />
              </label>
            </div>

            {items.length > 1 && (
              <p className="hint">
                Cost: {formatRupees(itemCost(item))}
                <button
                  type="button"
                  className="link"
                  onClick={() => setItems((prev) => prev.filter((_, at) => at !== i))}
                >
                  Remove
                </button>
              </p>
            )}
          </fieldset>
        ))}

        <button
          type="button"
          className="secondary"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
        >
          + Add Another Feed Type
        </button>

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
