import { Check } from "lucide-react";

/** A single checkbox-style filter option row. */
export default function FilterOption({ active, onToggle, dot, label, count }) {
  return (
    <div
      className={`opt${active ? " on" : ""}`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={active}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className="box">{active && <Check size={12} strokeWidth={3.4} color="#fff" />}</span>
      {dot && <span className="sdot" style={{ background: dot }} />}
      <span>{label}</span>
      {count != null && <span className="n">{count}</span>}
    </div>
  );
}
