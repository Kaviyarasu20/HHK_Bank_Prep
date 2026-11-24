/**
 * Deterministic Spaced-Repetition Review Scheduler for HHK Flashcards.
 * Configurable initial intervals:
 *   again -> same day (0 days / +4 hours)
 *   hard  -> 1 day
 *   good  -> 3 days (scales progressively with consecutive successes up to 30 days)
 *   easy  -> 7 days (scales progressively with consecutive successes up to 60 days)
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_INTERVALS = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7,
};

export function computeNextFlashcardReview({
  response,
  previousIntervalDays = 0,
  successfulReviews = 0,
  missedReviews = 0,
  now = new Date(),
} = {}) {
  const resp = String(response || "").toLowerCase();
  if (!["again", "hard", "good", "easy"].includes(resp)) {
    throw new Error(`Invalid flashcard response "${response}". Expected again|hard|good|easy.`);
  }

  const prev = Math.max(0, Number(previousIntervalDays) || 0);
  let nextIntervalDays = DEFAULT_INTERVALS[resp];
  let nextSuccessful = Math.max(0, Number(successfulReviews) || 0);
  let nextMissed = Math.max(0, Number(missedReviews) || 0);

  if (resp === "again") {
    nextIntervalDays = 0;
    nextSuccessful = 0;
    nextMissed += 1;
    return {
      response: resp,
      previousIntervalDays: prev,
      nextIntervalDays,
      successfulReviews: nextSuccessful,
      missedReviews: nextMissed,
      nextReviewAt: new Date(now.getTime() + 4 * HOUR_MS).toISOString(),
    };
  }

  if (resp === "hard") {
    nextIntervalDays = Math.max(1, prev > 1 ? Math.round(prev * 1.1) : 1);
    nextSuccessful += 1;
  } else if (resp === "good") {
    nextIntervalDays = prev === 0 ? 3 : Math.min(30, Math.max(3, Math.round(prev * 1.8)));
    nextSuccessful += 1;
  } else if (resp === "easy") {
    nextIntervalDays = prev === 0 ? 7 : Math.min(60, Math.max(7, Math.round(prev * 2.3)));
    nextSuccessful += 1;
  }

  return {
    response: resp,
    previousIntervalDays: prev,
    nextIntervalDays,
    successfulReviews: nextSuccessful,
    missedReviews: nextMissed,
    nextReviewAt: new Date(now.getTime() + nextIntervalDays * DAY_MS).toISOString(),
  };
}
