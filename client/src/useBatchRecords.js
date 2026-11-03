import { useEffect, useState } from 'react';
import {
  getFeeds,
  getMortalities,
  getSales,
  getShifts,
  getVaccinations,
  getWeights,
} from './api.js';

// Loads every kind of record of one batch, or of several when given an array
// of batch ids.
// `records` is { mortalities, vaccinations, shifts, feeds, weights, sales }, or
// null while loading. A sale can hold birds of other batches too.
// Changing `reloadKey` fetches them again, e.g. after a record was added.
export default function useBatchRecords(batchIds, reloadKey = 0) {
  const key = [].concat(batchIds).join(',');
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // No batches means no records (an empty id would ask for every batch's)
    if (!key) {
      setRecords({
        mortalities: [],
        vaccinations: [],
        shifts: [],
        feeds: [],
        weights: [],
        sales: [],
      });
      return;
    }
    const ids = key.split(',');
    Promise.all([
      Promise.all(ids.map((id) => getMortalities(id))),
      Promise.all(ids.map((id) => getVaccinations(id))),
      Promise.all(ids.map((id) => getShifts(id))),
      Promise.all(ids.map((id) => getFeeds(id))),
      Promise.all(ids.map((id) => getWeights(id))),
      Promise.all(ids.map((id) => getSales(id))),
    ])
      .then(([mortalities, vaccinations, shifts, feeds, weights, sales]) => {
        if (cancelled) return;
        const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
        // Vaccinations go by the day they were given, so ones entered afterwards fall into place
        const latestGivenFirst = (a, b) => new Date(b.date) - new Date(a.date) || newestFirst(a, b);
        setRecords({
          mortalities: mortalities.flat().sort(newestFirst),
          vaccinations: vaccinations.flat().sort(latestGivenFirst),
          shifts: shifts.flat().sort(newestFirst),
          feeds: feeds.flat().sort(newestFirst),
          weights: weights.flat().sort(newestFirst),
          // A sale out of two of these batches comes back once per batch
          sales: [...new Map(sales.flat().map((sale) => [sale._id, sale])).values()].sort(
            newestFirst,
          ),
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
