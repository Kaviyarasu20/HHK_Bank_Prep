// Place at: server/question-engine/generators/quant/percentage/index.js
import { runPrelimsMainsBatch } from "../../../core/batchUtils.js";
import { PRELIMS_PERCENTAGE_MAP } from "./prelimsPercentageTypes.js";
import { MAINS_PERCENTAGE_MAP } from "./mainsPercentageTypes.js";

const DEFAULT_PRELIMS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_MAINS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Generates a batch of 100% logic-verified Percentage questions
 * across Prelims (15 Must-Prepare types) and Mains (10 Important types).
 */
export function generatePercentageBatch(options = {}) {
  return runPrelimsMainsBatch({
    topicLabel: "Percentage",
    prelimsMap: PRELIMS_PERCENTAGE_MAP,
    mainsMap: MAINS_PERCENTAGE_MAP,
    defaultPrelimsPool: DEFAULT_PRELIMS_POOL,
    defaultMainsPool: DEFAULT_MAINS_POOL,
    ...options,
  });
}
