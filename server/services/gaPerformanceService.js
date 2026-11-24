/**
 * GA Marathon Student Performance & Deterministic Test Recommendation Service.
 * - Aggregates real GA Marathon attempt statistics from `test_attempts` + `ga_marathon_configs`.
 * - Never fabricates metrics or percentiles.
 * - Recommends published GA Marathon tests deterministically using target exams,
 *   weak topics, unattempted status, and capsule links.
 */

export function rankRecommendedGaTests({
  tests = [],
  targetExams = [],
  weakTopics = [],
  attemptedTestIds = new Set(),
} = {}) {
  const targetSet = new Set((targetExams || []).map((e) => String(e).toLowerCase()));
  const weakSet = new Set((weakTopics || []).map((t) => String(t).toLowerCase()));

  const scored = tests.map((t) => {
    let score = 0;
    const reasons = [];

    const testExams = Array.isArray(t.target_exams) ? t.target_exams : [];
    const examMatch = testExams.find((e) => targetSet.has(String(e).toLowerCase()));
    if (examMatch) {
      score += 35;
      reasons.push(`Matches your target exam (${examMatch})`);
    }

    const topicText = `${t.name || ""} ${t.description || ""} ${t.ga_category || ""}`.toLowerCase();
    const weakMatch = Array.from(weakSet).find((wt) => wt && topicText.includes(wt));
    if (weakMatch) {
      score += 30;
      reasons.push(`Targets your weak topic (${weakMatch})`);
    }

    if (!attemptedTestIds.has(t.id)) {
      score += 20;
      reasons.push("Unattempted GA Marathon test");
    }

    if (t.capsule_id) {
      score += 10;
      reasons.push("Linked to a Monthly Revision Capsule");
    }

    if (t.has_access) {
      score += 5;
    }

    return {
      ...t,
      recommendation_score: score,
      recommendation_reason: reasons.length ? reasons.join(" · ") : "Available GA Marathon test",
    };
  });

  return scored
    .sort((a, b) => {
      if (b.recommendation_score !== a.recommendation_score) {
        return b.recommendation_score - a.recommendation_score;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    })
    .slice(0, 6);
}

export async function getStudentGaPerformance(studentId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted'))::int AS completed_tests,
       COUNT(*) FILTER (WHERE ta.status = 'in_progress')::int AS in_progress_tests,
       COALESCE(SUM(ta.correct_count + ta.wrong_count) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted')), 0)::int AS total_questions_attempted,
       COALESCE(SUM(ta.correct_count) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted')), 0)::int AS total_correct,
       COALESCE(ROUND(AVG(ta.score) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted')), 2), 0)::numeric AS avg_score,
       COALESCE(MAX(ta.score) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted')), 0)::numeric AS best_score,
       COALESCE(ROUND(AVG(CASE WHEN gmc.ga_category IN ('current_affairs', 'daily_ga', 'weekly_marathon', 'monthly_marathon')
         AND (ta.correct_count + ta.wrong_count) > 0
         THEN (ta.correct_count::numeric / (ta.correct_count + ta.wrong_count)) * 100 END), 2), 0)::numeric AS current_affairs_accuracy,
       COALESCE(ROUND(AVG(CASE WHEN gmc.ga_category IN ('banking_awareness', 'static_banking_gk')
         AND (ta.correct_count + ta.wrong_count) > 0
         THEN (ta.correct_count::numeric / (ta.correct_count + ta.wrong_count)) * 100 END), 2), 0)::numeric AS banking_awareness_accuracy
     FROM test_attempts ta
     JOIN mock_tests mt ON mt.id = ta.mock_test_id
     JOIN ga_marathon_configs gmc ON gmc.mock_test_id = mt.id
     WHERE ta.student_id = $1
       AND mt.test_type = 'GA_MARATHON'`,
    [studentId],
  );

  const s = rows[0] || {};
  const attempted = Number(s.total_questions_attempted || 0);
  const correct = Number(s.total_correct || 0);
  const overallAccuracy = attempted > 0 ? Number(((correct / attempted) * 100).toFixed(2)) : 0;

  return {
    completedTests: Number(s.completed_tests || 0),
    inProgressTests: Number(s.in_progress_tests || 0),
    totalQuestionsAttempted: attempted,
    overallAccuracy,
    averageScore: Number(s.avg_score || 0),
    bestScore: Number(s.best_score || 0),
    currentAffairsAccuracy: Number(s.current_affairs_accuracy || 0),
    bankingAwarenessAccuracy: Number(s.banking_awareness_accuracy || 0),
  };
}
