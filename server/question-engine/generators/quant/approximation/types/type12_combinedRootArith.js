// generators/quant/approximation/types/type12_combinedRootArith.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, perturbRadicand, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType12(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const sqRoot = randInt(...cfg.sqRange);
  const cbRoot = randInt(...cfg.cubeRange);
  const C = randInt(3, 14);

  const radSq = perturbRadicand(sqRoot * sqRoot);
  const radCb = perturbRadicand(cbRoot * cbRoot * cbRoot);

  if (difficulty === "EASY") {
    const answer = sqRoot + cbRoot * C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T12_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_12_COMBINED_ROOT_ARITH",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `√${radSq} + ³√${radCb} × ${perturbInt(C, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Approximate roots: √${radSq} ≈ ${sqRoot} and ³√${radCb} ≈ ${cbRoot}`,
        `${sqRoot} + (${cbRoot} × ${C}) = ${sqRoot} + ${cbRoot * C} = ${answer}`,
      ],
    };
  }

  const D = randInt(8, 22);

  if (difficulty === "MEDIUM") {
    const answer = sqRoot + cbRoot * C + D * D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T12_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_12_COMBINED_ROOT_ARITH",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `√${radSq} + ³√${radCb} × ${perturbInt(C, 1)} + (${perturbInt(D, 2)})² ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Approximate roots & powers: √${radSq} ≈ ${sqRoot}, ³√${radCb} ≈ ${cbRoot}, (${D})² = ${D * D}`,
        `${sqRoot} + (${cbRoot} × ${C}) + ${D * D} = ${answer}`,
      ],
    };
  }

  // HARD: √radSq × B + ³√radCb × C + D² - E ≈ ?
  const B = randInt(4, 11);
  const E = randInt(25, 95);
  const answer = sqRoot * B + cbRoot * C + D * D - E;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T12_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_12_COMBINED_ROOT_ARITH",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `√${radSq} × ${perturbInt(B, 2)} + ³√${radCb} × ${perturbInt(C, 2)} + (${perturbInt(D, 2)})² - ${perturbInt(E, 1)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Approximate roots & powers: (${sqRoot} × ${B}) + (${cbRoot} × ${C}) + ${D}² - ${E}`,
      `${sqRoot * B} + ${cbRoot * C} + ${D * D} - ${E} = ${answer}`,
    ],
  };
}