import { platformSafeCache } from "./safeCacheService.js";
import { GA_SUPPORTED_EXAMS } from "./gaTestConfigurationService.js";

/**
 * Centralized Platform Analytics Service (Admin-Only).
 * - Computes all metrics directly from persisted PostgreSQL records (zero fabricated stats).
 * - Explicitly documents metric definitions, date ranges (UTC normalized), and
 *   financial integrity rules (distinguishing gross collected from failed/pending/refunded).
 */

export const ANALYTICS_METRIC_DEFINITIONS = {
  timezone: "UTC (ISO-8601 date boundaries)",
  activeStudentDefinition:
    "Distinct student_id with >= 1 activity in test_attempts, practice_sessions, current_affairs_reads, or student_revision_history within the selected window.",
  revenueDefinition:
    "Gross collected INR from payment_orders with status = 'PAID' only. Failed, pending, cancelled, and admin-granted entitlements are strictly excluded; refunds are reported separately.",
  gaAttemptDefinition:
    "Attempts on mock_tests where test_type = 'GA_MARATHON'. Completed = status IN ('submitted','auto_submitted'); Abandoned = in_progress past ends_at.",
};

export function normalizeDateRangeDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(365, Math.round(n)));
}

export function summarizeFinancialOrders(orders = [], refunds = []) {
  let paidCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  let grossCollectedPaise = 0;
  let totalRefundedPaise = 0;

  for (const o of orders) {
    const st = String(o.status || "").toUpperCase();
    const amt = Number(o.total_amount_paise ?? o.amount_paise ?? 0);
    if (st === "PAID") {
      paidCount += 1;
      grossCollectedPaise += amt;
    } else if (st === "FAILED") {
      failedCount += 1;
    } else if (st === "CREATED" || st === "PENDING") {
      pendingCount += 1;
    }
  }

  for (const r of refunds) {
    const st = String(r.status || "").toUpperCase();
    if (st === "PROCESSED" || st === "APPROVED" || st === "REFUNDED") {
      totalRefundedPaise += Number(r.approved_amount_paise ?? r.requested_amount_paise ?? 0);
    }
  }

  const finalized = paidCount + failedCount;
  return {
    paidOrdersCount: paidCount,
    failedOrdersCount: failedCount,
    pendingOrdersCount: pendingCount,
    grossCollectedPaise,
    grossCollectedInr: Number((grossCollectedPaise / 100).toFixed(2)),
    totalRefundedPaise,
    totalRefundedInr: Number((totalRefundedPaise / 100).toFixed(2)),
    netCollectedInr: Number(((grossCollectedPaise - totalRefundedPaise) / 100).toFixed(2)),
    paymentSuccessRatePercent: finalized > 0 ? Number(((paidCount / finalized) * 100).toFixed(2)) : 0,
    paymentFailureRatePercent: finalized > 0 ? Number(((failedCount / finalized) * 100).toFixed(2)) : 0,
  };
}

export async function getAdminPlatformAnalytics({ days = 30, dbPool, useCache = true } = {}) {
  const rangeDays = normalizeDateRangeDays(days);
  const cacheKey = `admin:analytics:v1:${rangeDays}`;
  if (useCache) {
    const cached = platformSafeCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const pool = dbPool || (await import("../db.js")).pool;

  const [overviewRes, activeRes, gaRes, contentRes, subRes, finRes, examRes] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS total_students,
         (SELECT COUNT(*)::int FROM users WHERE role = 'student' AND created_at >= NOW() - ($1 || ' days')::interval) AS new_registrations,
         (SELECT COUNT(*)::int FROM test_attempts) AS total_test_attempts,
         (SELECT COUNT(*)::int FROM test_attempts WHERE status IN ('submitted', 'auto_submitted')) AS completed_test_attempts,
         (SELECT COUNT(*)::int FROM mock_tests WHERE test_type = 'GA_MARATHON' AND status = 'published') AS published_ga_tests,
         (SELECT COUNT(*)::int FROM current_affairs WHERE status = 'published') AS published_articles,
         (SELECT COUNT(*)::int FROM current_affairs_generated_questions WHERE review_status = 'approved') AS approved_mcqs,
         (SELECT COUNT(*)::int FROM current_affairs_one_liners WHERE publication_status = 'published') AS published_one_liners,
         (SELECT COUNT(*)::int FROM current_affairs_flashcards WHERE publication_status = 'published') AS published_flashcards,
         (SELECT COUNT(*)::int FROM monthly_capsules WHERE publication_status = 'published') AS published_capsules`,
      [rangeDays],
    ),
    pool.query(
      `WITH activity AS (
         SELECT student_id, started_at AS ts FROM test_attempts
         UNION ALL
         SELECT student_id, started_at AS ts FROM practice_sessions
         UNION ALL
         SELECT student_id, updated_at AS ts FROM current_affairs_reads
         UNION ALL
         SELECT student_id, reviewed_at AS ts FROM student_revision_history
       )
       SELECT
         COUNT(DISTINCT student_id) FILTER (WHERE ts >= NOW() - INTERVAL '1 day')::int AS dau,
         COUNT(DISTINCT student_id) FILTER (WHERE ts >= NOW() - INTERVAL '7 days')::int AS wau,
         COUNT(DISTINCT student_id) FILTER (WHERE ts >= NOW() - INTERVAL '30 days')::int AS mau
       FROM activity`,
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM mock_tests WHERE test_type = 'GA_MARATHON') AS ga_tests_created,
         (SELECT COUNT(*)::int FROM mock_tests WHERE test_type = 'GA_MARATHON' AND status = 'published') AS ga_tests_published,
         COUNT(ta.id)::int AS ga_total_attempts,
         COUNT(ta.id) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted'))::int AS ga_completed_attempts,
         COUNT(ta.id) FILTER (WHERE ta.status = 'in_progress' AND ta.ends_at < NOW())::int AS ga_abandoned_attempts,
         COALESCE(ROUND(AVG(ta.score) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted')), 2), 0)::numeric AS ga_avg_score,
         COALESCE(ROUND(AVG(ta.elapsed_seconds) FILTER (WHERE ta.status IN ('submitted', 'auto_submitted'))), 0)::int AS ga_avg_completion_seconds
       FROM mock_tests mt
       LEFT JOIN test_attempts ta ON ta.mock_test_id = mt.id
       WHERE mt.test_type = 'GA_MARATHON'`,
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM current_affairs_reads WHERE is_read = TRUE) AS total_articles_read,
         (SELECT COUNT(*)::int FROM current_affairs_reads WHERE is_bookmarked = TRUE) AS total_articles_bookmarked,
         (SELECT COUNT(*)::int FROM current_affairs_flashcard_progress) AS total_flashcards_studied,
         (SELECT COUNT(*)::int FROM current_affairs_flashcard_progress WHERE last_response IN ('again', 'hard')) AS difficult_flashcards_count,
         (SELECT COUNT(*)::int FROM student_revision_history) AS total_revision_reviews,
         (SELECT COALESCE(ROUND(AVG(completion_percent), 2), 0)::numeric FROM student_monthly_capsule_progress) AS avg_capsule_completion_percent`,
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'ACTIVE' AND expires_at > NOW())::int AS active_subscriptions,
         COUNT(*) FILTER (WHERE status = 'EXPIRED' OR expires_at <= NOW())::int AS expired_subscriptions,
         COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_subscriptions,
         COUNT(*) FILTER (WHERE created_at >= NOW() - ($1 || ' days')::interval)::int AS new_subscriptions_in_range
       FROM student_subscriptions`,
      [rangeDays],
    ),
    pool.query(
      `SELECT status, total_amount_paise FROM payment_orders WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [rangeDays],
    ),
    pool.query(
      `SELECT
         exam_code,
         COUNT(DISTINCT student_id)::int AS students_targeting
       FROM student_revision_preferences,
            jsonb_array_elements_text(target_exams) AS exam_code
       GROUP BY exam_code
       ORDER BY students_targeting DESC`,
    ),
  ]);

  let refundRows = [];
  try {
    const rRes = await pool.query(
      `SELECT status, requested_amount_paise, approved_amount_paise
       FROM refund_requests
       WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [rangeDays],
    );
    refundRows = rRes.rows;
  } catch {
    refundRows = [];
  }

  const financial = summarizeFinancialOrders(finRes.rows, refundRows);
  const examMap = new Map(examRes.rows.map((r) => [r.exam_code, r.students_targeting]));

  const payload = {
    rangeDays,
    definitions: ANALYTICS_METRIC_DEFINITIONS,
    overview: {
      ...(overviewRes.rows[0] || {}),
      ...(activeRes.rows[0] || {}),
    },
    gaMarathon: gaRes.rows[0] || {},
    content: contentRes.rows[0] || {},
    subscriptions: {
      ...(subRes.rows[0] || {}),
      financial,
    },
    examPreferences: GA_SUPPORTED_EXAMS.map((code) => ({
      examCode: code,
      studentsTargeting: examMap.get(code) || 0,
    })),
    generatedAt: new Date().toISOString(),
  };

  if (useCache) {
    platformSafeCache.set(cacheKey, payload, 60_000);
  }
  return { ...payload, cached: false };
}
