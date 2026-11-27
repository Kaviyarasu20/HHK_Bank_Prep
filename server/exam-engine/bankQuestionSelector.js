/**
 * Research-Based Question Bank Selector & Shortage Analyzer for Exam-Wise Mock Tests
 *
 * Strictly selects non-repeating published questions from the existing Question Bank
 * according to the exam's topic-wise distribution rules (never substituting unrelated topics).
 * Emits transparent, itemized per-topic shortage warnings whenever Question Bank stock is short.
 */

import { arrangeSectionQuestionsGrouped } from "./questionSequencer.js";

function normKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Pure helper: computes per-section and per-topic availability & shortage warnings
 * given a resolved exam pattern and a map of Question Bank counts.
 *
 * @param {object} pattern - Resolved exam pattern with sections[].topicDistributions[]
 * @param {Map<string, Map<string, number>>} bankCountMap - sectionId -> (normalizedTopic -> count)
 */
export function computePatternBankAvailability(pattern, bankCountMap = new Map()) {
  const shortageWarnings = [];
  let totalRequired = 0;
  let totalAvailableForPattern = 0;

  const sections = (pattern?.sections || []).map((sec) => {
    const secId = sec.sectionId || sec.sectionName;
    const topicMap = bankCountMap.get(secId) || new Map();
    const isSectionEnabled = sec.isEnabled !== false;
    const sectionRequired = isSectionEnabled ? Number(sec.questionCount || 0) : 0;

    let sectionTopicSum = 0;
    let sectionAvailableMatched = 0;

    const topics = (sec.topicDistributions || []).map((t) => {
      const enabled = t.enabled !== false && isSectionEnabled;
      const required = enabled ? Math.max(0, Number(t.defaultQuestions ?? t.minQuestions ?? 0)) : 0;
      const available = Number(topicMap.get(normKey(t.topic)) || 0);
      const shortfall = enabled ? Math.max(0, required - available) : 0;

      if (enabled) {
        sectionTopicSum += required;
        sectionAvailableMatched += Math.min(required, available);
      }

      if (shortfall > 0) {
        shortageWarnings.push({
          sectionId: sec.sectionId || null,
          sectionName: sec.sectionName,
          topic: t.topic,
          required,
          available,
          shortfall,
          message: `${sec.sectionName} → ${t.topic}: requires ${required}, only ${available} published in Question Bank (short by ${shortfall}).`,
        });
      }

      return {
        ...t,
        enabled: t.enabled !== false,
        defaultQuestions: Number(t.defaultQuestions ?? t.minQuestions ?? 0),
        availableInBank: available,
        shortfall,
        status: !enabled ? "DISABLED" : shortfall > 0 ? "SHORTAGE" : "OK",
      };
    });

    if (isSectionEnabled) {
      totalRequired += sectionRequired;
      totalAvailableForPattern += sectionAvailableMatched;
    }

    const totalPublishedInSection = Array.from(topicMap.values()).reduce((a, b) => a + b, 0);

    return {
      ...sec,
      isEnabled: isSectionEnabled,
      questionCount: Number(sec.questionCount || 0),
      topicSum: sectionTopicSum,
      topicSumMatchesSection: !isSectionEnabled || sectionTopicSum === sectionRequired,
      totalPublishedInSection,
      availableMatchedForPattern: sectionAvailableMatched,
      topicDistributions: topics,
    };
  });

  return {
    sections,
    totalRequired,
    totalAvailableForPattern,
    hasShortages: shortageWarnings.length > 0,
    shortageWarnings,
  };
}

/**
 * Queries PostgreSQL for live published Question Bank counts grouped by (section_id, topic_name)
 * and enriches the resolved exam pattern with availability & shortage metadata.
 */
export async function inspectPatternBankAvailability(pool, pattern) {
  const sectionIds = (pattern?.sections || [])
    .map((s) => s.sectionId)
    .filter(Boolean);

  const bankCountMap = new Map();
  if (sectionIds.length > 0 && pool && typeof pool.query === "function") {
    const res = await pool.query(
      `SELECT section_id, LOWER(TRIM(topic_name)) AS topic_key, COUNT(*)::int AS cnt
       FROM questions
       WHERE section_id = ANY($1::uuid[])
         AND status = 'published'
       GROUP BY section_id, LOWER(TRIM(topic_name))`,
      [sectionIds]
    );
    for (const row of res.rows || []) {
      if (!bankCountMap.has(row.section_id)) {
        bankCountMap.set(row.section_id, new Map());
      }
      bankCountMap.get(row.section_id).set(normKey(row.topic_key), Number(row.cnt || 0));
    }
  }

  return computePatternBankAvailability(pattern, bankCountMap);
}

/**
 * Selects non-repeating published questions strictly matching each enabled topic's
 * configured question count and section difficulty mix from the existing Question Bank.
 *
 * NEVER silently substitutes unrelated topics. Returns structured shortage warnings
 * if any enabled topic lacks sufficient published questions.
 */
export async function selectExamWiseQuestionsFromBank(
  client,
  { pattern, preferExcludeIds = [], shuffleWithinSection = true }
) {
  const usedIds = new Set();
  const preferIds = Array.from(new Set(preferExcludeIds || []));
  const pickedQuestions = [];
  const shortageWarnings = [];
  const sectionReports = [];

  for (const sec of pattern.sections || []) {
    if (sec.isEnabled === false) continue;
    const sectionId = sec.sectionId;
    const enabledTopics = (sec.topicDistributions || []).filter(
      (t) => t.enabled !== false && Number(t.defaultQuestions || 0) > 0
    );
    const diffMix = sec.difficultyDistribution || { easy: 30, medium: 50, hard: 20 };
    const sectionPicked = [];
    const topicBreakdown = [];

    for (const t of enabledTopics) {
      const targetCount = Number(t.defaultQuestions || 0);
      if (targetCount <= 0) continue;

      if (!sectionId) {
        shortageWarnings.push({
          sectionId: null,
          sectionName: sec.sectionName,
          topic: t.topic,
          required: targetCount,
          available: 0,
          shortfall: targetCount,
          message: `${sec.sectionName} → ${t.topic}: section is not mapped to an exam_sections record.`,
        });
        topicBreakdown.push({ topic: t.topic, required: targetCount, selected: 0, shortfall: targetCount });
        continue;
      }

      // Compute difficulty targets for this topic (largest-remainder allocation)
      const diffEntries = [
        ["easy", Number(diffMix.easy ?? 30)],
        ["medium", Number(diffMix.medium ?? 50)],
        ["hard", Number(diffMix.hard ?? 20)],
      ];
      const diffTotal = diffEntries.reduce((s, [, p]) => s + p, 0) || 100;
      const diffPlan = diffEntries.map(([diff, pct]) => {
        const exact = (targetCount * pct) / diffTotal;
        return { diff, count: Math.floor(exact), rem: exact - Math.floor(exact) };
      });
      let rem = targetCount - diffPlan.reduce((s, d) => s + d.count, 0);
      for (const d of [...diffPlan].sort((a, b) => b.rem - a.rem)) {
        if (rem > 0) {
          d.count += 1;
          rem -= 1;
        }
      }

      const topicPicked = [];

      // Pass 1: Match exact topic + exact difficulty
      for (const dp of diffPlan) {
        if (dp.count <= 0) continue;
        const res = await client.query(
          `SELECT id, section_id, topic_name, subtopic_name, difficulty, question_text, passage_group_id
           FROM questions
           WHERE section_id = $1
             AND status = 'published'
             AND LOWER(TRIM(topic_name)) = LOWER(TRIM($2))
             AND LOWER(difficulty) = $3
             AND NOT (id = ANY($4::uuid[]))
           ORDER BY
             CASE WHEN NOT (id = ANY($5::uuid[])) THEN 0 ELSE 1 END,
             random()
           LIMIT $6`,
          [sectionId, t.topic, dp.diff, Array.from(usedIds), preferIds, dp.count]
        );
        for (const row of res.rows) {
          usedIds.add(row.id);
          topicPicked.push(row);
        }
      }

      // Pass 2: Same exact topic, any difficulty (never switches to unrelated topics!)
      const sameTopicShortfall = targetCount - topicPicked.length;
      if (sameTopicShortfall > 0) {
        const res = await client.query(
          `SELECT id, section_id, topic_name, subtopic_name, difficulty, question_text, passage_group_id
           FROM questions
           WHERE section_id = $1
             AND status = 'published'
             AND LOWER(TRIM(topic_name)) = LOWER(TRIM($2))
             AND NOT (id = ANY($3::uuid[]))
           ORDER BY
             CASE WHEN NOT (id = ANY($4::uuid[])) THEN 0 ELSE 1 END,
             random()
           LIMIT $5`,
          [sectionId, t.topic, Array.from(usedIds), preferIds, sameTopicShortfall]
        );
        for (const row of res.rows) {
          usedIds.add(row.id);
          topicPicked.push(row);
        }
      }

      const finalShortfall = targetCount - topicPicked.length;
      if (finalShortfall > 0) {
        shortageWarnings.push({
          sectionId,
          sectionName: sec.sectionName,
          topic: t.topic,
          required: targetCount,
          available: topicPicked.length,
          shortfall: finalShortfall,
          message: `${sec.sectionName} → ${t.topic}: requires ${targetCount}, only ${topicPicked.length} published in Question Bank (short by ${finalShortfall}).`,
        });
      }

      topicBreakdown.push({
        topic: t.topic,
        required: targetCount,
        selected: topicPicked.length,
        shortfall: finalShortfall,
      });
      sectionPicked.push(...topicPicked);
    }

    const orderedSection = arrangeSectionQuestionsGrouped(sectionPicked, Math.random, { shuffleBlocks: shuffleWithinSection });
    pickedQuestions.push(...orderedSection);

    sectionReports.push({
      sectionId,
      sectionName: sec.sectionName,
      required: Number(sec.questionCount || 0),
      selected: orderedSection.length,
      topicBreakdown,
    });
  }

  return {
    ok: shortageWarnings.length === 0,
    pickedQuestions,
    totalSelected: pickedQuestions.length,
    totalRequired: (pattern.sections || [])
      .filter((s) => s.isEnabled !== false)
      .reduce((sum, s) => sum + Number(s.questionCount || 0), 0),
    shortageWarnings,
    sectionReports,
  };
}
