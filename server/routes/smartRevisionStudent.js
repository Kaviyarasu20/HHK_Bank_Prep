import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  getStudentRevisionHistory,
  getStudentRevisionPreferences,
  recordRevisionReview,
  refreshStudentWeakTopics,
  syncAndBuildDailyRevision,
  updateStudentRevisionPreferences,
} from "../services/smartRevisionEngine.js";

export const smartRevisionStudentRouter = Router();
smartRevisionStudentRouter.use(requireAuth);

const reviewBodySchema = z.object({
  outcome: z.enum(["again", "hard", "good", "easy", "reviewed", "understood", "difficult"]),
});

const preferencesSchema = z.object({
  targetExams: z.array(z.string().trim().min(2).max(40)).max(20).optional(),
  dailyItemLimit: z.coerce.number().int().min(3).max(50).optional(),
  signalWeights: z.record(z.string(), z.coerce.number().min(0).max(100)).optional(),
});

smartRevisionStudentRouter.get("/daily", async (req, res, next) => {
  try {
    const data = await syncAndBuildDailyRevision(req.session.userId);
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
});

smartRevisionStudentRouter.get("/weak-topics", async (req, res, next) => {
  try {
    const weakTopics = await refreshStudentWeakTopics(req.session.userId);
    res.json({ success: true, weakTopics });
  } catch (err) {
    next(err);
  }
});

smartRevisionStudentRouter.post("/items/:itemId/review", async (req, res, next) => {
  try {
    const { itemId } = req.params;
    if (!isValidUuid(itemId)) {
      return res.status(400).json({ error: "Invalid revision item ID." });
    }
    const parsed = reviewBodySchema.parse(req.body || {});
    const result = await recordRevisionReview(req.session.userId, {
      itemId,
      outcome: parsed.outcome,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

smartRevisionStudentRouter.get("/history", async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
    const history = await getStudentRevisionHistory(req.session.userId, { limit });
    res.json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

smartRevisionStudentRouter.get("/preferences", async (req, res, next) => {
  try {
    const preferences = await getStudentRevisionPreferences(req.session.userId);
    res.json({ success: true, preferences });
  } catch (err) {
    next(err);
  }
});

smartRevisionStudentRouter.put("/preferences", async (req, res, next) => {
  try {
    const parsed = preferencesSchema.parse(req.body || {});
    const preferences = await updateStudentRevisionPreferences(req.session.userId, parsed);
    res.json({ success: true, preferences });
  } catch (err) {
    next(err);
  }
});
