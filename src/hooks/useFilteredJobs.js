import { useMemo } from "react";

/**
 * Derives the live filter counts and the final filtered + sorted job list from
 * the current (live) jobs array.
 *
 * @param {object}  params
 * @param {object[]}      params.jobs   live job listings
 * @param {"all"|"saved"} params.view
 * @param {Set<string>}   params.saved
 * @param {object}        params.f      filter state
 * @param {object|null}   params.ai     ranking state
 * @param {string}        params.sort   "relevance" | "salary" | "newest"
 */
export function useFilteredJobs({ jobs, view, saved, f, ai, sort }) {
  // Counts respect the current view (all vs saved) but not the other filters.
  const counts = useMemo(() => {
    const base = view === "saved" ? jobs.filter((j) => saved.has(j.id)) : jobs;
    const c = { source: {}, remote: {}, level: {}, type: {} };
    base.forEach((j) => {
      c.source[j.source] = (c.source[j.source] || 0) + 1;
      c.remote[j.remote] = (c.remote[j.remote] || 0) + 1;
      c.level[j.level] = (c.level[j.level] || 0) + 1;
      c.type[j.type] = (c.type[j.type] || 0) + 1;
    });
    return c;
  }, [jobs, view, saved]);

  const results = useMemo(() => {
    let list = view === "saved" ? jobs.filter((j) => saved.has(j.id)) : [...jobs];
    if (f.sources.size) list = list.filter((j) => f.sources.has(j.source));
    if (f.remote.size) list = list.filter((j) => f.remote.has(j.remote));
    if (f.level.size) list = list.filter((j) => f.level.has(j.level));
    if (f.type.size) list = list.filter((j) => f.type.has(j.type));
    if (f.skills.size) list = list.filter((j) => (j.skills || []).some((s) => f.skills.has(s)));
    if (f.salaryMin) list = list.filter((j) => j.max != null && j.max >= f.salaryMin);

    if (ai && sort === "relevance") {
      list.sort((a, b) => (ai.map[b.id]?.score || 0) - (ai.map[a.id]?.score || 0));
    } else if (sort === "salary") {
      list.sort((a, b) => (b.max ?? -1) - (a.max ?? -1));
    } else {
      list.sort((a, b) => (a.posted ?? Infinity) - (b.posted ?? Infinity));
    }
    return list;
  }, [jobs, view, saved, f, ai, sort]);

  return { counts, results };
}
