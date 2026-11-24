import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  attachFreshness,
  getCachedPublished,
  setCachedPublished,
} from "../services/bankingFreshness.js";
import { buildPaginationMeta } from "./currentAffairsStudent.js";

export const bankingAwarenessStudentRouter = Router();
bankingAwarenessStudentRouter.use(requireAuth);

const listPagingSchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function escapeLike(q) {
  return q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
}

// 1. Overview (cached read-only published summary; invalidated on any admin change)
bankingAwarenessStudentRouter.get("/overview", async (_req, res) => {
  const cached = getCachedPublished("student:overview");
  if (cached) {
    return res.json(cached);
  }

  const [ratesRes, limitsRes, instRes, regRes, leadersRes, gkRes, termCountRes] =
    await Promise.all([
      pool.query(`
        SELECT DISTINCT ON (lower(rate_code))
          id, rate_code, rate_name, rate_value, unit, effective_date,
          previous_value, change_value, announcement_note,
          source_name, source_url, source_published_at, verified_at, status, updated_at
        FROM banking_policy_rates
        WHERE status = 'published' AND effective_date <= CURRENT_DATE
        ORDER BY lower(rate_code), effective_date DESC, updated_at DESC
      `),
      pool.query(`
        SELECT id, title, category, value, unit, applicable_to, effective_from, effective_until,
               source_name, source_url, verified_at, status, updated_at
        FROM banking_limits
        WHERE status = 'published' AND (effective_until IS NULL OR effective_until >= CURRENT_DATE)
        ORDER BY updated_at DESC
        LIMIT 8
      `),
      pool.query(`
        SELECT id, institution_name, short_name, institution_type, established_year, headquarters,
               official_website, verified_at, status
        FROM banking_institutions
        WHERE status = 'published'
        ORDER BY institution_name ASC
        LIMIT 8
      `),
      pool.query(
        "SELECT count(*)::int AS total FROM banking_regulatory_bodies WHERE status = 'published'",
      ),
      pool.query(`
        SELECT id, person_name, designation, organization_name, appointment_date,
               source_name, source_url, verified_at, status, updated_at
        FROM banking_leaders
        WHERE status = 'published' AND end_date IS NULL
        ORDER BY appointment_date DESC NULLS LAST, person_name ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT id, title, topic, description, importance_level, target_exams,
               source_name, source_url, verified_at, status, updated_at
        FROM banking_static_gk
        WHERE status = 'published'
        ORDER BY updated_at DESC
        LIMIT 6
      `),
      pool.query(
        "SELECT count(*)::int AS total FROM banking_terminology WHERE status = 'published'",
      ),
    ]);

  const now = new Date();
  const payload = {
    success: true,
    data: {
      currentRates: ratesRes.rows.map((r) => attachFreshness(r, "rates", now)),
      keyLimits: limitsRes.rows.map((r) => attachFreshness(r, "limits", now)),
      institutions: instRes.rows.map((r) => attachFreshness(r, "institutions", now)),
      currentLeaders: leadersRes.rows.map((r) => attachFreshness(r, "leaders", now)),
      staticGkHighlights: gkRes.rows.map((r) => attachFreshness(r, "static_gk", now)),
      counts: {
        rates: ratesRes.rows.length,
        limits: limitsRes.rows.length,
        institutions: instRes.rows.length,
        regulatoryBodies: regRes.rows[0]?.total ?? 0,
        leaders: leadersRes.rows.length,
        terminology: termCountRes.rows[0]?.total ?? 0,
      },
    },
  };

  setCachedPublished("student:overview", payload);
  res.json(payload);
});

// 2. RBI Policy Rates (Current + Historical)
bankingAwarenessStudentRouter.get("/rates", async (req, res) => {
  const q = escapeLike(req.query.q ? String(req.query.q).trim() : "");
  const [currentRes, historyRes] = await Promise.all([
    pool.query(
      `SELECT DISTINCT ON (lower(rate_code))
         id, rate_code, rate_name, rate_value, unit, effective_date,
         previous_value, change_value, announcement_note,
         source_name, source_url, source_published_at, verified_at, status, updated_at
       FROM banking_policy_rates
       WHERE status = 'published'
         AND effective_date <= CURRENT_DATE
         AND ($1::text IS NULL OR rate_name ILIKE $1 ESCAPE '\\' OR rate_code ILIKE $1 ESCAPE '\\')
       ORDER BY lower(rate_code), effective_date DESC, updated_at DESC`,
      [q],
    ),
    pool.query(
      `SELECT id, rate_code, rate_name, rate_value, unit, effective_date,
              previous_value, change_value, announcement_note,
              source_name, source_url, source_published_at, verified_at, status, updated_at
       FROM banking_policy_rates
       WHERE status IN ('published', 'archived')
         AND ($1::text IS NULL OR rate_name ILIKE $1 ESCAPE '\\' OR rate_code ILIKE $1 ESCAPE '\\')
       ORDER BY effective_date DESC, updated_at DESC
       LIMIT 200`,
      [q],
    ),
  ]);

  const now = new Date();
  res.json({
    success: true,
    currentRates: currentRes.rows.map((r) => attachFreshness(r, "rates", now)),
    history: historyRes.rows.map((r) => attachFreshness(r, "rates", now)),
  });
});

bankingAwarenessStudentRouter.get("/rates/history/:rateCode", async (req, res) => {
  const rateCode = String(req.params.rateCode || "").trim();
  if (!rateCode || rateCode.length > 40) {
    return res.status(400).json({ error: "Invalid rate code." });
  }
  const rows = await pool.query(
    `SELECT id, rate_code, rate_name, rate_value, unit, effective_date,
            previous_value, change_value, announcement_note,
            source_name, source_url, source_published_at, verified_at, status, updated_at
     FROM banking_policy_rates
     WHERE lower(rate_code) = lower($1) AND status IN ('published', 'archived')
     ORDER BY effective_date DESC, updated_at DESC
     LIMIT 100`,
    [rateCode],
  );
  const now = new Date();
  res.json({
    success: true,
    history: rows.rows.map((r) => attachFreshness(r, "rates", now)),
  });
});

bankingAwarenessStudentRouter.get("/rates/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid rate ID." });
  const row = await pool.query(
    "SELECT * FROM banking_policy_rates WHERE id = $1 AND status IN ('published', 'archived')",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Rate record not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "rates") });
});

// 3. Banking Limits
bankingAwarenessStudentRouter.get("/limits", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const category = req.query.category ? String(req.query.category).trim() : null;
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const params = [search, category];
  const where = `
    WHERE status = 'published'
      AND ($1::text IS NULL OR title ILIKE $1 ESCAPE '\\' OR description ILIKE $1 ESCAPE '\\' OR applicable_to ILIKE $1 ESCAPE '\\')
      AND ($2::text IS NULL OR category = $2)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_limits ${where}`, params),
    pool.query(
      `SELECT * FROM banking_limits ${where}
       ORDER BY category ASC, title ASC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    items: rows.rows.map((r) => attachFreshness(r, "limits", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/limits/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid limit ID." });
  const row = await pool.query(
    "SELECT * FROM banking_limits WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Banking limit not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "limits") });
});

// 4. Banking Institutions Directory
bankingAwarenessStudentRouter.get("/institutions", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const institutionType = req.query.type ? String(req.query.type).trim() : null;
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const params = [search, institutionType];
  const where = `
    WHERE status = 'published'
      AND ($1::text IS NULL OR institution_name ILIKE $1 ESCAPE '\\' OR short_name ILIKE $1 ESCAPE '\\' OR headquarters ILIKE $1 ESCAPE '\\' OR description ILIKE $1 ESCAPE '\\')
      AND ($2::text IS NULL OR institution_type = $2)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_institutions ${where}`, params),
    pool.query(
      `SELECT * FROM banking_institutions ${where}
       ORDER BY institution_name ASC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    items: rows.rows.map((r) => attachFreshness(r, "institutions", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/institutions/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid institution ID." });
  const row = await pool.query(
    "SELECT * FROM banking_institutions WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Institution not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "institutions") });
});

// 5. Regulatory Bodies Directory
bankingAwarenessStudentRouter.get("/regulatory-bodies", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const sector = req.query.sector ? String(req.query.sector).trim() : null;
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const params = [search, sector];
  const where = `
    WHERE status = 'published'
      AND ($1::text IS NULL OR organization_name ILIKE $1 ESCAPE '\\' OR short_name ILIKE $1 ESCAPE '\\' OR regulatory_domain ILIKE $1 ESCAPE '\\' OR responsibilities ILIKE $1 ESCAPE '\\')
      AND ($2::text IS NULL OR applicable_sector = $2)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_regulatory_bodies ${where}`, params),
    pool.query(
      `SELECT * FROM banking_regulatory_bodies ${where}
       ORDER BY organization_name ASC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    items: rows.rows.map((r) => attachFreshness(r, "regulatory_bodies", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/regulatory-bodies/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid regulatory body ID." });
  const row = await pool.query(
    "SELECT * FROM banking_regulatory_bodies WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Regulatory body not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "regulatory_bodies") });
});

// 6. Banking Leaders (Current vs Historical)
bankingAwarenessStudentRouter.get("/leaders", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const scope = req.query.scope === "historical" ? "historical" : "current";
  const orgId = req.query.organizationId ? String(req.query.organizationId).trim() : null;
  if (orgId && !isValidUuid(orgId)) {
    return res.status(400).json({ error: "Invalid organizationId parameter." });
  }
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const scopeSql =
    scope === "historical"
      ? "(l.status = 'archived' OR (l.status = 'published' AND l.end_date IS NOT NULL))"
      : "(l.status = 'published' AND l.end_date IS NULL)";

  const params = [search, orgId];
  const where = `
    WHERE ${scopeSql}
      AND ($1::text IS NULL OR l.person_name ILIKE $1 ESCAPE '\\' OR l.designation ILIKE $1 ESCAPE '\\' OR l.organization_name ILIKE $1 ESCAPE '\\')
      AND ($2::uuid IS NULL OR l.organization_id = $2)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_leaders l ${where}`, params),
    pool.query(
      `SELECT l.*, COALESCE(NULLIF(l.organization_name, ''), bi.institution_name, '') AS resolved_organization
       FROM banking_leaders l
       LEFT JOIN banking_institutions bi ON bi.id = l.organization_id
       ${where}
       ORDER BY l.appointment_date DESC NULLS LAST, l.person_name ASC
       LIMIT $3 OFFSET $4`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    scope,
    items: rows.rows.map((r) => attachFreshness(r, "leaders", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/leaders/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid leader ID." });
  const row = await pool.query(
    "SELECT * FROM banking_leaders WHERE id = $1 AND status IN ('published', 'archived')",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Leader record not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "leaders") });
});

// 7. Banking Static GK
bankingAwarenessStudentRouter.get("/static-gk", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const topic = req.query.topic ? String(req.query.topic).trim() : null;
  const exam = req.query.exam ? String(req.query.exam).trim() : null;
  const importance = req.query.importance ? String(req.query.importance).trim() : null;
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const params = [search, topic, exam ? JSON.stringify([exam]) : null, importance];
  const where = `
    WHERE status = 'published'
      AND ($1::text IS NULL OR title ILIKE $1 ESCAPE '\\' OR description ILIKE $1 ESCAPE '\\' OR topic ILIKE $1 ESCAPE '\\')
      AND ($2::text IS NULL OR topic = $2)
      AND ($3::jsonb IS NULL OR target_exams @> $3::jsonb)
      AND ($4::text IS NULL OR importance_level = $4)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_static_gk ${where}`, params),
    pool.query(
      `SELECT * FROM banking_static_gk ${where}
       ORDER BY topic ASC, title ASC
       LIMIT $5 OFFSET $6`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    items: rows.rows.map((r) => attachFreshness(r, "static_gk", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/static-gk/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid static GK ID." });
  const row = await pool.query(
    "SELECT * FROM banking_static_gk WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Static GK record not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "static_gk") });
});

// 8. Banking Terminology (A-Z Glossary)
bankingAwarenessStudentRouter.get("/terminology", async (req, res) => {
  const { q, page, limit } = listPagingSchema.parse(req.query);
  const letter =
    req.query.letter && /^[A-Za-z]$/.test(String(req.query.letter).trim())
      ? `${String(req.query.letter).trim().toUpperCase()}%`
      : null;
  const category = req.query.category ? String(req.query.category).trim() : null;
  const search = escapeLike(q);
  const offset = (page - 1) * limit;

  const params = [search, letter, category];
  const where = `
    WHERE status = 'published'
      AND ($1::text IS NULL OR term ILIKE $1 ESCAPE '\\' OR abbreviation ILIKE $1 ESCAPE '\\' OR full_form ILIKE $1 ESCAPE '\\' OR definition ILIKE $1 ESCAPE '\\')
      AND ($2::text IS NULL OR term ILIKE $2 OR abbreviation ILIKE $2)
      AND ($3::text IS NULL OR category = $3)
  `;
  const [cnt, rows] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM banking_terminology ${where}`, params),
    pool.query(
      `SELECT * FROM banking_terminology ${where}
       ORDER BY lower(term) ASC
       LIMIT $4 OFFSET $5`,
      [...params, limit, offset],
    ),
  ]);
  const now = new Date();
  res.json({
    success: true,
    items: rows.rows.map((r) => attachFreshness(r, "terminology", now)),
    pagination: buildPaginationMeta({ page, limit, total: cnt.rows[0]?.total ?? 0 }),
  });
});

bankingAwarenessStudentRouter.get("/terminology/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid terminology ID." });
  const row = await pool.query(
    "SELECT * FROM banking_terminology WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Terminology entry not found." });
  res.json({ success: true, item: attachFreshness(row.rows[0], "terminology") });
});
