import { pool } from "../db.js";
import { recordStudyDay, syncMilestones } from "./milestones.js";
import { calculateRevisionPriority, DEFAULT_SIGNAL_WEIGHTS } from "./revisionPriorityCalculator.js";
import { scheduleNextRevision } from "./revisionScheduler.js";
import { analyzeWeakTopics } from "./weakTopicAnalyzer.js";
import {
  buildDailyRevisionPlan,
  DEFAULT_DAILY_ITEM_LIMIT,
  estimateMinutesForContentType,
  normalizeDailyLimit,
} from "./revisionRecommendationService.js";
import { SUPPORTED_EXAM_CODES } from "./caExamMapper.js";

/**
 * Smart Revision Engine (Database-Backed Orchestrator).
 * Aggregates real student learning signals across HHK modules:
 * - Practice & Mock Test incorrect answers (never counting unanswered as incorrect)
 * - Weak topics (enforcing minimum-attempt threshold)
 * - Bookmarked questions, articles, and flashcards
 * - Overdue & difficult flashcards (reusing Phase 7 progress)
 * - High-priority banking awareness & one-liners
 */

function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export async function getStudentRevisionPreferences(studentId) {
  const { rows } = await pool.query(
    `SELECT student_id, target_exams, daily_item_limit, signal_weights, updated_at
     FROM student_revision_preferences
     WHERE student_id = $1`,
    [studentId],
  );
  if (rows.length > 0) {
    return {
      studentId,
      targetExams: Array.isArray(rows[0].target_exams) ? rows[0].target_exams : [],
      dailyItemLimit: normalizeDailyLimit(rows[0].daily_item_limit),
      signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS, ...(rows[0].signal_weights || {}) },
      updatedAt: rows[0].updated_at,
    };
  }
  return {
    studentId,
    targetExams: [],
    dailyItemLimit: DEFAULT_DAILY_ITEM_LIMIT,
    signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
    updatedAt: null,
  };
}

export async function updateStudentRevisionPreferences(studentId, { targetExams, dailyItemLimit, signalWeights } = {}) {
  const validExamSet = new Set(SUPPORTED_EXAM_CODES);
  const cleanExams = Array.isArray(targetExams)
    ? [...new Set(targetExams.map((e) => String(e).trim()).filter((e) => validExamSet.has(e)))]
    : [];
  const cleanLimit = normalizeDailyLimit(dailyItemLimit);

  const cleanWeights = { ...DEFAULT_SIGNAL_WEIGHTS };
  if (signalWeights && typeof signalWeights === "object") {
    for (const key of Object.keys(DEFAULT_SIGNAL_WEIGHTS)) {
      if (signalWeights[key] !== undefined) {
        const val = Number(signalWeights[key]);
        if (Number.isFinite(val) && val >= 0 && val <= 100) {
          cleanWeights[key] = Math.round(val);
        }
      }
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO student_revision_preferences (student_id, target_exams, daily_item_limit, signal_weights, updated_at)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, NOW())
     ON CONFLICT (student_id) DO UPDATE SET
       target_exams = EXCLUDED.target_exams,
       daily_item_limit = EXCLUDED.daily_item_limit,
       signal_weights = EXCLUDED.signal_weights,
       updated_at = NOW()
     RETURNING student_id, target_exams, daily_item_limit, signal_weights, updated_at`,
    [studentId, JSON.stringify(cleanExams), cleanLimit, JSON.stringify(cleanWeights)],
  );

  return {
    studentId,
    targetExams: rows[0].target_exams || [],
    dailyItemLimit: rows[0].daily_item_limit,
    signalWeights: rows[0].signal_weights || DEFAULT_SIGNAL_WEIGHTS,
    updatedAt: rows[0].updated_at,
  };
}

/**
 * Recompute weak topics from actual answered practice & mock questions.
 * Unanswered questions (selected_answer IS NULL) are strictly excluded.
 */
export async function refreshStudentWeakTopics(studentId) {
  const { rows } = await pool.query(
    `WITH combined AS (
       SELECT
         COALESCE(NULLIF(TRIM(q.topic_name), ''), t.name, 'General') AS topic_name,
         CASE WHEN pa.is_correct THEN 0 ELSE 1 END AS is_incorrect,
         COALESCE(pa.time_spent_seconds, 0) AS time_spent_seconds
       FROM practice_answers pa
       JOIN practice_sessions ps ON ps.id = pa.session_id
       JOIN questions q ON q.id = pa.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE ps.student_id = $1
         AND pa.selected_answer IS NOT NULL
       UNION ALL
       SELECT
         COALESCE(NULLIF(TRIM(q.topic_name), ''), t.name, 'General') AS topic_name,
         CASE WHEN sa.selected_answer = q.correct_answer THEN 0 ELSE 1 END AS is_incorrect,
         COALESCE(sa.time_spent_seconds, 0) AS time_spent_seconds
       FROM student_answers sa
       JOIN test_attempts ta ON ta.id = sa.attempt_id
       JOIN questions q ON q.id = sa.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE ta.student_id = $1
         AND sa.selected_answer IS NOT NULL
     )
     SELECT
       topic_name,
       COUNT(*)::int AS attempts_count,
       SUM(is_incorrect)::int AS incorrect_count,
       ROUND(AVG(time_spent_seconds))::int AS avg_response_seconds
     FROM combined
     GROUP BY topic_name`,
    [studentId],
  );

  const weakTopics = analyzeWeakTopics(rows);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM student_weak_topics WHERE student_id = $1", [studentId]);
    for (const wt of weakTopics) {
      await client.query(
        `INSERT INTO student_weak_topics
           (student_id, topic_name, attempts_count, incorrect_count, accuracy_percent, avg_response_seconds, explanation, detected_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          studentId,
          wt.topicName,
          wt.attemptsCount,
          wt.incorrectCount,
          wt.accuracyPercent,
          wt.avgResponseSeconds,
          wt.explanation,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return weakTopics;
}

/**
 * Gather live signals and refresh student_revision_items + daily revision plan.
 */
export async function syncAndBuildDailyRevision(studentId, { forceRefresh = false } = {}) {
  const now = new Date();
  const planDate = todayIsoDate(now);
  const prefs = await getStudentRevisionPreferences(studentId);
  const weakTopics = await refreshStudentWeakTopics(studentId);
  const weakTopicSet = new Set(weakTopics.map((w) => w.topicName.toLowerCase()));

  const candidates = [];

  // 1. Overdue & difficult flashcards from Phase 7 progress + bookmarks
  const fcRes = await pool.query(
    `SELECT
       f.id::text AS content_id,
       f.front_text AS title,
       f.category,
       f.topic,
       f.study_priority,
       p.last_response,
       p.next_review_at,
       p.current_interval_days,
       p.successful_reviews,
       p.missed_reviews,
       (fb.id IS NOT NULL) AS is_bookmarked
     FROM current_affairs_flashcards f
     LEFT JOIN current_affairs_flashcard_progress p
       ON p.flashcard_id = f.id AND p.student_id = $1
     LEFT JOIN current_affairs_flashcard_bookmarks fb
       ON fb.flashcard_id = f.id AND fb.student_id = $1
     WHERE f.publication_status = 'published'
       AND f.verification_status = 'approved'
       AND (
         (p.next_review_at IS NOT NULL AND p.next_review_at <= NOW())
         OR p.last_response IN ('again', 'hard')
         OR fb.id IS NOT NULL
       )
     LIMIT 60`,
    [studentId],
  );
  for (const r of fcRes.rows) {
    const isOverdue = Boolean(r.next_review_at && new Date(r.next_review_at) <= now);
    const isDifficult = r.last_response === "again" || r.last_response === "hard";
    const signals = {
      overdueFlashcard: isOverdue,
      difficultFlashcard: isDifficult,
      bookmarked: Boolean(r.is_bookmarked),
      highPriorityBanking: r.study_priority === "must_study",
      lowTopicAccuracy: Boolean(r.topic && weakTopicSet.has(r.topic.toLowerCase())),
    };
    const scored = calculateRevisionPriority(signals, prefs.signalWeights);
    candidates.push({
      contentType: "flashcard",
      contentId: r.content_id,
      title: String(r.title || "Flashcard").slice(0, 140),
      category: r.category,
      topic: r.topic,
      ...scored,
      recommendationReason: scored.reason,
      dueAt: r.next_review_at || now.toISOString(),
      estimatedMinutes: 1,
    });
  }

  // 2. Bookmarked current affairs articles
  const artRes = await pool.query(
    `SELECT
       ca.id::text AS content_id,
       ca.title,
       c.name AS category,
       r.updated_at
     FROM current_affairs_reads r
     JOIN current_affairs ca ON ca.id = r.affair_id
     LEFT JOIN current_affairs_categories c ON c.id = ca.category_id
     WHERE r.student_id = $1
       AND r.is_bookmarked = true
       AND ca.status = 'published'
     ORDER BY r.updated_at DESC
     LIMIT 30`,
    [studentId],
  );
  for (const r of artRes.rows) {
    const signals = {
      bookmarked: true,
      lowTopicAccuracy: Boolean(r.category && weakTopicSet.has(r.category.toLowerCase())),
    };
    const scored = calculateRevisionPriority(signals, prefs.signalWeights);
    candidates.push({
      contentType: "article",
      contentId: r.content_id,
      title: r.title,
      category: r.category,
      topic: r.category,
      ...scored,
      recommendationReason: scored.reason,
      dueAt: now.toISOString(),
      estimatedMinutes: 4,
    });
  }

  // 3. Repeatedly incorrect or bookmarked MCQs
  const mcqRes = await pool.query(
    `WITH wrong_q AS (
       SELECT
         pa.question_id,
         COUNT(*) FILTER (WHERE pa.selected_answer IS NOT NULL AND pa.is_correct = false)::int AS wrong_cnt,
         AVG(pa.time_spent_seconds) FILTER (WHERE pa.selected_answer IS NOT NULL) AS avg_sec
       FROM practice_answers pa
       JOIN practice_sessions ps ON ps.id = pa.session_id
       WHERE ps.student_id = $1
       GROUP BY pa.question_id
     )
     SELECT
       q.id::text AS content_id,
       LEFT(q.question_text, 160) AS title,
       COALESCE(NULLIF(TRIM(q.topic_name), ''), t.name, 'General') AS topic,
       COALESCE(w.wrong_cnt, 0) AS wrong_cnt,
       COALESCE(w.avg_sec, 0) AS avg_sec,
       (b.question_id IS NOT NULL) AS is_bookmarked
     FROM questions q
     LEFT JOIN topics t ON t.id = q.topic_id
     LEFT JOIN wrong_q w ON w.question_id = q.id
     LEFT JOIN bookmarks b ON b.question_id = q.id AND b.student_id = $1
     WHERE q.status = 'active'
       AND (COALESCE(w.wrong_cnt, 0) >= 1 OR b.question_id IS NOT NULL)
     ORDER BY COALESCE(w.wrong_cnt, 0) DESC, b.created_at DESC NULLS LAST
     LIMIT 40`,
    [studentId],
  );
  for (const r of mcqRes.rows) {
    const signals = {
      repeatedIncorrect: Number(r.wrong_cnt) >= 1,
      bookmarked: Boolean(r.is_bookmarked),
      lowTopicAccuracy: Boolean(r.topic && weakTopicSet.has(r.topic.toLowerCase())),
      slowResponse: Number(r.avg_sec) >= 75,
    };
    const scored = calculateRevisionPriority(signals, prefs.signalWeights);
    candidates.push({
      contentType: "mcq",
      contentId: r.content_id,
      title: r.title,
      category: r.topic,
      topic: r.topic,
      ...scored,
      recommendationReason: scored.reason,
      dueAt: now.toISOString(),
      estimatedMinutes: 2,
    });
  }

  // 4. High-priority published One-Liners matching weak topics or must_study
  const olRes = await pool.query(
    `SELECT
       id::text AS content_id,
       LEFT(fact_text, 160) AS title,
       category_name AS category,
       topic,
       study_priority
     FROM current_affairs_one_liners
     WHERE publication_status = 'published'
       AND verification_status = 'approved'
       AND study_priority = 'must_study'
     ORDER BY important_date DESC NULLS LAST, created_at DESC
     LIMIT 20`,
  );
  for (const r of olRes.rows) {
    const signals = {
      highPriorityBanking: true,
      lowTopicAccuracy: Boolean(r.topic && weakTopicSet.has(r.topic.toLowerCase())),
    };
    const scored = calculateRevisionPriority(signals, prefs.signalWeights);
    candidates.push({
      contentType: "one_liner",
      contentId: r.content_id,
      title: r.title,
      category: r.category,
      topic: r.topic,
      ...scored,
      recommendationReason: scored.reason,
      dueAt: now.toISOString(),
      estimatedMinutes: 1,
    });
  }

  // 5. Upsert discovered candidates into student_revision_items (preserving existing stage/due_at if already tracked)
  for (const c of candidates) {
    await pool.query(
      `INSERT INTO student_revision_items
         (student_id, content_type, content_id, title, category, topic, priority_level, priority_score, recommendation_reason, estimated_minutes, due_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (student_id, content_type, content_id) DO UPDATE SET
         title = EXCLUDED.title,
         priority_level = EXCLUDED.priority_level,
         priority_score = EXCLUDED.priority_score,
         recommendation_reason = EXCLUDED.recommendation_reason,
         updated_at = NOW()`,
      [
        studentId,
        c.contentType,
        c.contentId,
        c.title,
        c.category || null,
        c.topic || null,
        c.priorityLevel,
        c.priorityScore,
        c.recommendationReason,
        c.estimatedMinutes || estimateMinutesForContentType(c.contentType),
        c.dueAt,
      ],
    );
  }

  // 6. Load active due or pending items from student_revision_items
  const itemsRes = await pool.query(
    `SELECT *
     FROM student_revision_items
     WHERE student_id = $1
       AND revision_state != 'mastered'
       AND (due_at IS NULL OR due_at <= NOW() + INTERVAL '1 day')
     ORDER BY priority_score DESC, due_at ASC NULLS FIRST
     LIMIT 100`,
    [studentId],
  );

  const normalizedItems = itemsRes.rows.map((row) => ({
    id: row.id,
    contentType: row.content_type,
    contentId: row.content_id,
    title: row.title,
    category: row.category,
    topic: row.topic,
    priorityScore: row.priority_score,
    priorityLevel: row.priority_level,
    recommendationReason: row.recommendation_reason,
    revisionState: row.revision_state,
    revisionStage: row.revision_stage,
    estimatedMinutes: row.estimated_minutes,
    dueAt: row.due_at ? new Date(row.due_at).toISOString() : now.toISOString(),
  }));

  const plan = buildDailyRevisionPlan({
    candidates: normalizedItems,
    dailyLimit: prefs.dailyItemLimit,
    customWeights: prefs.signalWeights,
    now,
  });

  // 7. Count how many items were reviewed today for consistency
  const doneTodayRes = await pool.query(
    `SELECT COUNT(DISTINCT revision_item_id)::int AS cnt
     FROM student_revision_history
     WHERE student_id = $1
       AND reviewed_at::date = $2::date`,
    [studentId, planDate],
  );
  const completedToday = doneTodayRes.rows[0]?.cnt || 0;

  await pool.query(
    `INSERT INTO student_daily_revision_plans
       (student_id, plan_date, items, total_items, completed_items, generated_at, updated_at)
     VALUES ($1, $2::date, $3::jsonb, $4, $5, NOW(), NOW())
     ON CONFLICT (student_id, plan_date) DO UPDATE SET
       items = EXCLUDED.items,
       total_items = EXCLUDED.total_items,
       completed_items = EXCLUDED.completed_items,
       updated_at = NOW()`,
    [studentId, planDate, JSON.stringify(plan.items), plan.totalItems, completedToday],
  );

  return {
    planDate,
    preferences: prefs,
    weakTopics,
    plan: {
      ...plan,
      completedToday,
    },
  };
}

/**
 * Record an explicit student revision review outcome on a revision item.
 * Never marks mastered merely because an item was opened.
 */
export async function recordRevisionReview(studentId, { itemId, outcome }) {
  const { rows } = await pool.query(
    `SELECT * FROM student_revision_items WHERE id = $1 AND student_id = $2`,
    [itemId, studentId],
  );
  if (rows.length === 0) {
    const err = new Error("Revision item not found.");
    err.status = 404;
    throw err;
  }

  const item = rows[0];
  let fcMeta = { successfulReviews: 0, missedReviews: 0, previousIntervalDays: item.interval_days || 0 };

  if (item.content_type === "flashcard") {
    const fcRes = await pool.query(
      `SELECT successful_reviews, missed_reviews, current_interval_days
       FROM current_affairs_flashcard_progress
       WHERE student_id = $1 AND flashcard_id::text = $2`,
      [studentId, item.content_id],
    );
    if (fcRes.rows.length > 0) {
      fcMeta = {
        successfulReviews: fcRes.rows[0].successful_reviews || 0,
        missedReviews: fcRes.rows[0].missed_reviews || 0,
        previousIntervalDays: fcRes.rows[0].current_interval_days || 0,
      };
    }
  }

  const scheduled = scheduleNextRevision({
    contentType: item.content_type,
    outcome,
    currentStage: item.revision_stage,
    previousIntervalDays: fcMeta.previousIntervalDays,
    successfulReviews: fcMeta.successfulReviews,
    missedReviews: fcMeta.missedReviews,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE student_revision_items
       SET revision_state = $3,
           revision_stage = $4,
           interval_days = $5,
           last_studied_at = NOW(),
           due_at = $6,
           updated_at = NOW()
       WHERE id = $1 AND student_id = $2
       RETURNING *`,
      [
        itemId,
        studentId,
        scheduled.revisionState,
        scheduled.nextStage,
        scheduled.nextIntervalDays,
        scheduled.nextDueAt,
      ],
    );

    await client.query(
      `INSERT INTO student_revision_history
         (student_id, revision_item_id, content_type, content_id, review_outcome, previous_due_at, next_due_at, review_interval_days, revision_stage, source_recommendation, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        studentId,
        itemId,
        item.content_type,
        item.content_id,
        String(outcome).toLowerCase(),
        item.due_at,
        scheduled.nextDueAt,
        scheduled.nextIntervalDays,
        scheduled.nextStage,
        item.recommendation_reason,
      ],
    );

    // Keep Phase 7 flashcard progress synchronized if this item is a flashcard
    if (item.content_type === "flashcard" && ["again", "hard", "good", "easy"].includes(String(outcome).toLowerCase())) {
      const isMiss = String(outcome).toLowerCase() === "again";
      await client.query(
        `INSERT INTO current_affairs_flashcard_progress
           (flashcard_id, student_id, last_response, successful_reviews, missed_reviews, current_interval_days, last_reviewed_at, next_review_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW(), $7)
         ON CONFLICT (flashcard_id, student_id) DO UPDATE SET
           last_response = EXCLUDED.last_response,
           successful_reviews = current_affairs_flashcard_progress.successful_reviews + $4,
           missed_reviews = current_affairs_flashcard_progress.missed_reviews + $5,
           current_interval_days = EXCLUDED.current_interval_days,
           last_reviewed_at = NOW(),
           next_review_at = EXCLUDED.next_review_at`,
        [
          item.content_id,
          studentId,
          String(outcome).toLowerCase(),
          isMiss ? 0 : 1,
          isMiss ? 1 : 0,
          scheduled.nextIntervalDays,
          scheduled.nextDueAt,
        ],
      );
    }

    await client.query("COMMIT");

    // Reuse existing study streak & milestones infrastructure (best-effort)
    try {
      await recordStudyDay(studentId);
      await syncMilestones(studentId);
    } catch {
      // Non-fatal if streak tables are absent in minimal test schemas
    }

    return {
      item: updated.rows[0],
      schedule: scheduled,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getStudentRevisionHistory(studentId, { limit = 30 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
  const { rows } = await pool.query(
    `SELECT h.*, i.title, i.category, i.topic
     FROM student_revision_history h
     LEFT JOIN student_revision_items i ON i.id = h.revision_item_id
     WHERE h.student_id = $1
     ORDER BY h.reviewed_at DESC
     LIMIT $2`,
    [studentId, safeLimit],
  );
  return rows;
}
