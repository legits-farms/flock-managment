import { useEffect, useState } from 'react';
import { fetchPhoto } from '../api.js';
import { formatNumber } from '../flock.js';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Everything saved with one vaccination or mortality record.
// `kind` is 'vaccinations' or 'mortalities', matching the API path.
export default function RecordDetail({ kind, record, onBack, onOpenBatch }) {
  const [photo, setPhoto] = useState('');
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url = '';
    fetchPhoto(`/${kind}/${record._id}/photo`)
      .then((objectUrl) => {
        url = objectUrl;
        if (cancelled) URL.revokeObjectURL(url);
        else setPhoto(url);
      })
      .catch(() => {
        if (!cancelled) setPhotoFailed(true);
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [kind, record._id]);

  const vaccination = kind === 'vaccinations';
  const { location } = record;

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All records
      </button>

      <section className="card">
        <h2 className="eyebrow">{vaccination ? 'Vaccination' : 'Mortality'}</h2>
        <div className="batch-head manage-head">
          <h3>{vaccination ? record.vaccine : `${formatNumber(record.birds)} birds`}</h3>
          <span className="badge">{record.coopName}</span>
        </div>

        <dl className="batch-details detail">
          <div>
            <dt>Batch</dt>
            <dd>
              {record.batch ? (
                <button
                  type="button"
                  className="link inline"
                  onClick={() => onOpenBatch(record.batch._id)}
                >
                  {record.batch.batchName}
                </button>
              ) : (
                'Deleted batch'
              )}
            </dd>
          </div>
          <div>
            <dt>Coop</dt>
            <dd>{record.coopName}</dd>
          </div>
          {vaccination ? (
            <>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(record.date)}</dd>
              </div>
              <div>
                <dt>Birds</dt>
                <dd>{formatNumber(record.birds)} administered</dd>
              </div>
              {record.remarks && (
                <div>
                  <dt>Remarks</dt>
                  <dd>{record.remarks}</dd>
                </div>
              )}
            </>
          ) : (
            <div>
              <dt>Reason</dt>
              <dd>{record.reason}</dd>
            </div>
          )}
          <div>
            <dt>Entered By</dt>
            <dd>{record.createdBy?.name ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Entered On</dt>
            <dd>{formatDateTime(record.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="eyebrow">Photo</h2>
        <div className="photo detail-photo">
          {photo && <img src={photo} alt="Record, with time and location stamp" />}
          {!photo && (
            <p className="empty">{photoFailed ? 'Could not load the photo.' : 'Loading photo…'}</p>
          )}
        </div>

        <dl className="batch-details detail">
          <div>
            <dt>Taken On</dt>
            <dd>{formatDateTime(record.capturedAt)}</dd>
          </div>
          {location && (
            <div>
              <dt>Location</dt>
              <dd>
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                {typeof location.accuracy === 'number' && ` (±${Math.round(location.accuracy)} m)`}
                <small>
                  <a
                    href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps
                  </a>
                </small>
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
