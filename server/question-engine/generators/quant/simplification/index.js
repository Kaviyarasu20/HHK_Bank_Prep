// generators/quant/simplification/index.js
import { pickRandom } from "../../../core/mathUtils.js";
import { EXAM_BLUEPRINTS } from "../../../config/examBlueprints.js";
import { generateType1VBODMAS } from "./types/type1_vbodmas.js";
import { generateType2PercentFraction } from "./types/type2_percentFraction.js";
import { generateType3MixedFractions } from "./types/type3_mixedFractions.js";
import { generateType4SquaresCubesRoots } from "./types/type4_squaresCubesRoots.js";
import { generateType5SurdsIndices } from "./types/type5_surdsIndices.js";
import { generateType6Decimals } from "./types/type6_decimals.js";
import { generateType7AlgebraicIdentities } from "./types/type7_algebraicIdentities.js";
import { generateType8LadderFractions } from "./types/type8_ladderFractions.js";
import { generateType9UnitDigitSum } from "./types/type9_unitDigitSum.js";

const TYPE_MAP = {
  1: generateType1VBODMAS,
  2: generateType2PercentFraction,
  3: generateType3MixedFractions,
  4: generateType4SquaresCubesRoots,
  5: generateType5SurdsIndices,
  6: generateType6Decimals,
  7: generateType7AlgebraicIdentities,
  8: generateType8LadderFractions,
  9: generateType9UnitDigitSum,
};

function resolveDifficulty(exam, requestedDifficulty) {
  if (requestedDifficulty && requestedDifficulty !== "AUTO") {
    return requestedDifficulty;
  }
  const dist = EXAM_BLUEPRINTS[exam]?.simplification?.difficultyDistribution || {
    EASY: 0.3,
    MEDIUM: 0.5,
    HARD: 0.2,
  };
  const roll = Math.random();
  if (roll < dist.EASY) return "EASY";
  if (roll < dist.EASY + dist.MEDIUM) return "MEDIUM";
  return "HARD";
}

export function generateSimplificationBatch({
  exam = "IBPS_CLERK_PRELIMS",
  allowedTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9],
  difficulty = "AUTO",
  count = 10,
}) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const selectedType = pickRandom(allowedTypes);
    const resolvedDiff = resolveDifficulty(exam, difficulty);
    questions.push(TYPE_MAP[selectedType](exam, resolvedDiff));
  }
  return questions;
}