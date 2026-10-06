// Small TTL cache for master data (products, BOM, work centers, routing;
// development plan 2.1). Transactional data (orders, stock, ATP, load) is
// never cached. Keys should include the source, so mock and s4 never mix.

const TTL_MS = 5 * 60 * 1000

const entries = new Map()

/** Returns the cached value for key, or runs load() and caches its promise. A failed load is not cached. */
export function cached(key, load, ttlMs = TTL_MS) {
  const hit = entries.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = Promise.resolve()
    .then(load)
    .catch(e => {
      entries.delete(key)
      throw e
    })
  entries.set(key, { value, expires: Date.now() + ttlMs })
  return value
}

/** Empties the cache (resetDemo, phase 2.4). */
export function clearCache() {
  entries.clear()
}
