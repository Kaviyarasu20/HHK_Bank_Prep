// Place at: server/question-engine/generators/quant/permutationCombination/index.js
import { runVerifiedTemplateBatch } from "../../../core/batchUtils.js";
import { createRng } from "./pncMath.js";
import { computePncFingerprint, validatePncQuestion } from "./pncValidator.js";
import { PNC_TEMPLATES_PART_1 } from "./pncTemplatesPart1.js";
import { PNC_TEMPLATES_PART_2 } from "./pncTemplatesPart2.js";

export const ALL_PNC_TEMPLATES = [...PNC_TEMPLATES_PART_1, ...PNC_TEMPLATES_PART_2];

/**
 * Exam priority weights reflecting Indian banking exam frequency across Categories A–N.
 */
export const PNC_CATEGORY_WEIGHTS = {
  A: 8,  // Basic Permutation
  B: 8,  // Basic Combination
  C: 12, // Word Arrangement (high banking frequency)
  D: 12, // Repeated Letters (high banking frequency)
  E: 10, // Objects Together
  F: 10, // Objects Not Together
  G: 8,  // Circular Permutation
  H: 12, // Digit Formation (high banking frequency)
  I: 12, // Committee & Team Formation (high banking frequency)
  J: 8,  // Conditional Selection (Mandatory / Excluded)
  K: 6,  // Group Formation & Distribution
  L: 10, // At Least / At Most / Exactly
  M: 8,  // Restricted Position Arrangements
  N: 4,  // Controlled Derangements (Mains only)
};

const formatPncSolutionSteps = (raw) => [
  `Given: ${raw.solution.given_data.join("; ")}`,
  `Concept: ${raw.solution.concept}`,
  `Formula: ${raw.solution.formula}`,
  ...raw.solution.steps,
  `Final Answer: ${raw.solution.final_answer}`,
];

export function generatePncBatch(options = {}) {
  return runVerifiedTemplateBatch({
    topic: "Permutation and Combination",
    allTemplates: ALL_PNC_TEMPLATES,
    categoryWeights: PNC_CATEGORY_WEIGHTS,
    defaultWeight: 8,
    maxAttemptsMultiplier: 30,
    minAttempts: 120,
    createRng,
    validateQuestion: validatePncQuestion,
    computeFingerprint: computePncFingerprint,
    formatSolutionSteps: formatPncSolutionSteps,
    stringifyAnswer: true,
    emptyPoolReason: "No Permutation & Combination templates matched criteria.",
    ...options,
  });
}

export default generatePncBatch;
