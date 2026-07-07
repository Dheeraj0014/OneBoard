import { REMOTE } from "../data/constants.js";

/** Colored pill for a workplace type (Remote / Hybrid / On-site). */
export default function RemoteTag({ v }) {
  const m = REMOTE[v];
  const Icon = m.icon;
  return (
    <span className="rtag" style={{ color: m.c, background: m.bg }}>
      <Icon size={11} strokeWidth={2.4} />
      {v}
    </span>
  );
}
