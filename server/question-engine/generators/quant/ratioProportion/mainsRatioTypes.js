// Place at: server/question-engine/generators/quant/ratioProportion/mainsRatioTypes.js
import { randInt, pickRandom, gcd } from "../../../core/mathUtils.js";
import {
  reduceRatio,
  buildNumericUnitOptions,
  buildRatioOptions,
} from "./prelimsRatioTypes.js";

function makeMainsRatioQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `RAT_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
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

// 1. Combined Ratio Problems (A:B and B:C -> A:C or share of C)
export function mainsRatio1Combined(exam, difficulty) {
  const a = randInt(2, 5), b1 = randInt(3, 6);
  const b2 = randInt(2, 5), c = randInt(3, 7);
  const combA = a * b2, combB = b1 * b2, combC = b1 * c;
  const g = gcd(gcd(combA, combB), combC);
  const rA = combA / g, rB = combB / g, rC = combC / g;
  const unit = randInt(8, 25) * 10;
  const total = (rA + rB + rC) * unit;
  const shareB = rB * unit;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_1_COMBINED",
    questionText: `A sum of Rs. ${total} is distributed among A, B, and C such that A : B = ${a} : ${b1} and B : C = ${b2} : ${c}. Find B's share.`,
    optResult: buildNumericUnitOptions(shareB, { prefix: "Rs. ", step: 40 }),
    solutionSteps: [
      `Combined ratio A : B : C = ${rA} : ${rB} : ${rC}`,
      `Total parts = ${rA + rB + rC} ⇒ 1 part = Rs. ${unit} ⇒ B's share = Rs. ${shareB}`,
    ],
  });
}

// 2. Change in Ratio (Two numbers in ratio r1:r2; adding k gives new ratio n1:n2)
export function mainsRatio2ChangeInRatio(exam, difficulty) {
  const unit = randInt(5, 16);
  const r1 = randInt(2, 5), r2 = r1 + randInt(1, 3);
  const step = randInt(1, 3);
  const add = step * unit;
  const n1 = r1 + step, n2 = r2 + step;
  const redNew = reduceRatio(n1, n2);
  const origSum = (r1 + r2) * unit;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_2_CHANGE",
    questionText: `Two numbers are in the ratio ${r1} : ${r2}. When ${add} is added to each number, the ratio becomes ${redNew.str}. What is the sum of the two original numbers?`,
    optResult: buildNumericUnitOptions(origSum, { step: 6 }),
    solutionSteps: [
      `Both terms increase by ${step} ratio unit(s) = ${add} ⇒ 1 unit = ${unit}`,
      `Sum of original numbers = (${r1} + ${r2}) × ${unit} = ${origSum}`,
    ],
  });
}

// 3. Ratio Before and After Addition or Removal
export function mainsRatio3AddRemove(exam, difficulty) {
  const unit = randInt(6, 18);
  const b1 = randInt(3, 6), g1 = randInt(2, 5);
  const addedGirls = randInt(1, 3) * unit;
  const g2 = g1 + addedGirls / unit;
  const redNew = reduceRatio(b1, g2);
  const origTotal = (b1 + g1) * unit;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_3_ADD_REMOVE",
    questionText: `In a coaching batch, the ratio of boys to girls is ${b1} : ${g1}. If ${addedGirls} more girls join the batch, the ratio of boys to girls becomes ${redNew.str}. How many students were in the batch initially?`,
    optResult: buildNumericUnitOptions(origTotal, { step: 8 }),
    solutionSteps: [
      `Boys remain unchanged at ${b1} units; girls increase by ${g2 - g1} units = ${addedGirls}`,
      `1 unit = ${unit} ⇒ Initial students = (${b1} + ${g1}) × ${unit} = ${origTotal}`,
    ],
  });
}

// 4. Ratio-Based Mixture Problems
export function mainsRatio4Mixture(exam, difficulty) {
  const m = randInt(4, 7), w = randInt(1, 3);
  const k = randInt(5, 14);
  const total = (m + w) * k;
  const addWater = randInt(2, 5) * k;
  const newW = w * k + addWater;
  const redNew = reduceRatio(m * k, newW);
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_4_MIXTURE",
    questionText: `A vessel contains ${total} litres of a milk-and-water mixture in the ratio ${m} : ${w}. If ${addWater} litres of water are added to the vessel, what will be the new ratio of milk to water?`,
    optResult: buildRatioOptions(redNew.p, redNew.q),
    solutionSteps: [
      `Initial Milk = ${m * k} L, Initial Water = ${w * k} L`,
      `New Water = ${w * k} + ${addWater} = ${newW} L ⇒ New Ratio = ${m * k} : ${newW} = ${redNew.str}`,
    ],
  });
}

// 5. Ratio-Based Partnership with Time (Capital × Months)
export function mainsRatio5PartnershipTime(exam, difficulty) {
  const cA = randInt(3, 8), cB = randInt(4, 9);
  const mA = pickRandom([6, 8, 9, 12]), mB = pickRandom([4, 6, 8, 12]);
  const red = reduceRatio(cA * mA, cB * mB);
  const unitP = randInt(3, 12) * 100;
  const totalProfit = (red.p + red.q) * unitP;
  const shareB = red.q * unitP;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_5_PARTNERSHIP_TIME",
    questionText: `A invests Rs. ${cA * 10000} for ${mA} months and B invests Rs. ${cB * 10000} for ${mB} months in a venture. If the total profit earned is Rs. ${totalProfit}, find B's share of the profit.`,
    optResult: buildNumericUnitOptions(shareB, { prefix: "Rs. ", step: 200 }),
    solutionSteps: [
      `Profit ratio A : B = (${cA} × ${mA}) : (${cB} × ${mB}) = ${red.str}`,
      `B's share = (${red.q} / ${red.p + red.q}) × ${totalProfit} = Rs. ${shareB}`,
    ],
  });
}

// 6. Ratio-Based Income, Expenditure and Savings (Equal Savings)
export function mainsRatio6IncomeExpSavings(exam, difficulty) {
  const unit = randInt(10, 35) * 100;
  const iA = randInt(4, 7), iB = iA + randInt(1, 3);
  const saveUnits = randInt(1, 2);
  const eA = iA - saveUnits, eB = iB - saveUnits;
  const savings = saveUnits * unit;
  const incA = iA * unit;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_6_INCOME_SAVINGS",
    questionText: `The monthly incomes of A and B are in the ratio ${iA} : ${iB}, and their monthly expenditures are in the ratio ${eA} : ${eB}. If each of them saves Rs. ${savings} per month, what is A's monthly income?`,
    optResult: buildNumericUnitOptions(incA, { prefix: "Rs. ", step: 400 }),
    solutionSteps: [
      `Income - Expenditure = ${saveUnits} unit(s) for both A and B = Rs. ${savings}`,
      `1 unit = Rs. ${unit} ⇒ A's income = ${iA} × ${unit} = Rs. ${incA}`,
    ],
  });
}

// 7. Ratio-Based Population Problems
export function mainsRatio7Population(exam, difficulty) {
  const m = randInt(4, 8), f = randInt(3, 7);
  const k = randInt(10, 30) * 100;
  const total = (m + f) * k;
  const litM = 80, litF = 60;
  const totalLit = ((m * k) * litM + (f * k) * litF) / 100;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_7_POPULATION",
    questionText: `A town has a population of ${total} with males and females in the ratio ${m} : ${f}. If ${litM}% of males and ${litF}% of females are literate, find the total literate population of the town.`,
    optResult: buildNumericUnitOptions(totalLit, { step: 100 }),
    solutionSteps: [
      `Males = ${m * k}, Females = ${f * k}`,
      `Literate = (80% of ${m * k}) + (60% of ${f * k}) = ${totalLit}`,
    ],
  });
}

// 8. Ratio-Based Marks Problems
export function mainsRatio8Marks(exam, difficulty) {
  const rQ = randInt(3, 6), rR = randInt(4, 7), rE = randInt(2, 5);
  const k = randInt(4, 10);
  const total = (rQ + rR + rE) * k;
  const diffQR = Math.abs(rQ - rR) * k;
  const englishMarks = rE * k;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_8_MARKS",
    questionText: `An aspirant's marks in Quant, Reasoning, and English are in the ratio ${rQ} : ${rR} : ${rE}. If their total score across all three sections is ${total} marks, how many marks did they score in English?`,
    optResult: buildNumericUnitOptions(englishMarks, { step: 3 }),
    solutionSteps: [
      `Total parts = ${rQ + rR + rE} ⇒ 1 part = ${total} / ${rQ + rR + rE} = ${k}`,
      `English marks = ${rE} × ${k} = ${englishMarks} (Quant-Reasoning diff = ${diffQR})`,
    ],
  });
}

// 9. Ratio-Based Distribution Problems (Coin Bag: Rs. 1, Rs. 2, Rs. 5)
export function mainsRatio9CoinsDistribution(exam, difficulty) {
  const r1 = randInt(2, 5), r2 = randInt(3, 6), r5 = randInt(2, 5);
  const k = randInt(6, 20);
  const valuePerUnit = r1 * 1 + r2 * 2 + r5 * 5;
  const totalRs = valuePerUnit * k;
  const fiveRsCoins = r5 * k;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_9_COINS_DISTRIBUTION",
    questionText: `A bag contains Rs. 1, Rs. 2, and Rs. 5 coins in the ratio ${r1} : ${r2} : ${r5}. If the total value of all coins in the bag is Rs. ${totalRs}, how many Rs. 5 coins are there?`,
    optResult: buildNumericUnitOptions(fiveRsCoins, { step: 4 }),
    solutionSteps: [
      `Value per ratio unit = (${r1}×1) + (${r2}×2) + (${r5}×5) = Rs. ${valuePerUnit}`,
      `Multiplier k = ${totalRs} / ${valuePerUnit} = ${k} ⇒ Rs. 5 coins = ${r5} × ${k} = ${fiveRsCoins}`,
    ],
  });
}

// 10. Multiple Ratios (Three or More Variables: A:B, B:C, C:D -> Find A:D)
export function mainsRatio10MultipleVars(exam, difficulty) {
  const a = randInt(2, 5), b = randInt(3, 6);
  const c = randInt(2, 5), d = randInt(3, 7);
  const e = randInt(2, 5), f = randInt(3, 6);
  const redAD = reduceRatio(a * c * e, b * d * f);
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_10_MULTIPLE_VARS",
    questionText: `If A : B = ${a} : ${b}, B : C = ${c} : ${d}, and C : D = ${e} : ${f}, find the ratio A : D.`,
    optResult: buildRatioOptions(redAD.p, redAD.q),
    solutionSteps: [
      `A / D = (A/B) × (B/C) × (C/D) = (${a}/${b}) × (${c}/${d}) × (${e}/${f})`,
      `= ${a * c * e} / ${b * d * f} = ${redAD.str}`,
    ],
  });
}

// 11. Ratio-Based Data Interpretation (Mini Table)
export function mainsRatio11MiniDI(exam, difficulty) {
  const k1 = randInt(4, 10) * 10, k2 = randInt(4, 10) * 10;
  const p1 = randInt(3, 5), q1 = randInt(2, 4);
  const p2 = randInt(2, 5), q2 = randInt(3, 6);
  const total1 = (p1 + q1) * k1;
  const total2 = (p2 + q2) * k2;
  const totalOfficers = p1 * k1 + p2 * k2;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_11_MINI_DI",
    questionText: `Study the bank recruitment data:\n• Zone X: Total Recruits = ${total1}, Officers : Clerks = ${p1} : ${q1}\n• Zone Y: Total Recruits = ${total2}, Officers : Clerks = ${p2} : ${q2}\nWhat is the total number of Officers recruited in Zone X and Zone Y together?`,
    optResult: buildNumericUnitOptions(totalOfficers, { step: 20 }),
    solutionSteps: [
      `Zone X Officers = (${p1}/${p1 + q1}) × ${total1} = ${p1 * k1}`,
      `Zone Y Officers = (${p2}/${p2 + q2}) × ${total2} = ${p2 * k2}`,
      `Total Officers = ${p1 * k1} + ${p2 * k2} = ${totalOfficers}`,
    ],
  });
}

// 12. Ratio-Based Caselet Problems
export function mainsRatio12Caselet(exam, difficulty) {
  const k = randInt(6, 15) * 10;
  const rSav = randInt(3, 5), rCur = randInt(2, 4), rFix = randInt(2, 5);
  const totalAccounts = (rSav + rCur + rFix) * k;
  const savAcc = rSav * k, curAcc = rCur * k, fixAcc = rFix * k;
  const diffSavFix = Math.abs(savAcc - fixAcc) + curAcc;
  return makeMainsRatioQ({
    exam, difficulty, subType: "MAINS_RATIO_12_CASELET",
    questionText: `A bank branch opened ${totalAccounts} new accounts in a quarter across Savings, Current, and Fixed Deposit categories in the ratio ${rSav} : ${rCur} : ${rFix}. What is the combined total of Current accounts and the absolute difference between Savings and Fixed Deposit accounts?`,
    optResult: buildNumericUnitOptions(diffSavFix, { step: 15 }),
    solutionSteps: [
      `1 ratio unit = ${totalAccounts} / ${rSav + rCur + rFix} = ${k}`,
      `Savings = ${savAcc}, Current = ${curAcc}, Fixed = ${fixAcc}`,
      `Required value = ${curAcc} + |${savAcc} - ${fixAcc}| = ${diffSavFix}`,
    ],
  });
}

export const MAINS_RATIO_MAP = {
  1: mainsRatio1Combined,
  2: mainsRatio2ChangeInRatio,
  3: mainsRatio3AddRemove,
  4: mainsRatio4Mixture,
  5: mainsRatio5PartnershipTime,
  6: mainsRatio6IncomeExpSavings,
  7: mainsRatio7Population,
  8: mainsRatio8Marks,
  9: mainsRatio9CoinsDistribution,
  10: mainsRatio10MultipleVars,
  11: mainsRatio11MiniDI,
  12: mainsRatio12Caselet,
};