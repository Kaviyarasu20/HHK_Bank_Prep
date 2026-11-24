import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { recordStudyDay, syncMilestones } from "../services/milestones.js";

export const currentAffairsStudentRouter = Router();

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function getIstMonthRange(monthStr) {
  if (typeof monthStr !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
    return null;
  }
  const [year, month] = monthStr.split("-").map(Number);
  const startIso = `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endIso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`;
  return { startIso, endIso };
}

export function buildPaginationMeta({ page, limit, total }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));
  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

const studentListQuerySchema = z.object({
  categoryId: z.string().trim().optional(),
  month: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  bookmarked: z.string().optional(),
  priority: z.enum(["must_study", "important", "additional"]).optional(),
  relevance: z.enum(["highly_relevant", "relevant", "moderately_relevant", "low_relevance"]).optional(),
  exam: z.string().trim().max(60).optional(),
  topic: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

// 1. Active Categories (must be registered before /:id)
currentAffairsStudentRouter.get(
  "/current-affairs/categories",
  requireAuth,
  async (_req, res) => {
    const rows = await pool.query(
      `SELECT id, name, slug, description, icon, sort_order, is_featured
       FROM current_affairs_categories
       WHERE COALESCE(is_active, TRUE) = TRUE
       ORDER BY COALESCE(sort_order, 0) ASC, name ASC`,
    );
    res.json({
      success: true,
      categories: rows.rows,
      data: rows.rows,
    });
  },
);

// 2. Combined Current Affairs Quiz (must be registered before /:id)
currentAffairsStudentRouter.get(
  "/current-affairs/quiz/combined",
  requireAuth,
  async (req, res) => {
    const rawCategoryId = req.query.categoryId ? String(req.query.categoryId).trim() : null;
    if (rawCategoryId && !isValidUuid(rawCategoryId)) {
      return res.status(400).json({ error: "Invalid categoryId parameter." });
    }
    const monthRange = getIstMonthRange(req.query.month);

    const rows = await pool.query(
      `SELECT
         q.id, q.affair_id, ca.title AS affair_title, q.question_text, q.options,
         a.selected_answer, a.is_correct,
         CASE WHEN a.selected_answer IS NOT NULL THEN q.correct_answer END AS correct_answer,
         CASE WHEN a.selected_answer IS NOT NULL THEN q.explanation END AS explanation
       FROM current_affairs ca
       JOIN current_affairs_questions q ON q.affair_id = ca.id
       LEFT JOIN current_affairs_answers a ON a.question_id = q.id AND a.student_id = $1
       WHERE ca.status = 'published'
         AND ($2::uuid IS NULL OR ca.category_id = $2)
         AND ($3::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) >= $3)
         AND ($4::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) < $4)
       ORDER BY ca.published_at DESC NULLS LAST, q.id
       LIMIT 50`,
      [
        req.session.userId,
        rawCategoryId,
        monthRange?.startIso ?? null,
        monthRange?.endIso ?? null,
      ],
    );
    if (!rows.rowCount) {
      return res.status(404).json({ error: "No quiz questions available for this filter yet." });
    }
    res.json({
      success: true,
      questions: rows.rows,
      data: rows.rows,
    });
  },
);

// 3. Published Articles List (search, filters, pagination)
currentAffairsStudentRouter.get("/current-affairs", requireAuth, async (req, res) => {
  const query = studentListQuerySchema.parse(req.query);
  const rawCategoryId = query.categoryId || null;
  if (rawCategoryId && !isValidUuid(rawCategoryId)) {
    return res.status(400).json({ error: "Invalid categoryId parameter." });
  }
  const monthRange = getIstMonthRange(query.month);
  const bookmarkedOnly = query.bookmarked === "true";
  const searchPattern = query.q ? `%${query.q.replace(/[%_]/g, "\\$&")}%` : null;
  const priority = query.priority || null;
  const relevance = query.relevance || null;
  const examFilter = query.exam || null;
  const topicPattern = query.topic ? `%${query.topic.replace(/[%_]/g, "\\$&")}%` : null;
  const offset = (query.page - 1) * query.limit;

  const filterParams = [
    req.session.userId,
    rawCategoryId,
    monthRange?.startIso ?? null,
    monthRange?.endIso ?? null,
    bookmarkedOnly,
    searchPattern,
    priority,
    relevance,
    examFilter,
    topicPattern,
  ];

  // Join ONLY the latest APPROVED AI result; never expose raw_ai_response, confidence_score, or unapproved drafts
  const approvedAiJoin = `
    LEFT JOIN LATERAL (
      SELECT
        ar.id AS ai_id, ar.exam_headline, ar.summary AS ai_summary,
        ar.detailed_explanation AS ai_detailed_explanation,
        ar.why_it_matters AS ai_why_it_matters,
        ar.takeaways AS ai_takeaways,
        ar.important_terms AS ai_important_terms,
        ar.banking_relevance_score, ar.banking_relevance_level,
        ar.study_priority AS ai_study_priority
      FROM current_affairs_ai_results ar
      WHERE ar.current_affairs_id = ca.id AND ar.processing_status = 'approved'
      ORDER BY ar.updated_at DESC
      LIMIT 1
    ) ai ON TRUE
  `;

  const whereClause = `
    WHERE ca.status = 'published'
      AND ($2::uuid IS NULL OR ca.category_id = $2)
      AND ($3::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) >= $3)
      AND ($4::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) < $4)
      AND ($5::boolean = FALSE OR COALESCE(r.is_bookmarked, FALSE) = TRUE)
      AND ($6::text IS NULL OR ca.title ILIKE $6 ESCAPE '\\' OR ca.body ILIKE $6 ESCAPE '\\' OR ca.static_gk ILIKE $6 ESCAPE '\\' OR ai.exam_headline ILIKE $6 ESCAPE '\\')
      AND ($7::text IS NULL OR COALESCE(ai.ai_study_priority, ca.priority_level) = $7)
      AND ($8::text IS NULL OR ai.banking_relevance_level = $8)
      AND ($9::text IS NULL OR EXISTS (
        SELECT 1 FROM current_affairs_ai_exam_tags et
        WHERE et.ai_result_id = ai.ai_id AND et.exam_code = $9
      ) OR ca.target_exams @> to_jsonb(ARRAY[$9]::text[]))
      AND ($10::text IS NULL OR EXISTS (
        SELECT 1 FROM current_affairs_ai_topics tp
        WHERE tp.ai_result_id = ai.ai_id AND tp.topic_name ILIKE $10 ESCAPE '\\'
      ))
  `;

  const [countRes, rowsRes] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total
       FROM current_affairs ca
       LEFT JOIN current_affairs_reads r ON r.affair_id = ca.id AND r.student_id = $1
       ${approvedAiJoin}
       ${whereClause}`,
      filterParams,
    ),
    pool.query(
      `SELECT
         ca.id, ca.title, ca.body, ca.key_points, ca.static_gk, ca.source_url,
         ca.source_name, ca.source_published_at,
         COALESCE(ai.ai_study_priority, ca.priority_level) AS priority_level,
         ca.tags, ca.target_exams, ca.verification_status, ca.published_at, ca.updated_at,
         cat.id AS category_id, cat.name AS category,
         COALESCE(r.is_read, FALSE) AS is_read,
         COALESCE(r.is_bookmarked, FALSE) AS is_bookmarked,
         COALESCE(qc.quiz_count, 0)::int AS quiz_count,
         CASE WHEN ai.ai_id IS NOT NULL THEN jsonb_build_object(
           'examHeadline', ai.exam_headline,
           'summary', ai.ai_summary,
           'detailedExplanation', ai.ai_detailed_explanation,
           'whyItMatters', ai.ai_why_it_matters,
           'takeaways', ai.ai_takeaways,
           'importantTerms', ai.ai_important_terms,
           'bankingRelevanceScore', ai.banking_relevance_score,
           'bankingRelevanceLevel', ai.banking_relevance_level,
           'studyPriority', ai.ai_study_priority,
           'facts', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'factType', f.fact_type, 'factText', f.fact_text, 'factValue', f.fact_value,
               'unit', f.unit, 'eventStage', f.event_stage, 'context', f.context
             )) FROM current_affairs_ai_facts f WHERE f.ai_result_id = ai.ai_id
           ), '[]'::jsonb),
           'examTags', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('examCode', et.exam_code, 'relevanceReason', et.relevance_reason))
             FROM current_affairs_ai_exam_tags et WHERE et.ai_result_id = ai.ai_id
           ), '[]'::jsonb),
           'staticGk', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('title', g.title, 'description', g.description, 'referenceType', g.reference_type, 'referenceId', g.reference_id))
             FROM current_affairs_ai_static_gk g WHERE g.ai_result_id = ai.ai_id
           ), '[]'::jsonb)
         ) ELSE NULL END AS ai_structured
       FROM current_affairs ca
       JOIN current_affairs_categories cat ON cat.id = ca.category_id
       LEFT JOIN current_affairs_reads r ON r.affair_id = ca.id AND r.student_id = $1
       LEFT JOIN (
         SELECT affair_id, count(*)::int AS quiz_count
         FROM current_affairs_questions
         GROUP BY affair_id
       ) qc ON qc.affair_id = ca.id
       ${approvedAiJoin}
       ${whereClause}
       ORDER BY ca.published_at DESC NULLS LAST, ca.created_at DESC
       LIMIT $11 OFFSET $12`,
      [...filterParams, query.limit, offset],
    ),
  ]);

  const pagination = buildPaginationMeta({
    page: query.page,
    limit: query.limit,
    total: countRes.rows[0]?.total ?? 0,
  });

  res.json({
    success: true,
    items: rowsRes.rows,
    data: rowsRes.rows,
    pagination,
  });
});

// 4. Published Article Detail
currentAffairsStudentRouter.get("/current-affairs/:id", requireAuth, async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const row = await pool.query(
    `SELECT
       ca.id, ca.title, ca.body, ca.key_points, ca.static_gk, ca.source_url,
       ca.source_name, ca.source_published_at, ca.priority_level, ca.tags,
       ca.target_exams, ca.verification_status, ca.published_at, ca.updated_at,
       cat.id AS category_id, cat.name AS category,
       COALESCE(r.is_read, FALSE) AS is_read,
       COALESCE(r.is_bookmarked, FALSE) AS is_bookmarked,
       (SELECT count(*)::int FROM current_affairs_questions q WHERE q.affair_id = ca.id) AS quiz_count
     FROM current_affairs ca
     JOIN current_affairs_categories cat ON cat.id = ca.category_id
     LEFT JOIN current_affairs_reads r ON r.affair_id = ca.id AND r.student_id = $2
     WHERE ca.id = $1 AND ca.status = 'published'`,
    [req.params.id, req.session.userId],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Published current affairs article not found." });
  }
  res.json({
    success: true,
    item: row.rows[0],
    data: row.rows[0],
  });
});

// 5. Update Student Read / Bookmark Status (published articles only)
currentAffairsStudentRouter.post("/current-affairs/:id/state", requireAuth, async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const input = z
    .object({
      isRead: z.boolean().optional(),
      isBookmarked: z.boolean().optional(),
    })
    .parse(req.body);

  const publishedCheck = await pool.query(
    "SELECT id FROM current_affairs WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!publishedCheck.rowCount) {
    return res.status(404).json({ error: "Published current affairs article not found." });
  }

  const row = await pool.query(
    `INSERT INTO current_affairs_reads (student_id, affair_id, is_read, is_bookmarked, updated_at)
     VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, FALSE), now())
     ON CONFLICT (student_id, affair_id) DO UPDATE SET
       is_read = COALESCE($3, current_affairs_reads.is_read),
       is_bookmarked = COALESCE($4, current_affairs_reads.is_bookmarked),
       updated_at = now()
     RETURNING is_read, is_bookmarked`,
    [req.session.userId, req.params.id, input.isRead ?? null, input.isBookmarked ?? null],
  );
  res.json({
    success: true,
    ...row.rows[0],
    data: row.rows[0],
  });
});

// 6. Article Quiz Questions
currentAffairsStudentRouter.get(
  "/current-affairs/:id/quiz",
  requireAuth,
  async (req, res) => {
    if (!isValidUuid(req.params.id)) {
      return res.status(400).json({ error: "Invalid current affairs article ID." });
    }
    const rows = await pool.query(
      `SELECT q.id, q.question_text, q.options, a.selected_answer, a.is_correct,
              CASE WHEN a.selected_answer IS NOT NULL THEN q.correct_answer END AS correct_answer,
              CASE WHEN a.selected_answer IS NOT NULL THEN q.explanation END AS explanation
       FROM current_affairs ca
       JOIN current_affairs_questions q ON q.affair_id = ca.id
       LEFT JOIN current_affairs_answers a ON a.question_id = q.id AND a.student_id = $2
       WHERE ca.id = $1 AND ca.status = 'published'
       ORDER BY q.id`,
      [req.params.id, req.session.userId],
    );
    if (!rows.rowCount) {
      return res.status(404).json({ error: "Quiz not found." });
    }
    res.json({
      success: true,
      questions: rows.rows,
      data: rows.rows,
    });
  },
);

// 7. Submit Student Answer (preserves streak & milestone integration)
currentAffairsStudentRouter.post(
  "/current-affairs/:id/quiz/:questionId/answer",
  requireAuth,
  async (req, res) => {
    if (!isValidUuid(req.params.id) || !isValidUuid(req.params.questionId)) {
      return res.status(400).json({ error: "Invalid article or question ID." });
    }
    const input = z.object({ answer: z.string().min(1).max(8) }).parse(req.body);

    const row = await pool.query(
      `SELECT q.correct_answer, q.explanation, q.options
       FROM current_affairs_questions q
       JOIN current_affairs ca ON ca.id = q.affair_id
       WHERE ca.id = $1 AND q.id = $2 AND ca.status = 'published'`,
      [req.params.id, req.params.questionId],
    );
    if (!row.rowCount) {
      return res.status(404).json({ error: "Quiz question not found." });
    }
    if (!row.rows[0].options.some((option) => option.key === input.answer)) {
      return res.status(400).json({ error: "Choose one of the listed answer options." });
    }

    const correctAnswer = row.rows[0].correct_answer;
    const inserted = await pool.query(
      `INSERT INTO current_affairs_answers(student_id, question_id, selected_answer, is_correct)
       VALUES($1, $2, $3, $4)
       ON CONFLICT(student_id, question_id) DO NOTHING
       RETURNING selected_answer, is_correct`,
      [req.session.userId, req.params.questionId, input.answer, correctAnswer === input.answer],
    );
    const saved =
      inserted.rows[0] ??
      (
        await pool.query(
          "SELECT selected_answer, is_correct FROM current_affairs_answers WHERE student_id = $1 AND question_id = $2",
          [req.session.userId, req.params.questionId],
        )
      ).rows[0];

    if (inserted.rowCount) {
      await recordStudyDay(req.session.userId);
      await syncMilestones(req.session.userId);
    }

    res.json({
      success: true,
      selectedAnswer: saved.selected_answer,
      correct: saved.is_correct,
      correctAnswer,
      explanation: row.rows[0].explanation,
      alreadyAnswered: !inserted.rowCount,
    });
  },
);
