// Place at: server/question-engine/generators/quant/timeSpeedDistance/index.js
import { normalizeDifficulty, pickWeightedTemplate } from "../../../core/batchUtils.js";
import { createRng } from "./tsdMath.js";
import { computeTsdFingerprint, validateTsdQuestion } from "./tsdValidator.js";
import { TSD_TEMPLATES_PART_1 } from "./tsdTemplatesPart1.js";
import { TSD_TEMPLATES_PART_2 } from "./tsdTemplatesPart2.js";

export const ALL_TSD_TEMPLATES = [...TSD_TEMPLATES_PART_1, ...TSD_TEMPLATES_PART_2];

/**
 * Exam priority weights per category (High: A, B, C, D, E, G, H; Medium: F, I)
 */
export const CATEGORY_PRIORITY_WEIGHTS = {
  A: 14, // Basic SDT & Unit Conversion
  B: 14, // Average Speed
  C: 14, // Relative Speed
  D: 16, // Problems on Trains
  E: 14, // Boats & Streams
  F: 7,  // Circular Track
  G: 8,  // Races
  H: 8,  // Stoppage & Early/Late Arrival
  I: 5,  // Multi-Stage Journey
};

/**
 * Production-ready Time, Speed & Distance (and Boats & Streams) Question Generator.
 * Supports Engine A (Generator) + Engine B (Independent Verifier), seeded reproducibility,
 * mathematical fingerprint deduplication, and HHK platform output compatibility.
 */
export function generateTsdBatch({
  count = 10,
  difficulty = "Medium",
  exam = "IBPS PO Prelims",
  topicMode = "BOTH", // "TSD" (all except E or all), "BOATS" (Category E only), "BOTH" (all A-I)
  category = null,    // Optional filter: "A".."I" or array of categories
  templateId = null,  // Optional exact template ID filter
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createRng(seed !== null && seed !== undefined ? seed : Date.now() ^ Math.floor(Math.random() * 1e9));
  const normDiff = normalizeDifficulty(difficulty);
  const seen = new Set(excludeFingerprints);
  const questions = [];
  const rejectedLogs = [];

  let pool = ALL_TSD_TEMPLATES;
  if (templateId) {
    pool = pool.filter((t) => t.id === templateId);
  } else if (category) {
    const allowedCats = Array.isArray(category) ? category : [category];
    pool = pool.filter((t) => allowedCats.includes(t.category));
  } else if (String(topicMode).toUpperCase() === "BOATS") {
    pool = pool.filter((t) => t.category === "E");
  } else if (String(topicMode).toUpperCase() === "TSD_ONLY") {
    pool = pool.filter((t) => t.category !== "E");
  }

  // Prefer templates matching requested difficulty, with fallback to full pool if narrow filter
  const diffPool = pool.filter((t) => t.difficulties.includes(normDiff));
  const activePool = diffPool.length > 0 ? diffPool : pool;

  if (activePool.length === 0) {
    return { questions: [], rejectedLogs: [{ reason: "No matching TSD templates found." }] };
  }

  const maxAttempts = Math.max(count * 25, 100);
  let attempts = 0;

  while (questions.length < count && attempts < maxAttempts) {
    attempts++;
    const tpl = activePool.length === 1 ? activePool[0] : pickWeightedTemplate(activePool, CATEGORY_PRIORITY_WEIGHTS, rng, 5);

    let raw;
    try {
      raw = tpl.fn(rng, normDiff);
    } catch (err) {
      rejectedLogs.push({ templateId: tpl.id, reason: `Generation exception: ${err.message}` });
      continue;
    }

    // Engine B Independent Verification Gate
    const verdict = validateTsdQuestion(raw);
    if (!verdict.passed) {
      rejectedLogs.push({ templateId: raw.templateId, reason: verdict.reason });
      continue;
    }

    // Normalized Mathematical Fingerprint Deduplication
    const fingerprint = computeTsdFingerprint(raw.mathModel, raw.templateId);
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);

    const idxNum = questions.length + 1;
    const questionId = `TSD_${raw.templateId}_${fingerprint.slice(0, 8)}_${idxNum}`;
    const solutionSteps = [
      `Given: ${raw.solution.given_data}`,
      `Formula: ${raw.solution.formula}`,
      ...raw.solution.steps,
      `Final Answer: ${raw.solution.final_answer}`,
    ];
    if (raw.shortcut_method) {
      solutionSteps.push(`Exam Shortcut: ${raw.shortcut_method}`);
    }

    questions.push({
      // Master Spec Section 10 JSON format
      topic: raw.category === "E. Boats & Streams" && topicMode === "BOATS" ? "Boats & Streams" : "Time, Speed & Distance",
      category: raw.category,
      sub_type: raw.sub_type,
      difficulty: raw.difficulty,
      exam_suitability: raw.exam_suitability,
      question_text: raw.question_text,
      options: raw.options,
      correct_answer: raw.correct_answer,
      solution: raw.solution,
      shortcut_method: raw.shortcut_method,
      validation: verdict.validation,

      // HHK Platform Compatibility Fields
      questionId,
      templateId: raw.templateId,
      fingerprint,
      exam,
      questionText: raw.question_text,
      optionsArray: raw.optionsArray,
      correctOptionIndex: raw.correctOptionIndex,
      answer: raw.answer,
      solutionSteps,
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
      topicMode,
    },
    rejectedLogs,
  };
}

export default generateTsdBatch;