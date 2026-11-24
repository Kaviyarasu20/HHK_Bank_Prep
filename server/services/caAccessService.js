/**
 * Access Control Service for HHK Current Affairs Practice Sets & PDF Downloads.
 * Integrates with existing HHK subscription tables (`student_subscriptions`)
 * without modifying or breaking payment logic.
 */
export async function evaluateCaPracticeAccess({ db, userId, userRole, practiceSet }) {
  if (!userId) {
    return {
      allowed: false,
      httpStatus: 401,
      code: "LOGIN_REQUIRED",
      message: "Please log in to access Current Affairs practice sets and PDFs.",
    };
  }

  if (userRole === "admin") {
    return { allowed: true, httpStatus: 200, code: "ADMIN_ACCESS", message: "Administrator access granted." };
  }

  if (!practiceSet || practiceSet.publication_status !== "published") {
    return {
      allowed: false,
      httpStatus: 404,
      code: "NOT_PUBLISHED",
      message: "This Current Affairs practice set is not published.",
    };
  }

  if (!practiceSet.access_tier || practiceSet.access_tier === "free") {
    return { allowed: true, httpStatus: 200, code: "FREE_ACCESS", message: "Free access granted." };
  }

  // Premium tier: verify active HHK subscription
  try {
    const subRes = await db.query(
      `SELECT id, status, ends_at
       FROM student_subscriptions
       WHERE student_id = $1
         AND status = 'ACTIVE'
         AND (ends_at IS NULL OR ends_at > now())
       ORDER BY ends_at DESC NULLS LAST
       LIMIT 1`,
      [userId],
    );
    if (subRes.rowCount > 0) {
      return {
        allowed: true,
        httpStatus: 200,
        code: "SUBSCRIPTION_ACTIVE",
        message: "Active HHK subscription verified.",
      };
    }
  } catch (err) {
    // If subscription table is absent in a minimal DB, deny premium conservatively
    if (err?.code !== "42P01") throw err;
  }

  return {
    allowed: false,
    httpStatus: 403,
    code: "SUBSCRIPTION_REQUIRED",
    message: "An active HHK subscription is required to access this premium Current Affairs practice set or PDF.",
  };
}
