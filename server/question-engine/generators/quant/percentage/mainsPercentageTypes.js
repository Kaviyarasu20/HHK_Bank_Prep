// Place at: server/question-engine/generators/quant/percentage/mainsPercentageTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildUnitOptions } from "./prelimsPercentageTypes.js";

function makeMainsPctQuestion({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `PCT_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
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

// 1. Successive Percentage Change (3-step change on an exact base)
export function mainsPct1Successive3Step(exam, difficulty) {
  const base = randInt(4, 15) * 1000;
  const r1 = pickRandom([10, 20, 25]);
  const r2 = pickRandom([10, 20]);
  const r3 = pickRandom([10, 20, 25]);
  const after1 = (base * (100 + r1)) / 100;
  const after2 = (after1 * (100 - r2)) / 100;
  const finalVal = (after2 * (100 + r3)) / 100;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_1_SUCCESSIVE_3STEP",
    questionText: `The value of an investment of Rs. ${base} increases by ${r1}% in Year 1, decreases by ${r2}% in Year 2, and increases by ${r3}% in Year 3. What is its value at the end of Year 3?`,
    optResult: buildUnitOptions(finalVal, { prefix: "Rs. ", step: 120 }),
    solutionSteps: [
      `After Year 1 (+${r1}%): Rs. ${after1}`,
      `After Year 2 (-${r2}%): Rs. ${after2}`,
      `After Year 3 (+${r3}%): Rs. ${finalVal}`,
    ],
  });
}

// 2. Reverse Percentage with Multiple Changes
export function mainsPct2ReverseMultiple(exam, difficulty) {
  const orig = randInt(5, 20) * 1000;
  const r1 = pickRandom([20, 25]);
  const r2 = pickRandom([10, 20]);
  const after1 = (orig * (100 + r1)) / 100;
  const finalVal = (after1 * (100 - r2)) / 100;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_2_REVERSE_MULTIPLE",
    questionText: `A machine's price was first raised by ${r1}% and later discounted by ${r2}%, bringing its final selling price to Rs. ${finalVal}. What was the original price of the machine?`,
    optResult: buildUnitOptions(orig, { prefix: "Rs. ", step: 250 }),
    solutionSteps: [
      `Effective multiplier = ${(100 + r1) / 100} × ${(100 - r2) / 100} = ${((100 + r1) * (100 - r2)) / 10000}`,
      `Original Price = ${finalVal} ÷ ${((100 + r1) * (100 - r2)) / 10000} = Rs. ${orig}`,
    ],
  });
}

// 3. Percentage-Based Ratio Problems
export function mainsPct3PctRatio(exam, difficulty) {
  const unit = randInt(4, 12) * 50;
  const rA = randInt(3, 6), rB = randInt(4, 8);
  const a = rA * unit, b = rB * unit;
  const incA = pickRandom([20, 25, 40]);
  const incB = pickRandom([10, 20, 25]);
  const newA = (a * (100 + incA)) / 100;
  const newB = (b * (100 + incB)) / 100;
  const totalNew = newA + newB;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_3_PCT_RATIO",
    questionText: `The salaries of A and B are in the ratio ${rA} : ${rB}, and their combined salary is Rs. ${a + b}. If A's salary increases by ${incA}% and B's salary increases by ${incB}%, what is their new combined salary?`,
    optResult: buildUnitOptions(totalNew, { prefix: "Rs. ", step: 150 }),
    solutionSteps: [
      `Original salaries: A = Rs. ${a}, B = Rs. ${b}`,
      `New A (+${incA}%) = Rs. ${newA}; New B (+${incB}%) = Rs. ${newB}`,
      `New combined salary = Rs. ${newA} + Rs. ${newB} = Rs. ${totalNew}`,
    ],
  });
}

// 4. Income, Expenditure and Savings (Nested "of the remaining" spending)
export function mainsPct4NestedIncome(exam, difficulty) {
  const income = randInt(10, 30) * 2500;
  const p1 = pickRandom([20, 25]);
  const p2 = pickRandom([20, 40]);
  const p3 = pickRandom([25, 50]);
  const rem1 = (income * (100 - p1)) / 100;
  const rem2 = (rem1 * (100 - p2)) / 100;
  const savings = (rem2 * (100 - p3)) / 100;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_4_NESTED_INCOME",
    questionText: `An officer spends ${p1}% of their monthly income on house rent, ${p2}% of the remaining on household expenses, and ${p3}% of the remaining on investments. If they are finally left with Rs. ${savings} as cash savings, what is their monthly income?`,
    optResult: buildUnitOptions(income, { prefix: "Rs. ", step: 1000 }),
    solutionSteps: [
      `Remaining factor = ${(100 - p1) / 100} × ${(100 - p2) / 100} × ${(100 - p3) / 100}`,
      `Income = ${savings} ÷ (${(100 - p1) / 100} × ${(100 - p2) / 100} × ${(100 - p3) / 100}) = Rs. ${income}`,
    ],
  });
}

// 5. Population Growth and Decline (Male + Female differential growth)
export function mainsPct5PopGrowthDecline(exam, difficulty) {
  const males = randInt(4, 12) * 1000;
  const females = randInt(4, 12) * 1000;
  const total = males + females;
  const mPct = pickRandom([10, 15, 20]);
  const fPct = pickRandom([5, 10, 12]);
  const newMales = (males * (100 + mPct)) / 100;
  const newFemales = (females * (100 + fPct)) / 100;
  const newTotal = newMales + newFemales;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_5_POP_MALE_FEMALE",
    questionText: `The population of a town is ${total}. In one year, the male population increases by ${mPct}% and the female population increases by ${fPct}%, making the total population ${newTotal}. What was the initial male population of the town?`,
    optResult: buildUnitOptions(males, { step: 500 }),
    solutionSteps: [
      `Let initial males = M and females = ${total} - M`,
      `(${mPct}% of M) + (${fPct}% of (${total} - M)) = ${newTotal - total}`,
      `Solving gives initial male population M = ${males}`,
    ],
  });
}

// 6. Election and Voting Problems (Abstentions + Invalid Votes + Majority)
export function mainsPct6ElectionComplex(exam, difficulty) {
  const registered = randInt(10, 30) * 2000;
  const votedPct = pickRandom([80, 90]);
  const votesCast = (registered * votedPct) / 100;
  const invalidPct = pickRandom([10, 20]);
  const validVotes = (votesCast * (100 - invalidPct)) / 100;
  const winnerPct = pickRandom([55, 60, 65]);
  const marginVotes = (validVotes * (2 * winnerPct - 100)) / 100;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_6_ELECTION_COMPLEX",
    questionText: `In an election, ${100 - votedPct}% of registered voters did not cast their votes, and ${invalidPct}% of the votes polled were declared invalid. The winning candidate received ${winnerPct}% of the valid votes and won by a majority of ${marginVotes} votes. Find the total number of registered voters.`,
    optResult: buildUnitOptions(registered, { step: 1000 }),
    solutionSteps: [
      `Valid votes = ${votedPct}% × ${100 - invalidPct}% of Registered = ${validVotes}`,
      `Winner majority = (${winnerPct}% - ${100 - winnerPct}%) = ${2 * winnerPct - 100}% of Valid Votes = ${marginVotes}`,
      `Total registered voters = ${registered}`,
    ],
  });
}

// 7. Price, Consumption and Expenditure (Budget fixed, find original price per kg)
export function mainsPct7PriceConsumptionExp(exam, difficulty) {
  const origPrice = pickRandom([20, 25, 40, 50, 80]);
  const redPct = 20; // 20% price drop => 25% more quantity
  const newPrice = (origPrice * (100 - redPct)) / 100;
  const extraKg = randInt(3, 8);
  const origKg = extraKg * 4;
  const budget = origPrice * origKg;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_7_PRICE_CONSUMPTION_EXP",
    questionText: `A reduction of ${redPct}% in the price of rice enables a buyer to purchase ${extraKg} kg more rice for Rs. ${budget}. What was the original price of rice per kg?`,
    optResult: buildUnitOptions(origPrice, { prefix: "Rs. ", step: 5 }),
    solutionSteps: [
      `20% of Rs. ${budget} = Rs. ${(budget * 20) / 100} buys the extra ${extraKg} kg`,
      `Reduced price = Rs. ${(budget * 20) / 100} ÷ ${extraKg} = Rs. ${newPrice}/kg`,
      `Original price = Rs. ${newPrice} ÷ 0.8 = Rs. ${origPrice}/kg`,
    ],
  });
}

// 8. Percentage-Based Data Interpretation (Mini Table)
export function mainsPct8MiniDI(exam, difficulty) {
  const empA = randInt(4, 10) * 100;
  const empB = randInt(4, 10) * 100;
  const empC = randInt(4, 10) * 100;
  const femA = pickRandom([30, 40, 45]);
  const femB = pickRandom([25, 35, 50]);
  const femC = pickRandom([40, 55, 60]);
  const totalFemales = (empA * femA + empB * femB + empC * femC) / 100;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_8_MINI_DI",
    questionText: `Study the branch staffing summary below:\n• Branch A: Total Staff = ${empA}, Female = ${femA}%\n• Branch B: Total Staff = ${empB}, Female = ${femB}%\n• Branch C: Total Staff = ${empC}, Female = ${femC}%\nWhat is the total number of female employees across all three branches together?`,
    optResult: buildUnitOptions(totalFemales, { step: 25 }),
    solutionSteps: [
      `Branch A females = ${femA}% of ${empA} = ${(empA * femA) / 100}`,
      `Branch B females = ${femB}% of ${empB} = ${(empB * femB) / 100}`,
      `Branch C females = ${femC}% of ${empC} = ${(empC * femC) / 100}`,
      `Total female employees = ${totalFemales}`,
    ],
  });
}

// 9. Percentage-Based Caselet
export function mainsPct9Caselet(exam, difficulty) {
  const total = randInt(5, 15) * 200;
  const retailPct = pickRandom([40, 45, 50]);
  const corpPct = 100 - retailPct;
  const retailDigitalPct = pickRandom([60, 70, 80]);
  const corpDigitalPct = pickRandom([50, 60, 75]);
  const retailDigital = (((total * retailPct) / 100) * retailDigitalPct) / 100;
  const corpDigital = (((total * corpPct) / 100) * corpDigitalPct) / 100;
  const totalDigital = retailDigital + corpDigital;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_9_CASELET",
    questionText: `A bank processed ${total} loan applications in a quarter. ${retailPct}% of the applications were Retail Loans and the rest were Corporate Loans. Among Retail Loans, ${retailDigitalPct}% were submitted digitally, while ${corpDigitalPct}% of Corporate Loans were submitted digitally. How many loan applications in total were submitted digitally?`,
    optResult: buildUnitOptions(totalDigital, { step: 20 }),
    solutionSteps: [
      `Retail Loans = ${(total * retailPct) / 100} ⇒ Digital Retail = ${retailDigital}`,
      `Corporate Loans = ${(total * corpPct) / 100} ⇒ Digital Corporate = ${corpDigital}`,
      `Total Digital Applications = ${retailDigital} + ${corpDigital} = ${totalDigital}`,
    ],
  });
}

// 10. Percentage Comparison Across Multiple Groups (A vs B vs C)
export function mainsPct10MultiGroupCompare(exam, difficulty) {
  const cVal = randInt(4, 15) * 100;
  const bPctMore = pickRandom([20, 25, 50]);
  const aPctMore = pickRandom([20, 25, 40]);
  const bVal = (cVal * (100 + bPctMore)) / 100;
  const aVal = (bVal * (100 + aPctMore)) / 100;
  const netPct = ((aVal - cVal) * 100) / cVal;
  return makeMainsPctQuestion({
    exam, difficulty, subType: "MAINS_PCT_10_MULTI_GROUP_COMPARE",
    questionText: `In a quarterly target review, Branch B achieved ${bPctMore}% more deposits than Branch C, and Branch A achieved ${aPctMore}% more deposits than Branch B. By what percentage are Branch A's deposits greater than Branch C's deposits?`,
    optResult: buildUnitOptions(netPct, { suffix: "%", step: 4 }),
    solutionSteps: [
      `Let C = 100 ⇒ B = ${100 + bPctMore}`,
      `A = ${100 + bPctMore} × ${(100 + aPctMore) / 100} = ${100 + netPct}`,
      `Branch A is ${netPct}% greater than Branch C`,
    ],
  });
}

export const MAINS_PERCENTAGE_MAP = {
  1: mainsPct1Successive3Step,
  2: mainsPct2ReverseMultiple,
  3: mainsPct3PctRatio,
  4: mainsPct4NestedIncome,
  5: mainsPct5PopGrowthDecline,
  6: mainsPct6ElectionComplex,
  7: mainsPct7PriceConsumptionExp,
  8: mainsPct8MiniDI,
  9: mainsPct9Caselet,
  10: mainsPct10MultiGroupCompare,
};