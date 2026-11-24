import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { computeFreshness } from "../services/bankingFreshness.js";
import {
  EXAM_PROFILES,
  getExamProfile,
  mapDifficultyToCanonical,
  normalizeExamCodesList,
} from "../services/caExamMapper.js";
import { QUESTION_FORMATS, SUPPORTED_QUESTION_TYPES } from "../services/caQuestionTemplates.js";
import { generateExamMcqs } from "../services/caQuestionGenerator.js";
import { validateGeneratedQuestion } from "../services/caQuestionValidator.js";
import { detectDuplicateQuestion } from "../services/caDuplicateDetector.js";
import { scoreQuestionQuality } from "../services/caQuestionQuality.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const currentAffairsQuestionsAdminRouter = Router();
currentAffairsQuestionsAdminRouter.use(requireAdmin);

const mcqGenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "MCQ generation rate limit reached. Try again in a minute." },
});

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

const REF_TABLES = {
  rates: "banking_policy_rates",
  limits: "banking_limits",
  institutions: "banking_institutions",
  regulatory_bodies: "banking_regulatory_bodies",
  leaders: "banking_leaders",
  static_gk: "banking_static_gk",
  terminology: "banking_terminology",
};

async function loadSourceMaterial({ sourceType, sourceArticleId, sourceReferenceType, sourceReferenceId }) {
  if (sourceType === "current_affairs") {
    if (!isValidUuid(sourceArticleId)) {
      throw Object.assign(new Error("Valid sourceArticleId UUID is required."), { status: 400 });
    }
    const artRes = await pool.query(
      `SELECT ca.*, cat.name AS category
       FROM current_affairs ca
       JOIN current_affairs_categories cat ON cat.id = ca.category_id
       WHERE ca.id = $1`,
      [sourceArticleId],
    );
    if (!artRes.rowCount) {
      throw Object.assign(new Error("Source article not found."), { status: 404 });
    }
    const article = artRes.rows[0];
    // Prefer approved Phase 5 AI result when available
    const aiRes = await pool.query(
      `SELECT * FROM current_affairs_ai_results
       WHERE current_affairs_id = $1 AND processing_status = 'approved'
       ORDER BY updated_at DESC LIMIT 1`,
      [sourceArticleId],
    );
    const ai = aiRes.rows[0] || null;
    const sourceText = [
      article.body,
      ai?.summary ? `Approved Summary: ${ai.summary}` : "",
      ai?.detailed_explanation ? `Approved Explanation: ${ai.detailed_explanation}` : "",
      article.static_gk ? `Static GK: ${article.static_gk}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      sourceTitle: ai?.exam_headline || article.title,
      sourceText,
      sourceReferenceLabel: `${article.source_name || article.category} (${article.published_at ? String(article.published_at).slice(0, 10) : "undated"})`,
      sourceArticleId: article.id,
      sourceAiResultId: ai?.id || null,
      sourceReferenceType: "",
      sourceReferenceId: null,
      sourceFreshness: null,
      defaultTopic: article.category || "Current Affairs",
    };
  }

  // Phase 4 Banking Awareness Reference Hub source (published/approved only)
  const tableName = REF_TABLES[sourceReferenceType];
  if (!tableName || !isValidUuid(sourceReferenceId)) {
    throw Object.assign(new Error("Valid sourceReferenceType and sourceReferenceId are required."), {
      status: 400,
    });
  }
  const refRes = await pool.query(
    `SELECT * FROM ${tableName} WHERE id = $1 AND status IN ('approved', 'published')`,
    [sourceReferenceId],
  );
  if (!refRes.rowCount) {
    throw Object.assign(
      new Error("Approved/published Banking Reference record not found."),
      { status: 404 },
    );
  }
  const rec = refRes.rows[0];
  const freshness = computeFreshness(rec, sourceReferenceType);
  const title =
    rec.rate_name ||
    rec.title ||
    rec.institution_name ||
    rec.organization_name ||
    rec.person_name ||
    rec.term ||
    "Banking Reference";

  const lines = Object.entries(rec)
    .filter(([k, v]) => v !== null && v !== "" && !["id", "created_by", "updated_by", "created_at", "updated_at"].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);

  return {
    sourceTitle: title,
    sourceText: lines.join("\n"),
    sourceReferenceLabel: `${rec.source_name || "Banking Reference Hub"} (Effective: ${rec.effective_date || rec.effective_from || rec.appointment_date || "N/A"})`,
    sourceArticleId: null,
    sourceAiResultId: null,
    sourceReferenceType,
    sourceReferenceId: rec.id,
    sourceFreshness: freshness,
    defaultTopic: rec.topic || rec.category || "Banking Awareness",
  };
}

async function saveGeneratedBatch({
  sourceMeta,
  genOut,
  examCode,
  topic,
  requestedCount,
  batchName,
  actorId,
  parentQuestionId = null,
  versionNumber = 1,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const acceptedCount = genOut.questions.filter((q) => q.validation.overallStatus !== "failed").length;
    const rejectedCount = genOut.questions.length - acceptedCount;

    const batchRow = await client.query(
      `INSERT INTO current_affairs_question_batches
         (batch_name, source_type, exam_code, topic, difficulty_distribution,
          requested_question_count, generated_question_count, accepted_question_count,
          rejected_question_count, processing_status, provider, model, prompt_version,
          usage_meta, created_by, completed_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,'completed',$10,$11,$12,$13::jsonb,$14,now())
       RETURNING *`,
      [
        batchName || `${examCode} — ${sourceMeta.sourceTitle.slice(0, 80)}`,
        sourceMeta.sourceArticleId ? "current_affairs" : "banking_reference",
        examCode,
        topic || sourceMeta.defaultTopic,
        JSON.stringify(genOut.examProfile.difficultyDistribution),
        requestedCount,
        genOut.questions.length,
        acceptedCount,
        rejectedCount,
        genOut.provider,
        genOut.model,
        genOut.promptVersion,
        JSON.stringify(genOut.usage || {}),
        actorId,
      ],
    );
    const batch = batchRow.rows[0];
    const savedQuestions = [];

    for (const q of genOut.questions) {
      const qRow = await client.query(
        `INSERT INTO current_affairs_generated_questions
           (batch_id, source_article_id, source_ai_result_id, source_reference_type, source_reference_id,
            exam_codes, topic, subtopic, question_text, question_type, difficulty, difficulty_reason,
            options, correct_answer, explanation, source_reference, content_hash,
            quality_score, quality_status, validation_status, duplicate_status, duplicate_of_id,
            review_status, version_number, parent_question_id, created_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,$21,$22,'draft',$23,$24,$25,now())
         RETURNING *`,
        [
          batch.id,
          sourceMeta.sourceArticleId,
          sourceMeta.sourceAiResultId,
          sourceMeta.sourceReferenceType,
          sourceMeta.sourceReferenceId,
          JSON.stringify(q.examCodes),
          q.topic,
          q.subtopic,
          q.questionText,
          q.questionType,
          q.difficulty,
          q.difficultyReason,
          JSON.stringify(q.options),
          q.correctAnswer,
          q.explanation,
          q.sourceReference,
          q.contentHash,
          q.quality.qualityScore,
          q.quality.qualityStatus,
          q.validation.overallStatus,
          q.duplicate.status,
          q.duplicate.matchedId,
          versionNumber,
          parentQuestionId,
          actorId,
        ],
      );
      const savedQ = qRow.rows[0];

      for (let i = 0; i < q.options.length; i += 1) {
        const opt = q.options[i];
        await client.query(
          `INSERT INTO current_affairs_question_options
             (question_id, option_label, option_text, is_correct, sort_order)
           VALUES ($1,$2,$3,$4,$5)`,
          [savedQ.id, opt.key, opt.text, opt.key === q.correctAnswer, i],
        );
      }

      await client.query(
        `INSERT INTO current_affairs_question_validation
           (question_id, structural_status, answer_validation_status, source_validation_status,
            ambiguity_status, duplicate_status, quality_score, quality_breakdown,
            validation_errors, validation_warnings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)`,
        [
          savedQ.id,
          q.validation.structuralStatus,
          q.validation.answerValidationStatus,
          q.validation.sourceValidationStatus,
          q.validation.ambiguityStatus,
          q.duplicate.status,
          q.quality.qualityScore,
          JSON.stringify(q.quality.breakdown),
          JSON.stringify(q.validation.errors),
          JSON.stringify(q.validation.warnings),
        ],
      );

      savedQuestions.push(savedQ);
    }

    await client.query("COMMIT");
    return { batch, questions: savedQuestions };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// 1. METADATA, STATISTICS & BATCHES (Registered BEFORE /:id)
// ============================================================================

currentAffairsQuestionsAdminRouter.get("/statistics", async (_req, res) => {
  const [batchesRes, qRes] = await Promise.all([
    pool.query("SELECT count(*)::int AS total_batches FROM current_affairs_question_batches"),
    pool.query(`
      SELECT
        count(*)::int AS total_generated,
        count(*) FILTER (WHERE review_status = 'draft')::int AS awaiting_review,
        count(*) FILTER (WHERE review_status = 'approved')::int AS approved,
        count(*) FILTER (WHERE review_status = 'rejected')::int AS rejected,
        count(*) FILTER (WHERE validation_status = 'failed')::int AS validation_failed,
        count(*) FILTER (WHERE duplicate_status <> 'unique')::int AS duplicates,
        coalesce(round(avg(quality_score)), 0)::int AS avg_quality_score
      FROM current_affairs_generated_questions
    `),
  ]);
  const q = qRes.rows[0] || {};
  res.json({
    success: true,
    profiles: Object.values(EXAM_PROFILES),
    formats: Object.values(QUESTION_FORMATS),
    stats: {
      totalBatches: batchesRes.rows[0]?.total_batches ?? 0,
      totalGenerated: q.total_generated ?? 0,
      awaitingReview: q.awaiting_review ?? 0,
      approved: q.approved ?? 0,
      rejected: q.rejected ?? 0,
      validationFailed: q.validation_failed ?? 0,
      duplicates: q.duplicates ?? 0,
      avgQualityScore: q.avg_quality_score ?? 0,
    },
  });
});

currentAffairsQuestionsAdminRouter.get("/batches", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const [cnt, rows] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM current_affairs_question_batches"),
    pool.query(
      "SELECT * FROM current_affairs_question_batches ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
  ]);
  res.json({
    success: true,
    items: rows.rows,
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

currentAffairsQuestionsAdminRouter.get("/batches/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid batch ID." });
  const [b, qs] = await Promise.all([
    pool.query("SELECT * FROM current_affairs_question_batches WHERE id = $1", [req.params.id]),
    pool.query(
      "SELECT * FROM current_affairs_generated_questions WHERE batch_id = $1 ORDER BY created_at ASC",
      [req.params.id],
    ),
  ]);
  if (!b.rowCount) return res.status(404).json({ error: "Batch not found." });
  res.json({ success: true, batch: b.rows[0], questions: qs.rows });
});

// ============================================================================
// 2. GENERATION & DUPLICATE CHECKING
// ============================================================================

const generateSchema = z.object({
  sourceType: z.enum(["current_affairs", "banking_reference"]).default("current_affairs"),
  sourceArticleId: z.string().uuid().optional(),
  sourceReferenceType: z.string().trim().optional(),
  sourceReferenceId: z.string().uuid().optional(),
  examCode: z.string().trim().default("IBPS PO"),
  examCodes: z.array(z.string().trim()).optional(),
  topic: z.string().trim().max(120).optional(),
  subtopic: z.string().trim().max(120).optional(),
  questionType: z.enum(SUPPORTED_QUESTION_TYPES).default("direct_factual"),
  difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
  count: z.coerce.number().int().min(1).max(10).default(3),
  batchName: z.string().trim().max(160).optional(),
});

currentAffairsQuestionsAdminRouter.post("/generate", mcqGenLimiter, async (req, res) => {
  const input = generateSchema.parse(req.body);
  const sourceMeta = await loadSourceMaterial(input);
  const existing = await pool.query(
    "SELECT id, question_text, content_hash, options, correct_answer, source_reference FROM current_affairs_generated_questions ORDER BY created_at DESC LIMIT 500",
  );

  const genOut = await generateExamMcqs({
    sourceTitle: sourceMeta.sourceTitle,
    sourceText: sourceMeta.sourceText,
    sourceReferenceLabel: sourceMeta.sourceReferenceLabel,
    sourceFreshness: sourceMeta.sourceFreshness,
    examCode: input.examCode,
    examCodes: input.examCodes || [],
    topic: input.topic || sourceMeta.defaultTopic,
    subtopic: input.subtopic || "",
    questionType: input.questionType,
    difficulty: input.difficulty,
    count: input.count,
    existingQuestions: existing.rows,
  });

  const saved = await saveGeneratedBatch({
    sourceMeta,
    genOut,
    examCode: genOut.examProfile.examCode,
    topic: input.topic || sourceMeta.defaultTopic,
    requestedCount: input.count,
    batchName: input.batchName,
    actorId: req.session.userId,
  });

  await audit(
    req.session.userId,
    "current_affairs.mcq.generate",
    "current_affairs_question_batch",
    saved.batch.id,
    { examCode: genOut.examProfile.examCode, generated: saved.questions.length },
    req.ip,
  );

  res.status(201).json({ success: true, ...saved });
});

currentAffairsQuestionsAdminRouter.post("/generate-bulk", mcqGenLimiter, async (req, res) => {
  const input = z
    .object({
      articleIds: z.array(z.string().uuid()).min(1).max(10),
      examCode: z.string().trim().default("IBPS PO"),
      questionType: z.enum(SUPPORTED_QUESTION_TYPES).default("direct_factual"),
      difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
      countPerArticle: z.coerce.number().int().min(1).max(5).default(2),
    })
    .parse(req.body);

  const uniqueIds = [...new Set(input.articleIds)];
  const existing = await pool.query(
    "SELECT id, question_text, content_hash, options, correct_answer, source_reference FROM current_affairs_generated_questions ORDER BY created_at DESC LIMIT 500",
  );
  const outcomes = [];

  for (let i = 0; i < uniqueIds.length; i += 2) {
    const chunk = uniqueIds.slice(i, i + 2);
    const settled = await Promise.all(
      chunk.map(async (articleId) => {
        try {
          const sourceMeta = await loadSourceMaterial({
            sourceType: "current_affairs",
            sourceArticleId: articleId,
          });
          const genOut = await generateExamMcqs({
            sourceTitle: sourceMeta.sourceTitle,
            sourceText: sourceMeta.sourceText,
            sourceReferenceLabel: sourceMeta.sourceReferenceLabel,
            examCode: input.examCode,
            topic: sourceMeta.defaultTopic,
            questionType: input.questionType,
            difficulty: input.difficulty,
            count: input.countPerArticle,
            existingQuestions: existing.rows,
          });
          const saved = await saveGeneratedBatch({
            sourceMeta,
            genOut,
            examCode: genOut.examProfile.examCode,
            topic: sourceMeta.defaultTopic,
            requestedCount: input.countPerArticle,
            actorId: req.session.userId,
          });
          return { articleId, ok: true, batchId: saved.batch.id, generated: saved.questions.length };
        } catch (err) {
          return { articleId, ok: false, error: err.message || "Generation failed." };
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

currentAffairsQuestionsAdminRouter.post("/check-duplicates", async (req, res) => {
  const input = z
    .object({
      questionText: z.string().trim().min(5),
      correctAnswer: z.string().trim().default("A"),
      options: z.array(z.object({ key: z.string(), text: z.string() })).default([]),
      sourceReference: z.string().trim().default(""),
    })
    .parse(req.body);

  const existing = await pool.query(
    "SELECT id, question_text, content_hash, options, correct_answer, source_reference FROM current_affairs_generated_questions ORDER BY created_at DESC LIMIT 800",
  );
  const result = detectDuplicateQuestion(input, existing.rows);
  res.json({ success: true, duplicate: result });
});

// ============================================================================
// 3. QUESTION REVIEW, EDIT, VALIDATE, REGENERATE, APPROVE (CANONICAL SYNC) & REJECT
// ============================================================================

currentAffairsQuestionsAdminRouter.get("/", async (req, res) => {
  const q = z
    .object({
      reviewStatus: z.string().trim().optional(),
      validationStatus: z.string().trim().optional(),
      duplicateStatus: z.string().trim().optional(),
      examCode: z.string().trim().optional(),
      difficulty: z.string().trim().optional(),
      questionType: z.string().trim().optional(),
      search: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(req.query);

  const reviewFilter = q.reviewStatus && q.reviewStatus !== "all" ? q.reviewStatus : null;
  const valFilter = q.validationStatus && q.validationStatus !== "all" ? q.validationStatus : null;
  const dupFilter = q.duplicateStatus && q.duplicateStatus !== "all" ? q.duplicateStatus : null;
  const diffFilter = q.difficulty && q.difficulty !== "all" ? q.difficulty : null;
  const typeFilter = q.questionType && q.questionType !== "all" ? q.questionType : null;
  const examJson = q.examCode && q.examCode !== "all" ? JSON.stringify([q.examCode]) : null;
  const searchPattern = q.search ? `%${q.search.replace(/[%_]/g, "\\$&")}%` : null;
  const offset = (q.page - 1) * q.limit;

  const params = [reviewFilter, valFilter, dupFilter, diffFilter, typeFilter, examJson, searchPattern];
  const where = `
    WHERE ($1::text IS NULL OR gq.review_status = $1)
      AND ($2::text IS NULL OR gq.validation_status = $2)
      AND ($3::text IS NULL OR gq.duplicate_status = $3)
      AND ($4::text IS NULL OR gq.difficulty = $4)
      AND ($5::text IS NULL OR gq.question_type = $5)
      AND ($6::jsonb IS NULL OR gq.exam_codes @> $6::jsonb)
      AND ($7::text IS NULL OR gq.question_text ILIKE $7 ESCAPE '\\' OR gq.topic ILIKE $7 ESCAPE '\\')
  `;

  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM current_affairs_generated_questions gq ${where}`, params),
    pool.query(
      `SELECT gq.*, ca.title AS source_article_title
       FROM current_affairs_generated_questions gq
       LEFT JOIN current_affairs ca ON ca.id = gq.source_article_id
       ${where}
       ORDER BY gq.updated_at DESC
       LIMIT $8 OFFSET $9`,
      [...params, q.limit, offset],
    ),
  ]);

  res.json({
    success: true,
    items: rows.rows,
    pagination: buildPaginationMeta({ page: q.page, limit: q.limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

currentAffairsQuestionsAdminRouter.get("/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const [qRow, opts, val, revs] = await Promise.all([
    pool.query(
      `SELECT gq.*, ca.title AS source_article_title, ca.body AS source_article_body, ca.source_url
       FROM current_affairs_generated_questions gq
       LEFT JOIN current_affairs ca ON ca.id = gq.source_article_id
       WHERE gq.id = $1`,
      [req.params.id],
    ),
    pool.query("SELECT * FROM current_affairs_question_options WHERE question_id = $1 ORDER BY sort_order", [req.params.id]),
    pool.query("SELECT * FROM current_affairs_question_validation WHERE question_id = $1 ORDER BY validated_at DESC LIMIT 1", [req.params.id]),
    pool.query(
      `SELECT r.*, u.full_name AS reviewer_name
       FROM current_affairs_question_reviews r
       LEFT JOIN users u ON u.id = r.reviewed_by
       WHERE r.question_id = $1 ORDER BY r.reviewed_at DESC`,
      [req.params.id],
    ),
  ]);
  if (!qRow.rowCount) return res.status(404).json({ error: "Generated question not found." });
  res.json({
    success: true,
    question: {
      ...qRow.rows[0],
      optionRows: opts.rows,
      latestValidation: val.rows[0] || null,
      reviews: revs.rows,
    },
  });
});

currentAffairsQuestionsAdminRouter.put("/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const input = z
    .object({
      questionText: z.string().trim().min(12).max(5000),
      options: z
        .array(z.object({ key: z.string().trim().toUpperCase().regex(/^[A-E]$/), text: z.string().trim().min(1).max(1000) }))
        .min(4)
        .max(5),
      correctAnswer: z.string().trim().toUpperCase().regex(/^[A-E]$/),
      explanation: z.string().trim().max(5000).default(""),
      difficulty: z.enum(["easy", "moderate", "difficult"]),
      topic: z.string().trim().min(2).max(120),
      examCodes: z.array(z.string().trim()).min(1),
      sourceReference: z.string().trim().max(400).default(""),
    })
    .parse(req.body);

  const existing = await pool.query(
    `SELECT gq.*, ca.body AS article_body, ca.title AS article_title
     FROM current_affairs_generated_questions gq
     LEFT JOIN current_affairs ca ON ca.id = gq.source_article_id
     WHERE gq.id = $1`,
    [req.params.id],
  );
  if (!existing.rowCount) return res.status(404).json({ error: "Generated question not found." });
  const cur = existing.rows[0];

  const normalizedExams = normalizeExamCodesList(input.examCodes);
  const candidate = {
    questionText: input.questionText,
    questionType: cur.question_type,
    difficulty: input.difficulty,
    options: input.options,
    correctAnswer: input.correctAnswer,
    explanation: input.explanation,
    sourceReference: input.sourceReference,
    examCodes: normalizedExams,
  };

  const validation = validateGeneratedQuestion({
    question: candidate,
    sourceText: cur.article_body ? `${cur.article_title}\n${cur.article_body}` : "",
  });

  const others = await pool.query(
    "SELECT id, question_text, content_hash, options, correct_answer, source_reference FROM current_affairs_generated_questions WHERE id <> $1 LIMIT 500",
    [req.params.id],
  );
  const dup = detectDuplicateQuestion(candidate, others.rows);
  const quality = scoreQuestionQuality({ question: candidate, validation, duplicateResult: dup });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE current_affairs_generated_questions
       SET question_text=$2, options=$3::jsonb, correct_answer=$4, explanation=$5,
           difficulty=$6, topic=$7, exam_codes=$8::jsonb, source_reference=$9,
           content_hash=$10, quality_score=$11, quality_status=$12,
           validation_status=$13, duplicate_status=$14, duplicate_of_id=$15, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        input.questionText,
        JSON.stringify(input.options),
        input.correctAnswer,
        validation.explanation,
        input.difficulty,
        input.topic,
        JSON.stringify(normalizedExams),
        input.sourceReference,
        dup.contentHash,
        quality.qualityScore,
        quality.qualityStatus,
        validation.overallStatus,
        dup.status,
        dup.matchedId,
      ],
    );

    await client.query("DELETE FROM current_affairs_question_options WHERE question_id = $1", [req.params.id]);
    for (let i = 0; i < input.options.length; i += 1) {
      await client.query(
        `INSERT INTO current_affairs_question_options (question_id, option_label, option_text, is_correct, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, input.options[i].key, input.options[i].text, input.options[i].key === input.correctAnswer, i],
      );
    }

    await client.query(
      `INSERT INTO current_affairs_question_validation
         (question_id, structural_status, answer_validation_status, source_validation_status,
          ambiguity_status, duplicate_status, quality_score, quality_breakdown, validation_errors, validation_warnings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)`,
      [
        req.params.id,
        validation.structuralStatus,
        validation.answerValidationStatus,
        validation.sourceValidationStatus,
        validation.ambiguityStatus,
        dup.status,
        quality.qualityScore,
        JSON.stringify(quality.breakdown),
        JSON.stringify(validation.errors),
        JSON.stringify(validation.warnings),
      ],
    );

    await client.query(
      `INSERT INTO current_affairs_question_reviews (question_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'edited', 'Edited by administrator')`,
      [req.params.id, req.session.userId],
    );
    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.mcq.edit", "current_affairs_generated_question", req.params.id, {
      validationStatus: validation.overallStatus,
      qualityScore: quality.qualityScore,
    }, req.ip);

    res.json({ success: true, question: updated.rows[0], validation, duplicate: dup, quality });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

currentAffairsQuestionsAdminRouter.post("/:id/validate", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const row = await pool.query(
    `SELECT gq.*, ca.body AS article_body, ca.title AS article_title
     FROM current_affairs_generated_questions gq
     LEFT JOIN current_affairs ca ON ca.id = gq.source_article_id
     WHERE gq.id = $1`,
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Generated question not found." });
  const q = row.rows[0];
  const candidate = {
    questionText: q.question_text,
    questionType: q.question_type,
    difficulty: q.difficulty,
    options: q.options,
    correctAnswer: q.correct_answer,
    explanation: q.explanation,
    sourceReference: q.source_reference,
    examCodes: q.exam_codes,
  };
  const validation = validateGeneratedQuestion({
    question: candidate,
    sourceText: q.article_body ? `${q.article_title}\n${q.article_body}` : "",
  });
  const others = await pool.query(
    "SELECT id, question_text, content_hash, options, correct_answer, source_reference FROM current_affairs_generated_questions WHERE id <> $1 LIMIT 500",
    [req.params.id],
  );
  const dup = detectDuplicateQuestion(candidate, others.rows);
  const quality = scoreQuestionQuality({ question: candidate, validation, duplicateResult: dup });

  await pool.query(
    `UPDATE current_affairs_generated_questions
     SET validation_status=$2, duplicate_status=$3, duplicate_of_id=$4, quality_score=$5, quality_status=$6, updated_at=now()
     WHERE id=$1`,
    [req.params.id, validation.overallStatus, dup.status, dup.matchedId, quality.qualityScore, quality.qualityStatus],
  );

  res.json({ success: true, validation, duplicate: dup, quality });
});

currentAffairsQuestionsAdminRouter.post("/:id/regenerate", mcqGenLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const existing = await pool.query(
    "SELECT * FROM current_affairs_generated_questions WHERE id = $1",
    [req.params.id],
  );
  if (!existing.rowCount) return res.status(404).json({ error: "Generated question not found." });
  const prev = existing.rows[0];

  const sourceMeta = await loadSourceMaterial({
    sourceType: prev.source_article_id ? "current_affairs" : "banking_reference",
    sourceArticleId: prev.source_article_id,
    sourceReferenceType: prev.source_reference_type,
    sourceReferenceId: prev.source_reference_id,
  });
  const examCode = Array.isArray(prev.exam_codes) && prev.exam_codes[0] ? prev.exam_codes[0] : "IBPS PO";
  const genOut = await generateExamMcqs({
    sourceTitle: sourceMeta.sourceTitle,
    sourceText: sourceMeta.sourceText,
    sourceReferenceLabel: sourceMeta.sourceReferenceLabel,
    sourceFreshness: sourceMeta.sourceFreshness,
    examCode,
    examCodes: prev.exam_codes || [examCode],
    topic: prev.topic,
    questionType: prev.question_type,
    difficulty: prev.difficulty,
    count: 1,
  });

  const saved = await saveGeneratedBatch({
    sourceMeta,
    genOut,
    examCode,
    topic: prev.topic,
    requestedCount: 1,
    batchName: `Regenerate v${(prev.version_number || 1) + 1}`,
    actorId: req.session.userId,
    parentQuestionId: prev.parent_question_id || prev.id,
    versionNumber: (prev.version_number || 1) + 1,
  });

  res.status(201).json({ success: true, ...saved });
});

// Approve & Sync to Canonical HHK Question Bank (questions) + current_affairs_questions (no duplicates)
currentAffairsQuestionsAdminRouter.post("/:id/approve", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const { sectionId, adminFeedback } = z
    .object({
      sectionId: z.string().uuid().optional(),
      adminFeedback: z.string().trim().max(1000).default(""),
    })
    .parse(req.body ?? {});

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await client.query(
      "SELECT * FROM current_affairs_generated_questions WHERE id = $1 FOR UPDATE",
      [req.params.id],
    );
    if (!row.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Generated question not found." });
    }
    const q = row.rows[0];
    if (q.validation_status === "failed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Cannot approve a question that failed mandatory validation. Edit and re-validate it first.",
      });
    }

    // 1. Sync to current_affairs_questions if sourced from a Current Affairs article (once only)
    let caQuestionId = q.ca_question_id;
    if (q.source_article_id && !caQuestionId) {
      const insCa = await client.query(
        `INSERT INTO current_affairs_questions (affair_id, question_text, options, correct_answer, explanation)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id`,
        [q.source_article_id, q.question_text, JSON.stringify(q.options), q.correct_answer, q.explanation],
      );
      caQuestionId = insCa.rows[0].id;
    }

    // 2. Sync to canonical HHK `questions` table (resolve provided sectionId or first General Awareness section)
    let canonicalQuestionId = q.canonical_question_id;
    if (!canonicalQuestionId) {
      let targetSectionId = sectionId || null;
      if (!targetSectionId) {
        const gaSec = await client.query(
          `SELECT id FROM exam_sections
           WHERE lower(name) LIKE '%general%' OR lower(name) LIKE '%awareness%' OR lower(name) LIKE '%banking%'
           ORDER BY sort_order ASC LIMIT 1`,
        );
        targetSectionId = gaSec.rows[0]?.id || null;
      }
      if (targetSectionId) {
        const canonicalDiff = mapDifficultyToCanonical(q.difficulty);
        const insCanon = await client.query(
          `INSERT INTO questions
             (section_id, topic_name, difficulty, question_type, language, question_text,
              options, correct_answer, explanation, marks, negative_marks, source, status, created_by, content_hash)
           VALUES ($1,$2,$3,'mcq','English',$4,$5::jsonb,$6,$7,1,0.25,$8,'published',$9,$10)
           ON CONFLICT (section_id, content_hash) WHERE content_hash <> ''
           DO UPDATE SET updated_at = now()
           RETURNING id`,
          [
            targetSectionId,
            q.topic || "General Awareness",
            canonicalDiff,
            q.question_text,
            JSON.stringify(q.options),
            q.correct_answer,
            q.explanation,
            q.source_reference || "HHK Current Affairs",
            req.session.userId,
            q.content_hash,
          ],
        );
        canonicalQuestionId = insCanon.rows[0]?.id || null;
      }
    }

    await client.query(
      `UPDATE current_affairs_generated_questions
       SET review_status = 'approved',
           ca_question_id = $2,
           canonical_question_id = $3,
           updated_at = now()
       WHERE id = $1`,
      [req.params.id, caQuestionId, canonicalQuestionId],
    );

    await client.query(
      `INSERT INTO current_affairs_question_reviews (question_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'approved', $3)`,
      [req.params.id, req.session.userId, adminFeedback],
    );

    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.mcq.approve", "current_affairs_generated_question", req.params.id, {
      caQuestionId,
      canonicalQuestionId,
    }, req.ip);

    res.json({
      success: true,
      reviewStatus: "approved",
      caQuestionId,
      canonicalQuestionId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

currentAffairsQuestionsAdminRouter.post("/:id/reject", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const { adminFeedback } = z.object({ adminFeedback: z.string().trim().min(3).max(1000) }).parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await client.query(
      "UPDATE current_affairs_generated_questions SET review_status = 'rejected', updated_at = now() WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (!row.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Generated question not found." });
    }
    await client.query(
      `INSERT INTO current_affairs_question_reviews (question_id, reviewed_by, review_status, admin_feedback)
       VALUES ($1, $2, 'rejected', $3)`,
      [req.params.id, req.session.userId, adminFeedback],
    );
    await client.query("COMMIT");

    await audit(req.session.userId, "current_affairs.mcq.reject", "current_affairs_generated_question", req.params.id, {}, req.ip);
    res.json({ success: true, reviewStatus: "rejected", id: req.params.id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

currentAffairsQuestionsAdminRouter.get("/:id/history", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const cur = await pool.query(
    "SELECT id, parent_question_id FROM current_affairs_generated_questions WHERE id = $1",
    [req.params.id],
  );
  if (!cur.rowCount) return res.status(404).json({ error: "Generated question not found." });
  const rootId = cur.rows[0].parent_question_id || cur.rows[0].id;

  const [versions, reviews] = await Promise.all([
    pool.query(
      `SELECT id, version_number, review_status, validation_status, quality_score, duplicate_status, created_at, updated_at
       FROM current_affairs_generated_questions
       WHERE id = $1 OR parent_question_id = $1
       ORDER BY version_number DESC`,
      [rootId],
    ),
    pool.query(
      `SELECT r.*, u.full_name AS reviewer_name
       FROM current_affairs_question_reviews r
       LEFT JOIN users u ON u.id = r.reviewed_by
       WHERE r.question_id = $1 ORDER BY r.reviewed_at DESC`,
      [req.params.id],
    ),
  ]);
  res.json({ success: true, versions: versions.rows, reviews: reviews.rows });
});
