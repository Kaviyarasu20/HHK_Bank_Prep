// generators/quant/approximation/types/type1_basicArithmetic.js
import { randInt } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType1(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const A = randInt(...cfg.addRange);
  const B = randInt(...cfg.multA);
  const C = randInt(...cfg.multB);

  const pA = perturbInt(A, 1);
  const pB = perturbInt(B, 1);
  const pC = perturbInt(C, 2);

  if (difficulty === "EASY") {
    const answer = A + B * C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);
    return {
      questionId: `APP_T1_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_1_BASIC_ARITHMETIC",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} + ${pB} × ${pC} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round to nearest integers: ${A} + ${B} × ${C}`,
        `Apply BODMAS: ${A} + ${B * C} = ${answer}`,
      ],
    };
  }

  const D = randInt(20, Math.min(180, A + B * C - 30));
  const pD = perturbInt(D, 2);

  if (difficulty === "MEDIUM") {
    const answer = A + B * C - D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);
    return {
      questionId: `APP_T1_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_1_BASIC_ARITHMETIC",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${pA} + ${pB} × ${pC} - ${pD} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round to nearest integers: ${A} + ${B} × ${C} - ${D}`,
        `Multiply first: ${A} + ${B * C} - ${D} = ${answer}`,
      ],
    };
  }

  // HARD: A + B × C ± D × E ≈ ?
  const E = randInt(3, 9);
  const pE = perturbInt(E, 1);
  const rawAns = A + B * C - D * E;
  const useMinus = rawAns > 25;
  const answer = useMinus ? rawAns : A + B * C + D * E;
  const sign = useMinus ? "-" : "+";
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T1_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_1_BASIC_ARITHMETIC",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${pA} + ${pB} × ${pC} ${sign} ${pD} × ${pE} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round to nearest integers: ${A} + (${B} × ${C}) ${sign} (${D} × ${E})`,
      `Calculate products: ${A} + ${B * C} ${sign} ${D * E} = ${answer}`,
    ],
  };
}