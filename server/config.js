import "dotenv/config";

const csv = (v, fallback) =>
  (v ? v.split(",") : fallback).map((s) => s.trim()).filter(Boolean);

/**
 * Central server configuration. API keys come from the environment. Every
 * source is optional: with no keys the app still boots, it just returns fewer
 * (or no) listings until a source is configured.
 */
export const config = {
  port: Number(process.env.PORT) || 8787,

  // How long an aggregated result set stays fresh before a refetch (ms).
  cacheTtlMs: 15 * 60 * 1000,
  // Per-source network timeout (ms).
  requestTimeoutMs: 12000,

  // Default search region (two-letter ISO code) when the client doesn't send
  // one. "in" = India. The client can override per request via ?country=.
  defaultCountry: (process.env.DEFAULT_COUNTRY || "in").toLowerCase(),

  // Browser origins allowed to call this API. The AI routes spend Anthropic
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

  // Anthropic — powers the AI ranker and intro drafter. The key lives here on
  // the server so it is never exposed to the browser. Without a key the AI
  // routes return 503 and the client falls back to its local heuristic.
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.AI_MODEL || "claude-sonnet-4-6",
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
