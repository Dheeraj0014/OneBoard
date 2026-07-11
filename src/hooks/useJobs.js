import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { fetchJobs } from "../services/jobs.js";
import { DEFAULT_COUNTRY } from "../data/countries.js";

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh the current query every 5 min

// Persisted result cache so a refresh can render the last-seen listings
// instantly (and keep them interactive) while fresh data loads in the
// background. Keyed by country + query, capped so it never bloats storage.
const STORAGE_KEY = "oneboard:jobs-cache-v1";
const MAX_ENTRIES = 12;

const cacheKey = (country, q) =>
  `${country}:${(q || "").trim().toLowerCase() || "__catalog__"}`;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/** The cached entry for a key, or null when absent / unreadable. */
function readEntry(key) {
  const entry = readCache()[key];
  return entry && Array.isArray(entry.jobs) ? entry : null;
}

/** Persist a result set, pruning the oldest entries past the cap. */
function writeEntry(key, jobs, meta) {
  try {
    const cache = readCache();
    cache[key] = { jobs, meta, savedAt: Date.now() };
    const keys = Object.keys(cache);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => (cache[a].savedAt || 0) - (cache[b].savedAt || 0))
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete cache[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded or storage unavailable — non-fatal */
  }
}

/**
 * Owns the live job list. Exposes the current jobs, loading/error state, the
 * source metadata, and `loadJobs(query)` which fetches + returns the results
 * (so callers can chain e.g. AI ranking). Results are seeded from and written
 * back to localStorage, so a refresh shows the last listings immediately and
 * revalidates in the background. The most recent query is also auto-refreshed
 * on an interval to keep listings current.
 */
export function useJobs(initialCountry = DEFAULT_COUNTRY) {
  // Seed synchronously from the persisted cache for the initial catalog view
  // so the first paint has real, clickable cards instead of a spinner.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seed = useMemo(() => readEntry(cacheKey(initialCountry, "")), []);

  const [jobs, setJobs] = useState(seed?.jobs ?? []);
  const [meta, setMeta] = useState(seed?.meta ?? null);
  // Only block with the full-page spinner when there's nothing cached to show.
  const [loading, setLoading] = useState(!seed);
  const [error, setError] = useState(null);

  const lastQuery = useRef("");
  const lastCountry = useRef(initialCountry);
  const abortRef = useRef(null);

  const loadJobs = useCallback(
    async (q = "", country = lastCountry.current, { background = false } = {}) => {
      lastQuery.current = q;
      lastCountry.current = country;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Seed from cache immediately so switching country / repeating a query
      // shows the last-seen results while the network request is in flight.
      const key = cacheKey(country, q);
      const cached = readEntry(key);
      if (cached) {
        setJobs(cached.jobs);
        setMeta(cached.meta);
      }

      // Keep the UI live during a background revalidate (or when we already
      // have cached cards on screen); only show the spinner on a cold load.
      const silent = background || Boolean(cached);
      if (!silent) setLoading(true);
      setError(null);
      try {
        const { jobs: list, meta: m } = await fetchJobs({ q, country, signal: controller.signal });
        setJobs(list);
        setMeta(m);
        writeEntry(key, list, m);
        return list;
      } catch (err) {
        if (err.name !== "AbortError" && !silent) {
          // Cold-load failure with nothing to fall back on — surface it.
          setError(err.message || "Failed to load jobs");
          setJobs([]);
        }
        return cached?.jobs ?? [];
      } finally {
        if (!controller.signal.aborted && !silent) setLoading(false);
      }
    },
    []
  );

  // Initial catalog load — revalidate in the background when we have a seed.
  useEffect(() => {
    loadJobs("", lastCountry.current, { background: Boolean(seed) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadJobs]);

  // Periodically refresh the current query in the background.
  useEffect(() => {
    const id = setInterval(
      () => loadJobs(lastQuery.current, lastCountry.current, { background: true }),
      REFRESH_MS
    );
    return () => clearInterval(id);
  }, [loadJobs]);

  return { jobs, meta, loading, error, loadJobs };
}
