// generators/quant/simplification/types/type5_surdsIndices.js
import { randInt, pickRandom } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType5SurdsIndices(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].surdsIndices;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;
  const base = pickRandom(cfg.bases);

  const p1 = pickRandom([2, 3]);
  const p2 = pickRandom([2, 3]);

  if (cfg.exponentMode === "INTEGER") {
    const p3 = pickRandom([1, 2]);
    const e1 = randInt(2, 5);
    const e2 = randInt(2, 5);
    const e3 = randInt(1, 3);
    const answer = p1 * e1 + p2 * e2 - p3 * e3;
    const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

    return {
      questionId: `SIMP_T5_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_5_SURDS_INDICES",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `(${Math.pow(base, p1)})^${e1} × (${Math.pow(base, p2)})^${e2} ÷ (${Math.pow(base, p3)})^${e3} = ${base}^?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `Convert to base ${base}: ${base}^(${p1}×${e1}) × ${base}^(${p2}×${e2}) ÷ ${base}^(${p3}×${e3})`,
        `? = ${p1 * e1} + ${p2 * e2} - ${p3 * e3} = ${answer}`,
      ],
    };
  }

  // Decimal exponent mode: deterministic construction without recursion
  const e1Tenths = randInt(11, 24);
  const e2Tenths = randInt(11, 22);
  const sumTenths = p1 * e1Tenths + p2 * e2Tenths;
  const targetAnswer = randInt(3, Math.max(4, Math.floor(sumTenths / 10) - 1));
  const e3Tenths = sumTenths - targetAnswer * 10;
  const { options, correctOptionIndex } = buildOptions(targetAnswer, "INTEGER", offsets);

  return {
    questionId: `SIMP_T5_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_5_SURDS_INDICES",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `(${Math.pow(base, p1)})^${(e1Tenths / 10).toFixed(1)} × (${Math.pow(base, p2)})^${(e2Tenths / 10).toFixed(1)} ÷ (${base})^${(e3Tenths / 10).toFixed(1)} = ${base}^?`,
    options,
    correctOptionIndex,
    answer: String(targetAnswer),
    solutionSteps: [
      `Convert each factor to base ${base}: (${p1} × ${(e1Tenths / 10).toFixed(1)}) + (${p2} × ${(e2Tenths / 10).toFixed(1)}) - ${(e3Tenths / 10).toFixed(1)}`,
      `? = ${(p1 * e1Tenths) / 10} + ${(p2 * e2Tenths) / 10} - ${e3Tenths / 10} = ${targetAnswer}`,
    ],
  };
}