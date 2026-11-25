import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid, validateAndNormalizeSourceUrl } from "../services/caUrlSecurity.js";
import {
  analyzeCurrentAffairsBatchWithAi,
  classifyRelevanceTier,
  computeContentHash,
  detectDuplicateItem,
  generateBankingQuestionsWithAi,
  getAiIntegrationStatus,
  PRACTICE_SET_PRESETS,
  QUESTION_FORMATS_14,
  SUPPORTED_BANKING_EXAMS,
  SUPPORTED_QUESTION_FORMATS,
  validateAiQuestionPayload,
} from "../services/caAiEngineService.js";
import {
  generatePracticeSetPdf,
  SUPPORTED_PDF_FORMATS,
} from "../services/caPdfGeneratorService.js";
import { fetchTrustedSourceItems } from "../services/caAutomationService.js";

export const caStudioAdminRouter = Router();
caStudioAdminRouter.use(requireAdmin);

const aiJobLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "AI processing rate limit reached. Please wait a minute." },
});

async function writeAudit(actorId, action, entityType, entityId, details = {}, ip = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId, action, entityType, entityId, JSON.stringify(details), ip],
    );
  } catch {}
}

// ============================================================================
// 1. STUDIO METADATA & AI CONFIGURATION
// ============================================================================
caStudioAdminRouter.get("/meta", async (_req, res) => {
  const [cats, sources, autoCfg] = await Promise.all([
    pool.query("SELECT * FROM ca_categories WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC"),
    pool.query("SELECT * FROM ca_sources ORDER BY created_at DESC"),
    pool.query("SELECT * FROM ca_automation_config WHERE config_key = 'default'"),
  ]);

  res.json({
    success: true,
    aiStatus: getAiIntegrationStatus(),
    supportedExams: SUPPORTED_BANKING_EXAMS,
    questionFormats: Object.values(QUESTION_FORMATS_14),
    practiceSetPresets: Object.values(PRACTICE_SET_PRESETS),
    categories: cats.rows,
    sources: sources.rows,
    automationConfig: autoCfg.rows[0] || null,
  });
});

// ============================================================================
// 2. CONTENT MANAGEMENT (Manual, Bulk Paste, Document Upload, Structured Import)
// ============================================================================
caStudioAdminRouter.get("/batches", async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  const rows = await pool.query(
    `SELECT * FROM ca_daily_batches ORDER BY event_date DESC, created_at DESC LIMIT $1`,
    [limit],
  );
  res.json({ success: true, batches: rows.rows });
});

const createBatchSchema = z.object({
  title: z.string().trim().min(3).max(240),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  submissionMode: z
    .enum(["manual", "bulk_paste", "document_upload", "structured_import", "automated"])
    .default("manual"),
  sourceName: z.string().trim().max(160).default(""),
  sourceUrl: z.string().trim().max(500).default(""),
  categoryIds: z.array(z.string().uuid()).default([]),
  targetExams: z.array(z.string().trim()).default(["IBPS PO", "SBI PO", "IBPS Clerk", "RBI Grade B"]),
  rawContent: z.string().trim().min(30).max(60000),
  fileName: z.string().trim().max(200).default(""),
});

caStudioAdminRouter.post("/batches", async (req, res) => {
  const input = createBatchSchema.parse(req.body ?? {});
  let safeUrl = "";
  if (input.sourceUrl) {
    const check = validateAndNormalizeSourceUrl(input.sourceUrl);
    if (!check.ok) return res.status(400).json({ error: check.error || "Invalid source URL." });
    safeUrl = check.url;
  }
  const eventDate = input.eventDate || new Date().toISOString().slice(0, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchRes = await client.query(
      `INSERT INTO ca_daily_batches
         (title, event_date, submission_mode, source_name, source_url, category_ids, target_exams, raw_content, file_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
       RETURNING *`,
      [
        input.title,
        eventDate,
        input.submissionMode,
        input.sourceName,
        safeUrl,
        JSON.stringify(input.categoryIds),
        JSON.stringify(input.targetExams),
        input.rawContent,
        input.fileName,
        req.session.userId,
      ],
    );
    const batch = batchRes.rows[0];
    const hash = computeContentHash(`${input.title} ${input.rawContent.slice(0, 500)}`);
    await client.query(
      `INSERT INTO ca_articles
         (batch_id, title, content, source_name, source_url, event_date, content_hash, verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        batch.id,
        input.title,
        input.rawContent,
        input.sourceName || "Admin Editorial",
        safeUrl,
        eventDate,
        hash,
        safeUrl || input.sourceName ? "verified" : "unverified_flagged",
      ],
    );
    await client.query("COMMIT");
    await writeAudit(req.session.userId, "ca.batch.create", "ca_daily_batch", batch.id, { mode: input.submissionMode }, req.ip);
    res.status(201).json({ success: true, batch });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

caStudioAdminRouter.delete("/batches/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid batch ID." });
  const del = await pool.query("DELETE FROM ca_daily_batches WHERE id = $1 RETURNING id", [req.params.id]);
  if (!del.rowCount) return res.status(404).json({ error: "Content batch not found." });
  res.json({ success: true, deletedId: req.params.id });
});

// ============================================================================
// 3. AI CONTENT ANALYSIS (Multi-Event Extraction & Relevance Scoring)
// ============================================================================
caStudioAdminRouter.post("/batches/:id/analyze", aiJobLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid batch ID." });
  const batchRes = await pool.query("SELECT * FROM ca_daily_batches WHERE id = $1", [req.params.id]);
  if (!batchRes.rowCount) return res.status(404).json({ error: "Content batch not found." });
  const batch = batchRes.rows[0];

  const jobRes = await pool.query(
    `INSERT INTO ca_ai_processing_jobs (job_type, batch_id, status, input_count, created_by)
     VALUES ('content_analysis', $1, 'running', 1, $2) RETURNING id`,
    [batch.id, req.session.userId],
  );
  const jobId = jobRes.rows[0].id;

  try {
    const [catsRes, existingEventsRes] = await Promise.all([
      pool.query("SELECT id, name FROM ca_categories WHERE is_active = TRUE"),
      pool.query("SELECT id, main_event, content_hash FROM ca_events ORDER BY created_at DESC LIMIT 400"),
    ]);

    const aiOut = await analyzeCurrentAffairsBatchWithAi({
      rawContent: batch.raw_content,
      eventDate: String(batch.event_date).slice(0, 10),
      sourceName: batch.source_name,
      sourceUrl: batch.source_url,
      targetExams: Array.isArray(batch.target_exams) ? batch.target_exams : SUPPORTED_BANKING_EXAMS,
      categories: catsRes.rows,
      existingEvents: existingEventsRes.rows,
    });

    const savedEvents = [];
    let dupCount = 0;
    for (const ev of aiOut.events) {
      if (ev.duplicateStatus !== "unique") dupCount += 1;
      const ins = await pool.query(
        `INSERT INTO ca_events
           (batch_id, event_date, main_event, summary, facts, organizations, numerical_data,
            people, locations, schemes, banking_implications, knowledge_points, category_id,
            target_exams, relevance_score, relevance_tier, duplicate_status, duplicate_of_event_id,
            content_hash, uncertain_flags, source_reference, source_url, ai_provider, ai_model, approval_status)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14::jsonb,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23,$24,'pending')
         RETURNING *`,
        [
          batch.id,
          batch.event_date,
          ev.mainEvent,
          ev.summary,
          JSON.stringify(ev.facts),
          JSON.stringify(ev.organizations),
          JSON.stringify(ev.numericalData),
          JSON.stringify(ev.people),
          JSON.stringify(ev.locations),
          JSON.stringify(ev.schemes),
          ev.bankingImplications,
          JSON.stringify(ev.knowledgePoints),
          ev.categoryId,
          JSON.stringify(ev.targetExams),
          ev.relevanceScore,
          ev.relevanceTier,
          ev.duplicateStatus,
          ev.duplicateOfEventId,
          ev.contentHash,
          JSON.stringify(ev.uncertainFlags),
          ev.sourceReference,
          batch.source_url,
          aiOut.provider,
          aiOut.model,
        ],
      );
      savedEvents.push(ins.rows[0]);
    }

    await Promise.all([
      pool.query(
        `UPDATE ca_daily_batches
         SET processing_status = 'processed', events_extracted = $2, error_message = '', processed_at = now()
         WHERE id = $1`,
        [batch.id, savedEvents.length],
      ),
      pool.query(
        `UPDATE ca_ai_processing_jobs
         SET status = 'completed', provider = $2, model = $3, output_count = $4, duplicate_count = $5, usage_meta = $6::jsonb, completed_at = now()
         WHERE id = $1`,
        [jobId, aiOut.provider, aiOut.model, savedEvents.length, dupCount, JSON.stringify(aiOut.usage || {})],
      ),
    ]);

    res.json({ success: true, jobId, provider: aiOut.provider, model: aiOut.model, events: savedEvents });
  } catch (err) {
    await Promise.all([
      pool.query(
        `UPDATE ca_daily_batches SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
        [batch.id, String(err.message || "AI analysis failed").slice(0, 500)],
      ),
      pool.query(
        `UPDATE ca_ai_processing_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
        [jobId, String(err.message || "AI analysis failed").slice(0, 500)],
      ),
    ]);
    throw err;
  }
});

caStudioAdminRouter.get("/events", async (req, res) => {
  const status = req.query.status && req.query.status !== "all" ? String(req.query.status) : null;
  const rows = await pool.query(
    `SELECT e.*, c.name AS category_name,
            COALESCE(qs.total_q, 0)::int AS generated_question_count,
            COALESCE(qs.approved_q, 0)::int AS approved_question_count,
            COALESCE(qs.pending_q, 0)::int AS pending_question_count
     FROM ca_events e
     LEFT JOIN ca_categories c ON c.id = e.category_id
     LEFT JOIN (
       SELECT event_id,
              count(*)::int AS total_q,
              count(*) FILTER (WHERE review_status = 'approved')::int AS approved_q,
              count(*) FILTER (WHERE review_status = 'pending')::int AS pending_q
       FROM ca_generated_questions
       WHERE event_id IS NOT NULL
       GROUP BY event_id
     ) qs ON qs.event_id = e.id
     WHERE ($1::text IS NULL OR e.approval_status = $1)
     ORDER BY e.created_at DESC, e.event_date DESC, COALESCE(e.admin_override_score, e.relevance_score) DESC
     LIMIT 120`,
    [status],
  );
  res.json({ success: true, events: rows.rows });
});

caStudioAdminRouter.patch("/events/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
  const input = z
    .object({
      approvalStatus: z.enum(["pending", "approved", "rejected", "archived"]).optional(),
      adminOverrideScore: z.coerce.number().int().min(0).max(100).optional(),
      categoryId: z.string().uuid().optional(),
      mainEvent: z.string().trim().min(5).max(400).optional(),
      summary: z.string().trim().max(4000).optional(),
    })
    .parse(req.body ?? {});

  const overrideTier =
    input.adminOverrideScore !== undefined ? classifyRelevanceTier(input.adminOverrideScore).tier : null;

  const upd = await pool.query(
    `UPDATE ca_events
     SET approval_status = COALESCE($2, approval_status),
         admin_override_score = COALESCE($3, admin_override_score),
         admin_override_tier = COALESCE($4, admin_override_tier),
         category_id = COALESCE($5, category_id),
         main_event = COALESCE($6, main_event),
         summary = COALESCE($7, summary),
         reviewed_by = $8,
         reviewed_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      input.approvalStatus ?? null,
      input.adminOverrideScore ?? null,
      overrideTier,
      input.categoryId ?? null,
      input.mainEvent ?? null,
      input.summary ?? null,
      req.session.userId,
    ],
  );
  if (!upd.rowCount) return res.status(404).json({ error: "Event not found." });
  res.json({ success: true, event: upd.rows[0] });
});

// ============================================================================
// 4. AI QUESTION GENERATION & EDITORIAL REVIEW (14 Banking Formats)
// ============================================================================
async function insertQuestionWithOptions(client, qData, meta) {
  const qRes = await client.query(
    `INSERT INTO ca_generated_questions
       (event_id, job_id, question_text, question_type, correct_answer, detailed_explanation,
        why_correct, why_others_incorrect, important_facts, source_reference, ca_date,
        category_id, exam_relevance, difficulty, content_hash, duplicate_status,
        duplicate_of_question_id, uncertain_flag, validation_errors, review_status,
        ai_provider, ai_model, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22,$23)
     RETURNING *`,
    [
      meta.eventId || null,
      meta.jobId || null,
      qData.questionText,
      qData.questionType,
      qData.correctAnswer,
      qData.detailedExplanation,
      qData.whyCorrect || "",
      JSON.stringify(qData.whyOthersIncorrect || {}),
      JSON.stringify(qData.importantFacts || []),
      qData.sourceReference || "",
      meta.caDate || new Date().toISOString().slice(0, 10),
      meta.categoryId || null,
      JSON.stringify(qData.examRelevance || []),
      qData.difficulty || "moderate",
      qData.contentHash || computeContentHash(qData.questionText),
      qData.duplicateStatus || "unique",
      qData.duplicateOfQuestionId || null,
      Boolean(qData.uncertainFlag),
      JSON.stringify(qData.validationErrors || []),
      meta.reviewStatus || "pending",
      meta.aiProvider || "",
      meta.aiModel || "",
      meta.actorId || null,
    ],
  );
  const saved = qRes.rows[0];
  for (let i = 0; i < (qData.options || []).length; i += 1) {
    const opt = qData.options[i];
    await client.query(
      `INSERT INTO ca_question_options (question_id, option_label, option_text, is_correct, sort_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [saved.id, opt.option_label, opt.option_text, opt.option_label === qData.correctAnswer, i],
    );
  }
  return { ...saved, options: qData.options };
}

caStudioAdminRouter.post("/events/:id/generate-questions", aiJobLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
  const input = z
    .object({
      questionFormats: z.array(z.enum(SUPPORTED_QUESTION_FORMATS)).min(1).default(["mcq", "multiple_statement"]),
      difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
      count: z.coerce.number().int().min(1).max(10).default(3),
      targetExams: z.array(z.string()).default(["IBPS PO", "SBI PO", "RBI Grade B"]),
      forceRegenerate: z.boolean().default(false),
    })
    .parse(req.body ?? {});

  const evRes = await pool.query("SELECT * FROM ca_events WHERE id = $1", [req.params.id]);
  if (!evRes.rowCount) return res.status(404).json({ error: "Current Affairs event not found." });
  const event = evRes.rows[0];

  // Prevent accidental duplicate generation on a topic that already has questions
  if (!input.forceRegenerate) {
    const existingForEvent = await pool.query(
      "SELECT count(*)::int AS cnt FROM ca_generated_questions WHERE event_id = $1",
      [event.id],
    );
    if ((existingForEvent.rows[0]?.cnt || 0) > 0) {
      return res.status(409).json({
        error: `${existingForEvent.rows[0].cnt} question(s) already exist for this topic. View them in Question Review instead.`,
      });
    }
  }

  const jobRes = await pool.query(
    `INSERT INTO ca_ai_processing_jobs (job_type, event_id, status, input_count, created_by)
     VALUES ('question_generation', $1, 'running', $2, $3) RETURNING id`,
    [event.id, input.count, req.session.userId],
  );
  const jobId = jobRes.rows[0].id;

  try {
    const existingRes = await pool.query(
      "SELECT id, question_text, content_hash FROM ca_generated_questions ORDER BY created_at DESC LIMIT 600",
    );
    const aiOut = await generateBankingQuestionsWithAi({
      event,
      questionFormats: input.questionFormats,
      difficulty: input.difficulty,
      count: input.count,
      targetExams: input.targetExams,
      existingQuestions: existingRes.rows,
    });

    const client = await pool.connect();
    const savedQuestions = [];
    let dupCount = 0;
    try {
      await client.query("BEGIN");
      for (const q of aiOut.questions) {
        if (q.duplicateStatus === "exact_duplicate" || q.duplicateStatus === "near_duplicate") {
          dupCount += 1;
          continue; // Skip duplicate questions instead of saving duplicates
        }
        const saved = await insertQuestionWithOptions(client, q, {
          eventId: event.id,
          jobId,
          caDate: event.event_date,
          categoryId: event.category_id,
          reviewStatus: "pending",
          aiProvider: aiOut.provider,
          aiModel: aiOut.model,
          actorId: req.session.userId,
        });
        savedQuestions.push(saved);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    await pool.query(
      `UPDATE ca_ai_processing_jobs
       SET status = 'completed', provider = $2, model = $3, output_count = $4, duplicate_count = $5, usage_meta = $6::jsonb, completed_at = now()
       WHERE id = $1`,
      [jobId, aiOut.provider, aiOut.model, savedQuestions.length, dupCount, JSON.stringify(aiOut.usage || {})],
    );

    let autoArchivedDuplicate = false;
    if (savedQuestions.length === 0 && dupCount > 0) {
      await pool.query(
        `UPDATE ca_events
         SET duplicate_status = 'duplicate', approval_status = 'archived', updated_at = now()
         WHERE id = $1`,
        [event.id],
      );
      autoArchivedDuplicate = true;
    }

    res.status(201).json({
      success: true,
      jobId,
      questions: savedQuestions,
      skippedDuplicates: dupCount,
      autoArchivedDuplicate,
    });
  } catch (err) {
    await pool.query(
      `UPDATE ca_ai_processing_jobs SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [jobId, String(err.message || "AI question generation failed").slice(0, 500)],
    );
    throw err;
  }
});

// Direct verified editorial question creation (also supports structured authoring)
const manualQuestionSchema = z.object({
  questionText: z.string().trim().min(15).max(5000),
  questionType: z.enum(SUPPORTED_QUESTION_FORMATS).default("mcq"),
  difficulty: z.enum(["easy", "moderate", "difficult"]).default("moderate"),
  options: z
    .array(z.object({ label: z.string().trim().regex(/^[A-E]$/), text: z.string().trim().min(1).max(1000) }))
    .min(4)
    .max(5),
  correctAnswer: z.string().trim().regex(/^[A-E]$/),
  detailedExplanation: z.string().trim().min(20).max(5000),
  whyCorrect: z.string().trim().max(2000).default(""),
  whyOthersIncorrect: z.record(z.string(), z.string()).default({}),
  importantFacts: z.array(z.string().trim()).default([]),
  sourceReference: z.string().trim().max(400).default(""),
  caDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().uuid().optional(),
  examRelevance: z.array(z.string().trim()).default(["IBPS PO", "SBI PO"]),
  autoApprove: z.boolean().default(false),
});

caStudioAdminRouter.post("/questions/manual", async (req, res) => {
  const input = manualQuestionSchema.parse(req.body ?? {});
  const val = validateAiQuestionPayload({ question: input });
  if (!val.valid) {
    return res.status(400).json({ error: val.errors.join("; ") });
  }
  const existingRes = await pool.query(
    "SELECT id, question_text, content_hash FROM ca_generated_questions ORDER BY created_at DESC LIMIT 500",
  );
  const dup = detectDuplicateItem(val.normalized.questionText, existingRes.rows, 0.75);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saved = await insertQuestionWithOptions(
      client,
      { ...val.normalized, contentHash: dup.contentHash, duplicateStatus: dup.status, duplicateOfQuestionId: dup.matchedId },
      {
        caDate: input.caDate || new Date().toISOString().slice(0, 10),
        categoryId: input.categoryId || null,
        reviewStatus: input.autoApprove ? "approved" : "pending",
        aiProvider: "editorial",
        aiModel: "manual",
        actorId: req.session.userId,
      },
    );
    await client.query("COMMIT");
    res.status(201).json({ success: true, question: saved });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

caStudioAdminRouter.get("/questions", async (req, res) => {
  const reviewStatus = req.query.reviewStatus && req.query.reviewStatus !== "all" ? String(req.query.reviewStatus) : null;
  const difficulty = req.query.difficulty && req.query.difficulty !== "all" ? String(req.query.difficulty) : null;
  const questionType = req.query.questionType && req.query.questionType !== "all" ? String(req.query.questionType) : null;
  const categoryId = req.query.categoryId && isValidUuid(String(req.query.categoryId)) ? String(req.query.categoryId) : null;
  const eventId = req.query.eventId && isValidUuid(String(req.query.eventId)) ? String(req.query.eventId) : null;
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const limit = Math.min(150, Math.max(1, Number(req.query.limit) || 80));

  const rows = await pool.query(
    `SELECT q.*, c.name AS category_name, e.main_event AS event_title,
            COALESCE((
              SELECT jsonb_agg(psq.practice_set_id)
              FROM ca_practice_set_questions psq
              JOIN ca_practice_sets ps ON ps.id = psq.practice_set_id
              WHERE psq.question_id = q.id AND ps.publication_status <> 'archived'
            ), '[]'::jsonb) AS used_in_set_ids,
            COALESCE((
              SELECT jsonb_agg(ps.title)
              FROM ca_practice_set_questions psq
              JOIN ca_practice_sets ps ON ps.id = psq.practice_set_id
              WHERE psq.question_id = q.id AND ps.publication_status <> 'archived'
            ), '[]'::jsonb) AS used_in_set_titles,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text, 'is_correct', o.is_correct
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_generated_questions q
     LEFT JOIN ca_categories c ON c.id = q.category_id
     LEFT JOIN ca_events e ON e.id = q.event_id
     WHERE ($1::text IS NULL OR q.review_status = $1)
       AND ($2::text IS NULL OR q.difficulty = $2)
       AND ($3::text IS NULL OR q.question_type = $3)
       AND ($4::uuid IS NULL OR q.category_id = $4)
       AND ($5::uuid IS NULL OR q.event_id = $5)
       AND ($6::text IS NULL OR q.question_text ILIKE $6 OR q.source_reference ILIKE $6 OR e.main_event ILIKE $6)
     ORDER BY q.created_at DESC, q.ca_date DESC
     LIMIT $7`,
    [reviewStatus, difficulty, questionType, categoryId, eventId, search, limit],
  );
  res.json({ success: true, questions: rows.rows });
});

caStudioAdminRouter.put("/questions/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const input = manualQuestionSchema.omit({ autoApprove: true }).parse(req.body ?? {});
  const val = validateAiQuestionPayload({ question: input });
  if (!val.valid) return res.status(400).json({ error: val.errors.join("; ") });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      `UPDATE ca_generated_questions
       SET question_text = $2, question_type = $3, difficulty = $4, correct_answer = $5,
           detailed_explanation = $6, why_correct = $7, why_others_incorrect = $8::jsonb,
           important_facts = $9::jsonb, source_reference = $10, category_id = COALESCE($11, category_id),
           exam_relevance = $12::jsonb, content_hash = $13, uncertain_flag = FALSE,
           validation_errors = '[]'::jsonb, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        val.normalized.questionText,
        val.normalized.questionType,
        val.normalized.difficulty,
        val.normalized.correctAnswer,
        val.normalized.detailedExplanation,
        val.normalized.whyCorrect,
        JSON.stringify(val.normalized.whyOthersIncorrect),
        JSON.stringify(val.normalized.importantFacts),
        val.normalized.sourceReference,
        input.categoryId || null,
        JSON.stringify(val.normalized.examRelevance),
        computeContentHash(val.normalized.questionText),
      ],
    );
    if (!upd.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Question not found." });
    }
    await client.query("DELETE FROM ca_question_options WHERE question_id = $1", [req.params.id]);
    for (let i = 0; i < val.normalized.options.length; i += 1) {
      const opt = val.normalized.options[i];
      await client.query(
        `INSERT INTO ca_question_options (question_id, option_label, option_text, is_correct, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, opt.option_label, opt.option_text, opt.option_label === val.normalized.correctAnswer, i],
      );
    }
    await client.query(
      `INSERT INTO ca_admin_reviews (question_id, reviewer_id, action, notes) VALUES ($1, $2, 'edited', 'Edited by admin')`,
      [req.params.id, req.session.userId],
    );
    await client.query("COMMIT");
    res.json({ success: true, question: { ...upd.rows[0], options: val.normalized.options } });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

caStudioAdminRouter.post("/questions/:id/review", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const { action, notes } = z
    .object({
      action: z.enum(["approved", "rejected", "archived"]),
      notes: z.string().trim().max(1000).default(""),
    })
    .parse(req.body ?? {});

  const upd = await pool.query(
    `UPDATE ca_generated_questions
     SET review_status = $2,
         uncertain_flag = CASE WHEN $2 = 'approved' THEN FALSE ELSE uncertain_flag END,
         approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
         approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
         updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, action, req.session.userId],
  );
  if (!upd.rowCount) return res.status(404).json({ error: "Question not found." });
  await pool.query(
    `INSERT INTO ca_admin_reviews (question_id, reviewer_id, action, notes) VALUES ($1,$2,$3,$4)`,
    [req.params.id, req.session.userId, action, notes],
  );
  res.json({ success: true, question: upd.rows[0] });
});

caStudioAdminRouter.delete("/questions/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid question ID." });
  const del = await pool.query("DELETE FROM ca_generated_questions WHERE id = $1 RETURNING id", [req.params.id]);
  if (!del.rowCount) return res.status(404).json({ error: "Question not found." });
  res.json({ success: true, deletedId: req.params.id });
});

// ============================================================================
// 5. DAILY / WEEKLY / MONTHLY / CUSTOM PRACTICE SET BUILDER & PUBLISHING
// ============================================================================
caStudioAdminRouter.get("/practice-sets", async (_req, res) => {
  const rows = await pool.query(
    `SELECT ps.*,
            (SELECT count(*)::int FROM ca_student_attempts a WHERE a.practice_set_id = ps.id AND a.status <> 'in_progress') AS attempt_count,
            (SELECT count(*)::int FROM ca_pdf_exports p WHERE p.practice_set_id = ps.id) AS pdf_download_count
     FROM ca_practice_sets ps
     ORDER BY ps.date_to DESC, ps.created_at DESC
     LIMIT 80`,
  );
  res.json({ success: true, practiceSets: rows.rows });
});

const createPracticeSetSchema = z.object({
  title: z.string().trim().min(3).max(200),
  setType: z
    .enum(["daily_quick", "daily_standard", "daily_complete", "daily_advanced", "weekly", "monthly", "custom"])
    .default("daily_standard"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructions: z.string().trim().max(2000).optional(),
  questionCount: z.coerce.number().int().min(1).max(150).default(20),
  durationMinutes: z.coerce.number().int().min(1).max(240).default(15),
  marksPerQuestion: z.coerce.number().min(0.25).max(5).default(1),
  negativeMarking: z.coerce.number().min(0).max(2).default(0.25),
  difficultyDistribution: z
    .object({ easy: z.number().min(0).max(100), moderate: z.number().min(0).max(100), difficult: z.number().min(0).max(100) })
    .default({ easy: 30, moderate: 50, difficult: 20 }),
  categoryIds: z.array(z.string().uuid()).default([]),
  targetExams: z.array(z.string().trim()).default(["IBPS PO", "SBI PO"]),
  questionFormats: z.array(z.enum(SUPPORTED_QUESTION_FORMATS)).default([]),
  accessTier: z.enum(["free", "premium"]).default("free"),
  allowRetry: z.boolean().default(true),
  questionIds: z.array(z.string().uuid()).optional(),
});

caStudioAdminRouter.post("/practice-sets", async (req, res) => {
  const input = createPracticeSetSchema.parse(req.body ?? {});
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let selectedQuestionIds = [];
    if (input.questionIds?.length) {
      const isRevisionMix = input.setType === "weekly" || input.setType === "monthly";
      const validQ = await client.query(
        `SELECT q.id FROM ca_generated_questions q
         WHERE q.id = ANY($1::uuid[])
           AND q.review_status = 'approved'
           AND (
             $2::boolean = TRUE
             OR NOT EXISTS (
               SELECT 1 FROM ca_practice_set_questions psq
               JOIN ca_practice_sets ps ON ps.id = psq.practice_set_id
               WHERE psq.question_id = q.id AND ps.publication_status <> 'archived'
             )
           )`,
        [input.questionIds, isRevisionMix],
      );
      selectedQuestionIds = validQ.rows.map((r) => r.id);
      if (!selectedQuestionIds.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Selected question(s) are already used in another active practice set.",
        });
      }
    } else {
      const qRows = await client.query(
        `SELECT q.id, q.difficulty
         FROM ca_generated_questions q
         WHERE q.review_status = 'approved'
           AND q.ca_date >= $1::date AND q.ca_date <= $2::date
           AND (cardinality($3::uuid[]) = 0 OR q.category_id = ANY($3::uuid[]))
           AND (cardinality($4::text[]) = 0 OR q.question_type = ANY($4::text[]))
           AND (
             $6 IN ('weekly', 'monthly')
             OR NOT EXISTS (
               SELECT 1 FROM ca_practice_set_questions psq
               JOIN ca_practice_sets ps ON ps.id = psq.practice_set_id
               WHERE psq.question_id = q.id AND ps.publication_status <> 'archived'
             )
           )
         ORDER BY q.ca_date DESC, q.created_at DESC
         LIMIT $5`,
        [
          input.dateFrom,
          input.dateTo,
          input.categoryIds,
          input.questionFormats,
          Math.max(input.questionCount * 2, 100),
          input.setType,
        ],
      );
      // Allocate according to requested difficulty distribution
      const byDiff = { easy: [], moderate: [], difficult: [] };
      for (const r of qRows.rows) {
        (byDiff[r.difficulty] || byDiff.moderate).push(r.id);
      }
      const targetEasy = Math.round((input.questionCount * input.difficultyDistribution.easy) / 100);
      const targetDiff = Math.round((input.questionCount * input.difficultyDistribution.difficult) / 100);
      const targetMod = Math.max(0, input.questionCount - targetEasy - targetDiff);

      const picked = [
        ...byDiff.easy.slice(0, targetEasy),
        ...byDiff.moderate.slice(0, targetMod),
        ...byDiff.difficult.slice(0, targetDiff),
      ];
      const pickedSet = new Set(picked);
      for (const r of qRows.rows) {
        if (picked.length >= input.questionCount) break;
        if (!pickedSet.has(r.id)) {
          picked.push(r.id);
          pickedSet.add(r.id);
        }
      }
      selectedQuestionIds = picked.slice(0, input.questionCount);
    }

    if (!selectedQuestionIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "No approved questions match the selected date range and filters. Approve questions in Question Review first.",
      });
    }

    const totalMarks = Number((selectedQuestionIds.length * input.marksPerQuestion).toFixed(2));
    const psRes = await client.query(
      `INSERT INTO ca_practice_sets
         (title, set_type, date_from, date_to, instructions, total_questions, total_marks,
          duration_minutes, marks_per_question, negative_marking, difficulty_distribution,
          categories, target_exams, question_formats, access_tier, allow_retry, publication_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,'draft',$17)
       RETURNING *`,
      [
        input.title,
        input.setType,
        input.dateFrom,
        input.dateTo,
        input.instructions ||
          `Attempt all ${selectedQuestionIds.length} questions. Marking: +${input.marksPerQuestion} for correct, -${input.negativeMarking} for incorrect.`,
        selectedQuestionIds.length,
        totalMarks,
        input.durationMinutes,
        input.marksPerQuestion,
        input.negativeMarking,
        JSON.stringify(input.difficultyDistribution),
        JSON.stringify(input.categoryIds),
        JSON.stringify(input.targetExams),
        JSON.stringify(input.questionFormats),
        input.accessTier,
        input.allowRetry,
        req.session.userId,
      ],
    );
    const ps = psRes.rows[0];
    for (let i = 0; i < selectedQuestionIds.length; i += 1) {
      await client.query(
        `INSERT INTO ca_practice_set_questions (practice_set_id, question_id, sort_order, marks)
         VALUES ($1,$2,$3,$4)`,
        [ps.id, selectedQuestionIds[i], i + 1, input.marksPerQuestion],
      );
    }
    await client.query("COMMIT");
    await writeAudit(req.session.userId, "ca.practice_set.create", "ca_practice_set", ps.id, { totalQuestions: ps.total_questions }, req.ip);
    res.status(201).json({ success: true, practiceSet: ps });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

caStudioAdminRouter.patch("/practice-sets/:id/status", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const { publicationStatus } = z
    .object({ publicationStatus: z.enum(["draft", "published", "unpublished", "archived"]) })
    .parse(req.body ?? {});

  if (publicationStatus === "published") {
    const check = await pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE q.review_status <> 'approved')::int AS unapproved
       FROM ca_practice_set_questions psq
       JOIN ca_generated_questions q ON q.id = psq.question_id
       WHERE psq.practice_set_id = $1`,
      [req.params.id],
    );
    if (!check.rows[0]?.total) {
      return res.status(400).json({ error: "Cannot publish an empty practice set." });
    }
    if (check.rows[0].unapproved > 0) {
      return res.status(400).json({
        error: `Cannot publish: ${check.rows[0].unapproved} question(s) are not approved yet.`,
      });
    }
  }

  const upd = await pool.query(
    `UPDATE ca_practice_sets
     SET publication_status = $2,
         published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
         updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id, publicationStatus],
  );
  if (!upd.rowCount) return res.status(404).json({ error: "Practice set not found." });
  res.json({ success: true, practiceSet: upd.rows[0] });
});

caStudioAdminRouter.get("/practice-sets/:id/questions", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const psRes = await pool.query("SELECT * FROM ca_practice_sets WHERE id = $1", [req.params.id]);
  if (!psRes.rowCount) return res.status(404).json({ error: "Practice set not found." });

  const qRes = await pool.query(
    `SELECT q.*, c.name AS category_name, e.main_event AS event_title, psq.sort_order, psq.marks,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text, 'is_correct', o.is_correct
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_practice_set_questions psq
     JOIN ca_generated_questions q ON q.id = psq.question_id
     LEFT JOIN ca_categories c ON c.id = q.category_id
     LEFT JOIN ca_events e ON e.id = q.event_id
     WHERE psq.practice_set_id = $1
     ORDER BY psq.sort_order ASC`,
    [req.params.id],
  );
  res.json({ success: true, practiceSet: psRes.rows[0], questions: qRes.rows });
});

caStudioAdminRouter.put("/practice-sets/:id/questions", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const { questionIds } = z
    .object({ questionIds: z.array(z.string().uuid()).min(1).max(150) })
    .parse(req.body ?? {});

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const psRes = await client.query("SELECT * FROM ca_practice_sets WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (!psRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Practice set not found." });
    }
    const ps = psRes.rows[0];
    const isRevisionMix = ps.set_type === "weekly" || ps.set_type === "monthly";
    const validRes = await client.query(
      `SELECT q.id FROM ca_generated_questions q
       WHERE q.id = ANY($1::uuid[])
         AND q.review_status = 'approved'
         AND (
           $3::boolean = TRUE
           OR NOT EXISTS (
             SELECT 1 FROM ca_practice_set_questions psq
             JOIN ca_practice_sets other_ps ON other_ps.id = psq.practice_set_id
             WHERE psq.question_id = q.id
               AND psq.practice_set_id <> $2
               AND other_ps.publication_status <> 'archived'
           )
         )`,
      [questionIds, ps.id, isRevisionMix],
    );
    const validSet = new Set(validRes.rows.map((r) => r.id));
    const orderedIds = [...new Set(questionIds)].filter((id) => validSet.has(id));
    if (!orderedIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Select at least one approved question." });
    }

    await client.query("DELETE FROM ca_practice_set_questions WHERE practice_set_id = $1", [ps.id]);
    const marks = Number(ps.marks_per_question) || 1;
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query(
        `INSERT INTO ca_practice_set_questions (practice_set_id, question_id, sort_order, marks)
         VALUES ($1,$2,$3,$4)`,
        [ps.id, orderedIds[i], i + 1, marks],
      );
    }
    const totalMarks = Number((orderedIds.length * marks).toFixed(2));
    const upd = await client.query(
      `UPDATE ca_practice_sets
       SET total_questions = $2, total_marks = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [ps.id, orderedIds.length, totalMarks],
    );
    await client.query("COMMIT");
    res.json({ success: true, practiceSet: upd.rows[0], questionCount: orderedIds.length });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

caStudioAdminRouter.delete("/practice-sets/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const del = await pool.query("DELETE FROM ca_practice_sets WHERE id = $1 RETURNING id", [req.params.id]);
  if (!del.rowCount) return res.status(404).json({ error: "Practice set not found." });
  res.json({ success: true, deletedId: req.params.id });
});

// ============================================================================
// 6. ADMIN PDF MANAGEMENT & EXPORT LOGS
// ============================================================================
caStudioAdminRouter.get("/practice-sets/:id/pdf/:format", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const format = String(req.params.format || "");
  if (!SUPPORTED_PDF_FORMATS.includes(format)) {
    return res.status(400).json({ error: `Invalid PDF format. Use: ${SUPPORTED_PDF_FORMATS.join(", ")}` });
  }
  const psRes = await pool.query("SELECT * FROM ca_practice_sets WHERE id = $1", [req.params.id]);
  if (!psRes.rowCount) return res.status(404).json({ error: "Practice set not found." });

  const qRes = await pool.query(
    `SELECT q.*, c.name AS category_name,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text, 'is_correct', o.is_correct
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_practice_set_questions psq
     JOIN ca_generated_questions q ON q.id = psq.question_id
     LEFT JOIN ca_categories c ON c.id = q.category_id
     WHERE psq.practice_set_id = $1
     ORDER BY psq.sort_order ASC`,
    [req.params.id],
  );

  const pdfOut = generatePracticeSetPdf({
    practiceSet: psRes.rows[0],
    questions: qRes.rows,
    format,
  });

  await pool.query(
    `INSERT INTO ca_pdf_exports (practice_set_id, student_id, pdf_format, file_name, file_size_bytes, sha256_hash)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [req.params.id, req.session.userId, format, pdfOut.fileName, pdfOut.fileSizeBytes, pdfOut.sha256Hash],
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdfOut.fileName}"`);
  res.setHeader("X-PDF-SHA256", pdfOut.sha256Hash);
  res.send(pdfOut.buffer);
});

caStudioAdminRouter.get("/pdf-exports", async (_req, res) => {
  const rows = await pool.query(
    `SELECT pe.*, ps.title AS practice_set_title, u.full_name AS downloaded_by
     FROM ca_pdf_exports pe
     JOIN ca_practice_sets ps ON ps.id = pe.practice_set_id
     LEFT JOIN users u ON u.id = pe.student_id
     ORDER BY pe.created_at DESC
     LIMIT 60`,
  );
  res.json({ success: true, exports: rows.rows });
});

// ============================================================================
// 7. ADMIN ANALYTICS (Phase 11)
// ============================================================================
caStudioAdminRouter.get("/analytics", async (req, res) => {
  const dateFrom = req.query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dateFrom)) ? String(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.dateTo)) ? String(req.query.dateTo) : null;

  const [summaryRes, catRes, jobRes] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT count(*)::int FROM ca_daily_batches WHERE ($1::date IS NULL OR event_date >= $1) AND ($2::date IS NULL OR event_date <= $2)) AS batches_processed,
         (SELECT count(*)::int FROM ca_events WHERE ($1::date IS NULL OR event_date >= $1) AND ($2::date IS NULL OR event_date <= $2)) AS events_extracted,
         (SELECT count(*)::int FROM ca_generated_questions WHERE ($1::date IS NULL OR ca_date >= $1) AND ($2::date IS NULL OR ca_date <= $2)) AS total_questions,
         (SELECT count(*)::int FROM ca_generated_questions WHERE review_status = 'approved') AS approved_questions,
         (SELECT count(*)::int FROM ca_generated_questions WHERE review_status = 'rejected') AS rejected_questions,
         (SELECT count(*)::int FROM ca_generated_questions WHERE duplicate_status <> 'unique') AS duplicate_questions,
         (SELECT count(*)::int FROM ca_practice_sets WHERE publication_status = 'published') AS published_sets,
         (SELECT count(*)::int FROM ca_student_attempts WHERE status <> 'in_progress') AS total_attempts,
         (SELECT coalesce(round(avg(accuracy_pct), 2), 0) FROM ca_student_attempts WHERE status <> 'in_progress') AS avg_accuracy_pct,
         (SELECT count(*)::int FROM ca_ai_processing_jobs WHERE status = 'failed') AS ai_failures,
         (SELECT count(*)::int FROM ca_pdf_exports) AS pdf_downloads`,
      [dateFrom, dateTo],
    ),
    pool.query(
      `SELECT c.name AS category_name,
              count(DISTINCT q.id)::int AS question_count,
              count(sa.id)::int AS answer_count,
              coalesce(round(avg(CASE WHEN sa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) AS avg_accuracy
       FROM ca_categories c
       LEFT JOIN ca_generated_questions q ON q.category_id = c.id
       LEFT JOIN ca_student_answers sa ON sa.question_id = q.id AND sa.selected_answer IS NOT NULL
       GROUP BY c.id, c.name
       ORDER BY answer_count DESC, question_count DESC
       LIMIT 12`,
    ),
    pool.query(
      `SELECT id, job_type, provider, model, status, input_count, output_count, duplicate_count, error_message, started_at, completed_at
       FROM ca_ai_processing_jobs
       ORDER BY started_at DESC
       LIMIT 20`,
    ),
  ]);

  res.json({
    success: true,
    summary: summaryRes.rows[0] || {},
    categoryBreakdown: catRes.rows,
    recentJobs: jobRes.rows,
  });
});

// ============================================================================
// 8. TRUSTED SOURCES & DAILY AUTOMATION CONFIG (Phase 9)
// ============================================================================
caStudioAdminRouter.post("/sources", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(160),
      sourceType: z.enum(["official_rss", "authorized_api", "manual_editorial", "document_upload", "structured_import"]).default("official_rss"),
      feedUrl: z.string().trim().max(500).default(""),
      trustLevel: z.enum(["verified", "trusted", "requires_review"]).default("verified"),
    })
    .parse(req.body ?? {});

  let safeUrl = "";
  if (input.feedUrl) {
    const check = validateAndNormalizeSourceUrl(input.feedUrl);
    if (!check.ok) return res.status(400).json({ error: check.error || "Invalid feed URL." });
    safeUrl = check.url;
  }
  const ins = await pool.query(
    `INSERT INTO ca_sources (name, source_type, feed_url, trust_level, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.name, input.sourceType, safeUrl, input.trustLevel, req.session.userId],
  );
  res.status(201).json({ success: true, source: ins.rows[0] });
});

caStudioAdminRouter.delete("/sources/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid source ID." });
  const del = await pool.query("DELETE FROM ca_sources WHERE id = $1 RETURNING id", [req.params.id]);
  if (!del.rowCount) return res.status(404).json({ error: "Source not found." });
  res.json({ success: true, deletedId: req.params.id });
});

caStudioAdminRouter.put("/automation-config", async (req, res) => {
  const input = z
    .object({
      automationEnabled: z.boolean(),
      dailyRunTimeIst: z.string().regex(/^\d{2}:\d{2}$/).default("06:30"),
      minRelevanceScore: z.coerce.number().int().min(0).max(100).default(60),
      defaultQuestionsPerEvent: z.coerce.number().int().min(1).max(5).default(2),
      requireAdminApproval: z.boolean().default(true),
    })
    .parse(req.body ?? {});

  const upd = await pool.query(
    `UPDATE ca_automation_config
     SET automation_enabled = $1, daily_run_time_ist = $2, min_relevance_score = $3,
         default_questions_per_event = $4, require_admin_approval = $5,
         updated_by = $6, updated_at = now()
     WHERE config_key = 'default' RETURNING *`,
    [
      input.automationEnabled,
      input.dailyRunTimeIst,
      input.minRelevanceScore,
      input.defaultQuestionsPerEvent,
      input.requireAdminApproval,
      req.session.userId,
    ],
  );
  res.json({ success: true, automationConfig: upd.rows[0] });
});

caStudioAdminRouter.post("/automation/run-fetch", aiJobLimiter, async (req, res) => {
  const sourceId = req.body?.sourceId && isValidUuid(String(req.body.sourceId)) ? String(req.body.sourceId) : null;
  const sourcesRes = sourceId
    ? await pool.query("SELECT * FROM ca_sources WHERE id = $1 AND feed_url <> ''", [sourceId])
    : await pool.query("SELECT * FROM ca_sources WHERE is_active = TRUE AND feed_url <> '' ORDER BY created_at ASC LIMIT 8");
  if (!sourcesRes.rowCount) {
    return res.status(400).json({ error: "No active RSS/API sources with URLs are configured." });
  }

  const outcomes = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const src of sourcesRes.rows) {
    try {
      const items = await fetchTrustedSourceItems({ source: src, maxItems: 8 });
      if (!items.length) {
        outcomes.push({ source: src.name, ok: true, fetched: 0 });
        continue;
      }
      const combined = items.map((it, idx) => `[${idx + 1}] ${it.title}\n${it.content}`).join("\n\n");
      const batchRes = await pool.query(
        `INSERT INTO ca_daily_batches (title, event_date, submission_mode, source_id, source_name, source_url, raw_content, created_by)
         VALUES ($1,$2,'automated',$3,$4,$5,$6,$7) RETURNING id`,
        [`Auto Fetch: ${src.name} (${today})`, today, src.id, src.name, src.feed_url, combined, req.session.userId],
      );
      await pool.query("UPDATE ca_sources SET last_fetched_at = now() WHERE id = $1", [src.id]);
      outcomes.push({ source: src.name, ok: true, fetched: items.length, batchId: batchRes.rows[0].id });
    } catch (err) {
      outcomes.push({ source: src.name, ok: false, error: err.message });
    }
  }

  res.json({ success: true, outcomes });
});