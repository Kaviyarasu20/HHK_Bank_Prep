// Place at: server/question-engine/generators/quant/interest/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import {
  PRELIMS_SI_MAP,
  PRELIMS_CI_MAP,
  PRELIMS_INTEREST_MAP,
} from "./prelimsInterestTypes.js";
import {
  MAINS_SI_MAP,
  MAINS_CI_MAP,
  MAINS_INTEREST_MAP,
} from "./mainsInterestTypes.js";

/**
 * Generates a batch of 100% logic-verified Simple & Compound Interest questions.
 *
 * @param {object} params
 * @param {string} params.exam
 * @param {"SI"|"CI"|"BOTH"} params.interestMode
 * @param {"PRELIMS"|"MAINS"|"BOTH"|"AUTO"} params.level
 * @param {number[]|null} params.allowedTypes
 * @param {"EASY"|"MEDIUM"|"HARD"|"AUTO"} params.difficulty
 * @param {number} params.count
 */
export function generateInterestBatch({
  exam = "IBPS_PO_PRELIMS",
  interestMode = "BOTH",
  level = "AUTO",
  allowedTypes = null,
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

  const mode = String(interestMode || "BOTH").toUpperCase();

  const getMapAndPool = (useMains) => {
    if (useMains) {
      const activeMap =
        mode === "SI" ? MAINS_SI_MAP : mode === "CI" ? MAINS_CI_MAP : MAINS_INTEREST_MAP;
      const pool = allowedTypes || Object.keys(activeMap).map(Number);
      return { activeMap, pool };
    }
    const activeMap =
      mode === "SI" ? PRELIMS_SI_MAP : mode === "CI" ? PRELIMS_CI_MAP : PRELIMS_INTEREST_MAP;
    const pool = allowedTypes || Object.keys(activeMap).map(Number);
    return { activeMap, pool };
  };

  const questions = [];
  for (let i = 0; i < count; i++) {
    const useMains =
      resolvedLevel === "MAINS" || (resolvedLevel === "BOTH" && i % 2 === 1);
    const { activeMap, pool } = getMapAndPool(useMains);
    const typeId = pickRandom(pool);
    const genFn = activeMap[typeId];
    if (!genFn) {
      throw new Error(`Unsupported Interest type ${typeId} (mode=${mode}, mains=${useMains})`);
    }
    questions.push(genFn(exam, resolvedDiff));
  }

  return questions;
}