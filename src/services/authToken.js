/**
 * Bridges Clerk's session token into the service layer.
 *
 * The service modules are plain functions, not components, so they cannot call
 * useAuth() themselves. A component inside ClerkProvider registers Clerk's
 * getToken here once (see hooks/useApiAuth.js), and the services read it when
 * calling the routes the server protects.
 */

let getToken = async () => null;

/** Register Clerk's getToken. Called from inside ClerkProvider, not at import time. */
export function setTokenGetter(fn) {
  getToken = typeof fn === "function" ? fn : async () => null;
}

/**
 * Add the caller's Clerk session to a set of request headers.
 *
 * Signed out, the headers come back unchanged and the server answers 401. The
 * callers treat that as "AI unavailable" and fall back to their local heuristic,
 * so the app keeps working — it just stops spending Anthropic credits.
 */
export async function withAuth(headers = {}) {
  const token = await getToken().catch(() => null);
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}
