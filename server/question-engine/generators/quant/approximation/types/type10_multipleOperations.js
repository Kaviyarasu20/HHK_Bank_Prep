// generators/quant/approximation/types/type10_multipleOperations.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";

export function generateApproxType10(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const B = randInt(8, 22);
  const q1 = randInt(15, 55);
  const A = B * q1;
  const C = randInt(12, 38);
  const D = randInt(3, 11);

  if (difficulty === "EASY") {
    const answer = q1 + C * D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T10_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_10_MULTIPLE_OPERATIONS",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(A, 1)} ÷ ${perturbInt(B, 1)} + ${perturbInt(C, 1)} × ${perturbInt(D, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} ÷ ${B}) + (${C} × ${D})`,
        `${q1} + ${C * D} = ${answer}`,
      ],
    };
  }

  const F = randInt(6, 16);
  const q2 = randInt(8, 25);
  const E = F * q2;

  if (difficulty === "MEDIUM") {
    const answer = q1 + C * D - q2;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T10_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_10_MULTIPLE_OPERATIONS",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(A, 1)} ÷ ${perturbInt(B, 1)} + ${perturbInt(C, 1)} × ${perturbInt(D, 2)} - ${perturbInt(E, 2)} ÷ ${perturbInt(F, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} ÷ ${B}) + (${C} × ${D}) - (${E} ÷ ${F})`,
        `${q1} + ${C * D} - ${q2} = ${answer}`,
      ],
    };
  }

  // HARD: A ÷ B × K + C × D - E ÷ F ≈ ?
  const K = randInt(3, 8);
  const answer = q1 * K + C * D - q2;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T10_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_10_MULTIPLE_OPERATIONS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${perturbInt(A, 2)} ÷ ${perturbInt(B, 1)} × ${perturbInt(K, 2)} + ${perturbInt(C, 2)} × ${perturbInt(D, 1)} - ${perturbInt(E, 2)} ÷ ${perturbInt(F, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round terms: (${A} ÷ ${B}) × ${K} + (${C} × ${D}) - (${E} ÷ ${F})`,
      `(${q1} × ${K}) + ${C * D} - ${q2} = ${q1 * K} + ${C * D} - ${q2} = ${answer}`,
    ],
  };
}