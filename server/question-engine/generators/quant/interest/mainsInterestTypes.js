// Place at: server/question-engine/generators/quant/interest/mainsInterestTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildInterestOptions } from "./prelimsInterestTypes.js";

function makeMainsIntQ({ exam, difficulty, topic, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `INT_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
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

// ==================== MAINS SIMPLE INTEREST (TYPES 1–4) ====================

// 1. SI with Changing Interest Rates
export function mainsSI1ChangingRates(exam, difficulty) {
  const p = randInt(5, 25) * 1000;
  const r1 = randInt(6, 9), r2 = r1 + randInt(2, 4), r3 = r2 + randInt(2, 4);
  const t1 = 2, t2 = 3, t3 = 2;
  const totalPct = r1 * t1 + r2 * t2 + r3 * t3;
  const si = (p * totalPct) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "MAINS_SI_1_CHANGING_RATES",
    questionText: `A sum of Rs. ${p} is lent at Simple Interest at ${r1}% p.a. for the first ${t1} years, ${r2}% p.a. for the next ${t2} years, and ${r3}% p.a. for the final ${t3} years. Find the total Simple Interest earned over ${t1 + t2 + t3} years.`,
    optResult: buildInterestOptions(si, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [
      `Total effective rate = (${r1}×${t1}) + (${r2}×${t2}) + (${r3}×${t3}) = ${totalPct}%`,
      `SI = ${totalPct}% of Rs. ${p} = Rs. ${si}`,
    ],
  });
}

// 2. SI with Different Time Periods and Rates (Amounts to A1 in T1 yrs, A2 in T2 yrs)
export function mainsSI2TwoAmounts(exam, difficulty) {
  const p = randInt(5, 20) * 1000;
  const r = pickRandom([6, 8, 10, 12]);
  const t1 = 2, t2 = 5;
  const a1 = p + (p * r * t1) / 100;
  const a2 = p + (p * r * t2) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "MAINS_SI_2_TWO_AMOUNTS",
    questionText: `A certain sum at Simple Interest amounts to Rs. ${a1} in ${t1} years and to Rs. ${a2} in ${t2} years. Find the principal sum.`,
    optResult: buildInterestOptions(p, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [
      `SI for (${t2} - ${t1}) = ${t2 - t1} years = ${a2} - ${a1} = Rs. ${a2 - a1}`,
      `SI for 1 year = Rs. ${(a2 - a1) / (t2 - t1)} ⇒ SI for ${t1} years = Rs. ${(p * r * t1) / 100}`,
      `Principal = ${a1} - ${(p * r * t1) / 100} = Rs. ${p}`,
    ],
  });
}

// 3. Principal Division into Different Schemes
export function mainsSI3SchemeDivision(exam, difficulty) {
  const p1 = randInt(4, 15) * 1000;
  const p2 = randInt(4, 15) * 1000;
  const totalP = p1 + p2;
  const r1 = 8, r2 = 12, t = 2;
  const totalSI = (p1 * r1 * t + p2 * r2 * t) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "MAINS_SI_3_SCHEME_DIVISION",
    questionText: `A sum of Rs. ${totalP} is split into two parts: Part A is invested at ${r1}% p.a. and Part B at ${r2}% p.a. Simple Interest. If the total interest earned from both parts after ${t} years is Rs. ${totalSI}, find the amount invested in Part B.`,
    optResult: buildInterestOptions(p2, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [
      `Let Part B = x, Part A = ${totalP} - x`,
      `0.16(${totalP} - x) + 0.24x = ${totalSI} ⇒ 0.08x = ${totalSI - (totalP * 16) / 100} ⇒ x = Rs. ${p2}`,
    ],
  });
}

// 4. Comparison of Multiple SI Investments
export function mainsSI4CompareMulti(exam, difficulty) {
  const p1 = randInt(5, 15) * 1000;
  const p2 = randInt(6, 18) * 1000;
  const r1 = 10, t1 = 3;
  const r2 = 12, t2 = 2;
  const totalSI = (p1 * r1 * t1) / 100 + (p2 * r2 * t2) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Simple Interest", subType: "MAINS_SI_4_COMPARE_MULTI",
    questionText: `An investor puts Rs. ${p1} in Scheme X at ${r1}% p.a. for ${t1} years and Rs. ${p2} in Scheme Y at ${r2}% p.a. for ${t2} years (both at Simple Interest). What is the total Simple Interest earned from both schemes combined?`,
    optResult: buildInterestOptions(totalSI, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [
      `SI(X) = Rs. ${(p1 * r1 * t1) / 100}; SI(Y) = Rs. ${(p2 * r2 * t2) / 100}`,
      `Total SI = Rs. ${totalSI}`,
    ],
  });
}

// ==================== MAINS COMPOUND INTEREST (TYPES 5–14) ====================

// 5. CI with Changing Interest Rates (Year 1 at r1%, Year 2 at r2%)
export function mainsCI5ChangingRates(exam, difficulty) {
  const p = randInt(5, 25) * 1000;
  const r1 = pickRandom([10, 20]);
  const r2 = pickRandom([15, 25]);
  const amt = (p * (100 + r1) * (100 + r2)) / 10000;
  const ci = amt - p;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_5_CHANGING_RATES",
    questionText: `Find the Compound Interest on Rs. ${p} for 2 years if the rate of interest is ${r1}% for the first year and ${r2}% for the second year.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `A = ${p} × ${(100 + r1) / 100} × ${(100 + r2) / 100} = Rs. ${amt}`,
      `CI = ${amt} - ${p} = Rs. ${ci}`,
    ],
  });
}

// 6. CI with Different Compounding Periods (Half-Yearly vs Annual difference for 1 year)
export function mainsCI6DiffCompounding(exam, difficulty) {
  const p = randInt(4, 20) * 4000;
  const r = pickRandom([10, 20]);
  const ciAnnual = (p * r) / 100;
  const halfR = r / 2;
  const ciHalf = (p * (100 + halfR) * (100 + halfR)) / 10000 - p;
  const diff = ciHalf - ciAnnual;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_6_DIFF_COMPOUNDING",
    questionText: `Find the difference between the Compound Interest on Rs. ${p} for 1 year at ${r}% per annum when compounded half-yearly versus when compounded annually.`,
    optResult: buildInterestOptions(diff, { prefix: "Rs. ", step: 10 }),
    solutionSteps: [
      `Annual CI (1 yr) = Rs. ${ciAnnual}; Half-yearly CI (2 periods @ ${halfR}%) = Rs. ${ciHalf}`,
      `Difference = ${ciHalf} - ${ciAnnual} = Rs. ${diff}`,
    ],
  });
}

// 7. Half-Yearly and Quarterly Compounding (1.5 years half-yearly at 20% p.a.)
export function mainsCI7HalfQuarterly(exam, difficulty) {
  const p = randInt(4, 20) * 1000;
  // 1.5 years half-yearly at 20% p.a. => 3 periods at 10% => multiplier 1.331
  const amt = (p * 1331) / 1000;
  const ci = amt - p;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_7_HALF_QUARTERLY",
    questionText: `Find the Compound Interest on Rs. ${p} for 1.5 years at 20% per annum, compounded half-yearly.`,
    optResult: buildInterestOptions(ci, { prefix: "Rs. ", step: 110 }),
    solutionSteps: [
      `Half-yearly rate = 10%, periods n = 3`,
      `A = ${p} × (1.1)³ = Rs. ${amt} ⇒ CI = Rs. ${ci}`,
    ],
  });
}

// 8. Difference Between SI and CI for Multiple Years (3 years)
export function mainsCI8DiffSICI3Years(exam, difficulty) {
  const p = randInt(4, 25) * 1000;
  const r = pickRandom([10, 20]);
  // 3-year CI - SI = P * (r^2 * (300 + r)) / 100^3
  const diff = (p * r * r * (300 + r)) / 1000000;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_8_DIFF_3_YEARS",
    questionText: `What is the difference between Compound Interest and Simple Interest on Rs. ${p} for 3 years at ${r}% per annum?`,
    optResult: buildInterestOptions(diff, { prefix: "Rs. ", step: 31 }),
    solutionSteps: [
      `3-year (CI - SI) = P × [R²(300 + R) / 100³]`,
      `= ${p} × [${r * r}(${300 + r}) / 1000000] = Rs. ${diff}`,
    ],
  });
}

// 9. Population Growth Using CI (3 years at 10%)
export function mainsCI9PopGrowth(exam, difficulty) {
  const p0 = randInt(5, 30) * 1000;
  const p3 = (p0 * 1331) / 1000;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_9_POP_GROWTH",
    questionText: `The population of a city is ${p0} today and grows at a compound rate of 10% every year. What will be its population after 3 years?`,
    optResult: buildInterestOptions(p3, { step: 250 }),
    solutionSteps: [`Population = ${p0} × (1.1)³ = ${p0} × 1.331 = ${p3}`],
  });
}

// 10. Depreciation-Based Problems (Reverse 3-year depreciation at 10%)
export function mainsCI10Depreciation(exam, difficulty) {
  const orig = randInt(5, 25) * 10000;
  const val3 = (orig * 729) / 1000; // 0.9^3 = 0.729
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_10_DEPRECIATION",
    questionText: `The value of a delivery van depreciates at 10% per annum. If its value after 3 years is Rs. ${val3}, what was its original purchase price?`,
    optResult: buildInterestOptions(orig, { prefix: "Rs. ", step: 2000 }),
    solutionSteps: [`Original Price × (0.9)³ = ${val3} ⇒ Original Price = ${val3} / 0.729 = Rs. ${orig}`],
  });
}

// 11. Successive Percentage Growth (3 years at +10%, +20%, +25%)
export function mainsCI11SuccessiveGrowth(exam, difficulty) {
  const base = randInt(4, 20) * 2000;
  const finalVal = (base * 110 * 120 * 125) / 1000000; // × 1.65 exactly
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_11_SUCCESSIVE_GROWTH",
    questionText: `A mutual fund corpus of Rs. ${base} compounds by 10% in Year 1, 20% in Year 2, and 25% in Year 3. What is the corpus value at the end of Year 3?`,
    optResult: buildInterestOptions(finalVal, { prefix: "Rs. ", step: 250 }),
    solutionSteps: [`Final Value = ${base} × 1.1 × 1.2 × 1.25 = ${base} × 1.65 = Rs. ${finalVal}`],
  });
}

// 12. CI-Based Ratio Problems (Find rate from 2nd-yr vs 3rd-yr amount)
export function mainsCI12RatioCI(exam, difficulty) {
  const r = pickRandom([10, 15, 20, 25]);
  const a2 = randInt(4, 15) * 1000;
  const a3 = (a2 * (100 + r)) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_12_RATIO_CI",
    questionText: `A sum invested at Compound Interest amounts to Rs. ${a2} in 2 years and Rs. ${a3} in 3 years. What is the annual rate of interest?`,
    optResult: buildInterestOptions(r, { suffix: "%", step: 2 }),
    solutionSteps: [
      `Interest earned in 3rd year = ${a3} - ${a2} = Rs. ${a3 - a2}`,
      `Rate % = (${a3 - a2} / ${a2}) × 100 = ${r}%`,
    ],
  });
}

// 13. Installment-Based Interest Problems (2 equal annual installments at 10% CI)
export function mainsCI13Installment(exam, difficulty) {
  // Answer-First: Pick installment = 121 * k at 10% CI -> P = 110k + 100k = 210k (exact integer!)
  const k = randInt(10, 45) * 10;
  const installment = 121 * k;
  const principal = 210 * k;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_13_INSTALLMENT",
    questionText: `A loan of Rs. ${principal} is to be repaid in two equal annual installments at 10% per annum Compound Interest. What is the value of each annual installment?`,
    optResult: buildInterestOptions(installment, { prefix: "Rs. ", step: 110 }),
    solutionSteps: [
      `Let each installment = X. P = X/(1.1) + X/(1.1)² = X × (210 / 121)`,
      `${principal} = X × (210 / 121) ⇒ X = Rs. ${installment}`,
    ],
  });
}

// 14. Loan Repayment and EMI Problems (Partial repayment after Year 1, clear balance after Year 2)
export function mainsCI14LoanRepayment(exam, difficulty) {
  const loan = randInt(10, 30) * 1000;
  const r = 10;
  const afterYr1 = (loan * (100 + r)) / 100;
  const repaidYr1 = randInt(4, Math.floor(afterYr1 / 1000) - 3) * 1000;
  const balance = afterYr1 - repaidYr1;
  const finalPay = (balance * (100 + r)) / 100;
  return makeMainsIntQ({
    exam, difficulty, topic: "Compound Interest", subType: "MAINS_CI_14_LOAN_REPAYMENT",
    questionText: `A borrower takes a loan of Rs. ${loan} at ${r}% per annum Compound Interest. At the end of Year 1, they repay Rs. ${repaidYr1}. How much must they pay at the end of Year 2 to completely clear the loan?`,
    optResult: buildInterestOptions(finalPay, { prefix: "Rs. ", step: 110 }),
    solutionSteps: [
      `Amount due after Year 1 = ${loan} × 1.1 = Rs. ${afterYr1}`,
      `Remaining principal = ${afterYr1} - ${repaidYr1} = Rs. ${balance}`,
      `Final payment after Year 2 = ${balance} × 1.1 = Rs. ${finalPay}`,
    ],
  });
}

export const MAINS_SI_MAP = {
  1: mainsSI1ChangingRates,
  2: mainsSI2TwoAmounts,
  3: mainsSI3SchemeDivision,
  4: mainsSI4CompareMulti,
};

export const MAINS_CI_MAP = {
  5: mainsCI5ChangingRates,
  6: mainsCI6DiffCompounding,
  7: mainsCI7HalfQuarterly,
  8: mainsCI8DiffSICI3Years,
  9: mainsCI9PopGrowth,
  10: mainsCI10Depreciation,
  11: mainsCI11SuccessiveGrowth,
  12: mainsCI12RatioCI,
  13: mainsCI13Installment,
  14: mainsCI14LoanRepayment,
};

export const MAINS_INTEREST_MAP = { ...MAINS_SI_MAP, ...MAINS_CI_MAP };