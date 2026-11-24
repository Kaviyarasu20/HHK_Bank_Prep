// Place at: server/question-engine/generators/quant/ratioProportion/index.js
import { runPrelimsMainsBatch } from "../../../core/batchUtils.js";
import { PRELIMS_RATIO_MAP } from "./prelimsRatioTypes.js";
import { MAINS_RATIO_MAP } from "./mainsRatioTypes.js";

const DEFAULT_PRELIMS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_MAINS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Generates a batch of 100% logic-verified Ratio & Proportion questions
 * across Prelims (15 Must-Prepare types) and Mains (12 Important types).
 */
export function generateRatioBatch(options = {}) {
  return runPrelimsMainsBatch({
    topicLabel: "Ratio & Proportion",
    prelimsMap: PRELIMS_RATIO_MAP,
    mainsMap: MAINS_RATIO_MAP,
    defaultPrelimsPool: DEFAULT_PRELIMS_POOL,
    defaultMainsPool: DEFAULT_MAINS_POOL,
    ...options,
  });
}
