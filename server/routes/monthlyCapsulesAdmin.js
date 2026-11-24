import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  addCapsuleContentLink,
  addCapsuleSection,
  autoGenerateCapsuleDraft,
  createCapsuleDraft,
  deleteCapsuleSection,
  getCapsuleDetail,
  listCapsules,
  removeCapsuleContentLink,
  reorderCapsuleSections,
  transitionCapsuleStatus,
  updateCapsuleMetadata,
  validateAndPersistCapsule,
} from "../services/monthlyCapsuleService.js";

export const monthlyCapsulesAdminRouter = Router();
monthlyCapsulesAdminRouter.use(requireAdmin);

const genLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

const createSchema = z.object({
  capsuleYear: z.coerce.number().int().min(2020).max(2100),
  capsuleMonth: z.coerce.number().int().min(1).max(12),
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().max(2000).optional(),
  estimatedReadMinutes: z.coerce.number().int().min(1).max(300).optional(),
  examTags: z.array(z.string().trim()).max(20).optional(),
});

const generateSchema = z.object({
  capsuleYear: z.coerce.number().int().min(2020).max(2100),
  capsuleMonth: z.coerce.number().int().min(1).max(12),
  examTags: z.array(z.string().trim()).max(20).optional(),
  useAi: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(4).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  estimatedReadMinutes: z.coerce.number().int().min(1).max(300).optional(),
  examTags: z.array(z.string().trim()).max(20).optional(),
});

const sectionSchema = z.object({
  title: z.string().trim().min(2).max(180),
  categoryName: z.string().trim().max(120).optional().nullable(),
  introduction: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().min(1).max(500).optional(),
});

const reorderSchema = z.object({
  orderedSectionIds: z.array(z.string().uuid()).min(1).max(200),
});

const linkSchema = z.object({
  contentType: z.enum(["article", "one_liner", "mcq", "flashcard", "banking_reference"]),
  contentId: z.string().trim().min(1).max(100),
  sourceUrl: z.string().trim().max(1000).optional().nullable(),
  effectiveDate: z.string().trim().max(40).optional().nullable(),
});

const statusSchema = z.object({
  targetStatus: z.enum(["draft", "review", "approved", "published", "archived"]),
});

monthlyCapsulesAdminRouter.get("/", async (req, res, next) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const examCode = req.query.exam ? String(req.query.exam).trim() : undefined;
    const capsules = await listCapsules({
      publishedOnly: false,
      year: Number.isInteger(year) ? year : undefined,
      month: Number.isInteger(month) ? month : undefined,
      examCode,
    });
    res.json({ success: true, capsules });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.get("/:id", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const capsule = await getCapsuleDetail(req.params.id, { publishedOnly: false });
    if (!capsule) return res.status(404).json({ error: "Monthly capsule not found." });
    res.json({ success: true, capsule });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.parse(req.body || {});
    const capsule = await createCapsuleDraft({
      ...parsed,
      createdBy: req.session.userId,
    });
    await audit(req.session.userId, "monthly_capsule.create", "monthly_capsule", capsule.id, {
      year: parsed.capsuleYear,
      month: parsed.capsuleMonth,
    }, req.ip);
    res.status(201).json({ success: true, capsule });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/generate", genLimiter, async (req, res, next) => {
  try {
    const parsed = generateSchema.parse(req.body || {});
    const { capsule, usedAi } = await autoGenerateCapsuleDraft({
      ...parsed,
      createdBy: req.session.userId,
    });
    await audit(req.session.userId, "monthly_capsule.generate_draft", "monthly_capsule", capsule.id, {
      year: parsed.capsuleYear,
      month: parsed.capsuleMonth,
      usedAi,
    }, req.ip);
    res.status(201).json({ success: true, capsule, usedAi });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const parsed = updateSchema.parse(req.body || {});
    const capsule = await updateCapsuleMetadata(req.params.id, parsed);
    if (!capsule) return res.status(404).json({ error: "Monthly capsule not found." });
    await audit(req.session.userId, "monthly_capsule.update", "monthly_capsule", capsule.id, parsed, req.ip);
    res.json({ success: true, capsule });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/:id/sections", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const parsed = sectionSchema.parse(req.body || {});
    const section = await addCapsuleSection(req.params.id, parsed);
    await audit(req.session.userId, "monthly_capsule.add_section", "monthly_capsule", req.params.id, {
      sectionId: section.id,
      title: section.title,
    }, req.ip);
    res.status(201).json({ success: true, section });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.put("/:id/sections/reorder", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const parsed = reorderSchema.parse(req.body || {});
    const capsule = await reorderCapsuleSections(req.params.id, parsed.orderedSectionIds);
    await audit(req.session.userId, "monthly_capsule.reorder_sections", "monthly_capsule", req.params.id, {
      count: parsed.orderedSectionIds.length,
    }, req.ip);
    res.json({ success: true, capsule });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.delete("/:id/sections/:sectionId", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.sectionId)) {
      return res.status(400).json({ error: "Invalid capsule or section ID." });
    }
    const removed = await deleteCapsuleSection(req.params.id, req.params.sectionId);
    if (!removed) return res.status(404).json({ error: "Section not found." });
    await audit(req.session.userId, "monthly_capsule.delete_section", "monthly_capsule", req.params.id, {
      sectionId: req.params.sectionId,
    }, req.ip);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/:id/sections/:sectionId/links", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.sectionId)) {
      return res.status(400).json({ error: "Invalid capsule or section ID." });
    }
    const parsed = linkSchema.parse(req.body || {});
    const link = await addCapsuleContentLink(req.params.id, req.params.sectionId, parsed);
    await audit(req.session.userId, "monthly_capsule.add_link", "monthly_capsule", req.params.id, {
      sectionId: req.params.sectionId,
      contentType: parsed.contentType,
      contentId: parsed.contentId,
    }, req.ip);
    res.status(201).json({ success: true, link });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.delete("/:id/links/:linkId", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.linkId)) {
      return res.status(400).json({ error: "Invalid capsule or link ID." });
    }
    const removed = await removeCapsuleContentLink(req.params.id, req.params.linkId);
    if (!removed) return res.status(404).json({ error: "Content link not found." });
    await audit(req.session.userId, "monthly_capsule.remove_link", "monthly_capsule", req.params.id, {
      linkId: req.params.linkId,
    }, req.ip);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/:id/validate", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const validation = await validateAndPersistCapsule(req.params.id);
    if (!validation) return res.status(404).json({ error: "Monthly capsule not found." });
    res.json({ success: true, validation });
  } catch (err) {
    next(err);
  }
});

monthlyCapsulesAdminRouter.post("/:id/status", async (req, res, next) => {
  try {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid capsule ID." });
    }
    const parsed = statusSchema.parse(req.body || {});
    const capsule = await transitionCapsuleStatus(req.params.id, {
      targetStatus: parsed.targetStatus,
      adminUserId: req.session.userId,
    });
    await audit(req.session.userId, `monthly_capsule.${parsed.targetStatus}`, "monthly_capsule", capsule.id, {
      status: parsed.targetStatus,
    }, req.ip);
    res.json({ success: true, capsule });
  } catch (err) {
    if (err.validation) {
      return res.status(err.status || 422).json({ error: err.message, validation: err.validation });
    }
    next(err);
  }
});
