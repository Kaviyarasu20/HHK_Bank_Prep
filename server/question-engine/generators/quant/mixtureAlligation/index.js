// Place at: server/question-engine/generators/quant/mixtureAlligation/index.js
import { runVerifiedTemplateBatch } from "../../../core/batchUtils.js";
import { createRng } from "./mixtureMath.js";
import { computeMixtureFingerprint, validateMixtureQuestion } from "./mixtureValidator.js";
import { MIXTURE_TEMPLATES_PART_1 } from "./mixtureTemplatesPart1.js";
import { MIXTURE_TEMPLATES_PART_2 } from "./mixtureTemplatesPart2.js";

export const ALL_MIXTURE_TEMPLATES = [...MIXTURE_TEMPLATES_PART_1, ...MIXTURE_TEMPLATES_PART_2];

/**
 * Exam priority weights reflecting Indian banking exam frequency across Categories 1–18.
 */
export const MIXTURE_CATEGORY_WEIGHTS = {
  1: 7,  // Basic Mean Price
  2: 10, // Alligation Rule
  3: 8,  // Ingredient Ratio
  4: 9,  // Individual Quantity
  5: 7,  // Milk & Water
  6: 9,  // Addition of Ingredient
  7: 6,  // Removal of Ingredient
  8: 10, // Single Replacement
  9: 9,  // Repeated Replacement
  10: 6, // Concentration %
  11: 8, // Dilution
  12: 7, // Three-Ingredient Mixture
  13: 8, // Mixing Different Solutions
  14: 7, // Missing Price/Concentration
  15: 9, // Ratio Change
  16: 10,// Mixture & Profit Combined
  17: 8, // Adulteration
  18: 8, // Multiple Operations
};

export function generateMixtureAlligationBatch(options = {}) {
  return runVerifiedTemplateBatch({
    topic: "Mixture & Alligation",
    allTemplates: ALL_MIXTURE_TEMPLATES,
    categoryWeights: MIXTURE_CATEGORY_WEIGHTS,
    defaultWeight: 5,
    maxAttemptsMultiplier: 25,
    minAttempts: 100,
    createRng,
    validateQuestion: validateMixtureQuestion,
    computeFingerprint: computeMixtureFingerprint,
    emptyPoolReason: "No Mixture & Alligation templates matched criteria.",
    ...options,
  });
}

export default generateMixtureAlligationBatch;
