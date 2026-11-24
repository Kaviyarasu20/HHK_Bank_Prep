/**
 * Safe Bounded TTL In-Memory Cache for Public / Read-Only Aggregates.
 * - Strictly for non-user-specific, non-subscription-sensitive read-only data
 *   (e.g., published category lists, read-only admin analytics aggregates).
 * - Never caches draft content or per-student private records.
 * - Supports explicit prefix invalidation on admin mutations.
 */

const MAX_ENTRIES = 200;

export class SafeTtlCache {
  constructor({ maxEntries = MAX_ENTRIES } = {}) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 60_000) {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1_000, Number(ttlMs) || 60_000),
    });
  }

  invalidatePrefix(prefix) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

export const platformSafeCache = new SafeTtlCache();
