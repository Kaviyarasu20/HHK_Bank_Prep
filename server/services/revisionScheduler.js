import { computeNextFlashcardReview } from "./caFlashcardReviewScheduler.js";

/**
 * Configurable 6-stage spaced-revision scheduler.
 * Reuses Phase 7 computeNextFlashcardReview for flashcard items so schedules never conflict.
 * Never marks content as mastered merely because a student opened it.
 */

export const REVISION_STAGE_INTERVALS_DAYS = [0, 1, 3, 7, 15, 30];
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function scheduleNextRevision({
  contentType = "article",
  outcome = "good",
  currentStage = 0,
  previousIntervalDays = 0,
  successfulReviews = 0,
  missedReviews = 0,
  now = new Date(),
} = {}) {
  const normOutcome = String(outcome || "good").toLowerCase();

  // Reuse Phase 7 flashcard scheduler for flashcard items to prevent conflicting schedules
  if (contentType === "flashcard" && ["again", "hard", "good", "easy"].includes(normOutcome)) {
    const fc = computeNextFlashcardReview({
      response: normOutcome,
      previousIntervalDays,
      successfulReviews,
      missedReviews,
      now,
    });
    const nextStage =
      normOutcome === "again" ? 0 : Math.min(5, Math.max(1, Number(currentStage) + 1));
    const revisionState =
      normOutcome === "again" || normOutcome === "hard"
        ? "needs_improvement"
        : nextStage >= 5
          ? "mastered"
          : "reviewed";
    return {
      nextStage,
      nextIntervalDays: fc.nextIntervalDays,
      nextDueAt: fc.nextReviewAt,
      revisionState,
    };
  }

  let stage = Math.max(0, Math.min(5, Number(currentStage) || 0));
  let nextStage = stage;
  let intervalDays = REVISION_STAGE_INTERVALS_DAYS[stage] ?? 1;
  let revisionState = "reviewed";

  if (normOutcome === "again" || normOutcome === "difficult") {
    nextStage = 0;
    intervalDays = 0;
    revisionState = "needs_improvement";
    return {
      nextStage,
      nextIntervalDays: intervalDays,
      nextDueAt: new Date(now.getTime() + 4 * HOUR_MS).toISOString(),
      revisionState,
    };
  }

  if (normOutcome === "hard") {
    nextStage = Math.max(1, stage);
    intervalDays = 1;
    revisionState = "needs_improvement";
  } else if (normOutcome === "good" || normOutcome === "reviewed") {
    nextStage = Math.min(5, stage + 1);
    intervalDays = REVISION_STAGE_INTERVALS_DAYS[nextStage];
    revisionState = nextStage >= 5 ? "mastered" : "reviewed";
  } else if (normOutcome === "easy" || normOutcome === "understood") {
    nextStage = Math.min(5, stage + 2);
    intervalDays = REVISION_STAGE_INTERVALS_DAYS[nextStage];
    revisionState = nextStage >= 5 ? "mastered" : "reviewed";
  } else {
    throw new Error(`Unsupported revision outcome "${outcome}".`);
  }

  return {
    nextStage,
    nextIntervalDays: intervalDays,
    nextDueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    revisionState,
  };
}
