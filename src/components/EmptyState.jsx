import { Heart, Search, RotateCcw } from "lucide-react";

/** Empty-results placeholder for both the "all" and "saved" views. */
export default function EmptyState({ view, activeFilters, onReset }) {
  const isSaved = view === "saved";
  return (
    <div className="empty">
      <div className="ei">{isSaved ? <Heart size={24} /> : <Search size={24} />}</div>
      <h3>{isSaved ? "Nothing saved yet" : "No roles match these filters"}</h3>
      <p>
        {isSaved
          ? "Tap the heart on any role to keep it here for later."
          : "Loosen a filter or two to widen the search."}
      </p>
      {!isSaved && activeFilters > 0 && (
        <button className="btn" style={{ marginTop: 16 }} onClick={onReset}>
          <RotateCcw size={14} />
          Reset filters
        </button>
      )}
    </div>
  );
}
