/**
 * Student Attempt Analytics Engine
 *
 * Computes:
 *  - Topic-wise performance (attempted, correct, wrong, unattempted, score, accuracy, avg time)
 *  - Difficulty-wise performance (easy / medium / hard breakdown)
 *  - Topic-wise strengths & weaknesses (combining current attempt + optional historical attempts)
 */

function toAccuracy(correct, attempted) {
  if (!attempted) return 0;
  return Number(((correct / attempted) * 100).toFixed(1));
}

function round2(n) {
  return Number(Number(n || 0).toFixed(2));
}

/**
 * Pure computation helper (testable without database).
 * Accepts an array of answer rows:
 *   { topic_name, difficulty, selected_answer, correct_answer, question_type, marks, negative_marks, manual_score, time_spent_seconds }
 */
export function computeAttemptBreakdown(answerRows = []) {
  const topicMap = new Map();
  const diffMap = new Map([
    ["easy", { difficulty: "easy", total: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, score: 0, maxScore: 0, timeSpentSeconds: 0 }],
    ["medium", { difficulty: "medium", total: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, score: 0, maxScore: 0, timeSpentSeconds: 0 }],
    ["hard", { difficulty: "hard", total: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, score: 0, maxScore: 0, timeSpentSeconds: 0 }],
  ]);

  for (const row of answerRows) {
    const topic = String(row.topic_name || "General").trim() || "General";
    const diffRaw = String(row.difficulty || "medium").trim().toLowerCase();
    const diff = ["easy", "medium", "hard"].includes(diffRaw) ? diffRaw : "medium";
    const mark = Number(row.marks ?? row.max_marks ?? 1);
    const penalty = Number(row.negative_marks ?? 0.25);
    const timeSec = Number(row.time_spent_seconds ?? 0);

    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        topicName: topic,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0,
        score: 0,
        maxScore: 0,
        timeSpentSeconds: 0,
      });
    }

    const tBucket = topicMap.get(topic);
    const dBucket = diffMap.get(diff);

    tBucket.total += 1;
    tBucket.maxScore += mark;
    tBucket.timeSpentSeconds += timeSec;

    dBucket.total += 1;
    dBucket.maxScore += mark;
    dBucket.timeSpentSeconds += timeSec;

    if (!row.selected_answer) {
      tBucket.unattempted += 1;
      dBucket.unattempted += 1;
    } else if (row.question_type === "descriptive") {
      if (row.manual_score !== null && row.manual_score !== undefined) {
        tBucket.attempted += 1;
        tBucket.score += Number(row.manual_score);
        dBucket.attempted += 1;
        dBucket.score += Number(row.manual_score);
      }
    } else if (String(row.selected_answer) === String(row.correct_answer)) {
      tBucket.attempted += 1;
      tBucket.correct += 1;
      tBucket.score += mark;
      dBucket.attempted += 1;
      dBucket.correct += 1;
      dBucket.score += mark;
    } else {
      tBucket.attempted += 1;
      tBucket.wrong += 1;
      tBucket.score -= penalty;
      dBucket.attempted += 1;
      dBucket.wrong += 1;
      dBucket.score -= penalty;
    }
  }

  const topicPerformance = Array.from(topicMap.values())
    .map((b) => ({
      ...b,
      score: round2(b.score),
      maxScore: round2(b.maxScore),
      accuracy: toAccuracy(b.correct, b.attempted),
      avgTimeSeconds: b.total ? Math.round(b.timeSpentSeconds / b.total) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.topicName.localeCompare(b.topicName));

  const difficultyPerformance = Array.from(diffMap.values())
    .filter((b) => b.total > 0)
    .map((b) => ({
      ...b,
      score: round2(b.score),
      maxScore: round2(b.maxScore),
      accuracy: toAccuracy(b.correct, b.attempted),
      avgTimeSeconds: b.total ? Math.round(b.timeSpentSeconds / b.total) : 0,
    }));

  return { topicPerformance, difficultyPerformance };
}

/**
 * Computes topic-wise strengths & weaknesses when sufficient historical data exists
 * (minimum 3 attempted questions per topic).
 */
export function computeStrengthsAndWeaknesses(historicalTopicRows = [], minSampleSize = 3) {
  const qualifying = historicalTopicRows
    .map((row) => {
      const attempted = Number(row.attempted ?? 0);
      const correct = Number(row.correct ?? 0);
      return {
        topicName: String(row.topic_name || row.topicName || "General"),
        attempted,
        correct,
        accuracy: toAccuracy(correct, attempted),
      };
    })
    .filter((item) => item.attempted >= minSampleSize);

  const strengths = qualifying
    .filter((item) => item.accuracy >= 75)
    .sort((a, b) => b.accuracy - a.accuracy || b.attempted - a.attempted)
    .slice(0, 5);

  const weaknesses = qualifying
    .filter((item) => item.accuracy < 60)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted)
    .slice(0, 5);

  return {
    hasSufficientData: qualifying.length > 0,
    minSampleSize,
    strengths,
    weaknesses,
  };
}
