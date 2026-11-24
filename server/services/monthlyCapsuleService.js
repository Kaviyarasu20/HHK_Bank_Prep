import { pool } from "../db.js";
import { validateMonthlyCapsuleForPublish } from "./monthlyCapsuleValidator.js";
import { SUPPORTED_EXAM_CODES } from "./caExamMapper.js";
import { validateAndNormalizeSourceUrl } from "./caUrlSecurity.js";
import {
  buildCapsuleDraftPlan,
  gatherApprovedMonthlyCandidates,
  generateAiCapsuleDraftIntro,
} from "./monthlyCapsuleGenerator.js";

/**
 * Monthly Capsules Service (Admin & Student).
 * - Relational linking to existing approved content (zero text duplication).
 * - Strict publication safeguards: verifies linked items are approved/published
 *   before permitting publish.
 * - Students only ever see publication_status = 'published' capsules.
 */

const ALLOWED_LINK_TYPES = new Set([
  "article",
  "one_liner",
  "mcq",
  "flashcard",
  "banking_reference",
]);

/**
 * Inspect linked content rows in the database to verify every link resolves to
 * an approved/published source item and hydrate lightweight display metadata.
 */
async function resolveAndVerifyLinks(links = []) {
  if (!links.length) return { hydrated: [], unapprovedLinks: [] };

  const byType = {
    article: [],
    one_liner: [],
    mcq: [],
    flashcard: [],
    banking_reference: [],
  };
  for (const l of links) {
    if (byType[l.content_type]) byType[l.content_type].push(l.content_id);
  }

  const lookup = new Map();

  if (byType.article.length) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, title, source_url, status,
              (status = 'published') AS is_approved
       FROM current_affairs WHERE id::text = ANY($1::text[])`,
      [byType.article],
    );
    for (const r of rows) lookup.set(`article:${r.id}`, r);
  }

  if (byType.one_liner.length) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, fact_text AS title, source_url, publication_status,
              (publication_status = 'published' AND verification_status = 'approved') AS is_approved
       FROM current_affairs_one_liners WHERE id::text = ANY($1::text[])`,
      [byType.one_liner],
    );
    for (const r of rows) lookup.set(`one_liner:${r.id}`, r);
  }

  if (byType.flashcard.length) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, front_text AS title, back_text AS subtitle, source_url,
              (publication_status = 'published' AND verification_status = 'approved') AS is_approved
       FROM current_affairs_flashcards WHERE id::text = ANY($1::text[])`,
      [byType.flashcard],
    );
    for (const r of rows) lookup.set(`flashcard:${r.id}`, r);
  }

  if (byType.mcq.length) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, question_text AS title, source_reference AS source_url,
              (review_status = 'approved') AS is_approved
       FROM current_affairs_generated_questions WHERE id::text = ANY($1::text[])`,
      [byType.mcq],
    );
    for (const r of rows) lookup.set(`mcq:${r.id}`, r);
  }

  if (byType.banking_reference.length) {
    const { rows } = await pool.query(
      `SELECT id::text AS id, rate_name AS title, source_url,
              (status = 'published') AS is_approved
       FROM banking_policy_rates WHERE id::text = ANY($1::text[])
       UNION ALL
       SELECT id::text AS id, title, source_url,
              (status = 'published') AS is_approved
       FROM banking_static_gk WHERE id::text = ANY($1::text[])`,
      [byType.banking_reference],
    );
    for (const r of rows) lookup.set(`banking_reference:${r.id}`, r);
  }

  const unapprovedLinks = [];
  const hydrated = links.map((l) => {
    const meta = lookup.get(`${l.content_type}:${l.content_id}`);
    const isApproved = Boolean(meta?.is_approved);
    if (!isApproved) {
      unapprovedLinks.push(l);
    }
    return {
      ...l,
      resolved_title: meta?.title || null,
      resolved_subtitle: meta?.subtitle || null,
      resolved_source_url: l.source_url || meta?.source_url || null,
      is_approved: isApproved,
    };
  });

  return { hydrated, unapprovedLinks };
}

export async function listCapsules({ publishedOnly = false, year, month, examCode, studentId = null } = {}) {
  const params = [];
  const where = [];

  if (publishedOnly) {
    where.push(`c.publication_status = 'published'`);
  }
  if (year) {
    params.push(Number(year));
    where.push(`c.capsule_year = $${params.length}`);
  }
  if (month) {
    params.push(Number(month));
    where.push(`c.capsule_month = $${params.length}`);
  }
  if (examCode) {
    params.push(String(examCode).trim());
    where.push(
      `EXISTS (SELECT 1 FROM monthly_capsule_exam_tags t WHERE t.capsule_id = c.id AND t.exam_code = $${params.length})`,
    );
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT
       c.*,
       (SELECT COUNT(*)::int FROM monthly_capsule_sections s WHERE s.capsule_id = c.id) AS sections_count,
       (SELECT COUNT(*)::int FROM monthly_capsule_content_links l WHERE l.capsule_id = c.id) AS items_count,
       COALESCE(
         (SELECT json_agg(t.exam_code ORDER BY t.exam_code) FROM monthly_capsule_exam_tags t WHERE t.capsule_id = c.id),
         '[]'::json
       ) AS exam_tags
     FROM monthly_capsules c
     ${whereSql}
     ORDER BY c.capsule_year DESC, c.capsule_month DESC, c.created_at DESC`,
    params,
  );

  if (studentId && rows.length) {
    const ids = rows.map((r) => r.id);
    const progRes = await pool.query(
      `SELECT capsule_id, completion_percent, completed_sections_count, total_sections_count, status, last_section_id
       FROM student_monthly_capsule_progress
       WHERE student_id = $1 AND capsule_id = ANY($2::uuid[])`,
      [studentId, ids],
    );
    const progMap = new Map(progRes.rows.map((p) => [p.capsule_id, p]));
    return rows.map((r) => ({
      ...r,
      student_progress: progMap.get(r.id) || {
        completion_percent: 0,
        completed_sections_count: 0,
        total_sections_count: r.sections_count || 0,
        status: "not_started",
        last_section_id: null,
      },
    }));
  }

  return rows;
}

export async function getCapsuleDetail(capsuleId, { publishedOnly = false } = {}) {
  const { rows } = await pool.query(
    `SELECT * FROM monthly_capsules WHERE id = $1 ${publishedOnly ? "AND publication_status = 'published'" : ""}`,
    [capsuleId],
  );
  if (rows.length === 0) return null;

  const [sectionsRes, linksRes, tagsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM monthly_capsule_sections WHERE capsule_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [capsuleId],
    ),
    pool.query(
      `SELECT * FROM monthly_capsule_content_links WHERE capsule_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [capsuleId],
    ),
    pool.query(
      `SELECT exam_code FROM monthly_capsule_exam_tags WHERE capsule_id = $1 ORDER BY exam_code ASC`,
      [capsuleId],
    ),
  ]);

  const { hydrated, unapprovedLinks } = await resolveAndVerifyLinks(linksRes.rows);
  const linksBySection = new Map();
  for (const link of hydrated) {
    // Students only see approved linked items
    if (publishedOnly && !link.is_approved) continue;
    const arr = linksBySection.get(link.section_id) || [];
    arr.push(link);
    linksBySection.set(link.section_id, arr);
  }

  return {
    ...rows[0],
    exam_tags: tagsRes.rows.map((t) => t.exam_code),
    sections: sectionsRes.rows.map((sec) => ({
      ...sec,
      links: linksBySection.get(sec.id) || [],
    })),
    unapproved_links_count: unapprovedLinks.length,
  };
}

export async function createCapsuleDraft({
  capsuleYear,
  capsuleMonth,
  title,
  description = "",
  estimatedReadMinutes = 15,
  examTags = [],
  createdBy,
}) {
  const validExamSet = new Set(SUPPORTED_EXAM_CODES);
  const cleanTags = [...new Set((examTags || []).map((t) => String(t).trim()).filter((t) => validExamSet.has(t)))];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO monthly_capsules
         (capsule_year, capsule_month, title, description, estimated_read_minutes, publication_status, validation_status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', 'pending', $6)
       RETURNING *`,
      [
        Number(capsuleYear),
        Number(capsuleMonth),
        String(title || "").trim(),
        String(description || "").trim(),
        Math.max(1, Math.min(300, Number(estimatedReadMinutes) || 15)),
        createdBy || null,
      ],
    );
    const capsule = rows[0];

    for (const code of cleanTags) {
      await client.query(
        `INSERT INTO monthly_capsule_exam_tags (capsule_id, exam_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [capsule.id, code],
      );
    }

    await client.query("COMMIT");
    return getCapsuleDetail(capsule.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function autoGenerateCapsuleDraft({ capsuleYear, capsuleMonth, examTags = [], useAi = false, createdBy }) {
  const candidates = await gatherApprovedMonthlyCandidates({ year: capsuleYear, month: capsuleMonth });
  const plan = buildCapsuleDraftPlan({ year: capsuleYear, month: capsuleMonth, candidates });

  let description = plan.description;
  let usedAi = false;
  if (useAi) {
    const aiOut = await generateAiCapsuleDraftIntro({
      year: capsuleYear,
      month: capsuleMonth,
      sectionTitles: plan.sections.map((s) => s.title),
      totalItems: plan.sections.reduce((acc, s) => acc + s.links.length, 0),
    });
    description = aiOut.description;
    usedAi = aiOut.usedAi;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO monthly_capsules
         (capsule_year, capsule_month, title, description, estimated_read_minutes, publication_status, validation_status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'draft', 'pending', $6)
       RETURNING *`,
      [
        Number(capsuleYear),
        Number(capsuleMonth),
        plan.title,
        description,
        plan.estimated_read_minutes,
        createdBy || null,
      ],
    );
    const capsule = rows[0];

    const validExamSet = new Set(SUPPORTED_EXAM_CODES);
    for (const code of [...new Set((examTags || []).filter((t) => validExamSet.has(t)))]) {
      await client.query(
        `INSERT INTO monthly_capsule_exam_tags (capsule_id, exam_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [capsule.id, code],
      );
    }

    for (const sec of plan.sections) {
      const secRes = await client.query(
        `INSERT INTO monthly_capsule_sections (capsule_id, title, category_name, introduction, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [capsule.id, sec.title, sec.category_name, sec.introduction, sec.sort_order],
      );
      const sectionId = secRes.rows[0].id;
      for (const link of sec.links) {
        await client.query(
          `INSERT INTO monthly_capsule_content_links
             (capsule_id, section_id, content_type, content_id, source_url, effective_date, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (capsule_id, section_id, content_type, content_id) DO NOTHING`,
          [
            capsule.id,
            sectionId,
            link.content_type,
            link.content_id,
            link.source_url,
            link.effective_date,
            link.sort_order,
          ],
        );
      }
    }

    await client.query("COMMIT");
    const detail = await getCapsuleDetail(capsule.id);
    return { capsule: detail, usedAi };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateCapsuleMetadata(capsuleId, { title, description, estimatedReadMinutes, examTags }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE monthly_capsules
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           estimated_read_minutes = COALESCE($4, estimated_read_minutes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        capsuleId,
        title !== undefined ? String(title).trim() : null,
        description !== undefined ? String(description).trim() : null,
        estimatedReadMinutes !== undefined ? Math.max(1, Math.min(300, Number(estimatedReadMinutes) || 15)) : null,
      ],
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    if (Array.isArray(examTags)) {
      const validExamSet = new Set(SUPPORTED_EXAM_CODES);
      const cleanTags = [...new Set(examTags.map((t) => String(t).trim()).filter((t) => validExamSet.has(t)))];
      await client.query(`DELETE FROM monthly_capsule_exam_tags WHERE capsule_id = $1`, [capsuleId]);
      for (const code of cleanTags) {
        await client.query(
          `INSERT INTO monthly_capsule_exam_tags (capsule_id, exam_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [capsuleId, code],
        );
      }
    }

    await client.query("COMMIT");
    return getCapsuleDetail(capsuleId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function addCapsuleSection(capsuleId, { title, categoryName = null, introduction = "", sortOrder }) {
  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM monthly_capsule_sections WHERE capsule_id = $1`,
    [capsuleId],
  );
  const nextOrder = Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : orderRes.rows[0].next_order;

  const { rows } = await pool.query(
    `INSERT INTO monthly_capsule_sections (capsule_id, title, category_name, introduction, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [capsuleId, String(title || "").trim(), categoryName, String(introduction || "").trim(), nextOrder],
  );
  return rows[0];
}

export async function reorderCapsuleSections(capsuleId, orderedSectionIds = []) {
  if (!Array.isArray(orderedSectionIds) || orderedSectionIds.length === 0) {
    throw new Error("orderedSectionIds array is required.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedSectionIds.length; i += 1) {
      await client.query(
        `UPDATE monthly_capsule_sections SET sort_order = $3, updated_at = NOW()
         WHERE id = $1 AND capsule_id = $2`,
        [orderedSectionIds[i], capsuleId, i + 1],
      );
    }
    await client.query("COMMIT");
    return getCapsuleDetail(capsuleId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteCapsuleSection(capsuleId, sectionId) {
  const { rowCount } = await pool.query(
    `DELETE FROM monthly_capsule_sections WHERE id = $1 AND capsule_id = $2`,
    [sectionId, capsuleId],
  );
  return rowCount > 0;
}

export async function addCapsuleContentLink(capsuleId, sectionId, { contentType, contentId, sourceUrl = null, effectiveDate = null }) {
  if (!ALLOWED_LINK_TYPES.has(contentType)) {
    throw new Error(`Unsupported content_type "${contentType}".`);
  }
  if (!contentId || !String(contentId).trim()) {
    throw new Error("contentId is required.");
  }
  let cleanUrl = null;
  if (sourceUrl) {
    const check = validateAndNormalizeSourceUrl(sourceUrl, { allowEmpty: false });
    if (!check.ok) throw new Error(check.error);
    cleanUrl = check.url;
  }

  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order
     FROM monthly_capsule_content_links WHERE section_id = $1`,
    [sectionId],
  );
  const { rows } = await pool.query(
    `INSERT INTO monthly_capsule_content_links
       (capsule_id, section_id, content_type, content_id, source_url, effective_date, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (capsule_id, section_id, content_type, content_id) DO UPDATE SET
       source_url = COALESCE(EXCLUDED.source_url, monthly_capsule_content_links.source_url)
     RETURNING *`,
    [capsuleId, sectionId, contentType, String(contentId).trim(), cleanUrl, effectiveDate || null, orderRes.rows[0].next_order],
  );
  return rows[0];
}

export async function removeCapsuleContentLink(capsuleId, linkId) {
  const { rowCount } = await pool.query(
    `DELETE FROM monthly_capsule_content_links WHERE id = $1 AND capsule_id = $2`,
    [linkId, capsuleId],
  );
  return rowCount > 0;
}

export async function validateAndPersistCapsule(capsuleId) {
  const detail = await getCapsuleDetail(capsuleId, { publishedOnly: false });
  if (!detail) return null;

  const allLinks = detail.sections.flatMap((s) => s.links);
  const unapprovedLinks = allLinks.filter((l) => !l.is_approved);

  const validation = validateMonthlyCapsuleForPublish({
    capsule: detail,
    sections: detail.sections,
    links: allLinks,
    examTags: detail.exam_tags,
    unapprovedLinks,
  });

  await pool.query(
    `UPDATE monthly_capsules
     SET validation_status = $2,
         validation_errors = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [capsuleId, validation.status, JSON.stringify([...validation.errors, ...validation.warnings])],
  );

  return validation;
}

export async function transitionCapsuleStatus(capsuleId, { targetStatus, adminUserId }) {
  const allowed = new Set(["draft", "review", "approved", "published", "archived"]);
  if (!allowed.has(targetStatus)) {
    const err = new Error(`Unsupported target status "${targetStatus}".`);
    err.status = 400;
    throw err;
  }

  if (targetStatus === "published" || targetStatus === "approved") {
    const validation = await validateAndPersistCapsule(capsuleId);
    if (!validation) {
      const err = new Error("Monthly capsule not found.");
      err.status = 404;
      throw err;
    }
    if (!validation.ok) {
      const err = new Error(`Capsule failed publication safeguards: ${validation.errors.join(" ")}`);
      err.status = 422;
      err.validation = validation;
      throw err;
    }
  }

  const { rows } = await pool.query(
    `UPDATE monthly_capsules
     SET publication_status = $2,
         approved_by = CASE WHEN $2 IN ('approved', 'published') THEN COALESCE(approved_by, $3) ELSE approved_by END,
         approved_at = CASE WHEN $2 IN ('approved', 'published') THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
         published_at = CASE WHEN $2 = 'published' THEN NOW() ELSE published_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [capsuleId, targetStatus, adminUserId || null],
  );
  if (rows.length === 0) {
    const err = new Error("Monthly capsule not found.");
    err.status = 404;
    throw err;
  }

  return getCapsuleDetail(capsuleId);
}
