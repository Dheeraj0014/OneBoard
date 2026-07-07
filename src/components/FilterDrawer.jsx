import { X, RotateCcw } from "lucide-react";
import Filters from "./Filters.jsx";

/** Mobile slide-in drawer wrapping the shared {@link Filters}. */
export default function FilterDrawer({ f, setF, counts, sources, allSkills, activeFilters, onReset, onClose }) {
  return (
    <div className="drawer-wrap">
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <strong style={{ fontSize: 15 }}>Filters</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close filters">
            <X size={18} />
          </button>
        </div>
        {activeFilters > 0 && (
          <button
            className="btn"
            style={{ width: "100%", justifyContent: "center", marginBottom: 18 }}
            onClick={onReset}
          >
            <RotateCcw size={14} />
            Reset · {activeFilters}
          </button>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Filters f={f} set={setF} counts={counts} sources={sources} allSkills={allSkills} />
        </div>
      </div>
    </div>
  );
}
