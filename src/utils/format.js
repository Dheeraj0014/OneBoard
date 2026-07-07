/**
 * Format a salary range from live data (either bound may be missing):
 *   fmtSal(150, 190) -> "$150k–$190k"
 *   fmtSal(150, null) -> "$150k+"
 *   fmtSal(null, 190) -> "up to $190k"
 */
export const fmtSal = (a, b) => {
  if (a != null && b != null) return `$${a}k–$${b}k`;
  if (a != null) return `$${a}k+`;
  if (b != null) return `up to $${b}k`;
  return "";
};

/** Human-readable "posted N ago" label. Null-safe for unknown dates. */
export const ago = (d) => {
  if (d == null) return "recently";
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
};

/** First two initials of a name, e.g. initials("Cash App") -> "CA". */
export const initials = (n) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
