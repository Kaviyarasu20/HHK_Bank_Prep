import { evaluateTestAccess } from "./testAccess.js";

/**
 * GA Marathon Subscription & Attempt-Limit Entitlement Service.
 * - Reuses the existing centralized HHK `evaluateTestAccess` engine (zero duplicate subscription/payment logic).
 * - Adds GA Marathon attempt-limit enforcement and honors cancelled subscriptions
 *   that are still within their paid period (expires_at > now).
 */

export function evaluateSubscriptionStateForPeriod(subscription, now = new Date()) {
  if (!subscription) return { active: false, reason: "no_subscription" };
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
  const inPaidPeriod = Boolean(expiresAt && expiresAt > now);

  if (subscription.status === "ACTIVE" && inPaidPeriod) {
    return { active: true, reason: "active" };
  }
  // Cancelled subscription still retains access until paid period ends
  if (subscription.status === "CANCELLED" && inPaidPeriod) {
    return { active: true, reason: "cancelled_within_paid_period" };
  }
  return { active: false, reason: subscription.status ? String(subscription.status).toLowerCase() : "expired" };
}

export async function checkGaTestEligibility({ db, userId, userRole, testId }) {
  // 1. Evaluate base entitlement via existing HHK testAccess engine
  let access = await evaluateTestAccess({ db, userId, userRole, testId });

  // 2. If blocked only because subscription was CANCELLED while still inside paid expires_at window, verify cleanly
  if (!access.allowed && (access.code === "PURCHASE_REQUIRED" || access.code === "ACCESS_EXPIRED") && userId) {
    const cancelRes = await db.query(
      `SELECT ss.id, ss.status, ss.expires_at, sp.name AS plan_name, sp.access_scope,
              EXISTS (
                SELECT 1 FROM subscription_plan_tests spt
                WHERE spt.plan_id = sp.id AND spt.mock_test_id = $2
              ) AS includes_test
       FROM student_subscriptions ss
       JOIN subscription_plans sp ON sp.id = ss.plan_id
       WHERE ss.student_id = $1
         AND ss.status = 'CANCELLED'
         AND ss.expires_at > NOW()
       ORDER BY ss.expires_at DESC
       LIMIT 5`,
      [userId, testId],
    );
    for (const sub of cancelRes.rows) {
      const covers =
        sub.access_scope === "ALL_TESTS" ||
        sub.access_scope === "LIMITED_COUNT" ||
        (sub.access_scope === "SELECTED_TESTS" && sub.includes_test);
      if (covers) {
        access = {
          allowed: true,
          code: "SUBSCRIPTION_ACCESS_GRANTED",
          httpStatus: 200,
          message: `Access granted through the end of your paid ${sub.plan_name} period.`,
          subscription: sub,
        };
        break;
      }
    }
  }

  if (!access.allowed) {
    return { eligible: false, access, attemptsUsed: 0, attemptLimit: null };
  }

  // 3. Enforce GA Marathon attempt_limit if configured (admins bypass for preview)
  const cfgRes = await db.query(
    `SELECT attempt_limit FROM ga_marathon_configs WHERE mock_test_id = $1`,
    [testId],
  );
  const attemptLimit = cfgRes.rows[0]?.attempt_limit ?? null;

  const cntRes = await db.query(
    `SELECT COUNT(*)::int AS cnt
     FROM test_attempts
     WHERE student_id = $1 AND mock_test_id = $2`,
    [userId, testId],
  );
  const attemptsUsed = cntRes.rows[0]?.cnt ?? 0;

  if (userRole !== "admin" && attemptLimit !== null && attemptsUsed >= attemptLimit) {
    return {
      eligible: false,
      attemptsUsed,
      attemptLimit,
      access: {
        allowed: false,
        code: "ATTEMPT_LIMIT_REACHED",
        httpStatus: 403,
        message: `You have used all ${attemptLimit} permitted attempt(s) for this GA Marathon test.`,
      },
    };
  }

  return { eligible: true, access, attemptsUsed, attemptLimit };
}
