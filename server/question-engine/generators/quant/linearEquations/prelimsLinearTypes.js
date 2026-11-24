// Place at: server/question-engine/generators/quant/linearEquations/prelimsLinearTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildOptions } from "../../../core/distractorEngine.js";

export const COMPARISON_OPTIONS = [
  "x > y",
  "x ≥ y",
  "x < y",
  "x ≤ y",
  "x = y or the relationship cannot be established",
];

export function compareSingleValues(x, y) {
  if (x > y) return 0; // x > y
  if (x < y) return 2; // x < y
  return 4;            // x = y
}

/**
 * Formats a linear expression a*x + b*y cleanly (e.g., "3x - 2y", "x + 4y", "-2x + y").
 */
export function formatLinearExpr(a, b, v1 = "x", v2 = "y") {
  const part1 =
    a === 1 ? v1 : a === -1 ? `-${v1}` : `${a}${v1}`;
  const absB = Math.abs(b);
  const signB = b >= 0 ? "+" : "-";
  const part2 = absB === 1 ? `${signB} ${v2}` : `${signB} ${absB}${v2}`;
  return `${part1} ${part2}`;
}

/**
 * Picks two independent coefficient pairs (a1, b1) and (a2, b2)
 * guaranteeing det = a1*b2 - a2*b1 !== 0 (unique solution).
 */
export function pickIndependent2x2(minC, maxC, allowNegative = false) {
  const pickCoeff = () => {
    let v = randInt(minC, maxC);
    if (allowNegative && Math.random() < 0.45) v = -v;
    return v === 0 ? 1 : v;
  };
  let a1, b1, a2, b2;
  let guard = 0;
  do {
    a1 = pickCoeff();
    b1 = pickCoeff();
    a2 = pickCoeff();
    b2 = pickCoeff();
    guard++;
  } while (a1 * b2 - a2 * b1 === 0 && guard < 100);
  if (a1 * b2 - a2 * b1 === 0) {
    a1 = 2; b1 = 3; a2 = 3; b2 = -2;
  }
  return { a1, b1, a2, b2 };
}

function makeComparisonQuestion({
  exam,
  difficulty,
  subType,
  eq1,
  eq2,
  x,
  y,
  extraSteps = [],
}) {
  const idx = compareSingleValues(x, y);
  return {
    questionId: `LIN_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Linear Simultaneous Equations",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `In the following question, two equations I and II are given. Solve both equations and choose the correct relationship:\nI. ${eq1}\nII. ${eq2}`,
    options: [...COMPARISON_OPTIONS],
    correctOptionIndex: idx,
    answer: COMPARISON_OPTIONS[idx],
    solutionSteps: [
      ...extraSteps,
      `Solving I and II gives x = ${x} and y = ${y}`,
      `Comparing x (${x}) and y (${y}): ${COMPARISON_OPTIONS[idx]}`,
    ],
  };
}

function makeValueQuestion({
  exam,
  difficulty,
  subType,
  eq1,
  eq2,
  askText,
  answerVal,
  optionType = "INTEGER",
  x,
  y,
  extraSteps = [],
}) {
  const offsets =
    difficulty === "EASY"
      ? [-10, -6, -4, -2, 2, 4, 6, 10]
      : difficulty === "HARD"
      ? [-4, -3, -2, -1, 1, 2, 3, 4]
      : [-8, -5, -3, -1, 1, 3, 5, 8];

  const { options, correctOptionIndex } = buildOptions(answerVal, optionType, offsets);
  const ansStr = optionType === "FRACTION" ? answerVal.toExamString() : String(answerVal);

  return {
    questionId: `LIN_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Linear Simultaneous Equations",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `Solve the following simultaneous equations and find the value of ${askText}:\nI. ${eq1}\nII. ${eq2}`,
    options,
    correctOptionIndex,
    answer: ansStr,
    solutionSteps: [
      ...extraSteps,
      `Solving I and II gives x = ${x} and y = ${y}`,
      `Therefore, ${askText} = ${ansStr}`,
    ],
  };
}

// 1. Direct Linear Equations (Two Variables)
export function prelimsType1Direct(exam, difficulty) {
  const x = randInt(2, 14);
  const y = randInt(2, 14);
  const { a1, b1, a2, b2 } = pickIndependent2x2(1, 5, false);
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T1_DIRECT_LINEAR",
    eq1: `${formatLinearExpr(a1, b1)} = ${c1}`,
    eq2: `${formatLinearExpr(a2, b2)} = ${c2}`,
    x, y,
  });
}

// 2. Simple Simultaneous Equations (x + y = S, x - y = D)
export function prelimsType2Simple(exam, difficulty) {
  const x = randInt(4, 22);
  const y = randInt(2, 20);
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T2_SIMPLE_SIMULTANEOUS",
    eq1: `x + y = ${x + y}`,
    eq2: `x - y = ${x - y}`,
    x, y,
    extraSteps: [`Add both equations: 2x = ${2 * x} ⇒ x = ${x}`],
  });
}

// 3. Equations with Integer Coefficients
export function prelimsType3IntegerCoeff(exam, difficulty) {
  const x = randInt(3, 15);
  const y = randInt(3, 15);
  const { a1, b1, a2, b2 } = pickIndependent2x2(3, 11, false);
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T3_INTEGER_COEFF",
    eq1: `${formatLinearExpr(a1, b1)} = ${c1}`,
    eq2: `${formatLinearExpr(a2, b2)} = ${c2}`,
    x, y,
  });
}

// 4. Equations with Fractional Coefficients
export function prelimsType4FractionalCoeff(exam, difficulty) {
  const d1 = pickRandom([2, 3, 4, 5]);
  const d2 = pickRandom([2, 3, 4, 5]);
  const x = d1 * randInt(2, 6);
  const y = d2 * randInt(2, 6);
  const p1 = randInt(1, 3), q1 = randInt(1, 3);
  const p2 = p1 + 1, q2 = randInt(1, 3);
  const c1 = (p1 * x) / d1 + (q1 * y) / d2;
  const c2 = (p2 * x) / d1 - (q2 * y) / d2;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T4_FRACTIONAL_COEFF",
    eq1: `(${p1}/${d1})x + (${q1}/${d2})y = ${c1}`,
    eq2: `(${p2}/${d1})x - (${q2}/${d2})y = ${c2}`,
    x, y,
    extraSteps: [`Multiply by LCM(${d1}, ${d2}) to clear fractions`],
  });
}

// 5. Equations with Decimal Coefficients
export function prelimsType5DecimalCoeff(exam, difficulty) {
  const x = randInt(2, 12);
  const y = randInt(2, 12);
  const a1T = pickRandom([5, 12, 15, 25]); // tenths -> 0.5, 1.2, 1.5, 2.5
  const b1T = pickRandom([4, 8, 15, 20]);
  const a2T = pickRandom([6, 15, 20, 35]);
  const b2T = -pickRandom([5, 10, 12, 15]);
  const c1 = (a1T * x + b1T * y) / 10;
  const c2 = (a2T * x + b2T * y) / 10;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T5_DECIMAL_COEFF",
    eq1: `${(a1T / 10).toFixed(1)}x + ${(b1T / 10).toFixed(1)}y = ${Number(c1.toFixed(1))}`,
    eq2: `${(a2T / 10).toFixed(1)}x - ${(Math.abs(b2T) / 10).toFixed(1)}y = ${Number(c2.toFixed(1))}`,
    x, y,
    extraSteps: [`Multiply both equations by 10 to convert decimals to integers`],
  });
}

// 6. Equations with Brackets
export function prelimsType6Brackets(exam, difficulty) {
  const x = randInt(3, 12);
  const y = randInt(3, 12);
  const { a1: k1, b1: q1, a2: q2, b2: k2 } = pickIndependent2x2(2, 5, false);
  const p1 = randInt(1, 4), p2 = randInt(1, 4);
  const c1 = k1 * (x + p1) + q1 * y;
  const c2 = k2 * (y - p2) + q2 * x;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T6_BRACKETS",
    eq1: `${k1}(x + ${p1}) + ${q1}y = ${c1}`,
    eq2: `${q2}x + ${k2}(y - ${p2}) = ${c2}`,
    x, y,
    extraSteps: [
      `Expand brackets: ${k1}x + ${q1}y = ${c1 - k1 * p1} and ${q2}x + ${k2}y = ${c2 + k2 * p2}`,
    ],
  });
}

// 7. Equations with Positive and Negative Coefficients
export function prelimsType7PosNegCoeff(exam, difficulty) {
  const x = randInt(-8, 12) || 4;
  const y = randInt(-8, 12) || -3;
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 8, true);
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T7_POS_NEG_COEFF",
    eq1: `${formatLinearExpr(a1, b1)} = ${c1}`,
    eq2: `${formatLinearExpr(a2, b2)} = ${c2}`,
    x, y,
  });
}

// 8. Equations with Variable on Both Sides
export function prelimsType8VarBothSides(exam, difficulty) {
  const x = randInt(2, 12);
  const y = randInt(2, 12);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 7, false);
  const c1 = a1 * x - b1 * y;
  const c2 = b2 * y - a2 * x;
  return makeComparisonQuestion({
    exam, difficulty, subType: "PRELIMS_T8_VAR_BOTH_SIDES",
    eq1: `${a1}x = ${b1}y ${c1 >= 0 ? `+ ${c1}` : `- ${Math.abs(c1)}`}`,
    eq2: `${b2}y = ${a2}x ${c2 >= 0 ? `+ ${c2}` : `- ${Math.abs(c2)}`}`,
    x, y,
    extraSteps: [`Rearrange to standard form: ${a1}x - ${b1}y = ${c1} and -${a2}x + ${b2}y = ${c2}`],
  });
}

// 9. Find the Value of x + y
export function prelimsType9FindXPlusY(exam, difficulty) {
  const x = randInt(3, 14), y = randInt(3, 14);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 7, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T9_FIND_X_PLUS_Y",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, b2)} = ${a2 * x + b2 * y}`,
    askText: "(x + y)", answerVal: x + y, x, y,
  });
}

// 10. Find the Value of x - y
export function prelimsType10FindXMinusY(exam, difficulty) {
  const y = randInt(2, 10), x = y + randInt(2, 12);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 7, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T10_FIND_X_MINUS_Y",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "(x - y)", answerVal: x - y, x, y,
  });
}

// 11. Find the Value of xy
export function prelimsType11FindXY(exam, difficulty) {
  const x = randInt(3, 12), y = randInt(3, 12);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T11_FIND_XY",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "xy", answerVal: x * y, x, y,
  });
}

// 12. Find the Value of x / y
export function prelimsType12FindXDivY(exam, difficulty) {
  const y = randInt(2, 8);
  const ratio = randInt(2, 7);
  const x = y * ratio;
  const { a1, b1, a2, b2 } = pickIndependent2x2(1, 5, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T12_FIND_X_DIV_Y",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "x / y", answerVal: ratio, x, y,
  });
}

// 13. Find the Value of x² + y²
export function prelimsType13FindX2PlusY2(exam, difficulty) {
  const x = randInt(3, 11), y = randInt(3, 11);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T13_FIND_X2_PLUS_Y2",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "(x² + y²)", answerVal: x * x + y * y, x, y,
  });
}

// 14. Find the Value of x² - y²
export function prelimsType14FindX2MinusY2(exam, difficulty) {
  const y = randInt(2, 9), x = y + randInt(2, 8);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T14_FIND_X2_MINUS_Y2",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "(x² - y²)", answerVal: x * x - y * y, x, y,
  });
}

// 15. Find the Value of x² + xy + y²
export function prelimsType15FindX2PlusXYPlusY2(exam, difficulty) {
  const x = randInt(2, 9), y = randInt(2, 9);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  return makeValueQuestion({
    exam, difficulty, subType: "PRELIMS_T15_FIND_X2_XY_Y2",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    askText: "(x² + xy + y²)", answerVal: x * x + x * y + y * y, x, y,
  });
}

export const PRELIMS_LINEAR_MAP = {
  1: prelimsType1Direct,
  2: prelimsType2Simple,
  3: prelimsType3IntegerCoeff,
  4: prelimsType4FractionalCoeff,
  5: prelimsType5DecimalCoeff,
  6: prelimsType6Brackets,
  7: prelimsType7PosNegCoeff,
  8: prelimsType8VarBothSides,
  9: prelimsType9FindXPlusY,
  10: prelimsType10FindXMinusY,
  11: prelimsType11FindXY,
  12: prelimsType12FindXDivY,
  13: prelimsType13FindX2PlusY2,
  14: prelimsType14FindX2MinusY2,
  15: prelimsType15FindX2PlusXYPlusY2,
};