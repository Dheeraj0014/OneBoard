import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import JobCard from "./JobCard.jsx";
import EmptyState from "./EmptyState.jsx";

/** Renders the results grid, plus loading / error / empty states. */
export default function JobList({
  results,
  saved,
  onSave,
  onOpen,
  ai,
  view,
  activeFilters,
  onReset,
  loading,
  error,
  onRetry,
}) {
  if (loading && results.length === 0) {
    return (
      <div className="empty">
        <div className="ei">
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <h3>Fetching live openings…</h3>
        <p>Pulling active roles from every connected source.</p>
      </div>
    );
  }

  if (error && results.length === 0) {
    return (
      <div className="empty">
        <div className="ei">
          <AlertTriangle size={24} />
        </div>
        <h3>Couldn't reach the job feed</h3>
        <p>{error}. Make sure the API server is running (npm run dev).</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={onRetry}>
          <RotateCcw size={14} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid">
      {results.length === 0 ? (
        <EmptyState view={view} activeFilters={activeFilters} onReset={onReset} />
      ) : (
        results.map((job, i) => (
          <JobCard
            key={job.id}
            job={job}
            i={i}
            saved={saved.has(job.id)}
            onSave={onSave}
            onOpen={onOpen}
            rank={ai ? ai.map[job.id] : null}
          />
        ))
      )}
    </div>
  );
}
