import { config } from "../config.js";
import { fetchJson } from "../lib/http.js";
import { matchesCountry } from "../lib/countries.js";
import {
  buildJob, makeId, summarize, describe, extractSkills,
  inferLevel, inferType, inferRemote, daysAgo, toISO,
} from "../lib/normalize.js";

const SOURCE = "Lever";

/** Turn a board token ("leadiq") into a display company ("Leadiq"). */
function displayName(token) {
  return String(token)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Fetch and normalize a single Lever posting board. */
async function fetchBoard(token, country) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
  const company = displayName(token);

  try {
    const data = await fetchJson(url);
    const postings = Array.isArray(data) ? data : [];
    return postings
      .map((j) => {
        const cats = j.categories || {};
        const description = j.descriptionPlain || j.description || "";
        const location = cats.location || "";
        return buildJob({
          id: makeId(SOURCE, `${token}:${j.id}`),
          title: j.text,
          company,
          location,
          remote: inferRemote({ workplaceType: j.workplaceType, location, text: description }),
          type: inferType(cats.commitment, j.text),
          level: inferLevel(j.text),
          source: SOURCE,
          url: j.hostedUrl || j.applyUrl,
          postedAt: toISO(j.createdAt),
          posted: daysAgo(j.createdAt),
          skills: extractSkills(description, cats.team ? [cats.team] : []),
          summary: summarize(description),
          description: describe(description),
        });
      })
      .filter((job) => matchesCountry(job, country));
  } catch (err) {
    console.warn(`[lever:${token}] ${err.message}`);
    return [];
  }
}

/**
 * Lever public Postings API — one board per company, no key required. Boards are
 * configured in `server/config.js` (or LEVER_BOARDS in .env). Like Greenhouse,
 * results are filtered to the selected country locally (remote roles pass).
 * Returns [] when no boards are configured.
 */
export async function fetchLever(_query = "", country = "") {
  const boards = config.lever.boards;
  if (!boards.length) return [];

  const settled = await Promise.allSettled(boards.map((t) => fetchBoard(t, country)));
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
