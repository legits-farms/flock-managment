// Loading / error placeholder shared by the tabs that read the batch list.
// Returns null once the data is ready.
export default function LoadStatus({ loading, error, onRetry }) {
  if (loading) return <p className="status">Loading batches…</p>;

  if (error) {
    return (
      <div className="status">
        <p className="error" role="alert">
          {error}
        </p>
        <button type="button" className="secondary" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  return null;
}
