import { useEffect, useState } from 'react';
import { getAllMortalities } from '../api.js';
import { formatNumber } from '../flock.js';

const DAYS = 14;

// YYYY-MM-DD in local time, so a record counts towards the day it was registered on
const dayKey = (value) => new Date(value).toLocaleDateString('en-CA');

const formatDay = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// The last DAYS days up to today, oldest first: [{ date, birds }]
function dailyTotals(mortalities) {
  const byDay = new Map();
  for (const record of mortalities) {
    const key = dayKey(record.date ?? record.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + record.birds);
  }

  return Array.from({ length: DAYS }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (DAYS - 1 - i));
    return { date, birds: byDay.get(dayKey(date)) ?? 0 };
  });
}

// Round axis values (0 / 5 / 10 …) reaching at least `max`, in at most four steps
function axisTicks(max) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(max, 1)));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => max / s <= 4) ?? 10 * magnitude;
  const count = Math.max(Math.ceil(max / step), 1);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

// Birds lost per day across every batch. Tapping a day shows its count.
export default function MortalityChart() {
  const [days, setDays] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllMortalities()
      .then((mortalities) => {
        if (!cancelled) setDays(dailyTotals(mortalities));
      })
      // The dashboard still works without this chart
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!days) return null;

  const total = days.reduce((sum, day) => sum + day.birds, 0);
  const ticks = axisTicks(Math.max(...days.map((day) => day.birds)));
  const top = ticks[ticks.length - 1];
  const shown = active === null ? null : days[active];

  return (
    <section className="card">
      <h2 className="eyebrow">Mortality · Last {DAYS} Days</h2>
      <p className="chart-figure" aria-live="polite">
        <strong>{formatNumber(shown ? shown.birds : total)}</strong>
        <span>{shown ? `birds on ${formatDay(shown.date)}` : 'birds in total'}</span>
      </p>

      <div className="chart">
        <div className="chart-plot" onPointerLeave={() => setActive(null)}>
          {ticks.map((tick) => (
            <div
              key={tick}
              className="chart-grid"
              style={{ bottom: `${(tick / top) * 100}%` }}
              aria-hidden="true"
            >
              <span>{formatNumber(tick)}</span>
            </div>
          ))}
          <div className="chart-cols">
            {days.map((day, i) => (
              <button
                key={day.date.toISOString()}
                type="button"
                className={active === i ? 'chart-col active' : 'chart-col'}
                aria-label={`${formatDay(day.date)}: ${formatNumber(day.birds)} birds`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
              >
                <span className="chart-bar" style={{ height: `${(day.birds / top) * 100}%` }} />
              </button>
            ))}
          </div>
        </div>
        <div className="chart-x" aria-hidden="true">
          {days.map((day, i) => (
            <span key={day.date.toISOString()}>
              {/* Every third day, ending on today */}
              {(DAYS - 1 - i) % 3 === 0 && formatDay(day.date)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
