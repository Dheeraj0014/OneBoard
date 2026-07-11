import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { getJobs } from "./aggregate.js";
import { rankJobs, matchJobs, extractProfile, draftIntro, AiNotConfiguredError } from "./ai.js";
import { pdfToText, PdfParseError, MAX_PDF_BYTES } from "./lib/pdf.js";

const app = express();
app.use(cors());
// Matching posts the current result set with job descriptions attached, so the
// body runs larger than a plain API payload.
app.use(express.json({ limit: "4mb" }));

// Resumes are held in memory and discarded once parsed — nothing touches disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new PdfParseError("Only PDF resumes are supported. Paste your resume text instead."));
  },
});

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
 * POST /api/resume  (multipart/form-data, field "resume")
 * Extracts plain text from an uploaded PDF resume. Returns { text }.
 * The file is parsed in memory and never stored.
 */
app.post("/api/resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach a PDF in the 'resume' field" });
    res.json({ text: await pdfToText(req.file.buffer) });
  } catch (err) {
    if (err instanceof PdfParseError) return res.status(400).json({ error: err.message });
    console.error("[/api/resume]", err);
    res.status(500).json({ error: "Could not read that PDF", detail: err.message });
  }
});

/**
 * POST /api/profile { resumeText, prefs }
 * Distils resume text into a structured profile. Returns { profile }.
 */
app.post("/api/profile", async (req, res) => {
  try {
    const { resumeText, prefs } = req.body || {};
    if (typeof resumeText !== "string" || resumeText.trim().length < 40) {
      return res.status(400).json({ error: "Provide resumeText (at least 40 characters)" });
    }
    res.json({ profile: await extractProfile(resumeText.trim(), prefs || {}) });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    console.error("[/api/profile]", err);
    res.status(502).json({ error: "Could not read that resume", detail: err.message });
  }
});

/**
 * POST /api/match { profile, jobs }
 * Scores the supplied jobs against a resume profile + stated preferences.
 * Returns { map: { [jobId]: { score, reason } } }.
 */
app.post("/api/match", async (req, res) => {
  try {
    const { profile, jobs } = req.body || {};
    if (!profile || typeof profile !== "object" || !Array.isArray(jobs)) {
      return res.status(400).json({ error: "Provide { profile: object, jobs: array }" });
    }
    if (!jobs.length) return res.json({ map: {} });
    res.json({ map: await matchJobs(profile, jobs) });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    console.error("[/api/match]", err);
    res.status(502).json({ error: "Resume matching failed", detail: err.message });
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

/**
 * Multer rejects bad uploads (oversized / non-PDF) from inside its middleware,
 * so those never reach a route's try/catch — they land here. Without this,
 * Express's default handler would answer an API client with an HTML stack trace.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, _req, res, _next) => {
  if (err instanceof PdfParseError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `That file is too large — resumes must be under ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.`,
    });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Something went wrong", detail: err?.message });
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
