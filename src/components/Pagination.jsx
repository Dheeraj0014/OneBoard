import { ChevronLeft, ChevronRight } from "lucide-react";

/** Condensed page list: first, last, current ±1, with ellipses for the gaps. */
function pageRange(page, count) {
  const range = [];
  for (let i = 1; i <= count; i++) {
    if (i === 1 || i === count || (i >= page - 1 && i <= page + 1)) range.push(i);
  }
  const out = [];
  let prev;
  for (const i of range) {
    if (prev) {
      if (i - prev === 2) out.push(prev + 1);
      else if (i - prev > 2) out.push("…");
    }
    out.push(i);
    prev = i;
  }
  return out;
}

/** Page controls for the results grid. Hidden when there's only one page. */
export default function Pagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pager" aria-label="Results pages">
      <button
        className="pager-btn"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>

      {pageRange(page, pageCount).map((p, idx) =>
        p === "…" ? (
          <span key={`gap-${idx}`} className="pager-ellipsis">
            …
          </span>
        ) : (
          <button
            key={p}
            className={`pager-btn${p === page ? " on" : ""}`}
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pager-btn"
        disabled={page === pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
