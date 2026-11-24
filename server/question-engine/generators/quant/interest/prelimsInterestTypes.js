// Place at: server/question-engine/generators/quant/interest/prelimsInterestTypes.js
import { randInt, pickRandom, shuffle, gcd } from "../../../core/mathUtils.js";

export function buildInterestOptions(correctVal, { prefix = "", suffix = "", step = 50 } = {}) {
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

function makeIntQ({ exam, difficulty, topic, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `INT_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic,
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

// ==================== SIMPLE INTEREST (TYPES 1–10) ====================

// 1. Basic Simple Interest Calculation
export function prelimsSI1Basic(exam, difficulty) {
  const p = randInt(4, 25) * 1000;
  const r = randInt(5, 14);
  const t = randInt(2, 6);
  const si = (p * r * t) / 100;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_1_BASIC",
    questionText: `Find the Simple Interest on a principal of Rs. ${p} at ${r}% per annum for ${t} years.`,
    optResult: buildInterestOptions(si, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [`SI = (P × R × T) / 100 = (${p} × ${r} × ${t}) / 100 = Rs. ${si}`],
  });
}

// 2. Finding Principal (P)
export function prelimsSI2FindP(exam, difficulty) {
  const p = randInt(5, 30) * 1000;
  const r = pickRandom([6, 8, 10, 12, 15]);
  const t = randInt(2, 5);
  const si = (p * r * t) / 100;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_2_FIND_P",
    questionText: `What principal sum will earn Rs. ${si} as Simple Interest in ${t} years at ${r}% per annum?`,
    optResult: buildInterestOptions(p, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [`P = (SI × 100) / (R × T) = (${si} × 100) / (${r} × ${t}) = Rs. ${p}`],
  });
}

// 3. Finding Rate of Interest (R)
export function prelimsSI3FindR(exam, difficulty) {
  const p = randInt(5, 25) * 1000;
  const r = randInt(5, 16);
  const t = randInt(2, 5);
  const si = (p * r * t) / 100;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_3_FIND_R",
    questionText: `At what rate percent per annum will a sum of Rs. ${p} yield a Simple Interest of Rs. ${si} in ${t} years?`,
    optResult: buildInterestOptions(r, { suffix: "%", step: 1 }),
    solutionSteps: [`R = (SI × 100) / (P × T) = (${si} × 100) / (${p} × ${t}) = ${r}%`],
  });
}

// 4. Finding Time Period (T)
export function prelimsSI4FindT(exam, difficulty) {
  const p = randInt(4, 20) * 1000;
  const r = pickRandom([5, 8, 10, 12, 15]);
  const t = randInt(2, 8);
  const si = (p * r * t) / 100;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_4_FIND_T",
    questionText: `In how many years will Rs. ${p} earn a Simple Interest of Rs. ${si} at ${r}% per annum?`,
    optResult: buildInterestOptions(t, { suffix: " years", step: 1 }),
    solutionSteps: [`T = (SI × 100) / (P × R) = (${si} × 100) / (${p} × ${r}) = ${t} years`],
  });
}

// 5. Finding Amount
export function prelimsSI5FindAmount(exam, difficulty) {
  const p = randInt(5, 25) * 1000;
  const r = randInt(6, 15);
  const t = randInt(2, 5);
  const si = (p * r * t) / 100;
  const amt = p + si;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_5_FIND_AMOUNT",
    questionText: `What will be the total amount received on Rs. ${p} after ${t} years at ${r}% per annum Simple Interest?`,
    optResult: buildInterestOptions(amt, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [`SI = Rs. ${si}`, `Amount = P + SI = ${p} + ${si} = Rs. ${amt}`],
  });
}

// 6. SI with Different Time Periods (Months)
export function prelimsSI6Months(exam, difficulty) {
  const p = randInt(6, 30) * 1000;
  const r = pickRandom([6, 8, 12, 15, 18]);
  const months = pickRandom([4, 6, 8, 9, 18]);
  const si = (p * r * months) / 1200;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_6_MONTHS",
    questionText: `Calculate the Simple Interest on Rs. ${p} for ${months} months at ${r}% per annum.`,
    optResult: buildInterestOptions(si, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [`T = ${months}/12 years ⇒ SI = (${p} × ${r} × ${months}) / 1200 = Rs. ${si}`],
  });
}

// 7. Finding Difference Between SI and Amount (= Principal)
export function prelimsSI7DiffSIAmount(exam, difficulty) {
  const p = randInt(6, 25) * 1000;
  const r = pickRandom([8, 10, 12]);
  const t = randInt(3, 5);
  const si = (p * r * t) / 100;
  const diff = p - si; // Principal exceeds SI by diff
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_7_DIFF_SI_AMOUNT",
    questionText: `The Simple Interest on a certain sum for ${t} years at ${r}% p.a. is Rs. ${diff} less than the sum itself. Find the principal sum.`,
    optResult: buildInterestOptions(p, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [
      `SI = ${r * t}% of P ⇒ P - SI = ${100 - r * t}% of P = Rs. ${diff}`,
      `P = (${diff} × 100) / ${100 - r * t} = Rs. ${p}`,
    ],
  });
}

// 8. Comparing Simple Interests
export function prelimsSI8Compare(exam, difficulty) {
  const p = randInt(5, 20) * 1000;
  const r1 = pickRandom([8, 10, 12]), t1 = 3;
  const r2 = pickRandom([6, 8, 10]), t2 = 2;
  const si1 = (p * r1 * t1) / 100;
  const si2 = (p * r2 * t2) / 100;
  const diff = Math.abs(si1 - si2) || 200;
  const actualDiff = si1 - si2;
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_8_COMPARE",
    questionText: `Find the difference between the Simple Interest earned on Rs. ${p} at ${r1}% p.a. for ${t1} years and on Rs. ${p} at ${r2}% p.a. for ${t2} years.`,
    optResult: buildInterestOptions(Math.abs(actualDiff), { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `SI₁ = Rs. ${si1}; SI₂ = Rs. ${si2}`,
      `Difference = |${si1} - ${si2}| = Rs. ${Math.abs(actualDiff)}`,
    ],
  });
}

// 9. SI-Based Percentage Problems (Sum doubles/triples in T years)
export function prelimsSI9Percentage(exam, difficulty) {
  const pairs = [
    { mult: 2, t: 5, r: 20 },
    { mult: 2, t: 8, r: 12.5 }, // skip non-integer -> use exact integers only
  ];
  const exactPairs = [
    { mult: 2, t: 5, r: 20 },
    { mult: 2, t: 10, r: 10 },
    { mult: 2, t: 4, r: 25 },
    { mult: 3, t: 10, r: 20 },
    { mult: 3, t: 8, r: 25 },
    { mult: 4, t: 15, r: 20 },
  ];
  const item = pickRandom(exactPairs);
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_9_PERCENTAGE",
    questionText: `At what rate percent per annum Simple Interest will a sum of money become ${item.mult} times itself in ${item.t} years?`,
    optResult: buildInterestOptions(item.r, { suffix: "%", step: 2 }),
    solutionSteps: [
      `SI = (${item.mult} - 1)P = ${item.mult - 1}P`,
      `R = (${item.mult - 1} × 100) / ${item.t} = ${item.r}%`,
    ],
  });
}

// 10. Principal and Interest Ratio
export function prelimsSI10Ratio(exam, difficulty) {
  const r = pickRandom([5, 8, 10, 12, 15]);
  const t = pickRandom([2, 4, 5]);
  const p = 100, si = r * t;
  const g = gcd(p, si);
  const correctStr = `${p / g} : ${si / g}`;
  const distractors = new Set([`${si / g} : ${p / g}`]);
  let step = 1;
  while (distractors.size < 4) {
    const cand = `${p / g + step} : ${si / g}`;
    if (cand !== correctStr) distractors.add(cand);
    step++;
  }
  const options = shuffle([correctStr, ...distractors]);
  return makeIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "PRELIMS_SI_10_RATIO",
    questionText: `What is the ratio of Principal to Simple Interest earned on it at ${r}% per annum for ${t} years?`,
    optResult: { options, correctOptionIndex: options.indexOf(correctStr), answer: correctStr },
    solutionSteps: [`P : SI = 100 : (${r} × ${t}) = 100 : ${si} = ${correctStr}`],
  });
}

// ==================== COMPOUND INTEREST (TYPES 11–20) ====================

// 11. Basic Compound Interest Calculation (2 years)
export function prelimsCI11Basic(exam, difficulty) {
  const p = randInt(5, 30) * 1000;
  const r = pickRandom([10, 20]);
  const amt = (p * (100 + r) * (100 + r)) / 10000;
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_11_BASIC",
    questionText: `Find the Compound Interest on Rs. ${p} at ${r}% per annum for 2 years, compounded annually.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [`Amount = ${p} × (${(100 + r) / 100})² = Rs. ${amt}`, `CI = ${amt} - ${p} = Rs. ${ci}`],
  });
}

// 12. Finding Compound Amount
export function prelimsCI12Amount(exam, difficulty) {
  const p = randInt(4, 25) * 1000;
  const r = pickRandom([10, 20]);
  const amt = (p * (100 + r) * (100 + r)) / 10000;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_12_AMOUNT",
    questionText: `What will be the Compound Amount on Rs. ${p} after 2 years at ${r}% per annum, compounded annually?`,
    optResult: buildInterestOptions(amt, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [`A = P(1 + R/100)² = ${p} × (${(100 + r) / 100})² = Rs. ${amt}`],
  });
}

// 13. Finding Compound Interest (at 5% or 10% for 2 years)
export function prelimsCI13FindCI(exam, difficulty) {
  const p = randInt(4, 20) * 4000; // multiple of 4000 guarantees exact 5%² = 0.0025
  const r = pickRandom([5, 10, 15]);
  const amt = Math.round((p * (100 + r) * (100 + r)) / 10000);
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_13_FIND_CI",
    questionText: `Calculate the Compound Interest accrued on Rs. ${p} in 2 years at ${r}% per annum compounded annually.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [`Effective 2-year rate = ${2 * r + (r * r) / 100}%`, `CI = Rs. ${ci}`],
  });
}

// 14. Annual Compounding (3 years at 10%)
export function prelimsCI14Annual(exam, difficulty) {
  const p = randInt(4, 20) * 1000;
  const amt = (p * 1331) / 1000;
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_14_ANNUAL",
    questionText: `Find the Compound Interest on Rs. ${p} for 3 years at 10% per annum, compounded annually.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 110 }),
    solutionSteps: [`A = ${p} × (1.1)³ = ${p} × 1.331 = Rs. ${amt}`, `CI = ${amt} - ${p} = Rs. ${ci}`],
  });
}

// 15. Half-Yearly Compounding (1 year at 10% or 20% p.a.)
export function prelimsCI15HalfYearly(exam, difficulty) {
  const p = randInt(4, 20) * 4000;
  const annualR = pickRandom([10, 20]);
  const halfR = annualR / 2;
  const amt = (p * (100 + halfR) * (100 + halfR)) / 10000;
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_15_HALF_YEARLY",
    questionText: `Find the Compound Interest on Rs. ${p} for 1 year at ${annualR}% per annum, compounded half-yearly.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `Half-yearly rate = ${halfR}%, periods n = 2`,
      `A = ${p} × (${(100 + halfR) / 100})² = Rs. ${amt} ⇒ CI = Rs. ${ci}`,
    ],
  });
}

// 16. Quarterly Compounding (6 months at 20% or 40% p.a. -> 2 quarters)
export function prelimsCI16Quarterly(exam, difficulty) {
  const p = randInt(4, 20) * 4000;
  const annualR = pickRandom([20, 40]);
  const qR = annualR / 4; // 5% or 10% per quarter
  const amt = (p * (100 + qR) * (100 + qR)) / 10000;
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_16_QUARTERLY",
    questionText: `Find the Compound Interest on Rs. ${p} for 6 months at ${annualR}% per annum, compounded quarterly.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 50 }),
    solutionSteps: [
      `Quarterly rate = ${annualR}/4 = ${qR}%, periods n = 2 quarters`,
      `A = ${p} × (${(100 + qR) / 100})² = Rs. ${amt} ⇒ CI = Rs. ${ci}`,
    ],
  });
}

// 17. Difference Between SI and CI (2 years)
export function prelimsCI17DiffSICI(exam, difficulty) {
  const p = randInt(5, 30) * 1000;
  const r = pickRandom([10, 20]);
  const diff = (p * r * r) / 10000;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_17_DIFF_SI_CI",
    questionText: `What is the difference between Compound Interest and Simple Interest on Rs. ${p} for 2 years at ${r}% per annum?`,
    optResult: buildInterestOptions(diff, { prefix: "Rs. ", step: 20 }),
    solutionSteps: [`2-year (CI - SI) = P × (R / 100)² = ${p} × (${r} / 100)² = Rs. ${diff}`],
  });
}

// 18. Finding Principal from CI (2 years)
export function prelimsCI18FindPRT(exam, difficulty) {
  const p = randInt(5, 25) * 1000;
  const r = pickRandom([10, 20]);
  const ci = (p * (2 * r + (r * r) / 100)) / 100;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_18_FIND_P",
    questionText: `If the Compound Interest on a sum for 2 years at ${r}% per annum compounded annually is Rs. ${ci}, find the principal sum.`,
    optResult: buildInterestOptions(p, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [
      `Effective 2-year CI rate = ${2 * r + (r * r) / 100}%`,
      `P = (${ci} × 100) / ${2 * r + (r * r) / 100} = Rs. ${p}`,
    ],
  });
}

// 19. Compound Interest for 2 or 3 Years (3 years at 20%)
export function prelimsCI19TwoOrThreeYears(exam, difficulty) {
  const p = randInt(4, 15) * 1000;
  const amt = (p * 1728) / 1000; // 1.2^3 = 1.728
  const ci = amt - p;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_19_3_YEARS",
    questionText: `Find the Compound Interest on Rs. ${p} for 3 years at 20% per annum compounded annually.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 150 }),
    solutionSteps: [`A = ${p} × (1.2)³ = ${p} × 1.728 = Rs. ${amt}`, `CI = ${amt} - ${p} = Rs. ${ci}`],
  });
}

// 20. Growth and Depreciation (2-year machine depreciation)
export function prelimsCI20GrowthDep(exam, difficulty) {
  const orig = randInt(5, 25) * 10000;
  const r = pickRandom([10, 20]);
  const val2 = (orig * (100 - r) * (100 - r)) / 10000;
  return makeIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "PRELIMS_CI_20_GROWTH_DEP",
    questionText: `A machine bought for Rs. ${orig} depreciates at ${r}% per annum. What will be its value after 2 years?`,
    optResult: buildInterestOptions(val2, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [`Value after 2 years = ${orig} × (${(100 - r) / 100})² = Rs. ${val2}`],
  });
}

export const PRELIMS_SI_MAP = {
  1: prelimsSI1Basic,
  2: prelimsSI2FindP,
  3: prelimsSI3FindR,
  4: prelimsSI4FindT,
  5: prelimsSI5FindAmount,
  6: prelimsSI6Months,
  7: prelimsSI7DiffSIAmount,
  8: prelimsSI8Compare,
  9: prelimsSI9Percentage,
  10: prelimsSI10Ratio,
};

export const PRELIMS_CI_MAP = {
  11: prelimsCI11Basic,
  12: prelimsCI12Amount,
  13: prelimsCI13FindCI,
  14: prelimsCI14Annual,
  15: prelimsCI15HalfYearly,
  16: prelimsCI16Quarterly,
  17: prelimsCI17DiffSICI,
  18: prelimsCI18FindPRT,
  19: prelimsCI19TwoOrThreeYears,
  20: prelimsCI20GrowthDep,
};

export const PRELIMS_INTEREST_MAP = { ...PRELIMS_SI_MAP, ...PRELIMS_CI_MAP };