import express from "express";
import cors from "cors";
import multer from "multer";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { config } from "./config.js";
import { getJobs } from "./aggregate.js";
import { rankJobs, matchJobs, extractProfile, draftIntro, AiNotConfiguredError } from "./ai.js";
import { pdfToText, PdfParseError, MAX_PDF_BYTES } from "./lib/pdf.js";

const app = express();

/** Thrown by the CORS check so the error handler can answer 403 rather than 500. */
class OriginNotAllowedError extends Error {}

// Only the origins we serve the app from may call this API. A wide-open policy
// would let any page on the web drive the AI routes below with the user's
// browser — and our Anthropic key.
app.use(
  cors({
    origin(origin, cb) {
      // Non-browser callers (curl, uptime checks) send no Origin header. They
      // are allowed past CORS; the routes that cost money are still behind auth.
      if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
      cb(new OriginNotAllowedError(`Origin not allowed: ${origin}`));
    },
  })
);

// Attaches the caller's Clerk session (if any) to req. Skipped when Clerk is
// unconfigured — `protect` below then refuses the paid routes outright.
if (config.clerk.enabled) {
  app.use(
    clerkMiddleware({
      secretKey: config.clerk.secretKey,
      publishableKey: config.clerk.publishableKey,
    })
  );
}

/**
 * Gate for the routes that spend Anthropic credits. Fails closed: with no Clerk
 * keys the server refuses rather than leaving paid routes open to anyone who can
 * reach the port. Signed-out clients get a 401 and fall back to the local
 * heuristic ranker, so the app stays usable — it just stops billing us.
 *
 * Checks the session directly rather than using Clerk's `requireAuth()`, which
 * answers an unauthenticated caller with a 302 to the sign-in page — fetch would
 * follow that and try to parse HTML as JSON.
 */
function protect(req, res, next) {
  if (!config.clerk.enabled) {
    return res.status(503).json({
      error: "Auth is not configured on the server — AI features are disabled",
    });
  }
  if (!getAuth(req)?.userId) {
    return res.status(401).json({ error: "Sign in to use AI features" });
  }
  return next();
}

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
app.post("/api/rank", protect, async (req, res) => {
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
    res.status(502).json({ error: "AI ranking failed" });
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
app.post("/api/profile", protect, async (req, res) => {
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
    res.status(502).json({ error: "Could not read that resume" });
  }
});

/**
 * POST /api/match { profile, jobs }
 * Scores the supplied jobs against a resume profile + stated preferences.
 * Returns { map: { [jobId]: { score, reason } } }.
 */
app.post("/api/match", protect, async (req, res) => {
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
    res.status(502).json({ error: "Resume matching failed" });
  }
});

/**
 * POST /api/intro { job }
 * Drafts a short outreach intro for a job. Returns { intro }.
 */
app.post("/api/intro", protect, async (req, res) => {
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
    res.status(502).json({ error: "AI intro failed" });
  }
});

/**
 * Multer rejects bad uploads (oversized / non-PDF) from inside its middleware,
 * so those never reach a route's try/catch — they land here. Without this,
 * Express's default handler would answer an API client with an HTML stack trace.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, _req, res, _next) => {
  if (err instanceof OriginNotAllowedError) {
    console.warn("[cors]", err.message);
    return res.status(403).json({ error: "Origin not allowed" });
  }
  if (err instanceof PdfParseError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `That file is too large — resumes must be under ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB.`,
    });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Something went wrong" });
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
  console.log(`  auth → ${config.clerk.enabled ? "on (Clerk)" : "off — AI routes will refuse (503)"}`);
  console.log(`  cors → ${config.allowedOrigins.join(", ")}`);
  if (config.anthropic.enabled && !config.clerk.enabled) {
    console.warn("  ⚠ Anthropic is configured but Clerk is not — the paid AI routes are disabled to");
    console.warn("    prevent unauthenticated spend. Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY.");
  }
});
