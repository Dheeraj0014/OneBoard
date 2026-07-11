/**
 * Resume-matching client. Mirrors services/ai.js: the Anthropic key lives on
 * the Prism server, never here. Every call throws on failure so the caller can
 * fall back to {@link localProfile} / {@link localMatch}, which keep the feature
 * usable with no API key configured — and for signed-out users, whom the server
 * turns away from the AI routes to avoid unauthenticated spend.
 */
import { withAuth } from "./authToken.js";

/** Read the { error } message out of a failed response, with a safe default. */
async function errorFrom(res, fallback) {
  const body = await res.json().catch(() => null);
  return new Error(body?.error || `${fallback} (${res.status})`);
}

/** Upload a PDF resume and get its plain text back. */
export async function parseResumePdf(file) {
  const body = new FormData();
  body.append("resume", file);
  const res = await fetch("/api/resume", { method: "POST", body });
  if (!res.ok) throw await errorFrom(res, "Could not read that PDF");
  const { text } = await res.json();
  return text;
}

/** Distil resume text + stated preferences into a structured profile. */
export async function buildProfile(resumeText, prefs) {
  const res = await fetch("/api/profile", {
    method: "POST",
    headers: await withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ resumeText, prefs }),
  });
  if (!res.ok) throw await errorFrom(res, "Could not read that resume");
  const { profile } = await res.json();
  return profile;
}

/** Score jobs against a profile. Returns { [jobId]: { score, reason } }. */
export async function matchJobs(profile, jobs) {
  const compact = jobs.map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location,
    remote: j.remote, min: j.min, max: j.max, type: j.type, level: j.level,
    skills: j.skills, summary: j.summary, description: j.description,
  }));
  const res = await fetch("/api/match", {
    method: "POST",
    headers: await withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ profile, jobs: compact }),
  });
  if (!res.ok) throw await errorFrom(res, "Resume matching unavailable");
  const { map } = await res.json();
  return map;
}

/* ------------------------------------------------------------------ *
 * Offline fallbacks — used when the server has no ANTHROPIC_API_KEY.
 * ------------------------------------------------------------------ */

const LEVELS = ["Entry", "Mid", "Senior", "Lead"];

/** Skill vocabulary for the offline resume reader — mirrors the server's list. */
const TECH_TERMS = [
  "React", "Vue", "Angular", "Svelte", "Next.js", "Node.js", "TypeScript",
  "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "Kotlin", "Swift",
  "C++", "C#", "Ruby", "Rails", "PHP", "Scala", "Elixir", "PostgreSQL",
  "MySQL", "MongoDB", "Redis", "Kafka", "GraphQL", "gRPC", "REST",
  "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure", "CI/CD",
  "Spark", "Airflow", "Snowflake", "Tableau", "PyTorch", "TensorFlow",
  "NLP", "LLM", "Tailwind", "CSS", "HTML", "Figma", "Jest", "Cypress",
  "SQL", "Django", "Flask", "FastAPI", "Spring", "Express", ".NET",
];

/** Whole-word-ish match that tolerates the +/#/. in names like C++ and Next.js. */
function mentions(haystack, term) {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+.#])${escaped}([^a-z0-9+.#]|$)`, "i").test(haystack);
}

/**
 * Read a resume with regex instead of a model. Crude next to the AI path — it
 * can only find skills it already knows the names of — but it means a user with
 * no API key still gets a real profile and real scores rather than a dead end.
 */
export function localProfile(resumeText, prefs = {}) {
  const hay = ` ${resumeText.toLowerCase()} `;
  const skills = TECH_TERMS.filter((t) => mentions(hay, t)).slice(0, 12);

  // "8 years", "8+ yrs" — take the largest such claim in the document.
  const years = Math.max(
    0,
    ...(resumeText.match(/(\d{1,2})\s*\+?\s*(?:years|yrs)/gi) || []).map((m) => parseInt(m, 10) || 0)
  );

  // Prefer an explicitly stated seniority; otherwise infer from years.
  const stated = LEVELS.find((l) => new RegExp(`\\b${l}\\b`, "i").test(resumeText));
  const level = stated || (years >= 8 ? "Lead" : years >= 5 ? "Senior" : years >= 3 ? "Mid" : "Entry");

  // First non-empty line is, overwhelmingly often, the name or the headline.
  const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = lines.find((l) => /engineer|developer|designer|manager|analyst|scientist|architect/i.test(l))
    ?.slice(0, 80) || prefs.roles || "";

  return {
    title,
    level,
    years: years || null,
    skills,
    domains: [],
    summary: skills.length ? `Works with ${skills.slice(0, 4).join(", ")}` : "",
    prefs,
    mode: "local",
  };
}

/**
 * Offline scoring: overlap between the profile's skills and the job's skills +
 * description, nudged by how well the job matches the stated preferences.
 */
export function localMatch(profile, jobs) {
  const wanted = new Set(
    [...(profile.skills || []), ...(profile.prefs?.skills || [])].map((s) => s.toLowerCase())
  );
  const map = {};

  jobs.forEach((j) => {
    const hay = `${j.title} ${(j.skills || []).join(" ")} ${j.summary || ""} ${j.description || ""}`.toLowerCase();
    const hits = [...wanted].filter((s) => mentions(hay, s));

    // Overlap is the bulk of the score; a full match tops out around 90.
    let score = 35 + Math.min(hits.length, 6) * 9;

    if (profile.level === j.level) score += 8;
    else if (Math.abs(LEVELS.indexOf(profile.level) - LEVELS.indexOf(j.level)) > 1) score -= 12;

    if (profile.prefs?.remote?.length) score += profile.prefs.remote.includes(j.remote) ? 6 : -8;
    if (profile.prefs?.level?.length) score += profile.prefs.level.includes(j.level) ? 5 : -5;
    if (profile.prefs?.minSalary && j.max != null) score += j.max >= profile.prefs.minSalary ? 5 : -6;

    const matched = hits.slice(0, 3).join(", ");
    map[j.id] = {
      score: Math.max(12, Math.min(96, Math.round(score))),
      reason: matched
        ? `matches your ${matched}`
        : `little overlap with your ${(profile.skills || []).slice(0, 2).join(", ") || "profile"}`,
    };
  });

  return map;
}
