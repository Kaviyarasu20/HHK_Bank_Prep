// Place at: server/question-engine/generators/quant/average/prelimsAverageTypes.js
import { randInt, pickRandom, shuffle } from "../../../core/mathUtils.js";

export function buildAvgOptions(correctVal, { prefix = "", suffix = "", step = 2, decimals = 0 } = {}) {
  const fmt = (v) => `${prefix}${decimals > 0 ? Number(v).toFixed(decimals) : Math.round(v)}${suffix}`;
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

export function makeAvgQ({ exam, difficulty, level, subType, questionText, optResult, solutionSteps }) {
  return {
    questionId: `AVG_${level}_${subType}_${difficulty}_${Date.now()}_${randInt(100, 999)}`,
    exam,
    topic: "Average",
    subType,
    level,
    difficulty,
    generationMode: "RULE_ENGINE",
    questionText,
    options: optResult.options,
    correctOptionIndex: optResult.correctOptionIndex,
    answer: optResult.answer,
    solutionSteps,
  };
}

// 1. Basic Average Calculation
export function prelimsAvg1Basic(exam, difficulty) {
  const avg = randInt(25, 75);
  const d1 = randInt(3, 12), d2 = randInt(4, 15);
  const nums = [avg - d1, avg + d1, avg - d2, avg + d2, avg];
  const display = shuffle(nums);
  const sum = nums.reduce((a, b) => a + b, 0);
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_1_BASIC",
    questionText: `Find the average of the following 5 numbers: ${display.join(", ")}.`,
    optResult: buildAvgOptions(avg, { step: 2 }),
    solutionSteps: [`Sum = ${sum}`, `Average = ${sum} / 5 = ${avg}`],
  });
}

// 2. Finding the Average of Consecutive Numbers
export function prelimsAvg2Consecutive(exam, difficulty) {
  const start = randInt(15, 65);
  const count = pickRandom([7, 9, 11, 13, 15]);
  const end = start + count - 1;
  const avg = (start + end) / 2;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_2_CONSECUTIVE",
    questionText: `What is the average of ${count} consecutive natural numbers starting from ${start} (i.e. ${start}, ${start + 1}, ..., ${end})?`,
    optResult: buildAvgOptions(avg, { step: 1 }),
    solutionSteps: [`Average of consecutive numbers = (First + Last) / 2 = (${start} + ${end}) / 2 = ${avg}`],
  });
}

// 3. Finding Missing Numbers Using Average
export function prelimsAvg3MissingNumber(exam, difficulty) {
  const avg = randInt(30, 70);
  const n1 = avg - randInt(4, 14);
  const n2 = avg + randInt(3, 15);
  const n3 = avg - randInt(2, 10);
  const n4 = avg + randInt(5, 16);
  const missing = 5 * avg - (n1 + n2 + n3 + n4);
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_3_MISSING_NUM",
    questionText: `The average of 5 numbers is ${avg}. If four of the numbers are ${n1}, ${n2}, ${n3}, and ${n4}, what is the fifth number?`,
    optResult: buildAvgOptions(missing, { step: 2 }),
    solutionSteps: [
      `Total sum = 5 × ${avg} = ${5 * avg}`,
      `Sum of 4 numbers = ${n1 + n2 + n3 + n4} ⇒ Fifth number = ${5 * avg} - ${n1 + n2 + n3 + n4} = ${missing}`,
    ],
  });
}

// 4. Adding a New Number to an Average
export function prelimsAvg4AddNumber(exam, difficulty) {
  const n = randInt(8, 20);
  const oldAvg = randInt(20, 50);
  const inc = randInt(1, 3);
  const newNum = oldAvg + (n + 1) * inc;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_4_ADD_NUMBER",
    questionText: `The average of ${n} numbers is ${oldAvg}. When one new number is included, the average increases by ${inc}. What is the new number?`,
    optResult: buildAvgOptions(newNum, { step: 2 }),
    solutionSteps: [
      `New number = Old average + (New count × Increase) = ${oldAvg} + (${n + 1} × ${inc}) = ${newNum}`,
    ],
  });
}

// 5. Removing a Number from an Average
export function prelimsAvg5RemoveNumber(exam, difficulty) {
  const n = randInt(8, 18);
  const oldAvg = randInt(35, 75);
  const dec = randInt(1, 3);
  const removed = oldAvg + (n - 1) * dec;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_5_REMOVE_NUMBER",
    questionText: `The average of ${n} numbers is ${oldAvg}. If one number is excluded, the average decreases by ${dec}. Find the excluded number.`,
    optResult: buildAvgOptions(removed, { step: 2 }),
    solutionSteps: [
      `Excluded number = (${n} × ${oldAvg}) - (${n - 1} × ${oldAvg - dec}) = ${removed}`,
    ],
  });
}

// 6. Replacing One Number with Another
export function prelimsAvg6ReplaceNumber(exam, difficulty) {
  const n = randInt(8, 16);
  const oldVal = randInt(40, 75);
  const inc = randInt(1, 3);
  const newVal = oldVal + n * inc;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_6_REPLACE_NUMBER",
    questionText: `The average of ${n} observations increases by ${inc} when one observation of value ${oldVal} is replaced by a new observation. What is the value of the new observation?`,
    optResult: buildAvgOptions(newVal, { step: 2 }),
    solutionSteps: [`New value = ${oldVal} + (${n} × ${inc}) = ${newVal}`],
  });
}

// 7. Average of Two Groups
export function prelimsAvg7TwoGroups(exam, difficulty) {
  const n1 = pickRandom([10, 15, 20]), n2 = pickRandom([10, 20, 30]);
  const a1 = randInt(40, 65), a2 = a1 + pickRandom([5, 10, 15]);
  // Guarantee clean integer combined average by picking a2 - a1 divisible by (n1+n2)/gcd
  const totalN = n1 + n2;
  const k = randInt(1, 4);
  const avg1 = randInt(40, 60);
  const avg2 = avg1 + k * (totalN / 5);
  const combined = (n1 * avg1 + n2 * avg2) / totalN;
  const dec = Number.isInteger(combined) ? 0 : 1;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_7_TWO_GROUPS",
    questionText: `The average score of ${n1} students in Section A is ${avg1}, and the average score of ${n2} students in Section B is ${avg2}. What is the combined average score of all ${totalN} students?`,
    optResult: buildAvgOptions(combined, { step: 2, decimals: dec }),
    solutionSteps: [
      `Combined average = [(${n1} × ${avg1}) + (${n2} × ${avg2})] / ${totalN} = ${combined}`,
    ],
  });
}

// 8. Combined Average of Multiple Groups (3 equal groups)
export function prelimsAvg8ThreeGroups(exam, difficulty) {
  const n = randInt(12, 25);
  const avg = randInt(50, 80);
  const d = randInt(3, 12);
  const g1 = avg - d, g2 = avg, g3 = avg + d;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_8_MULTI_GROUPS",
    questionText: `Three batches of ${n} students each have average scores of ${g1}, ${g2}, and ${g3} respectively. What is the overall average score across all three batches?`,
    optResult: buildAvgOptions(avg, { step: 2 }),
    solutionSteps: [
      `Since all three batches have equal size (${n}), overall average = (${g1} + ${g2} + ${g3}) / 3 = ${avg}`,
    ],
  });
}

// 9. Average Age Problems
export function prelimsAvg9Age(exam, difficulty) {
  const n = randInt(15, 30);
  const oldAvg = randInt(16, 24);
  const inc = randInt(1, 2);
  const teacherAge = oldAvg + (n + 1) * inc;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "PRELIMS_AVG_9_AGE",
    questionText: `The average age of ${n} students in a class is ${oldAvg} years. When the teacher's age is included, the average age rises by ${inc} year(s). What is the teacher's age?`,
    optResult: buildAvgOptions(teacherAge, { suffix: " years", step: 2 }),
    solutionSteps: [`Teacher's age = ${oldAvg} + (${n + 1} × ${inc}) = ${teacherAge} years`],
  });
}

// 10. Average Weight Problems
export function prelimsAvg10Weight(exam, difficulty) {
  const n = randInt(8, 16);
  const oldWt = randInt(52, 68);
  const inc = randInt(1, 3);
  const newWt = oldWt + n * inc;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "PRELIMS_AVG_10_WEIGHT",
    questionText: `The average weight of ${n} persons increases by ${inc} kg when a person weighing ${oldWt} kg is replaced by a new person. What is the weight of the new person?`,
    optResult: buildAvgOptions(newWt, { suffix: " kg", step: 2 }),
    solutionSteps: [`New person's weight = ${oldWt} + (${n} × ${inc}) = ${newWt} kg`],
  });
}

// 11. Average Marks Problems
export function prelimsAvg11Marks(exam, difficulty) {
  const subjects = 5;
  const targetAvg = randInt(68, 88);
  const prevAvg = targetAvg - randInt(2, 5);
  const needed = subjects * targetAvg - (subjects - 1) * prevAvg;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "PRELIMS_AVG_11_MARKS",
    questionText: `A student has an average of ${prevAvg} marks across 4 subjects. How many marks must they score in the 5th subject to raise their overall average to ${targetAvg}?`,
    optResult: buildAvgOptions(needed, { step: 2 }),
    solutionSteps: [
      `Required 5-subject total = 5 × ${targetAvg} = ${5 * targetAvg}`,
      `Marks needed = ${5 * targetAvg} - (4 × ${prevAvg}) = ${needed}`,
    ],
  });
}

// 12. Average Salary Problems
export function prelimsAvg12Salary(exam, difficulty) {
  const staff = randInt(8, 15);
  const avgStaff = randInt(25, 45) * 1000;
  const inc = randInt(1, 3) * 1000;
  const managerSal = avgStaff + (staff + 1) * inc;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "PRELIMS_AVG_12_SALARY",
    questionText: `The average monthly salary of ${staff} clerks is Rs. ${avgStaff}. When the branch manager's salary is included, the average increases by Rs. ${inc}. What is the branch manager's monthly salary?`,
    optResult: buildAvgOptions(managerSal, { prefix: "Rs. ", step: 1000 }),
    solutionSteps: [`Manager's salary = ${avgStaff} + (${staff + 1} × ${inc}) = Rs. ${managerSal}`],
  });
}

// 13. Average Speed Problems (Equal round-trip distance: 2ab / (a+b))
export function prelimsAvg13Speed(exam, difficulty) {
  const cleanPairs = [
    [30, 60, 40], [40, 60, 48], [20, 30, 24], [30, 45, 36], [60, 90, 72], [20, 60, 30],
  ];
  const [s1, s2, ans] = pickRandom(cleanPairs);
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "PRELIMS_AVG_13_SPEED",
    questionText: `A car travels from Town A to Town B at ${s1} km/hr and returns from Town B to Town A at ${s2} km/hr. What is its average speed for the entire round trip?`,
    optResult: buildAvgOptions(ans, { suffix: " km/hr", step: 2 }),
    solutionSteps: [`Average speed = (2 × ${s1} × ${s2}) / (${s1} + ${s2}) = ${ans} km/hr`],
  });
}

// 14. Change in Average (Misread entry correction)
export function prelimsAvg14ChangeInAvg(exam, difficulty) {
  const n = pickRandom([10, 15, 20, 25]);
  const wrongAvg = randInt(42, 72);
  const deltaPerItem = pickRandom([1, 2, 3]);
  const errorDiff = n * deltaPerItem;
  const wrongEntry = randInt(20, 45);
  const trueEntry = wrongEntry + errorDiff;
  const trueAvg = wrongAvg + deltaPerItem;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_14_CHANGE_CORRECTION",
    questionText: `The average marks of ${n} students was calculated as ${wrongAvg}. Later it was discovered that one student's mark of ${trueEntry} was wrongly entered as ${wrongEntry}. What is the correct average?`,
    optResult: buildAvgOptions(trueAvg, { step: 1 }),
    solutionSteps: [
      `Net increase in sum = ${trueEntry} - ${wrongEntry} = +${errorDiff}`,
      `Correct average = ${wrongAvg} + (${errorDiff} / ${n}) = ${trueAvg}`,
    ],
  });
}

// 15. Finding Total from Average
export function prelimsAvg15FindTotal(exam, difficulty) {
  const n = randInt(12, 32);
  const avg = randInt(35, 85);
  const total = n * avg;
  return makeAvgQ({
    exam, difficulty, level: "L1", subType: "PRELIMS_AVG_15_FIND_TOTAL",
    questionText: `The average daily sales of a store over ${n} days is Rs. ${avg * 10}. What is the total sales amount over all ${n} days?`,
    optResult: buildAvgOptions(total * 10, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [`Total = Number of days × Average = ${n} × ${avg * 10} = Rs. ${total * 10}`],
  });
}

export const PRELIMS_AVG_MAP = {
  1: prelimsAvg1Basic,
  2: prelimsAvg2Consecutive,
  3: prelimsAvg3MissingNumber,
  4: prelimsAvg4AddNumber,
  5: prelimsAvg5RemoveNumber,
  6: prelimsAvg6ReplaceNumber,
  7: prelimsAvg7TwoGroups,
  8: prelimsAvg8ThreeGroups,
  9: prelimsAvg9Age,
  10: prelimsAvg10Weight,
  11: prelimsAvg11Marks,
  12: prelimsAvg12Salary,
  13: prelimsAvg13Speed,
  14: prelimsAvg14ChangeInAvg,
  15: prelimsAvg15FindTotal,
};