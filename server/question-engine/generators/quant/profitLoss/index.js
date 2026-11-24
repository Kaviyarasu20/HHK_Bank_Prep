// Place at: server/question-engine/generators/quant/profitLoss/index.js
import { runPrelimsMainsBatch } from "../../../core/batchUtils.js";
import { PRELIMS_PL_MAP } from "./prelimsProfitLossTypes.js";
import { MAINS_PL_MAP } from "./mainsProfitLossTypes.js";

const DEFAULT_PRELIMS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_MAINS_POOL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Generates a batch of 100% logic-verified Profit & Loss questions
 * across Prelims (15 Must-Prepare types) and Mains (12 Important types).
 */
export function generateProfitLossBatch(options = {}) {
  return runPrelimsMainsBatch({
    topicLabel: "Profit & Loss",
    prelimsMap: PRELIMS_PL_MAP,
    mainsMap: MAINS_PL_MAP,
    defaultPrelimsPool: DEFAULT_PRELIMS_POOL,
    defaultMainsPool: DEFAULT_MAINS_POOL,
    ...options,
  });
}
