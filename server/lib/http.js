import { config } from "../config.js";

/**
 * fetch() wrapped with an AbortController timeout so a single slow upstream
 * source can never hang the whole aggregation. Returns parsed JSON.
 */
export async function fetchJson(url, options = {}, timeoutMs = config.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
