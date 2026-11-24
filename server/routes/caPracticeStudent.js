import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { evaluateCaPracticeAccess } from "../services/caAccessService.js";
import {
  generatePracticeSetPdf,
  SUPPORTED_PDF_FORMATS,
} from "../services/caPdfGeneratorService.js";
import { recordStudyDay, syncMilestones } from "../services/milestones.js";

export const caPracticeStudentRouter = Router();
caPracticeStudentRouter.use(requireAuth);

// ============================================================================
// 1. LIST PUBLISHED PRACTICE SETS (Daily, Weekly, Monthly, Completed)
// ============================================================================
caPracticeStudentRouter.get("/sets", async (req, res) => {
  const scope = String(req.query.scope || "all").toLowerCase();
  const rows = await pool.query(
    `SELECT ps.*,
            la.id AS latest_attempt_id,
            la.status AS latest_attempt_status,
            la.score AS latest_score,
            la.max_score AS latest_max_score,
            la.accuracy_pct AS latest_accuracy_pct,
            la.submitted_at AS latest_submitted_at,
            (SELECT count(*)::int FROM ca_student_attempts a
             WHERE a.practice_set_id = ps.id AND a.student_id = $1 AND a.status <> 'in_progress') AS completed_attempts
     FROM ca_practice_sets ps
     LEFT JOIN LATERAL (
       SELECT id, status, score, max_score, accuracy_pct, submitted_at
       FROM ca_student_attempts
       WHERE practice_set_id = ps.id AND student_id = $1
       ORDER BY started_at DESC
       LIMIT 1
     ) la ON TRUE
     WHERE ps.publication_status = 'published'
       AND (
         $2 = 'all'
         OR ($2 = 'daily' AND ps.set_type IN ('daily_quick', 'daily_standard', 'daily_complete', 'daily_advanced', 'custom'))
         OR ($2 = 'weekly' AND ps.set_type = 'weekly')
         OR ($2 = 'monthly' AND ps.set_type = 'monthly')
         OR ($2 = 'completed' AND la.status IN ('submitted', 'auto_submitted'))
       )
     ORDER BY ps.date_to DESC, ps.published_at DESC NULLS LAST
     LIMIT 60`,
    [req.session.userId, scope],
  );

  res.json({ success: true, sets: rows.rows });
});

// ============================================================================
// 2. START PRACTICE ATTEMPT & FETCH QUESTIONS (Hides Answers Until Submitted)
// ============================================================================
caPracticeStudentRouter.post("/sets/:id/attempts", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });

  const psRes = await pool.query("SELECT * FROM ca_practice_sets WHERE id = $1", [req.params.id]);
  if (!psRes.rowCount) return res.status(404).json({ error: "Practice set not found." });
  const practiceSet = psRes.rows[0];

  const access = await evaluateCaPracticeAccess({
    db: pool,
    userId: req.session.userId,
    userRole: req.session.role,
    practiceSet,
  });
  if (!access.allowed) {
    return res.status(access.httpStatus).json({ error: access.message, code: access.code });
  }

  if (!practiceSet.allow_retry) {
    const prev = await pool.query(
      `SELECT id FROM ca_student_attempts
       WHERE practice_set_id = $1 AND student_id = $2 AND status <> 'in_progress' LIMIT 1`,
      [practiceSet.id, req.session.userId],
    );
    if (prev.rowCount) {
      return res.status(409).json({
        error: "Retry is disabled for this practice set. Review your completed attempt instead.",
        attemptId: prev.rows[0].id,
      });
    }
  }

  const qRes = await pool.query(
    `SELECT q.id, q.question_text, q.question_type, q.difficulty, q.ca_date, q.exam_relevance,
            c.name AS category_name, psq.sort_order, psq.marks,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_practice_set_questions psq
     JOIN ca_generated_questions q ON q.id = psq.question_id
     LEFT JOIN ca_categories c ON c.id = q.category_id
     WHERE psq.practice_set_id = $1
     ORDER BY psq.sort_order ASC`,
    [practiceSet.id],
  );

  if (!qRes.rowCount) {
    return res.status(400).json({ error: "This practice set has no questions." });
  }

  const attemptRes = await pool.query(
    `INSERT INTO ca_student_attempts
       (practice_set_id, student_id, status, total_questions, max_score)
     VALUES ($1,$2,'in_progress',$3,$4)
     RETURNING *`,
    [practiceSet.id, req.session.userId, qRes.rowCount, practiceSet.total_marks || qRes.rowCount],
  );

  res.status(201).json({
    success: true,
    attempt: attemptRes.rows[0],
    practiceSet,
    questions: qRes.rows,
  });
});

// ============================================================================
// 3. SAVE ANSWER / MARK FOR REVIEW / CLEAR RESPONSE
// ============================================================================
caPracticeStudentRouter.put("/attempts/:attemptId/answer", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });
  const input = z
    .object({
      questionId: z.string().uuid(),
      selectedAnswer: z.string().trim().regex(/^[A-E]$/).nullable().optional(),
      isMarkedReview: z.boolean().optional(),
      timeSpentSec: z.coerce.number().int().min(0).max(3600).optional(),
    })
    .parse(req.body ?? {});

  const att = await pool.query(
    "SELECT id, status FROM ca_student_attempts WHERE id = $1 AND student_id = $2",
    [req.params.attemptId, req.session.userId],
  );
  if (!att.rowCount) return res.status(404).json({ error: "Attempt not found." });
  if (att.rows[0].status !== "in_progress") {
    return res.status(409).json({ error: "Attempt is already submitted." });
  }

  await pool.query(
    `INSERT INTO ca_student_answers (attempt_id, question_id, selected_answer, is_marked_review, time_spent_sec, updated_at)
     VALUES ($1,$2,$3,COALESCE($4, FALSE),COALESCE($5, 0),now())
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET
       selected_answer = CASE WHEN $6 THEN $3 ELSE ca_student_answers.selected_answer END,
       is_marked_review = COALESCE($4, ca_student_answers.is_marked_review),
       time_spent_sec = GREATEST(ca_student_answers.time_spent_sec, COALESCE($5, 0)),
       updated_at = now()`,
    [
      req.params.attemptId,
      input.questionId,
      input.selectedAnswer ?? null,
      input.isMarkedReview ?? null,
      input.timeSpentSec ?? null,
      input.selectedAnswer !== undefined,
    ],
  );

  res.json({ success: true });
});

// ============================================================================
// 4. SUBMIT ATTEMPT, CALCULATE BANKING SCORE & RETURN DETAILED SOLUTIONS
// ============================================================================
caPracticeStudentRouter.post("/attempts/:attemptId/submit", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });
  const input = z
    .object({
      autoSubmitted: z.boolean().default(false),
      timeTakenSec: z.coerce.number().int().min(0).max(14400).default(0),
      answers: z.record(z.string(), z.string().nullable()).optional(),
    })
    .parse(req.body ?? {});

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attRes = await client.query(
      `SELECT a.*, ps.marks_per_question, ps.negative_marking, ps.title AS set_title
       FROM ca_student_attempts a
       JOIN ca_practice_sets ps ON ps.id = a.practice_set_id
       WHERE a.id = $1 AND a.student_id = $2
       FOR UPDATE`,
      [req.params.attemptId, req.session.userId],
    );
    if (!attRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Attempt not found." });
    }
    const attempt = attRes.rows[0];
    if (attempt.status !== "in_progress") {
      await client.query("COMMIT");
      return res.json({ success: true, alreadySubmitted: true, attemptId: attempt.id });
    }

    // Flush any final answer map sent in submit payload
    if (input.answers) {
      for (const [qId, ans] of Object.entries(input.answers)) {
        if (!isValidUuid(qId)) continue;
        await client.query(
          `INSERT INTO ca_student_answers (attempt_id, question_id, selected_answer, updated_at)
           VALUES ($1,$2,$3,now())
           ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_answer = $3, updated_at = now()`,
          [attempt.id, qId, ans || null],
        );
      }
    }

    const qRows = await client.query(
      `SELECT q.id, q.correct_answer, psq.marks
       FROM ca_practice_set_questions psq
       JOIN ca_generated_questions q ON q.id = psq.question_id
       WHERE psq.practice_set_id = $1`,
      [attempt.practice_set_id],
    );
    const ansRows = await client.query(
      "SELECT question_id, selected_answer FROM ca_student_answers WHERE attempt_id = $1",
      [attempt.id],
    );
    const ansMap = new Map(ansRows.rows.map((r) => [r.question_id, r.selected_answer]));

    const posMarks = Number(attempt.marks_per_question) || 1;
    const negMarks = Number(attempt.negative_marking) || 0;
    let attemptedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let score = 0;
    let maxScore = 0;

    for (const q of qRows.rows) {
      const qMarks = Number(q.marks) || posMarks;
      maxScore += qMarks;
      const sel = ansMap.get(q.id) || null;
      if (!sel) continue;
      attemptedCount += 1;
      const isCorrect = sel === q.correct_answer;
      const awarded = isCorrect ? qMarks : -negMarks;
      if (isCorrect) correctCount += 1;
      else incorrectCount += 1;
      score += awarded;

      await client.query(
        `UPDATE ca_student_answers
         SET is_correct = $3, marks_awarded = $4, updated_at = now()
         WHERE attempt_id = $1 AND question_id = $2`,
        [attempt.id, q.id, isCorrect, awarded],
      );
    }

    const unattemptedCount = Math.max(0, qRows.rowCount - attemptedCount);
    const finalScore = Number(score.toFixed(2));
    const finalMax = Number(maxScore.toFixed(2));
    const accuracyPct = attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(2)) : 0;

    await client.query(
      `UPDATE ca_student_attempts
       SET status = $2, submitted_at = now(), time_taken_sec = $3,
           total_questions = $4, attempted_count = $5, correct_count = $6,
           incorrect_count = $7, unattempted_count = $8,
           score = $9, max_score = $10, accuracy_pct = $11
       WHERE id = $1`,
      [
        attempt.id,
        input.autoSubmitted ? "auto_submitted" : "submitted",
        input.timeTakenSec,
        qRows.rowCount,
        attemptedCount,
        correctCount,
        incorrectCount,
        unattemptedCount,
        finalScore,
        finalMax,
        accuracyPct,
      ],
    );
    await client.query("COMMIT");

    if (attemptedCount > 0) {
      await recordStudyDay(req.session.userId);
      await syncMilestones(req.session.userId);
    }

    res.json({ success: true, attemptId: attempt.id });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// ============================================================================
// 5. ATTEMPT RESULT & DETAILED SOLUTIONS
// ============================================================================
caPracticeStudentRouter.get("/attempts/:attemptId/result", async (req, res) => {
  if (!isValidUuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid attempt ID." });

  const attRes = await pool.query(
    `SELECT a.*, ps.title AS set_title, ps.set_type, ps.date_from, ps.date_to,
            ps.negative_marking, ps.marks_per_question, ps.allow_retry
     FROM ca_student_attempts a
     JOIN ca_practice_sets ps ON ps.id = a.practice_set_id
     WHERE a.id = $1 AND a.student_id = $2`,
    [req.params.attemptId, req.session.userId],
  );
  if (!attRes.rowCount) return res.status(404).json({ error: "Attempt not found." });
  const attempt = attRes.rows[0];
  if (attempt.status === "in_progress") {
    return res.status(400).json({ error: "Submit the practice set before viewing solutions." });
  }

  const [solutionsRes, rankRes] = await Promise.all([
    pool.query(
      `SELECT q.id, q.question_text, q.question_type, q.difficulty, q.correct_answer,
              q.detailed_explanation, q.why_correct, q.why_others_incorrect,
              q.important_facts, q.source_reference, q.ca_date, c.name AS category_name,
              sa.selected_answer, sa.is_correct, sa.marks_awarded, sa.is_marked_review,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'option_label', o.option_label, 'option_text', o.option_text, 'is_correct', o.is_correct
                ) ORDER BY o.sort_order ASC)
                FROM ca_question_options o WHERE o.question_id = q.id
              ), '[]'::jsonb) AS options
       FROM ca_practice_set_questions psq
       JOIN ca_generated_questions q ON q.id = psq.question_id
       LEFT JOIN ca_categories c ON c.id = q.category_id
       LEFT JOIN ca_student_answers sa ON sa.question_id = q.id AND sa.attempt_id = $1
       WHERE psq.practice_set_id = $2
       ORDER BY psq.sort_order ASC`,
      [attempt.id, attempt.practice_set_id],
    ),
    pool.query(
      `SELECT count(DISTINCT student_id)::int AS total_students,
              count(DISTINCT student_id) FILTER (WHERE best_score > $2)::int + 1 AS rank
       FROM (
         SELECT student_id, max(score) AS best_score
         FROM ca_student_attempts
         WHERE practice_set_id = $1 AND status <> 'in_progress'
         GROUP BY student_id
       ) ranked`,
      [attempt.practice_set_id, attempt.score],
    ),
  ]);

  const totalStudents = rankRes.rows[0]?.total_students || 0;
  const ranking =
    totalStudents >= 3
      ? {
          rank: rankRes.rows[0].rank,
          totalStudents,
          percentile: Number((((totalStudents - rankRes.rows[0].rank + 1) / totalStudents) * 100).toFixed(1)),
        }
      : null;

  res.json({
    success: true,
    attempt,
    ranking,
    solutions: solutionsRes.rows,
  });
});

// ============================================================================
// 6. PDF QUESTION PAPER GENERATION & DOWNLOAD (All 4 Formats + Access Control)
// ============================================================================
caPracticeStudentRouter.get("/sets/:id/pdf/:format", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid practice set ID." });
  const format = String(req.params.format || "");
  if (!SUPPORTED_PDF_FORMATS.includes(format)) {
    return res.status(400).json({ error: `Unsupported PDF format. Use: ${SUPPORTED_PDF_FORMATS.join(", ")}` });
  }

  const psRes = await pool.query("SELECT * FROM ca_practice_sets WHERE id = $1", [req.params.id]);
  if (!psRes.rowCount) return res.status(404).json({ error: "Practice set not found." });
  const practiceSet = psRes.rows[0];

  const access = await evaluateCaPracticeAccess({
    db: pool,
    userId: req.session.userId,
    userRole: req.session.role,
    practiceSet,
  });
  if (!access.allowed) {
    return res.status(access.httpStatus).json({ error: access.message, code: access.code });
  }

  const qRes = await pool.query(
    `SELECT q.*, c.name AS category_name,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text, 'is_correct', o.is_correct
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_practice_set_questions psq
     JOIN ca_generated_questions q ON q.id = psq.question_id
     LEFT JOIN ca_categories c ON c.id = q.category_id
     WHERE psq.practice_set_id = $1
     ORDER BY psq.sort_order ASC`,
    [practiceSet.id],
  );

  const pdfOut = generatePracticeSetPdf({
    practiceSet,
    questions: qRes.rows,
    format,
  });

  await pool.query(
    `INSERT INTO ca_pdf_exports (practice_set_id, student_id, pdf_format, file_name, file_size_bytes, sha256_hash)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [practiceSet.id, req.session.userId, format, pdfOut.fileName, pdfOut.fileSizeBytes, pdfOut.sha256Hash],
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdfOut.fileName}"`);
  res.setHeader("X-PDF-SHA256", pdfOut.sha256Hash);
  res.send(pdfOut.buffer);
});

// ============================================================================
// 7. STUDENT PERFORMANCE DASHBOARD, REVISION & DOWNLOADED PDFs (Phase 12)
// ============================================================================
caPracticeStudentRouter.get("/performance", async (req, res) => {
  const uid = req.session.userId;
  const [overviewRes, catRes, diffRes, trendRes] = await Promise.all([
    pool.query(
      `SELECT
         count(*) FILTER (WHERE ps.set_type IN ('daily_quick','daily_standard','daily_complete','daily_advanced','custom'))::int AS daily_completed,
         count(*) FILTER (WHERE ps.set_type = 'weekly')::int AS weekly_completed,
         count(*) FILTER (WHERE ps.set_type = 'monthly')::int AS monthly_completed,
         coalesce(sum(a.attempted_count), 0)::int AS total_attempted,
         coalesce(sum(a.correct_count), 0)::int AS total_correct,
         coalesce(sum(a.incorrect_count), 0)::int AS total_incorrect,
         coalesce(round(avg(a.accuracy_pct), 2), 0) AS overall_accuracy_pct
       FROM ca_student_attempts a
       JOIN ca_practice_sets ps ON ps.id = a.practice_set_id
       WHERE a.student_id = $1 AND a.status <> 'in_progress'`,
      [uid],
    ),
    pool.query(
      `SELECT COALESCE(c.name, 'General Current Affairs') AS category_name,
              count(sa.id)::int AS attempted,
              count(*) FILTER (WHERE sa.is_correct)::int AS correct,
              coalesce(round(avg(CASE WHEN sa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) AS accuracy_pct
       FROM ca_student_answers sa
       JOIN ca_student_attempts a ON a.id = sa.attempt_id
       JOIN ca_generated_questions q ON q.id = sa.question_id
       LEFT JOIN ca_categories c ON c.id = q.category_id
       WHERE a.student_id = $1 AND a.status <> 'in_progress' AND sa.selected_answer IS NOT NULL
       GROUP BY c.name
       ORDER BY accuracy_pct ASC, attempted DESC`,
      [uid],
    ),
    pool.query(
      `SELECT q.difficulty,
              count(sa.id)::int AS attempted,
              count(*) FILTER (WHERE sa.is_correct)::int AS correct,
              coalesce(round(avg(CASE WHEN sa.is_correct THEN 100.0 ELSE 0.0 END), 1), 0) AS accuracy_pct
       FROM ca_student_answers sa
       JOIN ca_student_attempts a ON a.id = sa.attempt_id
       JOIN ca_generated_questions q ON q.id = sa.question_id
       WHERE a.student_id = $1 AND a.status <> 'in_progress' AND sa.selected_answer IS NOT NULL
       GROUP BY q.difficulty`,
      [uid],
    ),
    pool.query(
      `SELECT to_char(a.submitted_at, 'YYYY-MM-DD') AS day,
              round(avg(a.accuracy_pct), 1) AS accuracy_pct,
              count(*)::int AS sets_completed
       FROM ca_student_attempts a
       WHERE a.student_id = $1 AND a.status <> 'in_progress' AND a.submitted_at IS NOT NULL
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 14`,
      [uid],
    ),
  ]);

  const weakTopics = catRes.rows.filter((r) => Number(r.accuracy_pct) < 70);

  res.json({
    success: true,
    overview: overviewRes.rows[0] || {},
    categoryPerformance: catRes.rows,
    difficultyPerformance: diffRes.rows,
    trend: trendRes.rows.reverse(),
    weakTopics,
  });
});

caPracticeStudentRouter.get("/revision", async (req, res) => {
  const rows = await pool.query(
    `SELECT DISTINCT ON (q.id)
            q.id, q.question_text, q.question_type, q.difficulty, q.correct_answer,
            q.detailed_explanation, q.why_correct, q.why_others_incorrect,
            q.important_facts, q.source_reference, q.ca_date,
            c.name AS category_name,
            sa.selected_answer AS last_wrong_answer,
            sa.updated_at AS last_attempted_at,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'option_label', o.option_label, 'option_text', o.option_text
              ) ORDER BY o.sort_order ASC)
              FROM ca_question_options o WHERE o.question_id = q.id
            ), '[]'::jsonb) AS options
     FROM ca_student_answers sa
     JOIN ca_student_attempts a ON a.id = sa.attempt_id
     JOIN ca_generated_questions q ON q.id = sa.question_id
     LEFT JOIN ca_categories c ON c.id = q.category_id
     WHERE a.student_id = $1 AND sa.is_correct = FALSE
     ORDER BY q.id, sa.updated_at DESC
     LIMIT 50`,
    [req.session.userId],
  );
  res.json({ success: true, questions: rows.rows });
});

caPracticeStudentRouter.get("/pdfs", async (req, res) => {
  const rows = await pool.query(
    `SELECT pe.id, pe.practice_set_id, pe.pdf_format, pe.file_name, pe.file_size_bytes, pe.created_at,
            ps.title AS practice_set_title, ps.date_to
     FROM ca_pdf_exports pe
     JOIN ca_practice_sets ps ON ps.id = pe.practice_set_id
     WHERE pe.student_id = $1
     ORDER BY pe.created_at DESC
     LIMIT 40`,
    [req.session.userId],
  );
  res.json({ success: true, downloads: rows.rows });
});
