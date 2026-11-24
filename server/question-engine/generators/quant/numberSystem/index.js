// Place at: server/question-engine/generators/quant/numberSystem/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import { LEVEL1_NS_MAP } from "./level1NumberSystem.js";
import { LEVEL2_NS_MAP, LEVEL3_NS_MAP } from "./level2And3NumberSystem.js";

const FULL_NS_MAP = {
  ...LEVEL1_NS_MAP,
  ...LEVEL2_NS_MAP,
  ...LEVEL3_NS_MAP,
};

/**
 * Exam Blueprints mapping each Banking Exam to its realistic Number System types.
 */
export const NUMBER_SYSTEM_BLUEPRINTS = {
  RRB_CLERK_PRELIMS: [1, 2, 3, 4, 6, 7, 8, 9, 11, 12],
  IBPS_CLERK_PRELIMS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  SBI_CLERK_PRELIMS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 22],
  IBPS_PO_PRELIMS: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 18, 21, 22, 24],
  SBI_PO_PRELIMS: [2, 4, 5, 9, 10, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  IBPS_PO_MAINS: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
};

/**
 * Generates a batch of 100% logic-verified Number System questions
 * across Level 1 (Types 1-14), Level 2 (Types 15-24), and Level 3 (Types 25-29).
 */
export function generateNumberSystemBatch({
  exam = "IBPS_PO_PRELIMS",
  level = "AUTO", // "L1" | "L2" | "L3" | "ALL" | "AUTO"
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

  let pool = allowedTypes;
  if (!pool || !pool.length) {
    const lvl = String(level || "AUTO").toUpperCase();
    if (lvl === "L1" || lvl === "LEVEL1") {
      pool = Object.keys(LEVEL1_NS_MAP).map(Number);
    } else if (lvl === "L2" || lvl === "LEVEL2") {
      pool = Object.keys(LEVEL2_NS_MAP).map(Number);
    } else if (lvl === "L3" || lvl === "LEVEL3") {
      pool = Object.keys(LEVEL3_NS_MAP).map(Number);
    } else if (lvl === "ALL") {
      pool = Object.keys(FULL_NS_MAP).map(Number);
    } else {
      // AUTO: use exam blueprint (or difficulty tier)
      pool =
        NUMBER_SYSTEM_BLUEPRINTS[exam] ||
        (resolvedDiff === "EASY"
          ? Object.keys(LEVEL1_NS_MAP).map(Number)
          : resolvedDiff === "HARD"
          ? [...Object.keys(LEVEL2_NS_MAP).map(Number), ...Object.keys(LEVEL3_NS_MAP).map(Number)]
          : [...Object.keys(LEVEL1_NS_MAP).map(Number), ...Object.keys(LEVEL2_NS_MAP).map(Number)]);
    }
  }

  const questions = [];
  for (let i = 0; i < count; i++) {
    const typeId = pickRandom(pool);
    const genFn = FULL_NS_MAP[typeId];
    if (!genFn) {
      throw new Error(`Unsupported Number System type: ${typeId}`);
    }
    questions.push(genFn(exam, resolvedDiff));
  }

  return questions;
}