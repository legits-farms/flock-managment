import { useEffect, useState } from 'react';
import { fetchPhoto } from '../api.js';

// "Photo" button that loads a record's photos (the endpoint needs the login
// token, so a plain link would not work) and shows them full screen, one at a
// time. `url` is the record's photo endpoint and `count` how many photos it has.
export default function PhotoLink({ url, count = 1 }) {
  // Index of the photo being shown, or null while the viewer is closed
  const [index, setIndex] = useState(null);
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // Release the image when it is replaced, closed or the row goes away
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  async function show(next) {
    setLoading(true);
    setFailed(false);
    try {
      setSrc(await fetchPhoto(next === 0 ? url : `${url}/${next}`));
      setIndex(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setIndex(null);
    setSrc('');
  }

  return (
    <>
      <button type="button" className="photo-link" disabled={loading} onClick={() => show(0)}>
        {loading && index === null
          ? '…'
          : failed && index === null
            ? 'Retry'
            : count > 1
              ? `Photos (${count})`
              : 'Photo'}
      </button>

      {index !== null && (
        <div className="camera" role="dialog" aria-modal="true" aria-label="Record photo">
          <img className="viewer-img" src={src} alt="Record, with time and location stamp" />
          <div className="camera-panel">
            {count > 1 && (
              <>
                <p className="camera-status">
                  {failed ? 'Could not load that photo.' : `Photo ${index + 1} of ${count}`}
                </p>
                <div className="camera-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={loading || index === 0}
                    onClick={() => show(index - 1)}
                  >
                    ‹ Previous
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={loading || index === count - 1}
                    onClick={() => show(index + 1)}
                  >
                    Next ›
                  </button>
                </div>
              </>
            )}
            <button type="button" className="primary" onClick={close}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
