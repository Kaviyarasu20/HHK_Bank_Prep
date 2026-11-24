/**
 * Transparent, deterministic Smart Revision priority calculator.
 * Configurable starting weights (normalized to 0–100).
 */

export const DEFAULT_SIGNAL_WEIGHTS = {
  repeated_incorrect: 25,
  low_topic_accuracy: 20,
  overdue_flashcards: 20,
  difficult_flashcards: 10,
  bookmarked: 10,
  high_priority: 10,
  slow_response: 5,
};

export function calculateRevisionPriority(signals = {}, customWeights = {}) {
  const weights = { ...DEFAULT_SIGNAL_WEIGHTS, ...(customWeights || {}) };
  let score = 0;
  const reasons = [];

  if (signals.repeatedIncorrect) {
    score += Number(weights.repeated_incorrect) || 0;
    reasons.push("Repeated incorrect answers");
  }
  if (signals.lowTopicAccuracy) {
    score += Number(weights.low_topic_accuracy) || 0;
    reasons.push("Weak topic performance");
  }
  if (signals.overdueFlashcard) {
    score += Number(weights.overdue_flashcards) || 0;
    reasons.push("Flashcard overdue for review");
  }
  if (signals.difficultFlashcard) {
    score += Number(weights.difficult_flashcards) || 0;
    reasons.push("Marked difficult / needs revision");
  }
  if (signals.bookmarked) {
    score += Number(weights.bookmarked) || 0;
    reasons.push("Bookmarked for revision");
  }
  if (signals.highPriorityBanking) {
    score += Number(weights.high_priority) || 0;
    reasons.push("Must Study banking topic");
  }
  if (signals.slowResponse) {
    score += Number(weights.slow_response) || 0;
    reasons.push("High average response time");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const priorityLevel =
    boundedScore >= 40 ? "must_study" : boundedScore >= 20 ? "important" : "additional";

  return {
    priorityScore: boundedScore,
    priorityLevel,
    reason: reasons.length ? reasons.join(" · ") : "Scheduled revision",
    signalsMatched: reasons,
  };
}
