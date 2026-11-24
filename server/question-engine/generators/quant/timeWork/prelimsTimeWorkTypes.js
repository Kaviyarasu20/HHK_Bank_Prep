// Place at: server/question-engine/generators/quant/timeWork/prelimsTimeWorkTypes.js
import { randInt, pickRandom, shuffle } from "../../../core/mathUtils.js";

export function buildTWOptions(correctVal, { prefix = "", suffix = "", step = 2 } = {}) {
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

function makeTWQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `TW_P_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Time & Work",
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

// 1. Basic Work and Efficiency
export function prelimsTW1BasicEff(exam, difficulty) {
  const rate = randInt(4, 15);
  const days = randInt(6, 18);
  const totalUnits = rate * days;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_1_BASIC_EFF",
    questionText: `A worker completes ${rate} units of work every day. How many days will they take to finish a job of ${totalUnits} units?`,
    optResult: buildTWOptions(days, { suffix: " days", step: 1 }),
    solutionSteps: [`Time = Total Work / Efficiency = ${totalUnits} / ${rate} = ${days} days`],
  });
}

// 2. Individual Work (A, B or C Alone)
export function prelimsTW2IndividualAlone(exam, difficulty) {
  const triples = [
    [10, 15, 30, 5],
    [12, 24, 24, 6],
    [15, 20, 60, 10],
    [12, 15, 60, 6],
    [20, 30, 60, 10],
  ];
  const [a, b, c, together] = pickRandom(triples);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_2_INDIVIDUAL_ALONE",
    questionText: `A, B, and C working together can complete a task in ${together} days. If A alone takes ${a} days and B alone takes ${b} days, in how many days can C alone complete the task?`,
    optResult: buildTWOptions(c, { suffix: " days", step: 3 }),
    solutionSteps: [
      `1-day work of C = 1/${together} - (1/${a} + 1/${b}) = 1/${c}`,
      `C alone completes the task in ${c} days`,
    ],
  });
}

// 3. Combined Work (A + B)
export function prelimsTW3CombinedAB(exam, difficulty) {
  const pairs = [
    [10, 15, 6], [12, 24, 8], [15, 30, 10],
    [20, 30, 12], [24, 48, 16], [18, 36, 12], [20, 60, 15],
  ];
  const [a, b, ans] = pickRandom(pairs);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_3_COMBINED_AB",
    questionText: `A alone can finish a piece of work in ${a} days, and B alone can finish it in ${b} days. In how many days will they finish the work together?`,
    optResult: buildTWOptions(ans, { suffix: " days", step: 1 }),
    solutionSteps: [`Combined time = (${a} × ${b}) / (${a} + ${b}) = ${ans} days`],
  });
}

// 4. Work and Time Relationship (A is k times as fast as B)
export function prelimsTW4WorkTimeRel(exam, difficulty) {
  const k = pickRandom([2, 3]);
  const aDays = randInt(5, 16);
  const bDays = aDays * k;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_4_WORK_TIME_REL",
    questionText: `A is ${k} times as efficient as B. If A can complete a job in ${aDays} days, how many days will B alone take to complete the same job?`,
    optResult: buildTWOptions(bDays, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Time is inversely proportional to efficiency`,
      `B's time = ${k} × ${aDays} = ${bDays} days`,
    ],
  });
}

// 5. Efficiency Ratio
export function prelimsTW5EfficiencyRatio(exam, difficulty) {
  const eA = randInt(3, 6), eB = randInt(2, 5);
  const daysTogether = randInt(4, 10);
  const totalWork = (eA + eB) * daysTogether;
  // Make totalWork divisible by eA cleanly: pick daysTogether = eA * m
  const m = randInt(2, 4);
  const dTog = eA * m;
  const work = (eA + eB) * dTog;
  const aAlone = work / eA;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_5_EFFICIENCY_RATIO",
    questionText: `The efficiency ratio of A to B is ${eA} : ${eB}. Working together, they complete a job in ${dTog} days. In how many days can A alone complete the job?`,
    optResult: buildTWOptions(aAlone, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Total work = (${eA} + ${eB}) × ${dTog} = ${work} units`,
      `Time for A alone = ${work} / ${eA} = ${aAlone} days`,
    ],
  });
}

// 6. Finding Individual Work Time (From A+B and A alone)
export function prelimsTW6FindIndividual(exam, difficulty) {
  const pairs = [
    [12, 20, 30], [8, 12, 24], [10, 15, 30], [6, 10, 15], [15, 20, 60],
  ];
  const [ab, a, b] = pickRandom(pairs);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_6_FIND_INDIVIDUAL",
    questionText: `A and B together can finish a project in ${ab} days. If A alone can finish it in ${a} days, how many days will B alone take?`,
    optResult: buildTWOptions(b, { suffix: " days", step: 2 }),
    solutionSteps: [`B's time = (${a} × ${ab}) / (${a} - ${ab}) = ${b} days`],
  });
}

// 7. Alternate-Day Work (Exact cycle completion)
export function prelimsTW7AlternateDay(exam, difficulty) {
  // Choose rates rA, rB and exact k full 2-day cycles => totalWork = k * (rA + rB)
  // Pick aDays, bDays such that W = lcm(aDays, bDays) is divisible by (rA + rB)
  const cleanSets = [
    { a: 12, b: 24, ans: 16 }, // W=24, rA=2, rB=1, 2-day=3 => 8 cycles = 16 days
    { a: 10, b: 15, ans: 12 }, // W=30, rA=3, rB=2, 2-day=5 => 6 cycles = 12 days
    { a: 20, b: 30, ans: 24 }, // W=60, rA=3, rB=2, 2-day=5 => 12 cycles = 24 days
    { a: 15, b: 30, ans: 20 }, // W=30, rA=2, rB=1, 2-day=3 => 10 cycles = 20 days
    { a: 18, b: 36, ans: 24 }, // W=36, rA=2, rB=1, 2-day=3 => 12 cycles = 24 days
  ];
  const item = pickRandom(cleanSets);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_7_ALTERNATE_DAY",
    questionText: `A can complete a work in ${item.a} days and B can complete it in ${item.b} days. If they work on alternate days starting with A, in how many days will the work be completed?`,
    optResult: buildTWOptions(item.ans, { suffix: " days", step: 2 }),
    solutionSteps: [
      `In 2 days (1 cycle), A + B finish (1/${item.a} + 1/${item.b}) of the work`,
      `Total cycles = ${item.ans / 2} ⇒ Total time = ${item.ans} days`,
    ],
  });
}

// 8. A Leaves and B Completes the Work
export function prelimsTW8ALeavesBFinishes(exam, difficulty) {
  const a = 20, b = 30; // W = 60, rA = 3, rB = 2
  const togetherDays = pickRandom([4, 6, 8]);
  const done = togetherDays * 5;
  const rem = 60 - done;
  const bRemDays = rem / 2;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_8_A_LEAVES",
    questionText: `A and B can finish a work in ${a} days and ${b} days respectively. They work together for ${togetherDays} days, after which A leaves. In how many more days will B finish the remaining work?`,
    optResult: buildTWOptions(bRemDays, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Let Total Work = 60 units (A = 3 u/day, B = 2 u/day)`,
      `Work done in ${togetherDays} days = ${togetherDays} × 5 = ${done} units; Remaining = ${rem} units`,
      `B finishes remaining work in ${rem} / 2 = ${bRemDays} days`,
    ],
  });
}

// 9. A Joins B After Some Days
export function prelimsTW9AJoinsB(exam, difficulty) {
  // W = 60, A = 3 u/day (20 days), B = 2 u/day (30 days)
  const bAloneDays = pickRandom([5, 10, 15]);
  const rem = 60 - bAloneDays * 2;
  const togetherDays = rem / 5;
  const totalDays = bAloneDays + togetherDays;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_9_A_JOINS_B",
    questionText: `A can do a job in 20 days and B in 30 days. B starts the job alone and after ${bAloneDays} days, A joins B until completion. In how many total days is the entire job completed?`,
    optResult: buildTWOptions(totalDays, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Total Work = 60 units (A = 3 u/day, B = 2 u/day)`,
      `B completes ${bAloneDays * 2} units in ${bAloneDays} days; Remaining = ${rem} units`,
      `Together (5 u/day) they take ${togetherDays} days ⇒ Total = ${totalDays} days`,
    ],
  });
}

// 10. Work Completed in Different Time Periods (A does 1/k of work in d days)
export function prelimsTW10DiffPeriods(exam, difficulty) {
  const fracA = pickRandom([3, 4, 5]);
  const dA = randInt(3, 6);
  const fullA = fracA * dA;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_10_DIFF_PERIODS",
    questionText: `A completes 1/${fracA} of a work in ${dA} days. How many days will A take to complete the entire work working at the same rate?`,
    optResult: buildTWOptions(fullA, { suffix: " days", step: 2 }),
    solutionSteps: [`Time for full work = ${dA} × ${fracA} = ${fullA} days`],
  });
}

// 11. Men and Work (M1 * D1 = M2 * D2)
export function prelimsTW11MenWork(exam, difficulty) {
  const sets = [
    [15, 12, 20, 9], [18, 10, 15, 12], [24, 15, 30, 12], [20, 18, 24, 15],
  ];
  const [m1, d1, m2, d2] = pickRandom(sets);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_11_MEN_WORK",
    questionText: `${m1} men can complete a construction job in ${d1} days. How many days will ${m2} men take to complete the same job?`,
    optResult: buildTWOptions(d2, { suffix: " days", step: 1 }),
    solutionSteps: [`M₁D₁ = M₂D₂ ⇒ D₂ = (${m1} × ${d1}) / ${m2} = ${d2} days`],
  });
}

// 12. Men, Days and Work (MDH / W formula)
export function prelimsTW12MenDaysHours(exam, difficulty) {
  const m1 = 12, d1 = 15, h1 = 8;
  const m2 = 18, h2 = 8;
  const d2 = (m1 * d1 * h1) / (m2 * h2); // 10 days
  const mult = pickRandom([1, 2]);
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_12_MDH",
    questionText: `${m1 * mult} workers working ${h1} hours a day complete a project in ${d1} days. In how many days will ${m2 * mult} workers working ${h2} hours a day finish the same project?`,
    optResult: buildTWOptions(d2, { suffix: " days", step: 2 }),
    solutionSteps: [`M₁D₁H₁ = M₂D₂H₂ ⇒ D₂ = (${m1 * mult} × ${d1} × ${h1}) / (${m2 * mult} × ${h2}) = ${d2} days`],
  });
}

// 13. Work and Wages
export function prelimsTW13Wages(exam, difficulty) {
  const rA = 3, rB = 2; // A = 20 days, B = 30 days
  const unitWage = randInt(4, 15) * 100;
  const totalWage = (rA + rB) * unitWage;
  const shareA = rA * unitWage;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_13_WAGES",
    questionText: `A can complete a job in 20 days and B in 30 days. They undertake to do it together for Rs. ${totalWage}. What is A's share of the wages?`,
    optResult: buildTWOptions(shareA, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `Efficiency ratio A : B = 30 : 20 = 3 : 2`,
      `A's share = (3 / 5) × ${totalWage} = Rs. ${shareA}`,
    ],
  });
}

// 14. Different Efficiency Workers (A is 50% more efficient than B)
export function prelimsTW14DiffEfficiency(exam, difficulty) {
  const bDays = pickRandom([12, 18, 24, 30, 36]);
  const aDays = (bDays * 2) / 3; // 50% more efficient => 3:2 ratio => time 2:3
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_14_DIFF_EFF",
    questionText: `A is 50% more efficient than B. If B alone can complete a task in ${bDays} days, in how many days can A alone complete the same task?`,
    optResult: buildTWOptions(aDays, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Efficiency ratio A : B = 150 : 100 = 3 : 2 ⇒ Time ratio = 2 : 3`,
      `A's time = (2 / 3) × ${bDays} = ${aDays} days`,
    ],
  });
}

// 15. Partial Work and Remaining Work
export function prelimsTW15PartialRemaining(exam, difficulty) {
  const aDays = pickRandom([15, 20, 25, 30]);
  const worked = aDays / 5 * 2; // 40% done
  const remPct = 60;
  return makeTWQ({
    exam, difficulty, subType: "PRELIMS_TW_15_PARTIAL_WORK",
    questionText: `A can complete a piece of work in ${aDays} days. If A works on it for ${worked} days, what percentage of the work remains unfinished?`,
    optResult: buildTWOptions(remPct, { suffix: "%", step: 5 }),
    solutionSteps: [
      `Fraction completed = ${worked} / ${aDays} = 40%`,
      `Remaining work = 100% - 40% = 60%`,
    ],
  });
}

export const PRELIMS_TW_MAP = {
  1: prelimsTW1BasicEff,
  2: prelimsTW2IndividualAlone,
  3: prelimsTW3CombinedAB,
  4: prelimsTW4WorkTimeRel,
  5: prelimsTW5EfficiencyRatio,
  6: prelimsTW6FindIndividual,
  7: prelimsTW7AlternateDay,
  8: prelimsTW8ALeavesBFinishes,
  9: prelimsTW9AJoinsB,
  10: prelimsTW10DiffPeriods,
  11: prelimsTW11MenWork,
  12: prelimsTW12MenDaysHours,
  13: prelimsTW13Wages,
  14: prelimsTW14DiffEfficiency,
  15: prelimsTW15PartialRemaining,
};