import { validateGaTestConfig } from "./gaTestConfigurationService.js";
import { queryEligibleGaQuestions, selectQuestionsForGaTest } from "./gaQuestionSelectionService.js";
import { buildGaResultAnalysis } from "./gaResultAnalysisService.js";
import { getStudentGaPerformance, rankRecommendedGaTests } from "./gaPerformanceService.js";

/**
 * GA Marathon Orchestrator Service (Admin & Student).
 * - Creates & manages GA Marathon tests as first-class rows in `mock_tests`
 *   (test_type = 'GA_MARATHON') paired with `ga_marathon_configs`,
 *   `mock_test_questions`, and `ga_marathon_question_links`.
 * - Reuses HHK's canonical `questions`, `test_attempts`, `student_answers`,
 *   and `student_subscriptions` / `student_test_entitlements` tables.
 */

export async function listStudentGaTests(studentId, { category, exam, status } = {}, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const params = [studentId];
  const where = [
    "t.test_type = 'GA_MARATHON'",
    "t.status = 'published'",
    "t.is_visible = TRUE",
  ];

  if (category) {
    params.push(String(category).trim());
    where.push(`gmc.ga_category = $${params.length}`);
  }
  if (exam) {
    params.push(String(exam).trim());
    where.push(`gmc.target_exams @> to_jsonb(ARRAY[$${params.length}]::text[])`);
  }

  const { rows } = await pool.query(
    `SELECT
       t.id, t.name, t.description, t.duration_seconds, t.status,
       t.target_questions, t.marks_per_question, t.negative_marks,
       t.access_type, t.price_paise, t.currency, t.is_purchasable,
       t.promotional_free_until, t.difficulty_label,
       t.availability_start, t.availability_end,
       gmc.ga_category, gmc.target_exams, gmc.is_official_pattern,
       gmc.capsule_id, gmc.attempt_limit, gmc.answer_release_policy,
       gmc.answer_release_at,
       mc.title AS capsule_title,
       (SELECT COUNT(*)::int FROM mock_test_questions mtq WHERE mtq.mock_test_id = t.id) AS question_count,
       (SELECT COUNT(*)::int FROM test_attempts ta WHERE ta.mock_test_id = t.id AND ta.student_id = $1) AS attempts_used,
       (SELECT ta.id FROM test_attempts ta WHERE ta.mock_test_id = t.id AND ta.student_id = $1 AND ta.status = 'in_progress' ORDER BY ta.started_at DESC LIMIT 1) AS active_attempt_id,
       (SELECT ta.id FROM test_attempts ta WHERE ta.mock_test_id = t.id AND ta.student_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.submitted_at DESC LIMIT 1) AS latest_completed_attempt_id,
       (SELECT ta.score FROM test_attempts ta WHERE ta.mock_test_id = t.id AND ta.student_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.submitted_at DESC LIMIT 1) AS latest_score,
       (
         t.access_type = 'FREE'
         OR (t.promotional_free_until IS NOT NULL AND t.promotional_free_until > NOW())
         OR EXISTS (
           SELECT 1 FROM student_test_entitlements ste
           WHERE ste.student_id = $1 AND ste.mock_test_id = t.id
             AND ste.status = 'ACTIVE'
             AND (ste.expires_at IS NULL OR ste.expires_at > NOW())
         )
         OR EXISTS (
           SELECT 1 FROM student_subscriptions ss
           JOIN subscription_plans sp ON sp.id = ss.plan_id
           WHERE ss.student_id = $1
             AND ss.status IN ('ACTIVE', 'CANCELLED')
             AND ss.expires_at > NOW()
             AND (
               sp.access_scope IN ('ALL_TESTS', 'LIMITED_COUNT')
               OR EXISTS (SELECT 1 FROM subscription_plan_tests spt WHERE spt.plan_id = sp.id AND spt.mock_test_id = t.id)
             )
         )
       ) AS has_access
     FROM mock_tests t
     JOIN ga_marathon_configs gmc ON gmc.mock_test_id = t.id
     LEFT JOIN monthly_capsules mc ON mc.id = gmc.capsule_id
     WHERE ${where.join(" AND ")}
     ORDER BY t.created_at DESC`,
    params,
  );

  const now = new Date();
  const annotated = rows.map((r) => {
    const isUpcoming = Boolean(r.availability_start && new Date(r.availability_start) > now);
    const isExpired = Boolean(r.availability_end && new Date(r.availability_end) < now);
    return {
      ...r,
      max_marks: Number(((r.question_count || r.target_questions || 0) * Number(r.marks_per_question || 1)).toFixed(2)),
      availability_state: isUpcoming ? "upcoming" : isExpired ? "closed" : "live",
    };
  });

  if (status === "upcoming") return annotated.filter((r) => r.availability_state === "upcoming");
  if (status === "completed") return annotated.filter((r) => Boolean(r.latest_completed_attempt_id));
  if (status === "in_progress") return annotated.filter((r) => Boolean(r.active_attempt_id));
  return annotated;
}

export async function getStudentGaDashboard(studentId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const [tests, performance, prefsRes, weakRes, historyRes] = await Promise.all([
    listStudentGaTests(studentId, {}, pool),
    getStudentGaPerformance(studentId, pool),
    pool.query(`SELECT target_exams FROM student_revision_preferences WHERE student_id = $1`, [studentId]),
    pool.query(`SELECT topic_name FROM student_weak_topics WHERE student_id = $1 ORDER BY accuracy_percent ASC LIMIT 10`, [studentId]),
    pool.query(
      `SELECT ta.id AS attempt_id, ta.mock_test_id, t.name AS test_name, gmc.ga_category,
              ta.status, ta.score, ta.max_score, ta.correct_count, ta.wrong_count,
              ta.unanswered_count, ta.elapsed_seconds, ta.started_at, ta.submitted_at
       FROM test_attempts ta
       JOIN mock_tests t ON t.id = ta.mock_test_id
       JOIN ga_marathon_configs gmc ON gmc.mock_test_id = t.id
       WHERE ta.student_id = $1 AND t.test_type = 'GA_MARATHON'
       ORDER BY ta.started_at DESC
       LIMIT 20`,
      [studentId],
    ),
  ]);

  const targetExams = Array.isArray(prefsRes.rows[0]?.target_exams) ? prefsRes.rows[0].target_exams : [];
  const weakTopics = weakRes.rows.map((r) => r.topic_name);
  const attemptedIds = new Set(historyRes.rows.map((h) => h.mock_test_id));

  const recommended = rankRecommendedGaTests({
    tests: tests.filter((t) => t.availability_state === "live"),
    targetExams,
    weakTopics,
    attemptedTestIds: attemptedIds,
  });

  return {
    performance,
    tests,
    recommended,
    recentAttempts: historyRes.rows,
  };
}

export async function getStudentGaAttemptResult(studentId, attemptId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const attRes = await pool.query(
    `SELECT ta.*, t.name AS test_name, t.availability_end,
            gmc.ga_category, gmc.target_exams, gmc.capsule_id,
            gmc.answer_release_policy, gmc.answer_release_at,
            mc.title AS capsule_title
     FROM test_attempts ta
     JOIN mock_tests t ON t.id = ta.mock_test_id
     LEFT JOIN ga_marathon_configs gmc ON gmc.mock_test_id = t.id
     LEFT JOIN monthly_capsules mc ON mc.id = gmc.capsule_id
     WHERE ta.id = $1 AND ta.student_id = $2`,
    [attemptId, studentId],
  );
  if (attRes.rows.length === 0) return null;
  const attempt = attRes.rows[0];

  const ansRes = await pool.query(
    `SELECT sa.question_id, sa.question_snapshot, sa.selected_answer, sa.time_spent_seconds,
            gl.ga_domain, gl.source_article_id, gl.source_reference_type, gl.source_reference_id,
            ca.title AS source_article_title
     FROM student_answers sa
     LEFT JOIN ga_marathon_question_links gl
       ON gl.mock_test_id = $2 AND gl.question_id = sa.question_id
     LEFT JOIN current_affairs ca ON ca.id = gl.source_article_id
     WHERE sa.attempt_id = $1`,
    [attemptId, attempt.mock_test_id],
  );

  const analysis = buildGaResultAnalysis({
    attempt,
    answers: ansRes.rows,
    releasePolicy: {
      policy: attempt.answer_release_policy || "immediate",
      answerReleaseAt: attempt.answer_release_at,
      availabilityEnd: attempt.availability_end,
    },
  });

  return {
    ...analysis,
    meta: {
      gaCategory: attempt.ga_category || null,
      targetExams: attempt.target_exams || [],
      capsuleId: attempt.capsule_id || null,
      capsuleTitle: attempt.capsule_title || null,
    },
  };
}

export async function createGaMarathonTest(input, adminUserId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const check = validateGaTestConfig(input);
  if (!check.ok) {
    const err = new Error(check.errors.join(" "));
    err.status = 400;
    err.details = check.errors;
    throw err;
  }
  const cfg = check.normalized;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reviewPolicy = cfg.answerReleasePolicy === "never" ? "never" : "after_submit";
    const testRes = await client.query(
      `INSERT INTO mock_tests
         (name, description, duration_seconds, review_policy, selection_mode,
          availability_start, availability_end, status, test_type,
          target_questions, marks_per_question, negative_marks,
          access_type, price_paise, currency, is_visible, is_purchasable,
          difficulty_label, created_by)
       VALUES
         ($1, $2, $3, $4, 'rule_based',
          $5, $6, 'draft', 'GA_MARATHON',
          $7, $8, $9,
          $10, $11, 'INR', TRUE, ($10 = 'PAID'),
          $12, $13)
       RETURNING *`,
      [
        cfg.title,
        cfg.description,
        cfg.durationSeconds,
        reviewPolicy,
        cfg.availabilityStart,
        cfg.availabilityEnd,
        cfg.questionCount,
        cfg.marksPerQuestion,
        cfg.negativeMarks,
        cfg.accessType,
        cfg.pricePaise,
        cfg.difficultyLabel,
        adminUserId || null,
      ],
    );
    const test = testRes.rows[0];

    await client.query(
      `INSERT INTO ga_marathon_configs
         (mock_test_id, ga_category, target_exams, is_official_pattern, capsule_id,
          attempt_limit, randomize_questions, randomize_options,
          answer_release_policy, answer_release_at,
          topic_distribution, difficulty_distribution, selection_filters)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb)`,
      [
        test.id,
        cfg.gaCategory,
        JSON.stringify(cfg.targetExams),
        cfg.isOfficialPattern,
        cfg.capsuleId,
        cfg.attemptLimit,
        cfg.randomizeQuestions,
        cfg.randomizeOptions,
        cfg.answerReleasePolicy,
        cfg.answerReleaseAt,
        JSON.stringify(cfg.topicDistribution),
        JSON.stringify(cfg.difficultyDistribution),
        JSON.stringify(cfg.selectionFilters),
      ],
    );

    await client.query("COMMIT");
    return getAdminGaTestDetail(test.id, pool);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function assignApprovedQuestionsToGaTest(testId, { filters = {}, manualQuestionIds = null } = {}, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const detail = await getAdminGaTestDetail(testId, pool);
  if (!detail) {
    const err = new Error("GA Marathon test not found.");
    err.status = 404;
    throw err;
  }

  // Prevent silently mutating question set of a published test that already has attempts
  const attCountRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM test_attempts WHERE mock_test_id = $1`, [testId]);
  if (detail.status === "published" && (attCountRes.rows[0]?.cnt || 0) > 0) {
    const err = new Error("Cannot replace questions on a published GA test that already has student attempts.");
    err.status = 409;
    throw err;
  }

  let eligiblePool = await queryEligibleGaQuestions(filters || detail.selection_filters || {}, pool);
  if (Array.isArray(manualQuestionIds) && manualQuestionIds.length > 0) {
    const idSet = new Set(manualQuestionIds.map((x) => String(x)));
    eligiblePool = eligiblePool.filter(
      (q) => idSet.has(String(q.canonical_question_id)) || idSet.has(String(q.generated_question_id)),
    );
  }

  const recentRes = await pool.query(
    `SELECT DISTINCT mtq.question_id::text AS qid
     FROM mock_test_questions mtq
     JOIN mock_tests mt ON mt.id = mtq.mock_test_id
     WHERE mt.test_type = 'GA_MARATHON' AND mt.id <> $1
     LIMIT 300`,
    [testId],
  );
  const recentlyUsedIds = new Set(recentRes.rows.map((r) => r.qid));

  const selection = selectQuestionsForGaTest({
    pool: eligiblePool,
    targetCount: detail.target_questions,
    topicDistribution: detail.topic_distribution,
    difficultyDistribution: detail.difficulty_distribution,
    recentlyUsedIds,
  });

  if (!selection.ok) {
    const err = new Error(selection.errors.join(" "));
    err.status = 422;
    err.validation = selection;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM mock_test_questions WHERE mock_test_id = $1`, [testId]);
    await client.query(`DELETE FROM ga_marathon_question_links WHERE mock_test_id = $1`, [testId]);

    for (let i = 0; i < selection.selected.length; i += 1) {
      const q = selection.selected[i];
      await client.query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, section_id, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [testId, q.canonical_question_id, q.section_id, i + 1],
      );
      const domain = q.source_reference_type ? "banking_awareness" : "current_affairs";
      await client.query(
        `INSERT INTO ga_marathon_question_links
           (mock_test_id, question_id, generated_question_id, source_article_id, source_reference_type, source_reference_id, ga_domain)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          testId,
          q.canonical_question_id,
          q.generated_question_id || null,
          q.source_article_id || null,
          q.source_reference_type || null,
          q.source_reference_id || null,
          domain,
        ],
      );
    }

    await client.query("COMMIT");
    return {
      test: await getAdminGaTestDetail(testId, pool),
      selectedCount: selection.selected.length,
      warnings: selection.warnings,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listAdminGaTests(dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const { rows } = await pool.query(
    `SELECT
       t.id, t.name, t.description, t.status, t.duration_seconds,
       t.target_questions, t.marks_per_question, t.negative_marks,
       t.access_type, t.price_paise, t.difficulty_label,
       t.availability_start, t.availability_end, t.created_at,
       gmc.ga_category, gmc.target_exams, gmc.is_official_pattern,
       gmc.capsule_id, gmc.attempt_limit, gmc.answer_release_policy,
       (SELECT COUNT(*)::int FROM mock_test_questions mtq WHERE mtq.mock_test_id = t.id) AS assigned_questions,
       (SELECT COUNT(*)::int FROM test_attempts ta WHERE ta.mock_test_id = t.id) AS attempts_count,
       COALESCE((SELECT ROUND(AVG(ta.score), 2) FROM test_attempts ta WHERE ta.mock_test_id = t.id AND ta.status IN ('submitted', 'auto_submitted')), 0)::numeric AS avg_score
     FROM mock_tests t
     JOIN ga_marathon_configs gmc ON gmc.mock_test_id = t.id
     WHERE t.test_type = 'GA_MARATHON'
     ORDER BY t.created_at DESC`,
  );
  return rows;
}

export async function getAdminGaTestDetail(testId, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const { rows } = await pool.query(
    `SELECT t.*, gmc.ga_category, gmc.target_exams, gmc.is_official_pattern,
            gmc.capsule_id, gmc.attempt_limit, gmc.randomize_questions, gmc.randomize_options,
            gmc.answer_release_policy, gmc.answer_release_at,
            gmc.topic_distribution, gmc.difficulty_distribution, gmc.selection_filters
     FROM mock_tests t
     JOIN ga_marathon_configs gmc ON gmc.mock_test_id = t.id
     WHERE t.id = $1 AND t.test_type = 'GA_MARATHON'`,
    [testId],
  );
  if (rows.length === 0) return null;

  const qRes = await pool.query(
    `SELECT mtq.sort_order, q.id AS question_id, q.question_text, q.difficulty, q.topic_name, q.status,
            gl.ga_domain, gl.source_article_id, gl.generated_question_id
     FROM mock_test_questions mtq
     JOIN questions q ON q.id = mtq.question_id
     LEFT JOIN ga_marathon_question_links gl ON gl.mock_test_id = mtq.mock_test_id AND gl.question_id = mtq.question_id
     WHERE mtq.mock_test_id = $1
     ORDER BY mtq.sort_order ASC`,
    [testId],
  );

  return {
    ...rows[0],
    assigned_questions: qRes.rows.length,
    questions: qRes.rows,
  };
}

export async function transitionGaTestStatus(testId, targetStatus, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  if (!["draft", "published", "archived"].includes(targetStatus)) {
    const err = new Error(`Unsupported status "${targetStatus}".`);
    err.status = 400;
    throw err;
  }
  const detail = await getAdminGaTestDetail(testId, pool);
  if (!detail) {
    const err = new Error("GA Marathon test not found.");
    err.status = 404;
    throw err;
  }

  if (targetStatus === "published") {
    if (detail.assigned_questions < detail.target_questions || detail.assigned_questions === 0) {
      const err = new Error(
        `Cannot publish GA test: assigned ${detail.assigned_questions} of ${detail.target_questions} required approved questions.`,
      );
      err.status = 422;
      throw err;
    }
    const unpublished = detail.questions.filter((q) => q.status !== "published");
    if (unpublished.length > 0) {
      const err = new Error(`Cannot publish GA test: ${unpublished.length} assigned question(s) are not published.`);
      err.status = 422;
      throw err;
    }
  }

  await pool.query(`UPDATE mock_tests SET status = $2 WHERE id = $1`, [testId, targetStatus]);
  return getAdminGaTestDetail(testId, pool);
}
