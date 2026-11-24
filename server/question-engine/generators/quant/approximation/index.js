// generators/quant/approximation/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import { EXAM_BLUEPRINTS } from "../../../config/examBlueprints.js";
import { generateApproxType1 } from "./types/type1_basicArithmetic.js";
import { generateApproxType2 } from "./types/type2_decimalMultiplication.js";
import { generateApproxType3 } from "./types/type3_decimalDivision.js";
import { generateApproxType4 } from "./types/type4_percentageApprox.js";
import { generateApproxType5 } from "./types/type5_fractionApprox.js";
import { generateApproxType6 } from "./types/type6_squareRootApprox.js";
import { generateApproxType7 } from "./types/type7_cubeRootApprox.js";
import { generateApproxType8 } from "./types/type8_mixedArithmetic.js";
import { generateApproxType9 } from "./types/type9_bracketApprox.js";
import { generateApproxType10 } from "./types/type10_multipleOperations.js";
import { generateApproxType11 } from "./types/type11_powerApprox.js";
import { generateApproxType12 } from "./types/type12_combinedRootArith.js";

const APPROX_TYPE_MAP = {
  1: generateApproxType1,
  2: generateApproxType2,
  3: generateApproxType3,
  4: generateApproxType4,
  5: generateApproxType5,
  6: generateApproxType6,
  7: generateApproxType7,
  8: generateApproxType8,
  9: generateApproxType9,
  10: generateApproxType10,
  11: generateApproxType11,
  12: generateApproxType12,
};

function resolveDifficulty(exam, requestedDifficulty) {
  if (requestedDifficulty && requestedDifficulty !== "AUTO") {
    return requestedDifficulty;
  }
  const dist = EXAM_BLUEPRINTS[exam]?.approximation?.difficultyDistribution || {
    EASY: 0.2,
    MEDIUM: 0.6,
    HARD: 0.2,
  };
  const roll = Math.random();
  if (roll < dist.EASY) return "EASY";
  if (roll < dist.EASY + dist.MEDIUM) return "MEDIUM";
  return "HARD";
}

export function generateApproximationBatch({
  exam = "IBPS_PO_PRELIMS",
  allowedTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  difficulty = "AUTO",
  count = 10,
}) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const selectedType = pickRandom(allowedTypes);
    const generatorFn = APPROX_TYPE_MAP[selectedType];
    if (!generatorFn) {
      throw new Error(`Unsupported approximation type: ${selectedType}`);
    }
    const resolvedDiff = resolveDifficulty(exam, difficulty);
    questions.push(generatorFn(exam, resolvedDiff));
  }
  return questions;
}