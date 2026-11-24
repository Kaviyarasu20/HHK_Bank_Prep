import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  ACCESS_TYPES,
  ANSWER_RELEASE_POLICIES,
  GA_MARATHON_CATEGORIES,
  GA_SUPPORTED_EXAMS,
} from "../services/gaTestConfigurationService.js";
import {
  assignApprovedQuestionsToGaTest,
  createGaMarathonTest,
  getAdminGaTestDetail,
  listAdminGaTests,
  transitionGaTestStatus,
} from "../services/gaMarathonService.js";

export const gaMarathonAdminRouter = Router();
gaMarathonAdminRouter.use(requireAdmin);

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

const selectQuestionsSchema = z.object({
  filters: z
    .object({
      examCode: z.string().trim().optional(),
      topic: z.string().trim().optional(),
      difficulty: z.string().trim().optional(),
      questionType: z.string().trim().optional(),
      dateFrom: z.string().trim().optional(),
      dateTo: z.string().trim().optional(),
      capsuleId: z.string().uuid().optional(),
    })
    .optional(),
  manualQuestionIds: z.array(z.string().uuid()).max(200).optional(),
});

const statusSchema = z.object({
  targetStatus: z.enum(["draft", "published", "archived"]),
});

gaMarathonAdminRouter.get("/metadata", (_req, res) => {
  res.json({
    success: true,
    categories: GA_MARATHON_CATEGORIES,
    exams: GA_SUPPORTED_EXAMS,
    answerReleasePolicies: ANSWER_RELEASE_POLICIES,
    accessTypes: ACCESS_TYPES,
  });
});

gaMarathonAdminRouter.get("/tests", async (_req, res, next) => {
  try {
    const tests = await listAdminGaTests(pool);
    res.json({ success: true, tests });
  } catch (err) {
    next(err);
  }
});

gaMarathonAdminRouter.get("/tests/:testId", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.testId)) {
      return res.status(400).json({ error: "Invalid GA Marathon test ID." });
    }
    const test = await getAdminGaTestDetail(req.params.testId, pool);
    if (!test) return res.status(404).json({ error: "GA Marathon test not found." });
    res.json({ success: true, test });
  } catch (err) {
    next(err);
  }
});

gaMarathonAdminRouter.post("/tests", async (req, res, next) => {
  try {
    const test = await createGaMarathonTest(req.body || {}, req.session.userId, pool);
    await audit(req.session.userId, "ga_marathon.create", "mock_test", test.id, {
      gaCategory: test.ga_category,
      targetQuestions: test.target_questions,
      accessType: test.access_type,
    }, req.ip);
    res.status(201).json({ success: true, test });
  } catch (err) {
    if (err.details) {
      return res.status(err.status || 400).json({ error: err.message, details: err.details });
    }
    next(err);
  }
});

gaMarathonAdminRouter.post("/tests/:testId/select-questions", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.testId)) {
      return res.status(400).json({ error: "Invalid GA Marathon test ID." });
    }
    const parsed = selectQuestionsSchema.parse(req.body || {});
    const result = await assignApprovedQuestionsToGaTest(req.params.testId, parsed, pool);
    await audit(req.session.userId, "ga_marathon.select_questions", "mock_test", req.params.testId, {
      selectedCount: result.selectedCount,
      warnings: result.warnings,
    }, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.validation) {
      return res.status(err.status || 422).json({ error: err.message, validation: err.validation });
    }
    next(err);
  }
});

gaMarathonAdminRouter.post("/tests/:testId/status", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.testId)) {
      return res.status(400).json({ error: "Invalid GA Marathon test ID." });
    }
    const parsed = statusSchema.parse(req.body || {});
    const test = await transitionGaTestStatus(req.params.testId, parsed.targetStatus, pool);
    await audit(req.session.userId, `ga_marathon.${parsed.targetStatus}`, "mock_test", test.id, {
      status: parsed.targetStatus,
    }, req.ip);
    res.json({ success: true, test });
  } catch (err) {
    next(err);
  }
});

gaMarathonAdminRouter.get("/tests/:testId/attempts", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.testId)) {
      return res.status(400).json({ error: "Invalid GA Marathon test ID." });
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ta.id, ta.student_id, u.name AS student_name, u.email AS student_email,
                ta.status, ta.score, ta.max_score, ta.correct_count, ta.wrong_count,
                ta.unanswered_count, ta.elapsed_seconds, ta.started_at, ta.submitted_at
         FROM test_attempts ta
         JOIN users u ON u.id = ta.student_id
         WHERE ta.mock_test_id = $1
         ORDER BY ta.started_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.testId, limit, offset],
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM test_attempts WHERE mock_test_id = $1`, [req.params.testId]),
    ]);

    res.json({
      success: true,
      attempts: rowsRes.rows,
      pagination: {
        page,
        limit,
        total: countRes.rows[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
