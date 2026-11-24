/**
 * GA Marathon Approved Question Selection & Quality Control Service.
 * - Selects strictly APPROVED Phase 6 MCQs synced to canonical `questions`
 *   (review_status = 'approved', canonical status = 'published').
 * - Enforces duplicate prevention, topic/difficulty distribution, and
 *   non-repetition of recently used questions where alternatives exist.
 * - Returns actionable shortage errors rather than silently generating incomplete tests.
 */

export function isQuestionEligibleForGaTest(q) {
  if (!q) return { eligible: false, reason: "Missing question record." };
  if (q.review_status && q.review_status !== "approved") {
    return { eligible: false, reason: `Question review_status is "${q.review_status}", not approved.` };
  }
  if (q.status && q.status !== "published") {
    return { eligible: false, reason: `Canonical question status is "${q.status}", not published.` };
  }
  if (q.duplicate_status && q.duplicate_status !== "unique") {
    return { eligible: false, reason: `Question flagged as "${q.duplicate_status}".` };
  }
  if (q.validation_status && q.validation_status === "failed") {
    return { eligible: false, reason: "Question failed validation." };
  }
  if (!q.canonical_question_id && !q.question_id && !q.id) {
    return { eligible: false, reason: "Question is not linked to canonical questions table." };
  }
  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length < 4) {
    return { eligible: false, reason: "Question has fewer than 4 options." };
  }
  if (!q.correct_answer || !String(q.correct_answer).trim()) {
    return { eligible: false, reason: "Question is missing correct_answer." };
  }
  return { eligible: true, reason: null };
}

/**
 * Pure deterministic selector over an already-filtered pool of eligible questions.
 */
export function selectQuestionsForGaTest({
  pool = [],
  targetCount,
  topicDistribution = {},
  difficultyDistribution = {},
  recentlyUsedIds = new Set(),
} = {}) {
  const count = Number(targetCount);
  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, selected: [], errors: ["Target question count must be >= 1."], warnings: [] };
  }

  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const eligible = [];

  for (const q of pool) {
    const check = isQuestionEligibleForGaTest(q);
    if (!check.eligible) continue;
    const qid = String(q.canonical_question_id || q.question_id || q.id);
    if (seenIds.has(qid)) continue;
    seenIds.add(qid);
    eligible.push({ ...q, _qid: qid, _recentlyUsed: recentlyUsedIds.has(qid) });
  }

  if (eligible.length < count) {
    return {
      ok: false,
      selected: [],
      errors: [
        `Insufficient approved questions: requested ${count}, but only ${eligible.length} eligible approved question(s) match the selected filters.`,
      ],
      warnings,
    };
  }

  // Prefer fresh (not recently used) questions first, then deterministic tie-break
  eligible.sort((a, b) => {
    if (a._recentlyUsed !== b._recentlyUsed) return a._recentlyUsed ? 1 : -1;
    return a._qid.localeCompare(b._qid);
  });

  const chosen = [];
  const chosenIds = new Set();

  const pickMatching = (predicate, needed, label) => {
    let picked = 0;
    for (const q of eligible) {
      if (picked >= needed) break;
      if (chosenIds.has(q._qid)) continue;
      if (predicate(q)) {
        chosen.push(q);
        chosenIds.add(q._qid);
        picked += 1;
      }
    }
    if (picked < needed) {
      errors.push(`Cannot satisfy distribution for "${label}": needed ${needed}, found only ${picked}.`);
    }
  };

  // Apply explicit topic distribution if provided
  for (const [topic, neededRaw] of Object.entries(topicDistribution || {})) {
    const needed = Number(neededRaw);
    if (!Number.isInteger(needed) || needed <= 0) continue;
    const norm = topic.trim().toLowerCase();
    pickMatching(
      (q) => String(q.topic || q.topic_name || "").trim().toLowerCase() === norm,
      needed,
      `topic:${topic}`,
    );
  }

  // Apply explicit difficulty distribution if provided (only when topicDistribution didn't already fill)
  for (const [diff, neededRaw] of Object.entries(difficultyDistribution || {})) {
    const needed = Number(neededRaw);
    if (!Number.isInteger(needed) || needed <= 0) continue;
    const norm = diff.trim().toLowerCase();
    const alreadyOfDiff = chosen.filter(
      (q) => String(q.difficulty || "").trim().toLowerCase() === norm,
    ).length;
    const remainingNeeded = Math.max(0, needed - alreadyOfDiff);
    if (remainingNeeded > 0) {
      pickMatching(
        (q) => String(q.difficulty || "").trim().toLowerCase() === norm,
        remainingNeeded,
        `difficulty:${diff}`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, selected: [], errors, warnings };
  }

  // Fill any remaining slots up to targetCount from remaining eligible pool
  for (const q of eligible) {
    if (chosen.length >= count) break;
    if (chosenIds.has(q._qid)) continue;
    chosen.push(q);
    chosenIds.add(q._qid);
  }

  if (chosen.length > count) {
    return {
      ok: false,
      selected: [],
      errors: [
        `Configured topic/difficulty distributions sum to ${chosen.length}, which exceeds targetCount (${count}).`,
      ],
      warnings,
    };
  }

  const repeatedCount = chosen.filter((q) => q._recentlyUsed).length;
  if (repeatedCount > 0) {
    warnings.push(`${repeatedCount} question(s) were also used in recent GA Marathon tests due to pool size.`);
  }

  return { ok: true, selected: chosen, errors: [], warnings };
}

/**
 * Query approved Phase 6 MCQs synced to canonical `questions` table using filters.
 */
export async function queryEligibleGaQuestions(filters = {}, dbPool) {
  const pool = dbPool || (await import("../db.js")).pool;
  const params = [];
  const where = [
    "gq.review_status = 'approved'",
    "gq.canonical_question_id IS NOT NULL",
    "gq.duplicate_status = 'unique'",
    "gq.validation_status <> 'failed'",
    "q.status = 'published'",
  ];

  if (filters.examCode) {
    params.push(String(filters.examCode).trim());
    where.push(`gq.exam_codes @> to_jsonb(ARRAY[$${params.length}]::text[])`);
  }
  if (filters.topic) {
    params.push(String(filters.topic).trim());
    where.push(`LOWER(COALESCE(gq.topic, q.topic_name, '')) = LOWER($${params.length})`);
  }
  if (filters.difficulty) {
    params.push(String(filters.difficulty).trim());
    where.push(`LOWER(COALESCE(gq.difficulty, q.difficulty, '')) = LOWER($${params.length})`);
  }
  if (filters.questionType) {
    params.push(String(filters.questionType).trim());
    where.push(`gq.question_type = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    where.push(`gq.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    where.push(`gq.created_at <= $${params.length}::timestamptz`);
  }
  if (filters.capsuleId) {
    params.push(filters.capsuleId);
    where.push(`EXISTS (
      SELECT 1 FROM monthly_capsule_content_links mcl
      WHERE mcl.capsule_id = $${params.length}
        AND (
          (mcl.content_type = 'mcq' AND mcl.content_id = gq.id::text)
          OR (mcl.content_type = 'article' AND mcl.content_id = gq.source_article_id::text)
        )
    )`);
  }

  const { rows } = await pool.query(
    `SELECT
       gq.id AS generated_question_id,
       gq.canonical_question_id,
       gq.source_article_id,
       gq.source_reference_type,
       gq.source_reference_id,
       gq.topic,
       gq.subtopic,
       gq.difficulty,
       gq.exam_codes,
       gq.review_status,
       gq.duplicate_status,
       gq.validation_status,
       q.id AS question_id,
       q.section_id,
       q.question_text,
       q.options,
       q.correct_answer,
       q.explanation,
       q.status
     FROM current_affairs_generated_questions gq
     JOIN questions q ON q.id = gq.canonical_question_id
     WHERE ${where.join(" AND ")}
     ORDER BY gq.created_at DESC
     LIMIT 500`,
    params,
  );
  return rows;
}
