import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { getJobs } from "./aggregate.js";
import { rankJobs, draftIntro, AiNotConfiguredError } from "./ai.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), ai: config.anthropic.enabled });
});

/**
 * GET /api/jobs?q=<query>
 * Returns live, de-duplicated job listings from all configured sources.
 */
app.get("/api/jobs", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const country = typeof req.query.country === "string" ? req.query.country : "";
    const result = await getJobs(q, country);
    res.json(result);
  } catch (err) {
    console.error("[/api/jobs]", err);
    res.status(502).json({ error: "Failed to aggregate live jobs", detail: err.message });
  }
});

/**
 * POST /api/rank { q, jobs: [...] }
 * Ranks the supplied jobs against a natural-language query via Claude.
 * Returns { map: { [jobId]: { score, reason } } }.
 */
app.post("/api/rank", async (req, res) => {
  try {
    const { q, jobs } = req.body || {};
    if (typeof q !== "string" || !q.trim() || !Array.isArray(jobs)) {
      return res.status(400).json({ error: "Provide { q: string, jobs: array }" });
    }
    res.json({ map: await rankJobs(q.trim(), jobs) });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    console.error("[/api/rank]", err);
    res.status(502).json({ error: "AI ranking failed", detail: err.message });
  }
});

/**
 * POST /api/intro { job }
 * Drafts a short outreach intro for a job. Returns { intro }.
 */
app.post("/api/intro", async (req, res) => {
  try {
    const { job } = req.body || {};
    if (!job || typeof job !== "object") {
      return res.status(400).json({ error: "Provide { job: object }" });
    }
    res.json({ intro: await draftIntro(job) });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    console.error("[/api/intro]", err);
    res.status(502).json({ error: "AI intro failed", detail: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`▲ Prism job API listening on http://localhost:${config.port}`);
  console.log(
    `  sources → greenhouse:${config.greenhouse.enabled ? `${config.greenhouse.boards.length} boards` : "off"} ` +
      `lever:${config.lever.enabled ? `${config.lever.boards.length} boards` : "off"} ` +
      `serpapi:${config.serpapi.enabled ? "on" : "off"} ` +
      `adzuna:${config.adzuna.enabled ? "on" : "off"} jsearch:${config.jsearch.enabled ? "on" : "off"} ` +
      `theirstack:${config.theirstack.enabled ? "on" : "off"}`
  );
  console.log(`  region → default ${config.defaultCountry}`);
  console.log(`  ai → ${config.anthropic.enabled ? `on (${config.anthropic.model})` : "off (no ANTHROPIC_API_KEY)"}`);
});
