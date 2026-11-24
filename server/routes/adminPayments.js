import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, validate } from "../middleware.js";
import { sanitizeText } from "../schemas.js";
import {
  fetchGatewayRefund,
  getRazorpayConfig,
  initiateGatewayRefund,
} from "../services/razorpay.js";
import { getPaymentSettings, writePaymentAudit } from "../services/paymentService.js";

export const adminPaymentRouter = Router();
adminPaymentRouter.use(requireAdmin);

const paymentConfigSchema = z.object({
  gatewayEnabled: z.boolean(),
  gatewayMode: z.enum(["test", "live"]),
  currency: z.enum(["INR"]).default("INR"),
  allowIndividualTestPurchase: z.boolean(),
  allowSubscriptionPurchase: z.boolean(),
  taxEnabled: z.boolean(),
  taxRateBps: z.number().int().min(0).max(5000),
  taxLabel: z.string().trim().min(1).max(32).default("GST"),
  refundWindowDays: z.number().int().min(0).max(365),
  refundProcessingDays: z.string().trim().min(2).max(80),
  supportEmail: z.string().trim().max(254).default(""),
  supportPhone: z.string().trim().max(40).default(""),
  businessName: z.string().trim().min(2).max(200),
  businessAddress: z.string().trim().max(500).default(""),
  policyVersion: z.string().trim().min(1).max(24).default("1.0"),
});

const subscriptionPlanSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(2).max(120).transform(sanitizeText),
  description: z.string().trim().max(1000).default("").transform(sanitizeText),
  durationDays: z.number().int().min(1).max(1825),
  pricePaise: z.number().int().min(0).max(100_000_000),
  promoPricePaise: z.number().int().min(0).max(100_000_000).nullable().optional(),
  promoValidUntil: z.string().datetime().nullable().optional(),
  currency: z.enum(["INR"]).default("INR"),
  accessScope: z.enum(["ALL_TESTS", "SELECTED_TESTS", "LIMITED_COUNT"]).default("ALL_TESTS"),
  maxTestsIncluded: z.number().int().positive().nullable().optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  mockTestIds: z.array(z.string().uuid()).default([]),
});

const testAccessConfigSchema = z.object({
  accessType: z.enum(["FREE", "PAID", "SUBSCRIPTION", "PROMOTIONAL"]),
  pricePaise: z.number().int().min(0).max(100_000_000),
  currency: z.enum(["INR"]).default("INR"),
  accessDurationDays: z.number().int().positive().max(1825).nullable().optional(),
  isVisible: z.boolean().default(true),
  isPurchasable: z.boolean().default(true),
  promotionalFreeUntil: z.string().datetime().nullable().optional(),
  difficultyLabel: z.enum(["Easy", "Moderate", "Hard", "Exam Level"]).default("Moderate"),
  eligiblePlanIds: z.array(z.string().uuid()).optional(),
});

/**
 * 1. Admin Payment Dashboard Statistics
 * Strictly computes revenue from verified SUCCESSFUL / PARTIALLY_REFUNDED / REFUNDED transactions.
 * Clearly distinguishes gross collections, refunds, and net collections.
 */
adminPaymentRouter.get("/payments/dashboard", async (_req, res) => {
  const [txStats, subStats, refundPending] = await Promise.all([
    pool.query(`
      SELECT
        count(*) FILTER (WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED'))::int AS total_successful_payments,
        COALESCE(SUM(amount_paise) FILTER (WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')), 0)::bigint AS gross_revenue_paise,
        COALESCE(SUM(refunded_amount_paise) FILTER (WHERE status IN ('PARTIALLY_REFUNDED', 'REFUNDED')), 0)::bigint AS total_refund_paise,
        COALESCE(SUM(amount_paise - refunded_amount_paise) FILTER (WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')), 0)::bigint AS net_revenue_paise,
        COALESCE(SUM(amount_paise) FILTER (
          WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')
            AND (verified_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
        ), 0)::bigint AS today_revenue_paise,
        COALESCE(SUM(amount_paise) FILTER (
          WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')
            AND date_trunc('month', verified_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')
        ), 0)::bigint AS monthly_revenue_paise,
        count(*) FILTER (WHERE status IN ('CREATED', 'PENDING', 'PROCESSING'))::int AS pending_transactions,
        count(*) FILTER (WHERE status IN ('FAILED', 'CANCELLED'))::int AS failed_transactions,
        count(*) FILTER (WHERE status IN ('PARTIALLY_REFUNDED', 'REFUNDED'))::int AS total_refunded_transactions
      FROM payment_transactions
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE status = 'ACTIVE' AND expires_at > now())::int AS active_paid_subscriptions,
        count(DISTINCT student_id) FILTER (WHERE status = 'ACTIVE' AND expires_at > now())::int AS active_paid_students
      FROM student_subscriptions
    `),
    pool.query(
      "SELECT count(*)::int AS open_refund_requests FROM refund_requests WHERE status IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REFUND_INITIATED')",
    ),
  ]);

  res.json({
    stats: {
      ...txStats.rows[0],
      ...subStats.rows[0],
      open_refund_requests: refundPending.rows[0]?.open_refund_requests ?? 0,
    },
  });
});

/**
 * 2. Revenue Reports (Daily, Weekly, Monthly, Yearly, Plan-wise, Success vs Failed)
 */
adminPaymentRouter.get("/payments/reports", async (_req, res) => {
  const [periods, planWise, statusBreakdown] = await Promise.all([
    pool.query(`
      SELECT
        COALESCE(SUM(amount_paise) FILTER (WHERE (verified_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date), 0)::bigint AS daily_gross_paise,
        COALESCE(SUM(amount_paise - refunded_amount_paise) FILTER (WHERE (verified_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date), 0)::bigint AS daily_net_paise,
        COALESCE(SUM(amount_paise) FILTER (WHERE verified_at >= now() - interval '7 days'), 0)::bigint AS weekly_gross_paise,
        COALESCE(SUM(amount_paise - refunded_amount_paise) FILTER (WHERE verified_at >= now() - interval '7 days'), 0)::bigint AS weekly_net_paise,
        COALESCE(SUM(amount_paise) FILTER (WHERE date_trunc('month', verified_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')), 0)::bigint AS monthly_gross_paise,
        COALESCE(SUM(amount_paise - refunded_amount_paise) FILTER (WHERE date_trunc('month', verified_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')), 0)::bigint AS monthly_net_paise,
        COALESCE(SUM(amount_paise) FILTER (WHERE date_trunc('year', verified_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('year', now() AT TIME ZONE 'Asia/Kolkata')), 0)::bigint AS yearly_gross_paise,
        COALESCE(SUM(amount_paise - refunded_amount_paise) FILTER (WHERE date_trunc('year', verified_at AT TIME ZONE 'Asia/Kolkata') = date_trunc('year', now() AT TIME ZONE 'Asia/Kolkata')), 0)::bigint AS yearly_net_paise
      FROM payment_transactions
      WHERE status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')
    `),
    pool.query(`
      SELECT
        po.item_type,
        po.item_title,
        count(pt.id)::int AS purchase_count,
        COALESCE(SUM(pt.amount_paise), 0)::bigint AS gross_paise,
        COALESCE(SUM(pt.refunded_amount_paise), 0)::bigint AS refunded_paise,
        COALESCE(SUM(pt.amount_paise - pt.refunded_amount_paise), 0)::bigint AS net_paise
      FROM payment_transactions pt
      JOIN payment_orders po ON po.id = pt.order_id
      WHERE pt.status IN ('SUCCESSFUL', 'PARTIALLY_REFUNDED', 'REFUNDED')
      GROUP BY po.item_type, po.item_title
      ORDER BY net_paise DESC
      LIMIT 30
    `),
    pool.query(`
      SELECT status, count(*)::int AS count, COALESCE(SUM(amount_paise), 0)::bigint AS total_paise
      FROM payment_transactions
      GROUP BY status
      ORDER BY count DESC
    `),
  ]);

  res.json({
    periods: periods.rows[0],
    planWise: planWise.rows,
    statusBreakdown: statusBreakdown.rows,
  });
});

/**
 * 3. Admin Transaction Management (Search, Filter, Pagination)
 */
adminPaymentRouter.get("/payments/transactions", async (req, res) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const status = req.query.status && req.query.status !== "ALL" ? String(req.query.status).toUpperCase() : null;
  const planId = req.query.planId || null;
  const fromDate = req.query.fromDate || null;
  const toDate = req.query.toDate || null;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
  const offset = (page - 1) * limit;

  const whereSql = `
    WHERE ($1::text IS NULL OR u.full_name ILIKE $1 OR u.email ILIKE $1 OR pt.transaction_code ILIKE $1 OR po.order_number ILIKE $1 OR COALESCE(pt.gateway_payment_id, '') ILIKE $1)
      AND ($2::text IS NULL OR COALESCE(pt.status, po.status) = $2)
      AND ($3::uuid IS NULL OR po.plan_id = $3)
      AND ($4::timestamptz IS NULL OR po.created_at >= $4)
      AND ($5::timestamptz IS NULL OR po.created_at <= $5)
  `;
  const params = [search, status, planId, fromDate, toDate];

  const [rows, countRes] = await Promise.all([
    pool.query(
      `SELECT
         po.id AS order_id, po.order_number, po.item_type, po.item_title,
         po.base_amount_paise, po.tax_amount_paise, po.total_amount_paise, po.currency,
         po.status AS order_status, po.failure_reason, po.created_at,
         pt.id AS transaction_id, pt.transaction_code, pt.gateway_payment_id,
         pt.payment_method, pt.status AS transaction_status, pt.refunded_amount_paise,
         pt.receipt_number, pt.verified_at,
         u.id AS student_id, u.full_name AS student_name, u.email AS student_email,
         (SELECT rr.status FROM refund_requests rr WHERE rr.transaction_id = pt.id ORDER BY rr.created_at DESC LIMIT 1) AS refund_status
       FROM payment_orders po
       JOIN users u ON u.id = po.student_id
       LEFT JOIN LATERAL (
         SELECT * FROM payment_transactions WHERE order_id = po.id ORDER BY created_at DESC LIMIT 1
       ) pt ON TRUE
       ${whereSql}
       ORDER BY po.created_at DESC
       LIMIT $6 OFFSET $7`,
      [...params, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM payment_orders po
       JOIN users u ON u.id = po.student_id
       LEFT JOIN LATERAL (
         SELECT * FROM payment_transactions WHERE order_id = po.id ORDER BY created_at DESC LIMIT 1
       ) pt ON TRUE
       ${whereSql}`,
      params,
    ),
  ]);

  res.json({
    transactions: rows.rows,
    pagination: {
      page,
      limit,
      total: countRes.rows[0]?.total ?? 0,
      totalPages: Math.max(1, Math.ceil((countRes.rows[0]?.total ?? 0) / limit)),
    },
  });
});

/**
 * 4. Admin CSV Export for Payment Reports
 */
adminPaymentRouter.get("/payments/transactions/export", async (req, res) => {
  const status = req.query.status && req.query.status !== "ALL" ? String(req.query.status).toUpperCase() : null;
  const rows = (
    await pool.query(
      `SELECT
         po.order_number, pt.transaction_code, pt.gateway_payment_id,
         u.full_name, u.email, po.item_type, po.item_title,
         po.total_amount_paise, COALESCE(pt.refunded_amount_paise, 0) AS refunded_amount_paise,
         po.currency, COALESCE(pt.payment_method, '') AS payment_method,
         COALESCE(pt.status, po.status) AS status, po.created_at
       FROM payment_orders po
       JOIN users u ON u.id = po.student_id
       LEFT JOIN LATERAL (
         SELECT * FROM payment_transactions WHERE order_id = po.id ORDER BY created_at DESC LIMIT 1
       ) pt ON TRUE
       WHERE ($1::text IS NULL OR COALESCE(pt.status, po.status) = $1)
       ORDER BY po.created_at DESC
       LIMIT 5000`,
      [status],
    )
  ).rows;

  const headers = [
    "Order Number",
    "Transaction Code",
    "Gateway Payment ID",
    "Student Name",
    "Student Email",
    "Item Type",
    "Item Title",
    "Amount (INR)",
    "Refunded (INR)",
    "Currency",
    "Method",
    "Status",
    "Created At",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.order_number,
        r.transaction_code || "",
        r.gateway_payment_id || "",
        r.full_name,
        r.email,
        r.item_type,
        r.item_title,
        (Number(r.total_amount_paise) / 100).toFixed(2),
        (Number(r.refunded_amount_paise) / 100).toFixed(2),
        r.currency,
        r.payment_method,
        r.status,
        r.created_at ? new Date(r.created_at).toISOString() : "",
      ]
        .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="hhk-payments-report.csv"');
  res.send(csvLines.join("\n"));
});

/**
 * 5. Global Payment Settings (Admin Controlled — NEVER exposes/accepts secret keys)
 */
adminPaymentRouter.get("/payments/config", async (_req, res) => {
  const settings = await getPaymentSettings();
  const rp = getRazorpayConfig();
  res.json({
    settings,
    gatewayStatus: {
      isConfigured: rp.isConfigured,
      hasWebhookSecret: rp.hasWebhookSecret,
      detectedMode: rp.detectedMode,
      keyIdMasked: rp.keyId ? `${rp.keyId.slice(0, 12)}••••` : null,
    },
  });
});

adminPaymentRouter.put("/payments/config", async (req, res) => {
  const input = validate(paymentConfigSchema, req.body);
  const updated = (
    await pool.query(
      `UPDATE payment_settings
       SET gateway_enabled = $1, gateway_mode = $2, currency = $3,
           allow_individual_test_purchase = $4, allow_subscription_purchase = $5,
           tax_enabled = $6, tax_rate_bps = $7, tax_label = $8,
           refund_window_days = $9, refund_processing_days = $10,
           support_email = $11, support_phone = $12, business_name = $13,
           business_address = $14, policy_version = $15,
           updated_by = $16, updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [
        input.gatewayEnabled,
        input.gatewayMode,
        input.currency,
        input.allowIndividualTestPurchase,
        input.allowSubscriptionPurchase,
        input.taxEnabled,
        input.taxRateBps,
        input.taxLabel,
        input.refundWindowDays,
        input.refundProcessingDays,
        input.supportEmail,
        input.supportPhone,
        input.businessName,
        input.businessAddress,
        input.policyVersion,
        req.session.userId,
      ],
    )
  ).rows[0];

  await writePaymentAudit(pool, {
    actorId: req.session.userId,
    action: "admin.payment_config_updated",
    entityType: "payment_settings",
    entityId: null,
    details: { gatewayEnabled: input.gatewayEnabled, gatewayMode: input.gatewayMode, taxEnabled: input.taxEnabled, taxRateBps: input.taxRateBps },
    ip: req.ip,
  });

  res.json({ settings: updated, message: "Payment settings saved." });
});

/**
 * 6. Admin Subscription Plan Management
 */
adminPaymentRouter.get("/payments/plans", async (_req, res) => {
  const plans = (
    await pool.query(
      `SELECT sp.*,
         COALESCE(
           (SELECT array_agg(spt.mock_test_id) FROM subscription_plan_tests spt WHERE spt.plan_id = sp.id),
           ARRAY[]::uuid[]
         ) AS mock_test_ids
       FROM subscription_plans sp
       ORDER BY sp.sort_order ASC, sp.created_at DESC`,
    )
  ).rows;
  res.json({ plans });
});

adminPaymentRouter.post("/payments/plans", async (req, res) => {
  const input = validate(subscriptionPlanSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const plan = (
      await client.query(
        `INSERT INTO subscription_plans (
           code, name, description, duration_days, price_paise, promo_price_paise,
           promo_valid_until, currency, access_scope, max_tests_included,
           features, is_active, is_featured, sort_order, created_by
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          input.code.toUpperCase(),
          input.name,
          input.description,
          input.durationDays,
          input.pricePaise,
          input.promoPricePaise ?? null,
          input.promoValidUntil ?? null,
          input.currency,
          input.accessScope,
          input.maxTestsIncluded ?? null,
          JSON.stringify(input.features),
          input.isActive,
          input.isFeatured,
          input.sortOrder,
          req.session.userId,
        ],
      )
    ).rows[0];

    for (const testId of input.mockTestIds) {
      await client.query(
        "INSERT INTO subscription_plan_tests (plan_id, mock_test_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [plan.id, testId],
      );
    }

    await writePaymentAudit(client, {
      actorId: req.session.userId,
      action: "admin.plan_created",
      entityType: "subscription_plan",
      entityId: plan.id,
      details: { code: plan.code, name: plan.name, pricePaise: plan.price_paise, durationDays: plan.duration_days },
      ip: req.ip,
    });

    await client.query("COMMIT");
    res.status(201).json({ plan, message: "Subscription plan created." });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

adminPaymentRouter.put("/payments/plans/:planId", async (req, res) => {
  const input = validate(subscriptionPlanSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE subscription_plans
       SET code = $2, name = $3, description = $4, duration_days = $5,
           price_paise = $6, promo_price_paise = $7, promo_valid_until = $8,
           currency = $9, access_scope = $10, max_tests_included = $11,
           features = $12, is_active = $13, is_featured = $14, sort_order = $15,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        req.params.planId,
        input.code.toUpperCase(),
        input.name,
        input.description,
        input.durationDays,
        input.pricePaise,
        input.promoPricePaise ?? null,
        input.promoValidUntil ?? null,
        input.currency,
        input.accessScope,
        input.maxTestsIncluded ?? null,
        JSON.stringify(input.features),
        input.isActive,
        input.isFeatured,
        input.sortOrder,
      ],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Subscription plan not found." });
    }
    await client.query("DELETE FROM subscription_plan_tests WHERE plan_id = $1", [req.params.planId]);
    for (const testId of input.mockTestIds) {
      await client.query(
        "INSERT INTO subscription_plan_tests (plan_id, mock_test_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.params.planId, testId],
      );
    }

    await writePaymentAudit(client, {
      actorId: req.session.userId,
      action: "admin.plan_updated",
      entityType: "subscription_plan",
      entityId: req.params.planId,
      details: { name: input.name, pricePaise: input.pricePaise, isActive: input.isActive },
      ip: req.ip,
    });

    await client.query("COMMIT");
    res.json({ plan: updated.rows[0], message: "Subscription plan updated." });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

/**
 * 7. Admin Individual Mock Test Pricing & Access Configuration
 * Preserves all existing student entitlements and transactions when pricing/access changes.
 */
adminPaymentRouter.get("/payments/tests-config", async (_req, res) => {
  const rows = await pool.query(`
    SELECT
      t.id, t.name, t.test_type, t.set_label, t.status, t.duration_seconds,
      t.subject, t.topic, t.access_type, t.price_paise, t.currency,
      t.access_duration_days, t.is_visible, t.is_purchasable,
      t.promotional_free_until, t.difficulty_label,
      e.name AS exam_name, e.category AS exam_category, st.name AS stage_name,
      COALESCE(
        (SELECT array_agg(spt.plan_id) FROM subscription_plan_tests spt WHERE spt.mock_test_id = t.id),
        ARRAY[]::uuid[]
      ) AS eligible_plan_ids,
      (SELECT count(*)::int FROM student_test_entitlements ste WHERE ste.mock_test_id = t.id AND ste.status = 'ACTIVE') AS active_purchasers
    FROM mock_tests t
    LEFT JOIN exams e ON e.id = t.exam_id
    LEFT JOIN exam_stages st ON st.id = t.stage_id
    ORDER BY t.test_type ASC, t.created_at DESC
  `);
  res.json({ tests: rows.rows });
});

adminPaymentRouter.patch("/payments/tests-config/:testId", async (req, res) => {
  const input = validate(testAccessConfigSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query(
      "SELECT id, name, access_type, price_paise FROM mock_tests WHERE id = $1 FOR UPDATE",
      [req.params.testId],
    );
    if (!prev.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mock test not found." });
    }
    const effectivePrice = input.accessType === "FREE" ? 0 : input.pricePaise;
    const updated = (
      await client.query(
        `UPDATE mock_tests
         SET access_type = $2, price_paise = $3, currency = $4,
             access_duration_days = $5, is_visible = $6, is_purchasable = $7,
             promotional_free_until = $8, difficulty_label = $9, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.testId,
          input.accessType,
          effectivePrice,
          input.currency,
          input.accessDurationDays ?? null,
          input.isVisible,
          input.isPurchasable,
          input.promotionalFreeUntil ?? null,
          input.difficultyLabel,
        ],
      )
    ).rows[0];

    if (Array.isArray(input.eligiblePlanIds)) {
      await client.query("DELETE FROM subscription_plan_tests WHERE mock_test_id = $1", [
        req.params.testId,
      ]);
      for (const planId of input.eligiblePlanIds) {
        await client.query(
          "INSERT INTO subscription_plan_tests (plan_id, mock_test_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [planId, req.params.testId],
        );
      }
    }

    await writePaymentAudit(client, {
      actorId: req.session.userId,
      action: "admin.test_pricing_updated",
      entityType: "mock_test",
      entityId: req.params.testId,
      details: {
        testName: prev.rows[0].name,
        previousAccessType: prev.rows[0].access_type,
        newAccessType: input.accessType,
        previousPricePaise: prev.rows[0].price_paise,
        newPricePaise: effectivePrice,
      },
      ip: req.ip,
    });

    await client.query("COMMIT");
    res.json({
      test: updated,
      message: "Mock test access and pricing updated. Existing student entitlements were preserved.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

/**
 * 8. Admin Refund Management Workflow
 * Requested -> Under Review -> Approved/Rejected -> Refund Initiated -> Refunded/Failed (gateway verified!)
 */
adminPaymentRouter.get("/payments/refunds", async (req, res) => {
  const status = req.query.status && req.query.status !== "ALL" ? String(req.query.status).toUpperCase() : null;
  const rows = await pool.query(
    `SELECT
       rr.*,
       u.full_name AS student_name, u.email AS student_email,
       po.order_number, po.item_title, po.item_type,
       pt.transaction_code, pt.gateway_payment_id, pt.amount_paise, pt.refunded_amount_paise, pt.currency
     FROM refund_requests rr
     JOIN users u ON u.id = rr.student_id
     JOIN payment_orders po ON po.id = rr.order_id
     JOIN payment_transactions pt ON pt.id = rr.transaction_id
     WHERE ($1::text IS NULL OR rr.status = $1)
     ORDER BY rr.created_at DESC`,
    [status],
  );
  res.json({ refunds: rows.rows });
});

adminPaymentRouter.patch("/payments/refunds/:refundId/review", async (req, res) => {
  const input = validate(
    z.object({
      decision: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
      adminNotes: z.string().trim().max(1000).default("").transform(sanitizeText),
      rejectionReason: z.string().trim().max(1000).optional().default("").transform(sanitizeText),
    }),
    req.body,
  );
  if (input.decision === "REJECTED" && !input.rejectionReason) {
    return res.status(400).json({ error: "Provide a rejection reason when rejecting a refund request." });
  }

  const updated = await pool.query(
    `UPDATE refund_requests
     SET status = $2, admin_notes = $3,
         rejection_reason = CASE WHEN $2 = 'REJECTED' THEN $4 ELSE rejection_reason END,
         reviewed_by = $5, reviewed_at = now(), updated_at = now()
     WHERE id = $1 AND status IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED')
     RETURNING *`,
    [req.params.refundId, input.decision, input.adminNotes, input.rejectionReason || null, req.session.userId],
  );
  if (!updated.rowCount) {
    return res.status(409).json({ error: "Refund request not found or already finalized." });
  }

  await writePaymentAudit(pool, {
    actorId: req.session.userId,
    action: `admin.refund_${input.decision.toLowerCase()}`,
    entityType: "refund_request",
    entityId: req.params.refundId,
    details: { decision: input.decision, rejectionReason: input.rejectionReason || null },
    ip: req.ip,
  });

  res.json({ refund: updated.rows[0], message: `Refund request marked as ${input.decision}.` });
});

/**
 * Initiates refund through Razorpay API.
 * NEVER marks as REFUNDED until Razorpay confirms status === 'processed'.
 */
adminPaymentRouter.post("/payments/refunds/:refundId/initiate", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reqRes = await client.query(
      "SELECT * FROM refund_requests WHERE id = $1 FOR UPDATE",
      [req.params.refundId],
    );
    if (!reqRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Refund request not found." });
    }
    const refundReq = reqRes.rows[0];
    if (!["APPROVED", "FAILED"].includes(refundReq.status)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Only APPROVED (or retryable FAILED) refund requests can be initiated with the gateway.",
      });
    }
    if (refundReq.gateway_refund_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "A gateway refund has already been initiated for this request. Use Sync Status instead.",
      });
    }

    const txRes = await client.query(
      "SELECT * FROM payment_transactions WHERE id = $1 FOR UPDATE",
      [refundReq.transaction_id],
    );
    const tx = txRes.rows[0];
    if (!tx?.gateway_payment_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Transaction has no verified gateway payment ID." });
    }

    const eligibleRemaining = Number(tx.amount_paise) - Number(tx.refunded_amount_paise);
    if (Number(refundReq.requested_amount_paise) > eligibleRemaining) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Requested refund amount exceeds eligible remaining captured amount.",
      });
    }

    const gwRefund = await initiateGatewayRefund({
      paymentId: tx.gateway_payment_id,
      amountPaise: Number(refundReq.requested_amount_paise),
      receipt: `REF-${refundReq.id.slice(0, 8)}`,
      notes: { refund_request_id: refundReq.id, order_id: refundReq.order_id },
    });

    const isImmediatelyProcessed = gwRefund.status === "processed";
    const nextReqStatus = isImmediatelyProcessed ? "REFUNDED" : "REFUND_INITIATED";

    const updatedReq = (
      await client.query(
        `UPDATE refund_requests
         SET status = $2, gateway_refund_id = $3, gateway_refund_status = $4,
             refunded_at = CASE WHEN $2 = 'REFUNDED' THEN now() ELSE NULL END,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [refundReq.id, nextReqStatus, gwRefund.id, gwRefund.status || "pending"],
      )
    ).rows[0];

    if (isImmediatelyProcessed) {
      const newTotalRefunded = Math.min(
        Number(tx.amount_paise),
        Number(tx.refunded_amount_paise) + Number(refundReq.requested_amount_paise),
      );
      const nextTxStatus = newTotalRefunded >= Number(tx.amount_paise) ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await client.query(
        "UPDATE payment_transactions SET refunded_amount_paise = $2, status = $3, updated_at = now() WHERE id = $1",
        [tx.id, newTotalRefunded, nextTxStatus],
      );
      await client.query("UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1", [
        tx.order_id,
        nextTxStatus,
      ]);
      if (nextTxStatus === "REFUNDED") {
        await client.query(
          "UPDATE student_subscriptions SET status = 'REVOKED', cancelled_at = now() WHERE order_id = $1",
          [tx.order_id],
        );
        await client.query("UPDATE student_test_entitlements SET status = 'REVOKED' WHERE order_id = $1", [
          tx.order_id,
        ]);
      }
    } else {
      await client.query(
        "UPDATE payment_transactions SET status = 'REFUND_INITIATED', updated_at = now() WHERE id = $1",
        [tx.id],
      );
      await client.query(
        "UPDATE payment_orders SET status = 'REFUND_INITIATED', updated_at = now() WHERE id = $1",
        [tx.order_id],
      );
    }

    await writePaymentAudit(client, {
      actorId: req.session.userId,
      action: "admin.refund_initiated",
      entityType: "refund_request",
      entityId: refundReq.id,
      details: {
        gatewayRefundId: gwRefund.id,
        gatewayStatus: gwRefund.status,
        amountPaise: refundReq.requested_amount_paise,
      },
      ip: req.ip,
    });

    await client.query("COMMIT");
    res.json({
      refund: updatedReq,
      message: isImmediatelyProcessed
        ? "Refund confirmed as processed by Razorpay."
        : "Refund initiated with Razorpay. Status will update to Refunded once confirmed by the gateway.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

/**
 * Sync an initiated refund's real status directly from Razorpay.
 */
adminPaymentRouter.post("/payments/refunds/:refundId/sync", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reqRes = await client.query(
      `SELECT rr.*, pt.gateway_payment_id, pt.amount_paise, pt.refunded_amount_paise
       FROM refund_requests rr
       JOIN payment_transactions pt ON pt.id = rr.transaction_id
       WHERE rr.id = $1 FOR UPDATE OF rr`,
      [req.params.refundId],
    );
    if (!reqRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Refund request not found." });
    }
    const row = reqRes.rows[0];
    if (!row.gateway_refund_id || !row.gateway_payment_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Refund has not been initiated with the gateway yet." });
    }

    const gwRefund = await fetchGatewayRefund(row.gateway_payment_id, row.gateway_refund_id);
    let nextStatus = row.status;
    if (gwRefund.status === "processed" && row.status !== "REFUNDED") {
      nextStatus = "REFUNDED";
      const newTotalRefunded = Math.min(
        Number(row.amount_paise),
        Number(row.refunded_amount_paise) + Number(row.requested_amount_paise),
      );
      const nextTxStatus = newTotalRefunded >= Number(row.amount_paise) ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await client.query(
        "UPDATE payment_transactions SET refunded_amount_paise = $2, status = $3, updated_at = now() WHERE id = $1",
        [row.transaction_id, newTotalRefunded, nextTxStatus],
      );
      await client.query("UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1", [
        row.order_id,
        nextTxStatus,
      ]);
      if (nextTxStatus === "REFUNDED") {
        await client.query(
          "UPDATE student_subscriptions SET status = 'REVOKED', cancelled_at = now() WHERE order_id = $1",
          [row.order_id],
        );
        await client.query("UPDATE student_test_entitlements SET status = 'REVOKED' WHERE order_id = $1", [
          row.order_id,
        ]);
      }
    } else if (gwRefund.status === "failed") {
      nextStatus = "FAILED";
    }

    const updated = (
      await client.query(
        `UPDATE refund_requests
         SET status = $2, gateway_refund_status = $3,
             refunded_at = CASE WHEN $2 = 'REFUNDED' THEN COALESCE(refunded_at, now()) ELSE refunded_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [row.id, nextStatus, gwRefund.status || row.gateway_refund_status],
      )
    ).rows[0];

    await client.query("COMMIT");
    res.json({ refund: updated, gatewayStatus: gwRefund.status });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

/**
 * 9. Support Inquiries Management
 */
adminPaymentRouter.get("/payments/inquiries", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM support_inquiries ORDER BY created_at DESC LIMIT 100");
  res.json({ inquiries: rows.rows });
});

adminPaymentRouter.patch("/payments/inquiries/:id", async (req, res) => {
  const input = validate(
    z.object({
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      adminResponse: z.string().trim().max(2000).optional().default("").transform(sanitizeText),
    }),
    req.body,
  );
  const updated = await pool.query(
    `UPDATE support_inquiries
     SET status = $2, admin_response = COALESCE(NULLIF($3, ''), admin_response), updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [req.params.id, input.status, input.adminResponse],
  );
  if (!updated.rowCount) return res.status(404).json({ error: "Inquiry not found." });
  res.json({ inquiry: updated.rows[0] });
});
