// generators/quant/approximation/types/type9_bracketApprox.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";

export function generateApproxType9(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const A = randInt(25, 85);
  const B = randInt(15, 65);
  const C = randInt(4, 12);

  if (difficulty === "EASY") {
    const answer = (A + B) * C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T9_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_9_BRACKET_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)} + ${perturbInt(B, 1)}) × ${perturbInt(C, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round inside bracket first: (${A} + ${B}) × ${C}`,
        `${A + B} × ${C} = ${answer}`,
      ],
    };
  }

  const E = randInt(6, 18);
  const q = randInt(10, 35);
  const D = E * q;

  if (difficulty === "MEDIUM") {
    const answer = (A + B) * C - q;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T9_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_9_BRACKET_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)} + ${perturbInt(B, 2)}) × ${perturbInt(C, 2)} - (${perturbInt(D, 1)} ÷ ${perturbInt(E, 2)}) ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Solve brackets first: (${A} + ${B}) × ${C} - (${D} ÷ ${E})`,
        `(${A + B} × ${C}) - ${q} = ${(A + B) * C} - ${q} = ${answer}`,
      ],
    };
  }

  // HARD: ((A + B) × C) + ((D - F) ÷ E) ≈ ?
  const F = randInt(10, 40);
  const D_hard = E * q + F;
  const answer = (A + B) * C + q;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T9_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_9_BRACKET_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `(${perturbInt(A, 2)} + ${perturbInt(B, 1)}) × ${perturbInt(C, 2)} + (${perturbInt(D_hard, 2)} - ${perturbInt(F, 1)}) ÷ ${perturbInt(E, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Brackets first: (${A} + ${B}) × ${C} + (${D_hard} - ${F}) ÷ ${E}`,
      `(${A + B} × ${C}) + (${D_hard - F} ÷ ${E}) = ${(A + B) * C} + ${q} = ${answer}`,
    ],
  };
}