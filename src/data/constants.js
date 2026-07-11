import { Globe, Layers, Building2 } from "lucide-react";

/**
 * Known job sources -> accent color. Live data can surface sources beyond this
 * list (any JSearch publisher, new boards…), so use {@link sourceColor} rather
 * than indexing this map directly.
 */
export const SOURCES = {
  Greenhouse: "#14b8a6",
  Lever: "#a855f7",
  SerpApi: "#22c55e",
  Adzuna: "#0ea5e9",
  LinkedIn: "#3b82f6",
  Indeed: "#4f46e5",
  Glassdoor: "#10b981",
  Wellfound: "#f43f5e",
  RemoteOK: "#f59e0b",
  WeWorkRemotely: "#06b6d4",
  Dice: "#ef4444",
  ZipRecruiter: "#16a34a",
  JSearch: "#8b5cf6",
  TheirStack: "#f97316",
};

/** Stable fallback color for an unknown source name (hashed to a hue). */
export function sourceColor(name = "") {
  if (SOURCES[name]) return SOURCES[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 65% 55%)`;
}

/** Workplace type -> display color, background and icon. */
export const REMOTE = {
  Remote: { c: "#34d399", bg: "rgba(52,211,153,.12)", icon: Globe },
  Hybrid: { c: "#f59e0b", bg: "rgba(245,158,11,.12)", icon: Layers },
  "On-site": { c: "#94a3b8", bg: "rgba(148,163,184,.14)", icon: Building2 },
};

export const LEVELS = ["Entry", "Mid", "Senior", "Lead"];
export const TYPES = ["Full-time", "Contract", "Part-time"];
export const REMOTES = ["Remote", "Hybrid", "On-site"];

export const LEVEL_EXP = {
  Entry: "0–2 years",
  Mid: "3–5 years",
  Senior: "5+ years",
  Lead: "8+ years",
};

export const EXAMPLES = [
  "Remote senior React role",
  "Product manager in fintech",
  "Entry-level data analyst, remote",
  "Rust systems engineer",
];
