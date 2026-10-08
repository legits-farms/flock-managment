import { useEffect, useState } from 'react';
import { getOptions } from './api.js';
import { VACCINATION_SCHEDULE } from './flock.js';

// The vaccination schedule birds go through: the standard one, then the
// vaccines added by hand once they have loaded. [{ vaccine, when }]
export default function useVaccineSchedule() {
  const [added, setAdded] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getOptions()
      .then((options) => {
        if (!cancelled) setAdded(options.vaccines ?? []);
      })
      // The standard schedule is still there to go by
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return [...VACCINATION_SCHEDULE, ...added];
}
