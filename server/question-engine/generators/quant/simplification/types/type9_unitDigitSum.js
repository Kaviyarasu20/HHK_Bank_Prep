// generators/quant/simplification/types/type9_unitDigitSum.js
import { randInt, shuffle } from "../../../../core/mathUtils.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType9UnitDigitSum(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].unitDigitSum;

  const t1 = randInt(cfg.minVal, cfg.maxVal);
  const t2 = randInt(cfg.minVal, cfg.maxVal);
  const t3 = randInt(Math.floor(cfg.minVal / 2), Math.floor((t1 + t2) * 0.6));
  const t4 = randInt(cfg.minVal, cfg.maxVal);

  const answer = t1 + t2 - t3 + t4;
  const distractors = new Set();

  if (cfg.distinctUnitDigits) {
    // Ensure all 5 options have different unit digits for unit-digit speed drills
    const usedUnits = new Set([answer % 10]);
    while (distractors.size < 4) {
      const delta = randInt(-40, 40);
      const cand = answer + delta;
      const unit = ((cand % 10) + 10) % 10;
      if (cand > 0 && !usedUnits.has(unit)) {
        usedUnits.add(unit);
        distractors.add(String(cand));
      }
    }
  } else {
    // HARD: Keep unit digit identical on distractors to force tens-digit / digital-sum check
    const offsets = [-200, -100, -30, -20, -10, 10, 20, 30, 100, 200];
    while (distractors.size < 4) {
      const cand = answer + offsets[randInt(0, offsets.length - 1)];
      if (cand > 0 && cand !== answer) {
        distractors.add(String(cand));
      }
    }
  }

  const options = shuffle([String(answer), ...distractors]);

  return {
    questionId: `SIMP_T9_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_9_UNIT_DIGIT_SUM",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${t1} + ${t2} - ${t3} + ${t4} = ?`,
    options,
    correctOptionIndex: options.indexOf(String(answer)),
    answer: String(answer),
    solutionSteps: [
      `Unit digit check: (${t1 % 10} + ${t2 % 10} - ${t3 % 10} + ${t4 % 10}) ends in ${answer % 10}`,
      `Exact calculation: ${t1} + ${t2} - ${t3} + ${t4} = ${answer}`,
    ],
  };
}