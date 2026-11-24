// Place at: server/question-engine/generators/quant/percentage/prelimsPercentageTypes.js
import { randInt, pickRandom, shuffle } from "../../../core/mathUtils.js";

/**
 * Builds 5 unique formatted options (with optional prefix/suffix like "Rs. " or "%").
 */
export function buildUnitOptions(correctVal, { prefix = "", suffix = "", step = 5, decimals = 0 } = {}) {
  const format = (v) => `${prefix}${decimals > 0 ? Number(v).toFixed(decimals) : Math.round(v)}${suffix}`;
  const correctStr = format(correctVal);
  const distractors = new Set();
  const multipliers = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6];

  let guard = 0;
  while (distractors.size < 4 && guard < 200) {
    guard++;
    const cand = Number(correctVal) + pickRandom(multipliers) * step;
    if (cand > 0) {
      const str = format(cand);
      if (str !== correctStr) distractors.add(str);
    }
  }
  let extra = 1;
  while (distractors.size < 4) {
    const str = format(Number(correctVal) + extra * step);
    if (str !== correctStr) distractors.add(str);
    extra++;
  }

  const options = shuffle([correctStr, ...distractors]);
  return {
    options,
    correctOptionIndex: options.indexOf(correctStr),
    answer: correctStr,
  };
}

function makePctQuestion({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `PCT_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Percentage",
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

// 1. Basic Percentage Calculation
export function prelimsPct1Basic(exam, difficulty) {
  const p1 = pickRandom([10, 15, 20, 25, 30, 40, 50]);
  const p2 = pickRandom([10, 20, 25, 30, 40, 60]);
  const n1 = randInt(2, 12) * 40;
  const n2 = randInt(2, 10) * 50;
  const v1 = (p1 * n1) / 100;
  const v2 = (p2 * n2) / 100;
  const ans = v1 + v2;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_1_BASIC",
    questionText: `What is the value of ${p1}% of ${n1} + ${p2}% of ${n2}?`,
    optResult: buildUnitOptions(ans, { step: 5 }),
    solutionSteps: [
      `${p1}% of ${n1} = ${v1}`,
      `${p2}% of ${n2} = ${v2}`,
      `Total = ${v1} + ${v2} = ${ans}`,
    ],
  });
}

// 2. Fraction to Percentage Conversion
export function prelimsPct2FractionToPct(exam, difficulty) {
  const pairs = [
    [3, 8, 37.5], [5, 8, 62.5], [7, 8, 87.5],
    [3, 5, 60], [4, 5, 80], [7, 20, 35],
    [9, 20, 45], [11, 25, 44], [13, 25, 52],
    [17, 20, 85], [3, 16, 18.75], [5, 16, 31.25],
  ];
  const [num, den, pct] = pickRandom(pairs);
  const decimals = Number.isInteger(pct) ? 0 : pct * 10 % 1 === 0 ? 1 : 2;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_2_FRACTION_TO_PCT",
    questionText: `Express the fraction ${num}/${den} as a percentage.`,
    optResult: buildUnitOptions(pct, { suffix: "%", step: decimals ? 2.5 : 4, decimals }),
    solutionSteps: [
      `Percentage = (${num}/${den}) × 100`,
      `= ${decimals > 0 ? pct.toFixed(decimals) : pct}%`,
    ],
  });
}

// 3. Find Percentage of a Number
export function prelimsPct3PctOfNumber(exam, difficulty) {
  const pct = pickRandom([12, 15, 18, 24, 32, 35, 45, 65, 75]);
  const base = randInt(4, 24) * 50;
  const ans = (pct * base) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_3_PCT_OF_NUMBER",
    questionText: `Find ${pct}% of ${base}.`,
    optResult: buildUnitOptions(ans, { step: 6 }),
    solutionSteps: [
      `${pct}% of ${base} = (${pct} / 100) × ${base} = ${ans}`,
    ],
  });
}

// 4. Find a Number from Given Percentage
export function prelimsPct4NumberFromPct(exam, difficulty) {
  const pct = pickRandom([15, 20, 25, 30, 35, 40, 45, 60, 75]);
  const whole = randInt(6, 30) * 40;
  const part = (pct * whole) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_4_NUMBER_FROM_PCT",
    questionText: `If ${pct}% of a number is ${part}, what is the number?`,
    optResult: buildUnitOptions(whole, { step: 20 }),
    solutionSteps: [
      `Let the number be N. (${pct}/100) × N = ${part}`,
      `N = (${part} × 100) / ${pct} = ${whole}`,
    ],
  });
}

// 5. Find What Percentage One Number Is of Another
export function prelimsPct5WhatPctOfAnother(exam, difficulty) {
  const pct = pickRandom([15, 20, 25, 30, 35, 40, 45, 60, 65, 75, 80]);
  const b = randInt(4, 25) * 20;
  const a = (pct * b) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_5_WHAT_PCT_OF_ANOTHER",
    questionText: `${a} is what percentage of ${b}?`,
    optResult: buildUnitOptions(pct, { suffix: "%", step: 5 }),
    solutionSteps: [
      `Required % = (${a} / ${b}) × 100 = ${pct}%`,
    ],
  });
}

// 6. Percentage Increase and Decrease
export function prelimsPct6IncreaseDecrease(exam, difficulty) {
  const isIncrease = Math.random() < 0.5;
  const pct = pickRandom([10, 15, 20, 25, 30, 40]);
  const orig = randInt(5, 30) * 40;
  const delta = (orig * pct) / 100;
  const ans = isIncrease ? orig + delta : orig - delta;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_6_INC_DEC",
    questionText: `A value of ${orig} is ${isIncrease ? "increased" : "decreased"} by ${pct}%. What is the new value?`,
    optResult: buildUnitOptions(ans, { step: 15 }),
    solutionSteps: [
      `Change = ${pct}% of ${orig} = ${delta}`,
      `New value = ${orig} ${isIncrease ? "+" : "-"} ${delta} = ${ans}`,
    ],
  });
}

// 7. Successive Percentage Change
export function prelimsPct7Successive(exam, difficulty) {
  const a = pickRandom([10, 20, 25, 30]);
  const b = pickRandom([10, 20, 25, 40]);
  const net = a + b + (a * b) / 100;
  const decimals = Number.isInteger(net) ? 0 : 1;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_7_SUCCESSIVE",
    questionText: `A number is first increased by ${a}% and then again increased by ${b}%. What is the overall percentage increase?`,
    optResult: buildUnitOptions(net, { suffix: "%", step: 2, decimals }),
    solutionSteps: [
      `Use successive formula: a + b + (ab / 100)`,
      `= ${a} + ${b} + (${a} × ${b} / 100) = ${net}%`,
    ],
  });
}

// 8. Net Percentage Change (+a% then -b%)
export function prelimsPct8NetChange(exam, difficulty) {
  const pairs = [
    [25, 20], [30, 20], [40, 20], [50, 20], [20, 10], [40, 25], [60, 25],
  ];
  const [a, b] = pickRandom(pairs);
  const net = a - b - (a * b) / 100;
  const isGain = net > 0;
  const absNet = Math.abs(net);
  const label = net === 0 ? "No change (0%)" : `${absNet}% ${isGain ? "increase" : "decrease"}`;
  const distractors = [
    `${absNet + 2}% ${isGain ? "increase" : "decrease"}`,
    `${absNet + 4}% ${isGain ? "increase" : "decrease"}`,
    `${Math.max(1, absNet + 3)}% ${isGain ? "decrease" : "increase"}`,
    `${Math.max(2, a - b)}% increase`,
  ];
  const unique = [...new Set([label, ...distractors])].slice(0, 5);
  while (unique.length < 5) unique.push(`${absNet + unique.length * 3}% increase`);
  const options = shuffle(unique);
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_8_NET_CHANGE",
    questionText: `The price of an article is first increased by ${a}% and then decreased by ${b}%. What is the net percentage change in its price?`,
    optResult: { options, correctOptionIndex: options.indexOf(label), answer: label },
    solutionSteps: [
      `Net % change = +${a} - ${b} - (${a} × ${b}) / 100 = ${net}%`,
      `Result: ${label}`,
    ],
  });
}

// 9. More Than / Less Than Percentage (If A is X% more than B, B is what % less than A?)
export function prelimsPct9MoreLess(exam, difficulty) {
  const pairs = [
    [25, 20], // 25% more -> 20% less
    [60, 37.5],
    [100, 50],
    [20, 16.67], // skip non-terminating -> use clean exact pairs only:
  ];
  const cleanPairs = [
    { more: 25, less: 20, dec: 0 },
    { more: 60, less: 37.5, dec: 1 },
    { more: 100, less: 50, dec: 0 },
    { more: 150, less: 60, dec: 0 },
    { more: 300, less: 75, dec: 0 },
  ];
  const p = pickRandom(cleanPairs);
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_9_MORE_LESS",
    questionText: `If A's salary is ${p.more}% more than B's salary, then by what percentage is B's salary less than A's salary?`,
    optResult: buildUnitOptions(p.less, { suffix: "%", step: 2.5, decimals: p.dec }),
    solutionSteps: [
      `Required % less = [R / (100 + R)] × 100 = [${p.more} / ${100 + p.more}] × 100 = ${p.less}%`,
    ],
  });
}

// 10. Reverse Percentage (Find original price before increase/decrease)
export function prelimsPct10ReversePct(exam, difficulty) {
  const isIncrease = Math.random() < 0.5;
  const pct = pickRandom([10, 15, 20, 25, 30]);
  const orig = randInt(8, 35) * 100;
  const finalVal = isIncrease ? (orig * (100 + pct)) / 100 : (orig * (100 - pct)) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_10_REVERSE_PCT",
    questionText: `After a ${pct}% ${isIncrease ? "increase" : "decrease"}, the price of an item becomes Rs. ${finalVal}. What was its original price?`,
    optResult: buildUnitOptions(orig, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `${isIncrease ? 100 + pct : 100 - pct}% of Original Price = Rs. ${finalVal}`,
      `Original Price = (${finalVal} × 100) / ${isIncrease ? 100 + pct : 100 - pct} = Rs. ${orig}`,
    ],
  });
}

// 11. Income, Expenditure and Savings
export function prelimsPct11IncomeExpSavings(exam, difficulty) {
  const income = randInt(20, 65) * 1000;
  const rentPct = pickRandom([20, 25, 30]);
  const foodPct = pickRandom([15, 20, 25]);
  const miscPct = pickRandom([10, 15]);
  const savePct = 100 - rentPct - foodPct - miscPct;
  const savings = (income * savePct) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_11_INCOME_SAVINGS",
    questionText: `A person earns Rs. ${income} per month. They spend ${rentPct}% on rent, ${foodPct}% on food, and ${miscPct}% on transport, saving the rest. How much do they save monthly?`,
    optResult: buildUnitOptions(savings, { prefix: "Rs. ", step: 500 }),
    solutionSteps: [
      `Total expenditure = ${rentPct}% + ${foodPct}% + ${miscPct}% = ${100 - savePct}%`,
      `Savings = ${savePct}% of Rs. ${income} = Rs. ${savings}`,
    ],
  });
}

// 12. Population Increase and Decrease (2 years)
export function prelimsPct12Population(exam, difficulty) {
  const r = pickRandom([10, 20]);
  const p0 = randInt(10, 40) * 1000;
  const p2 = (p0 * (100 + r) * (100 + r)) / 10000;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_12_POPULATION",
    questionText: `The present population of a town is ${p0}. If it increases at the rate of ${r}% per annum, what will be its population after 2 years?`,
    optResult: buildUnitOptions(p2, { step: 200 }),
    solutionSteps: [
      `Population after 2 years = ${p0} × (1 + ${r}/100)²`,
      `= ${p0} × ${(100 + r) / 100} × ${(100 + r) / 100} = ${p2}`,
    ],
  });
}

// 13. Marks-Based Percentage (Pass marks & max marks)
export function prelimsPct13Marks(exam, difficulty) {
  const passPct = pickRandom([35, 40, 45]);
  const scoredPct = passPct - pickRandom([5, 10]);
  const maxMarks = randInt(4, 12) * 100;
  const scored = (scoredPct * maxMarks) / 100;
  const failedBy = ((passPct - scoredPct) * maxMarks) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_13_MARKS",
    questionText: `To pass an examination, a candidate must score ${passPct}% of the maximum marks. A student scores ${scored} marks and fails by ${failedBy} marks. What are the maximum marks for the examination?`,
    optResult: buildUnitOptions(maxMarks, { step: 50 }),
    solutionSteps: [
      `Passing marks = ${scored} + ${failedBy} = ${scored + failedBy}`,
      `${passPct}% of Maximum Marks = ${scored + failedBy} ⇒ Maximum Marks = ${maxMarks}`,
    ],
  });
}

// 14. Election and Voting-Based Percentage
export function prelimsPct14Election(exam, difficulty) {
  const winnerPct = pickRandom([55, 58, 60, 62, 65]);
  const loserPct = 100 - winnerPct;
  const marginPct = winnerPct - loserPct;
  const totalVotes = randInt(10, 40) * 500;
  const marginVotes = (marginPct * totalVotes) / 100;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_14_ELECTION",
    questionText: `In an election between two candidates, the winning candidate received ${winnerPct}% of the total valid votes and won by a majority of ${marginVotes} votes. Find the total number of valid votes polled.`,
    optResult: buildUnitOptions(totalVotes, { step: 500 }),
    solutionSteps: [
      `Winner = ${winnerPct}%, Loser = ${loserPct}%, Majority = ${marginPct}%`,
      `${marginPct}% of Total Votes = ${marginVotes} ⇒ Total Votes = ${totalVotes}`,
    ],
  });
}

// 15. Price and Consumption-Based Percentage
export function prelimsPct15PriceConsumption(exam, difficulty) {
  const cleanPairs = [
    { inc: 25, red: 20 },
    { inc: 60, red: 37.5 },
    { inc: 100, red: 50 },
    { inc: 150, red: 60 },
  ];
  const p = pickRandom(cleanPairs);
  const dec = Number.isInteger(p.red) ? 0 : 1;
  return makePctQuestion({
    exam, difficulty, subType: "PRELIMS_PCT_15_PRICE_CONSUMPTION",
    questionText: `If the price of sugar increases by ${p.inc}%, by what percentage must a household reduce its consumption so that the total expenditure on sugar remains unchanged?`,
    optResult: buildUnitOptions(p.red, { suffix: "%", step: 2.5, decimals: dec }),
    solutionSteps: [
      `Reduction % = [R / (100 + R)] × 100 = (${p.inc} / ${100 + p.inc}) × 100 = ${p.red}%`,
    ],
  });
}

export const PRELIMS_PERCENTAGE_MAP = {
  1: prelimsPct1Basic,
  2: prelimsPct2FractionToPct,
  3: prelimsPct3PctOfNumber,
  4: prelimsPct4NumberFromPct,
  5: prelimsPct5WhatPctOfAnother,
  6: prelimsPct6IncreaseDecrease,
  7: prelimsPct7Successive,
  8: prelimsPct8NetChange,
  9: prelimsPct9MoreLess,
  10: prelimsPct10ReversePct,
  11: prelimsPct11IncomeExpSavings,
  12: prelimsPct12Population,
  13: prelimsPct13Marks,
  14: prelimsPct14Election,
  15: prelimsPct15PriceConsumption,
};