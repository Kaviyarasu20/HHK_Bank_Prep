// generators/quant/approximation/types/type5_fractionApprox.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";

export function generateApproxType5(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const B = randInt(6, 18);
  const q1 = randInt(8, 25);
  const A = B * q1;
  const C = randInt(4, 15);

  if (difficulty === "EASY") {
    const D = randInt(15, 75);
    const answer = q1 * C + D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T5_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_5_FRACTION_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)} / ${perturbInt(B, 2)}) × ${perturbInt(C, 1)} + ${perturbInt(D, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round fraction: (${A} / ${B}) × ${C} + ${D}`,
        `(${q1} × ${C}) + ${D} = ${q1 * C} + ${D} = ${answer}`,
      ],
    };
  }

  const E = randInt(5, 16);
  const q2 = randInt(6, 22);
  const D = E * q2;
  const F = randInt(3, 12);

  if (difficulty === "MEDIUM") {
    const answer = q1 * C + q2 * F;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T5_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_5_FRACTION_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)} / ${perturbInt(B, 2)}) × ${perturbInt(C, 2)} + (${perturbInt(D, 2)} / ${perturbInt(E, 1)}) × ${perturbInt(F, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Approximate fractions: (${A} / ${B}) × ${C} + (${D} / ${E}) × ${F}`,
        `(${q1} × ${C}) + (${q2} × ${F}) = ${q1 * C} + ${q2 * F} = ${answer}`,
      ],
    };
  }

  // HARD: Add a third subtracted fraction term
  const K = randInt(25, 85);
  const answer = q1 * C + q2 * F - K;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T5_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_5_FRACTION_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `(${perturbInt(A, 2)} / ${perturbInt(B, 2)}) × ${perturbInt(C, 1)} + (${perturbInt(D, 1)} / ${perturbInt(E, 2)}) × ${perturbInt(F, 1)} - ${perturbInt(K, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Approximate terms: (${A} / ${B}) × ${C} + (${D} / ${E}) × ${F} - ${K}`,
      `${q1 * C} + ${q2 * F} - ${K} = ${answer}`,
    ],
  };
}