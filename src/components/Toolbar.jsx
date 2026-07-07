import { ChevronDown } from "lucide-react";

/** Results header: count summary, all/saved segmented control and sort select. */
export default function Toolbar({ view, setView, count, ai, sort, setSort, savedCount, boardCount }) {
  return (
    <div className="toolbar">
      <div className="tcount">
        {view === "saved" ? (
          <>
            Showing your <b>{count}</b> saved {count === 1 ? "role" : "roles"}
          </>
        ) : (
          <>
            <b>{count}</b> {count === 1 ? "role" : "roles"}
            {ai ? " ranked" : ""}
            {boardCount ? ` across ${boardCount} ${boardCount === 1 ? "source" : "sources"}` : ""}
          </>
        )}
      </div>
      <div className="tright">
        <div className="seg">
          <button className={view === "all" ? "on" : ""} onClick={() => setView("all")}>
            All
          </button>
          <button className={view === "saved" ? "on" : ""} onClick={() => setView("saved")}>
            Saved{savedCount ? ` · ${savedCount}` : ""}
          </button>
        </div>
        <div className="select">
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            {ai && <option value="relevance">Best match</option>}
            <option value="newest">Newest</option>
            <option value="salary">Salary</option>
          </select>
          <ChevronDown size={15} className="chev" />
        </div>
      </div>
    </div>
  );
}
