// generators/quant/simplification/types/type8_ladderFractions.js
import { randInt, Fraction } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType8LadderFractions(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].ladderFractions;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;

  const baseDen = randInt(2, cfg.maxDen);
  const baseNum = randInt(1, baseDen - 1);
  const w1 = randInt(1, cfg.maxWhole);
  const w2 = randInt(1, cfg.maxWhole);

  // Step 1 (bottom): w1 + baseNum/baseDen
  const step1 = new Fraction(w1).add(new Fraction(baseNum, baseDen));
  // Invert: 1 / step1
  const inv1 = new Fraction(1).div(step1);
  // Step 2: w2 + inv1
  const step2 = new Fraction(w2).add(inv1);

  if (cfg.steps === 2) {
    const { options, correctOptionIndex } = buildOptions(step2, "FRACTION", offsets);
    return {
      questionId: `SIMP_T8_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_8_LADDER_FRACTIONS",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${w2} + 1 / (${w1} + ${baseNum}/${baseDen}) = ?`,
      options,
      correctOptionIndex,
      answer: step2.toExamString(),
      solutionSteps: [
        `Bottom rung: ${w1} + ${baseNum}/${baseDen} = ${step1.num}/${step1.den}`,
        `Reciprocal: 1 ÷ (${step1.num}/${step1.den}) = ${inv1.num}/${inv1.den}`,
        `Add ${w2}: ${w2} + ${inv1.num}/${inv1.den} = ${step2.toExamString()}`,
      ],
    };
  }

  const w3 = randInt(1, cfg.maxWhole);
  const inv2 = new Fraction(1).div(step2);
  const step3 = new Fraction(w3).add(inv2);
  const { options, correctOptionIndex } = buildOptions(step3, "FRACTION", offsets);

  return {
    questionId: `SIMP_T8_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_8_LADDER_FRACTIONS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${w3} + 1 / (${w2} + 1 / (${w1} + ${baseNum}/${baseDen})) = ?`,
    options,
    correctOptionIndex,
    answer: step3.toExamString(),
    solutionSteps: [
      `Bottom rung: ${w1} + ${baseNum}/${baseDen} = ${step1.num}/${step1.den}`,
      `Middle rung: ${w2} + ${inv1.num}/${inv1.den} = ${step2.num}/${step2.den}`,
      `Top rung: ${w3} + ${inv2.num}/${inv2.den} = ${step3.toExamString()}`,
    ],
  };
}