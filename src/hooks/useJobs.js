import { useState, useEffect, useRef, useCallback } from "react";
import { fetchJobs } from "../services/jobs.js";

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh the current query every 5 min

/**
 * Owns the live job list. Exposes the current jobs, loading/error state, the
 * source metadata, and `loadJobs(query)` which fetches + returns the results
 * (so callers can chain e.g. AI ranking). The most recent query is
 * auto-refreshed on an interval to keep listings current.
 */
export function useJobs() {
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lastQuery = useRef("");
  const abortRef = useRef(null);

  const loadJobs = useCallback(async (q = "") => {
    lastQuery.current = q;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const { jobs: list, meta: m } = await fetchJobs({ q, signal: controller.signal });
      setJobs(list);
      setMeta(m);
      return list;
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to load jobs");
        setJobs([]);
      }
      return [];
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Initial catalog load.
  useEffect(() => {
    loadJobs("");
  }, [loadJobs]);

  // Periodically refresh the current query in the background.
  useEffect(() => {
    const id = setInterval(() => loadJobs(lastQuery.current), REFRESH_MS);
    return () => clearInterval(id);
  }, [loadJobs]);

  return { jobs, meta, loading, error, loadJobs };
}
