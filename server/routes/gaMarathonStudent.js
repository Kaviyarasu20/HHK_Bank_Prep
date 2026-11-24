import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  GA_MARATHON_CATEGORIES,
  GA_SUPPORTED_EXAMS,
} from "../services/gaTestConfigurationService.js";
import { checkGaTestEligibility } from "../services/gaEntitlementService.js";
import {
  getStudentGaAttemptResult,
  getStudentGaDashboard,
  listStudentGaTests,
} from "../services/gaMarathonService.js";

export const gaMarathonStudentRouter = Router();
gaMarathonStudentRouter.use(requireAuth);

gaMarathonStudentRouter.get("/dashboard", async (req, res, next) => {
  try {
    const dashboard = await getStudentGaDashboard(req.session.userId, pool);
    res.json({
      success: true,
      categories: GA_MARATHON_CATEGORIES,
      exams: GA_SUPPORTED_EXAMS,
      ...dashboard,
    });
  } catch (err) {
    next(err);
  }
});

gaMarathonStudentRouter.get("/tests", async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category).trim() : undefined;
    const exam = req.query.exam ? String(req.query.exam).trim() : undefined;
    const status = req.query.status ? String(req.query.status).trim() : undefined;
    const tests = await listStudentGaTests(req.session.userId, { category, exam, status }, pool);
    res.json({ success: true, tests });
  } catch (err) {
    next(err);
  }
});

gaMarathonStudentRouter.get("/tests/:testId/eligibility", async (req, res, next) => {
  try {
    const { testId } = req.params;
    if (!isValidUuid(testId)) {
      return res.status(400).json({ error: "Invalid GA Marathon test ID." });
    }
    const result = await checkGaTestEligibility({
      db: pool,
      userId: req.session.userId,
      userRole: req.session.role,
      testId,
    });
    res.status(result.eligible ? 200 : result.access?.httpStatus || 403).json({
      success: result.eligible,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

gaMarathonStudentRouter.get("/attempts/:attemptId/result", async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    if (!isValidUuid(attemptId)) {
      return res.status(400).json({ error: "Invalid attempt ID." });
    }
    const result = await getStudentGaAttemptResult(req.session.userId, attemptId, pool);
    if (!result) {
      return res.status(404).json({ error: "GA Marathon attempt not found." });
    }
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});
