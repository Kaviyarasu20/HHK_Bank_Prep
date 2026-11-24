import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { fetchOfficialCaDrafts } from "../services/caFeedFetcher.js";
import {
  computeArticleContentHash,
  isValidUuid,
  validateAndNormalizeSourceUrl,
} from "../services/caUrlSecurity.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const currentAffairsAdminRouter = Router();
currentAffairsAdminRouter.use(requireAdmin);

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs
      (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

const safeSourceUrlSchema = z
  .string()
  .trim()
  .max(500)
  .default("")
  .superRefine((val, ctx) => {
    const check = validateAndNormalizeSourceUrl(val, { allowEmpty: true });
    if (!check.ok) {
      ctx.addIssue({ code: "custom", message: check.error });
    }
  })
  .transform((val) => validateAndNormalizeSourceUrl(val, { allowEmpty: true }).url);

const questionSchema = z
  .object({
    questionText: z.string().trim().min(5).max(5000),
    options: z
      .array(
        z.object({
          key: z.string().trim().toUpperCase().regex(/^[A-H]$/),
          text: z.string().trim().min(1).max(1000),
        }),
      )
      .min(2)
      .max(8)
      .refine(
        (options) => new Set(options.map((o) => o.key)).size === options.length,
        { message: "Option keys must be unique." },
      ),
    correctAnswer: z.string().trim().toUpperCase().regex(/^[A-H]$/),
    explanation: z.string().trim().max(10000).default(""),
  })
  .refine((v) => v.options.some((o) => o.key === v.correctAnswer), {
    message: "Correct answer must match one of the option keys.",
  });

const caArticleFields = {
  categoryId: z.string().uuid(),
  title: z.string().trim().min(4).max(240),
  body: z.string().trim().min(10).max(30000),
  keyPoints: z.array(z.string().trim().min(2).max(500)).max(15).optional(),
  staticGk: z.string().trim().max(2000).optional(),
  sourceUrl: safeSourceUrlSchema.optional(),
  sourceName: z.string().trim().max(120).optional(),
  sourcePublishedAt: z.string().datetime().nullable().optional(),
  priorityLevel: z.enum(["must_study", "important", "additional"]).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  targetExams: z.array(z.string().trim().min(2).max(40)).max(20).optional(),
  verificationStatus: z.enum(["draft", "unverified", "verified", "rejected"]).optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected", "needs_revision"]).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
};

const adminListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().trim().optional(),
  status: z.enum(["all", "draft", "published", "archived"]).default("all"),
  source: z.string().trim().max(120).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sort: z.enum(["newest", "oldest", "updated", "title"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

function makeSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchAdminStats() {
  const [articleStats, mcqStats] = await Promise.all([
    pool.query(`
      SELECT
        count(*)::int AS total_articles,
        count(*) FILTER (WHERE status = 'published')::int AS published_articles,
        count(*) FILTER (WHERE status = 'draft')::int AS draft_articles,
        count(*) FILTER (WHERE status = 'archived')::int AS archived_articles,
        count(*) FILTER (WHERE approval_status = 'pending' AND status <> 'archived')::int AS pending_approval
      FROM current_affairs
    `),
    pool.query("SELECT count(*)::int AS total_mcqs FROM current_affairs_questions"),
  ]);
  const a = articleStats.rows[0] || {};
  return {
    totalArticles: a.total_articles ?? 0,
    publishedArticles: a.published_articles ?? 0,
    draftArticles: a.draft_articles ?? 0,
    archivedArticles: a.archived_articles ?? 0,
    pendingApproval: a.pending_approval ?? 0,
    totalMcqs: mcqStats.rows[0]?.total_mcqs ?? 0,
  };
}

// ============================================================================
// 1. STATS & CATEGORY MANAGEMENT (must be registered BEFORE /:id)
// ============================================================================

currentAffairsAdminRouter.get("/current-affairs/stats", async (_req, res) => {
  const stats = await fetchAdminStats();
  res.json({ success: true, stats, data: stats });
});

currentAffairsAdminRouter.get("/current-affairs/categories", async (_req, res) => {
  const rows = await pool.query(`
    SELECT
      c.id, c.name, c.slug, c.description, c.icon, c.sort_order,
      COALESCE(c.is_active, TRUE) AS is_active,
      COALESCE(c.is_featured, FALSE) AS is_featured,
      c.updated_at,
      count(ca.id)::int AS article_count
    FROM current_affairs_categories c
    LEFT JOIN current_affairs ca ON ca.category_id = c.id
    GROUP BY c.id
    ORDER BY COALESCE(c.sort_order, 0) ASC, c.name ASC
  `);
  res.json({ success: true, categories: rows.rows, data: rows.rows });
});

currentAffairsAdminRouter.post("/current-affairs/categories", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      slug: z.string().trim().max(90).optional(),
      description: z.string().trim().max(500).default(""),
      icon: z.string().trim().max(40).default(""),
      sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
      isActive: z.boolean().default(true),
      isFeatured: z.boolean().default(false),
    })
    .parse(req.body);

  const dup = await pool.query(
    "SELECT id FROM current_affairs_categories WHERE lower(name) = lower($1) LIMIT 1",
    [input.name],
  );
  if (dup.rowCount) {
    return res.status(409).json({ error: `Category "${input.name}" already exists.` });
  }

  const slug = input.slug ? makeSlug(input.slug) : makeSlug(input.name);
  const row = await pool.query(
    `INSERT INTO current_affairs_categories
       (name, slug, description, icon, sort_order, is_active, is_featured, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     RETURNING *`,
    [input.name, slug, input.description, input.icon, input.sortOrder, input.isActive, input.isFeatured],
  );

  await audit(
    req.session.userId,
    "current_affairs.category.create",
    "current_affairs_category",
    row.rows[0].id,
    { name: input.name, isActive: input.isActive },
    req.ip,
  );
  res.status(201).json({ success: true, category: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.put("/current-affairs/categories/:categoryId", async (req, res) => {
  if (!isValidUuid(req.params.categoryId)) {
    return res.status(400).json({ error: "Invalid category ID." });
  }
  const input = z
    .object({
      name: z.string().trim().min(2).max(80),
      slug: z.string().trim().max(90).optional(),
      description: z.string().trim().max(500).optional(),
      icon: z.string().trim().max(40).optional(),
      sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    })
    .parse(req.body);

  const dup = await pool.query(
    "SELECT id FROM current_affairs_categories WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1",
    [input.name, req.params.categoryId],
  );
  if (dup.rowCount) {
    return res.status(409).json({ error: `Category "${input.name}" already exists.` });
  }

  const slug = input.slug !== undefined ? makeSlug(input.slug) : makeSlug(input.name);
  const row = await pool.query(
    `UPDATE current_affairs_categories
     SET name = $2,
         slug = COALESCE($3, slug),
         description = COALESCE($4, description),
         icon = COALESCE($5, icon),
         sort_order = COALESCE($6, sort_order),
         is_active = COALESCE($7, is_active),
         is_featured = COALESCE($8, is_featured),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.categoryId,
      input.name,
      slug,
      input.description ?? null,
      input.icon ?? null,
      input.sortOrder ?? null,
      input.isActive ?? null,
      input.isFeatured ?? null,
    ],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Category not found." });
  }

  await audit(
    req.session.userId,
    "current_affairs.category.update",
    "current_affairs_category",
    req.params.categoryId,
    { name: input.name, isActive: row.rows[0].is_active },
    req.ip,
  );
  res.json({ success: true, category: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.patch(
  "/current-affairs/categories/:categoryId/active",
  async (req, res) => {
    if (!isValidUuid(req.params.categoryId)) {
      return res.status(400).json({ error: "Invalid category ID." });
    }
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const row = await pool.query(
      `UPDATE current_affairs_categories
       SET is_active = $2, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.categoryId, isActive],
    );
    if (!row.rowCount) {
      return res.status(404).json({ error: "Category not found." });
    }
    await audit(
      req.session.userId,
      isActive ? "current_affairs.category.activate" : "current_affairs.category.deactivate",
      "current_affairs_category",
      req.params.categoryId,
      { isActive },
      req.ip,
    );
    res.json({ success: true, category: row.rows[0], data: row.rows[0] });
  },
);

currentAffairsAdminRouter.delete("/current-affairs/categories/:categoryId", async (req, res) => {
  if (!isValidUuid(req.params.categoryId)) {
    return res.status(400).json({ error: "Invalid category ID." });
  }
  const usage = await pool.query(
    "SELECT count(*)::int AS cnt FROM current_affairs WHERE category_id = $1",
    [req.params.categoryId],
  );
  const articleCount = usage.rows[0]?.cnt ?? 0;
  if (articleCount > 0) {
    return res.status(409).json({
      error: `Cannot delete category with ${articleCount} linked article(s). Deactivate it instead to preserve article relationships.`,
    });
  }

  const deleted = await pool.query(
    "DELETE FROM current_affairs_categories WHERE id = $1 RETURNING id, name",
    [req.params.categoryId],
  );
  if (!deleted.rowCount) {
    return res.status(404).json({ error: "Category not found." });
  }
  await audit(
    req.session.userId,
    "current_affairs.category.delete",
    "current_affairs_category",
    req.params.categoryId,
    { name: deleted.rows[0].name },
    req.ip,
  );
  res.json({ success: true, deleted: true, id: req.params.categoryId });
});

// ============================================================================
// 2. BULK IMPORT & RSS FEED INGESTION (must be registered BEFORE /:id)
// ============================================================================

currentAffairsAdminRouter.post("/current-affairs/bulk-import", async (req, res) => {
  const bulkSchema = z.object({
    items: z
      .array(
        z.object({
          category: z.string().trim().min(2).max(80),
          title: z.string().trim().min(4).max(240),
          body: z.string().trim().min(10).max(30000),
          keyPoints: z.array(z.string().trim().min(2).max(500)).max(15).default([]),
          staticGk: z.string().trim().max(2000).default(""),
          sourceUrl: safeSourceUrlSchema,
          sourceName: z.string().trim().max(120).default(""),
          sourcePublishedAt: z.string().datetime().nullable().optional(),
          priorityLevel: z.enum(["must_study", "important", "additional"]).default("important"),
          tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
          targetExams: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
          status: z.enum(["draft", "published"]).default("published"),
          publishedAt: z.string().datetime().nullable().optional(),
          questions: z.array(questionSchema).max(10).default([]),
        }),
      )
      .min(1)
      .max(100),
  });

  const { items } = bulkSchema.parse(req.body);
  const catRows = await pool.query("SELECT id, name FROM current_affairs_categories");
  const catMap = new Map(catRows.rows.map((c) => [c.name.toLowerCase(), c.id]));

  const client = await pool.connect();
  let importedArticles = 0;
  let skippedArticles = 0;
  let importedQuestions = 0;
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const categoryId = catMap.get(item.category.toLowerCase());
      if (!categoryId) {
        throw Object.assign(new Error(`Unknown category: "${item.category}"`), { status: 400 });
      }
      const contentHash = computeArticleContentHash({ title: item.title, body: item.body });
      const dup = await client.query(
        `SELECT id FROM current_affairs
         WHERE ($1 <> '' AND source_url = $1)
            OR ($2 <> '' AND content_hash = $2)
            OR lower(title) = lower($3)
         LIMIT 1`,
        [item.sourceUrl, contentHash, item.title],
      );
      if (dup.rowCount) {
        skippedArticles += 1;
        continue;
      }

      const publishedAt =
        item.status === "published" ? item.publishedAt || new Date().toISOString() : null;
      const approvalStatus = item.status === "published" ? "approved" : "pending";
      const inserted = await client.query(
        `INSERT INTO current_affairs
           (category_id, title, body, key_points, static_gk, source_url, source_name,
            source_published_at, priority_level, tags, target_exams, content_hash,
            verification_status, approval_status, status, published_at, created_by, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::text[], $11::jsonb, $12, 'unverified', $13, $14, $15, $16, now())
         RETURNING id`,
        [
          categoryId,
          item.title,
          item.body,
          JSON.stringify(item.keyPoints),
          item.staticGk,
          item.sourceUrl,
          item.sourceName,
          item.sourcePublishedAt ?? null,
          item.priorityLevel,
          item.tags,
          JSON.stringify(item.targetExams),
          contentHash,
          approvalStatus,
          item.status,
          publishedAt,
          req.session.userId,
        ],
      );
      importedArticles += 1;

      for (const q of item.questions) {
        await client.query(
          `INSERT INTO current_affairs_questions
             (affair_id, question_text, options, correct_answer, explanation)
           VALUES ($1, $2, $3::jsonb, $4, $5)`,
          [inserted.rows[0].id, q.questionText, JSON.stringify(q.options), q.correctAnswer, q.explanation],
        );
        importedQuestions += 1;
      }
    }
    await client.query("COMMIT");
    await audit(
      req.session.userId,
      "current_affairs.bulk_import",
      "current_affairs",
      null,
      { importedArticles, skippedArticles, importedQuestions, totalSubmitted: items.length },
      req.ip,
    );
    res.status(201).json({
      success: true,
      importedArticles,
      skippedArticles,
      importedQuestions,
      message: `Imported ${importedArticles} articles and ${importedQuestions} quiz questions (${skippedArticles} duplicates skipped).`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

currentAffairsAdminRouter.post("/current-affairs/fetch-feeds", async (req, res) => {
  const input = z
    .object({
      sources: z.array(z.enum(["rbi", "pib"])).min(1).default(["rbi", "pib"]),
      limitPerSource: z.number().int().min(1).max(20).default(8),
    })
    .parse(req.body ?? {});

  const { items, reports, errors } = await fetchOfficialCaDrafts(input);
  const catRows = await pool.query("SELECT id, name FROM current_affairs_categories");
  const catMap = new Map(catRows.rows.map((c) => [c.name.toLowerCase(), c.id]));
  const fallbackCatId = catRows.rows[0]?.id;

  const perFeedCounters = new Map(
    reports.map((r) => [
      r.feedKey,
      { newCount: 0, duplicateCount: r.duplicateInBatchCount || 0, rejectedCount: r.rejectedCount || 0 },
    ]),
  );

  let insertedCount = 0;
  let skippedCount = 0;
  let failedItemCount = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < items.length; idx += 1) {
      const item = items[idx];
      const spName = `ca_feed_item_${idx}`;
      const counter = perFeedCounters.get(item.feedKey) || {
        newCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
      };
      try {
        await client.query(`SAVEPOINT ${spName}`);
        const dup = await client.query(
          `SELECT id FROM current_affairs
           WHERE ($1 <> '' AND source_url = $1)
              OR ($2 <> '' AND content_hash = $2)
              OR lower(title) = lower($3)
           LIMIT 1`,
          [item.sourceUrl, item.contentHash, item.title],
        );
        if (dup.rowCount) {
          skippedCount += 1;
          counter.duplicateCount += 1;
          await client.query(`RELEASE SAVEPOINT ${spName}`);
          continue;
        }

        const categoryId = catMap.get(item.categoryName.toLowerCase()) || fallbackCatId;
        await client.query(
          `INSERT INTO current_affairs
             (category_id, title, body, source_url, source_name, source_published_at,
              content_hash, verification_status, approval_status, status, published_at, created_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'unverified', 'pending', 'draft', NULL, $8, now())`,
          [
            categoryId,
            item.title,
            item.body,
            item.sourceUrl,
            item.sourceName || "",
            item.sourcePublishedAt ?? null,
            item.contentHash,
            req.session.userId,
          ],
        );
        insertedCount += 1;
        counter.newCount += 1;
        await client.query(`RELEASE SAVEPOINT ${spName}`);
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
        failedItemCount += 1;
        counter.rejectedCount += 1;
      }
    }

    for (const r of reports) {
      const c = perFeedCounters.get(r.feedKey) || { newCount: 0, duplicateCount: 0, rejectedCount: 0 };
      await client.query(
        `INSERT INTO current_affairs_feed_runs
           (feed_key, feed_name, triggered_by, status, discovered_count, new_count,
            duplicate_count, rejected_count, error_message, last_successful_fetch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          r.feedKey,
          r.feedName,
          req.session.userId,
          r.status,
          r.discoveredCount,
          c.newCount,
          c.duplicateCount,
          c.rejectedCount,
          r.error || "",
          r.lastSuccessfulFetch,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await audit(
    req.session.userId,
    "current_affairs.fetch_feeds",
    "current_affairs",
    null,
    {
      sources: input.sources,
      insertedCount,
      skippedCount,
      failedItemCount,
      feedStatuses: reports.map((r) => ({ feedKey: r.feedKey, status: r.status })),
    },
    req.ip,
  );

  res.json({
    success: true,
    insertedCount,
    skippedCount,
    failedItemCount,
    reports: reports.map((r) => {
      const c = perFeedCounters.get(r.feedKey) || { newCount: 0, duplicateCount: 0, rejectedCount: 0 };
      return {
        ...r,
        newCount: c.newCount,
        duplicateCount: c.duplicateCount,
        rejectedCount: c.rejectedCount,
      };
    }),
    errors,
    message: `Fetched ${insertedCount} new draft(s) (${skippedCount} duplicates skipped).`,
  });
});

// ============================================================================
// 3. ARTICLE MANAGEMENT (List, Detail, Create, Update, Status, Safe Delete)
// ============================================================================

currentAffairsAdminRouter.get("/current-affairs", async (req, res) => {
  const q = adminListQuerySchema.parse(req.query);
  const rawCategoryId = q.categoryId || null;
  if (rawCategoryId && !isValidUuid(rawCategoryId)) {
    return res.status(400).json({ error: "Invalid categoryId parameter." });
  }
  const statusFilter = q.status === "all" ? null : q.status;
  const searchPattern = q.q ? `%${q.q.replace(/[%_]/g, "\\$&")}%` : null;
  const sourcePattern = q.source ? `%${q.source.replace(/[%_]/g, "\\$&")}%` : null;
  const dateFrom = q.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(q.dateFrom) ? `${q.dateFrom}T00:00:00+05:30` : null;
  const dateTo = q.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(q.dateTo) ? `${q.dateTo}T23:59:59+05:30` : null;
  const offset = (q.page - 1) * q.limit;

  const orderByMap = {
    newest: "COALESCE(ca.published_at, ca.created_at) DESC, ca.created_at DESC",
    oldest: "COALESCE(ca.published_at, ca.created_at) ASC, ca.created_at ASC",
    updated: "COALESCE(ca.updated_at, ca.created_at) DESC",
    title: "lower(ca.title) ASC",
  };
  const orderBy = orderByMap[q.sort] || orderByMap.newest;

  const filterParams = [rawCategoryId, statusFilter, searchPattern, sourcePattern, dateFrom, dateTo];
  const whereClause = `
    WHERE ($1::uuid IS NULL OR ca.category_id = $1)
      AND ($2::text IS NULL OR ca.status = $2)
      AND ($3::text IS NULL OR ca.title ILIKE $3 ESCAPE '\\' OR ca.body ILIKE $3 ESCAPE '\\' OR ca.static_gk ILIKE $3 ESCAPE '\\')
      AND ($4::text IS NULL OR ca.source_name ILIKE $4 ESCAPE '\\' OR ca.source_url ILIKE $4 ESCAPE '\\')
      AND ($5::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) >= $5)
      AND ($6::timestamptz IS NULL OR COALESCE(ca.published_at, ca.created_at) <= $6)
  `;

  const [categoriesRes, stats, countRes, itemsRes] = await Promise.all([
    pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.icon, c.sort_order,
             COALESCE(c.is_active, TRUE) AS is_active,
             COALESCE(c.is_featured, FALSE) AS is_featured,
             count(ca.id)::int AS article_count
      FROM current_affairs_categories c
      LEFT JOIN current_affairs ca ON ca.category_id = c.id
      GROUP BY c.id
      ORDER BY COALESCE(c.sort_order, 0) ASC, c.name ASC
    `),
    fetchAdminStats(),
    pool.query(`SELECT count(*)::int AS total FROM current_affairs ca ${whereClause}`, filterParams),
    pool.query(
      `SELECT
         ca.*, cat.name AS category,
         COALESCE(qc.mcq_count, 0)::int AS mcq_count
       FROM current_affairs ca
       JOIN current_affairs_categories cat ON cat.id = ca.category_id
       LEFT JOIN (
         SELECT affair_id, count(*)::int AS mcq_count
         FROM current_affairs_questions
         GROUP BY affair_id
       ) qc ON qc.affair_id = ca.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $7 OFFSET $8`,
      [...filterParams, q.limit, offset],
    ),
  ]);

  const pagination = buildPaginationMeta({
    page: q.page,
    limit: q.limit,
    total: countRes.rows[0]?.total ?? 0,
  });

  res.json({
    success: true,
    categories: categoriesRes.rows,
    items: itemsRes.rows,
    data: itemsRes.rows,
    stats,
    pagination,
  });
});

currentAffairsAdminRouter.get("/current-affairs/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const [articleRes, questionsRes] = await Promise.all([
    pool.query(
      `SELECT ca.*, cat.name AS category
       FROM current_affairs ca
       JOIN current_affairs_categories cat ON cat.id = ca.category_id
       WHERE ca.id = $1`,
      [req.params.id],
    ),
    pool.query(
      `SELECT q.id, q.affair_id, q.question_text, q.options, q.correct_answer, q.explanation,
              count(a.student_id)::int AS answer_count
       FROM current_affairs_questions q
       LEFT JOIN current_affairs_answers a ON a.question_id = q.id
       WHERE q.affair_id = $1
       GROUP BY q.id
       ORDER BY q.id`,
      [req.params.id],
    ),
  ]);
  if (!articleRes.rowCount) {
    return res.status(404).json({ error: "Current affairs item not found." });
  }
  res.json({
    success: true,
    item: articleRes.rows[0],
    questions: questionsRes.rows,
    data: { ...articleRes.rows[0], questions: questionsRes.rows },
  });
});

currentAffairsAdminRouter.post("/current-affairs", async (req, res) => {
  const input = z
    .object({
      ...caArticleFields,
      status: z.enum(["draft", "published", "archived"]).default("draft"),
    })
    .parse(req.body);

  const normalizedUrl = input.sourceUrl ?? "";
  const contentHash = computeArticleContentHash({ title: input.title, body: input.body });
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : input.status === "published"
        ? new Date().toISOString()
        : null;
  const approvalStatus = input.approvalStatus ?? (input.status === "published" ? "approved" : "pending");

  const row = await pool.query(
    `INSERT INTO current_affairs
      (category_id, title, body, key_points, static_gk, source_url, source_name,
       source_published_at, priority_level, tags, target_exams,
       verification_status, approval_status, content_hash, status, published_at, created_by, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::text[], $11::jsonb, $12, $13, $14, $15, $16, $17, now())
     RETURNING *`,
    [
      input.categoryId,
      input.title,
      input.body,
      JSON.stringify(input.keyPoints ?? []),
      input.staticGk ?? "",
      normalizedUrl,
      input.sourceName ?? "",
      input.sourcePublishedAt ?? null,
      input.priorityLevel ?? "important",
      input.tags ?? [],
      JSON.stringify(input.targetExams ?? []),
      input.verificationStatus ?? "unverified",
      approvalStatus,
      contentHash,
      input.status,
      publishedAt,
      req.session.userId,
    ],
  );
  await audit(
    req.session.userId,
    "current_affairs.create",
    "current_affairs",
    row.rows[0].id,
    { status: input.status, hasSourceUrl: Boolean(normalizedUrl), sourceName: input.sourceName ?? "" },
    req.ip,
  );
  res.status(201).json({ success: true, item: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.put("/current-affairs/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const input = z
    .object({
      ...caArticleFields,
      status: z.enum(["draft", "published", "archived"]),
    })
    .parse(req.body);

  const contentHash = computeArticleContentHash({ title: input.title, body: input.body });
  const publishedAt =
    input.publishedAt !== undefined
      ? input.publishedAt
      : input.status === "published"
        ? new Date().toISOString()
        : null;

  const row = await pool.query(
    `UPDATE current_affairs
     SET category_id = $2,
         title = $3,
         body = $4,
         key_points = COALESCE($5::jsonb, key_points),
         static_gk = COALESCE($6, static_gk),
         source_url = COALESCE($7, source_url),
         source_name = COALESCE($8, source_name),
         source_published_at = COALESCE($9, source_published_at),
         priority_level = COALESCE($10, priority_level),
         tags = COALESCE($11::text[], tags),
         target_exams = COALESCE($12::jsonb, target_exams),
         verification_status = COALESCE($13, verification_status),
         approval_status = COALESCE($14, approval_status),
         content_hash = $15,
         status = $16,
         published_at = COALESCE($17, published_at),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      input.categoryId,
      input.title,
      input.body,
      input.keyPoints !== undefined ? JSON.stringify(input.keyPoints) : null,
      input.staticGk !== undefined ? input.staticGk : null,
      input.sourceUrl !== undefined ? input.sourceUrl : null,
      input.sourceName !== undefined ? input.sourceName : null,
      input.sourcePublishedAt !== undefined ? input.sourcePublishedAt : null,
      input.priorityLevel ?? null,
      input.tags ?? null,
      input.targetExams !== undefined ? JSON.stringify(input.targetExams) : null,
      input.verificationStatus ?? null,
      input.approvalStatus ?? null,
      contentHash,
      input.status,
      publishedAt,
    ],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Current affairs item not found." });
  }
  await audit(
    req.session.userId,
    input.status === "archived" ? "current_affairs.archive" : "current_affairs.update",
    "current_affairs",
    req.params.id,
    { status: input.status, hasSourceUrl: Boolean(row.rows[0].source_url) },
    req.ip,
  );
  res.json({ success: true, item: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.patch("/current-affairs/:id/status", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const { status } = z.object({ status: z.enum(["draft", "published", "archived"]) }).parse(req.body);
  const row = await pool.query(
    `UPDATE current_affairs
     SET status = $2,
         published_at = CASE
           WHEN $2 = 'published' AND published_at IS NULL THEN now()
           ELSE published_at
         END,
         approval_status = CASE
           WHEN $2 = 'published' THEN 'approved'
           ELSE approval_status
         END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [req.params.id, status],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Current affairs item not found." });
  }
  const actionMap = {
    published: "current_affairs.publish",
    archived: "current_affairs.archive",
    draft: "current_affairs.restore_draft",
  };
  await audit(
    req.session.userId,
    actionMap[status],
    "current_affairs",
    req.params.id,
    { status },
    req.ip,
  );
  res.json({ success: true, item: row.rows[0], data: row.rows[0] });
});

// Safe Delete: archives instead of deleting if student reads/bookmarks/answers exist
currentAffairsAdminRouter.delete("/current-affairs/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const existing = await pool.query("SELECT id, title, status FROM current_affairs WHERE id = $1", [
    req.params.id,
  ]);
  if (!existing.rowCount) {
    return res.status(404).json({ error: "Current affairs item not found." });
  }

  const [readsRes, answersRes] = await Promise.all([
    pool.query("SELECT count(*)::int AS cnt FROM current_affairs_reads WHERE affair_id = $1", [
      req.params.id,
    ]),
    pool.query(
      `SELECT count(*)::int AS cnt
       FROM current_affairs_answers a
       JOIN current_affairs_questions q ON q.id = a.question_id
       WHERE q.affair_id = $1`,
      [req.params.id],
    ),
  ]);

  const studentReads = readsRes.rows[0]?.cnt ?? 0;
  const studentAnswers = answersRes.rows[0]?.cnt ?? 0;

  if (studentReads > 0 || studentAnswers > 0) {
    const archived = await pool.query(
      `UPDATE current_affairs
       SET status = 'archived', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id],
    );
    await audit(
      req.session.userId,
      "current_affairs.safe_archive",
      "current_affairs",
      req.params.id,
      { reason: "student_records_preserved", studentReads, studentAnswers },
      req.ip,
    );
    return res.json({
      success: true,
      deleted: false,
      archived: true,
      item: archived.rows[0],
      message: `Article has ${studentReads} student read/bookmark record(s) and ${studentAnswers} answer(s), so it was archived instead of permanently deleted.`,
    });
  }

  await pool.query("DELETE FROM current_affairs WHERE id = $1", [req.params.id]);
  await audit(
    req.session.userId,
    "current_affairs.delete",
    "current_affairs",
    req.params.id,
    { title: existing.rows[0].title },
    req.ip,
  );
  res.json({
    success: true,
    deleted: true,
    archived: false,
    id: req.params.id,
    message: "Article permanently deleted.",
  });
});

// ============================================================================
// 4. COMPLETE MCQ MANAGEMENT (List, Create, Edit, Safe Delete)
// ============================================================================

currentAffairsAdminRouter.get("/current-affairs/:id/questions", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const rows = await pool.query(
    `SELECT q.id, q.affair_id, q.question_text, q.options, q.correct_answer, q.explanation,
            count(a.student_id)::int AS answer_count
     FROM current_affairs_questions q
     LEFT JOIN current_affairs_answers a ON a.question_id = q.id
     WHERE q.affair_id = $1
     GROUP BY q.id
     ORDER BY q.id`,
    [req.params.id],
  );
  res.json({ success: true, questions: rows.rows, data: rows.rows });
});

currentAffairsAdminRouter.post("/current-affairs/:id/questions", async (req, res) => {
  if (!isValidUuid(req.params.id)) {
    return res.status(400).json({ error: "Invalid current affairs article ID." });
  }
  const input = questionSchema.parse(req.body);
  const row = await pool.query(
    `INSERT INTO current_affairs_questions
      (affair_id, question_text, options, correct_answer, explanation)
     SELECT id, $2, $3::jsonb, $4, $5
     FROM current_affairs
     WHERE id = $1
     RETURNING id, affair_id, question_text, options, correct_answer, explanation`,
    [
      req.params.id,
      input.questionText,
      JSON.stringify(input.options),
      input.correctAnswer,
      input.explanation,
    ],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Current affairs item not found." });
  }
  await audit(
    req.session.userId,
    "current_affairs.question.create",
    "current_affairs_question",
    row.rows[0].id,
    { affairId: req.params.id, optionCount: input.options.length },
    req.ip,
  );
  res.status(201).json({ success: true, question: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.put("/current-affairs/:id/questions/:questionId", async (req, res) => {
  if (!isValidUuid(req.params.id) || !isValidUuid(req.params.questionId)) {
    return res.status(400).json({ error: "Invalid article or question ID." });
  }
  const input = questionSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE current_affairs_questions
     SET question_text = $3,
         options = $4::jsonb,
         correct_answer = $5,
         explanation = $6
     WHERE id = $2 AND affair_id = $1
     RETURNING id, affair_id, question_text, options, correct_answer, explanation`,
    [
      req.params.id,
      req.params.questionId,
      input.questionText,
      JSON.stringify(input.options),
      input.correctAnswer,
      input.explanation,
    ],
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Quiz question not found for this article." });
  }
  await audit(
    req.session.userId,
    "current_affairs.question.update",
    "current_affairs_question",
    req.params.questionId,
    { affairId: req.params.id },
    req.ip,
  );
  res.json({ success: true, question: row.rows[0], data: row.rows[0] });
});

currentAffairsAdminRouter.delete("/current-affairs/:id/questions/:questionId", async (req, res) => {
  if (!isValidUuid(req.params.id) || !isValidUuid(req.params.questionId)) {
    return res.status(400).json({ error: "Invalid article or question ID." });
  }
  const ansCheck = await pool.query(
    "SELECT count(*)::int AS cnt FROM current_affairs_answers WHERE question_id = $1",
    [req.params.questionId],
  );
  const answerCount = ansCheck.rows[0]?.cnt ?? 0;
  if (answerCount > 0) {
    return res.status(409).json({
      error: `Cannot delete this question because ${answerCount} student answer record(s) depend on it. Edit the question or archive the parent article instead.`,
    });
  }

  const deleted = await pool.query(
    "DELETE FROM current_affairs_questions WHERE id = $2 AND affair_id = $1 RETURNING id",
    [req.params.id, req.params.questionId],
  );
  if (!deleted.rowCount) {
    return res.status(404).json({ error: "Quiz question not found for this article." });
  }
  await audit(
    req.session.userId,
    "current_affairs.question.delete",
    "current_affairs_question",
    req.params.questionId,
    { affairId: req.params.id },
    req.ip,
  );
  res.json({ success: true, deleted: true, id: req.params.questionId });
});
