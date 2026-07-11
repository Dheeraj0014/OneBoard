/**
 * Tiny in-memory TTL cache with stale-while-revalidate semantics so we don't
 * hammer upstream APIs (and stay within their rate limits) on every request.
 *
 * Bounded: the aggregate cache is keyed by region:query, which is attacker-
 * chosen, so an unbounded store would grow forever under a loop over distinct
 * queries. `maxEntries` evicts least-recently-used keys once the ceiling is hit.
 */
export function createCache(ttlMs, maxEntries = 300) {
  // A Map iterates in insertion order, which is what makes LRU cheap here:
  // re-inserting a key on read moves it to the newest end, so the first key
  // yielded by keys() is always the least-recently-used one.
  const store = new Map();

  /** Mark a key as most-recently-used. */
  function touch(key, entry) {
    store.delete(key);
    store.set(key, entry);
  }

  function put(key, value) {
    if (store.has(key)) store.delete(key);
    store.set(key, { value, at: Date.now() });
    while (store.size > maxEntries) {
      // Oldest insertion === least recently used.
      store.delete(store.keys().next().value);
    }
  }

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

      if (hit && now - hit.at < ttlMs) {
        touch(cacheKey, hit);
        return hit.value;
      }

      if (hit) {
        // Stale: refresh in the background, return stale immediately.
        touch(cacheKey, hit);
        producer()
          .then((value) => { if (shouldCache(value)) put(cacheKey, value); })
          .catch(() => {});
        return hit.value;
      }

      const value = await producer();
      if (shouldCache(value)) put(cacheKey, value);
      return value;
    },

    get size() {
      return store.size;
    },

    clear() {
      store.clear();
    },
  };
}
