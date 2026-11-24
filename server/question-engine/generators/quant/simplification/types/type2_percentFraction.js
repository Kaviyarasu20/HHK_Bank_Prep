// generators/quant/simplification/types/type2_percentFraction.js
import { randInt, pickRandom } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { PERCENT_FRACTIONS } from "../data/fractionTable.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType2PercentFraction(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].percentFraction;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;
  const pool = PERCENT_FRACTIONS.filter((f) => cfg.allowedTiers.includes(f.tier));

  const f1 = pickRandom(pool);
  const f2 = pickRandom(pool);
  const N1 = f1.den * randInt(...cfg.multiplierRange);
  const N2 = f2.den * randInt(...cfg.multiplierRange);
  const val1 = (f1.num * N1) / f1.den;
  const val2 = (f2.num * N2) / f2.den;

  if (cfg.termCount === 2) {
    const answer = val1 + val2;
    const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);
    return {
      questionId: `SIMP_T2_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
      exam,
      topic: "Simplification",
      subType: "TYPE_2_PERCENT_FRACTION",
      difficulty,
      generationMode: "RULE_ENGINE",
      questionText: `${f1.pct} of ${N1} + ${f2.pct} of ${N2} = ?`,
      options,
      correctOptionIndex,
      answer: String(answer),
      solutionSteps: [
        `${f1.pct} of ${N1} = (${f1.num}/${f1.den}) × ${N1} = ${val1}`,
        `${f2.pct} of ${N2} = (${f2.num}/${f2.den}) × ${N2} = ${val2}`,
        `${val1} + ${val2} = ${answer}`,
      ],
    };
  }

  const f3 = pickRandom(pool);
  const maxMult3 = Math.max(5, Math.floor((val1 + val2 - 10) / f3.num));
  const N3 = f3.den * randInt(5, Math.min(cfg.multiplierRange[1], maxMult3));
  const val3 = (f3.num * N3) / f3.den;
  const answer = val1 + val2 - val3;
  const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

  return {
    questionId: `SIMP_T2_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_2_PERCENT_FRACTION",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${f1.pct} of ${N1} + ${f2.pct} of ${N2} - ${f3.pct} of ${N3} = ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `${f1.pct} of ${N1} = (${f1.num}/${f1.den}) × ${N1} = ${val1}`,
      `${f2.pct} of ${N2} = (${f2.num}/${f2.den}) × ${N2} = ${val2}`,
      `${f3.pct} of ${N3} = (${f3.num}/${f3.den}) × ${N3} = ${val3}`,
      `${val1} + ${val2} - ${val3} = ${answer}`,
    ],
  };
}