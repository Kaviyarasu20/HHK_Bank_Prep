/**
 * Admin API Routes for the Intelligent Exam-Wise Mock Test Creator
 * Mounted at /api/admin/exam-engine (protected by requireAdmin).
 */

import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, validate } from "../middleware.js";
import {
  EXAM_PATTERN_CATALOG,
  findCatalogPattern,
  inferSubjectKeyFromSectionName,
  getDefaultTopicDistributionsForSubject,
  DEFAULT_REPETITION_POLICY,
} from "../exam-engine/examPatternCatalog.js";
import { subjectGeneratorRegistry } from "../exam-engine/subjectGeneratorRegistry.js";
import {
  previewExamWiseDistribution,
  generateIntelligentExamWiseMockTest,
} from "../exam-engine/intelligentMockTestEngine.js";
import { getNextSetInfo } from "../services/mockTestValidation.js";
import {
  inspectPatternBankAvailability,
  selectExamWiseQuestionsFromBank,
} from "../exam-engine/bankQuestionSelector.js";

async function resolveAlignedDurationSeconds(clientOrPool, stageId, fallbackSeconds) {
  if (!stageId) return Number(fallbackSeconds || 3600);
  const res = await clientOrPool.query(
    `SELECT duration_seconds FROM exam_sections WHERE stage_id = $1`,
    [stageId]
  );
  if (res.rowCount > 0 && res.rows.every((r) => r.duration_seconds !== null)) {
    const sum = res.rows.reduce((acc, r) => acc + Number(r.duration_seconds || 0), 0);
    if (sum > 0) return sum;
  }
  return Number(fallbackSeconds || 3600);
}

export const examEngineRouter = Router();
examEngineRouter.use(requireAdmin);

const topicRuleSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  minQuestions: z.number().int().min(0).max(200).default(0),
  maxQuestions: z.number().int().min(0).max(200).default(50),
  defaultQuestions: z.number().int().min(0).max(200).optional(),
  weight: z.number().min(0).max(1000).default(10),
  priority: z.number().int().min(1).max(5).default(2),
  enabled: z.boolean().default(true),
  isCompositeArithmetic: z.boolean().optional(),
  subtopics: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        weight: z.number().min(0).max(1000).default(10),
        priority: z.number().int().min(1).max(5).default(2),
        enabled: z.boolean().default(true),
      })
    )
    .optional(),
});

const sectionRuleSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  sectionName: z.string().trim().min(1).max(120),
  subjectKey: z.string().trim().min(1).max(60).optional(),
  questionCount: z.number().int().min(0).max(300),
  marksPerQuestion: z.number().min(0).max(100).default(1),
  negativeMarks: z.number().min(0).max(100).default(0.25),
  durationSeconds: z.number().int().positive().max(86400).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isEnabled: z.boolean().default(true),
  difficultyDistribution: z
    .object({
      easy: z.number().min(0).max(100).default(30),
      medium: z.number().min(0).max(100).default(50),
      hard: z.number().min(0).max(100).default(20),
    })
    .default({ easy: 30, medium: 50, hard: 20 }),
  topicDistributions: z.array(topicRuleSchema).default([]),
});

const patternVersionSchema = z.object({
  examId: z.string().uuid(),
  stageId: z.string().uuid(),
  versionLabel: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().default(true),
  durationSeconds: z.number().int().positive().max(86400),
  negativeMarkingRatio: z.number().min(0).max(1).default(0.25),
  sectionalTimingEnabled: z.boolean().default(true),
  optionCount: z.number().int().min(2).max(8).default(5),
  shortagePolicy: z
    .enum(["FAIL_STRICT", "USE_BANK_FALLBACK", "ALLOW_PARTIAL_DRAFT"])
    .default("FAIL_STRICT"),
  repetitionPolicy: z
    .object({
      withinTest: z.enum(["STRICT_NO_DUPLICATES"]).default("STRICT_NO_DUPLICATES"),
      recentTestsWindow: z.number().int().min(0).max(50).default(5),
      globalPolicy: z.enum(["ALLOW_AFTER_WINDOW", "STRICT_GLOBAL_UNIQUE"]).default("ALLOW_AFTER_WINDOW"),
    })
    .default(DEFAULT_REPETITION_POLICY),
  sourceNotes: z.string().max(2000).default(""),
  sections: z.array(sectionRuleSchema).min(1).max(20),
});

const previewOrGenerateSchema = z.object({
  examId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  patternVersionId: z.string().uuid().optional(),
  examCode: z.string().trim().max(40).optional(),
  stageName: z.string().trim().max(60).default("Prelims"),
  targetSectionNames: z.array(z.string().trim().min(1)).nullable().optional(),
  shortagePolicy: z
    .enum(["FAIL_STRICT", "USE_BANK_FALLBACK", "ALLOW_PARTIAL_DRAFT"])
    .optional(),
  customSections: z.array(sectionRuleSchema).optional(),
  seed: z.number().int().optional(),
  varyWithinRanges: z.boolean().default(true),
  saveAsDraft: z.boolean().default(false),
  testName: z.string().trim().max(180).optional(),
  description: z.string().trim().max(4000).default(""),
  setNumber: z.number().int().positive().max(999).optional(),
  setLabel: z.string().trim().max(60).optional(),
  reviewPolicy: z.enum(["after_submit", "never"]).default("after_submit"),
});

/**
 * Helper: loads an active pattern version from DB or builds a data-driven pattern
 * from the exam's configured exam_sections + catalog defaults.
 */
async function resolvePatternForRequest(input) {
  if (input.patternVersionId) {
    const pvRes = await pool.query(
      `SELECT pv.*, e.code exam_code, e.name exam_name, st.name stage_name
       FROM exam_pattern_versions pv
       JOIN exams e ON e.id = pv.exam_id
       JOIN exam_stages st ON st.id = pv.stage_id
       WHERE pv.id = $1`,
      [input.patternVersionId]
    );
    if (!pvRes.rowCount) {
      throw Object.assign(new Error("Exam pattern version not found."), { status: 404 });
    }
    const pv = pvRes.rows[0];
    const secRes = await pool.query(
      `SELECT * FROM exam_pattern_section_rules
       WHERE pattern_version_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [pv.id]
    );
    return {
      patternVersionId: pv.id,
      examId: pv.exam_id,
      stageId: pv.stage_id,
      examCode: pv.exam_code,
      examName: pv.exam_name,
      stageName: pv.stage_name,
      totalQuestions: Number(pv.total_questions),
      totalMarks: Number(pv.total_marks),
      durationSeconds: Number(pv.duration_seconds),
      sectionalTimingEnabled: Boolean(pv.sectional_timing_enabled),
      negativeMarkingRatio: Number(pv.negative_marking_ratio),
      optionCount: Number(pv.option_count),
      shortagePolicy: pv.shortage_policy,
      repetitionPolicy: pv.repetition_policy || DEFAULT_REPETITION_POLICY,
      sourceNotes: pv.source_notes || "",
      sections: secRes.rows.map((r) => ({
        sectionId: r.section_id,
        sectionName: r.section_name,
        subjectKey: r.subject_key,
        questionCount: Number(r.question_count),
        marksPerQuestion: Number(r.marks_per_question),
        negativeMarks: Number(r.negative_marks),
        durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
        sortOrder: Number(r.sort_order),
        isEnabled: Boolean(r.is_enabled),
        difficultyDistribution: r.difficulty_distribution || { easy: 30, medium: 50, hard: 20 },
        topicDistributions: Array.isArray(r.topic_distributions) ? r.topic_distributions : [],
      })),
    };
  }

  if (input.examId && input.stageId) {
    // Check if an active DB pattern version already exists for this exam+stage
    const activePv = await pool.query(
      `SELECT id FROM exam_pattern_versions
       WHERE exam_id = $1 AND stage_id = $2 AND is_active = TRUE
       ORDER BY version_number DESC LIMIT 1`,
      [input.examId, input.stageId]
    );
    if (activePv.rowCount && !input.customSections?.length) {
      return resolvePatternForRequest({ patternVersionId: activePv.rows[0].id });
    }

    // Build from exam_stages + exam_sections + catalog topic templates
    const stageRes = await pool.query(
      `SELECT st.id stage_id, st.name stage_name, st.duration_seconds,
              e.id exam_id, e.code exam_code, e.name exam_name
       FROM exam_stages st
       JOIN exams e ON e.id = st.exam_id
       WHERE st.id = $1 AND e.id = $2`,
      [input.stageId, input.examId]
    );
    if (!stageRes.rowCount) {
      throw Object.assign(new Error("Selected exam and stage were not found."), { status: 404 });
    }
    const st = stageRes.rows[0];
    const catalog = findCatalogPattern(st.exam_code, st.stage_name);
    const dbSections = (
      await pool.query(
        `SELECT id, name, question_count, duration_seconds, marks_per_correct, negative_marks, sort_order
         FROM exam_sections
         WHERE stage_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [st.stage_id]
      )
    ).rows;

    const isMainsStage = String(st.stage_name || "").toLowerCase().includes("main");
    const sections = (input.customSections?.length ? input.customSections : dbSections.map((sec) => {
      const subjectKey = inferSubjectKeyFromSectionName(sec.name);
      const catalogSec = catalog?.sections?.find((cs) => cs.subjectKey === subjectKey);
      const secCount = Number(sec.question_count || catalogSec?.questionCount || 0);
      const rawTopics =
        catalogSec?.topicDistributions?.length && Number(catalogSec.questionCount) === secCount
          ? catalogSec.topicDistributions
          : getDefaultTopicDistributionsForSubject(subjectKey, secCount, isMainsStage);
      return {
        sectionId: sec.id,
        sectionName: sec.name,
        subjectKey,
        questionCount: secCount,
        marksPerQuestion: Number(sec.marks_per_correct ?? catalogSec?.marksPerQuestion ?? 1),
        negativeMarks: Number(sec.negative_marks ?? catalogSec?.negativeMarks ?? 0.25),
        durationSeconds: sec.duration_seconds ?? catalogSec?.durationSeconds ?? null,
        sortOrder: Number(sec.sort_order ?? 0),
        isEnabled: true,
        difficultyDistribution: catalogSec?.difficultyDistribution || { easy: 30, medium: 50, hard: 20 },
        topicDistributions: rawTopics,
      };
    }));

    return {
      patternVersionId: null,
      examId: st.exam_id,
      stageId: st.stage_id,
      examCode: st.exam_code,
      examName: st.exam_name,
      stageName: st.stage_name,
      totalQuestions: sections.reduce((s, x) => s + Number(x.questionCount || 0), 0),
      totalMarks: sections.reduce((s, x) => s + Number(x.questionCount || 0) * Number(x.marksPerQuestion || 1), 0),
      durationSeconds: Number(st.duration_seconds || catalog?.durationSeconds || 3600),
      sectionalTimingEnabled: sections.some((s) => s.durationSeconds !== null),
      negativeMarkingRatio: catalog?.negativeMarkingRatio ?? 0.25,
      optionCount: 5,
      shortagePolicy: input.shortagePolicy || "FAIL_STRICT",
      repetitionPolicy: DEFAULT_REPETITION_POLICY,
      sourceNotes: catalog?.sourceNotes || "Configured from HHK exam blueprint.",
      sections,
    };
  }

  // Catalog-only fallback
  const catalog = findCatalogPattern(input.examCode, input.stageName);
  if (!catalog) {
    throw Object.assign(
      new Error(`No catalog pattern found for "${input.examCode}" (${input.stageName}).`),
      { status: 404 }
    );
  }
  if (input.customSections?.length) {
    catalog.sections = input.customSections.map((sec, i) => ({
      ...sec,
      subjectKey: sec.subjectKey || inferSubjectKeyFromSectionName(sec.sectionName),
      sortOrder: sec.sortOrder ?? i,
    }));
  }
  return catalog;
}

// 1. Live Subject Generator Registry status
examEngineRouter.get("/generators", (_req, res) => {
  res.json({
    generators: subjectGeneratorRegistry.listStatuses(),
  });
});

// 2. Researched Default Exam Pattern Catalog
examEngineRouter.get("/catalog", (_req, res) => {
  res.json({
    patterns: EXAM_PATTERN_CATALOG,
  });
});

// 3. List saved versioned Exam Patterns
examEngineRouter.get("/patterns", async (req, res) => {
  const examId = req.query.examId || null;
  const stageId = req.query.stageId || null;

  const versions = (
    await pool.query(
      `SELECT pv.*, e.code exam_code, e.name exam_name, st.name stage_name
       FROM exam_pattern_versions pv
       JOIN exams e ON e.id = pv.exam_id
       JOIN exam_stages st ON st.id = pv.stage_id
       WHERE ($1::uuid IS NULL OR pv.exam_id = $1)
         AND ($2::uuid IS NULL OR pv.stage_id = $2)
       ORDER BY e.sort_order ASC, st.sort_order ASC, pv.version_number DESC`,
      [examId, stageId]
    )
  ).rows;

  const ids = versions.map((v) => v.id);
  const rules = ids.length
    ? (
        await pool.query(
          `SELECT * FROM exam_pattern_section_rules
           WHERE pattern_version_id = ANY($1::uuid[])
           ORDER BY sort_order ASC, id ASC`,
          [ids]
        )
      ).rows
    : [];

  const rulesByPattern = new Map();
  for (const r of rules) {
    if (!rulesByPattern.has(r.pattern_version_id)) rulesByPattern.set(r.pattern_version_id, []);
    rulesByPattern.get(r.pattern_version_id).push(r);
  }

  res.json({
    patterns: versions.map((v) => ({
      ...v,
      sections: rulesByPattern.get(v.id) || [],
    })),
  });
});

// 4. Create new versioned Exam Pattern
examEngineRouter.post("/patterns", async (req, res) => {
  const input = validate(patternVersionSchema, req.body);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const verRes = await client.query(
      `SELECT COALESCE(MAX(version_number), 0)::int max_ver
       FROM exam_pattern_versions
       WHERE exam_id = $1 AND stage_id = $2`,
      [input.examId, input.stageId]
    );
    const nextVersion = Number(verRes.rows[0].max_ver) + 1;
    const versionLabel = input.versionLabel || `v${nextVersion}`;

    if (input.isActive) {
      await client.query(
        `UPDATE exam_pattern_versions
         SET is_active = FALSE, updated_at = now()
         WHERE exam_id = $1 AND stage_id = $2 AND is_active = TRUE`,
        [input.examId, input.stageId]
      );
    }

    const totalQuestions = input.sections.reduce((s, x) => s + Number(x.questionCount || 0), 0);
    const totalMarks = input.sections.reduce(
      (s, x) => s + Number(x.questionCount || 0) * Number(x.marksPerQuestion || 1),
      0
    );

    const pv = (
      await client.query(
        `INSERT INTO exam_pattern_versions
           (exam_id, stage_id, version_number, version_label, is_active,
            total_questions, total_marks, duration_seconds, negative_marking_ratio,
            sectional_timing_enabled, option_count, shortage_policy,
            repetition_policy, source_notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)
         RETURNING *`,
        [
          input.examId,
          input.stageId,
          nextVersion,
          versionLabel,
          input.isActive,
          totalQuestions,
          totalMarks,
          input.durationSeconds,
          input.negativeMarkingRatio,
          input.sectionalTimingEnabled,
          input.optionCount,
          input.shortagePolicy,
          JSON.stringify(input.repetitionPolicy),
          input.sourceNotes,
          req.session.userId,
        ]
      )
    ).rows[0];

    const insertedSections = [];
    for (const [idx, sec] of input.sections.entries()) {
      const subjectKey = sec.subjectKey || inferSubjectKeyFromSectionName(sec.sectionName);
      const row = (
        await client.query(
          `INSERT INTO exam_pattern_section_rules
             (pattern_version_id, section_id, section_name, subject_key,
              question_count, marks_per_question, negative_marks, duration_seconds,
              sort_order, difficulty_distribution, topic_distributions, is_enabled)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
           RETURNING *`,
          [
            pv.id,
            sec.sectionId || null,
            sec.sectionName,
            subjectKey,
            sec.questionCount,
            sec.marksPerQuestion,
            sec.negativeMarks,
            sec.durationSeconds ?? null,
            sec.sortOrder ?? idx,
            JSON.stringify(sec.difficultyDistribution),
            JSON.stringify(sec.topicDistributions),
            sec.isEnabled,
          ]
        )
      ).rows[0];
      insertedSections.push(row);
    }

    await client.query("COMMIT");
    res.status(201).json({ pattern: { ...pv, sections: insertedSections } });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 5. Activate or Deactivate an Exam Pattern Version
examEngineRouter.patch("/patterns/:id/activate", async (req, res) => {
  const isActive = req.body?.isActive !== false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      "SELECT id, exam_id, stage_id FROM exam_pattern_versions WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );
    if (!target.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pattern version not found." });
    }
    const { exam_id, stage_id } = target.rows[0];
    if (isActive) {
      await client.query(
        `UPDATE exam_pattern_versions
         SET is_active = FALSE, updated_at = now()
         WHERE exam_id = $1 AND stage_id = $2 AND id <> $3`,
        [exam_id, stage_id, req.params.id]
      );
    }
    const updated = (
      await client.query(
        `UPDATE exam_pattern_versions
         SET is_active = $2, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [req.params.id, isActive]
      )
    ).rows[0];
    await client.query("COMMIT");
    res.json({ pattern: updated });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 6. Preview Topic & Difficulty Distribution + Generator Readiness
examEngineRouter.post("/preview", async (req, res) => {
  const input = validate(previewOrGenerateSchema, req.body);
  const pattern = await resolvePatternForRequest(input);
  const preview = previewExamWiseDistribution({
    pattern,
    targetSectionNames: input.targetSectionNames,
    seed: input.seed ?? Date.now(),
    varyWithinRanges: input.varyWithinRanges,
  });
  res.json({ preview });
});

// 7. Generate Sample or Saved Draft Exam-Wise Mock Test
examEngineRouter.post("/generate", async (req, res) => {
  const input = validate(previewOrGenerateSchema, req.body);
  const pattern = await resolvePatternForRequest(input);

  // Collect recent fingerprints for cross-test repetition minimization
  let recentFingerprints = [];
  if (pattern.examId && pattern.stageId) {
    const windowSize = Number(pattern.repetitionPolicy?.recentTestsWindow ?? 5);
    if (windowSize > 0) {
      const fpRes = await pool.query(
        `SELECT DISTINCT q.fingerprint
         FROM mock_tests mt
         JOIN mock_test_questions mtq ON mtq.mock_test_id = mt.id
         JOIN questions q ON q.id = mtq.question_id
         WHERE mt.exam_id = $1 AND mt.stage_id = $2
           AND q.fingerprint IS NOT NULL
           AND mt.id IN (
             SELECT id FROM mock_tests
             WHERE exam_id = $1 AND stage_id = $2
             ORDER BY created_at DESC
             LIMIT $3
           )`,
        [pattern.examId, pattern.stageId, windowSize]
      );
      recentFingerprints = fpRes.rows.map((r) => r.fingerprint);
    }
  }

  // Optional DB bank fallback provider (only invoked when shortagePolicy === 'USE_BANK_FALLBACK')
  const bankFallbackProvider = async ({ sectionId, topic, difficulty, count, excludeFingerprints }) => {
    if (!sectionId || count <= 0) return [];
    const rows = (
      await pool.query(
        `SELECT id, section_id, topic_name, subtopic_name, difficulty, question_type,
                question_text, options, correct_answer, explanation, marks, negative_marks, fingerprint
         FROM questions
         WHERE section_id = $1
           AND status = 'published'
           AND ($2::text IS NULL OR LOWER(topic_name) = LOWER($2))
           AND ($3::text IS NULL OR difficulty = $3)
           AND (fingerprint IS NULL OR NOT (fingerprint = ANY($4::text[])))
         ORDER BY random()
         LIMIT $5`,
        [sectionId, topic || null, difficulty || null, excludeFingerprints || [], count]
      )
    ).rows;
    return rows.map((r) => ({
      existingQuestionId: r.id,
      questionText: r.question_text,
      options: r.options,
      correctAnswer: r.correct_answer,
      explanation: r.explanation,
      topicName: r.topic_name,
      subtopicName: r.subtopic_name,
      difficulty: r.difficulty,
      questionType: r.question_type,
      fingerprint: r.fingerprint,
    }));
  };

  const result = await generateIntelligentExamWiseMockTest({
    pattern,
    targetSectionNames: input.targetSectionNames,
    shortagePolicy: input.shortagePolicy || pattern.shortagePolicy,
    repetitionPolicy: pattern.repetitionPolicy,
    excludeFingerprints: recentFingerprints,
    bankFallbackProvider,
    seed: input.seed ?? Date.now(),
    varyWithinRanges: input.varyWithinRanges,
  });

  if (!input.saveAsDraft) {
    return res.json(result);
  }

  if (!pattern.examId || !pattern.stageId) {
    return res.status(400).json({
      error: "Saving a generated mock test as draft requires valid examId and stageId.",
    });
  }

  // Persist generated questions & mock_test draft atomically
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const nextInfo = await getNextSetInfo(client, {
      testType: "EXAM_WISE",
      examId: pattern.examId,
      stageId: pattern.stageId,
    });
    const setNumber = input.setNumber ?? nextInfo.nextSetNumber;
    const setLabel = (input.setLabel || `Set ${setNumber}`).trim();
    const testName =
      input.testName || `${pattern.examName} ${pattern.stageName} - ${setLabel}`;

    const createdTest = (
      await client.query(
        `INSERT INTO mock_tests
           (exam_id, stage_id, test_type, set_number, set_label, target_questions,
            name, description, duration_seconds, review_policy, selection_mode,
            pattern_version_id, generation_report, repetition_policy, status, created_by)
         VALUES ($1,$2,'EXAM_WISE',$3,$4,$5,$6,$7,$8,$9,'intelligent_engine',$10,$11::jsonb,$12::jsonb,'draft',$13)
         RETURNING *`,
        [
          pattern.examId,
          pattern.stageId,
          setNumber,
          setLabel,
          result.generationReport.totalRequired,
          testName,
          input.description || `Auto-generated via Intelligent Exam-Wise Engine (${pattern.examName} ${pattern.stageName}).`,
          await resolveAlignedDurationSeconds(client, pattern.stageId, pattern.durationSeconds),
          input.reviewPolicy,
          pattern.patternVersionId || null,
          JSON.stringify(result.generationReport),
          JSON.stringify(pattern.repetitionPolicy || DEFAULT_REPETITION_POLICY),
          req.session.userId,
        ]
      )
    ).rows[0];

    let sortOrder = 0;
    for (const q of result.mockTest.questions) {
      let questionId = q.existingQuestionId || null;
      if (!questionId && q.sectionId) {
        const insertedQ = (
          await client.query(
            `INSERT INTO questions
               (section_id, topic_name, subtopic_name, difficulty, question_type,
                language, question_text, options, correct_answer, explanation,
                marks, negative_marks, source, status, fingerprint, created_by)
             VALUES ($1,$2,$3,$4,'mcq','English',$5,$6::jsonb,$7,$8,$9,$10,$11,'published',$12,$13)
             RETURNING id`,
            [
              q.sectionId,
              q.topicName,
              q.subtopicName || "",
              q.difficulty || "medium",
              q.questionText,
              JSON.stringify(q.options),
              q.correctAnswer,
              q.explanation || "",
              q.marks ?? 1,
              q.negativeMarks ?? 0.25,
              q.generatorSource || "HHK_INTELLIGENT_EXAM_ENGINE",
              q.fingerprint || null,
              req.session.userId,
            ]
          )
        ).rows[0];
        questionId = insertedQ.id;
      }
      if (questionId && q.sectionId) {
        await client.query(
          `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [createdTest.id, questionId, q.sectionId, sortOrder++]
        );
      }
    }

    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'mock_test.intelligent_generate', 'mock_test', $2, $3::jsonb, $4)`,
      [
        req.session.userId,
        createdTest.id,
        JSON.stringify({
          examCode: pattern.examCode,
          stageName: pattern.stageName,
          setNumber,
          patternFulfilled: result.patternFulfilled,
          totalGenerated: result.generationReport.totalGenerated,
          totalRequired: result.generationReport.totalRequired,
        }),
        req.ip,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({
      test: createdTest,
      ...result,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});


// 8. Selection Blueprint: Active Pattern (Custom or Research Default) + Live Question Bank Availability
examEngineRouter.get("/selection-blueprint", async (req, res) => {
  const examId = req.query.examId ? String(req.query.examId) : undefined;
  const stageId = req.query.stageId ? String(req.query.stageId) : undefined;
  const examCode = req.query.examCode ? String(req.query.examCode) : undefined;
  const stageName = req.query.stageName ? String(req.query.stageName) : "Prelims";

  const pattern = await resolvePatternForRequest({ examId, stageId, examCode, stageName });
  const availability = await inspectPatternBankAvailability(pool, pattern);

  res.json({
    blueprint: {
      ...pattern,
      isCustomPattern: Boolean(pattern.patternVersionId),
      sections: availability.sections,
      totalRequired: availability.totalRequired,
      totalAvailableForPattern: availability.totalAvailableForPattern,
      hasShortages: availability.hasShortages,
      shortageWarnings: availability.shortageWarnings,
    },
    generators: subjectGeneratorRegistry.listStatuses(),
  });
});

// 9. Restore Recommended Default Pattern (deactivates custom DB override for exam + stage)
examEngineRouter.post("/patterns/reset", async (req, res) => {
  const schema = z.object({
    examId: z.string().uuid(),
    stageId: z.string().uuid(),
  });
  const input = validate(schema, req.body);

  await pool.query(
    `UPDATE exam_pattern_versions
     SET is_active = FALSE, updated_at = NOW()
     WHERE exam_id = $1 AND stage_id = $2 AND is_active = TRUE`,
    [input.examId, input.stageId]
  );

  const defaultPattern = await resolvePatternForRequest({
    examId: input.examId,
    stageId: input.stageId,
  });
  const availability = await inspectPatternBankAvailability(pool, defaultPattern);

  res.json({
    restored: true,
    blueprint: {
      ...defaultPattern,
      isCustomPattern: false,
      sections: availability.sections,
      totalRequired: availability.totalRequired,
      totalAvailableForPattern: availability.totalAvailableForPattern,
      hasShortages: availability.hasShortages,
      shortageWarnings: availability.shortageWarnings,
    },
  });
});

// 10. Generate Complete Exam-Wise Mock Test strictly from existing Question Bank by Topic Distribution
examEngineRouter.post("/generate-from-bank", async (req, res) => {
  const bankGenSchema = z.object({
    examId: z.string().uuid(),
    stageId: z.string().uuid(),
    durationSeconds: z.number().int().positive().max(86400).optional(),
    sections: z.array(sectionRuleSchema).min(1).max(20).optional(),
    testName: z.string().trim().max(180).optional(),
    description: z.string().trim().max(4000).default(""),
    setNumber: z.number().int().positive().max(999).optional(),
    setLabel: z.string().trim().max(60).optional(),
    reviewPolicy: z.enum(["after_submit", "never"]).default("after_submit"),
  });
  const input = validate(bankGenSchema, req.body);

  const basePattern = await resolvePatternForRequest({
    examId: input.examId,
    stageId: input.stageId,
    customSections: input.sections,
  });
  if (input.durationSeconds) {
    basePattern.durationSeconds = input.durationSeconds;
  }

  // Prefer excluding questions used in the last 5 mock tests for this exam+stage
  const recentRes = await pool.query(
    `SELECT DISTINCT mtq.question_id
     FROM mock_test_questions mtq
     JOIN mock_tests mt ON mt.id = mtq.mock_test_id
     WHERE mt.exam_id = $1 AND mt.stage_id = $2
       AND mt.id IN (
         SELECT id FROM mock_tests
         WHERE exam_id = $1 AND stage_id = $2
         ORDER BY created_at DESC
         LIMIT 5
       )`,
    [input.examId, input.stageId]
  );
  const preferExcludeIds = recentRes.rows.map((r) => r.question_id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selection = await selectExamWiseQuestionsFromBank(client, {
      pattern: basePattern,
      preferExcludeIds,
      shuffleWithinSection: true,
    });

    if (!selection.ok) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: `Insufficient published questions in the Question Bank for ${selection.shortageWarnings.length} topic(s). Add or auto-generate the missing topic questions, or adjust the topic counts.`,
        shortageWarnings: selection.shortageWarnings,
        sectionReports: selection.sectionReports,
        totalSelected: selection.totalSelected,
        totalRequired: selection.totalRequired,
      });
    }

    const nextInfo = await getNextSetInfo(client, {
      testType: "EXAM_WISE",
      examId: input.examId,
      stageId: input.stageId,
    });
    const setNumber = input.setNumber ?? nextInfo.nextSetNumber;
    const setLabel = (input.setLabel || `Set ${setNumber}`).trim();
    const testName =
      input.testName || `${basePattern.examName} ${basePattern.stageName} - ${setLabel}`;

    const report = {
      mode: "BANK_TOPIC_BLUEPRINT",
      patternFulfilled: true,
      totalGenerated: selection.totalSelected,
      totalRequired: selection.totalRequired,
      sectionReports: selection.sectionReports,
    };

    const createdTest = (
      await client.query(
        `INSERT INTO mock_tests
           (exam_id, stage_id, test_type, set_number, set_label, target_questions,
            name, description, duration_seconds, review_policy, selection_mode,
            pattern_version_id, generation_report, repetition_policy, status, created_by)
         VALUES ($1,$2,'EXAM_WISE',$3,$4,$5,$6,$7,$8,$9,'rule_based',$10,$11::jsonb,$12::jsonb,'draft',$13)
         RETURNING *`,
        [
          input.examId,
          input.stageId,
          setNumber,
          setLabel,
          selection.totalRequired,
          testName,
          input.description || `Topic-wise blueprint mock test generated from Question Bank (${basePattern.examName} ${basePattern.stageName}).`,
          await resolveAlignedDurationSeconds(client, input.stageId, basePattern.durationSeconds),
          input.reviewPolicy,
          basePattern.patternVersionId || null,
          JSON.stringify(report),
          JSON.stringify(basePattern.repetitionPolicy || DEFAULT_REPETITION_POLICY),
          req.session.userId,
        ]
      )
    ).rows[0];

    let sortOrder = 0;
    for (const q of selection.pickedQuestions) {
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [createdTest.id, q.id, q.section_id, sortOrder++]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      test: createdTest,
      generationReport: report,
      shortageWarnings: [],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});
