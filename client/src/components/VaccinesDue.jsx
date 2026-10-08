import { useEffect, useState } from 'react';
import { getAllVaccinations } from '../api.js';
import { formatNumber, vaccinesDue } from '../flock.js';
import useVaccineSchedule from '../useVaccineSchedule.js';

// Dashboard alerts for vaccines the birds are old enough for but have not had:
// one per vaccine, with the coops it is still to be given in. Tapping one opens
// the vaccination form.
export default function VaccinesDue({ batches, onAdd }) {
  const schedule = useVaccineSchedule();
  // null until loaded
  const [vaccinations, setVaccinations] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllVaccinations()
      .then((records) => {
        if (!cancelled) setVaccinations(records);
      })
      // The dashboard still works without these alerts
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!vaccinations) return null;

  return vaccinesDue(batches, schedule, vaccinations).map(({ vaccine, when, coops }) => (
    <button key={`${vaccine}|${when}`} type="button" className="alert" onClick={onAdd}>
      <span>
        <strong>
          {formatNumber(coops.length)} {coops.length === 1 ? 'coop' : 'coops'}
        </strong>{' '}
        still not vaccinated with{' '}
        <strong>
          {vaccine} ({when})
        </strong>
        <br />
        {coops
          .map(({ coop, birds }) => `${coop.name} · ${formatNumber(birds)} birds`)
          .join(', ')}
      </span>
      <span className="alert-go" aria-hidden="true">
        ›
      </span>
    </button>
  ));
}
