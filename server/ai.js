import { config } from "./config.js";

const API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Thrown when a request reaches the AI routes but the server has no API key.
 * The route maps this to a 503 so the client knows to fall back gracefully.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI is not configured — set ANTHROPIC_API_KEY on the server");
    this.name = "AiNotConfiguredError";
  }
}

/** Extract the concatenated text blocks from an Anthropic messages response. */
function extractText(data) {
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Call the Anthropic Messages API. The key comes from the server environment
 * and never leaves this process. Throws on a missing key or a non-2xx response.
 */
async function askClaude(prompt, maxTokens = 1000) {
  if (!config.anthropic.enabled) throw new AiNotConfiguredError();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropic.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return extractText(await res.json());
}

/**
 * Rank the supplied jobs against a natural-language request via Claude.
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

  const out = await askClaude(prompt);
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

/**
 * Draft a short outreach intro for a job. Throws on failure so the caller
 * can substitute a local template.
 */
export async function draftIntro(job) {
  const focus = job.skills?.length ? `these skills: ${job.skills.join(", ")}` : `the focus of the "${job.title}" role`;
  const prompt = `Write a confident, warm 3-4 sentence outreach intro from a job seeker applying to ${job.company} for the "${job.title}" role. Naturally reference 1-2 of ${focus}. Write in first person, no greeting line, no signature, no placeholders like [Name]. Return only the paragraph.`;
  const text = await askClaude(prompt);
  return text.trim();
}
