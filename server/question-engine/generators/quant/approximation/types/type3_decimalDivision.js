// generators/quant/approximation/types/type3_decimalDivision.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType3(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const B = randInt(...cfg.divDen);
  const q1 = randInt(...cfg.divQuot);
  const A = B * q1;

  const pA = perturbInt(A, 1);
  const pB = perturbInt(B, 2);

  if (difficulty === "EASY") {
    const C = randInt(20, 95);
    const pC = perturbInt(C, 1);
    const answer = q1 + C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T3_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_3_DECIMAL_DIVISION",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} ÷ ${pB} + ${pC} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} ÷ ${B}) + ${C}`,
        `${q1} + ${C} = ${answer}`,
      ],
    };
  }

  const D = randInt(...cfg.divDen);
  const q2 = randInt(...cfg.divQuot);
  const C = D * q2;
  const E = randInt(30, 150);

  const pC = perturbInt(C, 2);
  const pD = perturbInt(D, 2);
  const pE = perturbInt(E, 1);

  if (difficulty === "MEDIUM") {
    const answer = q1 + q2 + E;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T3_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_3_DECIMAL_DIVISION",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} ÷ ${pB} + ${pC} ÷ ${pD} + ${pE} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} ÷ ${B}) + (${C} ÷ ${D}) + ${E}`,
        `${q1} + ${q2} + ${E} = ${answer}`,
      ],
    };
  }

  // HARD: (A ÷ B) × K - (C ÷ D) ≈ ?
  const K = randInt(4, 11);
  const pK = perturbInt(K, 2);
  const answer = q1 * K + q2;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T3_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_3_DECIMAL_DIVISION",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${pA} ÷ ${pB} × ${pK} + ${pC} ÷ ${pD} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round terms: (${A} ÷ ${B}) × ${K} + (${C} ÷ ${D})`,
      `(${q1} × ${K}) + ${q2} = ${q1 * K} + ${q2} = ${answer}`,
    ],
  };
}