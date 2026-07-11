/**
 * The countries the app can search. Codes are two-letter ISO codes that double
 * as Adzuna country paths, SerpApi `gl` values and JSearch `country` params, so
 * one list drives every localizable source. India is first — it's the default.
 *
 * `tokens` are lowercase substrings used to keep company-board (Greenhouse /
 * Lever) listings whose free-text location matches the selected country. They
 * default to the country name; big markets add a few major cities. Remote roles
 * always pass, regardless of tokens.
 */
export const COUNTRIES = [
  { code: "in", name: "India", tokens: ["india", "bengaluru", "bangalore", "hyderabad", "mumbai", "delhi", "pune", "chennai", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad"] },
  { code: "us", name: "United States", tokens: ["united states", "usa", "u.s.", "san francisco", "new york", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "atlanta"] },
  { code: "gb", name: "United Kingdom", tokens: ["united kingdom", "uk", "england", "london", "manchester", "edinburgh"] },
  { code: "ca", name: "Canada", tokens: ["canada", "toronto", "vancouver", "montreal", "ottawa"] },
  { code: "au", name: "Australia", tokens: ["australia", "sydney", "melbourne", "brisbane"] },
  { code: "sg", name: "Singapore", tokens: ["singapore"] },
  { code: "de", name: "Germany", tokens: ["germany", "berlin", "munich", "münchen", "hamburg", "frankfurt"] },
  { code: "fr", name: "France", tokens: ["france", "paris", "lyon"] },
  { code: "nl", name: "Netherlands", tokens: ["netherlands", "amsterdam", "rotterdam"] },
  { code: "es", name: "Spain", tokens: ["spain", "madrid", "barcelona"] },
  { code: "it", name: "Italy", tokens: ["italy", "milan", "rome", "roma"] },
  { code: "ch", name: "Switzerland", tokens: ["switzerland", "zurich", "zürich", "geneva"] },
  { code: "at", name: "Austria", tokens: ["austria", "vienna", "wien"] },
  { code: "be", name: "Belgium", tokens: ["belgium", "brussels"] },
  { code: "pl", name: "Poland", tokens: ["poland", "warsaw", "kraków", "krakow"] },
  { code: "br", name: "Brazil", tokens: ["brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro"] },
  { code: "mx", name: "Mexico", tokens: ["mexico", "méxico", "mexico city", "guadalajara"] },
  { code: "nz", name: "New Zealand", tokens: ["new zealand", "auckland", "wellington"] },
  { code: "za", name: "South Africa", tokens: ["south africa", "johannesburg", "cape town"] },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/** Resolve a country entry from a code, or null for unknown / "all". */
export function resolveCountry(code) {
  return BY_CODE.get(String(code || "").toLowerCase()) || null;
}

/** Display name for a code, or "" when unknown. */
export function countryName(code) {
  return resolveCountry(code)?.name || "";
}

/**
 * Does a normalized job belong to the selected country? Used to localize
 * company-board results (Greenhouse / Lever), which have no country API param.
 * Remote roles always match; an unknown country matches everything.
 */
export function matchesCountry(job, code) {
  const country = resolveCountry(code);
  if (!country) return true;
  if (job.remote === "Remote") return true;
  const loc = String(job.location || "").toLowerCase();
  if (!loc) return false;
  const tokens = country.tokens?.length ? country.tokens : [country.name.toLowerCase()];
  return tokens.some((t) => loc.includes(t));
}
