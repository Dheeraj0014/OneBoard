/**
 * Facet helpers derived from the *live* job list (there is no static catalog
 * anymore, so filter options must be computed from whatever is loaded).
 */

/** Unique, sorted skills across all jobs. */
export function deriveSkills(jobs) {
  return [...new Set(jobs.flatMap((j) => j.skills || []))].sort();
}

/** Unique, sorted source names across all jobs. */
export function deriveSources(jobs) {
  return [...new Set(jobs.map((j) => j.source).filter(Boolean))].sort();
}
