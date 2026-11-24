// Place at: server/question-engine/generators/quant/problemsOnAges/index.js
import { runVerifiedTemplateBatch } from "../../../core/batchUtils.js";
import { createRng } from "./agesMath.js";
import { computeAgesFingerprint, validateAgesQuestion } from "./agesValidator.js";
import { AGES_TEMPLATES_PART_1 } from "./agesTemplatesPart1.js";
import { AGES_TEMPLATES_PART_2 } from "./agesTemplatesPart2.js";

export const ALL_AGES_TEMPLATES = [
  ...AGES_TEMPLATES_PART_1,
  ...AGES_TEMPLATES_PART_2,
];

/**
 * Exam priority weights reflecting Indian banking exam frequency across Categories A–H.
 */
export const AGES_CATEGORY_WEIGHTS = {
  A: 10, // Basic Age Problems
  B: 18, // Age Ratio Problems (highest Prelims frequency)
  C: 16, // Parent & Child Problems
  D: 14, // Past & Future Age Problems
  E: 10, // Multiple-Person Age Problems
  F: 12, // Average Age Problems
  G: 10, // Age Replacement Problems
  H: 10, // Advanced Mains Age Problems
};

const formatAgesSolutionSteps = (raw) => [
  `Given: ${raw.solution.given_data.join("; ")}`,
  `Variables: ${raw.solution.variables.join("; ")}`,
  `Equations: ${raw.solution.equations.join("; ")}`,
  ...raw.solution.steps,
  `Final Answer: ${raw.solution.final_answer}`,
];

export function generateAgesBatch(options = {}) {
  return runVerifiedTemplateBatch({
    topic: "Problems on Ages",
    allTemplates: ALL_AGES_TEMPLATES,
    categoryWeights: AGES_CATEGORY_WEIGHTS,
    defaultWeight: 10,
    maxAttemptsMultiplier: 25,
    minAttempts: 100,
    createRng,
    validateQuestion: validateAgesQuestion,
    computeFingerprint: computeAgesFingerprint,
    formatSolutionSteps: formatAgesSolutionSteps,
    emptyPoolReason: "No Problems on Ages templates matched criteria.",
    ...options,
  });
}

export default generateAgesBatch;
