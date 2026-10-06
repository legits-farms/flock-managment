import { useEffect, useState } from 'react';
import { fetchPhoto } from '../api.js';

// "Photo" button that loads a record's photo (the endpoint needs the login
// token, so a plain link would not work) and shows it full screen.
export default function PhotoLink({ url }) {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Release the image when it is closed or the row goes away
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  async function open() {
    setLoading(true);
    setFailed(false);
    try {
      setSrc(await fetchPhoto(url));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="photo-link" disabled={loading} onClick={open}>
        {loading ? '…' : failed ? 'Retry' : 'Photo'}
      </button>

      {src && (
        <div className="camera" role="dialog" aria-modal="true" aria-label="Record photo">
          <img className="viewer-img" src={src} alt="Record, with time and location stamp" />
          <div className="camera-panel">
            <button type="button" className="primary" onClick={() => setSrc('')}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
