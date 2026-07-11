import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import { resolveCountry } from "../lib/countries.js";
import {
  buildJob, makeId, summarize, extractSkills, toK,
  inferLevel, inferType, inferRemote, daysAgo, toISO,
} from "../lib/normalize.js";

const SOURCE = "Adzuna";

/**
 * Adzuna licensed search API. Requires an app id + key (free tier).
 * `country` is a two-letter ISO code selecting the Adzuna market to search;
 * unsupported / empty codes fall back to the configured default.
 * Returns [] when unconfigured so the app still runs on company boards alone.
 */
export async function fetchAdzuna(query = "", countryCode = "") {
  if (!config.adzuna.enabled) return [];

  const { appId, appKey } = config.adzuna;
  // Only search a real Adzuna market; otherwise use the configured fallback.
  const country = resolveCountry(countryCode) ? countryCode.toLowerCase() : config.adzuna.country;
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "50",
    "content-type": "application/json",
  });
  if (query) params.set("what", query);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;

  try {
    const data = await fetchJson(url);
    return (data?.results || []).map((j) => {
      const description = j.description || "";
      const location = j.location?.display_name || "";
      return buildJob({
        id: makeId(SOURCE, j.id || j.redirect_url),
        title: j.title,
        company: j.company?.display_name || "Company",
        location,
        remote: inferRemote({ location, text: description }),
        min: toK(j.salary_min),
        max: toK(j.salary_max),
        type: inferType(j.contract_time, j.contract_type, j.title),
        level: inferLevel(j.title),
        source: SOURCE,
        url: j.redirect_url,
        postedAt: toISO(j.created),
        posted: daysAgo(j.created),
        skills: extractSkills(description, j.category?.label ? [j.category.label] : []),
        summary: summarize(description),
      });
    });
  } catch (err) {
    console.warn(`[adzuna] ${err.message}`);
    return [];
  }
}
