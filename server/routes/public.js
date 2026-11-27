import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { validate } from "../middleware.js";
import { emailSchema, sanitizeText } from "../schemas.js";
import { BANKING_SYLLABUS } from "../../shared/bankingSyllabus.js";
import { getRazorpayConfig } from "../services/razorpay.js";
import { getPaymentSettings } from "../services/paymentService.js";

export const publicRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120).transform(sanitizeText),
  email: emailSchema,
  category: z.enum(["GENERAL", "PAYMENT", "REFUND", "TECHNICAL", "EXAM_CONTENT"]).default("GENERAL"),
  transactionId: z.string().trim().max(120).optional().default("").transform(sanitizeText),
  subject: z.string().trim().min(3).max(200).transform(sanitizeText),
  message: z.string().trim().min(10).max(5000).transform(sanitizeText),
});

/**
 * Public non-secret platform & payment configuration.
 * NEVER exposes RAZORPAY_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET.
 */
publicRouter.get("/config", async (_req, res) => {
  const settings = await getPaymentSettings();
  const rp = getRazorpayConfig();
  res.json({
    config: {
      gatewayProvider: settings.gateway_provider,
      gatewayEnabled: Boolean(settings.gateway_enabled),
      gatewayConfigured: rp.isConfigured,
      gatewayMode: settings.gateway_mode,
      razorpayKeyId: rp.keyId || null,
      currency: settings.currency,
      allowIndividualTestPurchase: Boolean(settings.allow_individual_test_purchase),
      allowSubscriptionPurchase: Boolean(settings.allow_subscription_purchase),
      taxEnabled: Boolean(settings.tax_enabled),
      taxRateBps: Number(settings.tax_rate_bps || 0),
      taxLabel: settings.tax_label || "GST",
      refundWindowDays: Number(settings.refund_window_days ?? 7),
      refundProcessingDays: settings.refund_processing_days || "5-7 business days",
      supportEmail: settings.support_email || process.env.SUPPORT_EMAIL || "",
      supportPhone: settings.support_phone || "",
      businessName: settings.business_name || "HHK Banking Examination Preparation Platform",
      businessAddress: settings.business_address || "",
      policyVersion: settings.policy_version || "1.0",
    },
  });
});

/**
 * Public platform overview: exam categories, syllabus subjects/topics, and summary counts.
 */
publicRouter.get("/overview", async (_req, res) => {
  const [examStats, testStats, planStats, settings] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM exams WHERE status = 'published'"),
    pool.query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE access_type = 'FREE' OR (promotional_free_until IS NOT NULL AND promotional_free_until > now()))::int AS free_count,
         count(*) FILTER (WHERE access_type IN ('PAID', 'SUBSCRIPTION') AND (promotional_free_until IS NULL OR promotional_free_until <= now()))::int AS paid_count
       FROM mock_tests
       WHERE status = 'published' AND is_visible = TRUE`,
    ),
    pool.query("SELECT count(*)::int AS total FROM subscription_plans WHERE is_active = TRUE"),
    getPaymentSettings(),
  ]);

  res.json({
    stats: {
      publishedExams: examStats.rows[0]?.total ?? 0,
      publishedTests: testStats.rows[0]?.total ?? 0,
      freeTests: testStats.rows[0]?.free_count ?? 0,
      paidTests: testStats.rows[0]?.paid_count ?? 0,
      activePlans: planStats.rows[0]?.total ?? 0,
    },
    syllabus: BANKING_SYLLABUS,
    businessName: settings.business_name,
    supportEmail: settings.support_email || process.env.SUPPORT_EMAIL || "",
  });
});

/**
 * Public published exams catalogue (stages & sections metadata only — zero questions or answers).
 */
publicRouter.get("/exams", async (_req, res) => {
  const exams = (
    await pool.query(
      `SELECT e.id, e.code, e.name, e.category, e.sort_order, e.description,
              e.pattern_cycle, e.pattern_source_url, e.created_at,
              (SELECT count(*)::int FROM mock_tests mt
               WHERE mt.exam_id = e.id AND mt.status = 'published' AND mt.is_visible = TRUE) AS published_test_count
       FROM exams e
       WHERE e.status = 'published'
       ORDER BY e.sort_order, e.name`,
    )
  ).rows;

  const expanded = await Promise.all(
    exams.map(async (exam) => {
      const stages = (
        await pool.query(
          "SELECT id, name, duration_seconds, sort_order FROM exam_stages WHERE exam_id = $1 ORDER BY sort_order, name",
          [exam.id],
        )
      ).rows;
      return {
        ...exam,
        stages: await Promise.all(
          stages.map(async (stage) => ({
            ...stage,
            sections: (
              await pool.query(
                "SELECT id, name, question_count, duration_seconds, marks_per_correct, negative_marks, sort_order FROM exam_sections WHERE stage_id = $1 ORDER BY sort_order, name",
                [stage.id],
              )
            ).rows,
          })),
        ),
      };
    }),
  );

  res.json({ exams: expanded });
});

/**
 * Public mock test listings — metadata, pricing, duration, difficulty, question counts & max marks ONLY.
 * Strictly NEVER returns questions, options, or correct answers.
 */
publicRouter.get("/tests", async (req, res) => {
  const testType = req.query.test_type || req.query.testType || null;
  const examCategory = req.query.exam_category || req.query.examCategory || null;
  const examId = req.query.exam_id || req.query.examId || null;
  const subject = req.query.subject ? String(req.query.subject).trim() : null;
  const topic = req.query.topic ? String(req.query.topic).trim() : null;
  const accessFilter = req.query.access_type || req.query.accessType || null;

  const rows = await pool.query(
    `SELECT
       t.id, t.name, t.description, t.duration_seconds, t.review_policy,
       t.test_type, t.set_number, t.set_label, t.subject, t.topic,
       t.target_questions, t.marks_per_question, t.negative_marks,
       t.access_type, t.price_paise, t.currency, t.access_duration_days,
       t.is_purchasable, t.promotional_free_until, t.difficulty_label,
       (SELECT count(*)::int FROM mock_test_questions mtq WHERE mtq.mock_test_id = t.id) AS question_count,
       COALESCE(
         (SELECT SUM(COALESCE(t.marks_per_question, q.marks))::numeric(10,2)
          FROM mock_test_questions mtq
          JOIN questions q ON q.id = mtq.question_id
          WHERE mtq.mock_test_id = t.id),
         (t.target_questions * t.marks_per_question)::numeric(10,2),
         0
       ) AS max_marks,
       e.id AS exam_id, e.name AS exam_name, e.category AS exam_category,
       e.pattern_cycle, st.name AS stage_name
     FROM mock_tests t
     LEFT JOIN exams e ON e.id = t.exam_id
     LEFT JOIN exam_stages st ON st.id = t.stage_id
     WHERE t.status = 'published'
       AND t.is_visible = TRUE
       AND (t.test_type = 'TOPIC_WISE' OR e.status = 'published')
       AND (t.availability_start IS NULL OR t.availability_start <= now())
       AND (t.availability_end IS NULL OR t.availability_end >= now())
       AND ($1::text IS NULL OR t.test_type = $1)
       AND ($2::text IS NULL OR e.category = $2)
       AND ($3::uuid IS NULL OR t.exam_id = $3)
       AND ($4::text IS NULL OR LOWER(t.subject) = LOWER($4))
       AND ($5::text IS NULL OR LOWER(t.topic) = LOWER($5))
       AND ($6::text IS NULL OR t.access_type = $6)
     ORDER BY t.test_type ASC, t.access_type ASC, t.set_number ASC, t.created_at ASC`,
    [
      testType ? String(testType).toUpperCase() : null,
      examCategory ? String(examCategory) : null,
      examId ? String(examId) : null,
      subject,
      topic,
      accessFilter ? String(accessFilter).toUpperCase() : null,
    ],
  );

  res.json({ tests: rows.rows });
});

/**
 * Public single mock test detail & instructions metadata (no questions/answers).
 */
publicRouter.get("/tests/:testId", async (req, res) => {
  const row = await pool.query(
    `SELECT
       t.id, t.name, t.description, t.duration_seconds, t.review_policy,
       t.test_type, t.set_number, t.set_label, t.subject, t.topic,
       t.target_questions, t.marks_per_question, t.negative_marks,
       t.access_type, t.price_paise, t.currency, t.access_duration_days,
       t.is_purchasable, t.promotional_free_until, t.difficulty_label,
       (SELECT count(*)::int FROM mock_test_questions mtq WHERE mtq.mock_test_id = t.id) AS question_count,
       COALESCE(
         (SELECT SUM(COALESCE(t.marks_per_question, q.marks))::numeric(10,2)
          FROM mock_test_questions mtq
          JOIN questions q ON q.id = mtq.question_id
          WHERE mtq.mock_test_id = t.id),
         (t.target_questions * t.marks_per_question)::numeric(10,2),
         0
       ) AS max_marks,
       e.id AS exam_id, e.name AS exam_name, e.category AS exam_category,
       st.name AS stage_name
     FROM mock_tests t
     LEFT JOIN exams e ON e.id = t.exam_id
     LEFT JOIN exam_stages st ON st.id = t.stage_id
     WHERE t.id = $1
       AND t.status = 'published'
       AND t.is_visible = TRUE
       AND (t.test_type = 'TOPIC_WISE' OR e.status = 'published')`,
    [req.params.testId],
  );

  if (!row.rowCount) {
    return res.status(404).json({ error: "Mock test not found or unavailable." });
  }

  const eligiblePlans = await pool.query(
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
    [req.params.testId],
  );

  res.json({
    test: row.rows[0],
    eligiblePlans: eligiblePlans.rows,
  });
});

/**
 * Public active subscription plans listing.
 */
publicRouter.get("/plans", async (_req, res) => {
  const plans = await pool.query(
    `SELECT
       sp.id, sp.code, sp.name, sp.description, sp.duration_days,
       sp.price_paise, sp.promo_price_paise, sp.promo_valid_until,
       sp.currency, sp.access_scope, sp.max_tests_included,
       sp.features, sp.is_featured, sp.sort_order,
       (SELECT count(*)::int FROM subscription_plan_tests spt WHERE spt.plan_id = sp.id) AS selected_tests_count
     FROM subscription_plans sp
     WHERE sp.is_active = TRUE
     ORDER BY sp.sort_order ASC, sp.price_paise ASC`,
  );
  res.json({ plans: plans.rows });
});

/**
 * Public Contact & Support submission (supports Payment and Refund support categories + Transaction ID).
 */
publicRouter.post("/contact", contactLimiter, async (req, res) => {
  const input = validate(contactSchema, req.body);
  const userId = req.session?.userId ?? null;
  const inserted = await pool.query(
    `INSERT INTO support_inquiries (user_id, full_name, email, category, transaction_id, subject, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, category, status, created_at`,
    [
      userId,
      input.fullName,
      input.email,
      input.category,
      input.transactionId || null,
      input.subject,
      input.message,
    ],
  );
  res.status(201).json({
    inquiry: inserted.rows[0],
    message: "Your support inquiry has been received. Our team will review it shortly.",
  });
});