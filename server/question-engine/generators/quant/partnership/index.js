// Place at: server/question-engine/generators/quant/partnership/index.js
import { runVerifiedTemplateBatch } from "../../../core/batchUtils.js";
import { createRng } from "./partnershipMath.js";
import {
  computePartnershipFingerprint,
  validatePartnershipQuestion,
} from "./partnershipValidator.js";
import { PARTNERSHIP_TEMPLATES_PART_1 } from "./partnershipTemplatesPart1.js";
import { PARTNERSHIP_TEMPLATES_PART_2 } from "./partnershipTemplatesPart2.js";

export const ALL_PARTNERSHIP_TEMPLATES = [
  ...PARTNERSHIP_TEMPLATES_PART_1,
  ...PARTNERSHIP_TEMPLATES_PART_2,
];

/**
 * Exam priority weights reflecting Indian banking exam frequency across Categories A–G.
 */
export const PARTNERSHIP_CATEGORY_WEIGHTS = {
  A: 12, // Basic Partnership
  B: 10, // Simple Partnership
  C: 20, // Time-Based Partnership (highest Prelims frequency)
  D: 18, // Change in Investment
  E: 15, // Working & Sleeping Partners
  F: 13, // Three or More Partners
  G: 12, // Advanced Mains Partnership
};

export function generatePartnershipBatch(options = {}) {
  return runVerifiedTemplateBatch({
    topic: "Partnership",
    allTemplates: ALL_PARTNERSHIP_TEMPLATES,
    categoryWeights: PARTNERSHIP_CATEGORY_WEIGHTS,
    defaultWeight: 10,
    maxAttemptsMultiplier: 25,
    minAttempts: 100,
    createRng,
    validateQuestion: validatePartnershipQuestion,
    computeFingerprint: computePartnershipFingerprint,
    emptyPoolReason: "No Partnership templates matched criteria.",
    ...options,
  });
}

export default generatePartnershipBatch;
