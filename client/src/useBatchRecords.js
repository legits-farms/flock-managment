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
        setRecords({
          mortalities: mortalities.flat().sort(newestFirst),
          vaccinations: vaccinations.flat().sort(newestFirst),
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
