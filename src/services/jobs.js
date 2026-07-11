/**
 * Fetch live, de-duplicated job listings from the Prism API (server/).
 * `country` is a two-letter ISO region code (defaults server-side to India).
 * Returns { jobs, meta }.
 */
export async function fetchJobs({ q = "", country = "", signal } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (country) params.set("country", country);
  const res = await fetch(`/api/jobs?${params}`, { signal });
  if (!res.ok) {
    throw new Error(`Job feed unavailable (${res.status})`);
  }
  return res.json();
}
