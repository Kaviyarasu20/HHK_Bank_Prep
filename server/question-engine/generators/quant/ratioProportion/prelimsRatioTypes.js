// Place at: server/question-engine/generators/quant/ratioProportion/prelimsRatioTypes.js
import { randInt, pickRandom, shuffle, gcd } from "../../../core/mathUtils.js";

/**
 * Reduces a:b to lowest integer terms "p : q".
 */
export function reduceRatio(a, b) {
  const g = gcd(a, b) || 1;
  return { p: a / g, q: b / g, str: `${a / g} : ${b / g}` };
}

/**
 * Builds 5 unique numeric options with optional prefix/suffix (e.g., "Rs. ", " years").
 */
export function buildNumericUnitOptions(correctVal, { prefix = "", suffix = "", step = 4 } = {}) {
  const fmt = (v) => `${prefix}${Math.round(v)}${suffix}`;
  const correctStr = fmt(correctVal);
  const distractors = new Set();
  const mults = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6];

  let guard = 0;
  while (distractors.size < 4 && guard < 200) {
    guard++;
    const cand = Number(correctVal) + pickRandom(mults) * step;
    if (cand > 0) {
      const s = fmt(cand);
      if (s !== correctStr) distractors.add(s);
    }
  }
  let extra = 1;
  while (distractors.size < 4) {
    const s = fmt(Number(correctVal) + extra * step);
    if (s !== correctStr) distractors.add(s);
    extra++;
  }
  const options = shuffle([correctStr, ...distractors]);
  return { options, correctOptionIndex: options.indexOf(correctStr), answer: correctStr };
}

/**
 * Builds 5 unique ratio string options ("p : q").
 */
export function buildRatioOptions(p, q) {
  const correct = reduceRatio(p, q);
  const distractors = new Set();
  const deltas = [-3, -2, -1, 1, 2, 3, 4];

  // Include swapped ratio if p !== q
  if (correct.p !== correct.q) {
    distractors.add(`${correct.q} : ${correct.p}`);
  }

  let guard = 0;
  while (distractors.size < 4 && guard < 200) {
    guard++;
    const np = Math.max(1, correct.p + pickRandom(deltas));
    const nq = Math.max(1, correct.q + pickRandom(deltas));
    const r = reduceRatio(np, nq).str;
    if (r !== correct.str) distractors.add(r);
  }
  let step = 1;
  while (distractors.size < 4) {
    const r = reduceRatio(correct.p + step, correct.q + step + 1).str;
    if (r !== correct.str) distractors.add(r);
    step++;
  }
  const options = shuffle([correct.str, ...distractors]);
  return { options, correctOptionIndex: options.indexOf(correct.str), answer: correct.str };
}

function makeRatioQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `RAT_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Ratio & Proportion",
    subType,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText,
    options: optResult.options,
    correctOptionIndex: optResult.correctOptionIndex,
    answer: optResult.answer,
    solutionSteps,
  };
}

// 1. Basic Ratio Simplification
export function prelimsRatio1Simplify(exam, difficulty) {
  let p = randInt(2, 9), q = randInt(2, 11);
  while (gcd(p, q) !== 1 || p === q) {
    p = randInt(2, 9);
    q = randInt(2, 11);
  }
  const k = randInt(6, 18);
  const a = p * k, b = q * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_1_SIMPLIFY",
    questionText: `Express the ratio ${a} : ${b} in its simplest form.`,
    optResult: buildRatioOptions(p, q),
    solutionSteps: [
      `HCF(${a}, ${b}) = ${k}`,
      `Divide both terms by ${k}: (${a}/${k}) : (${b}/${k}) = ${p} : ${q}`,
    ],
  });
}

// 2. Equivalent Ratios (a : b = c : x)
export function prelimsRatio2Equivalent(exam, difficulty) {
  const p = randInt(3, 9), q = randInt(4, 11);
  const k = randInt(3, 12);
  const c = p * k, ans = q * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_2_EQUIVALENT",
    questionText: `If ${p} : ${q} :: ${c} : x, find the value of x.`,
    optResult: buildNumericUnitOptions(ans, { step: 3 }),
    solutionSteps: [
      `${p} / ${q} = ${c} / x ⇒ x = (${c} × ${q}) / ${p} = ${ans}`,
    ],
  });
}

// 3. Ratio Division (Dividing a Quantity in a Given Ratio)
export function prelimsRatio3Division(exam, difficulty) {
  const r1 = randInt(2, 6), r2 = randInt(3, 7), r3 = randInt(4, 9);
  const unit = randInt(10, 35) * 10;
  const total = (r1 + r2 + r3) * unit;
  const shareC = r3 * unit;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_3_DIVISION",
    questionText: `A sum of Rs. ${total} is divided among A, B, and C in the ratio ${r1} : ${r2} : ${r3}. What is C's share?`,
    optResult: buildNumericUnitOptions(shareC, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `Total parts = ${r1} + ${r2} + ${r3} = ${r1 + r2 + r3}`,
      `1 part = Rs. ${total} / ${r1 + r2 + r3} = Rs. ${unit}`,
      `C's share = ${r3} × ${unit} = Rs. ${shareC}`,
    ],
  });
}

// 4. Finding a Number from a Given Ratio
export function prelimsRatio4FindNumber(exam, difficulty) {
  const r1 = randInt(3, 7), r2 = r1 + randInt(2, 5);
  const k = randInt(6, 22);
  const diff = (r2 - r1) * k;
  const larger = r2 * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_4_FIND_NUMBER",
    questionText: `Two numbers are in the ratio ${r1} : ${r2}. If the difference between them is ${diff}, find the larger number.`,
    optResult: buildNumericUnitOptions(larger, { step: 4 }),
    solutionSteps: [
      `Difference in ratio parts = ${r2} - ${r1} = ${r2 - r1} parts = ${diff}`,
      `1 part = ${k} ⇒ Larger number = ${r2} × ${k} = ${larger}`,
    ],
  });
}

// 5. Compound Ratio
export function prelimsRatio5Compound(exam, difficulty) {
  const a = randInt(2, 6), b = randInt(3, 7);
  const c = randInt(2, 6), d = randInt(3, 7);
  const e = randInt(2, 5), f = randInt(2, 5);
  const red = reduceRatio(a * c * e, b * d * f);
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_5_COMPOUND",
    questionText: `Find the compound ratio of ${a} : ${b}, ${c} : ${d}, and ${e} : ${f}.`,
    optResult: buildRatioOptions(red.p, red.q),
    solutionSteps: [
      `Compound ratio = (${a} × ${c} × ${e}) : (${b} × ${d} × ${f}) = ${a * c * e} : ${b * d * f}`,
      `Simplified form = ${red.str}`,
    ],
  });
}

// 6. Duplicate, Triplicate and Sub-duplicate Ratios
export function prelimsRatio6DupTripSub(exam, difficulty) {
  const mode = pickRandom(["DUPLICATE", "TRIPLICATE", "SUB_DUPLICATE"]);
  let a = randInt(2, 7), b = randInt(2, 8);
  while (gcd(a, b) !== 1 || a === b) {
    a = randInt(2, 7);
    b = randInt(2, 8);
  }
  if (mode === "DUPLICATE") {
    return makeRatioQ({
      exam, difficulty, subType: "PRELIMS_RATIO_6_DUPLICATE",
      questionText: `Find the duplicate ratio of ${a} : ${b}.`,
      optResult: buildRatioOptions(a * a, b * b),
      solutionSteps: [`Duplicate ratio of a : b is a² : b² = ${a * a} : ${b * b}`],
    });
  }
  if (mode === "TRIPLICATE") {
    const x = randInt(2, 5), y = x + randInt(1, 3);
    const red = reduceRatio(x * x * x, y * y * y);
    return makeRatioQ({
      exam, difficulty, subType: "PRELIMS_RATIO_6_TRIPLICATE",
      questionText: `Find the triplicate ratio of ${x} : ${y}.`,
      optResult: buildRatioOptions(red.p, red.q),
      solutionSteps: [`Triplicate ratio of a : b is a³ : b³ = ${x * x * x} : ${y * y * y} = ${red.str}`],
    });
  }
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_6_SUB_DUPLICATE",
    questionText: `Find the sub-duplicate ratio of ${a * a} : ${b * b}.`,
    optResult: buildRatioOptions(a, b),
    solutionSteps: [`Sub-duplicate ratio of a : b is √a : √b = √${a * a} : √${b * b} = ${a} : ${b}`],
  });
}

// 7. Comparison of Ratios (Find the largest ratio)
export function prelimsRatio7Compare(exam, difficulty) {
  // Construct 5 strictly distinct ratios
  const cands = [
    [2, 5], [3, 7], [4, 9], [5, 11], [7, 15],
    [1, 2], [4, 7], [5, 8], [7, 10], [3, 4], [5, 6],
  ];
  const picked = shuffle(cands).slice(0, 5);
  picked.sort((u, v) => v[0] / v[1] - u[0] / u[1]);
  const largest = `${picked[0][0]} : ${picked[0][1]}`;
  const allStrs = shuffle(picked.map(([n, d]) => `${n} : ${d}`));
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_7_COMPARE",
    questionText: `Which of the following ratios is the largest?\n${allStrs.join(", ")}`,
    optResult: { options: allStrs, correctOptionIndex: allStrs.indexOf(largest), answer: largest },
    solutionSteps: [
      `Convert to decimals: ${picked.map(([n, d]) => `${n}:${d} = ${(n / d).toFixed(3)}`).join(", ")}`,
      `Largest ratio is ${largest}`,
    ],
  });
}

// 8. Proportion (Fourth Proportional)
export function prelimsRatio8FourthProp(exam, difficulty) {
  const a = randInt(3, 12);
  const k = randInt(2, 8);
  const b = a * k;
  const c = randInt(4, 15);
  const d = c * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_8_FOURTH_PROP",
    questionText: `Find the fourth proportional to ${a}, ${b}, and ${c}.`,
    optResult: buildNumericUnitOptions(d, { step: 3 }),
    solutionSteps: [
      `Fourth proportional d = (b × c) / a = (${b} × ${c}) / ${a} = ${d}`,
    ],
  });
}

// 9. Third Proportional
export function prelimsRatio9ThirdProp(exam, difficulty) {
  const a = randInt(2, 9);
  const k = randInt(2, 6);
  const b = a * k;
  const c = b * k; // b² / a = a*k² = b*k
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_9_THIRD_PROP",
    questionText: `Find the third proportional to ${a} and ${b}.`,
    optResult: buildNumericUnitOptions(c, { step: 4 }),
    solutionSteps: [
      `Third proportional c = b² / a = (${b} × ${b}) / ${a} = ${c}`,
    ],
  });
}

// 10. Mean Proportional
export function prelimsRatio10MeanProp(exam, difficulty) {
  const p = randInt(2, 9), q = randInt(3, 11);
  const k = randInt(2, 5);
  const a = p * p * k;
  const b = q * q * k;
  const mean = p * q * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_10_MEAN_PROP",
    questionText: `Find the mean proportional between ${a} and ${b}.`,
    optResult: buildNumericUnitOptions(mean, { step: 3 }),
    solutionSteps: [
      `Mean proportional = √(a × b) = √(${a} × ${b}) = ${mean}`,
    ],
  });
}

// 11. Direct Proportion
export function prelimsRatio11DirectProp(exam, difficulty) {
  const unitCost = randInt(15, 65);
  const qty1 = randInt(5, 14);
  const qty2 = qty1 + randInt(4, 12);
  const cost1 = unitCost * qty1;
  const cost2 = unitCost * qty2;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_11_DIRECT_PROP",
    questionText: `If the cost of ${qty1} notebooks is Rs. ${cost1}, what will be the cost of ${qty2} such notebooks?`,
    optResult: buildNumericUnitOptions(cost2, { prefix: "Rs. ", step: 15 }),
    solutionSteps: [
      `Cost of 1 notebook = ${cost1} / ${qty1} = Rs. ${unitCost}`,
      `Cost of ${qty2} notebooks = ${qty2} × ${unitCost} = Rs. ${cost2}`,
    ],
  });
}

// 12. Inverse Proportion
export function prelimsRatio12InverseProp(exam, difficulty) {
  const pairs = [
    [12, 15, 18, 10],
    [15, 16, 20, 12],
    [18, 10, 15, 12],
    [24, 15, 30, 12],
    [20, 18, 24, 15],
    [16, 21, 24, 14],
  ];
  const [m1, d1, m2, d2] = pickRandom(pairs);
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_12_INVERSE_PROP",
    questionText: `If ${m1} workers can complete a project in ${d1} days, in how many days will ${m2} workers complete the same project working at the same rate?`,
    optResult: buildNumericUnitOptions(d2, { suffix: " days", step: 2 }),
    solutionSteps: [
      `By inverse proportion: M₁ × D₁ = M₂ × D₂`,
      `D₂ = (${m1} × ${d1}) / ${m2} = ${d2} days`,
    ],
  });
}

// 13. Ratio-Based Age Problems
export function prelimsRatio13Ages(exam, difficulty) {
  const k = randInt(4, 9);
  const rA = randInt(3, 6), rB = rA + randInt(1, 3);
  const ageA = rA * k, ageB = rB * k;
  const yrs = randInt(4, 8);
  const futureSum = ageA + ageB + 2 * yrs;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_13_AGES",
    questionText: `The present ages of A and B are in the ratio ${rA} : ${rB}. After ${yrs} years, the sum of their ages will be ${futureSum} years. What is the present age of B?`,
    optResult: buildNumericUnitOptions(ageB, { suffix: " years", step: 3 }),
    solutionSteps: [
      `Present sum = ${futureSum} - 2(${yrs}) = ${ageA + ageB} years`,
      `1 ratio unit = ${ageA + ageB} / ${rA + rB} = ${k} ⇒ Present age of B = ${rB} × ${k} = ${ageB} years`,
    ],
  });
}

// 14. Ratio-Based Income and Expenditure
export function prelimsRatio14IncomeExp(exam, difficulty) {
  const rInc = randInt(5, 9), rExp = randInt(3, rInc - 1);
  const k = randInt(15, 45) * 100;
  const income = rInc * k;
  const savings = (rInc - rExp) * k;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_14_INCOME_EXP",
    questionText: `The ratio of a person's monthly income to expenditure is ${rInc} : ${rExp}. If their monthly income is Rs. ${income}, what is their monthly savings?`,
    optResult: buildNumericUnitOptions(savings, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [
      `1 unit = ${income} / ${rInc} = Rs. ${k}`,
      `Savings = (${rInc} - ${rExp}) × ${k} = Rs. ${savings}`,
    ],
  });
}

// 15. Ratio-Based Partnership Problems
export function prelimsRatio15Partnership(exam, difficulty) {
  const invA = randInt(3, 7), invB = randInt(4, 9);
  const unitP = randInt(4, 15) * 100;
  const totalProfit = (invA + invB) * unitP;
  const shareA = invA * unitP;
  return makeRatioQ({
    exam, difficulty, subType: "PRELIMS_RATIO_15_PARTNERSHIP",
    questionText: `A and B invest Rs. ${invA * 10000} and Rs. ${invB * 10000} respectively in a business for 1 year. If the annual profit is Rs. ${totalProfit}, find A's share in the profit.`,
    optResult: buildNumericUnitOptions(shareA, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [
      `Investment ratio A : B = ${invA} : ${invB}`,
      `A's share = (${invA} / ${invA + invB}) × ${totalProfit} = Rs. ${shareA}`,
    ],
  });
}

export const PRELIMS_RATIO_MAP = {
  1: prelimsRatio1Simplify,
  2: prelimsRatio2Equivalent,
  3: prelimsRatio3Division,
  4: prelimsRatio4FindNumber,
  5: prelimsRatio5Compound,
  6: prelimsRatio6DupTripSub,
  7: prelimsRatio7Compare,
  8: prelimsRatio8FourthProp,
  9: prelimsRatio9ThirdProp,
  10: prelimsRatio10MeanProp,
  11: prelimsRatio11DirectProp,
  12: prelimsRatio12InverseProp,
  13: prelimsRatio13Ages,
  14: prelimsRatio14IncomeExp,
  15: prelimsRatio15Partnership,
};