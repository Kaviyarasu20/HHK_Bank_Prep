// generators/quant/approximation/types/type8_mixedArithmetic.js
import { randInt, pickRandom } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType8(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const A = randInt(...cfg.multA);
  const B = randInt(...cfg.multB);
  const C = randInt(80, 420);

  if (difficulty === "EASY") {
    const answer = A * B + C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T8_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_8_MIXED_ARITHMETIC",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(A, 1)} × ${perturbInt(B, 1)} + ${perturbInt(C, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} × ${B}) + ${C}`,
        `${A * B} + ${C} = ${answer}`,
      ],
    };
  }

  const D = randInt(8, 22);
  const E = randInt(3, 8);

  if (difficulty === "MEDIUM") {
    const answer = A * B + C - D * E;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T8_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_8_MIXED_ARITHMETIC",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(A, 1)} × ${perturbInt(B, 1)} + ${perturbInt(C, 2)} - ${perturbInt(D, 2)} × ${perturbInt(E, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round terms: (${A} × ${B}) + ${C} - (${D} × ${E})`,
        `${A * B} + ${C} - ${D * E} = ${answer}`,
      ],
    };
  }

  // HARD: A × B + P% of N - D × E ≈ ?
  const P = pickRandom([20, 25, 30, 40, 50]);
  const N = randInt(3, 9) * 100;
  const pctVal = (P * N) / 100;
  const answer = A * B + pctVal - D * E;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T8_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_8_MIXED_ARITHMETIC",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${perturbInt(A, 2)} × ${perturbInt(B, 1)} + ${perturbInt(P, 2)}% of ${perturbInt(N, 2)} - ${perturbInt(D, 1)} × ${perturbInt(E, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round terms: (${A} × ${B}) + (${P}% of ${N}) - (${D} × ${E})`,
      `${A * B} + ${pctVal} - ${D * E} = ${answer}`,
    ],
  };
}