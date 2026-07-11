/**
 * Countries the user can search from the filter panel. Kept in sync with the
 * server's `server/lib/countries.js`. Codes are two-letter ISO codes; India is
 * the default and comes first.
 */
export const COUNTRIES = [
  { code: "in", name: "India" },
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "sg", name: "Singapore" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "nl", name: "Netherlands" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "ch", name: "Switzerland" },
  { code: "at", name: "Austria" },
  { code: "be", name: "Belgium" },
  { code: "pl", name: "Poland" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "nz", name: "New Zealand" },
  { code: "za", name: "South Africa" },
];

/** The fallback region when the visitor's country can't be detected — India. */
export const DEFAULT_COUNTRY = "in";

/**
 * IANA timezone → ISO country code, limited to the regions we support. The
 * device timezone is the most reliable location signal available in the
 * browser, so it's tried first when guessing a default country.
 */
const TIMEZONE_COUNTRY = {
  // India
  "Asia/Kolkata": "in", "Asia/Calcutta": "in",
  // United States
  "America/New_York": "us", "America/Detroit": "us", "America/Chicago": "us",
  "America/Denver": "us", "America/Phoenix": "us", "America/Los_Angeles": "us",
  "America/Anchorage": "us", "America/Boise": "us", "America/Indiana/Indianapolis": "us",
  "America/Kentucky/Louisville": "us", "Pacific/Honolulu": "us",
  // United Kingdom
  "Europe/London": "gb",
  // Canada
  "America/Toronto": "ca", "America/Vancouver": "ca", "America/Edmonton": "ca",
  "America/Winnipeg": "ca", "America/Halifax": "ca", "America/St_Johns": "ca",
  "America/Montreal": "ca", "America/Regina": "ca",
  // Australia
  "Australia/Sydney": "au", "Australia/Melbourne": "au", "Australia/Brisbane": "au",
  "Australia/Perth": "au", "Australia/Adelaide": "au", "Australia/Hobart": "au",
  "Australia/Darwin": "au",
  // Singapore
  "Asia/Singapore": "sg",
  // Germany
  "Europe/Berlin": "de", "Europe/Busingen": "de",
  // France
  "Europe/Paris": "fr",
  // Netherlands
  "Europe/Amsterdam": "nl",
  // Spain
  "Europe/Madrid": "es", "Africa/Ceuta": "es", "Atlantic/Canary": "es",
  // Italy
  "Europe/Rome": "it",
  // Switzerland
  "Europe/Zurich": "ch",
  // Austria
  "Europe/Vienna": "at",
  // Belgium
  "Europe/Brussels": "be",
  // Poland
  "Europe/Warsaw": "pl",
  // Brazil
  "America/Sao_Paulo": "br", "America/Bahia": "br", "America/Fortaleza": "br",
  "America/Recife": "br", "America/Manaus": "br", "America/Belem": "br",
  // Mexico
  "America/Mexico_City": "mx", "America/Monterrey": "mx", "America/Tijuana": "mx",
  "America/Merida": "mx", "America/Cancun": "mx", "America/Chihuahua": "mx",
  // New Zealand
  "Pacific/Auckland": "nz",
  // South Africa
  "Africa/Johannesburg": "za",
};

/** The two-letter region subtag of a locale (e.g. "en-IN" → "in"), or "". */
function regionFromLocale(tag) {
  try {
    const region = new Intl.Locale(tag).region;
    return region ? region.toLowerCase() : "";
  } catch {
    return "";
  }
}

/** Ordered country-code guesses from the device: timezone first, then locale. */
function detectCandidates() {
  const out = [];
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_COUNTRY[tz]) out.push(TIMEZONE_COUNTRY[tz]);
  } catch {
    /* Intl unavailable — skip */
  }
  try {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const langs = nav ? (nav.languages?.length ? nav.languages : [nav.language]) : [];
    for (const tag of langs) {
      const region = regionFromLocale(tag);
      if (region) out.push(region);
    }
  } catch {
    /* navigator unavailable — skip */
  }
  return out;
}

/**
 * Best guess at the visitor's country, constrained to the supported list.
 * Prefers the device timezone (reflects location), then the browser locale's
 * region, and falls back to {@link DEFAULT_COUNTRY}. Safe to call anywhere —
 * returns the default when browser APIs are unavailable.
 */
export function detectCountry() {
  const supported = new Set(COUNTRIES.map((c) => c.code));
  for (const code of detectCandidates()) {
    if (supported.has(code)) return code;
  }
  return DEFAULT_COUNTRY;
}
