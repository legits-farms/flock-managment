import { useEffect, useState } from 'react';
import { getMortalities, getVaccinations } from '../api.js';
import { formatNumber, mortalityLabel, photoCount } from '../flock.js';
import PhotoLink from './PhotoLink.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Latest mortality and vaccination records, newest first
export default function RecentRecords() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMortalities(), getVaccinations()])
      .then(([mortalities, vaccinations]) => {
        if (cancelled) return;
        const merged = [
          ...mortalities.map((r) => ({
            ...r,
            kind: mortalityLabel(r),
            detail: `${formatNumber(r.birds)} birds · ${r.reason}`,
            when: r.date ?? r.createdAt,
            photoUrl: `/mortalities/${r._id}/photo`,
          })),
          ...vaccinations.map((r) => ({
            ...r,
            kind: 'Vaccination',
            detail: `${r.vaccine} · ${formatNumber(r.birds)} birds`,
            when: r.date,
            photoUrl: `/vaccinations/${r._id}/photo`,
          })),
        ];
        merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecords(merged.slice(0, 8));
      })
      // The dashboard still works without this list
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (records.length === 0) return null;

  return (
    <section className="card">
      <h2 className="eyebrow">Recent Records</h2>
      <ul className="recent-list">
        {records.map((record) => (
          <li key={record._id}>
            <div>
              <strong>
                {record.kind} · {record.coopName}
              </strong>
              <small>
                {record.batch?.batchName ?? 'Deleted batch'} · {formatDate(record.when)}
                <br />
                {record.detail}
                {record.createdBy?.name && ` · By ${record.createdBy.name}`}
              </small>
            </div>
            <PhotoLink url={record.photoUrl} count={photoCount(record)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
