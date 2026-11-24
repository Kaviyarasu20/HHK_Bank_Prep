// generators/quant/simplification/types/type1_vbodmas.js
import { randInt } from "../../../../core/mathUtils.js";
import { buildOptions } from "../../../../core/distractorEngine.js";
import { SIMPLIFICATION_PROFILES } from "../../../../config/difficultyProfiles.js";

export function generateType1VBODMAS(exam = "IBPS_CLERK_PRELIMS", difficulty = "MEDIUM") {
  const cfg = SIMPLIFICATION_PROFILES[difficulty].vbodmas;
  const offsets = SIMPLIFICATION_PROFILES[difficulty].distractorOffsets;

  const C = randInt(...cfg.divisorRange);
  const quotient = randInt(...cfg.quotientRange);
  const B = C * quotient;

  const D = randInt(...cfg.multiplierRange);
  const prodTerm = quotient * D;

  const F = randInt(5, 25);
  const E = F + randInt(6, 30);
  const bracketVal = E - F;

  const minA = Math.max(100, bracketVal - prodTerm + 40);
  const A = randInt(minA, minA + (difficulty === "EASY" ? 400 : 1500));

  const answer = A + prodTerm - bracketVal;
  const { options, correctOptionIndex } = buildOptions(answer, "INTEGER", offsets);

  const bracketStr = cfg.useVinculum ? `(${E} - ${F})` : `${E} - ${F}`;

  return {
    questionId: `SIMP_T1_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Simplification",
    subType: "TYPE_1_VBODMAS",
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `${A} + ${B} ÷ ${C} × ${D} - ${bracketStr} = ?`,
    options,
    correctOptionIndex,
    answer: String(answer),
    solutionSteps: [
      `Step 1 (Bracket): ${E} - ${F} = ${bracketVal}`,
      `Step 2 (Division): ${B} ÷ ${C} = ${quotient}`,
      `Step 3 (Multiplication): ${quotient} × ${D} = ${prodTerm}`,
      `Step 4 (Addition & Subtraction): ${A} + ${prodTerm} - ${bracketVal} = ${answer}`,
    ],
  };
}