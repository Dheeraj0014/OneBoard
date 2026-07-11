import "dotenv/config";

const csv = (v, fallback) =>
  (v ? v.split(",") : fallback).map((s) => s.trim()).filter(Boolean);

const isProd = process.env.NODE_ENV === "production";

/**
 * Central server configuration. API keys come from the environment. Every
 * source is optional: with no keys the app still boots, it just returns fewer
 * (or no) listings until a source is configured.
 */
export const config = {
  port: Number(process.env.PORT) || 8787,

  // In production this process also serves the built front-end (dist/), so the
  // app is a single origin: one deploy, one URL, and no CORS to misconfigure.
  // In dev, Vite serves the client and proxies /api here instead.
  serveStatic: process.env.SERVE_STATIC === "true" || isProd,

  // How long an aggregated result set stays fresh before a refetch (ms).
  cacheTtlMs: 15 * 60 * 1000,
  // Cap on distinct cached query result-sets. The cache is keyed by
  // region:query, so without a ceiling a loop over ?q=aa,ab,ac… grows it
  // without bound until the process runs out of memory.
  cacheMaxEntries: Number(process.env.CACHE_MAX_ENTRIES) || 300,
  // Per-source network timeout (ms).
  requestTimeoutMs: 12000,

  // Rate limits. /api/jobs spends SerpAPI quota on every cache miss and the AI
  // routes spend AI provider credits, so both are capped rather than left open.
  rateLimit: {
    // Behind a hosting proxy (Render, Fly, …) the real client IP arrives in
    // X-Forwarded-For. Without trusting it, every visitor shares one bucket and
    // the limits either lock everyone out at once or do nothing.
    trustProxy: process.env.TRUST_PROXY === "true",
    jobsPerMinute: Number(process.env.RL_JOBS_PER_MIN) || 20,
    resumePerMinute: Number(process.env.RL_RESUME_PER_MIN) || 5,
    // AI limits are per signed-in user, not per IP — sign-up is open, so an IP
    // limit alone wouldn't stop one person burning credits from many addresses.
    aiPerMinute: Number(process.env.RL_AI_PER_MIN) || 10,
    aiPerDay: Number(process.env.RL_AI_PER_DAY) || 120,
  },

  // Default search region (two-letter ISO code) when the client doesn't send
  // one. "in" = India. The client can override per request via ?country=.
  defaultCountry: (process.env.DEFAULT_COUNTRY || "in").toLowerCase(),

  // Browser origins allowed to call this API. The AI routes spend real AI provider
  // credits per request, so the API is not open to arbitrary sites. Set
  // ALLOWED_ORIGINS (CSV) to the deployed front-end origin in production; the
  // default covers the Vite dev server.
  allowedOrigins: csv(process.env.ALLOWED_ORIGINS, [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),

  // Clerk — verifies the caller's session on the routes that cost money. The
  // publishable key is the same one the browser uses, so fall back to the
  // VITE_-prefixed value rather than making people set it twice.
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || "",
    publishableKey:
      process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "",
    get enabled() {
      return Boolean(this.secretKey && this.publishableKey);
    },
  },

  // Greenhouse public Job Board API — one board per company, no key needed.
  // Configure the tracked companies via GREENHOUSE_BOARDS (CSV of board tokens,
  // e.g. the "cloudflare" in boards.greenhouse.io/cloudflare).
  greenhouse: {
    boards: csv(process.env.GREENHOUSE_BOARDS, [
      "gitlab", "elastic", "mongodb", "cloudflare",
      "stripe", "airbnb", "coinbase", "datadog",
    ]),
    get enabled() {
      return this.boards.length > 0;
    },
  },

  // Lever public Postings API — one board per company, no key needed. Configure
  // via LEVER_BOARDS (CSV of board tokens, e.g. the "leadiq" in
  // jobs.lever.co/leadiq).
  lever: {
    boards: csv(process.env.LEVER_BOARDS, [
      "netflix", "spotify", "plaid", "palantir",
    ]),
    get enabled() {
      return this.boards.length > 0;
    },
  },

  // SerpApi Google Jobs engine — aggregates Google-for-Jobs listings. Requires
  // a key and a search query. https://serpapi.com/google-jobs-api
  serpapi: {
    key: process.env.SERPAPI_KEY || "",
    // Optional location bias, e.g. "United States" or "Bengaluru, India".
    location: process.env.SERPAPI_LOCATION || "",
    // Two-letter Google country code (gl). This is what actually restricts
    // results to a country — e.g. "in" for India, "us" for the US. The
    // `location` string alone only biases; `gl` enforces the country domain.
    country: (process.env.SERPAPI_COUNTRY || "").toLowerCase(),
    // Google UI language (hl), e.g. "en".
    lang: process.env.SERPAPI_LANG || "en",
    // Google Jobs returns ~10 results/page; each page is a separate SerpApi
    // search (counts against your quota). Default 3 pages ≈ 30 listings.
    pages: Math.max(1, Number(process.env.SERPAPI_PAGES) || 3),
    // SerpApi resolves Google Jobs in real time and can be slow, so give it
    // more headroom than the default per-request timeout.
    timeoutMs: Number(process.env.SERPAPI_TIMEOUT_MS) || 25000,
    get enabled() {
      return Boolean(this.key);
    },
  },

  adzuna: {
    appId: process.env.ADZUNA_APP_ID || "",
    appKey: process.env.ADZUNA_APP_KEY || "",
    // Fallback country when the request doesn't specify one; defaults to India.
    country: (process.env.ADZUNA_COUNTRY || "in").toLowerCase(),
    get enabled() {
      return Boolean(this.appId && this.appKey);
    },
  },

  jsearch: {
    key: process.env.RAPIDAPI_KEY || "",
    host: process.env.JSEARCH_HOST || "jsearch.p.rapidapi.com",
    get enabled() {
      return Boolean(this.key);
    },
  },

  // The model behind the AI ranker, resume matcher and intro drafter. Currently
  // Google AI Studio (Gemini). The key lives here on the server so it is never
  // exposed to the browser; without one the AI routes return 503 and the client
  // falls back to its local heuristic.
  //
  // Kept provider-neutral (`config.ai`, not `config.google`) so swapping the
  // backend again only means rewriting server/ai.js, not every call site.
  ai: {
    provider: "google",
    // GEMINI_API_KEY is what Google AI Studio calls it; GOOGLE_API_KEY is
    // accepted too since that's the name people tend to reach for.
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
    model: process.env.AI_MODEL || "gemini-2.0-flash",
    get enabled() {
      return Boolean(this.apiKey);
    },
  },

  // TheirStack licensed search — currently scoped to the Indian job market.
  theirstack: {
    apiKey: process.env.THEIRSTACK_API_KEY || "",
    // Location ids to search; default 1269750 = India. Override via CSV.
    locationIds: csv(process.env.THEIRSTACK_LOCATION_IDS, ["1269750"])
      .map(Number)
      .filter((n) => Number.isFinite(n)),
    maxAgeDays: Number(process.env.THEIRSTACK_MAX_AGE_DAYS) || 7,
    limit: Number(process.env.THEIRSTACK_LIMIT) || 25,
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
};
