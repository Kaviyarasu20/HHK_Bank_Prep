import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { parse as parseCsv } from "csv-parse/sync";
import readXlsxFile from "read-excel-file/node";
import { pool } from '../db.js';
import { requireAdmin, validate } from '../middleware.js';
import { examSchema, questionSchema, topicwiseTestSchema, generateTopicTestQuestionsSchema } from '../schemas.js';
import { selectNonRepeatingQuestions } from '../services/questionSelection.js';
import {
  MIN_BANK_UPLOAD_QUESTIONS,
  syncStageQuestionBankMockTest
} from '../services/questionBankSync.js';
import { BANKING_SYLLABUS } from '../../shared/bankingSyllabus.js';
import { generateTopicQuestions, SUPPORTED_AUTO_TOPICS, isTopicAutoGeneratable } from '../services/questionGenerator.js';
import { generateRcPassageAndQuestionsWithAi, RC_ALL_CATEGORIES, RC_SUBJECT_CATEGORIES } from '../services/rcAiEngineService.js';
const isReadingComprehensionTopic = (topicName) => String(topicName || '').trim().toLowerCase() === 'reading comprehension';
const isTopicAutoGeneratableAll = (topicName) => isTopicAutoGeneratable(topicName) || isReadingComprehensionTopic(topicName);

async function assertCompleteRcPassageSets(client, selectedQuestionIds) {
  if (!Array.isArray(selectedQuestionIds) || !selectedQuestionIds.length) return;
  const rcGroupsRes = await client.query(
    `SELECT q.passage_group_id,
            COALESCE(pg.title, 'Reading Comprehension Passage') AS passage_title,
            COUNT(*)::int AS selected_count
     FROM questions q
     LEFT JOIN passage_groups pg ON pg.id = q.passage_group_id
     WHERE q.id = ANY($1::uuid[])
       AND LOWER(q.topic_name) = 'reading comprehension'
       AND q.passage_group_id IS NOT NULL
     GROUP BY q.passage_group_id, pg.title`,
    [selectedQuestionIds]
  );
  if (!rcGroupsRes.rowCount) return;

  const groupIds = rcGroupsRes.rows.map((r) => r.passage_group_id);
  const fullCountsRes = await client.query(
    `SELECT passage_group_id, COUNT(*)::int AS total_count
     FROM questions
     WHERE passage_group_id = ANY($1::uuid[])
       AND status = 'published'
     GROUP BY passage_group_id`,
    [groupIds]
  );
  const fullCountMap = new Map(fullCountsRes.rows.map((r) => [r.passage_group_id, Number(r.total_count)]));

  for (const row of rcGroupsRes.rows) {
    const total = fullCountMap.get(row.passage_group_id) ?? row.selected_count;
    if (Number(row.selected_count) !== total) {
      throw Object.assign(
        new Error(
          `Reading Comprehension passage sets cannot be split. Select all ${total} questions of "${row.passage_title}" together as one complete set (currently ${row.selected_count}/${total} selected).`
        ),
        { status: 400 }
      );
    }
  }
}
import {
  findSyllabusSubject,
  getExamWiseBlueprintProgress,
  getNextSetInfo,
  isQuestionMatchingTopic,
  resolveSectionForSubject,
  validateTestForPublish
} from '../services/mockTestValidation.js';
export const adminRouter = Router();
adminRouter.use(requireAdmin);
async function syncSectionsStage(sectionIds, actorId, autoPublishExam = false) {
  const cleanIds = [...new Set(sectionIds.filter(Boolean))];
  if (!cleanIds.length) return [];
  const stageRows = await pool.query(
    "SELECT DISTINCT stage_id FROM exam_sections WHERE id = ANY($1::uuid[])",
    [cleanIds]
  );
  if (!stageRows.rowCount) return [];
  const client = await pool.connect();
  const results = [];
  try {
    await client.query("BEGIN");
    for (const row of stageRows.rows) {
      const synced = await syncStageQuestionBankMockTest(
        client,
        row.stage_id,
        actorId,
        { autoPublishExam }
      );
      if (synced) results.push(synced);
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function audit(actor, action, type, id, details = {}, ip) {
  await pool.query(
    `INSERT INTO audit_logs
      (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor ?? null, action, type, id, JSON.stringify(details), ip ?? null]
  );
}
async function upsertTopic(sectionId, name, subtopicName = '') {
  const result = await pool.query(
    `INSERT INTO topics(section_id, name)
     VALUES ($1, $2)
     ON CONFLICT(section_id, name)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [sectionId, name]
  );
  const parentId = result.rows[0].id;
  if (subtopicName && subtopicName.trim()) {
    const cleanSub = subtopicName.trim();
    const subResult = await pool.query(
      `INSERT INTO topics(section_id, parent_topic_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT(section_id, name)
       DO UPDATE SET parent_topic_id = EXCLUDED.parent_topic_id
       RETURNING id`,
      [sectionId, parentId, cleanSub]
    );
    return subResult.rows[0].id;
  }
  return parentId;
}
async function assertPassageGroup(sectionId, questionType, passageGroupId) {
  if (questionType !== "passage") return;
  const group = await pool.query(
    "SELECT id FROM passage_groups WHERE id = $1 AND section_id = $2",
    [passageGroupId, sectionId]
  );
  if (!group.rowCount) {
    throw Object.assign(
      new Error("Choose a passage group that belongs to the selected exam section."),
      { status: 400 }
    );
  }
}
const selectionRuleSchema = z.object({
  sectionId: z.string().uuid(),
  topicDistribution: z.array(
    z.object({
      topicName: z.string().trim().min(1).max(120),
      percent: z.number().int().min(0).max(100)
    })
  ).max(100).default([]).refine(
    (topics) => new Set(topics.map((topic) => topic.topicName)).size === topics.length,
    { message: "Topics in a section rule must be unique." }
  ).refine(
    (topics) => !topics.length || topics.reduce((sum, topic) => sum + topic.percent, 0) === 100,
    { message: "Topic percentages must total 100." }
  ),
  easyPercent: z.number().int().min(0).max(100),
  mediumPercent: z.number().int().min(0).max(100),
  hardPercent: z.number().int().min(0).max(100)
}).refine(
  (rule) => rule.easyPercent + rule.mediumPercent + rule.hardPercent === 100,
  { message: "Difficulty percentages must total 100." }
);
const mockTestDraftSchema = z.object({
  examId: z.string().uuid(),
  stageId: z.string().uuid(),
  setNumber: z.number().int().positive().max(999).optional(),
  setLabel: z.string().trim().min(1).max(60).optional(),
  name: z.string().trim().min(3).max(180),
  description: z.string().max(4e3).default(""),
  durationSeconds: z.number().int().positive().max(86400),
  reviewPolicy: z.enum(["after_submit", "never"]).default("after_submit"),
  selectionMode: z.enum(["manual", "rule_based"]).default("manual"),
  questionIds: z.array(z.string().uuid()).max(1e3).default([]).refine((ids) => new Set(ids).size === ids.length, {
    message: "Question IDs must be unique."
  }),
  selectionRules: z.array(selectionRuleSchema).max(100).default([]).refine((rules) => new Set(rules.map((rule) => rule.sectionId)).size === rules.length, {
    message: "Each section can have only one selection rule."
  }),
  availabilityStart: z.string().datetime().nullable().default(null),
  availabilityEnd: z.string().datetime().nullable().default(null),
  status: z.literal("draft").default("draft")
}).superRefine((value, ctx) => {
  if (value.selectionMode === "rule_based" && !value.selectionRules.length) {
    ctx.addIssue({
      code: "custom",
      path: ["selectionRules"],
      message: "Configure selection rules for the exam sections."
    });
  }
  if (value.availabilityStart && value.availabilityEnd && new Date(value.availabilityEnd) <= new Date(value.availabilityStart)) {
    ctx.addIssue({
      code: "custom",
      path: ["availabilityEnd"],
      message: "Availability end must be later than the start."
    });
  }
});
async function resolveMockTestQuestions(client, input, existingTestId) {
  if (input.selectionMode === "manual") {
    if (!input.questionIds.length) {
      return [];
    }
    const selected = await client.query(
      `SELECT q.id, q.section_id
       FROM unnest($1::uuid[]) WITH ORDINALITY wanted(id, position)
       JOIN questions q ON q.id = wanted.id
       JOIN exam_sections s ON s.id = q.section_id
       JOIN exam_stages st ON st.id = s.stage_id
       WHERE st.id = $2 AND q.status = 'published'
       ORDER BY wanted.position`,
      [input.questionIds, input.stageId]
    );
    if (selected.rowCount !== input.questionIds.length) {
      throw Object.assign(
        new Error("Every selected question must be published and belong to this exam stage."),
        { status: 400 }
      );
    }
    const sections = await client.query(
      "SELECT id, name, question_count FROM exam_sections WHERE stage_id = $1 ORDER BY sort_order, id",
      [input.stageId]
    );
    const counts = new Map();
    for (const question of selected.rows) {
      counts.set(
        question.section_id,
        (counts.get(question.section_id) ?? 0) + 1
      );
    }
    for (const section of sections.rows) {
      const actual = counts.get(section.id) ?? 0;
      if (Number(section.question_count) > 0 && actual > Number(section.question_count)) {
        throw Object.assign(
          new Error(
            `At most ${section.question_count} questions can be selected for ${section.name}; ${actual} are selected.`
          ),
          { status: 409 }
        );
      }
    }
    await assertCompleteRcPassageSets(client, selected.rows.map((r) => r.id));
    return selected.rows;
  }
  const priorRows = await client.query(
    `SELECT DISTINCT mtq.question_id
     FROM mock_test_questions mtq
     JOIN mock_tests mt ON mt.id = mtq.mock_test_id
     WHERE mt.stage_id = $1
       AND mt.status <> 'archived'
       AND ($2::uuid IS NULL OR mt.id <> $2)`,
    [input.stageId, existingTestId ?? null]
  );
  return selectNonRepeatingQuestions(client, {
    stageId: input.stageId,
    selectionRules: input.selectionRules ?? [],
    preferExcludeIds: priorRows.rows.map((r) => r.question_id),
    shuffleWithinSection: true
  });
}
adminRouter.get("/overview", async (_req, res) => {
  const stats = await pool.query(`
    SELECT
      (SELECT count(*) FROM users WHERE role = 'student') students,
      (SELECT count(*) FROM users WHERE role = 'student') total_students,
      (SELECT count(*) FROM users WHERE role = 'student'
        AND updated_at > now() - interval '30 days') active_students,
      (SELECT count(*) FROM exams) total_exams,
      (SELECT count(*) FROM exams WHERE status = 'published') published_exams,
      (SELECT count(DISTINCT name) FROM exam_sections) total_subjects,
      (SELECT count(DISTINCT topic_name) FROM questions WHERE topic_name <> '') total_topics,
      (SELECT count(*) FROM questions) total_questions,
      (SELECT count(*) FROM questions WHERE status = 'published') published_questions,
      (SELECT count(*) FROM questions WHERE difficulty = 'easy') easy_questions,
      (SELECT count(*) FROM questions WHERE difficulty = 'medium') medium_questions,
      (SELECT count(*) FROM questions WHERE difficulty = 'hard') hard_questions,
      (SELECT count(*) FROM mock_tests) mock_tests_created,
      (SELECT count(*) FROM mock_tests WHERE status = 'published') published_tests,
      (SELECT count(*) FROM test_attempts WHERE status <> 'in_progress') attempts,
      (SELECT coalesce(sum(invalid_rows), 0) FROM upload_batches) import_validation_failures
  `);
  const activity = await pool.query(
    "SELECT id, action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 12"
  );
  res.json({
    stats: stats.rows[0],
    activity: activity.rows
  });
});
// ============================================================================
// 1. BANKING SYLLABUS DIRECTORY ENDPOINT
// ============================================================================
// Returns the full 6-subject canonical banking syllabus hierarchy
adminRouter.get("/syllabus", (_req, res) => {
  res.json({ syllabus: BANKING_SYLLABUS });
});

// ============================================================================
// 2. USER & ROLE GOVERNANCE ENDPOINTS
// ============================================================================
// GET /api/admin/users
// Supports searching by name/email/mobile, filtering by role and active status,
// and returns overall platform summary metrics (total, admins, students, active, disabled)
adminRouter.get("/users", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const roleFilter = String(req.query.role ?? "all").toLowerCase();
  const statusFilter = String(req.query.status ?? "all").toLowerCase();

  let sql = `
    SELECT
      u.id, u.email, u.full_name, u.mobile, u.role, u.is_active, u.created_at, u.updated_at,
      p.preparation_status, e.name target_exam
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    LEFT JOIN exams e ON e.id = p.target_exam_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (search) {
    sql += ` AND (u.email ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.mobile ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  if (roleFilter && roleFilter !== "all") {
    sql += ` AND u.role = $${idx}`;
    params.push(roleFilter);
    idx++;
  }

  if (statusFilter === "active") {
    sql += ` AND u.is_active = TRUE`;
  } else if (statusFilter === "disabled") {
    sql += ` AND u.is_active = FALSE`;
  }

  sql += ` ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.created_at DESC LIMIT 300`;

  const rows = await pool.query(sql, params);

  // Aggregate user statistics for the top KPI row
  const summary = await pool.query(`
    SELECT
      count(*)::int total_users,
      count(*) FILTER (WHERE role = 'admin')::int total_admins,
      count(*) FILTER (WHERE role = 'student')::int total_students,
      count(*) FILTER (WHERE is_active = TRUE)::int total_active,
      count(*) FILTER (WHERE is_active = FALSE)::int total_disabled
    FROM users
  `);

  res.json({
    users: rows.rows,
    summary: summary.rows[0],
    currentUserId: req.session.userId
  });
});

// PATCH /api/admin/users/:id/role
// Promotes or demotes an account between 'student' and 'admin'.
// Includes a critical safeguard: Admins cannot demote their own account to prevent system lockout.
adminRouter.patch("/users/:id/role", async (req, res) => {
  const input = validate(
    z.object({
      role: z.enum(["student", "admin"])
    }),
    req.body
  );

  // Guard against self-demotion lockout
  if (req.params.id === req.session.userId && input.role !== "admin") {
    return res.status(400).json({
      error: "You cannot change or demote your own administrator role."
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const previous = await client.query(
      "SELECT id, email, full_name, role, is_active FROM users WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!previous.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found." });
    }

    const updated = await client.query(
      `UPDATE users
       SET role = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [req.params.id, input.role]
    );

    // Audit log records who changed whose role and when
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'user.role_change', 'user', $2, $3, $4)`,
      [
        req.session.userId,
        req.params.id,
        JSON.stringify({
          fromRole: previous.rows[0].role,
          toRole: input.role,
          targetEmail: previous.rows[0].email
        }),
        req.ip
      ]
    );

    await client.query("COMMIT");
    res.json({
      user: updated.rows[0],
      message: `Role for ${updated.rows[0].full_name || updated.rows[0].email} successfully updated to ${input.role}.`
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// PATCH /api/admin/users/:id/status
// Suspends or enables login privileges for a user account.
// Includes a critical safeguard: Admins cannot disable their own account.
adminRouter.patch("/users/:id/status", async (req, res) => {
  const input = validate(
    z.object({
      isActive: z.boolean()
    }),
    req.body
  );

  // Guard against self-disable lockout
  if (req.params.id === req.session.userId && !input.isActive) {
    return res.status(400).json({
      error: "You cannot disable your own administrator account."
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE users
       SET is_active = $2, updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, role, is_active, updated_at`,
      [req.params.id, input.isActive]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found." });
    }

    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'user', $3, $4, $5)`,
      [
        req.session.userId,
        input.isActive ? "user.enable" : "user.disable",
        req.params.id,
        JSON.stringify({ isActive: input.isActive }),
        req.ip
      ]
    );

    await client.query("COMMIT");
    res.json({
      user: updated.rows[0],
      message: `Account for ${updated.rows[0].full_name || updated.rows[0].email} ${input.isActive ? "enabled" : "disabled"} successfully.`
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

adminRouter.get("/students", async (req, res) => {
  const search = String(req.query.search ?? "");
  const role = req.query.role ? String(req.query.role) : null;
  const students = await pool.query(
    `SELECT
       u.id, u.email, u.full_name, u.mobile, u.role, u.is_active, u.created_at,
       p.preparation_status, e.name target_exam
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN exams e ON e.id = p.target_exam_id
     WHERE ($3::text IS NULL OR u.role = $3)
       AND ($1 = '' OR u.email ILIKE $2 OR u.full_name ILIKE $2)
     ORDER BY u.created_at DESC
     LIMIT 200`,
    [search, `%${search}%`, role ?? 'student']
  );
  res.json({ students: students.rows });
});
adminRouter.patch("/students/:id", async (req, res) => {
  const input = validate(
    z.object({
      role: z.enum(["student", "admin"]).optional(),
      isActive: z.boolean().optional()
    }),
    req.body
  );
  if (req.params.id === req.session.userId && input.role && input.role !== "admin") {
    return res.status(400).json({ error: "You cannot demote your own administrator role." });
  }
  if (req.params.id === req.session.userId && input.isActive === false) {
    return res.status(400).json({ error: "You cannot disable your own administrator account." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE users
       SET role = COALESCE($2, role),
           is_active = COALESCE($3, is_active),
           updated_at = now()
       WHERE id = $1
       RETURNING id, email, full_name, role, is_active`,
      [req.params.id, input.role ?? null, input.isActive ?? null]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Student not found." });
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'student.update', 'user', $2, $3, $4)`,
      [req.session.userId, req.params.id, JSON.stringify(input), req.ip]
    );
    await client.query("COMMIT");
    res.json({ user: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
adminRouter.post("/exams", async (req, res) => {
  const input = validate(examSchema, req.body);
  if (input.status !== "draft") {
    return res.status(400).json({
      error: "Create examinations as drafts, then verify and publish their patterns from Exam setup."
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exam = (await client.query(
      `INSERT INTO exams
          (code, name, category, description, status, pattern_cycle, pattern_source_url, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7)
         RETURNING id, code, name, category, sort_order, description, status,
                   pattern_cycle, pattern_source_url, pattern_verified_at`,
      [
        input.code.toUpperCase(),
        input.name,
        input.category,
        input.description,
        input.patternCycle,
        input.patternSourceUrl,
        req.session.userId
      ]
    )).rows[0];
    for (const [stageIndex, stage] of input.stages.entries()) {
      const stageRow = (await client.query(
        `INSERT INTO exam_stages
            (exam_id, name, duration_seconds, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
        [
          exam.id,
          stage.name,
          stage.durationSeconds,
          stage.sortOrder ?? stageIndex
        ]
      )).rows[0];
      for (const [sectionIndex, section] of stage.sections.entries()) {
        await client.query(
          `INSERT INTO exam_sections
            (stage_id, name, question_count, duration_seconds,
             marks_per_correct, negative_marks, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            stageRow.id,
            section.name,
            section.questionCount,
            section.durationSeconds,
            section.marksPerCorrect,
            section.negativeMarks,
            section.sortOrder ?? sectionIndex
          ]
        );
      }
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'exam.create', 'exam', $2, $3)`,
      [req.session.userId, exam.id, req.ip]
    );
    await client.query("COMMIT");
    res.status(201).json({ exam });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
adminRouter.put("/exams/:id", async (req, res) => {
  const input = validate(examSchema, req.body);
  const client = await pool.connect();
  try {
    if (input.status === "published") {
      if (!input.patternCycle || !input.patternSourceUrl) {
        return res.status(409).json({
          error: "Add the official pattern cycle and an HTTPS link to its recruitment notification before publishing."
        });
      }
      const placeholder = input.stages.some(
        (stage) => stage.name.toLowerCase().includes("pending verification") || stage.sections.some(
          (section) => section.name.toLowerCase().includes("pending verification") || section.questionCount <= 0
        )
      );
      if (placeholder) {
        return res.status(409).json({
          error: "Replace placeholder stages and sections with a verified exam pattern and positive question counts before publishing."
        });
      }
      const invalidTimers = input.stages.some((stage) => {
        const timed = stage.sections.some(
          (section) => section.durationSeconds !== null
        );
        return timed && (stage.sections.some((section) => section.durationSeconds === null) || stage.sections.reduce(
          (sum, section) => sum + (section.durationSeconds ?? 0),
          0
        ) !== stage.durationSeconds);
      });
      if (invalidTimers) {
        return res.status(409).json({
          error: "When using sectional timers, each section must have a time and their total must match the stage duration."
        });
      }
    }
    await client.query("BEGIN");
    const examLock = await client.query(
      "SELECT id FROM exams WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!examLock.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Exam not found." });
    }
    const hasHistory = await client.query(
      `SELECT 1
       FROM mock_tests t
       JOIN test_attempts ta ON ta.mock_test_id = t.id
       WHERE t.exam_id = $1
       LIMIT 1`,
      [req.params.id]
    );
    if (hasHistory.rowCount) {
      const stored = (await client.query(
        `SELECT
             st.id stage_id,
             st.name stage_name,
             st.duration_seconds stage_duration,
             st.sort_order stage_sort,
             s.id section_id,
             s.name section_name,
             s.question_count,
             s.duration_seconds section_duration,
             s.marks_per_correct,
             s.negative_marks,
             s.sort_order section_sort
           FROM exam_stages st
           LEFT JOIN exam_sections s ON s.stage_id = st.id
           WHERE st.exam_id = $1
           ORDER BY
             st.sort_order, st.name, st.id,
             s.sort_order, s.name, s.id`,
        [req.params.id]
      )).rows;
      const existingStages = /* @__PURE__ */ new Map();
      for (const row of stored) {
        let stage = existingStages.get(row.stage_id);
        if (!stage) {
          stage = {
            id: row.stage_id,
            name: row.stage_name,
            durationSeconds: Number(row.stage_duration),
            sortOrder: Number(row.stage_sort),
            sections: []
          };
          existingStages.set(row.stage_id, stage);
        }
        if (row.section_id) {
          stage.sections.push({
            name: row.section_name,
            questionCount: Number(row.question_count),
            durationSeconds: row.section_duration === null ? null : Number(row.section_duration),
            marksPerCorrect: Number(row.marks_per_correct),
            negativeMarks: Number(row.negative_marks),
            sortOrder: Number(row.section_sort)
          });
        }
      }
      const canonical = (stages) => stages.map((stage) => ({
        name: stage.name,
        durationSeconds: Number(stage.durationSeconds),
        sections: stage.sections.map((section) => ({
          name: section.name,
          questionCount: Number(section.questionCount),
          durationSeconds: section.durationSeconds === null ? null : Number(section.durationSeconds),
          marksPerCorrect: Number(section.marksPerCorrect),
          negativeMarks: Number(section.negativeMarks)
        }))
      }));
      const prior = [...existingStages.values()];
      if (JSON.stringify(canonical(prior)) !== JSON.stringify(canonical(input.stages))) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "This examination already has student attempt history, so its stages, sections, timing, question counts, and scoring are locked. Create a new examination cycle to change the pattern."
        });
      }
    }
    const exam = await client.query(
      `UPDATE exams
       SET code = $2,
           name = $3,
           category = $4,
           description = $5,
           status = $6,
           pattern_cycle = $7,
           pattern_source_url = $8,
           pattern_verified_at =
             CASE WHEN $6 = 'published' THEN now() ELSE NULL END,
           updated_at = now()
       WHERE id = $1
       RETURNING
         id, code, name, category, sort_order, description, status,
         pattern_cycle, pattern_source_url, pattern_verified_at`,
      [
        req.params.id,
        input.code.toUpperCase(),
        input.name,
        input.category,
        input.description,
        input.status,
        input.patternCycle,
        input.patternSourceUrl
      ]
    );
    if (!exam.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Exam not found." });
    }
    if (hasHistory.rowCount) {
      await client.query(
        `INSERT INTO audit_logs
          (actor_id, action, entity_type, entity_id, ip_address)
         VALUES ($1, 'exam.update', 'exam', $2, $3)`,
        [req.session.userId, req.params.id, req.ip]
      );
      await client.query("COMMIT");
      return res.json({ exam: exam.rows[0] });
    }
    const seenStages = [];
    for (const [stageIndex, stage] of input.stages.entries()) {
      let stageRow = stage.id ? await client.query(
        "SELECT id FROM exam_stages WHERE id = $1 AND exam_id = $2",
        [stage.id, req.params.id]
      ) : await client.query(
        "SELECT id FROM exam_stages WHERE exam_id = $1 AND name = $2",
        [req.params.id, stage.name]
      );
      if (stage.id && !stageRow.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Stage does not belong to this examination."
        });
      }
      const stageId = stageRow.rows[0]?.id ?? (await client.query(
        `INSERT INTO exam_stages
              (exam_id, name, duration_seconds, sort_order)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
        [
          req.params.id,
          stage.name,
          stage.durationSeconds,
          stage.sortOrder ?? stageIndex
        ]
      )).rows[0].id;
      seenStages.push(stageId);
      await client.query(
        `UPDATE exam_stages
         SET name = $2, duration_seconds = $3, sort_order = $4
         WHERE id = $1`,
        [
          stageId,
          stage.name,
          stage.durationSeconds,
          stage.sortOrder ?? stageIndex
        ]
      );
      const seenSections = [];
      for (const [sectionIndex, section] of stage.sections.entries()) {
        let sectionRow = section.id ? await client.query(
          "SELECT id FROM exam_sections WHERE id = $1 AND stage_id = $2",
          [section.id, stageId]
        ) : await client.query(
          "SELECT id FROM exam_sections WHERE stage_id = $1 AND name = $2",
          [stageId, section.name]
        );
        if (section.id && !sectionRow.rowCount) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "Section does not belong to this examination stage."
          });
        }
        let sectionId = sectionRow.rows[0]?.id;
        if (sectionId) {
          await client.query(
            `UPDATE exam_sections
             SET name = $2,
                 question_count = $3,
                 duration_seconds = $4,
                 marks_per_correct = $5,
                 negative_marks = $6,
                 sort_order = $7
             WHERE id = $1`,
            [
              sectionId,
              section.name,
              section.questionCount,
              section.durationSeconds,
              section.marksPerCorrect,
              section.negativeMarks,
              section.sortOrder ?? sectionIndex
            ]
          );
        } else {
          const created = await client.query(
            `INSERT INTO exam_sections
              (stage_id, name, question_count, duration_seconds,
               marks_per_correct, negative_marks, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              stageId,
              section.name,
              section.questionCount,
              section.durationSeconds,
              section.marksPerCorrect,
              section.negativeMarks,
              section.sortOrder ?? sectionIndex
            ]
          );
          sectionId = created.rows[0].id;
        }
        seenSections.push(sectionId);
      }
      const currentSections = (await client.query(
        "SELECT id FROM exam_sections WHERE stage_id = $1",
        [stageId]
      )).rows;
      for (const row of currentSections) {
        if (!seenSections.includes(row.id)) {
          await client.query(
            "DELETE FROM exam_sections WHERE id = $1",
            [row.id]
          );
        }
      }
    }
    const currentStages = (await client.query(
      "SELECT id FROM exam_stages WHERE exam_id = $1",
      [req.params.id]
    )).rows;
    for (const row of currentStages) {
      if (!seenStages.includes(row.id)) {
        await client.query(
          "DELETE FROM exam_stages WHERE id = $1",
          [row.id]
        );
      }
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'exam.update', 'exam', $2, $3)`,
      [req.session.userId, req.params.id, req.ip]
    );
    await client.query("COMMIT");
    res.json({ exam: exam.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
adminRouter.delete("/exams/:id", async (req, res) => {
  const row = await pool.query(
    `UPDATE exams
     SET status = 'archived', updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [req.params.id]
  );
  if (!row.rowCount) {
    return res.status(404).json({ error: "Exam not found." });
  }
  await audit(
    req.session.userId,
    "exam.archive",
    "exam",
    req.params.id,
    {},
    req.ip
  );
  res.status(204).end();
});
adminRouter.get("/passage-groups", async (req, res) => {
  const sectionId = req.query.sectionId ? z.string().uuid().parse(req.query.sectionId) : null;
  const rows = await pool.query(
    `SELECT
       pg.id, pg.section_id, pg.title, pg.passage_text, pg.language,
       pg.image_url, pg.created_at, s.name section_name,
       (SELECT count(*)::int FROM questions q
        WHERE q.passage_group_id = pg.id) question_count
     FROM passage_groups pg
     JOIN exam_sections s ON s.id = pg.section_id
     WHERE ($1::uuid IS NULL OR pg.section_id = $1)
     ORDER BY s.name, pg.title`,
    [sectionId]
  );
  res.json({ passageGroups: rows.rows });
});
adminRouter.post("/passage-groups", async (req, res) => {
  const input = validate(
    z.object({
      sectionId: z.string().uuid(),
      title: z.string().trim().min(2).max(180),
      passageText: z.string().trim().min(20).max(1e5),
      language: z.string().trim().min(2).max(32).default("English"),
      imageUrl: z.string().url().max(2e3).refine((value) => /^https:\/\//i.test(value), {
        message: "Image URL must use HTTPS."
      }).nullable().default(null)
    }),
    req.body
  );
  const section = await pool.query(
    "SELECT id FROM exam_sections WHERE id = $1",
    [input.sectionId]
  );
  if (!section.rowCount) {
    return res.status(400).json({
      error: "Choose a valid exam section for this passage."
    });
  }
  const group = (await pool.query(
    `INSERT INTO passage_groups
        (section_id, title, passage_text, language, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
    [
      input.sectionId,
      input.title,
      input.passageText,
      input.language,
      input.imageUrl,
      req.session.userId
    ]
  )).rows[0];
  await audit(
    req.session.userId,
    "passage_group.create",
    "passage_group",
    group.id,
    { sectionId: input.sectionId },
    req.ip
  );
  res.status(201).json({ passageGroup: group });
});
adminRouter.put("/passage-groups/:id", async (req, res) => {
  const input = validate(
    z.object({
      title: z.string().trim().min(2).max(180),
      passageText: z.string().trim().min(20).max(1e5),
      language: z.string().trim().min(2).max(32),
      imageUrl: z.string().url().max(2e3).refine((value) => /^https:\/\//i.test(value), {
        message: "Image URL must use HTTPS."
      }).nullable()
    }),
    req.body
  );
  const group = await pool.query(
    `UPDATE passage_groups
     SET title = $2, passage_text = $3, language = $4,
         image_url = $5, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      req.params.id,
      input.title,
      input.passageText,
      input.language,
      input.imageUrl
    ]
  );
  if (!group.rowCount) {
    return res.status(404).json({ error: "Passage group not found." });
  }
  await audit(
    req.session.userId,
    "passage_group.update",
    "passage_group",
    req.params.id,
    {},
    req.ip
  );
  res.json({ passageGroup: group.rows[0] });
});
adminRouter.get("/topics", async (req, res) => {
  const rows = await pool.query(
    `SELECT
       t.id, t.name, t.parent_topic_id,
       s.id section_id, s.name section_name,
       st.id stage_id, e.id exam_id, e.name exam_name
     FROM topics t
     JOIN exam_sections s ON s.id = t.section_id
     JOIN exam_stages st ON st.id = s.stage_id
     JOIN exams e ON e.id = st.exam_id
     WHERE ($1::uuid IS NULL OR s.id = $1)
     ORDER BY e.name, st.sort_order, s.sort_order, t.name`,
    [req.query.sectionId ?? null]
  );
  res.json({ topics: rows.rows });
});
adminRouter.post("/topics", async (req, res) => {
  const input = validate(
    z.object({
      sectionId: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      parentTopicId: z.string().uuid().nullable().default(null)
    }),
    req.body
  );
  const row = await pool.query(
    `INSERT INTO topics(section_id, name, parent_topic_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.sectionId, input.name, input.parentTopicId]
  );
  res.status(201).json({ topic: row.rows[0] });
});
adminRouter.get("/questions", async (req, res) => {
  const subjectParam = req.query.subject ? String(req.query.subject).trim() : null;
  const topicParam = req.query.topic ? String(req.query.topic).trim() : null;
  const subtopicParam = req.query.subtopic ? String(req.query.subtopic).trim() : null;
  const difficultyParam = req.query.difficulty ? String(req.query.difficulty).trim().toLowerCase() : null;
  const stageIdParam = req.query.stageId ? String(req.query.stageId).trim() : null;
  const rowLimit = stageIdParam ? 2000 : 500;
  const subjectObj = subjectParam ? findSyllabusSubject(subjectParam) : null;
  const subjectPatterns = subjectParam
    ? (subjectObj?.matchKeywords?.length ? subjectObj.matchKeywords : [subjectParam]).map(
        (kw) => `%${kw.toLowerCase()}%`
      )
    : null;

  const rows = await pool.query(
    `SELECT
       q.*, pg.title passage_title, pg.passage_text,
       pg.language passage_language, pg.image_url passage_image_url,
       s.name section_name, e.name exam_name, st.name stage_name,
       st.id stage_id,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', mt.id,
               'name', mt.name,
               'set_label', COALESCE(mt.set_label, 'Set ' || COALESCE(mt.set_number, 1)),
               'status', mt.status
             )
             ORDER BY mt.set_number ASC, mt.created_at ASC
           )
           FROM mock_test_questions mtq
           JOIN mock_tests mt ON mt.id = mtq.mock_test_id
           WHERE mtq.question_id = q.id
             AND mt.status <> 'archived'
         ),
         '[]'::json
       ) AS used_in_sets
     FROM questions q
     LEFT JOIN passage_groups pg ON pg.id = q.passage_group_id
     JOIN exam_sections s ON s.id = q.section_id
     JOIN exam_stages st ON st.id = s.stage_id
     JOIN exams e ON e.id = st.exam_id
     WHERE ($1::uuid IS NULL OR q.section_id = $1)
       AND ($2::text IS NULL OR q.status = $2)
       AND ($6::uuid IS NULL OR st.id = $6)
       AND ($7::text IS NULL OR LOWER(COALESCE(q.subtopic_name, '')) = LOWER($7))
       AND ($8::text IS NULL OR LOWER(q.difficulty) = $8)
       AND (
         $4::text IS NULL
         OR LOWER(q.topic_name) = LOWER($4)
         OR (
           LOWER($4) = 'simplification & approximation'
           AND LOWER(q.topic_name) IN ('simplification', 'approximation')
         )
       )
       AND (
         $5::text[] IS NULL
         OR LOWER(s.name) LIKE ANY($5::text[])
       )
       AND (
         $3::text IS NULL OR
         q.topic_name ILIKE $3 OR
         q.subtopic_name ILIKE $3 OR
         q.question_text ILIKE $3 OR
         pg.passage_text ILIKE $3
       )
     ORDER BY s.sort_order ASC, q.topic_name ASC, q.subtopic_name ASC, q.created_at DESC
     LIMIT $9`,
    [
      req.query.sectionId ?? null,
      req.query.status ?? null,
      req.query.search ? `%${req.query.search}%` : null,
      topicParam,
      subjectPatterns,
      stageIdParam,
      subtopicParam,
      difficultyParam,
      rowLimit
    ]
  );
  res.json({ questions: rows.rows });
});
// ============================================================================
// SMART TOPIC AUTO-QUESTION GENERATOR ENDPOINTS (100% Logic-Verified)
// ============================================================================
const generateQuestionsSchema = z.object({
  sectionId: z.string().uuid(),
  topicName: z.string().trim().min(1).max(120),
  subtopicName: z.string().trim().max(120).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  count: z.number().int().min(1).max(100).default(15),
  language: z.string().trim().min(2).max(32).default("English"),
  status: z.enum(["draft", "published"]).default("published"),
  previewOnly: z.boolean().default(false),
});

adminRouter.get("/questions/generate/topics", (_req, res) => {
  res.json({
    supportedTopics: {
      ...SUPPORTED_AUTO_TOPICS,
      english: Array.from(
        new Set(["Reading Comprehension", ...(SUPPORTED_AUTO_TOPICS.english || [])])
      ),
    },
    rcCategories: RC_ALL_CATEGORIES,
  });
});

adminRouter.post("/questions/generate", async (req, res) => {
  const input = validate(generateQuestionsSchema, req.body);

  const sectionRes = await pool.query(
    `SELECT s.id, s.name section_name, s.marks_per_correct, s.negative_marks,
            st.id stage_id, st.name stage_name, e.id exam_id, e.code exam_code, e.name exam_name
     FROM exam_sections s
     JOIN exam_stages st ON st.id = s.stage_id
     JOIN exams e ON e.id = st.exam_id
     WHERE s.id = $1`,
    [input.sectionId]
  );
  if (!sectionRes.rowCount) {
    return res.status(404).json({ error: "Selected exam section not found." });
  }
  const section = sectionRes.rows[0];

  let generated;
  if (isReadingComprehensionTopic(input.topicName)) {
    const RC_SET_SIZE = 5;
    if (input.count < RC_SET_SIZE || input.count % RC_SET_SIZE !== 0) {
      return res.status(400).json({
        error: `Reading Comprehension must be generated in complete 5-question passage sets (5, 10, 15, 20, 25, or 30 questions). Requested: ${input.count}.`,
      });
    }
    const requestedRcCategory = String(req.body?.rcCategory || input.subtopicName || "").trim();
    const passageLength = ["short", "medium", "long"].includes(String(req.body?.passageLength || "").toLowerCase())
      ? String(req.body.passageLength).toLowerCase()
      : "medium";
    const rcDifficulty = input.difficulty === "medium" ? "moderate" : input.difficulty;
    const passageCount = input.count / RC_SET_SIZE;
    const passageSets = [];
    const generatedTitles = [];

    for (let pIdx = 0; pIdx < passageCount; pIdx += 1) {
      const chosenCategory =
        requestedRcCategory && RC_ALL_CATEGORIES.includes(requestedRcCategory)
          ? requestedRcCategory
          : RC_SUBJECT_CATEGORIES[pIdx % RC_SUBJECT_CATEGORIES.length];

      const combined = await generateRcPassageAndQuestionsWithAi({
        examination: section.exam_name || section.exam_code || "IBPS PO",
        category: chosenCategory,
        difficulty: rcDifficulty,
        passageLength,
        questionsPerPassage: RC_SET_SIZE,
        questionTypes: [],
        optionCount: 5,
        includeExplanations: true,
        includeVocabulary: false,
        avoidTitles: generatedTitles,
      });
      generatedTitles.push(combined.passage.title);

      passageSets.push({
        passage: {
          title: combined.passage.title,
          passageText: combined.passage.passage_text,
        },
        questions: combined.questions.map((q) => ({
          topicName: input.topicName,
          subtopicName: q.question_type || chosenCategory,
          difficulty: input.difficulty,
          questionText: q.question_text,
          options: q.options,
          correctAnswer: q.correct_answer,
          explanation: q.passage_reference
            ? `${q.explanation} (Passage Reference: "${q.passage_reference}")`
            : q.explanation,
        })),
      });
    }

    generated = {
      mode: "passage_sets",
      engine: "HHK_GEMINI_RC_AI",
      passageSets,
      standaloneQuestions: [],
      totalQuestions: passageSets.reduce((acc, s) => acc + s.questions.length, 0),
    };
  } else {
    generated = generateTopicQuestions({
      examCode: section.exam_code,
      stageName: section.stage_name,
      topicName: input.topicName,
      subtopicName: input.subtopicName,
      difficulty: input.difficulty,
      count: input.count,
    });
  }

  if (input.previewOnly) {
    return res.json({
      preview: true,
      mode: generated.mode,
      totalQuestions: generated.totalQuestions,
      passageSets: generated.passageSets,
      standaloneQuestions: generated.standaloneQuestions,
      section: {
        id: section.id,
        name: section.section_name,
        stageName: section.stage_name,
        examName: section.exam_name,
      },
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const topicRow = (
      await client.query(
        `INSERT INTO topics(section_id, name)
         VALUES ($1, $2)
         ON CONFLICT(section_id, name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [section.id, input.topicName]
      )
    ).rows[0];
    let topicId = topicRow.id;

    if (input.subtopicName && input.subtopicName.trim()) {
      const subRow = (
        await client.query(
          `INSERT INTO topics(section_id, parent_topic_id, name)
           VALUES ($1, $2, $3)
           ON CONFLICT(section_id, name)
           DO UPDATE SET parent_topic_id = EXCLUDED.parent_topic_id
           RETURNING id`,
          [section.id, topicRow.id, input.subtopicName.trim()]
        )
      ).rows[0];
      topicId = subRow.id;
    }

    const marks = Number(section.marks_per_correct ?? 1);
    const negativeMarks = Number(section.negative_marks ?? 0.25);
    const insertedIds = [];
    const createdPassages = [];

    if (generated.mode === "passage_sets") {
      for (const setItem of generated.passageSets) {
        const pgRes = await client.query(
          `INSERT INTO passage_groups
            (section_id, title, passage_text, language, created_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, title, passage_text`,
          [
            section.id,
            setItem.passage.title,
            setItem.passage.passageText,
            input.language,
            req.session.userId,
          ]
        );
        const pgId = pgRes.rows[0].id;
        createdPassages.push(pgRes.rows[0]);

        for (const q of setItem.questions) {
          const uniqueText = `${q.questionText} [Set: ${pgId.slice(0, 6)}]`;
          const hash = crypto
            .createHash("sha256")
            .update(`${section.id}:${uniqueText.toLowerCase()}`)
            .digest("hex");

          const qRes = await client.query(
            `INSERT INTO questions
              (section_id, topic_id, topic_name, subtopic_name, difficulty, question_type,
               language, question_text, options, correct_answer, explanation,
               marks, negative_marks, source, status, created_by, passage_group_id, content_hash)
             VALUES
              ($1, $2, $3, $4, $5, 'passage', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id`,
            [
              section.id,
              topicId,
              q.topicName || input.topicName,
              q.subtopicName || input.subtopicName || "",
              q.difficulty || input.difficulty,
              input.language,
              q.questionText,
              JSON.stringify(q.options),
              q.correctAnswer,
              q.explanation,
              marks,
              negativeMarks,
              generated.engine === "HHK_QUESTION_ENGINE_V2" ? "HHK Question Engine (Rule-Verified)" : "Auto-Generator (Logic Verified)",
              input.status,
              req.session.userId,
              pgId,
              hash,
            ]
          );
          insertedIds.push(qRes.rows[0].id);
        }
      }
    } else {
      const subtopicIdCache = new Map();
      for (const q of generated.standaloneQuestions) {
        let qTopicId = topicId;
        const qSub = (q.subtopicName || input.subtopicName || "").trim();
        if (qSub) {
          if (subtopicIdCache.has(qSub)) {
            qTopicId = subtopicIdCache.get(qSub);
          } else {
            const subRes = await client.query(
              `INSERT INTO topics(section_id, parent_topic_id, name)
               VALUES ($1, $2, $3)
               ON CONFLICT(section_id, name)
               DO UPDATE SET parent_topic_id = EXCLUDED.parent_topic_id
               RETURNING id`,
              [section.id, topicRow.id, qSub]
            );
            qTopicId = subRes.rows[0].id;
            subtopicIdCache.set(qSub, qTopicId);
          }
        }
        const salt = crypto.randomBytes(3).toString("hex");
        const hash = crypto
          .createHash("sha256")
          .update(`${section.id}:${q.questionText.toLowerCase()}:${salt}`)
          .digest("hex");

        const qRes = await client.query(
          `INSERT INTO questions
            (section_id, topic_id, topic_name, subtopic_name, difficulty, question_type,
             language, question_text, options, correct_answer, explanation,
             marks, negative_marks, source, status, created_by, content_hash)
           VALUES
            ($1, $2, $3, $4, $5, 'mcq', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING id`,
          [
            section.id,
            qTopicId,
            q.topicName || input.topicName,
            q.subtopicName || input.subtopicName || "",
            q.difficulty || input.difficulty,
            input.language,
            q.questionText,
            JSON.stringify(q.options),
            q.correctAnswer,
            q.explanation,
            marks,
            negativeMarks,
            "Auto-Generator (Logic Verified)",
            input.status,
            req.session.userId,
            hash,
          ]
        );
        insertedIds.push(qRes.rows[0].id);
      }
    }

    const syncedTests = [];
    const synced = await syncStageQuestionBankMockTest(
      client,
      section.stage_id,
      req.session.userId,
      { autoPublishExam: input.status === "published" }
    );
    if (synced) syncedTests.push(synced);

    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, details, ip_address)
       VALUES ($1, 'question.auto_generate', 'question_batch', $2, $3)`,
      [
        req.session.userId,
        JSON.stringify({
          sectionId: section.id,
          topicName: input.topicName,
          subtopicName: input.subtopicName,
          count: insertedIds.length,
          passageGroupsCreated: createdPassages.length,
          status: input.status,
        }),
        req.ip,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({
      generatedCount: insertedIds.length,
      passageGroupsCreated: createdPassages.length,
      questionIds: insertedIds,
      syncedTests,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

adminRouter.post("/questions", async (req, res) => {
  const question = validate(questionSchema, req.body);
  await assertPassageGroup(
    question.sectionId,
    question.questionType,
    question.passageGroupId
  );
  const topicId = await upsertTopic(
    question.sectionId,
    question.topicName,
    question.subtopicName
  );
  const hash = crypto.createHash("sha256").update(
    `${question.sectionId}:${question.questionText.trim().toLowerCase()}`
  ).digest("hex");
  const saved = await pool.query(
    `INSERT INTO questions
      (section_id, topic_id, topic_name, subtopic_name, difficulty, question_type,
       language, question_text, options, correct_answer, explanation,
       marks, negative_marks, source, source_year, status, created_by,
       image_url, passage_group_id, content_hash)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING
       id, status, topic_name, subtopic_name, difficulty, question_type,
       image_url, passage_group_id, created_at`,
    [
      question.sectionId,
      topicId,
      question.topicName,
      question.subtopicName || '',
      question.difficulty,
      question.questionType,
      question.language,
      question.questionText,
      JSON.stringify(question.options),
      question.correctAnswer,
      question.explanation,
      question.marks,
      question.negativeMarks,
      question.source,
      question.sourceYear,
      question.status,
      req.session.userId,
      question.imageUrl,
      question.passageGroupId,
      hash
    ]
  );
  await audit(
    req.session.userId,
    `question.${question.status}`,
    "question",
    saved.rows[0].id,
    {
      topic: question.topicName,
      subtopic: question.subtopicName || '',
      type: question.questionType,
      passageGroupId: question.passageGroupId
    },
    req.ip
  );
  const stageSync = await syncSectionsStage(
    [question.sectionId],
    req.session.userId,
    question.status === "published"
  );
  res.status(201).json({ question: saved.rows[0], syncedTests: stageSync });
});
adminRouter.put("/questions/:id", async (req, res) => {
  const question = validate(questionSchema, req.body);
  await assertPassageGroup(
    question.sectionId,
    question.questionType,
    question.passageGroupId
  );
  const existingQuestion = await pool.query(
    "SELECT section_id FROM questions WHERE id = $1",
    [req.params.id]
  );
  const topicId = await upsertTopic(
    question.sectionId,
    question.topicName,
    question.subtopicName
  );
  const hash = crypto.createHash("sha256").update(
    `${question.sectionId}:${question.questionText.trim().toLowerCase()}`
  ).digest("hex");
  const saved = await pool.query(
    `UPDATE questions
     SET section_id = $2,
         topic_id = $3,
         topic_name = $4,
         subtopic_name = $5,
         difficulty = $6,
         question_type = $7,
         language = $8,
         question_text = $9,
         options = $10,
         correct_answer = $11,
         explanation = $12,
         marks = $13,
         negative_marks = $14,
         source = $15,
         source_year = $16,
         status = $17,
         image_url = $18,
         passage_group_id = $19,
         content_hash = $20,
         updated_at = now()
     WHERE id = $1
     RETURNING
       id, status, topic_name, subtopic_name, difficulty, question_type,
       image_url, passage_group_id, updated_at`,
    [
      req.params.id,
      question.sectionId,
      topicId,
      question.topicName,
      question.subtopicName || '',
      question.difficulty,
      question.questionType,
      question.language,
      question.questionText,
      JSON.stringify(question.options),
      question.correctAnswer,
      question.explanation,
      question.marks,
      question.negativeMarks,
      question.source,
      question.sourceYear,
      question.status,
      question.imageUrl,
      question.passageGroupId,
      hash
    ]
  );
  if (!saved.rowCount) {
    return res.status(404).json({ error: "Question not found." });
  }
  await audit(
    req.session.userId,
    "question.update",
    "question",
    req.params.id,
    {
      type: question.questionType,
      passageGroupId: question.passageGroupId
    },
    req.ip
  );
  const stageSync = await syncSectionsStage(
    [existingQuestion.rows[0]?.section_id, question.sectionId],
    req.session.userId,
    question.status === "published"
  );
  res.json({ question: saved.rows[0], syncedTests: stageSync });
});
adminRouter.patch("/questions/status", async (req, res) => {
  const input = z.object({
    questionIds: z.array(z.string().uuid()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, {
      message: "Question IDs must be unique."
    }),
    status: z.enum(["draft", "published", "archived"])
  }).parse(req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query(
      `SELECT q.id, s.stage_id, e.status exam_status
       FROM questions q
       JOIN exam_sections s ON s.id = q.section_id
       JOIN exam_stages st ON st.id = s.stage_id
       JOIN exams e ON e.id = st.exam_id
       WHERE q.id = ANY($1::uuid[])
       FOR UPDATE OF q, e`,
      [input.questionIds]
    );
    if (rows.rowCount !== input.questionIds.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "One or more selected questions no longer exist."
      });
    }
    await client.query(
      `UPDATE questions
       SET status = $2, updated_at = now()
       WHERE id = ANY($1::uuid[])`,
      [input.questionIds, input.status]
    );
    const touchedStageIds = [...new Set(rows.rows.map((row) => row.stage_id))];
    const syncedTests = [];
    for (const stageId of touchedStageIds) {
      const synced = await syncStageQuestionBankMockTest(
        client,
        stageId,
        req.session.userId,
        { autoPublishExam: input.status === "published" }
      );
      if (synced) syncedTests.push(synced);
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.session.userId,
        `question.bulk.${input.status}`,
        "question_batch",
        JSON.stringify({
          questionIds: input.questionIds,
          count: input.questionIds.length
        }),
        req.ip
      ]
    );
    await client.query("COMMIT");
    res.json({
      updated: input.questionIds.length,
      status: input.status,
      syncedTests
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
adminRouter.delete("/questions/:id", async (req, res) => {
  const result = await pool.query(
    `UPDATE questions
     SET status = 'archived', updated_at = now()
     WHERE id = $1
     RETURNING id, section_id`,
    [req.params.id]
  );
  if (!result.rowCount) {
    return res.status(404).json({ error: "Question not found." });
  }
  await audit(
    req.session.userId,
    "question.archive",
    "question",
    req.params.id,
    {},
    req.ip
  );
  await syncSectionsStage(
    [result.rows[0].section_id],
    req.session.userId,
    false
  );
  res.status(204).end();
});
async function decodeRows(data, name) {
  const buffer = Buffer.from(data, "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw Object.assign(new Error("Upload limit is 5 MB."), {
      status: 413
    });
  }
  let list;
  if (/\.csv$/i.test(name)) {
    list = parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: true
    });
  } else if (/\.xlsx$/i.test(name)) {
    const sheets = await readXlsxFile(buffer);
    const rows = sheets[0]?.data ?? [];
    const headers = (rows[0] ?? []).map((value) => String(value ?? "").trim());
    if (!headers.length) {
      throw Object.assign(new Error("Workbook contains no header row."), {
        status: 400
      });
    }
    list = rows.slice(1).filter(
      (row) => row.some(
        (cell) => cell !== null && cell !== void 0 && String(cell).trim()
      )
    ).map(
      (row) => Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""])
      )
    );
  } else {
    throw Object.assign(new Error("Upload a .csv or .xlsx file."), {
      status: 400
    });
  }
  return list.map(
    (row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.trim().toLowerCase(),
        String(value ?? "").trim()
      ])
    )
  );
}
const IMPORT_COLUMNS = [
  "exam_code",
  "stage",
  "section",
  "topic",
  "subtopic",
  "difficulty",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "explanation",
  "language",
  "source"
];
const REQUIRED_IMPORT_COLUMNS = IMPORT_COLUMNS.filter(
  (column) => column !== "source" && column !== "subtopic"
);
function rowErrors(row) {
  const errors = [];
  for (const key of REQUIRED_IMPORT_COLUMNS) {
    if (!row[key]) {
      errors.push(`Missing ${key}`);
    }
  }
  if (row.difficulty && !["easy", "medium", "hard"].includes(row.difficulty.toLowerCase())) {
    errors.push("Difficulty must be Easy, Medium, or Hard");
  }
  if (row.correct_answer && !["A", "B", "C", "D"].includes(row.correct_answer.toUpperCase())) {
    errors.push("Correct answer must be A, B, C, or D");
  }
  for (const key of ["marks", "negative_marks"]) {
    if (row[key] && (!Number.isFinite(Number(row[key])) || Number(row[key]) < 0)) {
      errors.push(`${key} must be non-negative`);
    }
  }
  if (row.source_year && (!/^\d{4}$/.test(row.source_year) || Number(row.source_year) < 1900 || Number(row.source_year) > 2100)) {
    errors.push("Source year must be a year between 1900 and 2100");
  }
  return errors;
}
adminRouter.get("/questions/import/template.csv", (_req, res) => {
  res.type("text/csv").attachment("hhk-question-template.csv").send(`${IMPORT_COLUMNS.join(",")}
`);
});
adminRouter.post("/questions/import/preview", async (req, res) => {
  const name = String(req.header("x-file-name") ?? "questions.csv");
  const decoded = await decodeRows(
    String(req.body.data ?? ""),
    name
  );
  if (decoded.length > 5e3) {
    return res.status(413).json({
      error: "Import at most 5,000 rows per batch."
    });
  }
  const rows = decoded.map((row, index) => ({
    rowNumber: index + 2,
    row,
    errors: rowErrors(row)
  }));
  const duplicateMap = /* @__PURE__ */ new Map();
  rows.forEach((item) => {
    const examCode = (item.row.exam_code ?? "").toLowerCase();
    const stage = (item.row.stage ?? "").toLowerCase();
    const section = (item.row.section ?? "").toLowerCase();
    const question = (item.row.question ?? "").toLowerCase();
    const key = `${examCode}:${stage}:${section}:${question}`;
    duplicateMap.set(key, [
      ...duplicateMap.get(key) ?? [],
      item.rowNumber
    ]);
  });
  for (const numbers of duplicateMap.values()) {
    if (numbers.length > 1) {
      for (const number of numbers) {
        rows.find((item) => item.rowNumber === number)?.errors.push("Duplicate question in upload");
      }
    }
  }
  const codes = [
    ...new Set(
      rows.map((item) => (item.row.exam_code ?? "").toUpperCase()).filter(Boolean)
    )
  ];
  const stages = [
    ...new Set(
      rows.map((item) => (item.row.stage ?? "").toLowerCase()).filter(Boolean)
    )
  ];
  const sections = [
    ...new Set(
      rows.map((item) => (item.row.section ?? "").toLowerCase()).filter(Boolean)
    )
  ];
  const pairs = (await pool.query(
    `SELECT
         upper(e.code) code,
         lower(st.name) stage,
         lower(s.name) section,
         lower(q.question_text) question
       FROM questions q
       JOIN exam_sections s ON s.id = q.section_id
       JOIN exam_stages st ON st.id = s.stage_id
       JOIN exams e ON e.id = st.exam_id
       WHERE upper(e.code) = ANY($1::text[])
         AND lower(st.name) = ANY($2::text[])
         AND lower(s.name) = ANY($3::text[])
         AND q.status <> 'archived'`,
    [codes, stages, sections]
  )).rows;
  const existing = new Set(
    pairs.map(
      (row) => `${row.code}:${row.stage}:${row.section}:${row.question}`
    )
  );
  const validPairs = (await pool.query(
    `SELECT DISTINCT
         upper(e.code) code,
         lower(st.name) stage,
         lower(s.name) section
       FROM exams e
       JOIN exam_stages st ON st.exam_id = e.id
       JOIN exam_sections s ON s.stage_id = st.id
       WHERE upper(e.code) = ANY($1::text[])
         AND lower(st.name) = ANY($2::text[])
         AND lower(s.name) = ANY($3::text[])`,
    [codes, stages, sections]
  )).rows;
  const known = new Set(
    validPairs.map((row) => `${row.code}:${row.stage}:${row.section}`)
  );
  for (const item of rows) {
    const examCode = (item.row.exam_code ?? "").toUpperCase();
    const stage = (item.row.stage ?? "").toLowerCase();
    const section = (item.row.section ?? "").toLowerCase();
    const question = (item.row.question ?? "").toLowerCase();
    const pair = `${examCode}:${stage}:${section}`;
    if (item.row.exam_code && !known.has(pair)) {
      item.errors.push("Unknown exam, stage, or section combination");
    }
    if (item.row.question && existing.has(`${pair}:${question}`)) {
      item.errors.push("Question already exists in the question bank");
    }
  }
  const errors = rows.filter((item) => item.errors.length);
  const duplicateCount = rows.filter(
    (item) => item.errors.some(
      (error) => error.startsWith("Duplicate") || error.includes("already exists")
    )
  ).length;
  const batch = (await pool.query(
    `INSERT INTO upload_batches
        (created_by, file_name, status, total_rows, valid_rows,
         invalid_rows, duplicate_rows, staged_rows)
       VALUES ($1, $2, 'validated', $3, $4, $5, $6, $7)
       RETURNING id`,
    [
      req.session.userId,
      name,
      rows.length,
      rows.length - errors.length,
      errors.length,
      duplicateCount,
      JSON.stringify(rows)
    ]
  )).rows[0];
  for (const item of errors) {
    await pool.query(
      `INSERT INTO upload_errors
        (batch_id, row_number, error_message, row_data)
       VALUES ($1, $2, $3, $4)`,
      [
        batch.id,
        item.rowNumber,
        item.errors.join("; "),
        JSON.stringify(item.row)
      ]
    );
  }
  const validCount = rows.length - errors.length;
  res.json({
    batchId: batch.id,
    total: rows.length,
    successful: validCount,
    failed: errors.length,
    duplicate: duplicateCount,
    minimumRequired: MIN_BANK_UPLOAD_QUESTIONS,
    meetsMinimum: validCount >= MIN_BANK_UPLOAD_QUESTIONS,
    errors: errors.map(({ rowNumber, errors: errors2 }) => ({
      rowNumber,
      errors: errors2
    }))
  });
});
adminRouter.post("/questions/import/:batchId/confirm", async (req, res) => {
  const input = z.object({
    rowNumbers: z.array(z.number().int().positive()).min(1)
  }).parse(req.body);
  const client = await pool.connect();
  let imported = 0;
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      `SELECT *
       FROM upload_batches
       WHERE id = $1
         AND created_by = $2
         AND status = 'validated'
       FOR UPDATE`,
      [req.params.batchId, req.session.userId]
    );
    if (!batch.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Validated upload batch not found."
      });
    }
    const staged = batch.rows[0].staged_rows;
    const rejected = new Set(
      (await client.query(
        "SELECT row_number FROM upload_errors WHERE batch_id = $1",
        [req.params.batchId]
      )).rows.map((row) => Number(row.row_number))
    );
    const selectedNumbers = [...new Set(input.rowNumbers)];
    const validItems = selectedNumbers.map((number) => staged.find((row) => row.rowNumber === number)).filter(
      (item) => Boolean(item) && !item.errors.length && !rejected.has(item.rowNumber)
    );
    if (validItems.length < MIN_BANK_UPLOAD_QUESTIONS) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `Minimum ${MIN_BANK_UPLOAD_QUESTIONS} valid questions are required to upload into the question bank (received ${validItems.length}).`
      });
    }
    const touchedStageIds = /* @__PURE__ */ new Set();
    for (const item of validItems) {
      const row = item.row;
      const section = await client.query(
        `SELECT s.id, st.id stage_id, s.marks_per_correct, s.negative_marks
         FROM exam_sections s
         JOIN exam_stages st ON st.id = s.stage_id
         JOIN exams e ON e.id = st.exam_id
         WHERE upper(e.code) = upper($1)
           AND lower(st.name) = lower($2)
           AND lower(s.name) = lower($3)
         LIMIT 1
         FOR UPDATE OF e, s`,
        [row.exam_code, row.stage, row.section]
      );
      if (!section.rowCount) continue;
      touchedStageIds.add(section.rows[0].stage_id);
      const subtopic = row.subtopic ? String(row.subtopic).trim() : "";
      const topic = (await client.query(
        `INSERT INTO topics(section_id, name)
           VALUES ($1, $2)
           ON CONFLICT(section_id, name)
           DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
        [section.rows[0].id, row.topic]
      )).rows[0];
      if (subtopic) {
        await client.query(
          `INSERT INTO topics(section_id, parent_topic_id, name)
             VALUES ($1, $2, $3)
             ON CONFLICT(section_id, name)
             DO UPDATE SET parent_topic_id = EXCLUDED.parent_topic_id`,
          [section.rows[0].id, topic.id, subtopic]
        );
      }
      const options = ["A", "B", "C", "D"].map((key) => ({
        key,
        text: row[`option_${key.toLowerCase()}`]
      }));
      const hash = crypto.createHash("sha256").update(`${section.rows[0].id}:${row.question.toLowerCase()}`).digest("hex");
      const saved = await client.query(
        `INSERT INTO questions
          (section_id, topic_id, topic_name, subtopic_name, difficulty, language,
           question_text, options, correct_answer, explanation,
           marks, negative_marks, source, source_year, status,
           created_by, content_hash)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, 'published', $15, $16)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          section.rows[0].id,
          topic.id,
          row.topic,
          subtopic,
          row.difficulty.toLowerCase(),
          row.language,
          row.question,
          JSON.stringify(options),
          row.correct_answer.toUpperCase(),
          row.explanation,
          row.marks ? Number(row.marks) : Number(section.rows[0].marks_per_correct ?? 1),
          row.negative_marks ? Number(row.negative_marks) : Number(section.rows[0].negative_marks ?? 0),
          row.source ?? "",
          row.source_year ? Number(row.source_year) : null,
          req.session.userId,
          hash
        ]
      );
      imported += saved.rowCount ?? 0;
    }
    const syncedTests = [];
    for (const stageId of touchedStageIds) {
      const synced = await syncStageQuestionBankMockTest(
        client,
        stageId,
        req.session.userId,
        { autoPublishExam: true }
      );
      if (synced) syncedTests.push(synced);
    }
    await client.query(
      `UPDATE upload_batches
       SET status = 'confirmed'
       WHERE id = $1`,
      [req.params.batchId]
    );
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'question.import.confirm', 'upload_batch', $2, $3, $4)`,
      [
        req.session.userId,
        req.params.batchId,
        JSON.stringify({ imported, syncedTests }),
        req.ip
      ]
    );
    await client.query("COMMIT");
    res.json({ imported, syncedTests });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});
function csvReportCell(value) {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
adminRouter.get("/questions/import/:batchId/errors.csv", async (req, res) => {
  const batch = await pool.query(
    "SELECT id FROM upload_batches WHERE id = $1 AND created_by = $2",
    [req.params.batchId, req.session.userId]
  );
  if (!batch.rowCount) {
    return res.status(404).json({ error: "Upload batch not found." });
  }
  const rows = await pool.query(
    `SELECT row_number, error_message, row_data
     FROM upload_errors
     WHERE batch_id = $1
     ORDER BY row_number`,
    [req.params.batchId]
  );
  const columns = [...IMPORT_COLUMNS];
  const output = [
    ["row_number", "errors", ...columns].map(csvReportCell).join(","),
    ...rows.rows.map(
      (row) => [
        row.row_number,
        row.error_message,
        ...columns.map((column) => row.row_data[column])
      ].map(csvReportCell).join(",")
    )
  ].join("\r\n");
  res.type("text/csv; charset=utf-8").attachment("hhk-question-import-errors.csv").send(`\uFEFF${output}`);
});
// ============================================================================
// MOCK TEST MANAGEMENT (Multi-Set Exam Wise + Topicwise + Generator + Publish Guard)
// ============================================================================

async function handleGetNextSet(req, res) {
  const testType = String(req.query.testType || req.query.test_type || "EXAM_WISE").toUpperCase();
  if (testType === "TOPIC_WISE") {
    const subject = String(req.query.subject || "").trim();
    const topic = String(req.query.topic || "").trim();
    if (!subject || !topic) {
      return res.status(400).json({ error: "Provide subject and topic to compute next set number." });
    }
    const info = await getNextSetInfo(pool, { testType: "TOPIC_WISE", subject, topic });
    return res.json({
      ...info,
      suggestedName: `${topic} - ${info.suggestedSetLabel}`,
      autoGeneratorSupported: isTopicAutoGeneratableAll(topic),
    });
  }
  const examId = String(req.query.examId || "").trim();
  const stageId = String(req.query.stageId || "").trim();
  if (!examId || !stageId) {
    return res.status(400).json({ error: "Provide examId and stageId to compute next set number." });
  }
  const info = await getNextSetInfo(pool, { testType: "EXAM_WISE", examId, stageId });
  const meta = await pool.query(
    `SELECT e.name exam_name, st.name stage_name
     FROM exam_stages st JOIN exams e ON e.id = st.exam_id
     WHERE st.id = $1 AND e.id = $2`,
    [stageId, examId]
  );
  const labelPrefix = meta.rowCount ? `${meta.rows[0].exam_name} ${meta.rows[0].stage_name}` : "Exam Mock";
  return res.json({
    ...info,
    suggestedName: `${labelPrefix} - ${info.suggestedSetLabel}`,
  });
}

adminRouter.get("/tests/next-set", handleGetNextSet);
adminRouter.get("/mock-tests/next-set", handleGetNextSet);

async function handleListTests(req, res) {
  const testType = req.query.testType || req.query.test_type || null;
  const subject = req.query.subject ? String(req.query.subject).trim() : null;
  const topic = req.query.topic ? String(req.query.topic).trim() : null;

  const testsRes = await pool.query(
    `SELECT
       t.*,
       e.name exam_name,
       e.status exam_status,
       e.category exam_category,
       st.name stage_name,
       (SELECT count(*) FROM mock_test_questions
        WHERE mock_test_id = t.id)::int question_count,
       (SELECT count(*) FROM mock_test_questions mtq
        JOIN questions q ON q.id = mtq.question_id
        WHERE mtq.mock_test_id = t.id AND q.status = 'published')::int published_question_count,
       (SELECT count(*) FROM test_attempts ta
        WHERE ta.mock_test_id = t.id)::int attempt_count,
       ARRAY(
         SELECT question_id
         FROM mock_test_questions
         WHERE mock_test_id = t.id
         ORDER BY sort_order
       ) question_ids
     FROM mock_tests t
     LEFT JOIN exams e ON e.id = t.exam_id
     LEFT JOIN exam_stages st ON st.id = t.stage_id
     WHERE ($1::text IS NULL OR t.test_type = $1)
       AND ($2::text IS NULL OR LOWER(t.subject) = LOWER($2))
       AND ($3::text IS NULL OR LOWER(t.topic) = LOWER($3))
     ORDER BY t.test_type ASC, t.subject ASC NULLS LAST, t.topic ASC NULLS LAST, t.set_number ASC, t.created_at DESC`,
    [testType ? String(testType).toUpperCase() : null, subject, topic]
  );

  const enriched = await Promise.all(
    testsRes.rows.map(async (t) => {
      if (t.test_type === "EXAM_WISE" && t.stage_id) {
        const blueprint = await getExamWiseBlueprintProgress(pool, {
          testId: t.id,
          stageId: t.stage_id,
          durationSeconds: t.duration_seconds,
          autoGenerated: Boolean(t.auto_generated),
        });
        return {
          ...t,
          blueprint_progress: blueprint,
          ready_to_publish: t.exam_status === "published" && blueprint.isComplete,
        };
      }
      const target = Number(t.target_questions || 0);
      const publishedCount = Number(t.published_question_count || 0);
      return {
        ...t,
        blueprint_progress: null,
        auto_generator_supported: isTopicAutoGeneratableAll(t.topic),
        ready_to_publish: target > 0 && publishedCount === target,
      };
    })
  );

  res.json({ tests: enriched });
}

adminRouter.get("/tests", handleListTests);
adminRouter.get("/mock-tests", handleListTests);

adminRouter.get("/mock-tests/:id/questions", async (req, res) => {
  const testRes = await pool.query(
    `SELECT t.id, t.name, t.test_type, t.subject, t.topic, t.set_number, t.set_label,
            t.target_questions, t.duration_seconds, t.status
     FROM mock_tests t WHERE t.id = $1`,
    [req.params.id]
  );
  if (!testRes.rowCount) {
    return res.status(404).json({ error: "Mock test not found." });
  }
  const qRows = await pool.query(
    `SELECT q.id, q.section_id, s.name section_name, q.topic_name, q.subtopic_name,
            q.difficulty, q.question_type, q.question_text, q.options,
            q.correct_answer, q.explanation, q.marks, q.negative_marks, q.status,
            mtq.sort_order
     FROM mock_test_questions mtq
     JOIN questions q ON q.id = mtq.question_id
     JOIN exam_sections s ON s.id = mtq.section_id
     WHERE mtq.mock_test_id = $1
     ORDER BY mtq.sort_order ASC`,
    [req.params.id]
  );
  res.json({ test: testRes.rows[0], questions: qRows.rows });
});

// Create EXAM_WISE Mock Test Draft (with multi-set auto-increment support)
adminRouter.post("/tests", async (req, res) => {
  const input = validate(mockTestDraftSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stageCheck = await client.query(
      `SELECT st.id, COALESCE(SUM(s.question_count), 0)::int total_questions
       FROM exam_stages st
       LEFT JOIN exam_sections s ON s.stage_id = st.id
       WHERE st.id = $1 AND st.exam_id = $2
       GROUP BY st.id`,
      [input.stageId, input.examId]
    );
    if (!stageCheck.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Stage does not belong to the selected examination."
      });
    }
    const nextInfo = await getNextSetInfo(client, {
      testType: "EXAM_WISE",
      examId: input.examId,
      stageId: input.stageId,
    });
    const setNumber = input.setNumber ?? nextInfo.nextSetNumber;
    const setLabel = (input.setLabel || `Set ${setNumber}`).trim();
    const targetQuestions = Number(stageCheck.rows[0].total_questions || 0);

    const questions = await resolveMockTestQuestions(client, input);
    const test = (await client.query(
      `INSERT INTO mock_tests
          (exam_id, stage_id, test_type, set_number, set_label, target_questions,
           name, description, duration_seconds,
           review_policy, selection_mode, selection_rules,
           availability_start, availability_end, status, created_by)
         VALUES ($1, $2, 'EXAM_WISE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft', $14)
         RETURNING *`,
      [
        input.examId,
        input.stageId,
        setNumber,
        setLabel,
        targetQuestions,
        input.name,
        input.description,
        input.durationSeconds,
        input.reviewPolicy,
        input.selectionMode,
        JSON.stringify(input.selectionRules),
        input.availabilityStart,
        input.availabilityEnd,
        req.session.userId
      ]
    )).rows[0];
    for (const [index, question] of questions.entries()) {
      await client.query(
        `INSERT INTO mock_test_questions
          (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [test.id, question.id, question.section_id, index]
      );
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.create', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        test.id,
        JSON.stringify({
          testType: "EXAM_WISE",
          setNumber,
          setLabel,
          selectionMode: input.selectionMode,
          assignedCount: questions.length,
        }),
        req.ip
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({ test });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Update EXAM_WISE Mock Test Draft
adminRouter.put("/tests/:id", async (req, res) => {
  const input = validate(mockTestDraftSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT status, test_type, set_number, set_label FROM mock_tests WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mock test not found." });
    }
    if (current.rows[0].status !== "draft") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "Only draft mock tests can be edited."
      });
    }
    const attempts = await client.query(
      "SELECT 1 FROM test_attempts WHERE mock_test_id = $1 LIMIT 1",
      [req.params.id]
    );
    if (attempts.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "This test has attempt history and can no longer be edited."
      });
    }
    const stageCheck = await client.query(
      `SELECT st.id, COALESCE(SUM(s.question_count), 0)::int total_questions
       FROM exam_stages st
       LEFT JOIN exam_sections s ON s.stage_id = st.id
       WHERE st.id = $1 AND st.exam_id = $2
       GROUP BY st.id`,
      [input.stageId, input.examId]
    );
    if (!stageCheck.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Stage does not belong to the selected examination."
      });
    }
    const setNumber = input.setNumber ?? current.rows[0].set_number ?? 1;
    const setLabel = (input.setLabel || current.rows[0].set_label || `Set ${setNumber}`).trim();
    const targetQuestions = Number(stageCheck.rows[0].total_questions || 0);

    const questions = await resolveMockTestQuestions(client, input, req.params.id);
    await client.query(
      `UPDATE mock_tests
       SET exam_id = $2,
           stage_id = $3,
           set_number = $4,
           set_label = $5,
           target_questions = $6,
           name = $7,
           description = $8,
           duration_seconds = $9,
           review_policy = $10,
           selection_mode = $11,
           selection_rules = $12,
           availability_start = $13,
           availability_end = $14,
           updated_at = now()
       WHERE id = $1`,
      [
        req.params.id,
        input.examId,
        input.stageId,
        setNumber,
        setLabel,
        targetQuestions,
        input.name,
        input.description,
        input.durationSeconds,
        input.reviewPolicy,
        input.selectionMode,
        JSON.stringify(input.selectionRules),
        input.availabilityStart,
        input.availabilityEnd
      ]
    );
    await client.query(
      "DELETE FROM mock_test_questions WHERE mock_test_id = $1",
      [req.params.id]
    );
    for (const [index, question] of questions.entries()) {
      await client.query(
        `INSERT INTO mock_test_questions
          (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, question.id, question.section_id, index]
      );
    }
    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.update', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        req.params.id,
        JSON.stringify({ selectionMode: input.selectionMode, setNumber, setLabel }),
        req.ip
      ]
    );
    await client.query("COMMIT");
    res.json({
      test: {
        id: req.params.id,
        status: "draft"
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Complete Delete for Mock Test Set (EXAM_WISE or TOPIC_WISE)
async function handleDeleteMockTest(req, res) {
  const force = String(req.query.force || "").toLowerCase() === "true";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id, name, test_type, set_number, set_label, status, exam_id, stage_id
       FROM mock_tests
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mock test not found." });
    }
    const testRow = existing.rows[0];

    // Protect financial records: payment_orders references mock_tests with ON DELETE RESTRICT
    const ordersRes = await client.query(
      "SELECT count(*)::int AS cnt FROM payment_orders WHERE mock_test_id = $1",
      [req.params.id]
    );
    const orderCount = Number(ordersRes.rows[0]?.cnt || 0);
    if (orderCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Cannot permanently delete "${testRow.name}" because ${orderCount} payment order record(s) reference it. Unpublish or archive it instead to preserve payment history.`,
        orderCount,
      });
    }

    // Check student test_attempts (ON DELETE RESTRICT)
    const attemptsRes = await client.query(
      "SELECT count(*)::int AS cnt FROM test_attempts WHERE mock_test_id = $1",
      [req.params.id]
    );
    const attemptCount = Number(attemptsRes.rows[0]?.cnt || 0);
    if (attemptCount > 0 && !force) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `"${testRow.name}" has ${attemptCount} student attempt(s). Confirm force deletion to permanently remove this test set and its attempt records.`,
        attemptCount,
        requiresForce: true,
      });
    }

    if (attemptCount > 0 && force) {
      await client.query(
        "DELETE FROM test_attempts WHERE mock_test_id = $1",
        [req.params.id]
      );
    }

    // Deleting mock_tests cascades to mock_test_questions, leaderboard_entries,
    // subscription_plan_tests, user_test_entitlements, and ga_marathon_* tables.
    // Original questions in the Question Bank remain completely untouched.
    await client.query("DELETE FROM mock_tests WHERE id = $1", [req.params.id]);

    await client.query(
      `INSERT INTO audit_logs
        (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.delete', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        testRow.id,
        JSON.stringify({
          name: testRow.name,
          testType: testRow.test_type,
          setNumber: testRow.set_number,
          setLabel: testRow.set_label,
          previousStatus: testRow.status,
          deletedAttempts: attemptCount,
          force,
        }),
        req.ip,
      ]
    );

    await client.query("COMMIT");
    res.json({
      deleted: true,
      id: testRow.id,
      name: testRow.name,
      deletedAttempts: attemptCount,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

adminRouter.delete("/tests/:id", handleDeleteMockTest);
adminRouter.delete("/mock-tests/:id", handleDeleteMockTest);

// Create TOPIC_WISE Mock Test Set (with strict single-topic validation)
adminRouter.post("/mock-tests/topicwise", async (req, res) => {
  const input = validate(topicwiseTestSchema, req.body);
  const durationSeconds = input.durationSeconds ?? Number(input.durationMinutes) * 60;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const nextInfo = await getNextSetInfo(client, {
      testType: "TOPIC_WISE",
      subject: input.subject,
      topic: input.topic,
    });
    const setNumber = input.setNumber ?? nextInfo.nextSetNumber;
    const setLabel = (input.setLabel || `Set ${setNumber}`).trim();
    const name = (input.name || `${input.topic} - ${setLabel}`).trim();

    let validatedQuestions = [];
    if (input.questionIds.length) {
      if (input.questionIds.length > input.targetQuestions) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Selected ${input.questionIds.length} questions, which exceeds the target count of ${input.targetQuestions}.`,
        });
      }
      const qRes = await client.query(
        `SELECT q.id, q.section_id, q.topic_name, q.status
         FROM unnest($1::uuid[]) WITH ORDINALITY wanted(id, pos)
         JOIN questions q ON q.id = wanted.id
         ORDER BY wanted.pos`,
        [input.questionIds]
      );
      if (qRes.rowCount !== input.questionIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "One or more selected questions do not exist." });
      }
      const unpublished = qRes.rows.filter((q) => q.status !== "published");
      if (unpublished.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "All assigned questions must be published." });
      }
      const offTopic = qRes.rows.filter((q) => !isQuestionMatchingTopic(q.topic_name, input.topic));
      if (offTopic.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Strict topic filter violation: ${offTopic.length} selected question(s) do not belong to "${input.topic}".`,
        });
      }
      await assertCompleteRcPassageSets(client, qRes.rows.map((r) => r.id));
      validatedQuestions = qRes.rows;
    }

    const test = (
      await client.query(
        `INSERT INTO mock_tests
          (exam_id, stage_id, test_type, set_number, set_label, subject, topic,
           target_questions, marks_per_question, negative_marks,
           name, description, duration_seconds, review_policy, selection_mode,
           availability_start, availability_end, status, created_by)
         VALUES (NULL, NULL, 'TOPIC_WISE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual', $12, $13, 'draft', $14)
         RETURNING *`,
        [
          setNumber,
          setLabel,
          input.subject,
          input.topic,
          input.targetQuestions,
          input.marksPerQuestion,
          input.negativeMarks,
          name,
          input.description,
          durationSeconds,
          input.reviewPolicy,
          input.availabilityStart,
          input.availabilityEnd,
          req.session.userId,
        ]
      )
    ).rows[0];

    for (const [idx, q] of validatedQuestions.entries()) {
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [test.id, q.id, q.section_id, idx]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.topicwise_create', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        test.id,
        JSON.stringify({
          subject: input.subject,
          topic: input.topic,
          setNumber,
          setLabel,
          targetQuestions: input.targetQuestions,
          assignedCount: validatedQuestions.length,
        }),
        req.ip,
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({
      test: {
        ...test,
        question_count: validatedQuestions.length,
        question_ids: validatedQuestions.map((q) => q.id),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Update TOPIC_WISE Mock Test Draft
adminRouter.put("/mock-tests/topicwise/:id", async (req, res) => {
  const input = validate(topicwiseTestSchema, req.body);
  const durationSeconds = input.durationSeconds ?? Number(input.durationMinutes) * 60;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      "SELECT * FROM mock_tests WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!current.rowCount || current.rows[0].test_type !== "TOPIC_WISE") {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Topicwise test not found." });
    }
    if (current.rows[0].status !== "draft") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Unpublish this test to draft before editing it." });
    }
    const attempts = await client.query(
      "SELECT 1 FROM test_attempts WHERE mock_test_id = $1 LIMIT 1",
      [req.params.id]
    );
    if (attempts.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This test has student attempt history and cannot be edited." });
    }

    const setNumber = input.setNumber ?? current.rows[0].set_number ?? 1;
    const setLabel = (input.setLabel || current.rows[0].set_label || `Set ${setNumber}`).trim();
    const name = (input.name || `${input.topic} - ${setLabel}`).trim();

    let validatedQuestions = [];
    if (input.questionIds.length) {
      if (input.questionIds.length > input.targetQuestions) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Selected ${input.questionIds.length} questions, which exceeds the target count of ${input.targetQuestions}.`,
        });
      }
      const qRes = await client.query(
        `SELECT q.id, q.section_id, q.topic_name, q.status
         FROM unnest($1::uuid[]) WITH ORDINALITY wanted(id, pos)
         JOIN questions q ON q.id = wanted.id
         ORDER BY wanted.pos`,
        [input.questionIds]
      );
      if (qRes.rowCount !== input.questionIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "One or more selected questions do not exist." });
      }
      if (qRes.rows.some((q) => q.status !== "published")) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "All assigned questions must be published." });
      }
      const offTopic = qRes.rows.filter((q) => !isQuestionMatchingTopic(q.topic_name, input.topic));
      if (offTopic.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Strict topic filter violation: ${offTopic.length} selected question(s) do not belong to "${input.topic}".`,
        });
      }
      await assertCompleteRcPassageSets(client, qRes.rows.map((r) => r.id));
      validatedQuestions = qRes.rows;
    }

    const updated = (
      await client.query(
        `UPDATE mock_tests
         SET subject = $2,
             topic = $3,
             set_number = $4,
             set_label = $5,
             target_questions = $6,
             marks_per_question = $7,
             negative_marks = $8,
             name = $9,
             description = $10,
             duration_seconds = $11,
             review_policy = $12,
             availability_start = $13,
             availability_end = $14,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          req.params.id,
          input.subject,
          input.topic,
          setNumber,
          setLabel,
          input.targetQuestions,
          input.marksPerQuestion,
          input.negativeMarks,
          name,
          input.description,
          durationSeconds,
          input.reviewPolicy,
          input.availabilityStart,
          input.availabilityEnd,
        ]
      )
    ).rows[0];

    await client.query("DELETE FROM mock_test_questions WHERE mock_test_id = $1", [req.params.id]);
    for (const [idx, q] of validatedQuestions.entries()) {
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, q.id, q.section_id, idx]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.topicwise_update', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        req.params.id,
        JSON.stringify({ subject: input.subject, topic: input.topic, setNumber, assignedCount: validatedQuestions.length }),
        req.ip,
      ]
    );
    await client.query("COMMIT");
    res.json({ test: updated });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// 1-Click Auto-Generate Fresh Questions Strictly for a Topicwise Test Set
adminRouter.post("/mock-tests/:id/generate-topic-questions", async (req, res) => {
  const input = validate(generateTopicTestQuestionsSchema, req.body ?? {});
  const testRes = await pool.query("SELECT * FROM mock_tests WHERE id = $1", [req.params.id]);
  if (!testRes.rowCount) {
    return res.status(404).json({ error: "Mock test not found." });
  }
  const test = testRes.rows[0];
  if (test.test_type !== "TOPIC_WISE") {
    return res.status(400).json({ error: "Topicwise auto-generation is only available for Topicwise Tests." });
  }
  if (test.status !== "draft" && !input.previewOnly) {
    return res.status(409).json({ error: "Unpublish this Topicwise Test to draft before generating new questions." });
  }
  if (!isTopicAutoGeneratableAll(test.topic)) {
    return res.status(400).json({
      error: `Auto-generation is not yet available for "${test.topic}". Pick questions manually from the Question Bank.`,
    });
  }

  const currentAssignedRes = await pool.query(
    "SELECT count(*)::int total FROM mock_test_questions WHERE mock_test_id = $1",
    [test.id]
  );
  const currentAssigned = Number(currentAssignedRes.rows[0]?.total ?? 0);
  const target = Number(test.target_questions || 20);
  const needed = input.replaceExisting
    ? input.count ?? target
    : input.count ?? Math.max(1, target - currentAssigned);

  if (!input.previewOnly && !input.replaceExisting && currentAssigned + needed > target) {
    return res.status(400).json({
      error: `Generating ${needed} questions would exceed target (${target}). Currently ${currentAssigned}/${target} assigned.`,
    });
  }

  // Gather question texts already used in earlier sets of the same topic to avoid duplicates
  const priorTextsRes = await pool.query(
    `SELECT DISTINCT LOWER(btrim(q.question_text)) norm_text
     FROM mock_test_questions mtq
     JOIN mock_tests mt ON mt.id = mtq.mock_test_id
     JOIN questions q ON q.id = mtq.question_id
     WHERE mt.test_type = 'TOPIC_WISE'
       AND LOWER(mt.topic) = LOWER($1)
       AND mt.status <> 'archived'`,
    [test.topic]
  );
  const usedTexts = new Set(priorTextsRes.rows.map((r) => r.norm_text));

  let generated;
  if (isReadingComprehensionTopic(test.topic)) {
    const requestedRcCategory = String(req.body?.rcCategory || "").trim();
    const passageLength = ["short", "medium", "long"].includes(String(req.body?.passageLength || "").toLowerCase())
      ? String(req.body.passageLength).toLowerCase()
      : "medium";
    const dbDifficulty = input.difficulty === "auto" ? "medium" : input.difficulty;
    const rcDifficulty = dbDifficulty === "medium" ? "moderate" : dbDifficulty;

    // Enforce atomic 5-question passage sets for Reading Comprehension (1 passage + 5 questions = 1 set)
    const RC_SET_SIZE = 5;
    if (needed < RC_SET_SIZE || needed % RC_SET_SIZE !== 0) {
      return res.status(400).json({
        error: `Reading Comprehension must be generated in complete 5-question passage sets (5, 10, 15, 20, 25, or 30 questions). Requested: ${needed}.`,
      });
    }
    const passageCount = needed / RC_SET_SIZE;
    const basePerPassage = RC_SET_SIZE;
    const remainder = 0;
    const passageSets = [];
    const generatedTitles = [];

    for (let pIdx = 0; pIdx < passageCount; pIdx += 1) {
      const qForThisPassage = basePerPassage + (pIdx < remainder ? 1 : 0);
      const chosenCategory =
        requestedRcCategory && RC_ALL_CATEGORIES.includes(requestedRcCategory)
          ? requestedRcCategory
          : RC_SUBJECT_CATEGORIES[pIdx % RC_SUBJECT_CATEGORIES.length];

      const combined = await generateRcPassageAndQuestionsWithAi({
        examination: input.examCode || "IBPS PO",
        category: chosenCategory,
        difficulty: rcDifficulty,
        passageLength,
        questionsPerPassage: qForThisPassage,
        questionTypes: [],
        optionCount: 5,
        includeExplanations: true,
        includeVocabulary: false,
        avoidTitles: generatedTitles,
      });
      generatedTitles.push(combined.passage.title);

      passageSets.push({
        passage: {
          title: combined.passage.title,
          passageText: combined.passage.passage_text,
        },
        questions: combined.questions.map((q) => ({
          questionText: q.question_text,
          subtopicName: q.question_type || chosenCategory,
          difficulty: dbDifficulty,
          options: q.options,
          correctAnswer: q.correct_answer,
          explanation: q.passage_reference
            ? `${q.explanation} (Passage Reference: "${q.passage_reference}")`
            : q.explanation,
        })),
      });
    }
    generated = { mode: "passage_sets", passageSets };
  } else {
    // Generate with a small buffer so we can filter out any collisions with earlier sets
    const bufferCount = Math.min(100, needed + Math.min(15, Math.ceil(needed * 0.4)));
    generated = generateTopicQuestions({
      examCode: input.examCode,
      stageName: input.stageName,
      topicName: test.topic,
      subtopicName: input.subtopicName,
      difficulty: input.difficulty === "auto" ? "medium" : input.difficulty,
      count: bufferCount,
      optionCount: 5,
    });
  }

  const deduplicatedStandalone = [];
  if (generated.mode === "standalone") {
    const batchSeen = new Set();
    for (const q of generated.standaloneQuestions) {
      const norm = String(q.questionText || "").trim().toLowerCase();
      if (batchSeen.has(norm)) continue;
      if (!usedTexts.has(norm)) {
        batchSeen.add(norm);
        deduplicatedStandalone.push(q);
      }
      if (deduplicatedStandalone.length === needed) break;
    }
    // Top up if the pool was tight
    if (deduplicatedStandalone.length < needed) {
      for (const q of generated.standaloneQuestions) {
        const norm = String(q.questionText || "").trim().toLowerCase();
        if (!batchSeen.has(norm)) {
          batchSeen.add(norm);
          deduplicatedStandalone.push(q);
        }
        if (deduplicatedStandalone.length === needed) break;
      }
    }
  }

  if (input.previewOnly) {
    return res.json({
      preview: true,
      mode: generated.mode,
      topic: test.topic,
      requestedCount: needed,
      passageSets: generated.mode === "passage_sets" ? generated.passageSets : [],
      standaloneQuestions: generated.mode === "standalone" ? deduplicatedStandalone : [],
    });
  }

  const section = await resolveSectionForSubject(pool, test.subject);
  if (!section) {
    return res.status(409).json({
      error: "No exam section exists in the database to anchor generated questions. Configure at least one exam section first.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const topicRow = (
      await client.query(
        `INSERT INTO topics(section_id, name)
         VALUES ($1, $2)
         ON CONFLICT(section_id, name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [section.id, test.topic]
      )
    ).rows[0];

    if (input.replaceExisting) {
      await client.query("DELETE FROM mock_test_questions WHERE mock_test_id = $1", [test.id]);
    }

    const startOrderRes = await client.query(
      "SELECT COALESCE(MAX(sort_order), -1)::int max_order FROM mock_test_questions WHERE mock_test_id = $1",
      [test.id]
    );
    let nextOrder = Number(startOrderRes.rows[0]?.max_order ?? -1) + 1;

    const marks = Number(test.marks_per_question ?? 1);
    const negativeMarks = Number(test.negative_marks ?? 0.25);
    const insertedQuestions = [];

    if (generated.mode === "passage_sets") {
      let remaining = needed;
      for (const setItem of generated.passageSets) {
        if (remaining <= 0) break;
        const slice = setItem.questions.slice(0, remaining);
        const pgRes = await client.query(
          `INSERT INTO passage_groups (section_id, title, passage_text, language, created_by)
           VALUES ($1, $2, $3, 'English', $4)
           RETURNING id`,
          [section.id, setItem.passage.title, setItem.passage.passageText, req.session.userId]
        );
        const pgId = pgRes.rows[0].id;
        for (const q of slice) {
          const salt = crypto.randomBytes(3).toString("hex");
          const hash = crypto
            .createHash("sha256")
            .update(`${section.id}:${q.questionText.toLowerCase()}:${salt}`)
            .digest("hex");
          const qRes = await client.query(
            `INSERT INTO questions
              (section_id, topic_id, topic_name, subtopic_name, difficulty, question_type,
               language, question_text, options, correct_answer, explanation,
               marks, negative_marks, source, status, created_by, passage_group_id, content_hash)
             VALUES
              ($1, $2, $3, $4, $5, 'passage', 'English', $6, $7, $8, $9, $10, $11, $12, 'published', $13, $14, $15)
             RETURNING id, question_text, topic_name, subtopic_name, difficulty, options, correct_answer, explanation`,
            [
              section.id,
              topicRow.id,
              test.topic,
              q.subtopicName || input.subtopicName || "",
              q.difficulty || (input.difficulty === "auto" ? "medium" : input.difficulty),
              q.questionText,
              JSON.stringify(q.options),
              q.correctAnswer,
              q.explanation,
              marks,
              negativeMarks,
              "HHK Topicwise Auto-Generator",
              req.session.userId,
              pgId,
              hash,
            ]
          );
          const inserted = qRes.rows[0];
          await client.query(
            `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [test.id, inserted.id, section.id, nextOrder++]
          );
          insertedQuestions.push(inserted);
          remaining--;
        }
      }
    } else {
      for (const q of deduplicatedStandalone) {
        const salt = crypto.randomBytes(3).toString("hex");
        const hash = crypto
          .createHash("sha256")
          .update(`${section.id}:${q.questionText.toLowerCase()}:${salt}`)
          .digest("hex");
        const qRes = await client.query(
          `INSERT INTO questions
            (section_id, topic_id, topic_name, subtopic_name, difficulty, question_type,
             language, question_text, options, correct_answer, explanation,
             marks, negative_marks, source, status, created_by, content_hash)
           VALUES
            ($1, $2, $3, $4, $5, 'mcq', 'English', $6, $7, $8, $9, $10, $11, $12, 'published', $13, $14)
           RETURNING id, question_text, topic_name, subtopic_name, difficulty, options, correct_answer, explanation`,
          [
            section.id,
            topicRow.id,
            test.topic,
            q.subtopicName || input.subtopicName || "",
            q.difficulty || (input.difficulty === "auto" ? "medium" : input.difficulty),
            q.questionText,
            JSON.stringify(q.options),
            q.correctAnswer,
            q.explanation,
            marks,
            negativeMarks,
            generated.engine === "HHK_QUESTION_ENGINE_V2"
              ? "HHK Question Engine V2 (Topicwise)"
              : "HHK Topicwise Auto-Generator",
            req.session.userId,
            hash,
          ]
        );
        const inserted = qRes.rows[0];
        await client.query(
          `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [test.id, inserted.id, section.id, nextOrder++]
        );
        insertedQuestions.push(inserted);
      }
    }

    const finalCountRes = await client.query(
      "SELECT count(*)::int total FROM mock_test_questions WHERE mock_test_id = $1",
      [test.id]
    );
    const assignedCount = Number(finalCountRes.rows[0]?.total ?? 0);

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.generate_topic_questions', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        test.id,
        JSON.stringify({
          topic: test.topic,
          generatedCount: insertedQuestions.length,
          assignedCount,
          targetQuestions: target,
        }),
        req.ip,
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({
      generatedCount: insertedQuestions.length,
      assignedCount,
      targetQuestions: target,
      readyToPublish: assignedCount === target,
      questions: insertedQuestions,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Duplicate any Exam Wise or Topicwise Test as the next Set (Set N+1) in draft state
adminRouter.post("/mock-tests/:id/duplicate", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sourceRes = await client.query("SELECT * FROM mock_tests WHERE id = $1", [req.params.id]);
    if (!sourceRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mock test not found." });
    }
    const src = sourceRes.rows[0];
    const nextInfo = await getNextSetInfo(client, {
      testType: src.test_type,
      examId: src.exam_id,
      stageId: src.stage_id,
      subject: src.subject,
      topic: src.topic,
    });
    const nextSetNumber = nextInfo.nextSetNumber;
    const nextSetLabel = `Set ${nextSetNumber}`;
    const baseName = src.name.replace(/\s*-\s*Set\s*\d+$/i, "").trim();
    const nextName = `${baseName} - ${nextSetLabel}`;

    const created = (
      await client.query(
        `INSERT INTO mock_tests
          (exam_id, stage_id, test_type, set_number, set_label, subject, topic,
           target_questions, marks_per_question, negative_marks,
           name, description, duration_seconds, review_policy, selection_mode, selection_rules,
           status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'draft', $17)
         RETURNING *`,
        [
          src.exam_id,
          src.stage_id,
          src.test_type,
          nextSetNumber,
          nextSetLabel,
          src.subject,
          src.topic,
          src.target_questions,
          src.marks_per_question,
          src.negative_marks,
          nextName,
          src.description,
          src.duration_seconds,
          src.review_policy,
          src.selection_mode,
          JSON.stringify(src.selection_rules ?? []),
          req.session.userId,
        ]
      )
    ).rows[0];

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.duplicate_set', 'mock_test', $2, $3, $4)`,
      [
        req.session.userId,
        created.id,
        JSON.stringify({ sourceTestId: src.id, setNumber: nextSetNumber, setLabel: nextSetLabel }),
        req.ip,
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({ test: created });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Strict Publish / Unpublish Handler (shared by PATCH /mock-tests/:id/publish & PATCH /tests/:id/status)
async function handleTestStatusChange(req, res, forcedStatus = null) {
  const rawStatus = forcedStatus ?? req.body?.status;
  const normalizedStatus = typeof rawStatus === "string" ? rawStatus.toLowerCase() : rawStatus;
  const input = z.object({
    status: z.enum(["draft", "published", "archived"])
  }).parse({ status: normalizedStatus });

  if (input.status === "published") {
    const check = await validateTestForPublish(pool, req.params.id);
    if (!check.ok) {
      return res.status(check.statusCode || 400).json({
        error: check.error,
        details: check.details ?? null,
      });
    }
  }

  const result = await pool.query(
    "UPDATE mock_tests SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status, test_type, set_number, set_label",
    [req.params.id, input.status]
  );
  if (!result.rowCount) {
    return res.status(404).json({ error: "Mock test not found." });
  }
  await audit(
    req.session.userId,
    `mock_test.${input.status}`,
    "mock_test",
    req.params.id,
    { testType: result.rows[0].test_type, setLabel: result.rows[0].set_label },
    req.ip
  );
  res.json({ test: result.rows[0] });
}

adminRouter.patch("/mock-tests/:id/publish", async (req, res) => {
  const targetStatus = req.body?.status ? req.body.status : "published";
  return handleTestStatusChange(req, res, targetStatus);
});

adminRouter.patch("/tests/:id/status", async (req, res) => {
  return handleTestStatusChange(req, res);
});
adminRouter.get("/descriptive-responses", async (_req, res) => {
  const rows = await pool.query(`
    SELECT
      'mock' response_type,
      ta.id attempt_id,
      NULL::uuid practice_session_id,
      sa.question_id,
      sa.selected_answer response,
      sa.question_snapshot->>'question_text' question_text,
      sa.question_snapshot->>'explanation' grading_rubric,
      (sa.question_snapshot->>'marks')::numeric max_marks,
      sa.time_spent_seconds,
      u.full_name student_name,
      u.email,
      t.name test_name,
      e.name exam_name,
      ta.submitted_at
    FROM student_answers sa
    JOIN test_attempts ta ON ta.id = sa.attempt_id
    JOIN users u ON u.id = ta.student_id
    JOIN mock_tests t ON t.id = ta.mock_test_id
    JOIN exams e ON e.id = t.exam_id
    WHERE ta.status <> 'in_progress'
      AND sa.question_snapshot->>'question_type' = 'descriptive'
      AND sa.selected_answer IS NOT NULL
      AND sa.manual_score IS NULL
      AND t.status = 'published'

    UNION ALL

    SELECT
      'practice',
      NULL::uuid,
      ps.id,
      pa.question_id,
      pa.selected_answer,
      q.question_text,
      q.explanation,
      q.marks,
      pa.time_spent_seconds,
      u.full_name,
      u.email,
      'Topic practice',
      e.name,
      pa.answered_at
    FROM practice_answers pa
    JOIN practice_sessions ps ON ps.id = pa.session_id
    JOIN users u ON u.id = ps.student_id
    JOIN questions q ON q.id = pa.question_id
    JOIN exam_sections s ON s.id = q.section_id
    JOIN exam_stages st ON st.id = s.stage_id
    JOIN exams e ON e.id = st.exam_id
    WHERE q.question_type = 'descriptive'
      AND pa.selected_answer IS NOT NULL
      AND pa.manual_score IS NULL
      AND q.status = 'published'
      AND e.status = 'published'

    ORDER BY submitted_at, student_name
    LIMIT 500
  `);
  res.json({ responses: rows.rows });
});
adminRouter.put(
  "/practice-sessions/:sessionId/answers/:questionId/grade",
  async (req, res) => {
    const input = z.object({
      score: z.number().nonnegative().max(100),
      comment: z.string().trim().max(5e3).default("")
    }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = await client.query(
        `SELECT q.marks, pa.selected_answer
         FROM practice_answers pa
         JOIN practice_sessions ps ON ps.id = pa.session_id
         JOIN questions q ON q.id = pa.question_id
         WHERE ps.id = $1
           AND pa.question_id = $2
           AND q.question_type = 'descriptive'
           AND pa.selected_answer IS NOT NULL
         FOR UPDATE OF pa`,
        [req.params.sessionId, req.params.questionId]
      );
      if (!row.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Submitted descriptive practice response not found."
        });
      }
      if (input.score > Number(row.rows[0].marks)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Score cannot exceed ${row.rows[0].marks}.`
        });
      }
      await client.query(
        `UPDATE practice_answers
         SET manual_score = $3,
             grader_comment = $4,
             graded_by = $5,
             graded_at = now()
         WHERE session_id = $1 AND question_id = $2`,
        [
          req.params.sessionId,
          req.params.questionId,
          input.score,
          input.comment,
          req.session.userId
        ]
      );
      await client.query(
        `INSERT INTO audit_logs
          (actor_id, action, entity_type, entity_id, details, ip_address)
         VALUES ($1, 'practice.descriptive.grade',
                 'practice_answer', $2, $3, $4)`,
        [
          req.session.userId,
          req.params.questionId,
          JSON.stringify({
            sessionId: req.params.sessionId,
            score: input.score
          }),
          req.ip
        ]
      );
      await client.query("COMMIT");
      res.json({
        graded: true,
        score: input.score
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
);
adminRouter.put(
  "/attempts/:attemptId/answers/:questionId/grade",
  async (req, res) => {
    const input = z.object({
      score: z.number().nonnegative().max(100),
      comment: z.string().trim().max(5e3).default("")
    }).parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const answer = await client.query(
        `SELECT sa.question_snapshot, sa.selected_answer
         FROM student_answers sa
         JOIN test_attempts ta ON ta.id = sa.attempt_id
         WHERE sa.attempt_id = $1
           AND sa.question_id = $2
           AND ta.status <> 'in_progress'
         FOR UPDATE OF sa`,
        [req.params.attemptId, req.params.questionId]
      );
      if (!answer.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Submitted answer not found."
        });
      }
      const snapshot = answer.rows[0].question_snapshot;
      if (snapshot.question_type !== "descriptive" || !answer.rows[0].selected_answer) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "This descriptive answer is not eligible for grading."
        });
      }
      const maximum = Number(snapshot.marks);
      if (input.score > maximum) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Score cannot exceed ${maximum}.`
        });
      }
      await client.query(
        `UPDATE student_answers
         SET manual_score = $3,
             grader_comment = $4,
             graded_by = $5,
             graded_at = now()
         WHERE attempt_id = $1 AND question_id = $2`,
        [
          req.params.attemptId,
          req.params.questionId,
          input.score,
          input.comment,
          req.session.userId
        ]
      );
      const answers = (await client.query(
        `SELECT
             sa.selected_answer,
             sa.manual_score,
             sa.question_snapshot->>'question_type' question_type,
             sa.question_snapshot->>'correct_answer' correct_answer,
             sa.question_snapshot->>'section_id' section_id,
             (sa.question_snapshot->>'marks')::numeric marks,
             (sa.question_snapshot->>'negative_marks')::numeric penalty,
             sa.time_spent_seconds
           FROM student_answers sa
           WHERE sa.attempt_id = $1`,
        [req.params.attemptId]
      )).rows;
      let score = 0;
      let maxScore = 0;
      let correct = 0;
      let wrong = 0;
      let unanswered = 0;
      let pending = 0;
      const sections = /* @__PURE__ */ new Map();
      for (const row of answers) {
        const marks = Number(row.marks);
        const penalty = Number(row.penalty);
        maxScore += marks;
        const section = sections.get(row.section_id) ?? {
          count: 0,
          attempted: 0,
          correct: 0,
          wrong: 0,
          pending: 0,
          score: 0,
          time: 0
        };
        section.count++;
        section.time += Number(row.time_spent_seconds);
        if (!row.selected_answer) {
          unanswered++;
        } else if (row.question_type === "descriptive") {
          if (row.manual_score === null) {
            pending++;
            section.pending++;
          } else {
            score += Number(row.manual_score);
            section.score += Number(row.manual_score);
            section.attempted++;
          }
        } else if (row.selected_answer === row.correct_answer) {
          correct++;
          section.correct++;
          section.attempted++;
          score += marks;
          section.score += marks;
        } else {
          wrong++;
          section.wrong++;
          section.attempted++;
          score -= penalty;
          section.score -= penalty;
        }
        sections.set(row.section_id, section);
      }
      await client.query(
        `UPDATE test_attempts
         SET score = $2,
             max_score = $3,
             correct_count = $4,
             wrong_count = $5,
             unanswered_count = $6,
             pending_review_count = $7
         WHERE id = $1`,
        [
          req.params.attemptId,
          score,
          maxScore,
          correct,
          wrong,
          unanswered,
          pending
        ]
      );
      for (const [sectionId, section] of sections) {
        const accuracy = section.correct + section.wrong ? section.correct / (section.correct + section.wrong) * 100 : 0;
        await client.query(
          `INSERT INTO section_results
            (attempt_id, section_id, question_count, attempted_count,
             correct_count, wrong_count, pending_review_count,
             score, accuracy, time_spent_seconds)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT(attempt_id, section_id)
           DO UPDATE SET
             attempted_count = EXCLUDED.attempted_count,
             correct_count = EXCLUDED.correct_count,
             wrong_count = EXCLUDED.wrong_count,
             pending_review_count = EXCLUDED.pending_review_count,
             score = EXCLUDED.score,
             accuracy = EXCLUDED.accuracy,
             time_spent_seconds = EXCLUDED.time_spent_seconds`,
          [
            req.params.attemptId,
            sectionId,
            section.count,
            section.attempted,
            section.correct,
            section.wrong,
            section.pending,
            section.score,
            accuracy,
            section.time
          ]
        );
      }
      await client.query(
        "UPDATE leaderboard_records SET score = $2 WHERE attempt_id = $1",
        [req.params.attemptId, score]
      );
      await client.query(
        `INSERT INTO audit_logs
          (actor_id, action, entity_type, entity_id, details, ip_address)
         VALUES ($1, 'descriptive.grade',
                 'student_answer', $2, $3, $4)`,
        [
          req.session.userId,
          req.params.questionId,
          JSON.stringify({
            attemptId: req.params.attemptId,
            score: input.score
          }),
          req.ip
        ]
      );
      await client.query("COMMIT");
      res.json({
        graded: true,
        score: input.score,
        pendingReviewCount: pending
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
);
adminRouter.get("/reports/attempts", async (req, res) => {
  const from = String(req.query.from ?? "2000-01-01");
  const to = String(req.query.to ?? "2100-01-01");
  const rows = await pool.query(
    `SELECT
       ta.id, ta.started_at, ta.submitted_at, ta.score, ta.max_score,
       ta.correct_count, ta.wrong_count, ta.unanswered_count,
       ta.pending_review_count, ta.elapsed_seconds,
       u.email, u.full_name, t.name test_name, t.test_type,
       COALESCE(e.name, concat(t.subject, ' · ', t.topic), 'Topicwise Test') exam_name
     FROM test_attempts ta
     JOIN users u ON u.id = ta.student_id
     JOIN mock_tests t ON t.id = ta.mock_test_id
     LEFT JOIN exams e ON e.id = t.exam_id
     WHERE ta.status <> 'in_progress'
       AND ta.submitted_at::date BETWEEN $1::date AND $2::date
     ORDER BY ta.submitted_at DESC
     LIMIT 2000`,
    [from, to]
  );
  res.json({ attempts: rows.rows });
});
adminRouter.get("/audit-logs", async (_req, res) => {
  const rows = await pool.query(
    `SELECT
       a.id, a.action, a.entity_type, a.entity_id,
       a.details, a.ip_address, a.created_at,
       u.email actor_email, u.full_name actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT 500`
  );
  res.json({ logs: rows.rows });
});
