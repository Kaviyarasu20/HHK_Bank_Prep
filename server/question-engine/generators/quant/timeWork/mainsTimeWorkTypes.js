// Place at: server/question-engine/generators/quant/timeWork/mainsTimeWorkTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildTWOptions } from "./prelimsTimeWorkTypes.js";

function makeMainsTWQ({ exam, difficulty, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `TW_M_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
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

// 1. Complex Combined Work (A+B, B+C, C+A pairs -> find A+B+C)
export function mainsTW1PairwiseCombined(exam, difficulty) {
  const sets = [
    { ab: 12, bc: 15, ca: 20, abc: 10 }, // W=60: 5+4+3=12 => 2(A+B+C)=12 => A+B+C=6 => 10 days
    { ab: 24, bc: 30, ca: 40, abc: 20 },
    { ab: 10, bc: 12, ca: 15, abc: 8 },  // W=60: 6+5+4=15 => A+B+C=7.5 => 8 days
  ];
  const s = pickRandom(sets);
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_1_PAIRWISE_COMBINED",
    questionText: `A and B together can finish a job in ${s.ab} days, B and C in ${s.bc} days, and C and A in ${s.ca} days. In how many days can A, B, and C all working together complete the job?`,
    optResult: buildTWOptions(s.abc, { suffix: " days", step: 1 }),
    solutionSteps: [
      `2(A + B + C) 1-day work = 1/${s.ab} + 1/${s.bc} + 1/${s.ca} = 2/${s.abc}`,
      `A + B + C finish together in ${s.abc} days`,
    ],
  });
}

// 2. Alternate-Day Work with Different Efficiencies (A works daily; assisted by B & C on alternate days)
export function mainsTW2AlternateAssisted(exam, difficulty) {
  // W = 60: A=3/day (20d), B=2/day (30d), C=1/day (60d)
  // Day 1: A+B = 5; Day 2: A+C = 4 -> 2 days = 9 -> pick clean 2-day divisor of 60:
  // A=4/day (15d), B=2/day (30d), C=2/day (30d) -> 2 days = 12 => 5 cycles = 10 days
  // Better distinct: W=60, A=3/day (20d), B=4/day (15d), C=2/day (30d) -> Day1=7, Day2=5 -> 2 days = 12 => 5 cycles = 10 days!
  const mult = pickRandom([1, 2]);
  const a = 20 * mult, b = 15 * mult, c = 30 * mult;
  const ans = 10 * mult;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_2_ALTERNATE_ASSISTED",
    questionText: `A, B, and C can individually complete a work in ${a}, ${b}, and ${c} days respectively. A works every day and is assisted by B on Day 1, C on Day 2, B on Day 3, C on Day 4, and so on. In how many days will the work be completed?`,
    optResult: buildTWOptions(ans, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Take Total Work = ${60 * mult} units (A = 3, B = 4, C = 2 units/day)`,
      `Day 1 (A+B) = 7 units; Day 2 (A+C) = 5 units ⇒ 2 days = 12 units`,
      `Total cycles = ${60 * mult} / 12 = ${5 * mult} cycles = ${ans} days`,
    ],
  });
}

// 3. A and B Start Together, Then One Leaves k Days Before Completion
export function mainsTW3LeavesBeforeEnd(exam, difficulty) {
  // W = 60: A = 3/day (20d), B = 2/day (30d). A leaves 5 days before completion -> B does 5*2=10 alone -> A+B do 50 => 10 days -> Total = 15 days
  const leaveBefore = pickRandom([5, 10]);
  const bLast = leaveBefore * 2;
  const togetherDays = (60 - bLast) / 5;
  const totalDays = togetherDays + leaveBefore;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_3_LEAVES_BEFORE_END",
    questionText: `A and B can complete a task in 20 days and 30 days respectively. They start working together, but A leaves ${leaveBefore} days before the task is completed. In how many total days is the task finished?`,
    optResult: buildTWOptions(totalDays, { suffix: " days", step: 1 }),
    solutionSteps: [
      `Total Work = 60 units (A = 3 u/day, B = 2 u/day)`,
      `In the last ${leaveBefore} days, B does ${bLast} units alone; A + B did ${60 - bLast} units in ${togetherDays} days`,
      `Total days = ${togetherDays} + ${leaveBefore} = ${totalDays} days`,
    ],
  });
}

// 4. Workers Joining and Leaving at Different Intervals
export function mainsTW4StaggeredIntervals(exam, difficulty) {
  // W = 60: A=5/day (12d), B=4/day (15d), C=3/day (20d)
  // A & B work for 3 days -> 3*9 = 27 units. Then A leaves, C joins B (B+C = 7/day)? Pick clean:
  // A & B work for 4 days -> 4*9 = 36 units; remaining 24 units finished by B alone (4/day) = 6 days -> total 10 days
  const abDays = 4;
  const bAloneDays = (60 - abDays * 9) / 4; // 6 days
  const total = abDays + bAloneDays;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_4_STAGGERED",
    questionText: `A, B, and C can complete a project in 12, 15, and 20 days respectively. A and B start together and work for ${abDays} days, after which A leaves and B continues alone to finish the remaining work. How many total days does the project take?`,
    optResult: buildTWOptions(total, { suffix: " days", step: 1 }),
    solutionSteps: [
      `Total Work = 60 units (A = 5, B = 4, C = 3 u/day)`,
      `First ${abDays} days (A+B) = 36 units; Remaining 24 units by B (4 u/day) = ${bAloneDays} days`,
      `Total time = ${abDays} + ${bAloneDays} = ${total} days`,
    ],
  });
}

// 5. Efficiency Changes During Work
export function mainsTW5EfficiencyChange(exam, difficulty) {
  // Normal rate = 4 u/day, 15 days => W = 60. Works 5 days at normal (20 u), then +25% (5 u/day) => 40/5 = 8 days -> Total 13 days
  const mult = pickRandom([1, 2]);
  const totalDays = 13 * mult;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_5_EFFICIENCY_CHANGE",
    questionText: `A worker can finish a task in ${15 * mult} days at normal efficiency. After working for ${5 * mult} days, they increase their efficiency by 25%. In how many total days will the entire task be completed?`,
    optResult: buildTWOptions(totalDays, { suffix: " days", step: 2 }),
    solutionSteps: [
      `Let normal rate = 4 u/day ⇒ Total Work = ${60 * mult} units`,
      `Done in first ${5 * mult} days = ${20 * mult} units; Remaining = ${40 * mult} units at 5 u/day = ${8 * mult} days`,
      `Total time = ${5 * mult} + ${8 * mult} = ${totalDays} days`,
    ],
  });
}

// 6. Men, Women and Children-Based Work
export function mainsTW6MenWomenChildren(exam, difficulty) {
  // 4 Men = 6 Women => 1M = 1.5W. 4 Men finish in 15 days => W = 4*15 = 60 Man-days = 90 Woman-days.
  // Ask: 6 Men + 6 Women = 6M + 4M = 10 Men => 60 / 10 = 6 days!
  const k = pickRandom([1, 2]);
  const days = 6 * k;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_6_MEN_WOMEN",
    questionText: `4 men or 6 women can complete a job in ${15 * k} days. In how many days will 6 men and 6 women working together complete the same job?`,
    optResult: buildTWOptions(days, { suffix: " days", step: 1 }),
    solutionSteps: [
      `4 Men = 6 Women ⇒ 6 Women = 4 Men`,
      `6 Men + 6 Women = 10 Men ⇒ Days = (4 × ${15 * k}) / 10 = ${days} days`,
    ],
  });
}

// 7. Work and Wages with Different Efficiencies (A, B + C helps finish -> find C's wage)
export function mainsTW7WagesWithHelper(exam, difficulty) {
  // A=12d (5 u/d), B=15d (4 u/d), together with C finish in 5 days (12 u/d) => C = 3 u/d
  // Share ratio A:B:C = 5:4:3 (sum 12)
  const unitRs = randInt(3, 10) * 100;
  const totalRs = 12 * unitRs;
  const shareC = 3 * unitRs;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_7_WAGES_HELPER",
    questionText: `A alone can finish a job in 12 days and B alone in 15 days. With the help of C, they finish the job together in 5 days for a total contract of Rs. ${totalRs}. What is C's share of the payment?`,
    optResult: buildTWOptions(shareC, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `Total Work = 60 units (A = 5, B = 4, A+B+C = 12 ⇒ C = 3 u/day)`,
      `C's share = (3 / 12) × ${totalRs} = Rs. ${shareC}`,
    ],
  });
}

// 8. Work Done in Shifts
export function mainsTW8Shifts(exam, difficulty) {
  const unitsPerHr = randInt(8, 15);
  const shift1Hrs = 6, shift2Hrs = 4;
  const dailyUnits = unitsPerHr * (shift1Hrs + shift2Hrs);
  const days = randInt(5, 14);
  const totalUnits = dailyUnits * days;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_8_SHIFTS",
    questionText: `A factory runs two shifts daily: a ${shift1Hrs}-hour morning shift and a ${shift2Hrs}-hour evening shift, producing ${unitsPerHr} units per hour in both shifts. How many days are needed to fulfill an order of ${totalUnits} units?`,
    optResult: buildTWOptions(days, { suffix: " days", step: 1 }),
    solutionSteps: [
      `Daily output = (${shift1Hrs} + ${shift2Hrs}) × ${unitsPerHr} = ${dailyUnits} units/day`,
      `Required days = ${totalUnits} / ${dailyUnits} = ${days} days`,
    ],
  });
}

// 9. Pipes and Cisterns (Related Application: 2 Inlets + 1 Outlet)
export function mainsTW9PipesCisterns(exam, difficulty) {
  const sets = [
    [12, 15, 20, 10],
    [15, 20, 30, 12],
    [20, 30, 60, 15],
    [24, 30, 40, 20],
  ];
  const [pA, pB, pC, ans] = pickRandom(sets);
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_9_PIPES_CISTERNS",
    questionText: `Inlet Pipe A can fill an empty tank in ${pA} hours and Inlet Pipe B in ${pB} hours, while Outlet Pipe C can empty the full tank in ${pC} hours. If all three pipes are opened together, in how many hours will the empty tank be full?`,
    optResult: buildTWOptions(ans, { suffix: " hours", step: 2 }),
    solutionSteps: [
      `Net 1-hour fill = 1/${pA} + 1/${pB} - 1/${pC} = 1/${ans}`,
      `Time to fill tank = ${ans} hours`,
    ],
  });
}

// 10. Work Completed in Multiple Stages
export function mainsTW10MultiStages(exam, difficulty) {
  const w1 = randInt(4, 10) * 10, r1 = 10;
  const w2 = randInt(6, 12) * 15, r2 = 15;
  const d1 = w1 / r1, d2 = w2 / r2;
  const totalDays = d1 + d2;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_10_MULTI_STAGES",
    questionText: `A software deployment has two stages: Stage 1 (${w1} modules) is executed at ${r1} modules/day, and Stage 2 (${w2} modules) is executed at ${r2} modules/day. How many total days are required to complete both stages sequentially?`,
    optResult: buildTWOptions(totalDays, { suffix: " days", step: 2 }),
    solutionSteps: [`Stage 1 = ${d1} days, Stage 2 = ${d2} days ⇒ Total = ${totalDays} days`],
  });
}

// 11. Time-Based Work Distribution (A works d1 days, B works d2 days, find remaining time for C)
export function mainsTW11TimeDistribution(exam, difficulty) {
  // W = 60: A=5/d (12d), B=4/d (15d), C=3/d (20d)
  const dA = 3; // 15 u
  const dB = 6; // 24 u -> total 39 u -> rem 21 u / 3 = 7 days for C
  const dC = (60 - dA * 5 - dB * 4) / 3;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_11_TIME_DIST",
    questionText: `A, B, and C can finish a work alone in 12, 15, and 20 days respectively. A works for ${dA} days and stops, then B works for ${dB} days and stops. How many days will C take to complete the remaining work?`,
    optResult: buildTWOptions(dC, { suffix: " days", step: 1 }),
    solutionSteps: [
      `Total Work = 60 units (A = 5, B = 4, C = 3 u/day)`,
      `Work done = (${dA}×5) + (${dB}×4) = 39 units; Remaining = 21 units`,
      `C finishes in 21 / 3 = ${dC} days`,
    ],
  });
}

// 12. Work and Efficiency Ratio-Based Problems (A is 25% more efficient than B)
export function mainsTW12EfficiencyRatioProblem(exam, difficulty) {
  // A : B = 5 : 4 => A + B = 9 u/day. Pick together days = 4*k => W = 36k => B alone = 9k days
  const k = randInt(2, 5);
  const togetherDays = 4 * k;
  const bAlone = 9 * k;
  return makeMainsTWQ({
    exam, difficulty, subType: "MAINS_TW_12_EFF_RATIO_PROBLEM",
    questionText: `A is 25% more efficient than B. Working together, they complete a piece of work in ${togetherDays} days. In how many days can B alone complete the same work?`,
    optResult: buildTWOptions(bAlone, { suffix: " days", step: 3 }),
    solutionSteps: [
      `Efficiency ratio A : B = 5 : 4 ⇒ Combined rate = 9 units/day`,
      `Total work = 9 × ${togetherDays} = ${9 * togetherDays} units ⇒ B alone = ${9 * togetherDays} / 4 = ${bAlone} days`,
    ],
  });
}

export const MAINS_TW_MAP = {
  1: mainsTW1PairwiseCombined,
  2: mainsTW2AlternateAssisted,
  3: mainsTW3LeavesBeforeEnd,
  4: mainsTW4StaggeredIntervals,
  5: mainsTW5EfficiencyChange,
  6: mainsTW6MenWomenChildren,
  7: mainsTW7WagesWithHelper,
  8: mainsTW8Shifts,
  9: mainsTW9PipesCisterns,
  10: mainsTW10MultiStages,
  11: mainsTW11TimeDistribution,
  12: mainsTW12EfficiencyRatioProblem,
};