# Prism — live job aggregator

One lens for every job board. Prism aggregates **live** job listings from
multiple compliant sources, de-duplicates them, and ranks them against a
natural-language query.

## Quick start

```bash
npm install
cp .env.example .env      # optional: add aggregator API keys
npm run dev               # starts the API (:8787) and the client (:5173)
```

- Client: http://localhost:5173
- API:    http://localhost:8787/api/jobs

The company-board sources (Greenhouse + Lever) work immediately with **no keys**.
Aggregator sources activate once you add their keys to `.env`.

## Sources & compliance

Prism only uses access methods each platform permits. It **does not scrape**
LinkedIn / Indeed / Glassdoor / Wellfound — none of them offer an open,
ToS-compliant job-search API, so live data from those is only obtained through a
*licensed aggregator* that redistributes them legally.

| Source | Access | Key needed |
|---|---|---|
| **Greenhouse** | Public Job Board API (per company) | No |
| **Lever** | Public Postings API (per company) | No |
| **Adzuna** | Licensed search API (free tier) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |
| **JSearch (RapidAPI)** | Licensed Google-for-Jobs aggregator (surfaces LinkedIn/Indeed/Glassdoor listings) | `RAPIDAPI_KEY` |

Edit the tracked company boards in `server/config.js` (or via
`GREENHOUSE_BOARDS` / `LEVER_BOARDS` in `.env`). Unreachable tokens are skipped
gracefully.

## How it works

```
Browser ──/api/jobs?q=──▶ Express (server/)
                              │
             ┌────────────────┼─────────────────┐
        Greenhouse         Lever         Adzuna / JSearch
             └────────────── normalize ──────────────┘
                              │
                  dedupe → cache (15 min) → JSON
```

- **Adapters** (`server/sources/*`) each fetch one source and normalize it to a
  single job shape. Adding a source = one new adapter + one line in
  `server/aggregate.js`.
- **Normalization** (`server/lib/normalize.js`) infers workplace type, seniority,
  skills and posting age from real (often incomplete) listings.
- **Dedupe** (`server/lib/dedupe.js`) collapses the same role appearing on
  multiple sources, keeping the most complete copy.
- **Cache** (`server/lib/cache.js`) serves results for 15 min with
  stale-while-revalidate; the client also auto-refreshes every 5 min.
- Only listings **with a real apply link** are shown; each card links to the
  original posting with its source and posting date.

## Notes

- There is **no static/mock job data** — if the API is unreachable the UI shows
  an error state rather than placeholders.
- The AI ranker and intro drafter run **server-side** (`server/ai.js`, exposed
  as `POST /api/rank` and `POST /api/intro`). The `ANTHROPIC_API_KEY` lives on
  the Express server and is never sent to the browser. Without a key those
  routes return `503` and the client falls back to a local heuristic / template,
  so the app still works with no AI configured. Set `ANTHROPIC_API_KEY` (and
  optionally `AI_MODEL`) in `.env` to enable them.
