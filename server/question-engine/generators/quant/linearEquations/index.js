// Place at: server/question-engine/generators/quant/linearEquations/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import { PRELIMS_LINEAR_MAP } from "./prelimsLinearTypes.js";
import { MAINS_LINEAR_MAP } from "./mainsLinearTypes.js";

/**
 * Generates a batch of 100% logic-verified Linear Simultaneous Equations
 * across Prelims Level (15 types) and Mains Level (15 types).
 *
 * @param {object} params
 * @param {string} params.exam - Exam blueprint key (e.g., "IBPS_PO_PRELIMS", "IBPS_PO_MAINS")
 * @param {"PRELIMS"|"MAINS"|"BOTH"} params.level - Which tier to draw from
 * @param {number[]} params.allowedTypes - Subset of 1..15
 * @param {"EASY"|"MEDIUM"|"HARD"|"AUTO"} params.difficulty
 * @param {number} params.count
 */
export function generateLinearEquationsBatch({
  exam = "IBPS_PO_PRELIMS",
  level = "AUTO",
  allowedTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  difficulty = "MEDIUM",
  count = 10,
} = {}) {
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

  const questions = [];
  for (let i = 0; i < count; i++) {
    const typeId = pickRandom(allowedTypes);
    const activeMap =
      resolvedLevel === "BOTH"
        ? i % 2 === 0
          ? PRELIMS_LINEAR_MAP
          : MAINS_LINEAR_MAP
        : resolvedLevel === "MAINS"
        ? MAINS_LINEAR_MAP
        : PRELIMS_LINEAR_MAP;

    const genFn = activeMap[typeId];
    if (!genFn) {
      throw new Error(`Unsupported Linear Equations type: ${typeId}`);
    }
    questions.push(genFn(exam, resolvedDiff));
  }

  return questions;
}