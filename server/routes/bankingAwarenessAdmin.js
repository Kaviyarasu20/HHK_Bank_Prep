import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import {
  isValidUuid,
  validateAndNormalizeSourceUrl,
} from "../services/caUrlSecurity.js";
import {
  attachFreshness,
  invalidateBankingCache,
  VERIFICATION_INTERVAL_DAYS,
} from "../services/bankingFreshness.js";

export const bankingAwarenessAdminRouter = Router();
bankingAwarenessAdminRouter.use(requireAdmin);

const STATUS_ENUM = z.enum([
  "draft",
  "pending_review",
  "approved",
  "published",
  "archived",
  "rejected",
]);

const IMPORTANCE_ENUM = z.enum(["must_study", "important", "additional"]);

const safeUrlSchema = z
  .string()
  .trim()
  .max(500)
  .default("")
  .superRefine((val, ctx) => {
    const check = validateAndNormalizeSourceUrl(val, { allowEmpty: true });
    if (!check.ok) ctx.addIssue({ code: "custom", message: check.error });
  })
  .transform((val) => validateAndNormalizeSourceUrl(val, { allowEmpty: true }).url);

const isoDateOptional = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, type, id, JSON.stringify(details), ip || null],
  );
}

// ============================================================================
// 1. REAL DATABASE STATS & DATA FRESHNESS ALERTS
// ============================================================================

bankingAwarenessAdminRouter.get("/stats", async (_req, res) => {
  const [rates, limits, inst, reg, leaders, gk, term] = await Promise.all([
    pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'published')::int AS active,
        count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending,
        count(*) FILTER (WHERE status = 'published' AND (verified_at IS NULL OR verified_at < now() - interval '${VERIFICATION_INTERVAL_DAYS.rates} days'))::int AS needs_verification
      FROM banking_policy_rates
    `),
    pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending,
        count(*) FILTER (WHERE status = 'published' AND (verified_at IS NULL OR verified_at < now() - interval '${VERIFICATION_INTERVAL_DAYS.limits} days' OR (effective_until IS NOT NULL AND effective_until < CURRENT_DATE)))::int AS needs_verification
      FROM banking_limits
    `),
    pool.query(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending
      FROM banking_institutions
    `),
    pool.query(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending
      FROM banking_regulatory_bodies
    `),
    pool.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'published' AND end_date IS NULL)::int AS current_leaders,
        count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending,
        count(*) FILTER (WHERE status = 'published' AND end_date IS NULL AND (verified_at IS NULL OR verified_at < now() - interval '${VERIFICATION_INTERVAL_DAYS.leaders} days'))::int AS needs_verification
      FROM banking_leaders
    `),
    pool.query(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending
      FROM banking_static_gk
    `),
    pool.query(`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('draft', 'pending_review'))::int AS pending
      FROM banking_terminology
    `),
  ]);

  const r = rates.rows[0] || {};
  const l = limits.rows[0] || {};
  const i = inst.rows[0] || {};
  const rb = reg.rows[0] || {};
  const ld = leaders.rows[0] || {};
  const g = gk.rows[0] || {};
  const t = term.rows[0] || {};

  const stats = {
    totalRates: r.total ?? 0,
    activeRates: r.active ?? 0,
    totalLimits: l.total ?? 0,
    totalInstitutions: i.total ?? 0,
    totalRegulatoryBodies: rb.total ?? 0,
    currentLeaders: ld.current_leaders ?? 0,
    totalStaticGk: g.total ?? 0,
    totalTerminology: t.total ?? 0,
    pendingApprovals:
      (r.pending ?? 0) +
      (l.pending ?? 0) +
      (i.pending ?? 0) +
      (rb.pending ?? 0) +
      (ld.pending ?? 0) +
      (g.pending ?? 0) +
      (t.pending ?? 0),
    needsVerification:
      (r.needs_verification ?? 0) +
      (l.needs_verification ?? 0) +
      (ld.needs_verification ?? 0),
  };

  res.json({ success: true, stats, data: stats });
});

bankingAwarenessAdminRouter.get("/alerts", async (_req, res) => {
  const [overdueRates, expiredLimits, missingSources] = await Promise.all([
    pool.query(`
      SELECT id, rate_name AS title, 'rates' AS entity, status, verified_at, effective_date
      FROM banking_policy_rates
      WHERE status = 'published'
        AND (verified_at IS NULL OR verified_at < now() - interval '${VERIFICATION_INTERVAL_DAYS.rates} days')
      ORDER BY effective_date DESC
      LIMIT 25
    `),
    pool.query(`
      SELECT id, title, 'limits' AS entity, status, effective_until
      FROM banking_limits
      WHERE status = 'published' AND effective_until IS NOT NULL AND effective_until < CURRENT_DATE
      LIMIT 25
    `),
    pool.query(`
      SELECT id, rate_name AS title, 'rates' AS entity, status FROM banking_policy_rates WHERE source_url = '' AND status <> 'archived'
      UNION ALL
      SELECT id, title, 'limits' AS entity, status FROM banking_limits WHERE source_url = '' AND status <> 'archived'
      UNION ALL
      SELECT id, person_name || ' (' || designation || ')' AS title, 'leaders' AS entity, status FROM banking_leaders WHERE source_url = '' AND status <> 'archived'
      LIMIT 30
    `),
  ]);

  res.json({
    success: true,
    alerts: {
      overdueRates: overdueRates.rows,
      expiredLimits: expiredLimits.rows,
      missingSources: missingSources.rows,
    },
  });
});

// Helper for approval/status transitions across all 7 tables
const TABLE_MAP = {
  rates: { table: "banking_policy_rates", requireSourceOnPublish: true },
  limits: { table: "banking_limits", requireSourceOnPublish: true },
  institutions: { table: "banking_institutions", requireSourceOnPublish: false },
  "regulatory-bodies": { table: "banking_regulatory_bodies", requireSourceOnPublish: false },
  leaders: { table: "banking_leaders", requireSourceOnPublish: true },
  "static-gk": { table: "banking_static_gk", requireSourceOnPublish: false },
  terminology: { table: "banking_terminology", requireSourceOnPublish: false },
};

bankingAwarenessAdminRouter.patch("/:entity/:id/status", async (req, res) => {
  const cfg = TABLE_MAP[req.params.entity];
  if (!cfg) return res.status(404).json({ error: "Unknown banking reference entity." });
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid record ID." });

  const { status, markVerified } = z
    .object({ status: STATUS_ENUM, markVerified: z.boolean().default(false) })
    .parse(req.body);

  const existing = await pool.query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [req.params.id]);
  if (!existing.rowCount) return res.status(404).json({ error: "Reference record not found." });

  if (status === "published" && cfg.requireSourceOnPublish && !existing.rows[0].source_url) {
    return res.status(400).json({
      error: "An official source URL is required before publishing this reference record.",
    });
  }

  const updated = await pool.query(
    `UPDATE ${cfg.table}
     SET status = $2,
         verified_at = CASE WHEN $3::boolean OR $2 IN ('approved', 'published') THEN COALESCE(verified_at, now()) ELSE verified_at END,
         updated_at = now(),
         updated_by = $4
     WHERE id = $1
     RETURNING *`,
    [req.params.id, status, markVerified, req.session.userId],
  );

  invalidateBankingCache();
  await audit(
    req.session.userId,
    `banking.${req.params.entity}.status`,
    cfg.table,
    req.params.id,
    { status },
    req.ip,
  );
  res.json({ success: true, item: updated.rows[0] });
});

// ============================================================================
// 2. RBI POLICY RATES CRUD (Preserves History)
// ============================================================================

const rateSchema = z.object({
  rateCode: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase()),
  rateName: z.string().trim().min(2).max(120),
  rateValue: z.coerce.number().min(0, "Rate cannot be negative").max(100, "Rate must be <= 100%"),
  unit: z.string().trim().min(1).max(20).default("%"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be YYYY-MM-DD"),
  previousValue: z.coerce.number().min(0).max(100).nullable().optional(),
  changeValue: z.coerce.number().min(-100).max(100).nullable().optional(),
  announcementNote: z.string().trim().max(1000).default(""),
  sourceName: z.string().trim().min(2).max(120).default("Reserve Bank of India"),
  sourceUrl: safeUrlSchema,
  status: STATUS_ENUM.default("draft"),
});

bankingAwarenessAdminRouter.get("/rates", async (req, res) => {
  const status = req.query.status && req.query.status !== "all" ? String(req.query.status) : null;
  const rows = await pool.query(
    `SELECT * FROM banking_policy_rates
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY effective_date DESC, rate_code ASC
     LIMIT 250`,
    [status],
  );
  const now = new Date();
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "rates", now)) });
});

bankingAwarenessAdminRouter.post("/rates", async (req, res) => {
  const input = rateSchema.parse(req.body);
  if (input.status === "published" && !input.sourceUrl) {
    return res.status(400).json({ error: "Official RBI source URL is required to publish a rate." });
  }
  const changeVal =
    input.changeValue !== undefined && input.changeValue !== null
      ? input.changeValue
      : input.previousValue !== undefined && input.previousValue !== null
        ? Number((input.rateValue - input.previousValue).toFixed(3))
        : null;

  const row = await pool.query(
    `INSERT INTO banking_policy_rates
       (rate_code, rate_name, rate_value, unit, effective_date, previous_value, change_value,
        announcement_note, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,now())
     RETURNING *`,
    [
      input.rateCode,
      input.rateName,
      input.rateValue,
      input.unit,
      input.effectiveDate,
      input.previousValue ?? null,
      changeVal,
      input.announcementNote,
      input.sourceName,
      input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status,
      req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.rates.create", "banking_policy_rates", row.rows[0].id, {
    rateCode: input.rateCode,
    effectiveDate: input.effectiveDate,
    status: input.status,
  }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/rates/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid rate ID." });
  const input = rateSchema.parse(req.body);
  if (input.status === "published" && !input.sourceUrl) {
    return res.status(400).json({ error: "Official RBI source URL is required to publish a rate." });
  }
  const changeVal =
    input.changeValue !== undefined && input.changeValue !== null
      ? input.changeValue
      : input.previousValue !== undefined && input.previousValue !== null
        ? Number((input.rateValue - input.previousValue).toFixed(3))
        : null;

  const row = await pool.query(
    `UPDATE banking_policy_rates
     SET rate_code=$2, rate_name=$3, rate_value=$4, unit=$5, effective_date=$6,
         previous_value=$7, change_value=$8, announcement_note=$9, source_name=$10,
         source_url=$11, status=$12,
         verified_at = CASE WHEN $12 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$13, updated_at=now()
     WHERE id=$1
     RETURNING *`,
    [
      req.params.id,
      input.rateCode,
      input.rateName,
      input.rateValue,
      input.unit,
      input.effectiveDate,
      input.previousValue ?? null,
      changeVal,
      input.announcementNote,
      input.sourceName,
      input.sourceUrl,
      input.status,
      req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Rate record not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.rates.update", "banking_policy_rates", req.params.id, {
    rateCode: input.rateCode,
    status: input.status,
  }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

// ============================================================================
// 3. BANKING LIMITS CRUD
// ============================================================================

const limitSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    category: z.string().trim().min(2).max(100),
    description: z.string().trim().max(3000).default(""),
    value: z.string().trim().min(1).max(120),
    unit: z.string().trim().max(40).default(""),
    applicableTo: z.string().trim().max(200).default(""),
    effectiveFrom: isoDateOptional,
    effectiveUntil: isoDateOptional,
    examNotes: z.string().trim().max(2000).default(""),
    importanceLevel: IMPORTANCE_ENUM.default("important"),
    targetExams: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
    sourceName: z.string().trim().max(120).default(""),
    sourceUrl: safeUrlSchema,
    status: STATUS_ENUM.default("draft"),
  })
  .refine(
    (v) => !v.effectiveFrom || !v.effectiveUntil || v.effectiveUntil >= v.effectiveFrom,
    { message: "effectiveUntil must be on or after effectiveFrom." },
  );

bankingAwarenessAdminRouter.get("/limits", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM banking_limits ORDER BY updated_at DESC LIMIT 250");
  const now = new Date();
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "limits", now)) });
});

bankingAwarenessAdminRouter.post("/limits", async (req, res) => {
  const input = limitSchema.parse(req.body);
  if (input.status === "published" && !input.sourceUrl) {
    return res.status(400).json({ error: "Official source URL is required before publishing a limit." });
  }
  const row = await pool.query(
    `INSERT INTO banking_limits
       (title, category, description, value, unit, applicable_to, effective_from, effective_until,
        exam_notes, importance_level, target_exams, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$16,now())
     RETURNING *`,
    [
      input.title, input.category, input.description, input.value, input.unit, input.applicableTo,
      input.effectiveFrom ?? null, input.effectiveUntil ?? null, input.examNotes, input.importanceLevel,
      JSON.stringify(input.targetExams), input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.limits.create", "banking_limits", row.rows[0].id, { title: input.title, status: input.status }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/limits/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid limit ID." });
  const input = limitSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE banking_limits
     SET title=$2, category=$3, description=$4, value=$5, unit=$6, applicable_to=$7,
         effective_from=$8, effective_until=$9, exam_notes=$10, importance_level=$11,
         target_exams=$12::jsonb, source_name=$13, source_url=$14, status=$15,
         verified_at = CASE WHEN $15 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$16, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.title, input.category, input.description, input.value, input.unit,
      input.applicableTo, input.effectiveFrom ?? null, input.effectiveUntil ?? null, input.examNotes,
      input.importanceLevel, JSON.stringify(input.targetExams), input.sourceName, input.sourceUrl,
      input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Limit not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.limits.update", "banking_limits", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

// ============================================================================
// 4. INSTITUTIONS CRUD
// ============================================================================

const institutionSchema = z.object({
  institutionName: z.string().trim().min(2).max(180),
  shortName: z.string().trim().max(40).default(""),
  institutionType: z.string().trim().min(2).max(80),
  establishedYear: z.coerce.number().int().min(1700).max(2100).nullable().optional(),
  headquarters: z.string().trim().max(120).default(""),
  description: z.string().trim().max(4000).default(""),
  officialWebsite: safeUrlSchema,
  parentOrganization: z.string().trim().max(140).default(""),
  sourceName: z.string().trim().max(120).default(""),
  sourceUrl: safeUrlSchema,
  status: STATUS_ENUM.default("draft"),
});

bankingAwarenessAdminRouter.get("/institutions", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM banking_institutions ORDER BY institution_name ASC LIMIT 250");
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "institutions")) });
});

bankingAwarenessAdminRouter.post("/institutions", async (req, res) => {
  const input = institutionSchema.parse(req.body);
  const row = await pool.query(
    `INSERT INTO banking_institutions
       (institution_name, short_name, institution_type, established_year, headquarters, description,
        official_website, parent_organization, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,now()) RETURNING *`,
    [
      input.institutionName, input.shortName, input.institutionType, input.establishedYear ?? null,
      input.headquarters, input.description, input.officialWebsite, input.parentOrganization,
      input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.institutions.create", "banking_institutions", row.rows[0].id, { name: input.institutionName }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/institutions/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid institution ID." });
  const input = institutionSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE banking_institutions
     SET institution_name=$2, short_name=$3, institution_type=$4, established_year=$5,
         headquarters=$6, description=$7, official_website=$8, parent_organization=$9,
         source_name=$10, source_url=$11, status=$12,
         verified_at = CASE WHEN $12 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$13, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.institutionName, input.shortName, input.institutionType,
      input.establishedYear ?? null, input.headquarters, input.description, input.officialWebsite,
      input.parentOrganization, input.sourceName, input.sourceUrl, input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Institution not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.institutions.update", "banking_institutions", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

// ============================================================================
// 5. REGULATORY BODIES CRUD
// ============================================================================

const regulatorSchema = z.object({
  organizationName: z.string().trim().min(2).max(180),
  shortName: z.string().trim().max(40).default(""),
  regulatoryDomain: z.string().trim().max(180).default(""),
  responsibilities: z.string().trim().max(4000).default(""),
  establishedYear: z.coerce.number().int().min(1700).max(2100).nullable().optional(),
  headquarters: z.string().trim().max(120).default(""),
  officialWebsite: safeUrlSchema,
  applicableSector: z.string().trim().max(120).default(""),
  sourceName: z.string().trim().max(120).default(""),
  sourceUrl: safeUrlSchema,
  status: STATUS_ENUM.default("draft"),
});

bankingAwarenessAdminRouter.get("/regulatory-bodies", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM banking_regulatory_bodies ORDER BY organization_name ASC LIMIT 200");
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "regulatory_bodies")) });
});

bankingAwarenessAdminRouter.post("/regulatory-bodies", async (req, res) => {
  const input = regulatorSchema.parse(req.body);
  const row = await pool.query(
    `INSERT INTO banking_regulatory_bodies
       (organization_name, short_name, regulatory_domain, responsibilities, established_year,
        headquarters, official_website, applicable_sector, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,now()) RETURNING *`,
    [
      input.organizationName, input.shortName, input.regulatoryDomain, input.responsibilities,
      input.establishedYear ?? null, input.headquarters, input.officialWebsite, input.applicableSector,
      input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.regulators.create", "banking_regulatory_bodies", row.rows[0].id, { name: input.organizationName }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/regulatory-bodies/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid regulatory body ID." });
  const input = regulatorSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE banking_regulatory_bodies
     SET organization_name=$2, short_name=$3, regulatory_domain=$4, responsibilities=$5,
         established_year=$6, headquarters=$7, official_website=$8, applicable_sector=$9,
         source_name=$10, source_url=$11, status=$12,
         verified_at = CASE WHEN $12 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$13, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.organizationName, input.shortName, input.regulatoryDomain,
      input.responsibilities, input.establishedYear ?? null, input.headquarters,
      input.officialWebsite, input.applicableSector, input.sourceName, input.sourceUrl,
      input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Regulatory body not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.regulators.update", "banking_regulatory_bodies", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

// ============================================================================
// 6. BANKING LEADERS CRUD (Prevents Conflicting Active Holders, Preserves History)
// ============================================================================

const leaderSchema = z
  .object({
    personName: z.string().trim().min(2).max(160),
    designation: z.string().trim().min(2).max(160),
    organizationId: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
    organizationName: z.string().trim().max(180).default(""),
    appointmentDate: isoDateOptional,
    endDate: isoDateOptional,
    previousDesignation: z.string().trim().max(180).default(""),
    notes: z.string().trim().max(2000).default(""),
    sourceName: z.string().trim().max(120).default(""),
    sourceUrl: safeUrlSchema,
    status: STATUS_ENUM.default("draft"),
  })
  .refine(
    (v) => !v.appointmentDate || !v.endDate || v.endDate >= v.appointmentDate,
    { message: "End date must be on or after appointment date." },
  );

bankingAwarenessAdminRouter.get("/leaders", async (_req, res) => {
  const rows = await pool.query(
    `SELECT l.*, COALESCE(NULLIF(l.organization_name, ''), bi.institution_name, '') AS resolved_organization
     FROM banking_leaders l
     LEFT JOIN banking_institutions bi ON bi.id = l.organization_id
     ORDER BY (l.end_date IS NOT NULL) ASC, l.appointment_date DESC NULLS LAST, l.person_name ASC
     LIMIT 250`,
  );
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "leaders")) });
});

bankingAwarenessAdminRouter.post("/leaders", async (req, res) => {
  const input = leaderSchema.parse(req.body);
  if (input.status === "published" && !input.sourceUrl) {
    return res.status(400).json({ error: "Official source URL is required to publish a leadership appointment." });
  }
  // Guard against conflicting active holders for the exact same designation + organization
  if (input.status === "published" && !input.endDate) {
    const conflict = await pool.query(
      `SELECT id, person_name FROM banking_leaders
       WHERE status = 'published' AND end_date IS NULL
         AND lower(designation) = lower($1)
         AND lower(organization_name) = lower($2)
       LIMIT 1`,
      [input.designation, input.organizationName],
    );
    if (conflict.rowCount) {
      return res.status(409).json({
        error: `Active holder "${conflict.rows[0].person_name}" already exists for ${input.designation} at ${input.organizationName}. Set an end date on the previous holder first to preserve history.`,
      });
    }
  }
  const row = await pool.query(
    `INSERT INTO banking_leaders
       (person_name, designation, organization_id, organization_name, appointment_date, end_date,
        previous_designation, notes, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,now()) RETURNING *`,
    [
      input.personName, input.designation, input.organizationId ?? null, input.organizationName,
      input.appointmentDate ?? null, input.endDate ?? null, input.previousDesignation, input.notes,
      input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.leaders.create", "banking_leaders", row.rows[0].id, { personName: input.personName, designation: input.designation }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/leaders/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid leader ID." });
  const input = leaderSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE banking_leaders
     SET person_name=$2, designation=$3, organization_id=$4, organization_name=$5,
         appointment_date=$6, end_date=$7, previous_designation=$8, notes=$9,
         source_name=$10, source_url=$11, status=$12,
         verified_at = CASE WHEN $12 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$13, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.personName, input.designation, input.organizationId ?? null,
      input.organizationName, input.appointmentDate ?? null, input.endDate ?? null,
      input.previousDesignation, input.notes, input.sourceName, input.sourceUrl,
      input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Leader record not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.leaders.update", "banking_leaders", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

// ============================================================================
// 7. STATIC GK & TERMINOLOGY CRUD
// ============================================================================

const staticGkSchema = z.object({
  title: z.string().trim().min(3).max(200),
  topic: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(10000),
  keyFacts: z.array(z.string().trim().min(2).max(500)).max(25).default([]),
  importanceLevel: IMPORTANCE_ENUM.default("important"),
  targetExams: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  sourceName: z.string().trim().max(120).default(""),
  sourceUrl: safeUrlSchema,
  status: STATUS_ENUM.default("draft"),
});

bankingAwarenessAdminRouter.get("/static-gk", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM banking_static_gk ORDER BY topic ASC, title ASC LIMIT 250");
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "static_gk")) });
});

bankingAwarenessAdminRouter.post("/static-gk", async (req, res) => {
  const input = staticGkSchema.parse(req.body);
  const row = await pool.query(
    `INSERT INTO banking_static_gk
       (title, topic, description, key_facts, importance_level, target_exams, tags,
        source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7::text[],$8,$9,$10,$11,$12,$12,now()) RETURNING *`,
    [
      input.title, input.topic, input.description, JSON.stringify(input.keyFacts),
      input.importanceLevel, JSON.stringify(input.targetExams), input.tags,
      input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.static_gk.create", "banking_static_gk", row.rows[0].id, { title: input.title }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/static-gk/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid Static GK ID." });
  const input = staticGkSchema.parse(req.body);
  const row = await pool.query(
    `UPDATE banking_static_gk
     SET title=$2, topic=$3, description=$4, key_facts=$5::jsonb, importance_level=$6,
         target_exams=$7::jsonb, tags=$8::text[], source_name=$9, source_url=$10, status=$11,
         verified_at = CASE WHEN $11 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$12, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.title, input.topic, input.description, JSON.stringify(input.keyFacts),
      input.importanceLevel, JSON.stringify(input.targetExams), input.tags,
      input.sourceName, input.sourceUrl, input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Static GK record not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.static_gk.update", "banking_static_gk", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});

const terminologySchema = z.object({
  term: z.string().trim().min(2).max(140),
  abbreviation: z.string().trim().max(40).default(""),
  fullForm: z.string().trim().max(200).default(""),
  definition: z.string().trim().min(10).max(4000),
  example: z.string().trim().max(1500).default(""),
  category: z.string().trim().min(2).max(100).default("General Banking"),
  importanceLevel: IMPORTANCE_ENUM.default("important"),
  targetExams: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
  sourceName: z.string().trim().max(120).default(""),
  sourceUrl: safeUrlSchema,
  status: STATUS_ENUM.default("draft"),
});

bankingAwarenessAdminRouter.get("/terminology", async (_req, res) => {
  const rows = await pool.query("SELECT * FROM banking_terminology ORDER BY lower(term) ASC LIMIT 300");
  res.json({ success: true, items: rows.rows.map((r) => attachFreshness(r, "terminology")) });
});

bankingAwarenessAdminRouter.post("/terminology", async (req, res) => {
  const input = terminologySchema.parse(req.body);
  const dup = await pool.query("SELECT id FROM banking_terminology WHERE lower(term) = lower($1) LIMIT 1", [input.term]);
  if (dup.rowCount) return res.status(409).json({ error: `Terminology entry "${input.term}" already exists.` });
  const row = await pool.query(
    `INSERT INTO banking_terminology
       (term, abbreviation, full_form, definition, example, category, importance_level,
        target_exams, source_name, source_url, verified_at, status, created_by, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$13,now()) RETURNING *`,
    [
      input.term, input.abbreviation, input.fullForm, input.definition, input.example,
      input.category, input.importanceLevel, JSON.stringify(input.targetExams),
      input.sourceName, input.sourceUrl,
      input.status === "published" || input.status === "approved" ? new Date().toISOString() : null,
      input.status, req.session.userId,
    ],
  );
  invalidateBankingCache();
  await audit(req.session.userId, "banking.terminology.create", "banking_terminology", row.rows[0].id, { term: input.term }, req.ip);
  res.status(201).json({ success: true, item: row.rows[0] });
});

bankingAwarenessAdminRouter.put("/terminology/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid terminology ID." });
  const input = terminologySchema.parse(req.body);
  const dup = await pool.query(
    "SELECT id FROM banking_terminology WHERE lower(term) = lower($1) AND id <> $2 LIMIT 1",
    [input.term, req.params.id],
  );
  if (dup.rowCount) return res.status(409).json({ error: `Terminology entry "${input.term}" already exists.` });
  const row = await pool.query(
    `UPDATE banking_terminology
     SET term=$2, abbreviation=$3, full_form=$4, definition=$5, example=$6, category=$7,
         importance_level=$8, target_exams=$9::jsonb, source_name=$10, source_url=$11, status=$12,
         verified_at = CASE WHEN $12 IN ('approved','published') THEN now() ELSE verified_at END,
         updated_by=$13, updated_at=now()
     WHERE id=$1 RETURNING *`,
    [
      req.params.id, input.term, input.abbreviation, input.fullForm, input.definition,
      input.example, input.category, input.importanceLevel, JSON.stringify(input.targetExams),
      input.sourceName, input.sourceUrl, input.status, req.session.userId,
    ],
  );
  if (!row.rowCount) return res.status(404).json({ error: "Terminology entry not found." });
  invalidateBankingCache();
  await audit(req.session.userId, "banking.terminology.update", "banking_terminology", req.params.id, { status: input.status }, req.ip);
  res.json({ success: true, item: row.rows[0] });
});
