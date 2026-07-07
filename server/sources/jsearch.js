import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import {
  buildJob, makeId, summarize, extractSkills, toK,
  inferLevel, daysAgo, toISO,
} from "../lib/normalize.js";

const EMP_TYPE = {
  FULLTIME: "Full-time",
  CONTRACTOR: "Contract",
  PARTTIME: "Part-time",
  INTERN: "Full-time",
};

/**
 * JSearch (via RapidAPI) aggregates Google-for-Jobs results — including
 * listings originally from LinkedIn, Indeed, Glassdoor, etc. — under RapidAPI's
 * license. Requires a key and a search query. Returns [] when unconfigured.
 */
export async function fetchJSearch(query = "") {
  if (!config.jsearch.enabled || !query) return [];

  const params = new URLSearchParams({ query, page: "1", num_pages: "1" });
  const url = `https://${config.jsearch.host}/search?${params}`;

  try {
    const data = await fetchJson(url, {
      headers: {
        "X-RapidAPI-Key": config.jsearch.key,
        "X-RapidAPI-Host": config.jsearch.host,
      },
    });

    return (data?.data || []).map((j) => {
      const description = j.job_description || "";
      const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ");
      const source = j.job_publisher || "JSearch";
      return buildJob({
        id: makeId("jsearch", j.job_id),
        title: j.job_title,
        company: j.employer_name || "Company",
        location,
        remote: j.job_is_remote ? "Remote" : (/hybrid/i.test(description) ? "Hybrid" : "On-site"),
        min: toK(j.job_min_salary),
        max: toK(j.job_max_salary),
        type: EMP_TYPE[j.job_employment_type] || "Full-time",
        level: inferLevel(j.job_title),
        // Attribute to the original publisher (LinkedIn/Indeed/...) when known.
        source,
        url: j.job_apply_link,
        postedAt: toISO(j.job_posted_at_timestamp ? j.job_posted_at_timestamp * 1000 : j.job_posted_at_datetime_utc),
        posted: daysAgo(j.job_posted_at_timestamp ? j.job_posted_at_timestamp * 1000 : j.job_posted_at_datetime_utc),
        skills: extractSkills(description, Array.isArray(j.job_required_skills) ? j.job_required_skills : []),
        summary: summarize(description),
      });
    });
  } catch (err) {
    console.warn(`[jsearch] ${err.message}`);
    return [];
  }
}
