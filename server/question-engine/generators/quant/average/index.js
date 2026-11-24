// Place at: server/question-engine/generators/quant/average/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import { PRELIMS_AVG_MAP } from "./prelimsAverageTypes.js";
import { MAINS_AVG_MAP } from "./mainsAverageTypes.js";

/**
 * Generates a batch of 100% logic-verified Average questions
 * across Prelims (15 Must-Prepare types) and Mains (15 Important types),
 * also supporting Level 1 / Level 2 / Level 3 filtering.
 */
export function generateAverageBatch({
  exam = "IBPS_PO_PRELIMS",
  level = "AUTO", // "PRELIMS" | "MAINS" | "L1" | "L2" | "L3" | "BOTH" | "AUTO"
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

  const lvl = String(level || "AUTO").toUpperCase();

  // Level-based pools matching your 3-stage roadmap
  const L1_PRELIMS_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 14, 15];
  const L2_PRELIMS_TYPES = [9, 10, 11, 12, 13];
  const L2_MAINS_TYPES = [1, 2, 7, 8, 9];
  const L3_MAINS_TYPES = [3, 4, 5, 6, 10, 11, 12, 13, 14, 15];

  const questions = [];
  for (let i = 0; i < count; i++) {
    if (lvl === "L1") {
      const id = pickRandom(allowedTypes || L1_PRELIMS_TYPES);
      questions.push(PRELIMS_AVG_MAP[id](exam, resolvedDiff));
      continue;
    }
    if (lvl === "L2") {
      if (i % 2 === 0) {
        questions.push(PRELIMS_AVG_MAP[pickRandom(L2_PRELIMS_TYPES)](exam, resolvedDiff));
      } else {
        questions.push(MAINS_AVG_MAP[pickRandom(L2_MAINS_TYPES)](exam, resolvedDiff));
      }
      continue;
    }
    if (lvl === "L3") {
      const id = pickRandom(allowedTypes || L3_MAINS_TYPES);
      questions.push(MAINS_AVG_MAP[id](exam, resolvedDiff));
      continue;
    }

    const useMains =
      lvl === "MAINS" ||
      (lvl === "BOTH" && i % 2 === 1) ||
      (lvl === "AUTO" && (resolvedDiff === "HARD" || exam.includes("MAINS")));

    const activeMap = useMains ? MAINS_AVG_MAP : PRELIMS_AVG_MAP;
    const pool = allowedTypes || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const typeId = pickRandom(pool);
    questions.push(activeMap[typeId](exam, resolvedDiff));
  }

  return questions;
}