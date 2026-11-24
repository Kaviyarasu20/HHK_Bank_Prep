import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { computeArticleContentHash, isValidUuid } from "../services/caUrlSecurity.js";
import { formatArticleWithAi } from "../services/caAiFormatter.js";
import {
  classifyBankingRelevance,
  normalizeExamTags,
} from "../services/caBankingRelevance.js";
import { getAiConfig } from "../services/caAiProvider.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const currentAffairsAiAdminRouter = Router();
currentAffairsAiAdminRouter.use(requireAdmin);

const aiProcessLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "AI processing rate limit reached. Try again in a minute." },
});

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

async function processSingleArticle({ articleId, actorId, force = false, ip = null }) {
  const artRes = await pool.query(
    `SELECT ca.*, cat.name AS category
     FROM current_affairs ca
     JOIN current_affairs_categories cat ON cat.id = ca.category_id
     WHERE ca.id = $1`,
    [articleId],
  );
  if (!artRes.rowCount) {
    throw Object.assign(new Error("Current affairs article not found."), { status: 404 });
  }
  const article = artRes.rows[0];
  const currentHash =
    article.content_hash || computeArticleContentHash({ title: article.title, body: article.body });

  // Avoid unnecessary AI calls if an unchanged article already has a non-failed result (unless force=true)
  if (!force) {
    const existing = await pool.query(
      `SELECT id, processing_status
       FROM current_affairs_ai_results
       WHERE current_affairs_id = $1
         AND article_content_hash = $2
         AND processing_status IN ('completed', 'review_required', 'approved')
       ORDER BY created_at DESC
       LIMIT 1`,
      [articleId, currentHash],
    );
    if (existing.rowCount) {
      return {
        skipped: true,
        resultId: existing.rows[0].id,
        processingStatus: existing.rows[0].processing_status,
        message: "Article already processed with unchanged content. Pass force=true to regenerate.",
      };
    }
  }

  // Reserve in-flight lock row (enforced by uq_ca_ai_one_inflight_per_article)
  let jobId;
  try {
    const cfg = getAiConfig();
    const lockRow = await pool.query(
      `INSERT INTO current_affairs_ai_results
         (current_affairs_id, article_content_hash, provider, model, processing_status, created_by)
       VALUES ($1, $2, $3, $4, 'processing', $5)
       RETURNING id`,
      [articleId, currentHash, cfg.provider, cfg.model, actorId],
    );
    jobId = lockRow.rows[0].id;
  } catch (err) {
    if (err?.code === "23505") {
      throw Object.assign(
        new Error("AI processing is already in progress for this article."),
        { status: 409 },
      );
    }
    throw err;
  }

  const outcome = await formatArticleWithAi(article, { db: pool });
  const s = outcome.structured;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE current_affairs_ai_results
       SET provider = $2,
           model = $3,
           prompt_version = $4,
           processing_status = $5,
           exam_headline = $6,
           summary = $7,
           detailed_explanation = $8,
           why_it_matters = $9,
           takeaways = $10::jsonb,
           important_terms = $11::jsonb,
           banking_relevance_score = $12,
           banking_relevance_level = $13,
           relevance_reason = $14,
           study_priority = $15,
           confidence_score = $16,
           usage_meta = $17::jsonb,
           raw_ai_response = $18::jsonb,
           validation_status = $19,
           validation_errors = $20::jsonb,
           error_message = $21,
           updated_at = now()
       WHERE id = $1`,
      [
        jobId,
        outcome.provider,
        outcome.model,
        outcome.promptVersion,
        outcome.processingStatus,
        s?.examHeadline || "",
        s?.summary || "",
        s?.detailedExplanation || "",
        s?.whyItMatters || "",
        JSON.stringify(s?.takeaways || []),
        JSON.stringify(s?.importantTerms || []),
        s?.bankingRelevanceScore ?? null,
        s?.bankingRelevanceLevel || "low_relevance",
        s?.relevanceReason || "",
        s?.studyPriority || "additional",
        s?.confidenceScore ?? null,
        JSON.stringify(outcome.usage || {}),
        JSON.stringify(outcome.rawResponse || {}),
        outcome.validationStatus,
        JSON.stringify(outcome.validationErrors || []),
        outcome.errorMessage || "",
      ],
    );

    if (s) {
      for (const f of s.facts || []) {
        await client.query(
          `INSERT INTO current_affairs_ai_facts
             (ai_result_id, fact_type, fact_text, fact_value, unit, event_stage, context, source_reference, confidence_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            jobId,
            f.factType,
            f.factText,
            f.factValue,
            f.unit,
            f.eventStage,
            f.context,
            f.sourceReference,
            f.confidenceScore,
          ],
        );
      }
      for (const t of s.topics || []) {
        await client.query(
          `INSERT INTO current_affairs_ai_topics
             (ai_result_id, topic_name, topic_category, relevance_score)
           VALUES ($1,$2,$3,$4)`,
          [jobId, t.topicName, t.topicCategory, t.relevanceScore],
        );
      }
      for (const tag of s.examTags || []) {
        await client.query(
          `INSERT INTO current_affairs_ai_exam_tags
             (ai_result_id, exam_code, relevance_reason, confidence_score)
           VALUES ($1,$2,$3,$4)`,
          [jobId, tag.examCode, tag.relevanceReason, tag.confidenceScore],
        );
      }
      for (const gk of s.staticGkConnections || []) {
        await client.query(
          `INSERT INTO current_affairs_ai_static_gk
             (ai_result_id, title, description, reference_type, reference_id, source_reference)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [jobId, gk.title, gk.description, gk.referenceType, gk.referenceId, gk.sourceReference],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    await pool.query(
      "UPDATE current_affairs_ai_results SET processing_status = 'failed', error_message = $2, updated_at = now() WHERE id = $1",
      [jobId, String(err?.message || "Database save error").slice(0, 300)],
    );
    throw err;
  } finally {
    client.release();
  }

  await audit(
    actorId,
    "current_affairs.ai.process",
    "current_affairs_ai_result",
    jobId,
    {
      articleId,
      processingStatus: outcome.processingStatus,
      validationStatus: outcome.validationStatus,
      provider: outcome.provider,
      model: outcome.model,
    },
    ip,
  );

  return {
    skipped: false,
    resultId: jobId,
    processingStatus: outcome.processingStatus,
    validationStatus: outcome.validationStatus,
    errorMessage: outcome.errorMessage,
  };
}

// 1. Statistics Dashboard
currentAffairsAiAdminRouter.get("/statistics", async (_req, res) => {
  const cfg = getAiConfig();
  const [articlesRes, aiRes] = await Promise.all([
    pool.query(`
      SELECT count(*)::int AS awaiting_ai
      FROM current_affairs ca
      WHERE ca.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1 FROM current_affairs_ai_results r
          WHERE r.current_affairs_id = ca.id
            AND r.processing_status IN ('completed', 'review_required', 'approved')
        )
    `),
    pool.query(`
      SELECT
        count(*) FILTER (WHERE processing_status IN ('completed', 'review_required', 'approved'))::int AS processed,
        count(*) FILTER (WHERE processing_status IN ('failed', 'validation_failed'))::int AS failed,
        count(*) FILTER (WHERE processing_status IN ('completed', 'review_required'))::int AS awaiting_review,
        count(*) FILTER (WHERE processing_status = 'approved')::int AS approved,
        count(*) FILTER (WHERE processing_status = 'rejected')::int AS rejected,
        count(*) FILTER (WHERE processing_status = 'approved' AND study_priority = 'must_study')::int AS must_study,
        count(*) FILTER (WHERE processing_status = 'approved' AND banking_relevance_level = 'highly_relevant')::int AS highly_relevant
      FROM current_affairs_ai_results
    `),
  ]);

  const a = aiRes.rows[0] || {};
  res.json({
    success: true,
    aiConfig: { enabled: cfg.enabled, provider: cfg.provider, model: cfg.model, configured: cfg.hasApiKey },
    stats: {
      awaitingAi: articlesRes.rows[0]?.awaiting_ai ?? 0,
      processed: a.processed ?? 0,
      failed: a.failed ?? 0,
      awaitingReview: a.awaiting_review ?? 0,
      approved: a.approved ?? 0,
      rejected: a.rejected ?? 0,
      mustStudy: a.must_study ?? 0,
      highlyRelevant: a.highly_relevant ?? 0,
    },
  });
});

// 2. Process Single Article
currentAffairsAiAdminRouter.post("/process/:articleId", aiProcessLimiter, async (req, res) => {
  if (!isValidUuid(req.params.articleId)) {
    return res.status(400).json({ error: "Invalid article ID." });
  }
  const { force } = z.object({ force: z.boolean().default(false) }).parse(req.body ?? {});
  const out = await processSingleArticle({
    articleId: req.params.articleId,
    actorId: req.session.userId,
    force,
    ip: req.ip,
  });
  res.status(out.skipped ? 200 : 201).json({ success: true, ...out });
});

// 3. Process Bulk Articles (controlled concurrency = 2, max 10 per request)
currentAffairsAiAdminRouter.post("/process-bulk", aiProcessLimiter, async (req, res) => {
  const { articleIds, force } = z
    .object({
      articleIds: z.array(z.string().uuid()).min(1).max(10),
      force: z.boolean().default(false),
    })
    .parse(req.body);

  const uniqueIds = [...new Set(articleIds)];
  const outcomes = [];
  const concurrency = 2;

  for (let i = 0; i < uniqueIds.length; i += concurrency) {
    const batch = uniqueIds.slice(i, i + concurrency);
    const settled = await Promise.all(
      batch.map(async (articleId) => {
        try {
          const out = await processSingleArticle({
            articleId,
            actorId: req.session.userId,
            force,
            ip: req.ip,
          });
          return { articleId, ok: true, ...out };
        } catch (err) {
          return { articleId, ok: false, error: err.message || "Processing failed." };
        }
      }),
    );
    outcomes.push(...settled);
  }

  res.json({
    success: true,
    total: uniqueIds.length,
    succeeded: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    outcomes,
  });
});

// 4. List AI Results (Paginated Review Queue)
currentAffairsAiAdminRouter.get("/results", async (req, res) => {
  const q = z
    .object({
      status: z.string().trim().optional(),
      priority: z.string().trim().optional(),
      relevance: z.string().trim().optional(),
      search: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(req.query);

  const statusFilter = q.status && q.status !== "all" ? q.status : null;
  const priorityFilter = q.priority && q.priority !== "all" ? q.priority : null;
  const relevanceFilter = q.relevance && q.relevance !== "all" ? q.relevance : null;
  const searchPattern = q.search ? `%${q.search.replace(/[%_]/g, "\\$&")}%` : null;
  const offset = (q.page - 1) * q.limit;

  const params = [statusFilter, priorityFilter, relevanceFilter, searchPattern];
  const where = `
    WHERE ($1::text IS NULL OR r.processing_status = $1)
      AND ($2::text IS NULL OR r.study_priority = $2)
      AND ($3::text IS NULL OR r.banking_relevance_level = $3)
      AND ($4::text IS NULL OR ca.title ILIKE $4 ESCAPE '\\' OR r.exam_headline ILIKE $4 ESCAPE '\\')
  `;

  const [cnt, rows] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total
       FROM current_affairs_ai_results r
       JOIN current_affairs ca ON ca.id = r.current_affairs_id
       ${where}`,
      params,
    ),
    pool.query(
      `SELECT
         r.id, r.current_affairs_id, r.provider, r.model, r.prompt_version,
         r.processing_status, r.exam_headline, r.summary, r.banking_relevance_score,
         r.banking_relevance_level, r.study_priority, r.confidence_score,
         r.validation_status, r.validation_errors, r.error_message,
         r.created_at, r.updated_at,
         ca.title AS original_title, ca.source_name, ca.source_url, ca.status AS article_status,
         cat.name AS category
       FROM current_affairs_ai_results r
       JOIN current_affairs ca ON ca.id = r.current_affairs_id
       JOIN current_affairs_categories cat ON cat.id = ca.category_id
       ${where}
       ORDER BY r.updated_at DESC
       LIMIT $5 OFFSET $6`,
      [...params, q.limit, offset],
    ),
  ]);

  res.json({
    success: true,
    items: rows.rows,
    pagination: buildPaginationMeta({ page: q.page, limit: q.limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

// 5. Get Single AI Result Detail (with facts, topics, exam tags, static GK & reviews)
currentAffairsAiAdminRouter.get("/results/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });

  const resRow = await pool.query(
    `SELECT r.*, ca.title AS original_title, ca.body AS original_body,
            ca.source_name, ca.source_url, ca.published_at, ca.status AS article_status,
            cat.name AS category
     FROM current_affairs_ai_results r
     JOIN current_affairs ca ON ca.id = r.current_affairs_id
     JOIN current_affairs_categories cat ON cat.id = ca.category_id
     WHERE r.id = $1`,
    [req.params.id],
  );
  if (!resRow.rowCount) return res.status(404).json({ error: "AI result not found." });

  const [facts, topics, examTags, staticGk, reviews] = await Promise.all([
    pool.query("SELECT * FROM current_affairs_ai_facts WHERE ai_result_id = $1 ORDER BY id", [req.params.id]),
    pool.query("SELECT * FROM current_affairs_ai_topics WHERE ai_result_id = $1 ORDER BY relevance_score DESC NULLS LAST", [req.params.id]),
    pool.query("SELECT * FROM current_affairs_ai_exam_tags WHERE ai_result_id = $1 ORDER BY exam_code", [req.params.id]),
    pool.query("SELECT * FROM current_affairs_ai_static_gk WHERE ai_result_id = $1 ORDER BY id", [req.params.id]),
    pool.query(
      `SELECT rev.*, u.full_name AS reviewer_name
       FROM current_affairs_ai_reviews rev
       LEFT JOIN users u ON u.id = rev.reviewed_by
       WHERE rev.ai_result_id = $1
       ORDER BY rev.reviewed_at DESC`,
      [req.params.id],
    ),
  ]);

  // Never leak secrets; raw_ai_response is retained for internal audit only
  const { raw_ai_response: _omitRaw, ...safeResult } = resRow.rows[0];
  res.json({
    success: true,
    result: {
      ...safeResult,
      facts: facts.rows,
      topics: topics.rows,
      examTags: examTags.rows,
      staticGk: staticGk.rows,
      reviews: reviews.rows,
    },
  });
});

// 6. Regenerate AI Content (preserves previous approved results as separate attempts)
currentAffairsAiAdminRouter.post("/results/:id/regenerate", aiProcessLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });
  const existing = await pool.query(
    "SELECT current_affairs_id FROM current_affairs_ai_results WHERE id = $1",
    [req.params.id],
  );
  if (!existing.rowCount) return res.status(404).json({ error: "AI result not found." });

  const out = await processSingleArticle({
    articleId: existing.rows[0].current_affairs_id,
    actorId: req.session.userId,
    force: true,
    ip: req.ip,
  });
  res.status(201).json({ success: true, ...out });
});

// 7. Edit AI Result (headline, summary, priority, relevance, exam tags, remove incorrect facts)
currentAffairsAiAdminRouter.put("/results/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });

  const input = z
    .object({
      examHeadline: z.string().trim().min(4).max(240).optional(),
      summary: z.string().trim().min(10).max(2000).optional(),
      detailedExplanation: z.string().trim().max(6000).optional(),
      whyItMatters: z.string().trim().max(1500).optional(),
      takeaways: z.array(z.string().trim().min(2).max(500)).max(15).optional(),
      bankingRelevanceScore: z.coerce.number().int().min(0).max(100).optional(),
      relevanceReason: z.string().trim().max(1200).optional(),
      studyPriority: z.enum(["must_study", "important", "additional"]).optional(),
      examTags: z
        .array(
          z.object({
            examCode: z.string().trim().min(2).max(40),
            relevanceReason: z.string().trim().max(400).default(""),
          }),
        )
        .optional(),
      removeFactIds: z.array(z.string().uuid()).max(50).optional(),
      adminFeedback: z.string().trim().max(1000).default(""),
    })
    .parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const level =
      input.bankingRelevanceScore !== undefined
        ? classifyBankingRelevance(input.bankingRelevanceScore)
        : null;

    const updated = await client.query(
      `UPDATE current_affairs_ai_results
       SET exam_headline = COALESCE($2, exam_headline),
           summary = COALESCE($3, summary),
           detailed_explanation = COALESCE($4, detailed_explanation),
           why_it_matters = COALESCE($5, why_it_matters),
           takeaways = COALESCE($6::jsonb, takeaways),
           banking_relevance_score = COALESCE($7, banking_relevance_score),
           banking_relevance_level = COALESCE($8, banking_relevance_level),
           relevance_reason = COALESCE($9, relevance_reason),
           study_priority = COALESCE($10, study_priority),
           updated_at = now()
       WHERE id = $1
       RETURNING id, processing_status, study_priority, banking_relevance_score, banking_relevance_level`,
      [
        req.params.id,
        input.examHeadline ?? null,
        input.summary ?? null,
        input.detailedExplanation ?? null,
        input.whyItMatters ?? null,
        input.takeaways !== undefined ? JSON.stringify(input.takeaways) : null,
        input.bankingRelevanceScore ?? null,
        level,
        input.relevanceReason ?? null,
        input.studyPriority ?? null,
      ],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "AI result not found." });
    }

    if (input.removeFactIds?.length) {
      await client.query(
        "DELETE FROM current_affairs_ai_facts WHERE ai_result_id = $1 AND id = ANY($2::uuid[])",
        [req.params.id, input.removeFactIds],
      );
    }

    if (input.examTags !== undefined) {
      const normalized = normalizeExamTags(input.examTags);
      await client.query("DELETE FROM current_affairs_ai_exam_tags WHERE ai_result_id = $1", [
        req.params.id,
      ]);
      for (const tag of normalized) {
        await client.query(
          `INSERT INTO current_affairs_ai_exam_tags (ai_result_id, exam_code, relevance_reason)
           VALUES ($1, $2, $3)`,
          [req.params.id, tag.examCode, tag.relevanceReason],
        );
      }
    }

    await client.query(
      `INSERT INTO current_affairs_ai_reviews (ai_result_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'edited', $3)`,
      [req.params.id, req.session.userId, input.adminFeedback],
    );
    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.ai.edit", "current_affairs_ai_result", req.params.id, {
      removedFacts: input.removeFactIds?.length ?? 0,
    }, req.ip);

    res.json({ success: true, result: updated.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 8. Approve AI Result (makes it eligible for student display on published articles)
currentAffairsAiAdminRouter.post("/results/:id/approve", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });
  const { adminFeedback } = z
    .object({ adminFeedback: z.string().trim().max(1000).default("") })
    .parse(req.body ?? {});

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await client.query(
      `UPDATE current_affairs_ai_results
       SET processing_status = 'approved', updated_at = now()
       WHERE id = $1 AND processing_status IN ('completed', 'review_required', 'approved')
       RETURNING id, current_affairs_id, study_priority`,
      [req.params.id],
    );
    if (!row.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Only completed or review-required AI results can be approved.",
      });
    }

    const examRows = await client.query(
      "SELECT exam_code FROM current_affairs_ai_exam_tags WHERE ai_result_id = $1",
      [req.params.id],
    );
    const examCodes = examRows.rows.map((e) => e.exam_code);

    // Sync editorial priority & target_exams onto parent article without changing its publication status
    await client.query(
      `UPDATE current_affairs
       SET priority_level = $2,
           target_exams = CASE WHEN jsonb_array_length($3::jsonb) > 0 THEN $3::jsonb ELSE target_exams END,
           updated_at = now()
       WHERE id = $1`,
      [row.rows[0].current_affairs_id, row.rows[0].study_priority, JSON.stringify(examCodes)],
    );

    await client.query(
      `INSERT INTO current_affairs_ai_reviews (ai_result_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'approved', $3)`,
      [req.params.id, req.session.userId, adminFeedback],
    );
    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.ai.approve", "current_affairs_ai_result", req.params.id, {
      articleId: row.rows[0].current_affairs_id,
    }, req.ip);

    res.json({ success: true, status: "approved", id: req.params.id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 9. Reject AI Result
currentAffairsAiAdminRouter.post("/results/:id/reject", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });
  const { adminFeedback } = z
    .object({ adminFeedback: z.string().trim().min(3).max(1000) })
    .parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await client.query(
      `UPDATE current_affairs_ai_results
       SET processing_status = 'rejected', updated_at = now()
       WHERE id = $1
       RETURNING id, current_affairs_id`,
      [req.params.id],
    );
    if (!row.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "AI result not found." });
    }
    await client.query(
      `INSERT INTO current_affairs_ai_reviews (ai_result_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'rejected', $3)`,
      [req.params.id, req.session.userId, adminFeedback],
    );
    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.ai.reject", "current_affairs_ai_result", req.params.id, {
      articleId: row.rows[0].current_affairs_id,
    }, req.ip);

    res.json({ success: true, status: "rejected", id: req.params.id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 10. Processing History for an Article
currentAffairsAiAdminRouter.get("/results/:id/history", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid AI result ID." });
  const target = await pool.query(
    "SELECT current_affairs_id FROM current_affairs_ai_results WHERE id = $1",
    [req.params.id],
  );
  if (!target.rowCount) return res.status(404).json({ error: "AI result not found." });

  const history = await pool.query(
    `SELECT id, provider, model, prompt_version, processing_status,
            banking_relevance_score, banking_relevance_level, study_priority,
            validation_status, usage_meta, error_message, created_at, updated_at
     FROM current_affairs_ai_results
     WHERE current_affairs_id = $1
     ORDER BY created_at DESC
     LIMIT 25`,
    [target.rows[0].current_affairs_id],
  );
  res.json({ success: true, history: history.rows });
});
