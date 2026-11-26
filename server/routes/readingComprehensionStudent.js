import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import {
  RC_ALL_CATEGORIES,
  RC_DIFFICULTIES,
  RC_EXAMINATIONS,
  RC_QUESTION_FOCUSED_CATEGORIES,
  RC_SUBJECT_CATEGORIES,
} from "../services/rcAiEngineService.js";
import { generateReadingComprehensionPdf } from "../services/rcPdfGeneratorService.js";
import { recordStudyDay, syncMilestones } from "../services/milestones.js";

export const readingComprehensionStudentRouter = Router();
readingComprehensionStudentRouter.use(requireAuth);

// 1. Metadata for Student Filters
readingComprehensionStudentRouter.get("/meta", (_req, res) => {
  res.json({
    examinations: RC_EXAMINATIONS,
    subjectCategories: RC_SUBJECT_CATEGORIES,
    questionFocusedCategories: RC_QUESTION_FOCUSED_CATEGORIES,
    allCategories: RC_ALL_CATEGORIES,
    difficulties: RC_DIFFICULTIES,
  });
});

// 2. List Published Reading Comprehension Passages for Students
readingComprehensionStudentRouter.get("/passages", async (req, res) => {
  const examination = req.query.examination ? String(req.query.examination).trim() : null;
  const category = req.query.category ? String(req.query.category).trim() : null;
  const difficulty = req.query.difficulty ? String(req.query.difficulty).trim().toLowerCase() : null;
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;

  const rows = await pool.query(
    `SELECT p.id, p.title, p.examination, p.category, p.categories, p.difficulty,
            p.passage_length, p.word_count, p.option_count, p.recommended_time_seconds,
            p.published_at, p.created_at,
            (SELECT count(*)::int FROM rc_questions q WHERE q.passage_id = p.id) AS question_count,
            (SELECT count(*)::int FROM rc_vocabulary v WHERE v.passage_id = p.id) AS vocabulary_count,
            la.id AS latest_attempt_id,
            la.status AS latest_attempt_status,
            la.score AS latest_score,
            la.max_score AS latest_max_score,
            la.accuracy_pct AS latest_accuracy_pct,
            la.submitted_at AS latest_submitted_at
     FROM rc_passages p
     LEFT JOIN LATERAL (
       SELECT id, status, score, max_score, accuracy_pct, submitted_at
       FROM rc_student_attempts
       WHERE passage_id = p.id AND student_id = $1
       ORDER BY started_at DESC
       LIMIT 1
     ) la ON TRUE
     WHERE p.status = 'published'
       AND ($2::text IS NULL OR p.examination = $2)
       AND ($3::text IS NULL OR p.category = $3 OR p.categories ? $3)
       AND ($4::text IS NULL OR p.difficulty = $4)
       AND ($5::text IS NULL OR p.title ILIKE $5 OR p.category ILIKE $5)
     ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
     LIMIT 100`,
    [req.session.userId, examination, category, difficulty, search],
  );
  res.json({ passages: rows.rows });
});

// 3. Start (or Resume) Timed Practice Attempt for a Published Passage
readingComprehensionStudentRouter.post("/passages/:id/attempts", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const pRes = await pool.query(
    `SELECT id, title, examination, category, categories, difficulty, passage_length,
            passage_text, word_count, option_count, recommended_time_seconds
     FROM rc_passages
     WHERE id = $1 AND status = 'published'`,
    [req.params.id],
  );
  if (!pRes.rowCount) return res.status(404).json({ error: "Published Reading Comprehension passage not found." });
  const passage = pRes.rows[0];

  // Return questions WITHOUT correct_answer or explanation during active practice
  const qRes = await pool.query(
    `SELECT id, question_number, question_type, difficulty, question_text, options, marks, negative_marks
     FROM rc_questions
     WHERE passage_id = $1
     ORDER BY question_number ASC, created_at ASC`,
    [passage.id],
  );
  if (!qRes.rowCount) {
    return res.status(409).json({ error: "This passage has no questions available yet." });
  }

  const maxScore = qRes.rows.reduce((sum, q) => sum + Number(q.marks || 1), 0);
  const existing = await pool.query(
    `SELECT * FROM rc_student_attempts
     WHERE student_id = $1 AND passage_id = $2 AND status = 'in_progress'
     ORDER BY started_at DESC LIMIT 1`,
    [req.session.userId, passage.id],
  );

  let attempt;
  if (existing.rowCount && !req.body?.restart) {
    attempt = existing.rows[0];
  } else {
    const ins = await pool.query(
      `INSERT INTO rc_student_attempts
         (student_id, passage_id, status, total_questions, max_score)
       VALUES ($1, $2, 'in_progress', $3, $4)
       RETURNING *`,
      [req.session.userId, passage.id, qRes.rows.length, maxScore],
    );
    attempt = ins.rows[0];
  }

  res.status(201).json({
    attempt,
    passage,
    questions: qRes.rows,
  });
});

// 4. Save Practice Progress (Answers + Mark for Review + Time Spent)
readingComprehensionStudentRouter.patch("/attempts/:attemptId/progress", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });
  const schema = z.object({
    answers: z.record(z.string(), z.string()).optional(),
    markedForReview: z.array(z.string()).optional(),
    timeSpentSeconds: z.number().int().min(0).max(86400).optional(),
  });
  const input = schema.parse(req.body || {});
  const updated = await pool.query(
    `UPDATE rc_student_attempts
     SET answers = COALESCE($3::jsonb, answers),
         marked_for_review = COALESCE($4::jsonb, marked_for_review),
         time_spent_seconds = COALESCE($5, time_spent_seconds)
     WHERE id = $1 AND student_id = $2 AND status = 'in_progress'
     RETURNING id, answers, marked_for_review, time_spent_seconds`,
    [
      req.params.attemptId,
      req.session.userId,
      input.answers ? JSON.stringify(input.answers) : null,
      input.markedForReview ? JSON.stringify(input.markedForReview) : null,
      input.timeSpentSeconds ?? null,
    ],
  );
  if (!updated.rowCount) return res.status(404).json({ error: "Active practice attempt not found." });
  res.json({ attempt: updated.rows[0] });
});

// 5. Submit Attempt & Evaluate Server-Side (Returns Results + Explanations + Vocabulary)
readingComprehensionStudentRouter.post("/attempts/:attemptId/submit", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });
  const attRes = await pool.query(
    "SELECT * FROM rc_student_attempts WHERE id = $1 AND student_id = $2",
    [req.params.attemptId, req.session.userId],
  );
  if (!attRes.rowCount) return res.status(404).json({ error: "Attempt not found." });
  const attempt = attRes.rows[0];

  const answers = req.body?.answers && typeof req.body.answers === "object"
    ? req.body.answers
    : (attempt.answers || {});
  const markedForReview = Array.isArray(req.body?.markedForReview)
    ? req.body.markedForReview
    : (attempt.marked_for_review || []);
  const timeSpentSeconds = Math.max(0, Number(req.body?.timeSpentSeconds ?? attempt.time_spent_seconds ?? 0));
  const autoSubmitted = Boolean(req.body?.autoSubmitted);

  const [pRes, qRes, vRes] = await Promise.all([
    pool.query("SELECT * FROM rc_passages WHERE id = $1", [attempt.passage_id]),
    pool.query(
      "SELECT * FROM rc_questions WHERE passage_id = $1 ORDER BY question_number ASC, created_at ASC",
      [attempt.passage_id],
    ),
    pool.query(
      "SELECT * FROM rc_vocabulary WHERE passage_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [attempt.passage_id],
    ),
  ]);

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let score = 0;
  let maxScore = 0;

  const reviewedQuestions = qRes.rows.map((q) => {
    const marks = Number(q.marks || 1);
    const neg = Number(q.negative_marks || 0.25);
    maxScore += marks;
    const selected = String(answers[q.id] || "").trim().toUpperCase();
    let outcome = "unanswered";
    if (!selected) {
      unansweredCount += 1;
    } else if (selected === String(q.correct_answer).toUpperCase()) {
      correctCount += 1;
      score += marks;
      outcome = "correct";
    } else {
      wrongCount += 1;
      score -= neg;
      outcome = "wrong";
    }
    return {
      ...q,
      selected_answer: selected || null,
      outcome,
    };
  });

  const attempted = correctCount + wrongCount;
  const accuracyPct = attempted > 0 ? Number(((correctCount / attempted) * 100).toFixed(2)) : 0;
  const finalScore = Number(score.toFixed(2));
  const finalMaxScore = Number(maxScore.toFixed(2));

  const saved = await pool.query(
    `UPDATE rc_student_attempts
     SET status = $3,
         answers = $4::jsonb,
         marked_for_review = $5::jsonb,
         total_questions = $6,
         correct_count = $7,
         wrong_count = $8,
         unanswered_count = $9,
         score = $10,
         max_score = $11,
         accuracy_pct = $12,
         time_spent_seconds = $13,
         submitted_at = COALESCE(submitted_at, now())
     WHERE id = $1 AND student_id = $2
     RETURNING *`,
    [
      attempt.id,
      req.session.userId,
      autoSubmitted ? "auto_submitted" : "submitted",
      JSON.stringify(answers),
      JSON.stringify(markedForReview),
      qRes.rows.length,
      correctCount,
      wrongCount,
      unansweredCount,
      finalScore,
      finalMaxScore,
      accuracyPct,
      timeSpentSeconds,
    ],
  );

  // Update study streak & milestones silently
  try {
    await recordStudyDay(pool, req.session.userId);
    await syncMilestones(pool, req.session.userId);
  } catch {}

  res.json({
    attempt: saved.rows[0],
    passage: pRes.rows[0],
    questions: reviewedQuestions,
    vocabulary: vRes.rows,
  });
});

// 6. Retrieve Graded Attempt Result + Explanations + Vocabulary
readingComprehensionStudentRouter.get("/attempts/:attemptId/result", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });
  const attRes = await pool.query(
    "SELECT * FROM rc_student_attempts WHERE id = $1 AND student_id = $2 AND status <> 'in_progress'",
    [req.params.attemptId, req.session.userId],
  );
  if (!attRes.rowCount) return res.status(404).json({ error: "Submitted attempt not found." });
  const attempt = attRes.rows[0];
  const answers = attempt.answers || {};

  const [pRes, qRes, vRes] = await Promise.all([
    pool.query("SELECT * FROM rc_passages WHERE id = $1", [attempt.passage_id]),
    pool.query(
      "SELECT * FROM rc_questions WHERE passage_id = $1 ORDER BY question_number ASC, created_at ASC",
      [attempt.passage_id],
    ),
    pool.query(
      "SELECT * FROM rc_vocabulary WHERE passage_id = $1 ORDER BY sort_order ASC, created_at ASC",
      [attempt.passage_id],
    ),
  ]);

  const reviewedQuestions = qRes.rows.map((q) => {
    const selected = String(answers[q.id] || "").trim().toUpperCase();
    const outcome = !selected
      ? "unanswered"
      : selected === String(q.correct_answer).toUpperCase()
        ? "correct"
        : "wrong";
    return { ...q, selected_answer: selected || null, outcome };
  });

  res.json({
    attempt,
    passage: pRes.rows[0],
    questions: reviewedQuestions,
    vocabulary: vRes.rows,
  });
});

// 7. Student PDF Download (format=practice | format=answers)
readingComprehensionStudentRouter.get("/passages/:id/pdf", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid passage ID." });
  const pRes = await pool.query(
    "SELECT * FROM rc_passages WHERE id = $1 AND status = 'published'",
    [req.params.id],
  );
  if (!pRes.rowCount) return res.status(404).json({ error: "Published passage not found." });
  const passage = pRes.rows[0];
  const [qRes, vRes] = await Promise.all([
    pool.query("SELECT * FROM rc_questions WHERE passage_id = $1 ORDER BY question_number ASC, created_at ASC", [passage.id]),
    pool.query("SELECT * FROM rc_vocabulary WHERE passage_id = $1 ORDER BY sort_order ASC, created_at ASC", [passage.id]),
  ]);

  const format = String(req.query.format || "practice").toLowerCase();
  const pdf = generateReadingComprehensionPdf({
    passage,
    questions: qRes.rows,
    vocabulary: vRes.rows,
    format,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdf.fileName}"`);
  res.send(pdf.buffer);
});
