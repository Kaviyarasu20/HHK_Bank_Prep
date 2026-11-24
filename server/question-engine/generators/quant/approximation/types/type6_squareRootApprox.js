// generators/quant/approximation/types/type6_squareRootApprox.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, perturbRadicand, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType6(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const r1 = randInt(...cfg.sqRange);
  const r2 = randInt(...cfg.sqRange);
  const rad1 = perturbRadicand(r1 * r1);
  const rad2 = perturbRadicand(r2 * r2);

  if (difficulty === "EASY") {
    const C = randInt(20, 90);
    const answer = r1 + r2 + C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T6_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_6_SQUARE_ROOT_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `√${rad1} + √${rad2} + ${perturbInt(C, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Approximate square roots: √${rad1} ≈ ${r1} and √${rad2} ≈ ${r2}`,
        `${r1} + ${r2} + ${C} = ${answer}`,
      ],
    };
  }

  const B = randInt(4, 14);
  const D = randInt(20, 80);

  if (difficulty === "MEDIUM") {
    const answer = r1 * B + r2 - D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T6_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_6_SQUARE_ROOT_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `√${rad1} × ${perturbInt(B, 2)} + √${rad2} - ${perturbInt(D, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `√${rad1} ≈ ${r1} and √${rad2} ≈ ${r2}`,
        `(${r1} × ${B}) + ${r2} - ${D} = ${r1 * B} + ${r2} - ${D} = ${answer}`,
      ],
    };
  }

  // HARD: √rad1 × B + √rad2 × E - D ≈ ?
  const E = randInt(3, 11);
  const answer = r1 * B + r2 * E - D;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T6_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_6_SQUARE_ROOT_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `√${rad1} × ${perturbInt(B, 2)} + √${rad2} × ${perturbInt(E, 1)} - ${perturbInt(D, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `√${rad1} ≈ ${r1} and √${rad2} ≈ ${r2}`,
      `(${r1} × ${B}) + (${r2} × ${E}) - ${D} = ${r1 * B} + ${r2 * E} - ${D} = ${answer}`,
    ],
  };
}