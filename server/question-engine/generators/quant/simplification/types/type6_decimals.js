// generators/quant/simplification/types/type6_decimals.js
import { randInt } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType6Decimals(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].decimals;
  const scale = Math.pow(10, cfg.decimalPlaces);
  const d = randInt(2, cfg.maxDigit);

  // Create classic repeating-digit place-value traps (e.g., 6.66, 66.06, 0.666)
  const rawPatterns =
    cfg.decimalPlaces === 2
      ? [`${d}.${d}${d}`, `${d}${d}.0${d}`, `0.${d}${d}`, `${d}.0${d}`]
      : [`${d}.${d}${d}`, `0.${d}0${d}`, `${d}${d}.00${d}`, `${d}.${d}${d}${d}`, `0.0${d}${d}`];

  const selected = rawPatterns.slice(0, cfg.termCount);
  const scaledValues = selected.map((str) => Math.round( parseFloat(str) * scale ));

  let totalScaled = 0;
  const exprParts = [];

  scaledValues.forEach((val, idx) => {
    if (idx === scaledValues.length - 1 && difficulty === "HARD") {
      // Subtract the smallest term on HARD
      totalScaled -= val;
      exprParts.push(`- ${selected[idx]}`);
    } else {
      totalScaled += val;
      exprParts.push(idx === 0 ? selected[idx] : `+ ${selected[idx]}`);
    }
  });

  const answerNum = totalScaled / scale;
  const answerStr = answerNum.toFixed(cfg.decimalPlaces);
  const { options, correctOptionIndex } = buildOptions(
    answerNum,
    "DECIMAL",
    SIMPLIFICATION_PROFILES[difficulty].distractorOffsets,
    cfg.decimalPlaces
  );

  return {
    questionId: `SIMP_T6_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_6_DECIMALS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${exprParts.join(" ")} = ?`,
    options,
    correctOptionIndex,
    answer: answerStr,
    solutionSteps: [
      `Align decimal points vertically to ${cfg.decimalPlaces} decimal places`,
      `${exprParts.join(" ")} = ${answerStr}`,
    ],
  };
}