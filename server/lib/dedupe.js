/**
 * Remove duplicate listings that surface across multiple sources (a role that
 * appears on both a company board and an aggregator, for example).
 *
 * Jobs are keyed by normalized company + title (+ city). When two entries
 * collide, we keep the more complete one — preferring a direct apply link and
 * known salary over an aggregator stub.
 */

function key(job) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const city = norm(job.location).split(" ").slice(0, 2).join(" ");
  return `${norm(job.company)}::${norm(job.title)}::${city}`;
}

function completeness(job) {
  let score = 0;
  if (job.url) score += 3;
  if (job.min != null || job.max != null) score += 2;
  if (job.skills?.length) score += 1;
  if (job.summary) score += 1;
  if (job.postedAt) score += 1;
  return score;
}

export function dedupe(jobs) {
  const best = new Map();
  for (const job of jobs) {
    if (!job?.title || !job?.company) continue;
    const k = key(job);
    const current = best.get(k);
    if (!current || completeness(job) > completeness(current)) {
      best.set(k, job);
    }
  }
  return [...best.values()];
}
