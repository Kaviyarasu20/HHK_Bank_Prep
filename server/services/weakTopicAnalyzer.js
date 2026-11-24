/**
 * Deterministic Weak Topic Analyzer with configurable minimum-data thresholds.
 * - Requires at least minAttempts (default 5) before flagging a topic as weak.
 * - Never counts unanswered questions as incorrect.
 * - Only produces factual explanations supported by actual attempt counts.
 */

export const DEFAULT_WEAK_TOPIC_CONFIG = {
  minAttempts: 5,
  weakAccuracyThreshold: 65, // percent
  slowResponseThresholdSec: 75,
};

export function analyzeWeakTopics(topicStats = [], config = {}) {
  const cfg = { ...DEFAULT_WEAK_TOPIC_CONFIG, ...(config || {}) };
  const weakTopics = [];

  for (const row of topicStats) {
    const topicName = String(row.topic_name || row.topicName || "").trim();
    const attempts = Number(row.attempts_count ?? row.attempts ?? 0);
    const incorrect = Number(row.incorrect_count ?? row.incorrect ?? 0);
    const avgSec = Math.round(Number(row.avg_response_seconds ?? row.avgSec ?? 0));

    if (!topicName || attempts < cfg.minAttempts) continue;

    const accuracy = Number((((attempts - incorrect) / attempts) * 100).toFixed(2));
    const isLowAccuracy = accuracy < cfg.weakAccuracyThreshold;
    const isSlow = avgSec >= cfg.slowResponseThresholdSec;

    if (!isLowAccuracy && !isSlow) continue;

    const parts = [];
    if (isLowAccuracy) {
      parts.push(`You answered ${incorrect} of ${attempts} questions incorrectly in this topic (${accuracy}% accuracy).`);
    }
    if (isSlow) {
      parts.push(`Average response time is ${avgSec}s per question.`);
    }

    weakTopics.push({
      topicName,
      attemptsCount: attempts,
      incorrectCount: incorrect,
      accuracyPercent: accuracy,
      avgResponseSeconds: avgSec,
      isSlow,
      explanation: parts.join(" "),
    });
  }

  return weakTopics.sort((a, b) => a.accuracyPercent - b.accuracyPercent);
}
