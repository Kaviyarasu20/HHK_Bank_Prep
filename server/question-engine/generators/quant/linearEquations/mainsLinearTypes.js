// Place at: server/question-engine/generators/quant/linearEquations/mainsLinearTypes.js
import { randInt, pickRandom, Fraction } from "../../../core/mathUtils.js";
import { buildOptions } from "../../../core/distractorEngine.js";
import {
  COMPARISON_OPTIONS,
  compareSingleValues,
  formatLinearExpr,
  pickIndependent2x2,
} from "./prelimsLinearTypes.js";

function makeMainsValueQuestion({
  exam,
  difficulty,
  subType,
  questionText,
  answerVal,
  optionType = "INTEGER",
  solutionSteps,
}) {
  const offsets = [-6, -4, -3, -2, -1, 1, 2, 3, 4, 6];
  const { options, correctOptionIndex } = buildOptions(answerVal, optionType, offsets);
  const ansStr = optionType === "FRACTION" ? answerVal.toExamString() : String(answerVal);
  return {
    questionId: `LIN_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Linear Simultaneous Equations",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText,
    options,
    correctOptionIndex,
    answer: ansStr,
    solutionSteps,
  };
}

function makeMainsComparison({ exam, difficulty, subType, eq1, eq2, x, y, extraSteps = [] }) {
  const idx = compareSingleValues(x, y);
  return {
    questionId: `LIN_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Linear Simultaneous Equations",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText: `Solve the following Mains-level equations and compare x and y:\nI. ${eq1}\nII. ${eq2}`,
    options: [...COMPARISON_OPTIONS],
    correctOptionIndex: idx,
    answer: COMPARISON_OPTIONS[idx],
    solutionSteps: [
      ...extraSteps,
      `Solving I and II gives x = ${x} and y = ${y}`,
      `Relationship: ${COMPARISON_OPTIONS[idx]}`,
    ],
  };
}

// 1. Complex Linear Simultaneous Equations (Symmetric large coefficients: ax + by = c1, bx + ay = c2)
export function mainsType1ComplexLinear(exam, difficulty) {
  const x = randInt(4, 16), y = randInt(4, 16);
  const a = randInt(17, 39);
  const b = a + randInt(6, 18);
  const c1 = a * x + b * y;
  const c2 = b * x + a * y;
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T1_COMPLEX_SYMMETRIC",
    eq1: `${a}x + ${b}y = ${c1}`,
    eq2: `${b}x + ${a}y = ${c2}`,
    x, y,
    extraSteps: [
      `Add I & II: ${a + b}(x + y) = ${c1 + c2} ⇒ x + y = ${x + y}`,
      `Subtract I & II: ${b - a}(x - y) = ${c2 - c1} ⇒ x - y = ${x - y}`,
    ],
  });
}

// 2. Equations with Higher Numerical Coefficients
export function mainsType2HigherCoeff(exam, difficulty) {
  const x = randInt(5, 18), y = randInt(5, 18);
  const { a1, b1, a2, b2 } = pickIndependent2x2(13, 29, false);
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T2_HIGHER_COEFF",
    eq1: `${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}`,
    eq2: `${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    x, y,
  });
}

// 3. Equations with Nested Fractions
export function mainsType3NestedFractions(exam, difficulty) {
  const d1 = pickRandom([3, 4, 5]), d2 = pickRandom([2, 3, 4]);
  const p = randInt(1, 5), q = randInt(1, 5);
  const x = d1 * randInt(2, 6) - p;
  const y = d2 * randInt(2, 6) - q;
  const c1 = (x + p) / d1 + (y + q) / d2;
  const c2 = (x + p) / d1 - (y + q) / d2;
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T3_NESTED_FRACTIONS",
    eq1: `(x + ${p})/${d1} + (y + ${q})/${d2} = ${c1}`,
    eq2: `(x + ${p})/${d1} - (y + ${q})/${d2} = ${c2}`,
    x, y,
    extraSteps: [
      `Let u = (x + ${p})/${d1} and v = (y + ${q})/${d2}`,
      `u = ${(x + p) / d1} ⇒ x = ${x}; v = ${(y + q) / d2} ⇒ y = ${y}`,
    ],
  });
}

// 4. Equations with Decimal and Fraction Combinations
export function mainsType4DecimalFractionCombo(exam, difficulty) {
  const d = pickRandom([2, 4, 5]);
  const x = randInt(2, 10) * 2; // even for clean 0.5x / 1.5x
  const y = d * randInt(2, 6);
  const a1T = pickRandom([5, 15, 25]); // 0.5, 1.5, 2.5
  const a2T = pickRandom([10, 20, 35]);
  const c1 = (a1T * x) / 10 + y / d;
  const c2 = (a2T * x) / 10 - (2 * y) / d;
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T4_DECIMAL_FRACTION_COMBO",
    eq1: `${(a1T / 10).toFixed(1)}x + y/${d} = ${Number(c1.toFixed(1))}`,
    eq2: `${(a2T / 10).toFixed(1)}x - 2y/${d} = ${Number(c2.toFixed(1))}`,
    x, y,
    extraSteps: [`Multiply by ${d * 10} to clear both decimals and fractions`],
  });
}

// 5. Equations with Multiple Brackets
export function mainsType5MultipleBrackets(exam, difficulty) {
  const x = randInt(3, 12), y = randInt(3, 12);
  const k1 = randInt(2, 4), k2 = randInt(2, 4);
  const p = randInt(1, 4), q = randInt(1, 4);
  const c1 = k1 * (2 * x + y - p) + k2 * (x - y + q);
  const c2 = k2 * (x + 2 * y + p) - k1 * (x - y);
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T5_MULTIPLE_BRACKETS",
    eq1: `${k1}(2x + y - ${p}) + ${k2}(x - y + ${q}) = ${c1}`,
    eq2: `${k2}(x + 2y + ${p}) - ${k1}(x - y) = ${c2}`,
    x, y,
    extraSteps: [`Simplify brackets in I & II before eliminating y`],
  });
}

// 6. Equations with Three Variables (x, y, z)
export function mainsType6ThreeVariables(exam, difficulty) {
  const x = randInt(2, 10), y = randInt(2, 10), z = randInt(2, 10);
  const s1 = x + y + z;
  const s2 = 2 * x + y - z;
  const s3 = x - y + 2 * z;
  const ans = x + 2 * y + 3 * z;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T6_THREE_VARIABLES",
    questionText: `Solve the three-variable linear system and find the value of (x + 2y + 3z):\nI. x + y + z = ${s1}\nII. 2x + y - z = ${s2}\nIII. x - y + 2z = ${s3}`,
    answerVal: ans,
    solutionSteps: [
      `Add I & II: 3x + 2y = ${s1 + s2}`,
      `Eliminating variables yields x = ${x}, y = ${y}, z = ${z}`,
      `x + 2y + 3z = ${x} + ${2 * y} + ${3 * z} = ${ans}`,
    ],
  });
}

// 7. Equations with Parameter-Based Coefficients (Find k for unique/given solution)
export function mainsType7ParameterCoeff(exam, difficulty) {
  const x = randInt(2, 8), y = randInt(2, 8), k = randInt(3, 12);
  const a1 = randInt(2, 5), b1 = randInt(2, 5);
  const b2 = randInt(2, 6);
  const c1 = a1 * x + b1 * y;
  const c2 = k * x + b2 * y;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T7_PARAMETER_COEFF",
    questionText: `If x = ${x} satisfies both simultaneous equations below, find the value of parameter k:\nI. ${a1}x + ${b1}y = ${c1}\nII. kx + ${b2}y = ${c2}`,
    answerVal: k,
    solutionSteps: [
      `Substitute x = ${x} into I: ${a1 * x} + ${b1}y = ${c1} ⇒ y = ${y}`,
      `Substitute x = ${x}, y = ${y} into II: ${x}k + ${b2 * y} = ${c2} ⇒ k = ${k}`,
    ],
  });
}

// 8. Equations Requiring Algebraic Identities
export function mainsType8AlgebraicIdentities(exam, difficulty) {
  const y = randInt(2, 8), x = y + randInt(2, 7);
  const diff = x - y;
  const sum = x + y;
  const diffSq = x * x - y * y; // (x - y)(x + y)
  const ans = x * x + y * y;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T8_ALGEBRAIC_IDENTITIES",
    questionText: `Given the equations below, find the value of (x² + y²):\nI. x² - y² = ${diffSq}\nII. x - y = ${diff}`,
    answerVal: ans,
    solutionSteps: [
      `Use identity x² - y² = (x - y)(x + y) ⇒ x + y = ${diffSq} ÷ ${diff} = ${sum}`,
      `Solving x + y = ${sum} and x - y = ${diff} gives x = ${x}, y = ${y}`,
      `x² + y² = ${x * x} + ${y * y} = ${ans}`,
    ],
  });
}

// 9. Equations with Reciprocal Expressions (a1/x + b1/y = c1)
export function mainsType9Reciprocal(exam, difficulty) {
  const x = randInt(2, 8), y = randInt(2, 8);
  const m1 = randInt(2, 6), n1 = randInt(2, 6);
  const m2 = randInt(2, 6), n2 = randInt(1, 5);
  const a1 = m1 * x, b1 = n1 * y;
  const a2 = m2 * x, b2 = n2 * y;
  return makeMainsComparison({
    exam, difficulty, subType: "MAINS_T9_RECIPROCAL",
    eq1: `${a1}/x + ${b1}/y = ${m1 + n1}`,
    eq2: `${a2}/x - ${b2}/y = ${m2 - n2}`,
    x, y,
    extraSteps: [
      `Substitute u = 1/x and v = 1/y to form a standard linear system`,
      `u = 1/${x} ⇒ x = ${x}; v = 1/${y} ⇒ y = ${y}`,
    ],
  });
}

// 10. Find Higher Powers of Variables (x³ + y³)
export function mainsType10HigherPowers(exam, difficulty) {
  const x = randInt(2, 7), y = randInt(2, 7);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 5, false);
  const ans = x * x * x + y * y * y;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T10_HIGHER_POWERS",
    questionText: `Solve the equations below and find the value of (x³ + y³):\nI. ${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}\nII. ${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    answerVal: ans,
    solutionSteps: [
      `Solving I and II gives x = ${x} and y = ${y}`,
      `x³ + y³ = ${x * x * x} + ${y * y * y} = ${ans}`,
    ],
  });
}

// 11. Find Polynomial Expressions in x and y (p*x² + q*xy - r*y²)
export function mainsType11PolynomialExpr(exam, difficulty) {
  const x = randInt(4, 10), y = randInt(2, 6);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  const p = randInt(2, 4), q = randInt(2, 5), r = randInt(1, 3);
  const ans = p * x * x + q * x * y - r * y * y;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T11_POLYNOMIAL_EXPR",
    questionText: `Solve I and II and find the value of (${p}x² + ${q}xy - ${r}y²):\nI. ${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}\nII. ${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    answerVal: ans,
    solutionSteps: [
      `Solving I and II gives x = ${x} and y = ${y}`,
      `${p}(${x}²) + ${q}(${x}×${y}) - ${r}(${y}²) = ${p * x * x} + ${q * x * y} - ${r * y * y} = ${ans}`,
    ],
  });
}

// 12. Find Compound Expressions Using (x + y) and xy
export function mainsType12CompoundSumProd(exam, difficulty) {
  const x = randInt(3, 10), y = randInt(3, 10);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  const s = x + y, p = x * y;
  const ans = s * s + 2 * p;
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T12_COMPOUND_SUM_PROD",
    questionText: `Solve I and II and find the value of [(x + y)² + 2xy]:\nI. ${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}\nII. ${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    answerVal: ans,
    solutionSteps: [
      `Solving I and II gives x = ${x} and y = ${y}`,
      `x + y = ${s}, xy = ${p} ⇒ ${s}² + 2(${p}) = ${ans}`,
    ],
  });
}

// 13. Find Expressions Involving 1/x and 1/y
export function mainsType13ReciprocalExpr(exam, difficulty) {
  const x = randInt(2, 9), y = randInt(2, 9);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 6, false);
  const ansFrac = new Fraction(1, x).add(new Fraction(1, y));
  const optType = ansFrac.isInteger() ? "INTEGER" : "FRACTION";
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T13_RECIPROCAL_EXPR",
    questionText: `Solve I and II and find the value of (1/x + 1/y):\nI. ${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}\nII. ${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    answerVal: optType === "INTEGER" ? ansFrac.num : ansFrac,
    optionType: optType,
    solutionSteps: [
      `Solving I and II gives x = ${x} and y = ${y}`,
      `1/${x} + 1/${y} = (${x + y})/(${x * y}) = ${ansFrac.toExamString()}`,
    ],
  });
}

// 14. Find Expressions Involving x²/y and y²/x
export function mainsType14CrossRatioExpr(exam, difficulty) {
  const x = randInt(2, 8), y = randInt(2, 8);
  const { a1, b1, a2, b2 } = pickIndependent2x2(2, 5, false);
  const ansFrac = new Fraction(x * x, y).add(new Fraction(y * y, x));
  const optType = ansFrac.isInteger() ? "INTEGER" : "FRACTION";
  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T14_CROSS_RATIO_EXPR",
    questionText: `Solve I and II and find the value of (x²/y + y²/x):\nI. ${formatLinearExpr(a1, b1)} = ${a1 * x + b1 * y}\nII. ${formatLinearExpr(a2, -b2)} = ${a2 * x - b2 * y}`,
    answerVal: optType === "INTEGER" ? ansFrac.num : ansFrac,
    optionType: optType,
    solutionSteps: [
      `Solving I and II gives x = ${x} and y = ${y}`,
      `x²/y + y²/x = (${x * x}/${y}) + (${y * y}/${x}) = ${ansFrac.toExamString()}`,
    ],
  });
}

// 15. Application-Based Simultaneous Equations (Commerce / Banking Cost Problem)
export function mainsType15Application(exam, difficulty) {
  const priceA = randInt(12, 35) * 10; // Rs. 120 to 350
  const priceB = randInt(10, 30) * 10;
  const { a1: qA1, b1: qB1, a2: qA2, b2: qB2 } = pickIndependent2x2(2, 8, false);
  const total1 = qA1 * priceA + qB1 * priceB;
  const total2 = qA2 * priceA + qB2 * priceB;
  const askTotal = 2 * priceA + 3 * priceB;

  return makeMainsValueQuestion({
    exam, difficulty, subType: "MAINS_T15_APPLICATION_WORD_PROBLEM",
    questionText: `A bank branch buys ${qA1} ledger books and ${qB1} stamp pads for Rs. ${total1}. Another branch buys ${qA2} ledger books and ${qB2} stamp pads at the same unit prices for Rs. ${total2}. What is the total cost (in Rs.) of 2 ledger books and 3 stamp pads?`,
    answerVal: askTotal,
    solutionSteps: [
      `Equations: ${qA1}x + ${qB1}y = ${total1} and ${qA2}x + ${qB2}y = ${total2}`,
      `Solving gives x (ledger book) = Rs. ${priceA}, y (stamp pad) = Rs. ${priceB}`,
      `Cost of 2 ledger books + 3 stamp pads = 2(${priceA}) + 3(${priceB}) = Rs. ${askTotal}`,
    ],
  });
}

export const MAINS_LINEAR_MAP = {
  1: mainsType1ComplexLinear,
  2: mainsType2HigherCoeff,
  3: mainsType3NestedFractions,
  4: mainsType4DecimalFractionCombo,
  5: mainsType5MultipleBrackets,
  6: mainsType6ThreeVariables,
  7: mainsType7ParameterCoeff,
  8: mainsType8AlgebraicIdentities,
  9: mainsType9Reciprocal,
  10: mainsType10HigherPowers,
  11: mainsType11PolynomialExpr,
  12: mainsType12CompoundSumProd,
  13: mainsType13ReciprocalExpr,
  14: mainsType14CrossRatioExpr,
  15: mainsType15Application,
};