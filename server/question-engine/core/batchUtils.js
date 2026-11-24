// server/question-engine/core/batchUtils.js
import { pickRandom } from "./mathUtils.js";

/**
 * Normalizes difficulty strings (including exam tier keywords) to "Easy" | "Medium" | "Hard".
 */
export function normalizeDifficulty(raw = "Medium") {
  const s = String(raw || "Medium").toLowerCase();
  if (s.includes("easy") || s.includes("clerk")) return "Easy";
  if (s.includes("hard") || s.includes("mains") || s.includes("difficult")) return "Hard";
  return "Medium";
}

/**
 * Picks a template from a pool using category priority weights and a deterministic RNG.
 */
export function pickWeightedTemplate(pool, categoryWeights, rng, defaultWeight = 10) {
  const weighted = pool.map((tpl) => ({
    tpl,
    weight: categoryWeights[tpl.category] || defaultWeight,
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let r = rng.random() * total;
  for (const item of weighted) {
    r -= item.weight;
    if (r <= 0) return item.tpl;
  }
  return weighted[weighted.length - 1].tpl;
}

/**
 * Shared batch runner for Prelims/Mains map-based Quant generators
 * (Percentage, Profit & Loss, Ratio & Proportion, Time & Work).
 */
export function runPrelimsMainsBatch({
  topicLabel,
  prelimsMap,
  mainsMap,
  defaultPrelimsPool,
  defaultMainsPool,
  exam = "IBPS_PO_PRELIMS",
  level = "AUTO",
  allowedTypes = null,
  difficulty = "MEDIUM",
  count = 10,
}) {
  const resolvedDiff =
    !difficulty || difficulty === "AUTO"
      ? exam.includes("MAINS")
        ? "HARD"
        : "MEDIUM"
      : difficulty.toUpperCase();

  const resolvedLevel =
    level === "AUTO"
      ? resolvedDiff === "HARD" || exam.includes("MAINS")
        ? "MAINS"
        : "PRELIMS"
      : level.toUpperCase();

  const prelimsPool = allowedTypes || defaultPrelimsPool;
  const mainsPool = allowedTypes || defaultMainsPool;

  const questions = [];
  for (let i = 0; i < count; i++) {
    const useMains =
      resolvedLevel === "MAINS" || (resolvedLevel === "BOTH" && i % 2 === 1);
    const activeMap = useMains ? mainsMap : prelimsMap;
    const pool = useMains ? mainsPool : prelimsPool;
    const typeId = pickRandom(pool);

    const genFn = activeMap[typeId];
    if (!genFn) {
      throw new Error(
        `Unsupported ${topicLabel} type ${typeId} for level ${useMains ? "MAINS" : "PRELIMS"}`
      );
    }
    questions.push(genFn(exam, resolvedDiff));
  }

  return questions;
}

/**
 * Shared Engine A/B verified batch runner with weighted template selection,
 * independent validation gate, and normalized mathematical fingerprint deduplication.
 */
export function runVerifiedTemplateBatch({
  topic,
  allTemplates,
  categoryWeights,
  defaultWeight = 10,
  maxAttemptsMultiplier = 25,
  minAttempts = 100,
  createRng,
  validateQuestion,
  computeFingerprint,
  formatSolutionSteps = null,
  stringifyAnswer = false,
  emptyPoolReason = null,
  count = 10,
  difficulty = "Medium",
  exam = "IBPS PO Prelims",
  allowedCategories = null,
  templateId = null,
  seed = null,
  excludeFingerprints = [],
}) {
  const rng = createRng(
    seed !== null && seed !== undefined
      ? seed
      : Date.now() ^ Math.floor(Math.random() * 1e9)
  );
  const normDiff = normalizeDifficulty(difficulty);
  const seen = new Set(excludeFingerprints);
  const questions = [];
  const rejectedLogs = [];

  let pool = allTemplates;
  if (templateId) {
    pool = pool.filter((t) => t.id === templateId);
  } else if (Array.isArray(allowedCategories) && allowedCategories.length > 0) {
    pool = pool.filter((t) => allowedCategories.includes(t.category));
  }

  const diffPool = pool.filter((t) => t.difficulties.includes(normDiff));
  const activePool = diffPool.length > 0 ? diffPool : pool;

  if (activePool.length === 0) {
    return {
      questions: [],
      meta: { requested: count, generated: 0, attempts: 0, rejectedCount: 0, seed: rng.seed },
      rejectedLogs: [{ reason: emptyPoolReason || `No ${topic} templates matched criteria.` }],
    };
  }

  const maxAttempts = Math.max(count * maxAttemptsMultiplier, minAttempts);
  let attempts = 0;

  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    const tpl =
      activePool.length === 1
        ? activePool[0]
        : pickWeightedTemplate(activePool, categoryWeights, rng, defaultWeight);

    let raw;
    try {
      raw = tpl.fn(rng, normDiff);
    } catch (err) {
      rejectedLogs.push({ templateId: tpl.id, reason: `Generation error: ${err.message}` });
      continue;
    }

    const verdict = validateQuestion(raw);
    if (!verdict.passed) {
      rejectedLogs.push({ templateId: raw.templateId, reason: verdict.reason });
      continue;
    }

    const fingerprint = computeFingerprint(raw.mathModel, raw.templateId);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const solutionSteps = formatSolutionSteps
      ? formatSolutionSteps(raw)
      : [
          `Given: ${raw.solution.given_data.join("; ")}`,
          `Formula: ${raw.solution.formula}`,
          ...raw.solution.steps,
          `Final Answer: ${raw.solution.final_answer}`,
        ];
    if (raw.shortcut_method) {
      solutionSteps.push(`Exam Shortcut: ${raw.shortcut_method}`);
    }

    questions.push({
      topic,
      question_type: raw.question_type,
      sub_type: raw.sub_type,
      difficulty: raw.difficulty,
      exam_level: raw.exam_level,
      question: raw.question,
      options: raw.options,
      correct_answer: raw.correct_answer,
      correct_answer_value: raw.correct_answer_value,
      solution: raw.solution,
      shortcut_method: raw.shortcut_method,
      validation: verdict.validation,

      questionId: `${raw.templateId}_${fingerprint.slice(0, 8)}_${questions.length + 1}`,
      templateId: raw.templateId,
      subType: raw.templateId,
      fingerprint,
      exam,
      questionText: raw.question,
      optionsArray: raw.optionsArray,
      correctOptionIndex: raw.correctOptionIndex,
      answer: stringifyAnswer ? String(raw.correct_answer_value) : raw.correct_answer_value,
      solutionSteps,
      generationMode: "RULE_ENGINE",
    });
  }

  return {
    questions,
    meta: {
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      seed: rng.seed,
      difficulty: normDiff,
    },
    rejectedLogs,
  };
}
