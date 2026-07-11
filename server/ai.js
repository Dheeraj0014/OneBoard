import { config } from "./config.js";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Shape of a scored-jobs reply, for both the query ranker and the resume matcher. */
const SCORES_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      score: { type: "INTEGER" },
      reason: { type: "STRING" },
    },
    required: ["id", "score", "reason"],
  },
};

/** Shape of the structured profile distilled from a resume. */
const PROFILE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    level: { type: "STRING", enum: ["Entry", "Mid", "Senior", "Lead"] },
    years: { type: "INTEGER" },
    skills: { type: "ARRAY", items: { type: "STRING" } },
    domains: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: ["title", "level", "skills", "summary"],
};

/**
 * Thrown when a request reaches the AI routes but the server has no API key.
 * The route maps this to a 503 so the client knows to fall back gracefully.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured — set GEMINI_API_KEY on the server");
    this.name = "AiNotConfiguredError";
  }
}

/** Concatenate the text parts of a Gemini candidate into one string. */
function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text || "").join("");
}

/**
 * Call the Google AI Studio (Gemini) generateContent API. The key comes from the
 * server environment and never leaves this process. Throws on a missing key, a
 * non-2xx response, or a prompt the safety filters refused.
 *
 * Pass `schema` to get structured output. responseMimeType alone is not enough:
 * Gemini has been observed returning an array with no closing bracket while
 * still reporting finishReason STOP, so the only reliable way to get parseable
 * JSON is to constrain the shape with responseSchema.
 */
async function askAI(prompt, maxTokens = 1000, { schema = null } = {}) {
  if (!config.ai.enabled) throw new AiNotConfiguredError();

  const url = `${API_BASE}/${encodeURIComponent(config.ai.model)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header rather than ?key= so the key never lands in a URL, where proxies
      // and access logs would happily record it.
      "x-goog-api-key": config.ai.apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        // Current Gemini flash models reason before answering, and that reasoning
        // is billed against maxOutputTokens. Left on, it swallows the budget and
        // the answer comes back truncated mid-JSON. These are extraction and
        // scoring tasks, not puzzles — they don't need a scratchpad.
        thinkingConfig: { thinkingBudget: 0 },
        ...(schema
          ? { responseMimeType: "application/json", responseSchema: schema }
          : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();

  // A prompt the safety filters rejected comes back 200 with no candidate at
  // all, so an unguarded read would silently yield "" and look like a bad model.
  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Gemini refused the prompt: ${blocked}`);

  const text = extractText(data);
  if (!text) {
    const why = data?.candidates?.[0]?.finishReason || "no content returned";
    throw new Error(`Gemini returned nothing (${why})`);
  }

  // A truncated answer still has text, so it would otherwise surface downstream
  // as a baffling "No JSON found" instead of "your token budget was too small".
  if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    throw new Error(`Gemini hit maxOutputTokens (${maxTokens}) — output truncated`);
  }

  return text;
}

/**
 * Rank the supplied jobs against a natural-language request via the model.
 * Returns a map of { [jobId]: { score, reason } } covering every job passed in.
 * Throws on failure so the caller can fall back to a local heuristic.
 */
export async function rankJobs(text, jobs) {
  // Cap the prompt payload so a large live result set stays within token
  // limits; jobs beyond the cap get a neutral score below.
  const subset = jobs.slice(0, 50);
  const compact = subset.map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location,
    remote: j.remote, salary: j.salary ?? [j.min, j.max], type: j.type, level: j.level, skills: j.skills,
  }));
  const prompt = `You are a job matching engine. A candidate wrote this request: "${text}".\n\nScore EVERY job below from 0-100 for how well it fits, and give a concise reason (max 10 words, lowercase, no period). Consider role, skills, seniority, workplace type, salary and location.\n\nJobs:\n${JSON.stringify(compact)}\n\nReturn ONLY a JSON array, no markdown or preamble, sorted by score descending, in this exact shape:\n[{"id":"j1","score":92,"reason":"strong react match, remote, salary fits"}]`;

  // One scored entry costs ~30 tokens, so a full 50-job set needs ~1500. The old
  // 1000-token ceiling truncated every full-size ranking — which failed silently
  // into the local heuristic, so the AI path looked like it was working.
  const out = await askAI(prompt, 4000, { schema: SCORES_SCHEMA });
  const s = out.indexOf("["), e = out.lastIndexOf("]");
  const arr = JSON.parse(out.slice(s, e + 1));

  const map = {};
  arr.forEach((r) => {
    if (r && r.id) {
      map[r.id] = { score: Math.max(0, Math.min(100, Math.round(r.score))), reason: r.reason };
    }
  });
  jobs.forEach((j) => {
    if (!map[j.id]) map[j.id] = { score: 40, reason: "limited overlap with your request" };
  });
  return map;
}

/* ------------------------------------------------------------------ *
 * Resume matching
 * ------------------------------------------------------------------ */

/**
 * Jobs sent to the model in a single matching call. Kept high enough that a full
 * MATCH_LIMIT set is 3 calls rather than 5 — Gemini's free tier throttles bursts
 * of parallel requests, and a 429'd batch costs its jobs a real score.
 */
const MATCH_BATCH = 20;
/** Hard cap on jobs scored per request, to bound latency and token spend. */
const MATCH_LIMIT = 60;

/** Pull the first JSON value of the given kind out of a model response. */
function parseJson(out, open, close) {
  const s = out.indexOf(open);
  const e = out.lastIndexOf(close);
  if (s === -1 || e === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(out.slice(s, e + 1));
}

/**
 * Distil raw resume text into a compact structured profile. Keeping this a
 * separate one-off call (rather than pasting the whole resume into every
 * matching prompt) means the resume is read once, and each match batch then
 * carries a small profile instead of thousands of tokens of CV.
 *
 * Returns { title, level, years, skills[], domains[], summary }.
 */
export async function extractProfile(resumeText, prefs = {}) {
  const resume = String(resumeText).slice(0, 12000);
  const prompt = `Read this candidate's resume and distil it into a structured profile.

Resume:
"""
${resume}
"""

Return ONLY a JSON object, no markdown or preamble, in this exact shape:
{"title":"their current or target job title","level":"one of Entry, Mid, Senior, Lead","years":5,"skills":["up to 12 concrete technical skills, most important first"],"domains":["up to 4 industries or problem domains they have worked in"],"summary":"one sentence, max 20 words, describing them as a candidate"}`;

  const profile = parseJson(await askAI(prompt, 700, { schema: PROFILE_SCHEMA }), "{", "}");

  return {
    title: String(profile.title || "").slice(0, 80),
    level: ["Entry", "Mid", "Senior", "Lead"].includes(profile.level) ? profile.level : "Mid",
    years: Number.isFinite(Number(profile.years)) ? Number(profile.years) : null,
    skills: (Array.isArray(profile.skills) ? profile.skills : []).slice(0, 12).map(String),
    domains: (Array.isArray(profile.domains) ? profile.domains : []).slice(0, 4).map(String),
    summary: String(profile.summary || "").slice(0, 160),
    prefs,
  };
}

/** Render the candidate's stated preferences as prompt lines, skipping blanks. */
function prefLines(prefs = {}) {
  const lines = [];
  if (prefs.roles) lines.push(`- Roles they want: ${prefs.roles}`);
  if (prefs.skills?.length) lines.push(`- Skills they want to use: ${prefs.skills.join(", ")}`);
  if (prefs.remote?.length) lines.push(`- Workplace type: ${prefs.remote.join(" or ")}`);
  if (prefs.level?.length) lines.push(`- Seniority wanted: ${prefs.level.join(" or ")}`);
  if (prefs.minSalary) lines.push(`- Minimum salary: ${prefs.minSalary}k`);
  return lines.length ? lines.join("\n") : "- (none stated)";
}

/** Score one batch of jobs against the profile. Returns a partial map. */
async function matchBatch(profile, jobs) {
  const compact = jobs.map((j) => ({
    id: j.id, title: j.title, company: j.company, location: j.location,
    remote: j.remote, salary: [j.min, j.max], type: j.type, level: j.level,
    skills: j.skills, description: j.description || j.summary || "",
  }));

  const prompt = `You are a job matching engine. Score how well each job fits ONE specific candidate.

CANDIDATE
- Current title: ${profile.title || "unknown"}
- Seniority: ${profile.level} (${profile.years ?? "?"} years experience)
- Skills: ${profile.skills.join(", ") || "unknown"}
- Domains: ${profile.domains.join(", ") || "unknown"}
- Summary: ${profile.summary || "n/a"}

WHAT THEY WANT
${prefLines(profile.prefs)}

JOBS
${JSON.stringify(compact)}

Score EVERY job from 0-100 on how well the JOB DESCRIPTION matches this candidate's experience AND their stated preferences. Weigh: skill overlap with the description's requirements, seniority alignment (penalise a big level mismatch in either direction), workplace type, domain relevance, and salary. Be discriminating — use the full range, do not cluster every job around 70.

Give a concise reason (max 10 words, lowercase, no period) naming the specific overlap or gap.

Return ONLY a JSON array, no markdown or preamble, in this exact shape:
[{"id":"j1","score":92,"reason":"react + typescript match, senior level, remote"}]`;

  const arr = parseJson(await askAI(prompt, 2500, { schema: SCORES_SCHEMA }), "[", "]");
  const map = {};
  arr.forEach((r) => {
    if (r && r.id) {
      map[r.id] = {
        score: Math.max(0, Math.min(100, Math.round(r.score))),
        reason: String(r.reason || "").slice(0, 90),
      };
    }
  });
  return map;
}

/**
 * Score jobs against a resume profile. Batched so each prompt stays small
 * enough to reason carefully over full job descriptions, and run in parallel
 * so a large result set doesn't serialise into a long wait. A failed batch
 * degrades to neutral scores for its jobs rather than failing the whole match.
 *
 * Returns a map of { [jobId]: { score, reason } } covering every job passed in.
 */
export async function matchJobs(profile, jobs) {
  if (!config.ai.enabled) throw new AiNotConfiguredError();

  const subset = jobs.slice(0, MATCH_LIMIT);
  const batches = [];
  for (let i = 0; i < subset.length; i += MATCH_BATCH) {
    batches.push(subset.slice(i, i + MATCH_BATCH));
  }

  const settled = await Promise.allSettled(batches.map((b) => matchBatch(profile, b)));

  const map = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") Object.assign(map, r.value);
    else console.warn(`[match] batch ${i} failed: ${r.reason?.message}`);
  });

  // Every batch failing means the AI is genuinely unreachable — surface that so
  // the client can fall back to its local heuristic instead of showing a page
  // of meaningless neutral scores.
  if (!Object.keys(map).length) throw new Error("All matching batches failed");

  // Jobs past the cap, or dropped by a failed batch, get a neutral placeholder.
  jobs.forEach((j) => {
    if (!map[j.id]) map[j.id] = { score: 50, reason: "not scored against your profile" };
  });
  return map;
}

/**
 * Draft a short outreach intro for a job. Throws on failure so the caller
 * can substitute a local template.
 */
export async function draftIntro(job) {
  const focus = job.skills?.length ? `these skills: ${job.skills.join(", ")}` : `the focus of the "${job.title}" role`;
  const prompt = `Write a confident, warm 3-4 sentence outreach intro from a job seeker applying to ${job.company} for the "${job.title}" role. Naturally reference 1-2 of ${focus}. Write in first person, no greeting line, no signature, no placeholders like [Name]. Return only the paragraph.`;
  const text = await askAI(prompt);
  return text.trim();
}
