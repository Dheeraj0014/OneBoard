/**
 * Helpers that turn messy, source-specific job payloads into the single
 * unified shape the frontend understands:
 *
 *   { id, title, company, location, remote, min, max, type, level,
 *     source, url, postedAt, posted, skills, summary, description, resp }
 *
 * Real listings are incomplete, so every field degrades gracefully:
 * unknown salary -> null, unknown skills -> [], unknown date -> null.
 */

const TECH_TERMS = [
  "React", "Vue", "Angular", "Svelte", "Next.js", "Node.js", "TypeScript",
  "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "Kotlin", "Swift",
  "SwiftUI", "C++", "C#", "Ruby", "Rails", "PHP", "Scala", "Elixir",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "GraphQL", "gRPC",
  "REST", "Kubernetes", "Docker", "Terraform", "AWS", "GCP", "Azure",
  "CI/CD", "Spark", "Airflow", "dbt", "Snowflake", "Looker", "Tableau",
  "PyTorch", "TensorFlow", "CUDA", "Machine Learning", "ML", "NLP", "LLM",
  "Tailwind", "CSS", "HTML", "Figma", "Storybook", "Jest", "Cypress",
  "SQL", "Django", "Flask", "FastAPI", "Spring", "Express", ".NET",
];

/** Strip HTML tags & decode the few entities boards commonly emit. */
export function stripHtml(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function summarize(text = "", max = 220) {
  const clean = stripHtml(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/**
 * A longer description excerpt kept for resume matching, where the AI needs the
 * actual requirements — not the 220-char teaser `summary` used on the cards.
 * Capped because it ships to the browser and back up to the matcher: ~900 chars
 * covers the requirements section of a typical posting without blowing up the
 * request payload or the prompt token budget.
 */
export function describe(text = "") {
  return summarize(text, 900);
}

/** Whole-number thousands, e.g. 152000 -> 152. Null-safe. */
export function toK(v) {
  const n = Number(v);
  if (!v || Number.isNaN(n) || n <= 0) return null;
  return Math.round(n / 1000);
}

/** Whole days since a date, or null if unparseable. */
export function daysAgo(input) {
  if (!input) return null;
  const d = typeof input === "number" ? new Date(input) : new Date(String(input));
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

export function toISO(input) {
  if (!input) return null;
  const d = typeof input === "number" ? new Date(input) : new Date(String(input));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function inferLevel(title = "") {
  const t = title.toLowerCase();
  if (/(intern|internship|junior|\bjr\b|entry|new grad|graduate|associate)/.test(t)) return "Entry";
  if (/(principal|staff|lead|head of|director|\bvp\b|chief|manager)/.test(t)) return "Lead";
  if (/(senior|\bsr\b)/.test(t)) return "Senior";
  return "Mid";
}

export function inferType(...hints) {
  const t = hints.filter(Boolean).join(" ").toLowerCase();
  if (/contract|contractor|freelance|temporary/.test(t)) return "Contract";
  if (/part[\s-]?time/.test(t)) return "Part-time";
  return "Full-time";
}

export function inferRemote({ flag, location = "", text = "", workplaceType = "" } = {}) {
  if (flag === true) return "Remote";
  const s = `${workplaceType} ${location} ${text}`.toLowerCase();
  if (/hybrid/.test(s)) return "Hybrid";
  if (/remote|anywhere|distributed|work from home|wfh/.test(s)) return "Remote";
  return "On-site";
}

/** Best-effort skill extraction from free text + any explicit tags. */
export function extractSkills(text = "", tags = []) {
  const found = new Set(tags.filter(Boolean).map((t) => String(t).trim()));
  const hay = ` ${String(text).toLowerCase()} `;
  for (const term of TECH_TERMS) {
    const needle = term.toLowerCase();
    const re = new RegExp(`(^|[^a-z0-9+.#])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+.#]|$)`, "i");
    if (re.test(hay)) found.add(term);
    if (found.size >= 8) break;
  }
  return [...found].slice(0, 8);
}

/** Deterministic id so the same posting keeps a stable key across refreshes. */
export function makeId(source, raw) {
  const base = String(raw ?? "").toLowerCase();
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `${source.toLowerCase()}_${(h >>> 0).toString(36)}`;
}

/** Assemble a unified job from a partial, filling defaults. */
export function buildJob(partial) {
  return {
    min: null,
    max: null,
    skills: [],
    resp: [],
    summary: "",
    description: "",
    location: "",
    posted: null,
    postedAt: null,
    ...partial,
  };
}
