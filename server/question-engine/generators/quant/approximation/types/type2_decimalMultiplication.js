// generators/quant/approximation/types/type2_decimalMultiplication.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType2(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const A = randInt(...cfg.multA);
  const B = randInt(...cfg.multB);
  const pA = perturbInt(A, 1);
  const pB = perturbInt(B, 1);

  if (difficulty === "EASY") {
    const C = randInt(15, 80);
    const pC = perturbInt(C, 2);
    const answer = A * B + C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T2_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_2_DECIMAL_MULTIPLICATION",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} × ${pB} + ${pC} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round decimals: (${A} × ${B}) + ${C}`,
        `${A * B} + ${C} = ${answer}`,
      ],
    };
  }

  const C = randInt(...cfg.multA);
  const D = randInt(4, 12);
  const E = randInt(25, 110);
  const pC = perturbInt(C, 2);
  const pD = perturbInt(D, 1);
  const pE = perturbInt(E, 2);

  if (difficulty === "MEDIUM") {
    const answer = A * B + C * D - E;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T2_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_2_DECIMAL_MULTIPLICATION",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} × ${pB} + ${pC} × ${pD} - ${pE} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round decimals: (${A} × ${B}) + (${C} × ${D}) - ${E}`,
        `${A * B} + ${C * D} - ${E} = ${answer}`,
      ],
    };
  }

  // HARD: 3-factor product + 2-factor product
  const F = randInt(2, 5);
  const pF = perturbInt(F, 2);
  const answer = A * B * F + C * D - E;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T2_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_2_DECIMAL_MULTIPLICATION",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${pA} × ${pB} × ${pF} + ${pC} × ${pD} - ${pE} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round decimals: (${A} × ${B} × ${F}) + (${C} × ${D}) - ${E}`,
      `${A * B * F} + ${C * D} - ${E} = ${answer}`,
    ],
  };
}