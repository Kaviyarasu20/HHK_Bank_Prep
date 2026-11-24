// generators/quant/approximation/types/type7_cubeRootApprox.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, perturbRadicand, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType7(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const c1 = randInt(...cfg.cubeRange);
  const c2 = randInt(...cfg.cubeRange);
  const rad1 = perturbRadicand(c1 * c1 * c1);
  const rad2 = perturbRadicand(c2 * c2 * c2);

  if (difficulty === "EASY") {
    const K = randInt(25, 120);
    const answer = c1 + c2 + K;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_7_CUBE_ROOT_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `³√${rad1} + ³√${rad2} + ${perturbInt(K, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Approximate cube roots: ³√${rad1} ≈ ${c1} and ³√${rad2} ≈ ${c2}`,
        `${c1} + ${c2} + ${K} = ${answer}`,
      ],
    };
  }

  const B = randInt(5, 16);
  const D = randInt(4, 15);

  if (difficulty === "MEDIUM") {
    const answer = c1 * B + c2 * D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_7_CUBE_ROOT_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `³√${rad1} × ${perturbInt(B, 1)} + ³√${rad2} × ${perturbInt(D, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `³√${rad1} ≈ ${c1} and ³√${rad2} ≈ ${c2}`,
        `(${c1} × ${B}) + (${c2} × ${D}) = ${c1 * B} + ${c2 * D} = ${answer}`,
      ],
    };
  }

  // HARD: ³√rad1 × B + ³√rad2 × D - E ≈ ?
  const E = randInt(15, 65);
  const answer = c1 * B + c2 * D - E;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_7_CUBE_ROOT_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `³√${rad1} × ${perturbInt(B, 2)} + ³√${rad2} × ${perturbInt(D, 2)} - ${perturbInt(E, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `³√${rad1} ≈ ${c1} and ³√${rad2} ≈ ${c2}`,
      `(${c1} × ${B}) + (${c2} × ${D}) - ${E} = ${c1 * B} + ${c2 * D} - ${E} = ${answer}`,
    ],
  };
}