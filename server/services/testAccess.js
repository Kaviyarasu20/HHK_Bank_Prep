/**
 * Centralized Mock Test Access Control Engine.
 * Evaluates all 10 authorization conditions on the backend and returns one of:
 * - LOGIN_REQUIRED
 * - TEST_NOT_AVAILABLE
 * - FREE_ACCESS_GRANTED
 * - PURCHASE_REQUIRED
 * - SUBSCRIPTION_ACCESS_GRANTED
 * - PURCHASE_ACCESS_GRANTED
 * - ACCESS_EXPIRED
 */
export async function evaluateTestAccess({ db, userId = null, userRole = null, testId }) {
  if (!userId) {
    return {
      allowed: false,
      code: "LOGIN_REQUIRED",
      httpStatus: 401,
      message: "Please log in to your HHK account to start this mock test.",
    };
  }

  const testResult = await db.query(
    `SELECT
       t.id, t.name, t.description, t.status, t.test_type,
       t.duration_seconds, t.availability_start, t.availability_end,
       t.access_type, t.price_paise, t.currency, t.access_duration_days,
       t.is_visible, t.is_purchasable, t.promotional_free_until,
       e.status AS exam_status, e.name AS exam_name, st.name AS stage_name
     FROM mock_tests t
     LEFT JOIN exams e ON e.id = t.exam_id
     LEFT JOIN exam_stages st ON st.id = t.stage_id
     WHERE t.id = $1`,
    [testId],
  );

  if (!testResult.rowCount) {
    return {
      allowed: false,
      code: "TEST_NOT_AVAILABLE",
      httpStatus: 404,
      message: "Mock test was not found.",
    };
  }

  const test = testResult.rows[0];
  const now = new Date();
  const isTopicwise = test.test_type === "TOPIC_WISE" || test.test_type === "GA_MARATHON";

  if (
    test.status !== "published" ||
    !test.is_visible ||
    (!isTopicwise && test.exam_status !== "published") ||
    (test.availability_start && new Date(test.availability_start) > now) ||
    (test.availability_end && new Date(test.availability_end) < now)
  ) {
    return {
      allowed: false,
      code: "TEST_NOT_AVAILABLE",
      httpStatus: 404,
      message: "This mock test is currently unavailable.",
    };
  }

  // Administrators always have preview access
  if (userRole === "admin") {
    return {
      allowed: true,
      code: "FREE_ACCESS_GRANTED",
      httpStatus: 200,
      message: "Administrator access granted.",
      test,
    };
  }

  // Check if FREE or active PROMOTIONAL free window
  const isPromoActive =
    test.promotional_free_until && new Date(test.promotional_free_until) > now;
  if (
    test.access_type === "FREE" ||
    (test.access_type === "PROMOTIONAL" && (!test.promotional_free_until || isPromoActive)) ||
    isPromoActive
  ) {
    return {
      allowed: true,
      code: "FREE_ACCESS_GRANTED",
      httpStatus: 200,
      message: isPromoActive
        ? "Promotional free access granted."
        : "Free mock test access granted.",
      test,
    };
  }

  // Check individual test entitlement (purchase / admin grant / promo)
  const entitlements = await db.query(
    `SELECT id, source, status, granted_at, expires_at
     FROM student_test_entitlements
     WHERE student_id = $1 AND mock_test_id = $2
     ORDER BY granted_at DESC`,
    [userId, testId],
  );

  let hadExpiredEntitlement = false;
  for (const ent of entitlements.rows) {
    if (ent.status === "ACTIVE") {
      if (!ent.expires_at || new Date(ent.expires_at) > now) {
        return {
          allowed: true,
          code: "PURCHASE_ACCESS_GRANTED",
          httpStatus: 200,
          message: "Purchased mock test access verified.",
          entitlement: ent,
          test,
        };
      }
      hadExpiredEntitlement = true;
    } else if (ent.status === "EXPIRED") {
      hadExpiredEntitlement = true;
    }
  }

  // Check active student subscriptions
  const subscriptions = await db.query(
    `SELECT
       ss.id, ss.plan_id, ss.status, ss.starts_at, ss.expires_at,
       sp.name AS plan_name, sp.access_scope, sp.max_tests_included,
       EXISTS (
         SELECT 1 FROM subscription_plan_tests spt
         WHERE spt.plan_id = sp.id AND spt.mock_test_id = $2
       ) AS includes_test
     FROM student_subscriptions ss
     JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.student_id = $1
     ORDER BY ss.expires_at DESC`,
    [userId, testId],
  );

  let hadExpiredSubscription = false;
  for (const sub of subscriptions.rows) {
    const isActive = sub.status === "ACTIVE" && new Date(sub.expires_at) > now;
    const coversTest =
      sub.access_scope === "ALL_TESTS" ||
      sub.access_scope === "LIMITED_COUNT" ||
      (sub.access_scope === "SELECTED_TESTS" && sub.includes_test);

    if (isActive && coversTest) {
      return {
        allowed: true,
        code: "SUBSCRIPTION_ACCESS_GRANTED",
        httpStatus: 200,
        message: `Access granted via your active ${sub.plan_name} subscription.`,
        subscription: sub,
        test,
      };
    }
    if (coversTest && (sub.status === "EXPIRED" || new Date(sub.expires_at) <= now)) {
      hadExpiredSubscription = true;
    }
  }

  // Load eligible subscription plans for purchase prompt
  const eligiblePlans = await db.query(
    `SELECT id, code, name, description, duration_days, price_paise, promo_price_paise, promo_valid_until, currency, access_scope, features, is_featured
     FROM subscription_plans
     WHERE is_active = TRUE
       AND (
         access_scope = 'ALL_TESTS'
         OR access_scope = 'LIMITED_COUNT'
         OR EXISTS (
           SELECT 1 FROM subscription_plan_tests spt
           WHERE spt.plan_id = subscription_plans.id AND spt.mock_test_id = $1
         )
       )
     ORDER BY sort_order ASC, price_paise ASC`,
    [testId],
  );

  const code =
    hadExpiredEntitlement || hadExpiredSubscription
      ? "ACCESS_EXPIRED"
      : "PURCHASE_REQUIRED";

  return {
    allowed: false,
    code,
    httpStatus: 403,
    message:
      code === "ACCESS_EXPIRED"
        ? "Your previous access to this mock test has expired. Renew your subscription or purchase access to continue."
        : "This is a paid mock test. Purchase this test or activate an eligible subscription plan to start.",
    test: {
      id: test.id,
      name: test.name,
      access_type: test.access_type,
      price_paise: test.price_paise,
      currency: test.currency,
      is_purchasable: test.is_purchasable,
      access_duration_days: test.access_duration_days,
    },
    eligiblePlans: eligiblePlans.rows,
  };
}
