import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import {
  buildJob, makeId, summarize, extractSkills, toK,
  daysAgo, toISO,
} from "../lib/normalize.js";

const SOURCE = "TheirStack";

// TheirStack seniority values → the app's four levels.
const LEVEL = {
  c_level: "Lead",
  vp: "Lead",
  director: "Lead",
  head: "Lead",
  staff: "Lead",
  lead: "Lead",
  principal: "Lead",
  senior: "Senior",
  mid_level: "Mid",
  junior: "Entry",
  entry: "Entry",
  intern: "Entry",
};

// TheirStack employment_statuses → the app's type labels.
const TYPE = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  contractor: "Contract",
  temporary: "Contract",
  internship: "Full-time",
};

function inferType(statuses = [], title = "") {
  for (const s of statuses) if (TYPE[s]) return TYPE[s];
  const t = title.toLowerCase();
  if (/contract|contractor|freelance/.test(t)) return "Contract";
  if (/part[\s-]?time/.test(t)) return "Part-time";
  return "Full-time";
}

/**
 * TheirStack licensed job-search API — used here to surface the Indian job
 * market (default location id 1269750 = India). It's a POST/JSON search that
 * costs credits per call, so results ride the shared 15-min aggregation cache.
 *
 * Requires THEIRSTACK_API_KEY. Returns [] when unconfigured or on error so the
 * rest of the aggregation keeps working.
 */
export async function fetchTheirStack(query = "", countryCode = "") {
  if (!config.theirstack.enabled) return [];
  // TheirStack is scoped to India (its configured location ids). Skip it when a
  // different country is selected so foreign searches aren't polluted with
  // Indian listings.
  if (countryCode && countryCode.toLowerCase() !== "in") return [];

  const { apiKey, locationIds, maxAgeDays, limit } = config.theirstack;

  // Turn the natural-language query into description phrases. With no query
  // (the catalog view) fall back to broad developer terms so the Indian market
  // still has something to show.
  const phrases = query
    ? [query, ...query.split(/\s+/).filter((w) => w.length > 2)]
    : ["developer", "engineer"];

  const body = {
    include_total_results: false,
    posted_at_max_age_days: maxAgeDays,
    job_location_or: locationIds.map((id) => ({ id })),
    job_description_contains_or: [...new Set(phrases)],
    blur_company_data: false,
    page: 0,
    limit,
  };

  try {
    const data = await fetchJson("https://api.theirstack.com/v1/jobs/search", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return (data?.data || []).map((j) => {
      const description = j.description || "";
      const title = j.job_title || "";
      // Fold the raw technology_slugs into the text so only recognised,
      // nicely-cased tech terms surface — the slugs themselves are noisy
      // (company names, "xml-format", etc.).
      const slugs = Array.isArray(j.technology_slugs) ? j.technology_slugs.join(" ") : "";
      return buildJob({
        id: makeId(SOURCE, j.id ?? j.url),
        title,
        company: j.company || j.company_object?.name || "Company",
        location: j.short_location || j.location || "",
        remote: j.remote ? "Remote" : (j.hybrid ? "Hybrid" : "On-site"),
        // USD figures so the $k display & salary filter stay comparable.
        min: toK(j.min_annual_salary_usd),
        max: toK(j.max_annual_salary_usd),
        type: inferType(j.employment_statuses, title),
        level: LEVEL[j.seniority] || "Mid",
        source: SOURCE,
        url: j.final_url || j.url,
        postedAt: toISO(j.date_posted),
        posted: daysAgo(j.date_posted),
        skills: extractSkills(`${description} ${slugs}`),
        summary: summarize(description),
      });
    });
  } catch (err) {
    console.warn(`[theirstack] ${err.message}`);
    return [];
  }
}
