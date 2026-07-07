import { config } from "./config.js";
import { createCache } from "./lib/cache.js";
import { dedupe } from "./lib/dedupe.js";
import { fetchSerpApi } from "./sources/serpapi.js";
import { fetchAdzuna } from "./sources/adzuna.js";
import { fetchJSearch } from "./sources/jsearch.js";
import { fetchTheirStack } from "./sources/theirstack.js";

const cache = createCache(config.cacheTtlMs);

/** Simple full-text match used to filter company-board jobs by a query. */
function matchesQuery(job, terms) {
  if (!terms.length) return true;
  const hay = `${job.title} ${job.company} ${job.location} ${job.skills.join(" ")} ${job.summary}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

async function collect(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Every source searches upstream by query and returns unified job shapes.
  const settled = await Promise.allSettled([
    fetchSerpApi(query),
    fetchAdzuna(query),
    fetchJSearch(query),
    fetchTheirStack(query),
  ]);

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // Only surface active listings that have a real apply link.
  const active = all.filter((j) => j.url && j.title && j.company);

  // Belt-and-braces: keep results that match every query term locally too.
  const filtered = active.filter((j) => matchesQuery(j, terms));

  const unique = dedupe(filtered);

  // Newest first; unknown dates sort last.
  unique.sort((a, b) => (a.posted ?? Infinity) - (b.posted ?? Infinity));

  return unique;
}

/**
 * Aggregate live jobs across every configured source, de-duplicated and
 * cached. `query` is optional; empty means "the current board catalog".
 */
export async function getJobs(query = "") {
  const key = query.trim().toLowerCase() || "__catalog__";
  // Don't cache empty result sets — an empty list almost always means a
  // transient upstream failure, and caching it would stick for the full TTL.
  const jobs = await cache.get(key, () => collect(query.trim()), (v) => v.length > 0);
  return {
    jobs,
    meta: {
      count: jobs.length,
      query: query.trim(),
      sources: [...new Set(jobs.map((j) => j.source))],
      enabled: {
        serpapi: config.serpapi.enabled,
        adzuna: config.adzuna.enabled,
        jsearch: config.jsearch.enabled,
        theirstack: config.theirstack.enabled,
      },
      fetchedAt: new Date().toISOString(),
    },
  };
}
