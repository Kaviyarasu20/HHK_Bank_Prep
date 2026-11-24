// generators/quant/simplification/types/type3_mixedFractions.js
import { randInt, pickRandom, Fraction } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

function createMixed(wholeRange, denominators) {
  const den = pickRandom(denominators);
  const num = randInt(1, den - 1);
  const whole = randInt(...wholeRange);
  return {
    display: `${whole} ${num}/${den}`,
    whole,
    fracPart: new Fraction(num, den),
    totalFrac: new Fraction(whole * den + num, den),
  };
}

export function generateType3MixedFractions(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].mixedFractions;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;

  const m1 = createMixed(cfg.wholeRange, cfg.denominators);
  const m2 = createMixed(cfg.wholeRange, cfg.denominators);

  if (cfg.termCount === 2) {
    const res = m1.totalFrac.add(m2.totalFrac);
    const type = res.isInteger() ? "INTEGER" : "FRACTION";
    const { options, correctOptionIndex } = buildOptions(res.isInteger() ? res.num : res, type, offsets);
    return {
      questionId: `SIMP_T3_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_3_MIXED_FRACTIONS",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${m1.display} + ${m2.display} = ?`,
      options,
      correctOptionIndex,
      answer: res.toExamString(),
      solutionSteps: [
        `Whole numbers: ${m1.whole} + ${m2.whole} = ${m1.whole + m2.whole}`,
        `Fractions: ${m1.fracPart.toExamString()} + ${m2.fracPart.toExamString()} = ${m1.fracPart.add(m2.fracPart).toExamString()}`,
        `Total = ${res.toExamString()}`,
      ],
    };
  }

  const maxW3 = Math.max(1, m1.whole + m2.whole - 3);
  const m3 = createMixed([1, maxW3], cfg.denominators);
  const res = m1.totalFrac.add(m2.totalFrac).sub(m3.totalFrac);
  const type = res.isInteger() ? "INTEGER" : "FRACTION";
  const { options, correctOptionIndex } = buildOptions(res.isInteger() ? res.num : res, type, offsets);

  return {
    questionId: `SIMP_T3_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_3_MIXED_FRACTIONS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${m1.display} + ${m2.display} - ${m3.display} = ?`,
    options,
    correctOptionIndex,
    answer: res.toExamString(),
    solutionSteps: [
      `Whole numbers: ${m1.whole} + ${m2.whole} - ${m3.whole} = ${m1.whole + m2.whole - m3.whole}`,
      `Fractions: ${m1.fracPart.toExamString()} + ${m2.fracPart.toExamString()} - ${m3.fracPart.toExamString()} = ${m1.fracPart.add(m2.fracPart).sub(m3.fracPart).toExamString()}`,
      `Total = ${res.toExamString()}`,
    ],
  };
}