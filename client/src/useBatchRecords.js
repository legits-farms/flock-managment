import { useEffect, useState } from 'react';
import { getMortalities, getVaccinations } from './api.js';

// Loads the mortality and vaccination records of one batch, or of several
// when given an array of batch ids.
// `records` is { mortalities, vaccinations }, or null while loading.
export default function useBatchRecords(batchIds) {
  const key = [].concat(batchIds).join(',');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const ids = key.split(',');
    Promise.all([
      Promise.all(ids.map((id) => getMortalities(id))),
      Promise.all(ids.map((id) => getVaccinations(id))),
    ])
      .then(([mortalities, vaccinations]) => {
        if (cancelled) return;
        const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
        setRecords({
          mortalities: mortalities.flat().sort(newestFirst),
          vaccinations: vaccinations.flat().sort(newestFirst),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { records, error };
}
