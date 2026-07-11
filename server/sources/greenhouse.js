import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import { matchesCountry } from "../lib/countries.js";
import {
  buildJob, makeId, summarize, describe, extractSkills,
  inferLevel, inferType, inferRemote, daysAgo, toISO,
} from "../lib/normalize.js";

const SOURCE = "Greenhouse";

/** Turn a board token ("cloudflare") into a display company ("Cloudflare"). */
function displayName(token) {
  return String(token)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Fetch and normalize a single Greenhouse company board. */
async function fetchBoard(token, country) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const company = displayName(token);

  try {
    const data = await fetchJson(url);
    return (data?.jobs || [])
      .map((j) => {
        const description = j.content || "";
        const location = j.location?.name || "";
        return buildJob({
          id: makeId(SOURCE, `${token}:${j.id}`),
          title: j.title,
          company,
          location,
          remote: inferRemote({ location, text: description }),
          type: inferType(j.title),
          level: inferLevel(j.title),
          source: SOURCE,
          url: j.absolute_url,
          postedAt: toISO(j.updated_at),
          posted: daysAgo(j.updated_at),
          skills: extractSkills(description),
          summary: summarize(description),
          description: describe(description),
        });
      })
      .filter((job) => matchesCountry(job, country));
  } catch (err) {
    console.warn(`[greenhouse:${token}] ${err.message}`);
    return [];
  }
}

/**
 * Greenhouse public Job Board API — one board per company, no key required.
 * Boards are configured in `server/config.js` (or GREENHOUSE_BOARDS in .env).
 * Company boards have no country param, so results are filtered to the selected
 * country locally (remote roles always pass). Returns [] when no boards are set.
 */
export async function fetchGreenhouse(_query = "", country = "") {
  const boards = config.greenhouse.boards;
  if (!boards.length) return [];

  const settled = await Promise.allSettled(boards.map((t) => fetchBoard(t, country)));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
