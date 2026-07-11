import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import JobCard from "./JobCard.jsx";
import EmptyState from "./EmptyState.jsx";
import Pagination from "./Pagination.jsx";

const PER_PAGE = 15;

/** Renders the results grid (paginated), plus loading / error / empty states. */
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
  const [page, setPage] = useState(1);

  // Back to the first page whenever the result set changes (new search,
  // filter, sort or view toggle).
  useEffect(() => {
    setPage(1);
  }, [results]);

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

  const pageCount = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PER_PAGE;
  const pageJobs = results.slice(start, start + PER_PAGE);

  const goto = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="grid">
        {results.length === 0 ? (
          <EmptyState view={view} activeFilters={activeFilters} onReset={onReset} />
        ) : (
          pageJobs.map((job, i) => (
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

      {results.length > PER_PAGE && (
        <>
          <div className="pager-info">
            Showing {start + 1}–{start + pageJobs.length} of {results.length}
          </div>
          <Pagination page={safePage} pageCount={pageCount} onPage={goto} />
        </>
      )}
    </>
  );
}
