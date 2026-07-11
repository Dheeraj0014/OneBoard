import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { config } from "./config.js";
import { getJobs } from "./aggregate.js";
import { rankJobs, matchJobs, extractProfile, draftIntro, AiNotConfiguredError } from "./ai.js";
import { pdfToText, PdfParseError, MAX_PDF_BYTES } from "./lib/pdf.js";

const app = express();

// On Render/Fly/etc the app sits behind a reverse proxy, so req.ip is the
// proxy's address unless we trust the X-Forwarded-For it sets. Untrusted, every
// visitor would share a single rate-limit bucket.
if (config.rateLimit.trustProxy) app.set("trust proxy", 1);

/** Thrown by the CORS check so the error handler can answer 403 rather than 500. */
class OriginNotAllowedError extends Error {}

// Only the origins we serve the app from may call this API. A wide-open policy
// would let any page on the web drive the AI routes below with the user's
// browser — and our Anthropic key.
app.use(
  cors((req, cb) => {
    const origin = req.headers.origin;

    // Same-origin requests carry an Origin header on POST, so in the deployed
    // single-service setup the app would otherwise be blocked from calling
    // itself unless ALLOWED_ORIGINS happened to name its own URL exactly.
    const self = `${req.protocol}://${req.get("host")}`;

    // Non-browser callers (curl, uptime checks) send no Origin at all. They pass
    // CORS; the routes that cost money are still behind auth and rate limits.
    if (!origin || origin === self || config.allowedOrigins.includes(origin)) {
      return cb(null, { origin: true });
    }
    cb(new OriginNotAllowedError(`Origin not allowed: ${origin}`));
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

/** Shared limiter options: standard RateLimit headers, JSON body, no legacy headers. */
const limiter = (windowMs, limit, message, keyGenerator) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => res.status(429).json({ error: message }),
  });

/**
 * Every distinct ?q= is a cache miss, and a cache miss is a live SerpAPI search
 * (billed per page). Unauthenticated, so this is capped per IP.
 */
const jobsLimit = limiter(
  60_000,
  config.rateLimit.jobsPerMinute,
  "Too many searches — give it a minute."
);

/** PDF parsing is unauthenticated CPU work; keep a lid on it. */
const resumeLimit = limiter(
  60_000,
  config.rateLimit.resumePerMinute,
  "Too many resume uploads — give it a minute."
);

/**
 * AI limits key on the Clerk user, not the IP: sign-up is open, so one person
 * can trivially spread an IP-based limit across many addresses. Falls back to a
 * (IPv6-safe) IP key, though `protect` runs first so a user should always exist.
 */
const aiKey = (req, res) => getAuth(req)?.userId || ipKeyGenerator(req, res);

const aiBurstLimit = limiter(
  60_000,
  config.rateLimit.aiPerMinute,
  "You're going too fast — try again shortly.",
  aiKey
);

const aiDailyLimit = limiter(
  24 * 60 * 60 * 1000,
  config.rateLimit.aiPerDay,
  "Daily AI limit reached. Try again tomorrow.",
  aiKey
);

/** Applied to every route that calls Anthropic: auth, then burst, then daily cap. */
const paid = [protect, aiBurstLimit, aiDailyLimit];

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
app.get("/api/jobs", jobsLimit, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const country = typeof req.query.country === "string" ? req.query.country : "";
    const result = await getJobs(q, country);
    res.json(result);
  } catch (err) {
    console.error("[/api/jobs]", err);
    res.status(502).json({ error: "Failed to aggregate live jobs" });
  }
});

/**
 * POST /api/rank { q, jobs: [...] }
 * Ranks the supplied jobs against a natural-language query via Claude.
 * Returns { map: { [jobId]: { score, reason } } }.
 */
app.post("/api/rank", paid, async (req, res) => {
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
app.post("/api/resume", resumeLimit, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach a PDF in the 'resume' field" });
    res.json({ text: await pdfToText(req.file.buffer) });
  } catch (err) {
    if (err instanceof PdfParseError) return res.status(400).json({ error: err.message });
    console.error("[/api/resume]", err);
    res.status(500).json({ error: "Could not read that PDF" });
  }
});

/**
 * POST /api/profile { resumeText, prefs }
 * Distils resume text into a structured profile. Returns { profile }.
 */
app.post("/api/profile", paid, async (req, res) => {
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
app.post("/api/match", paid, async (req, res) => {
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
app.post("/api/intro", paid, async (req, res) => {
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

// An unrecognised /api/* path is an API client's mistake, so answer in JSON
// rather than letting Express fall through to its default HTML 404.
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// In production this process also serves the built client, so the app is one
// origin. Registered after the API routes so /api/* always wins.
if (config.serveStatic) {
  const dist = path.resolve(process.cwd(), "dist");
  app.use(express.static(dist));

  // SPA fallback: any GET that isn't an API call returns index.html. A missing
  // /api/* route still falls through to a JSON 404 rather than serving HTML.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

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
