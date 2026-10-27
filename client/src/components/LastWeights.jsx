import { useEffect, useState } from 'react';
import { getAllWeights } from '../api.js';
import { batchAge, formatNumber, formatWeight, liveBirds } from '../flock.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const dayOf = (value) => new Date(value).toLocaleDateString('en-CA');

// A batch's last avg weight: the day it was last weighed, with every coop weighed
// that day taken together. { avgWeightG, date, coops }, or null if never weighed.
function lastWeight(weights) {
  if (weights.length === 0) return null;
  const latest = weights.reduce((a, b) => (new Date(b.date) > new Date(a.date) ? b : a));
  const sameDay = weights.filter((w) => dayOf(w.date) === dayOf(latest.date));
  const birds = sameDay.reduce((sum, w) => sum + w.birds, 0);
  const kg = sameDay.reduce((sum, w) => sum + w.totalWeightKg, 0);
  return {
    avgWeightG: Math.round((kg * 1000) / birds),
    date: latest.date,
    coops: [...new Set(sameDay.map((w) => w.coopName))],
  };
}

// Dashboard card: the last avg weight of each batch with live birds
export default function LastWeights({ batches }) {
  // null until loaded
  const [weights, setWeights] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAllWeights()
      .then((records) => !cancelled && setWeights(records))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const live = batches.filter((batch) => liveBirds(batch) > 0);
  if (live.length === 0) return null;

  return (
    <section className="card">
      <h2 className="eyebrow">Last Avg Weight</h2>
      {!weights ? (
        <p className="status">{error || 'Loading…'}</p>
      ) : (
        <ul className="recent-list">
          {live.map((batch) => {
            const last = lastWeight(
              weights.filter((w) => (w.batch?._id ?? w.batch) === batch._id),
            );
            return (
              <li key={batch._id}>
                <div>
                  <strong>{batch.batchName}</strong>
                  <small>
                    {batch.breed} · Age {batchAge(batch)} · {formatNumber(liveBirds(batch))} live
                  </small>
                </div>
                {last ? (
                  <div className="weight-last">
                    <strong>{formatWeight(last.avgWeightG)}</strong>
                    <small>
                      {formatDate(last.date)} · {last.coops.join(', ')}
                    </small>
                  </div>
                ) : (
                  <small className="weight-none">Not weighed yet</small>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
