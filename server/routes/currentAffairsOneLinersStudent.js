import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { recordStudyDay } from "../services/milestones.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const currentAffairsOneLinersStudentRouter = Router();
currentAffairsOneLinersStudentRouter.use(requireAuth);

const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  category: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(120).optional(),
  exam: z.string().trim().max(60).optional(),
  priority: z.enum(["must_study", "important", "additional"]).optional(),
  reviewStatus: z.enum(["not_started", "revised", "needs_revision"]).optional(),
  bookmarked: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// 1. Daily grouped digest
currentAffairsOneLinersStudentRouter.get("/daily", async (req, res) => {
  const days = await pool.query(`
    SELECT
      to_char(COALESCE(important_date, created_at::date), 'YYYY-MM-DD') AS digest_date,
      count(*)::int AS fact_count,
      count(*) FILTER (WHERE study_priority = 'must_study')::int AS must_study_count
    FROM current_affairs_one_liners
    WHERE publication_status = 'published'
    GROUP BY digest_date
    ORDER BY digest_date DESC
    LIMIT 60
  `);
  res.json({ success: true, days: days.rows });
});

// 2. Monthly grouped digest
currentAffairsOneLinersStudentRouter.get("/monthly", async (_req, res) => {
  const months = await pool.query(`
    SELECT
      to_char(COALESCE(important_date, created_at::date), 'YYYY-MM') AS month_key,
      count(*)::int AS fact_count,
      count(*) FILTER (WHERE study_priority = 'must_study')::int AS must_study_count
    FROM current_affairs_one_liners
    WHERE publication_status = 'published'
    GROUP BY month_key
    ORDER BY month_key DESC
    LIMIT 36
  `);
  res.json({ success: true, months: months.rows });
});

// 3. Topic & Category distribution
currentAffairsOneLinersStudentRouter.get("/topics", async (_req, res) => {
  const rows = await pool.query(`
    SELECT category_name, count(*)::int AS fact_count
    FROM current_affairs_one_liners
    WHERE publication_status = 'published'
    GROUP BY category_name
    ORDER BY fact_count DESC, category_name ASC
  `);
  res.json({ success: true, topics: rows.rows });
});

// 4. Filtered & paginated student One-Liners list
currentAffairsOneLinersStudentRouter.get("/", async (req, res) => {
  const q = listQuerySchema.parse(req.query);
  const search = q.q ? `%${q.q.replace(/[%_]/g, "\\$&")}%` : null;
  const bookmarkedOnly = q.bookmarked === "true";
  const examJson = q.exam ? JSON.stringify([q.exam]) : null;
  const offset = (q.page - 1) * q.limit;

  const params = [
    req.session.userId,
    search,
    q.date || null,
    q.month || null,
    q.year || null,
    q.category || null,
    q.topic || null,
    examJson,
    q.priority || null,
    q.reviewStatus || null,
    bookmarkedOnly,
  ];

  const where = `
    WHERE ol.publication_status = 'published'
      AND ($2::text IS NULL OR ol.fact_text ILIKE $2 ESCAPE '\\' OR ol.context ILIKE $2 ESCAPE '\\' OR ol.related_institution ILIKE $2 ESCAPE '\\')
      AND ($3::date IS NULL OR COALESCE(ol.important_date, ol.created_at::date) = $3)
      AND ($4::text IS NULL OR to_char(COALESCE(ol.important_date, ol.created_at::date), 'YYYY-MM') = $4)
      AND ($5::int IS NULL OR EXTRACT(YEAR FROM COALESCE(ol.important_date, ol.created_at::date))::int = $5)
      AND ($6::text IS NULL OR ol.category_name = $6)
      AND ($7::text IS NULL OR ol.topic = $7)
      AND ($8::jsonb IS NULL OR ol.exam_tags @> $8::jsonb)
      AND ($9::text IS NULL OR ol.study_priority = $9)
      AND ($10::text IS NULL OR COALESCE(r.review_status, 'not_started') = $10)
      AND ($11::boolean = FALSE OR COALESCE(r.is_bookmarked, FALSE) = TRUE)
  `;

  const [cnt, rows] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS total
       FROM current_affairs_one_liners ol
       LEFT JOIN current_affairs_one_liner_reviews r
         ON r.one_liner_id = ol.id AND r.student_id = $1
       ${where}`,
      params,
    ),
    pool.query(
      `SELECT
         ol.id, ol.fact_text, ol.context, ol.category_name, ol.topic, ol.subtopic,
         ol.related_institution, ol.related_person, ol.important_date, ol.important_figure,
         ol.effective_date, ol.source_url, ol.study_priority, ol.banking_relevance_score,
         ol.exam_tags, ol.created_at,
         COALESCE(r.review_status, 'not_started') AS review_status,
         COALESCE(r.is_bookmarked, FALSE) AS is_bookmarked,
         r.last_reviewed_at
       FROM current_affairs_one_liners ol
       LEFT JOIN current_affairs_one_liner_reviews r
         ON r.one_liner_id = ol.id AND r.student_id = $1
       ${where}
       ORDER BY COALESCE(ol.important_date, ol.created_at::date) DESC, ol.created_at DESC
       LIMIT $12 OFFSET $13`,
      [...params, q.limit, offset],
    ),
  ]);

  res.json({
    success: true,
    items: rows.rows,
    pagination: buildPaginationMeta({ page: q.page, limit: q.limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

// 5. Mark Revision Status (student-owned, published one-liners only)
currentAffairsOneLinersStudentRouter.post("/:id/review", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const { reviewStatus } = z
    .object({ reviewStatus: z.enum(["not_started", "revised", "needs_revision"]) })
    .parse(req.body);

  const check = await pool.query(
    "SELECT id FROM current_affairs_one_liners WHERE id = $1 AND publication_status = 'published'",
    [req.params.id],
  );
  if (!check.rowCount) return res.status(404).json({ error: "Published one-liner not found." });

  const row = await pool.query(
    `INSERT INTO current_affairs_one_liner_reviews
       (one_liner_id, student_id, review_status, last_reviewed_at, updated_at)
     VALUES ($1, $2, $3, now(), now())
     ON CONFLICT (one_liner_id, student_id) DO UPDATE SET
       review_status = $3,
       last_reviewed_at = now(),
       updated_at = now()
     RETURNING review_status, is_bookmarked, last_reviewed_at`,
    [req.params.id, req.session.userId, reviewStatus],
  );
  if (reviewStatus === "revised") {
    await recordStudyDay(req.session.userId);
  }
  res.json({ success: true, ...row.rows[0] });
});

// 6. Toggle Bookmark (student-owned, published one-liners only)
currentAffairsOneLinersStudentRouter.post("/:id/bookmark", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid one-liner ID." });
  const { isBookmarked } = z.object({ isBookmarked: z.boolean() }).parse(req.body);

  const check = await pool.query(
    "SELECT id FROM current_affairs_one_liners WHERE id = $1 AND publication_status = 'published'",
    [req.params.id],
  );
  if (!check.rowCount) return res.status(404).json({ error: "Published one-liner not found." });

  const row = await pool.query(
    `INSERT INTO current_affairs_one_liner_reviews
       (one_liner_id, student_id, is_bookmarked, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (one_liner_id, student_id) DO UPDATE SET
       is_bookmarked = $3,
       updated_at = now()
     RETURNING review_status, is_bookmarked`,
    [req.params.id, req.session.userId, isBookmarked],
  );
  res.json({ success: true, ...row.rows[0] });
});
