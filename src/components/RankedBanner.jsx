import { Sparkles, X } from "lucide-react";

/** Banner shown while an AI ranking is active, with a clear action. */
export default function RankedBanner({ ai, onClear }) {
  return (
    <div className="ranked">
      <div className="ic">
        <Sparkles size={17} />
      </div>
      <div className="txt">
        <div className="l1">Ranked for you{ai.mode === "local" ? " · offline ranking" : ""}</div>
        <div className="l2">“{ai.q}”</div>
      </div>
      <button
        className="icon-btn"
        onClick={onClear}
        aria-label="Clear ranking"
        style={{ flex: "none", width: 34, height: 34 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
