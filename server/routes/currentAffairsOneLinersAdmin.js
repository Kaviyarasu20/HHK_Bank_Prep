import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid, validateAndNormalizeSourceUrl } from "../services/caUrlSecurity.js";
import { ONE_LINER_CATEGORIES } from "../services/caOneLinerCategorizer.js";
import { computeOneLinerHash } from "../services/caOneLinerDuplicateDetector.js";
import { generateOneLiners } from "../services/caOneLinerGenerator.js";
import { normalizeExamCodesList } from "../services/caExamMapper.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const currentAffairsOneLinersAdminRouter = Router();
currentAffairsOneLinersAdminRouter.use(requireAdmin);

const genLimiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false });

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

currentAffairsOneLinersAdminRouter.get("/statistics", async (_req, res) => {
  const [st, cats] = await Promise.all([
    pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE publication_status = 'draft')::int AS pending_review,
        count(*) FILTER (WHERE publication_status IN ('approved', 'published'))::int AS approved,
        count(*) FILTER (WHERE publication_status = 'rejected')::int AS rejected,
        count(*) FILTER (WHERE duplicate_status <> 'unique')::int AS duplicates,
        count(*) FILTER (WHERE study_priority = 'must_study')::int AS must_study
      FROM current_affairs_one_liners
    `),
    pool.query(`
      SELECT category_name, count(*)::int AS count
      FROM current_affairs_one_liners
      GROUP BY category_name ORDER BY count DESC LIMIT 20
    `),
  ]);
  const s = st.rows[0] || {};
  res.json({
    success: true,
    categories: ONE_LINER_CATEGORIES,
    stats: {
      total: s.total ?? 0,
      pendingReview: s.pending_review ?? 0,
      approved: s.approved ?? 0,
      rejected: s.rejected ?? 0,
      duplicates: s.duplicates ?? 0,
      mustStudy: s.must_study ?? 0,
      categoryDistribution: cats.rows,
    },
  });
});

async function generateAndSaveForArticle({ articleId, maxItems, actorId, ip }) {
  const artRes = await pool.query(
    `SELECT ca.*, cat.name AS category FROM current_affairs ca
     JOIN current_affairs_categories cat ON cat.id = ca.category_id
     WHERE ca.id = $1`,
    [articleId],
  );
  if (!artRes.rowCount) throw Object.assign(new Error("Article not found."), { status: 404 });
  const article = artRes.rows[0];
  const existing = await pool.query(
    "SELECT id, fact_text, content_hash FROM current_affairs_one_liners ORDER BY created_at DESC LIMIT 500",
  );

  const gen = await generateOneLiners({
    sourceTitle: article.title,
    sourceText: `${article.body}\n${article.static_gk || ""}`,
    sourceUrl: article.source_url || "",
    maxItems,
    existingOneLiners: existing.rows,
  });

  const saved = [];
  for (const item of gen.items) {
    const row = await pool.query(
      `INSERT INTO current_affairs_one_liners
         (source_article_id, fact_text, context, category_id, category_name, topic, subtopic,
          related_institution, related_person, important_date, important_figure, source_url,
          effective_date, study_priority, banking_relevance_score, exam_tags, content_hash,
          duplicate_status, validation_status, validation_errors, publication_status, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20::jsonb,'draft',$21,now())
       RETURNING *`,
      [
        article.id, item.factText, item.context, article.category_id, item.categoryName,
        item.topic, item.subtopic, item.relatedInstitution, item.relatedPerson,
        item.importantDate, item.importantFigure, item.sourceUrl, item.effectiveDate,
        item.studyPriority, item.bankingRelevanceScore, JSON.stringify(item.examTags),
        item.contentHash, item.duplicateStatus, item.validationStatus,
        JSON.stringify(item.validationErrors), actorId,
      ],
    );
    saved.push(row.rows[0]);
  }
  await audit(actorId, "current_affairs.one_liner.generate", "current_affairs_one_liner", null, {
    articleId, generated: saved.length,
  }, ip);
  return saved;
}

currentAffairsOneLinersAdminRouter.post("/generate", genLimiter, async (req, res) => {
  const { articleId, maxItems } = z
    .object({ articleId: z.string().uuid(), maxItems: z.coerce.number().int().min(1).max(8).default(4) })
    .parse(req.body);
  const items = await generateAndSaveForArticle({ articleId, maxItems, actorId: req.session.userId, ip: req.ip });
  res.status(201).json({ success: true, items });
});

currentAffairsOneLinersAdminRouter.post("/generate-bulk", genLimiter, async (req, res) => {
  const { articleIds, maxItems } = z
    .object({ articleIds: z.array(z.string().uuid()).min(1).max(10), maxItems: z.coerce.number().int().min(1).max(5).default(3) })
    .parse(req.body);
  const outcomes = [];
  for (const articleId of [...new Set(articleIds)]) {
    try {
      const items = await generateAndSaveForArticle({ articleId, maxItems, actorId: req.session.userId, ip: req.ip });
      outcomes.push({ articleId, ok: true, count: items.length });
    } catch (err) {
      outcomes.push({ articleId, ok: false, error: err.message });
    }
  }
  res.json({ success: true, outcomes });
});

currentAffairsOneLinersAdminRouter.get("/", async (req, res) => {
  const status = req.query.status && req.query.status !== "all" ? String(req.query.status) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;

  const [cnt, rows] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM current_affairs_one_liners WHERE ($1::text IS NULL OR publication_status = $1)", [status]),
    pool.query(
      "SELECT * FROM current_affairs_one_liners WHERE ($1::text IS NULL OR publication_status = $1) ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
      [status, limit, offset],
    ),
  ]);
  res.json({
    success: true,
    items: rows.rows,
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

currentAffairsOneLinersAdminRouter.get("/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const row = await pool.query("SELECT * FROM current_affairs_one_liners WHERE id = $1", [req.params.id]);
  if (!row.rowCount) return res.status(404).json({ error: "One-liner not found." });
  res.json({ success: true, item: row.rows[0] });
});

currentAffairsOneLinersAdminRouter.put("/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const input = z
    .object({
      factText: z.string().trim().min(18).max(400),
      context: z.string().trim().max(500).default(""),
      categoryName: z.string().trim().min(2).max(100),
      topic: z.string().trim().max(120).default(""),
      studyPriority: z.enum(["must_study", "important", "additional"]).default("important"),
      examTags: z.array(z.string().trim()).default([]),
      sourceUrl: z.string().trim().max(500).default(""),
    })
    .parse(req.body);

  const urlCheck = validateAndNormalizeSourceUrl(input.sourceUrl, { allowEmpty: true });
  if (!urlCheck.ok) return res.status(400).json({ error: urlCheck.error });

  const row = await pool.query(
    `UPDATE current_affairs_one_liners
     SET fact_text=$2, context=$3, category_name=$4, topic=$5, study_priority=$6,
         exam_tags=$7::jsonb, source_url=$8, content_hash=$9, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.factText, input.context, input.categoryName, input.topic || input.categoryName,
      input.studyPriority, JSON.stringify(normalizeExamCodesList(input.examTags)), urlCheck.url,
      computeOneLinerHash(input.factText),
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "One-liner not found." });
  await audit(req.session.userId, "current_affairs.one_liner.edit", "current_affairs_one_liner", req.params.id, {}, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

currentAffairsOneLinersAdminRouter.post("/:id/approve", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const row = await pool.query(
    `UPDATE current_affairs_one_liners
     SET publication_status = 'published', verification_status = 'verified', updated_at = now()
     WHERE id = $1 AND validation_status <> 'failed'
     RETURNING *`,
    [req.params.id],
  );
  if (!row.rowCount) return res.status(400).json({ error: "One-liner not found or failed mandatory validation." });
  await audit(req.session.userId, "current_affairs.one_liner.approve", "current_affairs_one_liner", req.params.id, {}, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

currentAffairsOneLinersAdminRouter.post("/:id/reject", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const row = await pool.query(
    "UPDATE current_affairs_one_liners SET publication_status = 'rejected', updated_at = now() WHERE id = $1 RETURNING id",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "One-liner not found." });
  await audit(req.session.userId, "current_affairs.one_liner.reject", "current_affairs_one_liner", req.params.id, {}, req.ip);
  res.json({ success: true, status: "rejected" });
});
