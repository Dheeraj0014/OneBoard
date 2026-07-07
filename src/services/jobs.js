/**
 * Fetch live, de-duplicated job listings from the Prism API (server/).
 * Returns { jobs, meta }.
 */
export async function fetchJobs({ q = "", signal } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const res = await fetch(`/api/jobs?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Job feed unavailable (${res.status})`);
  }
  return res.json();
}
