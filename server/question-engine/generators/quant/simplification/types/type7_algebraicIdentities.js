// generators/quant/simplification/types/type7_algebraicIdentities.js
import { randInt } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType7AlgebraicIdentities(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].algebraicIdentities;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;

  const a = randInt(...cfg.rangeA);
  const b = randInt(...cfg.rangeB);

  if (cfg.pattern === "DIFF_OF_SQUARES") {
    // (a² - b²) ÷ (a - b) = a + b
    const diff = a - b;
    const answer = a + b;
    const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

    return {
      questionId: `SIMP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_7_ALGEBRAIC_IDENTITIES",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${a}² - ${b}²) ÷ ${diff} = ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Use identity: (a² - b²) ÷ (a - b) = a + b`,
        `Here a = ${a}, b = ${b}, and (a - b) = ${diff}`,
        `? = ${a} + ${b} = ${answer}`,
      ],
    };
  }

  if (cfg.pattern === "SUM_OF_CUBES") {
    // (a³ + b³) / (a² - ab + b²) = a + b
    const answer = a + b;
    const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

    return {
      questionId: `SIMP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_7_ALGEBRAIC_IDENTITIES",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${a} × ${a} × ${a} + ${b} × ${b} × ${b}) ÷ (${a}² - ${a} × ${b} + ${b}²) = ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Use identity: (a³ + b³) ÷ (a² - ab + b²) = a + b`,
        `? = ${a} + ${b} = ${answer}`,
      ],
    };
  }

  // HARD: (a³ - b³) ÷ (a² + ab + b²) + c² = ?
  const c = randInt(11, 25);
  const answer = a - b + c * c;
  const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

  return {
    questionId: `SIMP_T7_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_7_ALGEBRAIC_IDENTITIES",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `[ (${a}³ - ${b}³) ÷ (${a}² + ${a} × ${b} + ${b}²) ] + ${c}² = ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Use identity: (a³ - b³) ÷ (a² + ab + b²) = a - b = ${a} - ${b} = ${a - b}`,
      `Add ${c}² (${c * c}): ${a - b} + ${c * c} = ${answer}`,
    ],
  };
}