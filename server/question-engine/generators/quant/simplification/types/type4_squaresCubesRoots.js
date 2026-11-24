// generators/quant/simplification/types/type4_squaresCubesRoots.js
import { randInt } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType4SquaresCubesRoots(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].squaresCubesRoots;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;

  const rootA = randInt(...cfg.sqRootRange);
  const rootB = randInt(...cfg.cubeRootRange);
  const sqA = rootA * rootA;
  const cubeB = rootB * rootB * rootB;

  if (cfg.allowSquaredRhs) {
    const targetAns = randInt(5, 22);
    const rhsSquared = targetAns * targetAns;
    const extraTerm = rhsSquared - (rootA + rootB);
    const sign = extraTerm >= 0 ? "+" : "-";
    const absExtra = Math.abs(extraTerm);
    const { options, correctOptionIndex } = buildOptions(targetAns, "INTEGER", offsets);

    return {
      questionId: `SIMP_T4_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_4_SQUARES_CUBES_ROOTS",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `√${sqA} + ³√${cubeB} ${sign} ${absExtra} = ?²`,
      options,
      correctOptionIndex,
      answer: String(targetAns),
      solutionSteps: [
        `√${sqA} = ${rootA}, ³√${cubeB} = ${rootB}`,
        `${rootA} + ${rootB} ${sign} ${absExtra} = ${rhsSquared}`,
        `?² = ${rhsSquared} → ? = ${targetAns}`,
      ],
    };
  }

  const baseC = randInt(8, 20);
  const sqC = baseC * baseC;
  const answer = rootA + rootB + sqC;
  const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

  return {
    questionId: `SIMP_T4_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_4_SQUARES_CUBES_ROOTS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `√${sqA} + ³√${cubeB} + ${baseC}² = ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `√${sqA} = ${rootA}, ³√${cubeB} = ${rootB}, ${baseC}² = ${sqC}`,
      `${rootA} + ${rootB} + ${sqC} = ${answer}`,
    ],
  };
}