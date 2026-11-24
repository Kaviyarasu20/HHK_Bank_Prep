import { analyzeWeakTopics } from "./weakTopicAnalyzer.js";

/**
 * Student Performance Analytics Service (Strictly Student-Scoped).
 * - Aggregates real persisted performance across CBT attempts, GA Marathon,
 *   Current Affairs reading, Flashcards, Smart Revision, and Monthly Capsules.
 * - Uses the minimum-attempt threshold (5) from `analyzeWeakTopics` before
 *   classifying any topic as weak.
 * - Never fabricates percentiles or official exam outcome predictions.
 */

export async function getStudentPerformanceAnalytics(studentId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;

  const [overallRes, trendsRes, topicRes, learningRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total_attempts,
         COUNT(*) FILTER (WHERE status IN ('submitted', 'auto_submitted'))::int AS completed_tests,
         COALESCE(ROUND(AVG(score) FILTER (WHERE status IN ('submitted', 'auto_submitted')), 2), 0)::numeric AS avg_score,
         COALESCE(MAX(score) FILTER (WHERE status IN ('submitted', 'auto_submitted')), 0)::numeric AS best_score,
         COALESCE(SUM(correct_count) FILTER (WHERE status IN ('submitted', 'auto_submitted')), 0)::int AS total_correct,
         COALESCE(SUM(wrong_count) FILTER (WHERE status IN ('submitted', 'auto_submitted')), 0)::int AS total_incorrect,
         COALESCE(SUM(unanswered_count) FILTER (WHERE status IN ('submitted', 'auto_submitted')), 0)::int AS total_unanswered
       FROM test_attempts
       WHERE student_id = $1`,
      [studentId],
    ),
    pool.query(
      `SELECT
         TO_CHAR(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
         COUNT(*)::int AS tests_completed,
         ROUND(AVG(score), 2)::numeric AS avg_score,
         COALESCE(SUM(correct_count), 0)::int AS correct,
         COALESCE(SUM(wrong_count), 0)::int AS incorrect
       FROM test_attempts
       WHERE student_id = $1
         AND status IN ('submitted', 'auto_submitted')
         AND submitted_at IS NOT NULL
         AND submitted_at >= NOW() - INTERVAL '30 days'
       GROUP BY 1
       ORDER BY 1 ASC`,
      [studentId],
    ),
    pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(q.topic_name), ''), t.name, 'General') AS topic_name,
         COUNT(*)::int AS attempts_count,
         SUM(CASE WHEN sa.selected_answer = q.correct_answer THEN 0 ELSE 1 END)::int AS incorrect_count,
         ROUND(AVG(COALESCE(sa.time_spent_seconds, 0)))::int AS avg_response_seconds
       FROM student_answers sa
       JOIN test_attempts ta ON ta.id = sa.attempt_id
       JOIN questions q ON q.id = sa.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE ta.student_id = $1
         AND sa.selected_answer IS NOT NULL
       GROUP BY 1
       ORDER BY attempts_count DESC
       LIMIT 25`,
      [studentId],
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM current_affairs_reads WHERE student_id = $1 AND is_read = TRUE) AS articles_read,
         (SELECT COUNT(*)::int FROM current_affairs_reads WHERE student_id = $1 AND is_bookmarked = TRUE) AS articles_bookmarked,
         (SELECT COUNT(*)::int FROM current_affairs_flashcard_progress WHERE student_id = $1) AS flashcards_reviewed,
         (SELECT COUNT(*)::int FROM student_revision_history WHERE student_id = $1) AS revision_reviews_completed,
         (SELECT COUNT(*)::int FROM student_monthly_capsule_progress WHERE student_id = $1 AND status = 'completed') AS capsules_completed,
         (SELECT COUNT(*)::int FROM test_attempts ta JOIN mock_tests mt ON mt.id = ta.mock_test_id WHERE ta.student_id = $1 AND mt.test_type = 'GA_MARATHON' AND ta.status IN ('submitted', 'auto_submitted')) AS ga_marathons_completed`,
      [studentId],
    ),
  ]);

  const ov = overallRes.rows[0] || {};
  const totalCorrect = Number(ov.total_correct || 0);
  const totalIncorrect = Number(ov.total_incorrect || 0);
  const totalAttempted = totalCorrect + totalIncorrect;
  const averageAccuracy = totalAttempted > 0 ? Number(((totalCorrect / totalAttempted) * 100).toFixed(2)) : 0;

  const topicBreakdown = topicRes.rows.map((r) => {
    const att = Number(r.attempts_count || 0);
    const inc = Number(r.incorrect_count || 0);
    const cor = att - inc;
    return {
      topicName: r.topic_name,
      attemptsCount: att,
      correctCount: cor,
      incorrectCount: inc,
      accuracyPercent: att > 0 ? Number(((cor / att) * 100).toFixed(2)) : 0,
      avgResponseSeconds: Number(r.avg_response_seconds || 0),
    };
  });

  const weakTopics = analyzeWeakTopics(topicRes.rows);

  const trends = trendsRes.rows.map((r) => {
    const c = Number(r.correct || 0);
    const w = Number(r.incorrect || 0);
    return {
      date: r.date,
      testsCompleted: Number(r.tests_completed || 0),
      avgScore: Number(r.avg_score || 0),
      questionsAttempted: c + w,
      accuracyPercent: c + w > 0 ? Number(((c / (c + w)) * 100).toFixed(2)) : 0,
    };
  });

  return {
    overall: {
      totalAttempts: Number(ov.total_attempts || 0),
      completedTests: Number(ov.completed_tests || 0),
      averageScore: Number(ov.avg_score || 0),
      bestScore: Number(ov.best_score || 0),
      averageAccuracy,
      totalQuestionsAttempted: totalAttempted,
      correctAnswers: totalCorrect,
      incorrectAnswers: totalIncorrect,
      unansweredQuestions: Number(ov.total_unanswered || 0),
    },
    learningProgress: learningRes.rows[0] || {},
    topicBreakdown,
    weakTopics,
    trends,
  };
}
