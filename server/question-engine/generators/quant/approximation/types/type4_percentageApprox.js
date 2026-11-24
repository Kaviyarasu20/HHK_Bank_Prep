// generators/quant/approximation/types/type4_percentageApprox.js
import { randInt, pickRandom } from "../../../../core/mathUtils.js";
import { perturbInt, buildApproxOptions } from "../../../../core/approxUtils.js";
import { APPROXIMATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateApproxType4(exam = "IBPS_PO_PRELIMS", difficulty = "MEDIUM") {
  const cfg = APPROXIMATION_PROFILES[difficulty];
  const P1 = pickRandom(cfg.pctPool);
  const N1 = randInt(2, 12) * 100;
  const val1 = (P1 * N1) / 100;

  if (difficulty === "EASY") {
    const K = randInt(25, 120);
    const answer = val1 + K;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T4_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_4_PERCENTAGE_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(P1, 1)}% of ${perturbInt(N1, 2)} + ${perturbInt(K, 1)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round percentage and base: (${P1}% of ${N1}) + ${K}`,
        `${val1} + ${K} = ${answer}`,
      ],
    };
  }

  const P2 = pickRandom(cfg.pctPool);
  const N2 = randInt(2, 10) * 100;
  const val2 = (P2 * N2) / 100;

  if (difficulty === "MEDIUM") {
    const K = randInt(30, 110);
    const answer = val1 + val2 - K;
    const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

    return {
      questionId: `APP_T4_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Approximation",
      subType: "TYPE_4_PERCENTAGE_APPROX",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${perturbInt(P1, 2)}% of ${perturbInt(N1, 2)} + ${perturbInt(P2, 1)}% of ${perturbInt(N2, 2)} - ${perturbInt(K, 2)} ≈ ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Round values: (${P1}% of ${N1}) + (${P2}% of ${N2}) - ${K}`,
        `${val1} + ${val2} - ${K} = ${answer}`,
      ],
    };
  }

  // HARD: 3 percentage terms
  const P3 = pickRandom([10, 15, 20, 25]);
  const N3 = randInt(2, 6) * 100;
  const val3 = (P3 * N3) / 100;
  const answer = val1 + val2 + val3;
  const { options, correctOptionIndex } = buildApproxOptions(answer, difficulty);

  return {
    questionId: `APP_T4_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Approximation",
    subType: "TYPE_4_PERCENTAGE_APPROX",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${perturbInt(P1, 2)}% of ${perturbInt(N1, 1)} + ${perturbInt(P2, 2)}% of ${perturbInt(N2, 2)} + ${perturbInt(P3, 1)}% of ${perturbInt(N3, 2)} ≈ ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Round values: (${P1}% of ${N1}) + (${P2}% of ${N2}) + (${P3}% of ${N3})`,
      `${val1} + ${val2} + ${val3} = ${answer}`,
    ],
  };
}