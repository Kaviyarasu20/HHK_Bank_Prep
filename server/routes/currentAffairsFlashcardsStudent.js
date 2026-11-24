import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { isValidUuid } from "../services/caUrlSecurity.js";
import { computeNextFlashcardReview } from "../services/caFlashcardReviewScheduler.js";
import { recordStudyDay } from "../services/milestones.js";

export const currentAffairsFlashcardsStudentRouter = Router();
currentAffairsFlashcardsStudentRouter.use(requireAuth);

// 1. Student Flashcard Progress Dashboard (real DB metrics only)
currentAffairsFlashcardsStudentRouter.get("/progress", async (req, res) => {
  const [totalRes, progRes, bmRes, todayRes] = await Promise.all([
    pool.query("SELECT count(*)::int AS total FROM current_affairs_flashcards WHERE publication_status = 'published'"),
    pool.query(
      `SELECT
         count(*)::int AS studied,
         count(*) FILTER (WHERE last_response IN ('good', 'easy'))::int AS known,
         count(*) FILTER (WHERE last_response IN ('again', 'hard'))::int AS needs_revision,
         count(*) FILTER (WHERE next_review_at <= now())::int AS due_today
       FROM current_affairs_flashcard_progress p
       JOIN current_affairs_flashcards f ON f.id = p.flashcard_id
       WHERE p.student_id = $1 AND f.publication_status = 'published'`,
      [req.session.userId],
    ),
    pool.query(
      `SELECT count(*)::int AS bookmarked
       FROM current_affairs_flashcard_bookmarks b
       JOIN current_affairs_flashcards f ON f.id = b.flashcard_id
       WHERE b.student_id = $1 AND f.publication_status = 'published'`,
      [req.session.userId],
    ),
    pool.query(
      `SELECT count(*)::int AS reviewed_today
       FROM current_affairs_flashcard_reviews
       WHERE student_id = $1
         AND (reviewed_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date`,
      [req.session.userId],
    ),
  ]);

  const totalCards = totalRes.rows[0]?.total ?? 0;
  const p = progRes.rows[0] || {};
  const studied = p.studied ?? 0;
  const known = p.known ?? 0;
  res.json({
    success: true,
    progress: {
      totalCards,
      studied,
      known,
      needsRevision: p.needs_revision ?? 0,
      dueToday: p.due_today ?? 0,
      bookmarked: bmRes.rows[0]?.bookmarked ?? 0,
      reviewedToday: todayRes.rows[0]?.reviewed_today ?? 0,
      completionPercent: totalCards > 0 ? Math.round((known / totalCards) * 100) : 0,
    },
  });
});

// 2. Published Decks (only decks containing >= 1 published card)
currentAffairsFlashcardsStudentRouter.get("/decks", async (req, res) => {
  const deckType = req.query.deckType ? String(req.query.deckType).trim() : null;
  const examCode = req.query.exam ? String(req.query.exam).trim() : null;

  const rows = await pool.query(
    `SELECT
       d.id, d.deck_name, d.description, d.deck_type, d.category, d.topic,
       d.exam_code, d.difficulty, d.start_date, d.end_date,
       count(f.id)::int AS card_count,
       count(p.flashcard_id) FILTER (WHERE p.last_response IN ('good', 'easy'))::int AS known_count,
       count(p.flashcard_id) FILTER (WHERE p.next_review_at <= now())::int AS due_count
     FROM current_affairs_flashcard_decks d
     JOIN current_affairs_flashcards f
       ON f.deck_id = d.id AND f.publication_status = 'published'
     LEFT JOIN current_affairs_flashcard_progress p
       ON p.flashcard_id = f.id AND p.student_id = $1
     WHERE d.publication_status = 'published'
       AND ($2::text IS NULL OR d.deck_type = $2)
       AND ($3::text IS NULL OR d.exam_code = $3)
     GROUP BY d.id
     HAVING count(f.id) > 0
     ORDER BY d.updated_at DESC`,
    [req.session.userId, deckType, examCode],
  );
  res.json({ success: true, decks: rows.rows });
});

// 3. Due / Difficult / Bookmarked / New Review Queue
currentAffairsFlashcardsStudentRouter.get("/review/due", async (req, res) => {
  const mode = String(req.query.mode || "due"); // due | difficult | bookmarked | new
  let modeSql = "(p.next_review_at IS NULL OR p.next_review_at <= now())";
  if (mode === "difficult") modeSql = "p.last_response IN ('again', 'hard')";
  else if (mode === "bookmarked") modeSql = "b.id IS NOT NULL";
  else if (mode === "new") modeSql = "p.flashcard_id IS NULL";

  const rows = await pool.query(
    `SELECT
       f.id, f.deck_id, f.card_type, f.front_text, f.back_text, f.explanation,
       f.difficulty, f.category, f.topic, f.exam_tags, f.study_priority,
       f.source_url, f.effective_date,
       p.last_response, p.successful_reviews, p.missed_reviews,
       p.current_interval_days, p.last_reviewed_at, p.next_review_at,
       (b.id IS NOT NULL) AS is_bookmarked
     FROM current_affairs_flashcards f
     LEFT JOIN current_affairs_flashcard_progress p
       ON p.flashcard_id = f.id AND p.student_id = $1
     LEFT JOIN current_affairs_flashcard_bookmarks b
       ON b.flashcard_id = f.id AND b.student_id = $1
     WHERE f.publication_status = 'published' AND ${modeSql}
     ORDER BY p.next_review_at ASC NULLS FIRST, f.created_at DESC
     LIMIT 50`,
    [req.session.userId],
  );
  res.json({ success: true, mode, cards: rows.rows });
});

// 4. Single Deck with Cards
currentAffairsFlashcardsStudentRouter.get("/decks/:id", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid deck ID." });
  const [deckRes, cardsRes] = await Promise.all([
    pool.query(
      "SELECT * FROM current_affairs_flashcard_decks WHERE id = $1 AND publication_status = 'published'",
      [req.params.id],
    ),
    pool.query(
      `SELECT
         f.id, f.deck_id, f.card_type, f.front_text, f.back_text, f.explanation,
         f.difficulty, f.category, f.topic, f.exam_tags, f.study_priority,
         f.source_url, f.effective_date,
         p.last_response, p.successful_reviews, p.missed_reviews,
         p.current_interval_days, p.last_reviewed_at, p.next_review_at,
         (b.id IS NOT NULL) AS is_bookmarked
       FROM current_affairs_flashcards f
       LEFT JOIN current_affairs_flashcard_progress p
         ON p.flashcard_id = f.id AND p.student_id = $2
       LEFT JOIN current_affairs_flashcard_bookmarks b
         ON b.flashcard_id = f.id AND b.student_id = $2
       WHERE f.deck_id = $1 AND f.publication_status = 'published'
       ORDER BY p.next_review_at ASC NULLS FIRST, f.created_at ASC`,
      [req.params.id, req.session.userId],
    ),
  ]);
  if (!deckRes.rowCount) return res.status(404).json({ error: "Published flashcard deck not found." });
  res.json({ success: true, deck: deckRes.rows[0], cards: cardsRes.rows });
});

// 5. Record Spaced-Repetition Review (Transaction-Safe History + Progress + Streak)
currentAffairsFlashcardsStudentRouter.post("/:id/review", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid flashcard ID." });
  const { response } = z.object({ response: z.enum(["again", "hard", "good", "easy"]) }).parse(req.body);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cardCheck = await client.query(
      "SELECT id FROM current_affairs_flashcards WHERE id = $1 AND publication_status = 'published'",
      [req.params.id],
    );
    if (!cardCheck.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Published flashcard not found." });
    }

    const prevRes = await client.query(
      "SELECT * FROM current_affairs_flashcard_progress WHERE flashcard_id = $1 AND student_id = $2 FOR UPDATE",
      [req.params.id, req.session.userId],
    );
    const prev = prevRes.rows[0] || {};
    const sched = computeNextFlashcardReview({
      response,
      previousIntervalDays: prev.current_interval_days ?? 0,
      successfulReviews: prev.successful_reviews ?? 0,
      missedReviews: prev.missed_reviews ?? 0,
    });

    await client.query(
      `INSERT INTO current_affairs_flashcard_reviews
         (flashcard_id, student_id, response, previous_interval_days, next_interval_days, next_review_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.params.id,
        req.session.userId,
        sched.response,
        sched.previousIntervalDays,
        sched.nextIntervalDays,
        sched.nextReviewAt,
      ],
    );

    await client.query(
      `INSERT INTO current_affairs_flashcard_progress
         (flashcard_id, student_id, last_response, successful_reviews, missed_reviews,
          current_interval_days, last_reviewed_at, next_review_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
       ON CONFLICT (flashcard_id, student_id) DO UPDATE SET
         last_response = $3,
         successful_reviews = $4,
         missed_reviews = $5,
         current_interval_days = $6,
         last_reviewed_at = now(),
         next_review_at = $7`,
      [
        req.params.id,
        req.session.userId,
        sched.response,
        sched.successfulReviews,
        sched.missedReviews,
        sched.nextIntervalDays,
        sched.nextReviewAt,
      ],
    );

    await client.query("COMMIT");
    await recordStudyDay(req.session.userId);
    res.json({ success: true, schedule: sched });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// 6. Toggle Bookmark
currentAffairsFlashcardsStudentRouter.post("/:id/bookmark", async (req, res) => {
  if (!isValidUuid(req.params.id)) return res.status(400).json({ error: "Invalid flashcard ID." });
  const { isBookmarked } = z.object({ isBookmarked: z.boolean() }).parse(req.body);

  const check = await pool.query(
    "SELECT id FROM current_affairs_flashcards WHERE id = $1 AND publication_status = 'published'",
    [req.params.id],
  );
  if (!check.rowCount) return res.status(404).json({ error: "Published flashcard not found." });

  if (isBookmarked) {
    await pool.query(
      "INSERT INTO current_affairs_flashcard_bookmarks (flashcard_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, req.session.userId],
    );
  } else {
    await pool.query(
      "DELETE FROM current_affairs_flashcard_bookmarks WHERE flashcard_id = $1 AND student_id = $2",
      [req.params.id, req.session.userId],
    );
  }
  res.json({ success: true, isBookmarked });
});
