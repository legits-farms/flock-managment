import { useEffect, useState } from 'react';
import { getMortalities, getShifts, getVaccinations } from './api.js';

// Loads the mortality and vaccination records of one batch, or of several
// when given an array of batch ids.
// `records` is { mortalities, vaccinations, shifts }, or null while loading.
// Changing `reloadKey` fetches them again, e.g. after a record was added.
export default function useBatchRecords(batchIds, reloadKey = 0) {
  const key = [].concat(batchIds).join(',');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // No batches means no records (an empty id would ask for every batch's)
    if (!key) {
      setRecords({ mortalities: [], vaccinations: [], shifts: [] });
      return;
    }
    const ids = key.split(',');
    Promise.all([
      Promise.all(ids.map((id) => getMortalities(id))),
      Promise.all(ids.map((id) => getVaccinations(id))),
      Promise.all(ids.map((id) => getShifts(id))),
    ])
      .then(([mortalities, vaccinations, shifts]) => {
        if (cancelled) return;
        const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
        setRecords({
          mortalities: mortalities.flat().sort(newestFirst),
          vaccinations: vaccinations.flat().sort(newestFirst),
          shifts: shifts.flat().sort(newestFirst),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [key, reloadKey]);

  return { records, error };
}
