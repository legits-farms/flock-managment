import { formatNumber, vaccinationStatus } from '../flock.js';
import useVaccineSchedule from '../useVaccineSchedule.js';

const days = (count) => `${formatNumber(count)} ${count === 1 ? 'day' : 'days'}`;

const STATUS_LABELS = { done: 'Done', due: 'Not Done', upcoming: 'Upcoming', optional: 'If Needed' };

// Where the birds of a batch or coop stand on the vaccination schedule: for each
// vaccine of their age so far whether it was given, and what is still to come.
// `entries` are the page's { batch, coop } pairs, `vaccinations` every vaccination
// record of those batches (null while loading) and `showCoop` names the coops
// still to be vaccinated, for a page that covers several.
export default function VaccinationSchedule({ entries, vaccinations, showCoop = false }) {
  const schedule = useVaccineSchedule();
  if (!vaccinations) return null;

  // One schedule per batch with live birds here
  const batches = [...new Map(entries.map(({ batch }) => [batch._id, batch])).values()];
  const perBatch = batches
    .map((batch) => ({
      batch,
      rows: vaccinationStatus(
        batch,
        schedule,
        vaccinations,
        entries.filter((entry) => entry.batch._id === batch._id).map((entry) => entry.coop),
      ),
    }))
    .filter(({ rows }) => rows.length > 0);

  if (perBatch.length === 0) return null;

  return perBatch.map(({ batch, rows }) => {
    const count = (status) => rows.filter((row) => row.status === status).length;
    return (
      <section className="card" key={batch._id}>
        <h2 className="eyebrow">
          Vaccination Schedule{perBatch.length > 1 && ` · ${batch.batchName}`}
        </h2>
        <p className="chart-figure">
          <strong>
            {count('done')} / {rows.length - count('optional')}
          </strong>
          <span>
            done
            {count('due') > 0 && ` · ${count('due')} not done for their age`}
          </span>
        </p>

        <ul className="recent-list">
          {rows.map((row) => {
            const birds = row.pending.reduce((sum, { birds: short }) => sum + short, 0);
            return (
              <li key={`${row.vaccine}|${row.when}`}>
                <div>
                  <strong>{row.vaccine}</strong>
                  <small>
                    {row.when}
                    {row.status === 'due' &&
                      ` · ${row.late === 0 ? 'Due today' : `${days(row.late)} late`} · ${formatNumber(birds)} birds not vaccinated`}
                    {row.status === 'due' &&
                      showCoop &&
                      ` in ${row.pending.map(({ coop }) => coop.name).join(', ')}`}
                    {row.status === 'upcoming' && ` · Due in ${days(-row.late)}`}
                  </small>
                </div>
                <span className={`status-chip ${row.status}`}>{STATUS_LABELS[row.status]}</span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  });
}
