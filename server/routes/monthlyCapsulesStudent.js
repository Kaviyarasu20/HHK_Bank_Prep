import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { getCapsuleDetail, listCapsules } from "../services/monthlyCapsuleService.js";
import {
  getStudentCapsuleProgress,
  markCapsuleSectionProgress,
  recordCapsuleOpen,
} from "../services/monthlyCapsuleProgressService.js";

export const monthlyCapsulesStudentRouter = Router();
monthlyCapsulesStudentRouter.use(requireAuth);

const sectionProgressSchema = z.object({
  isCompleted: z.boolean().default(true),
});

monthlyCapsulesStudentRouter.get("/", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const examCode = req.query.exam ? String(req.query.exam).trim() : undefined;
    const capsules = await listCapsules({
      publishedOnly: true,
      year: Number.isInteger(year) ? year : undefined,
      month: Number.isInteger(month) ? month : undefined,
      examCode,
      studentId: req.session.userId,
    });
    res.json({ success: true, capsules });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesStudentRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const capsule = await getCapsuleDetail(id, { publishedOnly: true });
    if (!capsule) {
      return res.status(404).json({ error: "Monthly capsule not found." });
    }

    await recordCapsuleOpen(req.session.userId, id);
    const studentProgress = await getStudentCapsuleProgress(req.session.userId, id);
    res.json({
      success: true,
      capsule,
      progress: studentProgress.progress,
      completedSectionIds: studentProgress.completedSectionIds,
    });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesStudentRouter.post("/:id/sections/:sectionId/progress", async (req, res, next) => {
  try {
    const { id, sectionId } = req.params;
    if (!isValidUuid(id) || !isValidUuid(sectionId)) {
      return res.status(400).json({ error: "Invalid capsule or section ID." });
    }
    const capsule = await getCapsuleDetail(id, { publishedOnly: true });
    if (!capsule) {
      return res.status(404).json({ error: "Monthly capsule not found." });
    }

    const parsed = sectionProgressSchema.parse(req.body || {});
    const progress = await markCapsuleSectionProgress(req.session.userId, id, sectionId, {
      isCompleted: parsed.isCompleted,
    });
    const full = await getStudentCapsuleProgress(req.session.userId, id);
    res.json({
      success: true,
      progress,
      completedSectionIds: full.completedSectionIds,
    });
  } catch (err) {
    next(err);
  }
});
