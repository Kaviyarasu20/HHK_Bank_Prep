
/**
 * Monthly Capsule Student Progress & Resume Service.
 * - Tracks opened state, last_section_id for resume, per-section completion,
 *   and accurate completion percentage.
 * - Never marks a capsule as completed merely because a student opened it.
 */

export function computeCapsuleCompletion({ totalSections, completedSections }) {
  const total = Math.max(0, Number(totalSections) || 0);
  const completed = Math.max(0, Math.min(total, Number(completedSections) || 0));
  if (total === 0) {
    return { completionPercent: 0, status: "in_progress" };
  }
  const pct = Number(((completed / total) * 100).toFixed(2));
  const status = completed >= total ? "completed" : completed > 0 ? "in_progress" : "in_progress";
  return { completionPercent: pct, status };
}

export async function recordCapsuleOpen(studentId, capsuleId, { sectionId = null } = {}) {
  const { pool } = await import("../db.js");
  const secCountRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM monthly_capsule_sections WHERE capsule_id = $1`,
    [capsuleId],
  );
  const totalSections = secCountRes.rows[0]?.cnt || 0;

  const { rows } = await pool.query(
    `INSERT INTO student_monthly_capsule_progress
       (capsule_id, student_id, opened_at, last_section_id, completed_sections_count, total_sections_count, completion_percent, status, last_accessed_at)
     VALUES ($1, $2, NOW(), $3, 0, $4, 0, 'in_progress', NOW())
     ON CONFLICT (capsule_id, student_id) DO UPDATE SET
       last_section_id = COALESCE(EXCLUDED.last_section_id, student_monthly_capsule_progress.last_section_id),
       total_sections_count = EXCLUDED.total_sections_count,
       last_accessed_at = NOW()
     RETURNING *`,
    [capsuleId, studentId, sectionId, totalSections],
  );

  return rows[0];
}

export async function markCapsuleSectionProgress(studentId, capsuleId, sectionId, { isCompleted = true } = {}) {
  const { pool } = await import("../db.js");
  const { recordStudyDay, syncMilestones } = await import("./milestones.js");
  // Verify section belongs to capsule
  const secRes = await pool.query(
    `SELECT id FROM monthly_capsule_sections WHERE id = $1 AND capsule_id = $2`,
    [sectionId, capsuleId],
  );
  if (secRes.rows.length === 0) {
    const err = new Error("Section does not belong to this monthly capsule.");
    err.status = 404;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO student_monthly_capsule_section_progress
         (section_id, student_id, capsule_id, is_completed, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END, NOW())
       ON CONFLICT (section_id, student_id) DO UPDATE SET
         is_completed = EXCLUDED.is_completed,
         completed_at = CASE WHEN EXCLUDED.is_completed THEN NOW() ELSE NULL END,
         updated_at = NOW()`,
      [sectionId, studentId, capsuleId, Boolean(isCompleted)],
    );

    const [totalRes, doneRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS cnt FROM monthly_capsule_sections WHERE capsule_id = $1`,
        [capsuleId],
      ),
      client.query(
        `SELECT COUNT(*)::int AS cnt
         FROM student_monthly_capsule_section_progress
         WHERE capsule_id = $1 AND student_id = $2 AND is_completed = true`,
        [capsuleId, studentId],
      ),
    ]);

    const totalSections = totalRes.rows[0]?.cnt || 0;
    const completedSections = doneRes.rows[0]?.cnt || 0;
    const { completionPercent, status } = computeCapsuleCompletion({
      totalSections,
      completedSections,
    });

    const progRes = await client.query(
      `INSERT INTO student_monthly_capsule_progress
         (capsule_id, student_id, opened_at, last_section_id, completed_sections_count, total_sections_count, completion_percent, status, last_accessed_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (capsule_id, student_id) DO UPDATE SET
         last_section_id = EXCLUDED.last_section_id,
         completed_sections_count = EXCLUDED.completed_sections_count,
         total_sections_count = EXCLUDED.total_sections_count,
         completion_percent = EXCLUDED.completion_percent,
         status = EXCLUDED.status,
         last_accessed_at = NOW()
       RETURNING *`,
      [capsuleId, studentId, sectionId, completedSections, totalSections, completionPercent, status],
    );

    await client.query("COMMIT");

    if (isCompleted) {
      try {
        await recordStudyDay(studentId);
        await syncMilestones(studentId);
      } catch {
        // Non-fatal
      }
    }

    return progRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getStudentCapsuleProgress(studentId, capsuleId) {
  const { pool } = await import("../db.js");
  const [summaryRes, sectionsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM student_monthly_capsule_progress WHERE capsule_id = $1 AND student_id = $2`,
      [capsuleId, studentId],
    ),
    pool.query(
      `SELECT section_id, is_completed, completed_at
       FROM student_monthly_capsule_section_progress
       WHERE capsule_id = $1 AND student_id = $2`,
      [capsuleId, studentId],
    ),
  ]);

  return {
    progress: summaryRes.rows[0] || {
      capsule_id: capsuleId,
      student_id: studentId,
      last_section_id: null,
      completed_sections_count: 0,
      total_sections_count: 0,
      completion_percent: 0,
      status: "not_started",
    },
    completedSectionIds: sectionsRes.rows.filter((r) => r.is_completed).map((r) => r.section_id),
  };
}
