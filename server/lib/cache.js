/**
 * Tiny in-memory TTL cache with stale-while-revalidate semantics so we don't
 * hammer upstream APIs (and stay within their rate limits) on every request.
 */
export function createCache(ttlMs) {
  const store = new Map();

  return {
    /**
     * Returns cached value if fresh; otherwise runs `producer`. If a stale
     * value exists it is served immediately while a refresh runs in the
     * background. `shouldCache(value)` gates whether a freshly produced value
     * is stored — used to avoid caching empty/failed result sets.
     */
    async get(cacheKey, producer, shouldCache = () => true) {
      const hit = store.get(cacheKey);
      const now = Date.now();

      if (hit && now - hit.at < ttlMs) return hit.value;

      if (hit) {
        // Stale: refresh in the background, return stale immediately.
        producer()
          .then((value) => { if (shouldCache(value)) store.set(cacheKey, { value, at: Date.now() }); })
          .catch(() => {});
        return hit.value;
      }

      const value = await producer();
      if (shouldCache(value)) store.set(cacheKey, { value, at: Date.now() });
      return value;
    },

    clear() {
      store.clear();
    },
  };
}
