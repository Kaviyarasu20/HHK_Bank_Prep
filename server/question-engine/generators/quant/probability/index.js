// Place at: server/question-engine/generators/quant/probability/index.js
import { runVerifiedTemplateBatch } from "../../../core/batchUtils.js";
import { createRng } from "./probabilityMath.js";
import {
  computeProbabilityFingerprint,
  validateProbabilityQuestion,
} from "./probabilityValidator.js";
import { PROB_TEMPLATES_PART_1 } from "./probabilityTemplatesPart1.js";
import { PROB_TEMPLATES_PART_2 } from "./probabilityTemplatesPart2.js";

export const ALL_PROBABILITY_TEMPLATES = [
  ...PROB_TEMPLATES_PART_1,
  ...PROB_TEMPLATES_PART_2,
];

/**
 * Exam priority weights reflecting Indian banking exam frequency across Categories A–J.
 */
export const PROBABILITY_CATEGORY_WEIGHTS = {
  A: 8,  // Basic Probability
  B: 10, // Coins
  C: 14, // Dice
  D: 14, // Playing Cards
  E: 18, // Balls & Objects (highest banking Prelims/Mains frequency)
  F: 8,  // Complementary Probability
  G: 10, // Conditional Probability
  H: 8,  // With & Without Replacement
  I: 6,  // Independent & Mutually Exclusive
  J: 6,  // Binomial (Exactly, At Least, At Most)
};

export function generateProbabilityBatch(options = {}) {
  return runVerifiedTemplateBatch({
    topic: "Probability",
    allTemplates: ALL_PROBABILITY_TEMPLATES,
    categoryWeights: PROBABILITY_CATEGORY_WEIGHTS,
    defaultWeight: 8,
    maxAttemptsMultiplier: 30,
    minAttempts: 120,
    createRng,
    validateQuestion: validateProbabilityQuestion,
    computeFingerprint: computeProbabilityFingerprint,
    emptyPoolReason: "No Probability templates matched criteria.",
    ...options,
  });
}

export default generateProbabilityBatch;
