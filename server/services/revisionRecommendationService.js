import { calculateRevisionPriority, DEFAULT_SIGNAL_WEIGHTS } from "./revisionPriorityCalculator.js";

/**
 * Deterministic Daily Revision Plan & Recommendation Builder.
 * - Combines scored revision items across content types.
 * - Applies configurable daily item limit (default 15, bounded 3–50).
 * - Deduplicates by (contentType, contentId) and sorts deterministically by
 *   priorityScore DESC, overdue status DESC, dueAt ASC.
 * - Never fabricates placeholder or mock items when a student has no signals.
 */

export const DEFAULT_DAILY_ITEM_LIMIT = 15;

export function normalizeDailyLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_DAILY_ITEM_LIMIT;
  return Math.max(3, Math.min(50, Math.round(n)));
}

export function estimateMinutesForContentType(contentType) {
  switch (contentType) {
    case "flashcard":
      return 1;
    case "one_liner":
      return 1;
    case "mcq":
      return 2;
    case "banking_reference":
      return 3;
    case "article":
    default:
      return 4;
  }
}

export function buildDailyRevisionPlan({
  candidates = [],
  dailyLimit = DEFAULT_DAILY_ITEM_LIMIT,
  customWeights = DEFAULT_SIGNAL_WEIGHTS,
  now = new Date(),
} = {}) {
  const limit = normalizeDailyLimit(dailyLimit);
  const nowMs = now.getTime();
  const dedup = new Map();

  for (const raw of candidates) {
    const contentType = String(raw.contentType || raw.content_type || "").trim();
    const contentId = String(raw.contentId || raw.content_id || "").trim();
    if (!contentType || !contentId) continue;

    const key = `${contentType}:${contentId}`;
    const scored =
      typeof raw.priorityScore === "number" && raw.recommendationReason
        ? {
            priorityScore: raw.priorityScore,
            priorityLevel:
              raw.priorityLevel ||
              (raw.priorityScore >= 40 ? "must_study" : raw.priorityScore >= 20 ? "important" : "additional"),
            reason: raw.recommendationReason,
          }
        : calculateRevisionPriority(raw.signals || {}, customWeights);

    const dueAtMs = raw.dueAt ? new Date(raw.dueAt).getTime() : nowMs;
    const isOverdue = Number.isFinite(dueAtMs) && dueAtMs <= nowMs;

    const existing = dedup.get(key);
    if (!existing || scored.priorityScore > existing.priorityScore) {
      dedup.set(key, {
        id: raw.id || null,
        contentType,
        contentId,
        title: String(raw.title || "Revision Item").trim(),
        category: raw.category || null,
        topic: raw.topic || null,
        priorityScore: scored.priorityScore,
        priorityLevel: scored.priorityLevel,
        recommendationReason: scored.reason,
        revisionState: raw.revisionState || "pending",
        revisionStage: Number(raw.revisionStage ?? 0),
        estimatedMinutes: Number(raw.estimatedMinutes) || estimateMinutesForContentType(contentType),
        dueAt: raw.dueAt || now.toISOString(),
        isOverdue,
      });
    }
  }

  const sorted = Array.from(dedup.values()).sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aDue = new Date(a.dueAt).getTime();
    const bDue = new Date(b.dueAt).getTime();
    if (aDue !== bDue) return aDue - bDue;
    return `${a.contentType}:${a.contentId}`.localeCompare(`${b.contentType}:${b.contentId}`);
  });

  const selected = sorted.slice(0, limit);
  const totalEstimatedMinutes = selected.reduce((sum, item) => sum + (item.estimatedMinutes || 1), 0);

  const breakdown = {
    must_study: selected.filter((i) => i.priorityLevel === "must_study").length,
    important: selected.filter((i) => i.priorityLevel === "important").length,
    additional: selected.filter((i) => i.priorityLevel === "additional").length,
    overdue: selected.filter((i) => i.isOverdue).length,
  };

  return {
    items: selected,
    totalItems: selected.length,
    totalCandidates: sorted.length,
    totalEstimatedMinutes,
    breakdown,
  };
}
