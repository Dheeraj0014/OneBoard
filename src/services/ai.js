/**
 * Client-side AI helpers. The Anthropic key is NOT here — these call the Prism
 * Express server (server/ai.js), which holds the key and talks to Anthropic.
 * On any failure the caller falls back to {@link localRank} or a local template.
 */

/**
 * Offline heuristic ranking used as a fallback when the AI call fails.
 * Returns a map of { [jobId]: { score, reason } }.
 */
export function localRank(q, jobs) {
  const terms = q.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean);
  const map = {};
  jobs.forEach((j) => {
    const hay = `${j.title} ${j.company} ${(j.skills || []).join(" ")} ${j.remote} ${j.level} ${j.type} ${j.location}`.toLowerCase();
    const hits = terms.filter((t) => hay.includes(t));
    let s = Math.min(97, 44 + hits.length * 11);
    if (/remote/.test(q.toLowerCase()) && j.remote === "Remote") s += 7;
    const num = (q.match(/(\d{2,3})\s*k?/g) || []).map((x) => parseInt(x));
    if (num.length && j.min != null && j.min >= Math.max(...num)) s += 5;
    map[j.id] = {
      score: Math.max(28, Math.min(98, s)),
      reason: hits.length ? `matches ${hits.slice(0, 3).join(", ")}` : "partial fit on your criteria",
    };
  });
  return map;
}

/**
 * Rank every job against a natural-language request via the server AI route.
 * Returns a map of { [jobId]: { score, reason } }. Throws on failure so the
 * caller can fall back to {@link localRank}.
 */
export async function rankJobs(text, jobs) {
  // Send only the fields the ranker needs; the server caps the prompt payload.
  const compact = jobs.map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location,
    remote: j.remote, salary: [j.min, j.max], type: j.type, level: j.level, skills: j.skills,
  }));
  const res = await fetch("/api/rank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: text, jobs: compact }),
  });
  if (!res.ok) throw new Error(`AI ranking unavailable (${res.status})`);
  const { map } = await res.json();
  return map;
}

/**
 * Draft a short outreach intro for a job via the server AI route. Throws on
 * failure so the caller can substitute a local template.
 */
export async function draftIntro(job) {
  const res = await fetch("/api/intro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job }),
  });
  if (!res.ok) throw new Error(`AI intro unavailable (${res.status})`);
  const { intro } = await res.json();
  return intro;
}
