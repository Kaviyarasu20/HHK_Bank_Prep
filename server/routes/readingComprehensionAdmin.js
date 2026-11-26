import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  computeRcHash,
  countWords,
  generateRcPassageWithAi,
  generateRcQuestionsWithAi,
  getRcAiStatus,
  RC_ALL_CATEGORIES,
  RC_DIFFICULTIES,
  RC_EXAMINATIONS,
  RC_LENGTH_SPECS,
  RC_QUESTION_FOCUSED_CATEGORIES,
  RC_QUESTION_TYPES,
  RC_SUBJECT_CATEGORIES,
  regenerateSingleRcQuestionWithAi,
  validateRcQuestion,
} from "../services/rcAiEngineService.js";
import { generateReadingComprehensionPdf, RC_PDF_FORMATS } from "../services/rcPdfGeneratorService.js";

export const readingComprehensionAdminRouter = Router();
readingComprehensionAdminRouter.use(requireAdmin);

const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "AI generation rate limit reached. Please wait a minute." },
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

const generateBundleSchema = z.object({
  examination: z.string().trim().min(2).max(120),
  categories: z.array(z.string().trim().min(2)).min(1).max(15),
  difficulty: z.enum(["easy", "moderate", "hard", "expert"]).default("moderate"),
  passageLength: z.enum(["short", "medium", "long"]).default("medium"),
  numberOfPassages: z.number().int().min(1).max(5).default(1),
  questionsPerPassage: z.number().int().min(1).max(15).default(5),
  questionTypes: z.array(z.string().trim()).default([]),
  optionCount: z.union([z.literal(4), z.literal(5)]).default(5),
  includeExplanations: z.boolean().default(true),
  includeVocabulary: z.boolean().default(true),
  generateQuestionsImmediately: z.boolean().default(true),
});

const updatePassageSchema = z.object({
  title: z.string().trim().min(4).max(240),
  examination: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(140),
  categories: z.array(z.string().trim()).optional(),
  difficulty: z.enum(["easy", "moderate", "hard", "expert"]),
  passage_length: z.enum(["short", "medium", "long"]).optional(),
  passage_text: z.string().trim().min(50),
  recommended_time_seconds: z.number().int().min(60).max(3600).optional(),
});

const questionPayloadSchema = z.object({
  question_type: z.string().trim().min(2).max(120),
  category: z.string().trim().max(140).optional(),
  difficulty: z.enum(["easy", "moderate", "hard", "expert"]).default("moderate"),
  question_text: z.string().trim().min(10).max(2000),
  options: z
    .array(
      z.object({
        key: z.enum(["A", "B", "C", "D", "E"]),
        text: z.string().trim().min(1).max(1000),
      }),
    )
    .min(4)
    .max(5),
  correct_answer: z.enum(["A", "B", "C", "D", "E"]),
  explanation: z.string().trim().max(4000).default(""),
  passage_reference: z.string().trim().max(2000).default(""),
});

async function loadFullPassage(passageId) {
  const pRes = await pool.query("SELECT * FROM rc_passages WHERE id = $1", [passageId]);
  if (!pRes.rowCount) return null;
  const [qRes, vRes] = await Promise.all([
    pool.query(
      "SELECT * FROM rc_questions WHERE passage_id = $1 ORDER BY question_number ASC, created_at ASC",
      [passageId],
    ),
    pool.query(
      "SELECT * FROM rc_vocabulary WHERE passage_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [passageId],
    ),
  ]);
  return {
    ...pRes.rows[0],
    questions: qRes.rows,
    vocabulary: vRes.rows,
  };
}

// 1. Metadata & AI Status
readingComprehensionAdminRouter.get("/meta", (_req, res) => {
  res.json({
    examinations: RC_EXAMINATIONS,
    subjectCategories: RC_SUBJECT_CATEGORIES,
    questionFocusedCategories: RC_QUESTION_FOCUSED_CATEGORIES,
    allCategories: RC_ALL_CATEGORIES,
    questionTypes: RC_QUESTION_TYPES,
    difficulties: RC_DIFFICULTIES,
    lengths: RC_LENGTH_SPECS,
    pdfFormats: RC_PDF_FORMATS,
    aiStatus: getRcAiStatus(),
  });
});

// 2. List Passages with Search & Filters
readingComprehensionAdminRouter.get("/passages", async (req, res) => {
  const examination = req.query.examination ? String(req.query.examination).trim() : null;
  const category = req.query.category ? String(req.query.category).trim() : null;
  const difficulty = req.query.difficulty ? String(req.query.difficulty).trim().toLowerCase() : null;
  const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;

  const rows = await pool.query(
    `SELECT p.*,
            (SELECT count(*)::int FROM rc_questions q WHERE q.passage_id = p.id) AS question_count,
            (SELECT count(*)::int FROM rc_questions q WHERE q.passage_id = p.id AND q.validation_status = 'flagged') AS flagged_count,
            (SELECT count(*)::int FROM rc_vocabulary v WHERE v.passage_id = p.id) AS vocabulary_count,
            (SELECT count(*)::int FROM rc_student_attempts a WHERE a.passage_id = p.id AND a.status <> 'in_progress') AS attempt_count
     FROM rc_passages p
     WHERE ($1::text IS NULL OR p.examination = $1)
       AND ($2::text IS NULL OR p.category = $2 OR p.categories ? $2)
       AND ($3::text IS NULL OR p.difficulty = $3)
       AND ($4::text IS NULL OR p.status = $4)
       AND ($5::text IS NULL OR p.title ILIKE $5 OR p.passage_text ILIKE $5 OR p.category ILIKE $5)
     ORDER BY p.created_at DESC
     LIMIT 200`,
    [examination, category, difficulty, status, search],
  );
  res.json({ passages: rows.rows });
});

// 3. Get Single Passage + Questions + Vocabulary
readingComprehensionAdminRouter.get("/passages/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const full = await loadFullPassage(req.params.id);
  if (!full) return res.status(404).json({ error: "Reading comprehension passage not found." });
  res.json({ passage: full });
});

// 4. Generate 1..N Passages (+ Optional Questions & Vocabulary) — ALWAYS SAVED AS DRAFT
readingComprehensionAdminRouter.post("/generate", aiRateLimiter, async (req, res) => {
  const input = generateBundleSchema.parse(req.body);
  const recentTitlesRes = await pool.query(
    "SELECT title FROM rc_passages WHERE examination = $1 ORDER BY created_at DESC LIMIT 10",
    [input.examination],
  );
  const avoidTitles = recentTitlesRes.rows.map((r) => r.title);

  const createdPassages = [];
  for (let i = 0; i < input.numberOfPassages; i += 1) {
    const chosenCategory = input.categories[i % input.categories.length];
    const generated = await generateRcPassageWithAi({
      examination: input.examination,
      category: chosenCategory,
      difficulty: input.difficulty,
      passageLength: input.passageLength,
      includeVocabulary: input.includeVocabulary,
      avoidTitles: [...avoidTitles, ...createdPassages.map((p) => p.title)],
    });

    // Check duplicate passage hash
    const dupCheck = await pool.query(
      "SELECT id FROM rc_passages WHERE content_hash = $1 LIMIT 1",
      [generated.passage.content_hash],
    );
    if (dupCheck.rowCount) {
      return res.status(409).json({
        error: "AI generated a duplicate passage matching an existing record. Please retry generation.",
      });
    }

    let questionResult = { questions: [], qualitySummary: null };
    if (input.generateQuestionsImmediately) {
      questionResult = await generateRcQuestionsWithAi(generated.passage, {
        questionsPerPassage: input.questionsPerPassage,
        questionTypes: input.questionTypes,
        optionCount: input.optionCount,
        includeExplanations: input.includeExplanations,
        difficulty: input.difficulty,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO rc_passages
           (title, examination, category, categories, difficulty, passage_length,
            passage_text, word_count, option_count, include_explanations, include_vocabulary,
            recommended_time_seconds, status, content_hash, ai_provider, ai_model, quality_report, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          generated.passage.title,
          input.examination,
          chosenCategory,
          JSON.stringify(input.categories),
          input.difficulty,
          input.passageLength,
          generated.passage.passage_text,
          generated.passage.word_count,
          input.optionCount,
          input.includeExplanations,
          input.includeVocabulary,
          generated.passage.recommended_time_seconds,
          generated.passage.content_hash,
          generated.meta.provider,
          generated.meta.model,
          JSON.stringify({
            passageValidation: generated.validation,
            questionQuality: questionResult.qualitySummary,
          }),
          req.session.userId,
        ],
      );
      const passageRow = inserted.rows[0];

      const savedQuestions = [];
      for (let qIdx = 0; qIdx < questionResult.questions.length; qIdx += 1) {
        const q = questionResult.questions[qIdx];
        const qIns = await client.query(
          `INSERT INTO rc_questions
             (passage_id, question_number, question_type, category, difficulty,
              question_text, options, correct_answer, explanation, passage_reference,
              validation_status, validation_notes, content_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            passageRow.id,
            qIdx + 1,
            q.question_type,
            chosenCategory,
            q.difficulty,
            q.question_text,
            JSON.stringify(q.options),
            q.correct_answer,
            q.explanation,
            q.passage_reference,
            q.validation_status,
            JSON.stringify(q.validation_notes || []),
            q.content_hash,
          ],
        );
        savedQuestions.push(qIns.rows[0]);
      }

      const savedVocab = [];
      for (let vIdx = 0; vIdx < generated.vocabulary.length; vIdx += 1) {
        const v = generated.vocabulary[vIdx];
        const vIns = await client.query(
          `INSERT INTO rc_vocabulary
             (passage_id, word, meaning_english, meaning_tamil, synonym, antonym,
              pronunciation, example_sentence, passage_context, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            passageRow.id,
            v.word,
            v.meaning_english,
            v.meaning_tamil,
            v.synonym,
            v.antonym,
            v.pronunciation,
            v.example_sentence,
            v.passage_context,
            vIdx + 1,
          ],
        );
        savedVocab.push(vIns.rows[0]);
      }

      await client.query("COMMIT");
      await writeAudit(
        req.session.userId,
        "rc_passage.generate",
        "rc_passage",
        passageRow.id,
        {
          examination: input.examination,
          category: chosenCategory,
          difficulty: input.difficulty,
          questionsGenerated: savedQuestions.length,
          vocabularyCount: savedVocab.length,
        },
        req.ip,
      );
      createdPassages.push({
        ...passageRow,
        questions: savedQuestions,
        vocabulary: savedVocab,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  res.status(201).json({
    passages: createdPassages,
    message: `Generated ${createdPassages.length} draft Reading Comprehension passage(s). Review before publishing.`,
  });
});

// 5. Regenerate Passage Text & Vocabulary for an Existing Draft
readingComprehensionAdminRouter.post("/passages/:id/regenerate-passage", aiRateLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const existing = await pool.query("SELECT * FROM rc_passages WHERE id = $1", [req.params.id]);
  if (!existing.rowCount) return res.status(404).json({ error: "Passage not found." });
  const p = existing.rows[0];

  const generated = await generateRcPassageWithAi({
    examination: p.examination,
    category: p.category,
    difficulty: p.difficulty,
    passageLength: p.passage_length,
    includeVocabulary: p.include_vocabulary,
    avoidTitles: [p.title],
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE rc_passages
       SET title = $2, passage_text = $3, word_count = $4, content_hash = $5,
           ai_provider = $6, ai_model = $7, status = 'draft', updated_at = now()
       WHERE id = $1`,
      [
        p.id,
        generated.passage.title,
        generated.passage.passage_text,
        generated.passage.word_count,
        generated.passage.content_hash,
        generated.meta.provider,
        generated.meta.model,
      ],
    );
    await client.query("DELETE FROM rc_vocabulary WHERE passage_id = $1", [p.id]);
    for (let vIdx = 0; vIdx < generated.vocabulary.length; vIdx += 1) {
      const v = generated.vocabulary[vIdx];
      await client.query(
        `INSERT INTO rc_vocabulary
           (passage_id, word, meaning_english, meaning_tamil, synonym, antonym,
            pronunciation, example_sentence, passage_context, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          p.id, v.word, v.meaning_english, v.meaning_tamil, v.synonym, v.antonym,
          v.pronunciation, v.example_sentence, v.passage_context, vIdx + 1,
        ],
      );
    }
    await client.query("COMMIT");
    await writeAudit(req.session.userId, "rc_passage.regenerate", "rc_passage", p.id, {}, req.ip);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ passage: await loadFullPassage(p.id) });
});

// 6. Generate / Regenerate Questions for an Existing Passage
readingComprehensionAdminRouter.post("/passages/:id/generate-questions", aiRateLimiter, async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const existing = await pool.query("SELECT * FROM rc_passages WHERE id = $1", [req.params.id]);
  if (!existing.rowCount) return res.status(404).json({ error: "Passage not found." });
  const p = existing.rows[0];

  const questionsPerPassage = Math.max(1, Math.min(15, Number(req.body?.questionsPerPassage) || 5));
  const questionTypes = Array.isArray(req.body?.questionTypes) ? req.body.questionTypes : [];
  const optionCount = Number(req.body?.optionCount || p.option_count) === 4 ? 4 : 5;
  const includeExplanations = req.body?.includeExplanations !== undefined ? Boolean(req.body.includeExplanations) : p.include_explanations;
  const replaceExisting = req.body?.replaceExisting !== false;

  const result = await generateRcQuestionsWithAi(p, {
    questionsPerPassage,
    questionTypes,
    optionCount,
    includeExplanations,
    difficulty: p.difficulty,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let startNumber = 1;
    if (replaceExisting) {
      await client.query("DELETE FROM rc_questions WHERE passage_id = $1", [p.id]);
    } else {
      const cntRes = await client.query("SELECT COALESCE(MAX(question_number), 0)::int AS max_num FROM rc_questions WHERE passage_id = $1", [p.id]);
      startNumber = Number(cntRes.rows[0]?.max_num || 0) + 1;
    }

    for (let i = 0; i < result.questions.length; i += 1) {
      const q = result.questions[i];
      await client.query(
        `INSERT INTO rc_questions
           (passage_id, question_number, question_type, category, difficulty,
            question_text, options, correct_answer, explanation, passage_reference,
            validation_status, validation_notes, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          p.id,
          startNumber + i,
          q.question_type,
          p.category,
          q.difficulty,
          q.question_text,
          JSON.stringify(q.options),
          q.correct_answer,
          q.explanation,
          q.passage_reference,
          q.validation_status,
          JSON.stringify(q.validation_notes || []),
          q.content_hash,
        ],
      );
    }
    await client.query("UPDATE rc_passages SET option_count = $2, updated_at = now() WHERE id = $1", [p.id, optionCount]);
    await client.query("COMMIT");
    await writeAudit(req.session.userId, "rc_questions.generate", "rc_passage", p.id, result.qualitySummary, req.ip);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ passage: await loadFullPassage(p.id), qualitySummary: result.qualitySummary });
});

// 7. Edit Passage Content & Metadata
readingComprehensionAdminRouter.put("/passages/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const input = updatePassageSchema.parse(req.body);
  const wordCount = countWords(input.passage_text);
  const hash = computeRcHash(input.passage_text);
  const categories = input.categories?.length ? input.categories : [input.category];

  const updated = await pool.query(
    `UPDATE rc_passages
     SET title = $2, examination = $3, category = $4, categories = $5,
         difficulty = $6, passage_length = COALESCE($7, passage_length),
         passage_text = $8, word_count = $9, content_hash = $10,
         recommended_time_seconds = COALESCE($11, recommended_time_seconds),
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [
      req.params.id,
      input.title,
      input.examination,
      input.category,
      JSON.stringify(categories),
      input.difficulty,
      input.passage_length ?? null,
      input.passage_text,
      wordCount,
      hash,
      input.recommended_time_seconds ?? null,
    ],
  );
  if (!updated.rowCount) return res.status(404).json({ error: "Passage not found." });
  await writeAudit(req.session.userId, "rc_passage.update", "rc_passage", req.params.id, { title: input.title }, req.ip);
  res.json({ passage: await loadFullPassage(req.params.id) });
});

// 8. Publish / Unpublish Passage
readingComprehensionAdminRouter.patch("/passages/:id/status", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const nextStatus = z.enum(["draft", "published", "archived"]).parse(req.body?.status);
  if (nextStatus === "published") {
    const qCnt = await pool.query("SELECT count(*)::int AS cnt FROM rc_questions WHERE passage_id = $1", [req.params.id]);
    if (Number(qCnt.rows[0]?.cnt || 0) < 1) {
      return res.status(409).json({ error: "Generate or add at least 1 question before publishing this passage." });
    }
  }
  const resRow = await pool.query(
    `UPDATE rc_passages
     SET status = $2,
         published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [req.params.id, nextStatus],
  );
  if (!resRow.rowCount) return res.status(404).json({ error: "Passage not found." });
  await writeAudit(req.session.userId, "rc_passage.status", "rc_passage", req.params.id, { status: nextStatus }, req.ip);
  res.json({ passage: await loadFullPassage(req.params.id) });
});

// 9. Delete Complete Passage (ON DELETE CASCADE prevents orphaned questions/vocab)
readingComprehensionAdminRouter.delete("/passages/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const del = await pool.query("DELETE FROM rc_passages WHERE id = $1 RETURNING id, title", [req.params.id]);
  if (!del.rowCount) return res.status(404).json({ error: "Passage not found." });
  await writeAudit(req.session.userId, "rc_passage.delete", "rc_passage", del.rows[0].id, { title: del.rows[0].title }, req.ip);
  res.json({ deleted: true, id: del.rows[0].id, title: del.rows[0].title });
});

// 10. Add Individual Question Manually to a Passage
readingComprehensionAdminRouter.post("/passages/:id/questions", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const pRes = await pool.query("SELECT * FROM rc_passages WHERE id = $1", [req.params.id]);
  if (!pRes.rowCount) return res.status(404).json({ error: "Passage not found." });
  const p = pRes.rows[0];
  const input = questionPayloadSchema.parse(req.body);

  const existingQ = await pool.query("SELECT * FROM rc_questions WHERE passage_id = $1", [p.id]);
  const check = validateRcQuestion(input, p.passage_text, existingQ.rows, input.options.length, false);
  if (!check.valid) {
    return res.status(400).json({ error: check.issues.join(" ") });
  }

  const nextNum = existingQ.rows.reduce((max, r) => Math.max(max, Number(r.question_number || 0)), 0) + 1;
  const ins = await pool.query(
    `INSERT INTO rc_questions
       (passage_id, question_number, question_type, category, difficulty,
        question_text, options, correct_answer, explanation, passage_reference,
        validation_status, validation_notes, content_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'edited', '[]'::jsonb, $11)
     RETURNING *`,
    [
      p.id,
      nextNum,
      input.question_type,
      input.category || p.category,
      input.difficulty,
      input.question_text,
      JSON.stringify(input.options),
      input.correct_answer,
      input.explanation,
      input.passage_reference,
      computeRcHash(input.question_text),
    ],
  );
  await writeAudit(req.session.userId, "rc_question.create", "rc_question", ins.rows[0].id, { passageId: p.id }, req.ip);
  res.status(201).json({ question: ins.rows[0], passage: await loadFullPassage(p.id) });
});

// 11. Edit Individual Question Independently (Does NOT modify other questions in the passage)
readingComprehensionAdminRouter.put("/questions/:questionId", async (req, res) => {
  if (!isValidUuid(req.params.questionId)) return res.status(400).json({ error: "Invalid question ID." });
  const qRes = await pool.query("SELECT * FROM rc_questions WHERE id = $1", [req.params.questionId]);
  if (!qRes.rowCount) return res.status(404).json({ error: "Question not found." });
  const target = qRes.rows[0];
  const pRes = await pool.query("SELECT * FROM rc_passages WHERE id = $1", [target.passage_id]);
  const siblingRes = await pool.query(
    "SELECT * FROM rc_questions WHERE passage_id = $1 AND id <> $2",
    [target.passage_id, target.id],
  );

  const input = questionPayloadSchema.parse(req.body);
  const check = validateRcQuestion(input, pRes.rows[0]?.passage_text || "", siblingRes.rows, input.options.length, false);
  if (!check.valid) {
    return res.status(400).json({ error: check.issues.join(" ") });
  }

  const updated = await pool.query(
    `UPDATE rc_questions
     SET question_type = $2,
         category = COALESCE($3, category),
         difficulty = $4,
         question_text = $5,
         options = $6,
         correct_answer = $7,
         explanation = $8,
         passage_reference = $9,
         validation_status = 'edited',
         validation_notes = '[]'::jsonb,
         content_hash = $10,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      target.id,
      input.question_type,
      input.category ?? target.category,
      input.difficulty,
      input.question_text,
      JSON.stringify(input.options),
      input.correct_answer,
      input.explanation,
      input.passage_reference,
      computeRcHash(input.question_text),
    ],
  );
  await writeAudit(req.session.userId, "rc_question.update", "rc_question", target.id, { passageId: target.passage_id }, req.ip);
  res.json({ question: updated.rows[0], passage: await loadFullPassage(target.passage_id) });
});

// 12. Regenerate Individual Question Independently with AI
readingComprehensionAdminRouter.post("/questions/:questionId/regenerate", aiRateLimiter, async (req, res) => {
  if (!isValidUuid(req.params.questionId)) return res.status(400).json({ error: "Invalid question ID." });
  const qRes = await pool.query("SELECT * FROM rc_questions WHERE id = $1", [req.params.questionId]);
  if (!qRes.rowCount) return res.status(404).json({ error: "Question not found." });
  const target = qRes.rows[0];

  const [pRes, siblingRes] = await Promise.all([
    pool.query("SELECT * FROM rc_passages WHERE id = $1", [target.passage_id]),
    pool.query("SELECT * FROM rc_questions WHERE passage_id = $1 AND id <> $2", [target.passage_id, target.id]),
  ]);
  const passage = pRes.rows[0];
  const desiredType = req.body?.question_type || target.question_type;
  const desiredDifficulty = req.body?.difficulty || target.difficulty;

  const regenerated = await regenerateSingleRcQuestionWithAi(
    passage,
    siblingRes.rows,
    { question_type: desiredType, difficulty: desiredDifficulty },
    { optionCount: passage.option_count, includeExplanations: passage.include_explanations },
  );

  const q = regenerated.question;
  const updated = await pool.query(
    `UPDATE rc_questions
     SET question_type = $2,
         difficulty = $3,
         question_text = $4,
         options = $5,
         correct_answer = $6,
         explanation = $7,
         passage_reference = $8,
         validation_status = $9,
         validation_notes = $10,
         content_hash = $11,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      target.id,
      q.question_type,
      q.difficulty,
      q.question_text,
      JSON.stringify(q.options),
      q.correct_answer,
      q.explanation,
      q.passage_reference,
      q.validation_status,
      JSON.stringify(q.validation_notes || []),
      q.content_hash,
    ],
  );
  await writeAudit(req.session.userId, "rc_question.regenerate", "rc_question", target.id, { passageId: target.passage_id }, req.ip);
  res.json({ question: updated.rows[0], passage: await loadFullPassage(target.passage_id) });
});

// 13. Delete Individual Question & Renumber Remaining Questions
readingComprehensionAdminRouter.delete("/questions/:questionId", async (req, res) => {
  if (!isValidUuid(req.params.questionId)) return res.status(400).json({ error: "Invalid question ID." });
  const client = await pool.connect();
  let passageId = null;
  try {
    await client.query("BEGIN");
    const del = await client.query("DELETE FROM rc_questions WHERE id = $1 RETURNING id, passage_id", [req.params.questionId]);
    if (!del.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Question not found." });
    }
    passageId = del.rows[0].passage_id;
    const rem = await client.query(
      "SELECT id FROM rc_questions WHERE passage_id = $1 ORDER BY question_number ASC, created_at ASC",
      [passageId],
    );
    for (let i = 0; i < rem.rows.length; i += 1) {
      await client.query("UPDATE rc_questions SET question_number = $2 WHERE id = $1", [rem.rows[i].id, i + 1]);
    }
    await client.query("COMMIT");
    await writeAudit(req.session.userId, "rc_question.delete", "rc_question", req.params.questionId, { passageId }, req.ip);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.json({ deleted: true, passage: await loadFullPassage(passageId) });
});

// 14. Admin PDF Preview / Download (practice | answers)
readingComprehensionAdminRouter.get("/passages/:id/pdf", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const full = await loadFullPassage(req.params.id);
  if (!full) return res.status(404).json({ error: "Passage not found." });
  const format = String(req.query.format || "practice").toLowerCase();
  const pdf = generateReadingComprehensionPdf({
    passage: full,
    questions: full.questions,
    vocabulary: full.vocabulary,
    format,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdf.fileName}"`);
  res.send(pdf.buffer);
});
