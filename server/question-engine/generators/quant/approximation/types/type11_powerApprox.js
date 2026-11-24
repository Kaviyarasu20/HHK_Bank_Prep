// generators/quant/approximation/types/type11_powerApprox.js
import { randInt, pickRandom } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";

export function generateApproxType11(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const B = pickRandom([4, 5, 8, 10, 12, 15, 16, 20]);
  const mult = randInt(2, 5);
  const A = B * mult; // Guarantees A² is cleanly divisible by B
  const q = (A * A) / B;

  if (difficulty === "EASY") {
    const C = randInt(15, 75);
    const answer = q + C;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T11_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_11_POWER_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)})² ÷ ${perturbInt(B, 1)} + ${perturbInt(C, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round bases: (${A}² ÷ ${B}) + ${C}`,
        `(${A * A} ÷ ${B}) + ${C} = ${q} + ${C} = ${answer}`,
      ],
    };
  }

  const C = randInt(11, 26);
  const D = randInt(25, 110);

  if (difficulty === "MEDIUM") {
    const answer = q + C * C - D;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T11_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_11_POWER_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${perturbInt(A, 1)})² ÷ ${perturbInt(B, 1)} + (${perturbInt(C, 2)})² - ${perturbInt(D, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round bases: (${A}² ÷ ${B}) + ${C}² - ${D}`,
        `(${A * A} ÷ ${B}) + ${C * C} - ${D} = ${q} + ${C * C} - ${D} = ${answer}`,
      ],
    };
  }

  // HARD: A² ÷ B + E³ - C² ≈ ?
  const E = randInt(6, 12);
  const answer = q + E * E * E - C * C;
  const finalAns = answer > 20 ? answer : q + E * E * E + C * C;
  const sign = answer > 20 ? "-" : "+";
  const { options, correctOptionIndex } = buildApproxOptions(finalAns, difficulty);

  return {
    questionId: `APP_T11_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_11_POWER_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `(${perturbInt(A, 2)})² ÷ ${perturbInt(B, 2)} + (${perturbInt(E, 2)})³ ${sign} (${perturbInt(C, 1)})² ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(finalAns),
    solutionSteps: [
      `Round bases: (${A}² ÷ ${B}) + ${E}³ ${sign} ${C}²`,
      `${q} + ${E * E * E} ${sign} ${C * C} = ${finalAns}`,
    ],
  };
}