import { formatNumber, liveBirds, totalMortality, unallocatedBirds } from '../flock.js';
import LoadStatus from './LoadStatus.jsx';
import RecentRecords from './RecentRecords.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Stroke icons for the quick-action tiles
const Icon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

function summarise(batches) {
  let birds = 0;
  let mortality = 0;
  const byBreed = new Map();

  for (const batch of batches) {
    const live = liveBirds(batch);
    birds += batch.numberOfBirds;
    mortality += totalMortality(batch);

    const breed = byBreed.get(batch.breed) || { breed: batch.breed, batches: 0, live: 0 };
    breed.batches += 1;
    breed.live += live;
    byBreed.set(batch.breed, breed);
  }

  return {
    birds,
    mortality,
    live: birds - mortality,
    mortalityPct: birds > 0 ? (mortality / birds) * 100 : 0,
    breeds: [...byBreed.values()].sort((a, b) => b.live - a.live),
  };
}

export default function Dashboard({
  batches,
  loading,
  error,
  onRetry,
  onNavigate,
  onAction,
  onEnter,
}) {
  if (loading || error) return <LoadStatus loading={loading} error={error} onRetry={onRetry} />;

  if (batches.length === 0) {
    return (
      <div className="status">
        <p>No batches yet. Register your first batch to see the flock summary.</p>
        <button type="button" className="primary" onClick={onEnter}>
          Enter Batch
        </button>
      </div>
    );
  }

  const summary = summarise(batches);
  const maxLive = Math.max(...summary.breeds.map((b) => b.live), 1);
  const recent = batches.slice(0, 3);
  const unallocated = batches.reduce((sum, batch) => sum + unallocatedBirds(batch), 0);

  return (
    <div className="dashboard">
      <section className="hero">
        <p className="hero-label">Live Birds</p>
        <p className="hero-value">{formatNumber(summary.live)}</p>
        <dl className="hero-stats">
          <div>
            <dt>Total Birds</dt>
            <dd>{formatNumber(summary.birds)}</dd>
          </div>
          <div>
            <dt>Mortality</dt>
            <dd>
              {formatNumber(summary.mortality)}
              <small>{summary.mortalityPct.toFixed(1)}%</small>
            </dd>
          </div>
          <div>
            <dt>Batches</dt>
            <dd>{formatNumber(batches.length)}</dd>
          </div>
        </dl>
      </section>

      <div className="quick-actions">
        <button type="button" className="quick" onClick={() => onAction('mortality')}>
          <span className="quick-icon">
            <Icon>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12h8" />
            </Icon>
          </span>
          Register Mortality
        </button>
        <button type="button" className="quick" onClick={() => onAction('vaccination')}>
          <span className="quick-icon">
            <Icon>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <path d="M12 8v8M8 12h8" />
            </Icon>
          </span>
          Add Vaccination
        </button>
        <button type="button" className="quick" onClick={onEnter}>
          <span className="quick-icon">
            <Icon>
              <path d="M12 5v14M5 12h14" />
            </Icon>
          </span>
          Enter Batch
        </button>
        <button type="button" className="quick" onClick={() => onAction('shift')}>
          <span className="quick-icon">
            <Icon>
              <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
            </Icon>
          </span>
          Shift Birds
        </button>
      </div>

      {unallocated > 0 && (
        <button type="button" className="alert" onClick={() => onNavigate('batches')}>
          <span>
            <strong>{formatNumber(unallocated)} birds</strong> not yet allocated to coops
          </span>
          <span className="alert-go" aria-hidden="true">
            ›
          </span>
        </button>
      )}

      <section className="card">
        <h2 className="eyebrow">Live Birds by Breed</h2>
        <ul className="breed-list">
          {summary.breeds.map((b) => (
            <li key={b.breed}>
              <div className="breed-row">
                <span className="breed-name">{b.breed}</span>
                <span className="breed-count">
                  {formatNumber(b.live)}
                  <small>
                    {b.batches} {b.batches === 1 ? 'batch' : 'batches'}
                  </small>
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${(b.live / maxLive) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="section-head">
          <h2 className="eyebrow">Recent Batches</h2>
          <button type="button" className="link" onClick={() => onNavigate('batches')}>
            View all
          </button>
        </div>
        <ul className="recent-list">
          {recent.map((batch) => (
            <li key={batch._id}>
              <div>
                <strong>{batch.batchName}</strong>
                <small>
                  {batch.breed} · {formatDate(batch.startDate)}
                </small>
              </div>
              <span>{formatNumber(liveBirds(batch))}</span>
            </li>
          ))}
        </ul>
      </section>

      <RecentRecords />
    </div>
  );
}
