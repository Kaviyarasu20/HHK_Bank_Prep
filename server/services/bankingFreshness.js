/**
 * Banking Awareness Data Freshness Engine & Safe Read-Only Cache
 *
 * Computes category-specific verification freshness states:
 * - recently_verified
 * - verification_due
 * - outdated
 * - historical
 * - pending_verification
 */

export const VERIFICATION_INTERVAL_DAYS = {
  rates: 65, // Bi-monthly RBI MPC review cycle
  leaders: 90,
  limits: 120,
  regulatory_bodies: 180,
  institutions: 365,
  static_gk: 365,
  terminology: 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeFreshness(record, categoryKey, { now = new Date() } = {}) {
  const intervalDays = VERIFICATION_INTERVAL_DAYS[categoryKey] ?? 180;
  const status = String(record?.status || "draft").toLowerCase();

  // Historical records (archived, or leaders with past end_date, or limits past effective_until)
  if (status === "archived") {
    return { state: "historical", label: "Historical", daysSinceVerified: null, intervalDays };
  }
  if (record?.end_date && new Date(record.end_date) < now) {
    return { state: "historical", label: "Historical", daysSinceVerified: null, intervalDays };
  }
  if (record?.effective_until && new Date(record.effective_until) < now) {
    return { state: "outdated", label: "Expired Effective Date", daysSinceVerified: null, intervalDays };
  }

  if (!record?.verified_at) {
    return {
      state: "pending_verification",
      label: "Pending Verification",
      daysSinceVerified: null,
      intervalDays,
    };
  }

  const verifiedDate = new Date(record.verified_at);
  if (Number.isNaN(verifiedDate.getTime())) {
    return {
      state: "pending_verification",
      label: "Pending Verification",
      daysSinceVerified: null,
      intervalDays,
    };
  }

  const daysSince = Math.max(0, Math.floor((now.getTime() - verifiedDate.getTime()) / DAY_MS));
  if (daysSince > intervalDays * 1.5) {
    return { state: "outdated", label: "Outdated", daysSinceVerified: daysSince, intervalDays };
  }
  if (daysSince > intervalDays) {
    return {
      state: "verification_due",
      label: "Verification Due",
      daysSinceVerified: daysSince,
      intervalDays,
    };
  }
  return {
    state: "recently_verified",
    label: "Recently Verified",
    daysSinceVerified: daysSince,
    intervalDays,
  };
}

export function attachFreshness(row, categoryKey, now = new Date()) {
  if (!row) return row;
  return {
    ...row,
    freshness: computeFreshness(row, categoryKey, { now }),
  };
}

// --- Safe In-Memory Cache for Published Read-Only Overview Data ---
const CACHE_TTL_MS = 60_000;
const publishedCache = new Map();

export function getCachedPublished(key) {
  const entry = publishedCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    publishedCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedPublished(key, value, ttlMs = CACHE_TTL_MS) {
  publishedCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateBankingCache() {
  publishedCache.clear();
}
