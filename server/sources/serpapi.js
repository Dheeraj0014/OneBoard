import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import {
  buildJob, makeId, summarize, extractSkills, toK,
  inferLevel, inferType, inferRemote, toISO,
} from "../lib/normalize.js";

/**
 * Turn Google Jobs' relative "posted_at" text ("3 days ago", "30+ days ago",
 * "yesterday", "just posted") into a whole-day count. Returns null when the
 * string can't be understood, so the date fields degrade gracefully.
 */
function relativeDays(text = "") {
  const s = String(text).toLowerCase().trim();
  if (!s) return null;
  if (/just posted|just now|today|hour|minute|moment/.test(s)) return 0;
  if (/yesterday/.test(s)) return 1;
  const m = s.match(/(\d+)\s*\+?\s*(day|week|month|year)/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = { day: 1, week: 7, month: 30, year: 365 }[m[2]] || 1;
  return n * mult;
}

/** Best-effort min/max (in $K) from a Google Jobs salary string. */
function parseSalary(text = "") {
  const nums = [...String(text).matchAll(/\$?\s*([\d,.]+)\s*(k)?/gi)]
    .map((m) => {
      const n = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) return null;
      return m[2] ? Math.round(n) : toK(n); // "150k" -> 150, "150000" -> 150
    })
    .filter((n) => n && n >= 10 && n <= 2000);
  if (!nums.length) return { min: null, max: null };
  return { min: nums[0], max: nums.length > 1 ? nums[nums.length - 1] : null };
}

/** Map one raw Google Jobs result into the app's unified job shape. */
function mapJob(j) {
  const description = j.description || "";
  const ext = j.detected_extensions || {};
  const location = j.location || "";
  const days = relativeDays(ext.posted_at);
  const { min, max } = parseSalary(ext.salary || "");
  // Prefer a direct apply link; fall back to Google's share link.
  const url = j.apply_options?.[0]?.link || j.share_link || "";
  // Attribute to the originating board when known ("via LinkedIn").
  const via = String(j.via || "").replace(/^via\s+/i, "").trim();

  return buildJob({
    id: makeId("serpapi", j.job_id || url || `${j.title}-${j.company_name}`),
    title: j.title,
    company: j.company_name || "Company",
    location,
    remote: inferRemote({
      flag: ext.work_from_home === true,
      location,
      text: description,
    }),
    min,
    max,
    type: inferType(ext.schedule_type, j.title),
    level: inferLevel(j.title),
    source: via || "SerpApi",
    url,
    postedAt: days == null ? null : toISO(Date.now() - days * 86400000),
    posted: days,
    skills: extractSkills(
      description,
      (j.job_highlights || []).flatMap((h) =>
        /qualif|skill|require/i.test(h.title || "") ? h.items || [] : []
      )
    ),
    summary: summarize(description),
  });
}

/**
 * SerpApi Google Jobs engine — aggregates Google-for-Jobs listings (LinkedIn,
 * Indeed, Glassdoor, company boards, …) under SerpApi's license. Requires a key
 * and a search query. Returns [] when unconfigured so the app still runs.
 *
 * Google Jobs returns ~10 results per page, so we walk `next_page_token`
 * forward up to `config.serpapi.pages` times (each page is one SerpApi search).
 * See https://serpapi.com/google-jobs-api
 */
export async function fetchSerpApi(query = "") {
  if (!config.serpapi.enabled || !query) return [];

  const results = [];
  let pageToken = "";

  for (let page = 0; page < config.serpapi.pages; page++) {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q: query,
      api_key: config.serpapi.key,
      hl: config.serpapi.lang,
    });
    if (config.serpapi.location) params.set("location", config.serpapi.location);
    if (config.serpapi.country) params.set("gl", config.serpapi.country);
    if (pageToken) params.set("next_page_token", pageToken);

    try {
      const data = await fetchJson(
        `https://serpapi.com/search.json?${params}`,
        {},
        config.serpapi.timeoutMs
      );
      for (const j of data?.jobs_results || []) results.push(mapJob(j));

      pageToken = data?.serpapi_pagination?.next_page_token || "";
      if (!pageToken) break; // no more pages
    } catch (err) {
      console.warn(`[serpapi] page ${page + 1}: ${err.message}`);
      break; // return whatever pages we already collected
    }
  }

  return results;
}
