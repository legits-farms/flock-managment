import { useEffect, useRef, useState } from 'react';

const MAX_SIDE = 1280;
// Matches MAX_PHOTOS in server/src/evidence.js
export const MAX_PHOTOS = 5;

// What a record form sends for its photos: the first as { photo, location,
// capturedAt } and any further ones, in the same shape, in `morePhotos`
export const evidencePayload = (photos) =>
  photos.length === 0 ? {} : { ...photos[0], morePhotos: photos.slice(1) };

const formatStamp = (date) =>
  date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const formatPosition = ({ lat, lng, accuracy }) =>
  `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)} (±${Math.round(accuracy)} m)`;

// Draws the current video frame and burns the time and GPS position into it
function drawStampedPhoto(video, location, takenAt) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);

  const lines = [formatStamp(takenAt), formatPosition(location)];
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 26));
  const lineHeight = fontSize * 1.4;
  const bandHeight = lineHeight * lines.length + fontSize * 0.8;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, height - bandHeight, width, bandHeight);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    const y = height - bandHeight + fontSize * 0.4 + i * lineHeight;
    ctx.fillText(line, fontSize * 0.6, y, width - fontSize * 1.2);
  });

  return canvas.toDataURL('image/jpeg', 0.8);
}

// Live-camera-only photo field, for up to `max` photos. There is
// deliberately no file input, so a photo cannot be picked from the gallery.
// `value` is a list of { photo, location, capturedAt }, in the order taken.
export default function PhotoCapture({ value, onChange, max = MAX_PHOTOS }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setReady(false);
    setLocation(null);
    setError('');

    if (!navigator.mediaDevices?.getUserMedia || !navigator.geolocation) {
      setError('The camera and location need a secure (https) connection in a supported browser.');
      return;
    }

    let cancelled = false;
    let stream;
    let hasFix = false;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        videoRef.current.srcObject = s;
      })
      .catch(() => {
        if (!cancelled) setError('Could not open the camera. Allow camera access and try again.');
      });

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        hasFix = true;
        setLocation({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
      },
      (err) => {
        if (hasFix) return;
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is needed to geotag the photo. Allow location and try again.'
            : 'Could not get your location. Turn on GPS and try again.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      navigator.geolocation.clearWatch(watchId);
    };
  }, [open]);

  function capture() {
    const takenAt = new Date();
    onChange([
      ...value,
      {
        photo: drawStampedPhoto(videoRef.current, location, takenAt),
        location,
        capturedAt: takenAt.toISOString(),
      },
    ]);
    setOpen(false);
  }

  return (
    <div className="photo">
      {value.length > 0 && (
        <ul className="photo-grid">
          {value.map((shot, i) => (
            <li key={shot.capturedAt}>
              <img src={shot.photo} alt={`Photo ${i + 1}, with time and location stamp`} />
              <button
                type="button"
                className="photo-remove"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(value.filter((other) => other !== shot))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length < max ? (
        <button type="button" className="secondary" onClick={() => setOpen(true)}>
          {value.length === 0 ? 'Take Live Photo' : '＋ Add Another Photo'}
        </button>
      ) : (
        <p className="empty">Up to {max} photos here.</p>
      )}

      {open && (
        <div className="camera" role="dialog" aria-modal="true" aria-label="Take a live photo">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
          />

          <div className="camera-panel">
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : (
              <p className="camera-status">
                {location ? `Location locked · ${formatPosition(location)}` : 'Getting location…'}
              </p>
            )}

            <div className="camera-actions">
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!ready || !location}
                onClick={capture}
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
