// Place at: server/question-engine/generators/quant/average/mainsAverageTypes.js
import { randInt, pickRandom } from "../../../core/mathUtils.js";
import { buildAvgOptions, makeAvgQ } from "./prelimsAverageTypes.js";

// 1. Weighted Average
export function mainsAvg1Weighted(exam, difficulty) {
  const w1 = 2, w2 = 3, w3 = 5; // sum = 10
  // Pick multiples guaranteeing 2*s1 + 3*s2 + 5*s3 is always divisible by 10 (O(1), no loops)
  const s1 = randInt(10, 14) * 5;
  const s2 = randInt(6, 8) * 10;
  const s3 = randInt(35, 45) * 2;
  const wAvg = (w1 * s1 + w2 * s2 + w3 * s3) / 10;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "MAINS_AVG_1_WEIGHTED",
    questionText: `An exam assigns weights of 20%, 30%, and 50% to Quant, Reasoning, and GA respectively. If an aspirant scores ${s1}, ${s2}, and ${s3} in these three sections, what is their weighted average score?`,
    optResult: buildAvgOptions(wAvg, { step: 2 }),
    solutionSteps: [
      `Weighted Average = (0.2×${s1}) + (0.3×${s2}) + (0.5×${s3}) = ${wAvg}`,
    ],
  });
}

// 2. Combined Average with Different Group Sizes (Find missing group average)
export function mainsAvg2DiffGroupSizes(exam, difficulty) {
  const n1 = 20, n2 = 30;
  const a1 = randInt(48, 66);
  const a2 = randInt(62, 84);
  const totalSum = n1 * a1 + n2 * a2;
  // Ensure totalSum is divisible by 50
  const rem = totalSum % 50;
  const adjA2 = rem === 0 ? a2 : a2 + (50 - rem) / 10; // since n2=30, adjust by shifting a1 instead:
  const baseA1 = randInt(50, 65);
  const diffStep = randInt(1, 4) * 5;
  const baseA2 = baseA1 + diffStep; // (20*a1 + 30*(a1+5k))/50 = a1 + 3k (exact integer!)
  const combined = baseA1 + (3 * diffStep) / 5;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "MAINS_AVG_2_DIFF_GROUP_SIZES",
    questionText: `The combined average marks of 50 students across Batch A (20 students) and Batch B (30 students) is ${combined}. If Batch A's average is ${baseA1}, what is Batch B's average?`,
    optResult: buildAvgOptions(baseA2, { step: 2 }),
    solutionSteps: [
      `Total marks = 50 × ${combined} = ${50 * combined}; Batch A = 20 × ${baseA1} = ${20 * baseA1}`,
      `Batch B average = (${50 * combined - 20 * baseA1}) / 30 = ${baseA2}`,
    ],
  });
}

// 3. Average with Multiple Replacements (2 persons replaced)
export function mainsAvg3MultiReplacements(exam, difficulty) {
  const n = randInt(8, 16);
  const old1 = randInt(24, 38), old2 = randInt(26, 42);
  const inc = pickRandom([2, 3]);
  const sumNew = old1 + old2 + n * inc;
  const avgNewTwo = sumNew / 2;
  // Ensure sumNew is even
  const adjOld2 = sumNew % 2 === 0 ? old2 : old2 + 1;
  const finalSumNew = old1 + adjOld2 + n * inc;
  const ans = finalSumNew / 2;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_3_MULTI_REPLACEMENTS",
    questionText: `The average age of a committee of ${n} members increases by ${inc} years when two members aged ${old1} years and ${adjOld2} years are replaced by two new members. What is the average age of the two new members?`,
    optResult: buildAvgOptions(ans, { suffix: " years", step: 2 }),
    solutionSteps: [
      `Sum of two new members = ${old1} + ${adjOld2} + (${n} × ${inc}) = ${finalSumNew}`,
      `Average age of the two new members = ${finalSumNew} / 2 = ${ans} years`,
    ],
  });
}

// 4. Average with Addition and Removal
export function mainsAvg4AddAndRemove(exam, difficulty) {
  const n = randInt(10, 18);
  const oldAvg = randInt(40, 65);
  const removed = randInt(30, 50);
  const added1 = randInt(60, 85);
  // 1 removed, 2 added => new count = n + 1. Make new sum divisible by (n + 1):
  const targetNewAvg = oldAvg + randInt(1, 3);
  const added2 = (n + 1) * targetNewAvg - (n * oldAvg - removed + added1);
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_4_ADD_REMOVE",
    questionText: `The average of ${n} numbers is ${oldAvg}. If one number (${removed}) is removed and two new numbers (${added1} and ${added2}) are added, what is the new average of the ${n + 1} numbers?`,
    optResult: buildAvgOptions(targetNewAvg, { step: 1 }),
    solutionSteps: [
      `Original sum = ${n * oldAvg}`,
      `New sum = ${n * oldAvg} - ${removed} + ${added1} + ${added2} = ${(n + 1) * targetNewAvg}`,
      `New average = ${(n + 1) * targetNewAvg} / ${n + 1} = ${targetNewAvg}`,
    ],
  });
}

// 5. Average Age with Joining and Leaving (Family age after N years + baby born)
export function mainsAvg5AgeJoiningLeaving(exam, difficulty) {
  const members = pickRandom([4, 5, 6]);
  const yearsAgo = pickRandom([3, 4, 5]);
  const pastAvg = randInt(22, 34);
  const presentSumOld = members * (pastAvg + yearsAgo);
  // Baby born => members + 1 persons now have same average `pastAvg`? Or baby's age = k:
  const babyAge = randInt(1, yearsAgo);
  // Ask present average of old members? Better classic bank question:
  // "yearsAgo" ago avg of `members` was `pastAvg`. Now with a new member, avg is still `pastAvg` => new member age = pastAvg - members*yearsAgo (must be > 0).
  const safePastAvg = members * yearsAgo + randInt(2, 8);
  const babyPresentAge = safePastAvg - members * yearsAgo;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_5_AGE_JOIN_LEAVE",
    questionText: `${yearsAgo} years ago, the average age of a family of ${members} members was ${safePastAvg} years. A baby having been born, the average age of the family today is still ${safePastAvg} years. What is the present age of the baby?`,
    optResult: buildAvgOptions(babyPresentAge, { suffix: " years", step: 1 }),
    solutionSteps: [
      `Present sum of original ${members} members = ${members} × (${safePastAvg} + ${yearsAgo}) = ${members * (safePastAvg + yearsAgo)}`,
      `Present sum of all ${members + 1} members = ${members + 1} × ${safePastAvg} = ${(members + 1) * safePastAvg}`,
      `Baby's age = ${(members + 1) * safePastAvg} - ${members * (safePastAvg + yearsAgo)} = ${babyPresentAge} years`,
    ],
  });
}

// 6. Average Based on Ratio
export function mainsAvg6RatioBased(exam, difficulty) {
  const r1 = randInt(2, 5), r2 = randInt(3, 6), r3 = randInt(4, 8);
  const k = randInt(3, 12) * 3; // guarantees sum divisible by 3
  const sum = (r1 + r2 + r3) * k;
  const avg = sum / 3;
  const largest = Math.max(r1, r2, r3) * k;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_6_RATIO_BASED",
    questionText: `Three numbers are in the ratio ${r1} : ${r2} : ${r3}, and their average is ${avg}. What is the largest of the three numbers?`,
    optResult: buildAvgOptions(largest, { step: 4 }),
    solutionSteps: [
      `Sum of 3 numbers = 3 × ${avg} = ${sum}`,
      `1 ratio unit = ${sum} / ${r1 + r2 + r3} = ${k} ⇒ Largest = ${Math.max(r1, r2, r3)} × ${k} = ${largest}`,
    ],
  });
}

// 7. Average Speed with Different Distances
export function mainsAvg7SpeedDiffDist(exam, difficulty) {
  const s1 = pickRandom([40, 50, 60]), t1 = randInt(2, 4);
  const s2 = pickRandom([60, 75, 80]), t2 = randInt(2, 4);
  const d1 = s1 * t1, d2 = s2 * t2;
  // Ensure (d1 + d2) is divisible by (t1 + t2) cleanly
  const totalT = t1 + t2;
  const targetAvg = randInt(45, 75);
  const cleanD1 = s1 * t1;
  const cleanD2 = targetAvg * totalT - cleanD1;
  const cleanS2 = cleanD2 / t2;
  if (cleanD2 > 40 && Number.isInteger(cleanS2) && cleanS2 > 15) {
    return makeAvgQ({
      exam, difficulty, level: "L2", subType: "MAINS_AVG_7_SPEED_DIFF_DIST",
      questionText: `A train covers ${cleanD1} km at ${s1} km/hr and the next ${cleanD2} km at ${cleanS2} km/hr. What is its average speed for the entire journey?`,
      optResult: buildAvgOptions(targetAvg, { suffix: " km/hr", step: 2 }),
      solutionSteps: [
        `Time₁ = ${t1} hrs, Time₂ = ${t2} hrs ⇒ Total time = ${totalT} hrs`,
        `Average speed = (${cleanD1} + ${cleanD2}) / ${totalT} = ${targetAvg} km/hr`,
      ],
    });
  }
  // Exact fallback guarantee: t1 = 2, t2 = 3, totalT = 5
  const fs1 = 50, fs2 = 75; // d1=100, d2=225 -> total=325 / 5 = 65 km/hr
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "MAINS_AVG_7_SPEED_DIFF_DIST",
    questionText: `A train covers 100 km at 50 km/hr and the next 225 km at 75 km/hr. What is its average speed for the entire journey?`,
    optResult: buildAvgOptions(65, { suffix: " km/hr", step: 2 }),
    solutionSteps: [`Total Distance = 325 km, Total Time = 2 + 3 = 5 hrs ⇒ Average speed = 65 km/hr`],
  });
}

// 8. Average Speed with Equal Distances (3 equal legs)
export function mainsAvg8SpeedEqualDist(exam, difficulty) {
  const cleanTriples = [
    [10, 20, 60, 18], // 3*10*20*60 / (200+1200+600) = 36000/2000 = 18
    [20, 30, 60, 30], // 3*20*30*60 / (600+1800+1200) = 108000/3600 = 30
    [15, 30, 60, 24], // 3*15*30*60 / (450+1800+900) = skip -> 25.7
  ];
  const exactTriples = [
    [10, 20, 60, 18],
    [20, 30, 60, 30],
    [30, 45, 90, 45],
    [40, 60, 120, 60],
  ];
  const [a, b, c, ans] = pickRandom(exactTriples);
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "MAINS_AVG_8_SPEED_EQUAL_DIST",
    questionText: `A car covers three equal stretches of a highway at speeds of ${a} km/hr, ${b} km/hr, and ${c} km/hr respectively. Find the average speed of the car for the entire journey.`,
    optResult: buildAvgOptions(ans, { suffix: " km/hr", step: 2 }),
    solutionSteps: [
      `For 3 equal distances: Avg speed = 3abc / (ab + bc + ca)`,
      `= (3 × ${a} × ${b} × ${c}) / (${a * b} + ${b * c} + ${c * a}) = ${ans} km/hr`,
    ],
  });
}

// 9. Average Speed with Equal Time Intervals
export function mainsAvg9SpeedEqualTime(exam, difficulty) {
  const avg = randInt(42, 72);
  const d = randInt(6, 18);
  const s1 = avg - d, s2 = avg, s3 = avg + d;
  return makeAvgQ({
    exam, difficulty, level: "L2", subType: "MAINS_AVG_9_SPEED_EQUAL_TIME",
    questionText: `A bus travels for 2 hours at ${s1} km/hr, the next 2 hours at ${s2} km/hr, and the final 2 hours at ${s3} km/hr. What is its average speed?`,
    optResult: buildAvgOptions(avg, { suffix: " km/hr", step: 2 }),
    solutionSteps: [
      `For equal time intervals, Average Speed = (${s1} + ${s2} + ${s3}) / 3 = ${avg} km/hr`,
    ],
  });
}

// 10. Average of Consecutive Odd and Even Numbers
export function mainsAvg10ConsecOddEven(exam, difficulty) {
  const isOdd = Math.random() < 0.5;
  const mid = randInt(15, 45) * 2 + (isOdd ? 1 : 0); // 7 consecutive => mid is 4th term
  const largest = mid + 6;
  const smallest = mid - 6;
  const productSum = largest + smallest; // 2 * mid
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_10_CONSEC_ODD_EVEN",
    questionText: `The average of 7 consecutive ${isOdd ? "odd" : "even"} numbers is ${mid}. What is the largest of these 7 numbers?`,
    optResult: buildAvgOptions(largest, { step: 2 }),
    solutionSteps: [
      `In 7 consecutive ${isOdd ? "odd" : "even"} numbers, the average (${mid}) is the 4th number`,
      `Largest (7th) number = ${mid} + 3 × 2 = ${largest}`,
    ],
  });
}

// 11. Average of Numbers with Given Conditions (Overlapping middle number)
export function mainsAvg11OverlappingMiddle(exam, difficulty) {
  const totalAvg = randInt(35, 60);
  const firstAvg = totalAvg - randInt(2, 6);
  const lastAvg = totalAvg + randInt(3, 8);
  // 9 numbers: first 5 + last 5 - total 9 = 5th (middle) number
  const middle = 5 * firstAvg + 5 * lastAvg - 9 * totalAvg;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_11_OVERLAPPING_MIDDLE",
    questionText: `The average of 9 numbers is ${totalAvg}. The average of the first 5 numbers is ${firstAvg} and the average of the last 5 numbers is ${lastAvg}. Find the 5th number.`,
    optResult: buildAvgOptions(middle, { step: 2 }),
    solutionSteps: [
      `5th number = (Sum of first 5) + (Sum of last 5) - (Total sum of 9)`,
      `= (5 × ${firstAvg}) + (5 × ${lastAvg}) - (9 × ${totalAvg}) = ${middle}`,
    ],
  });
}

// 12. Missing Data in Average (DI Table with missing branch)
export function mainsAvg12MissingDataDI(exam, difficulty) {
  const avg = randInt(24, 52) * 10;
  const b1 = avg - 40, b2 = avg + 30, b3 = avg - 20, b4 = avg + 60;
  const missingB5 = 5 * avg - (b1 + b2 + b3 + b4);
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_12_MISSING_DATA_DI",
    questionText: `Monthly accounts opened across 5 bank branches have an average of ${avg}:\n• Branch P: ${b1} | Branch Q: ${b2} | Branch R: ${b3} | Branch S: ${b4} | Branch T: ?\nFind the missing number of accounts opened by Branch T.`,
    optResult: buildAvgOptions(missingB5, { step: 10 }),
    solutionSteps: [
      `Total = 5 × ${avg} = ${5 * avg}`,
      `Branch T = ${5 * avg} - (${b1} + ${b2} + ${b3} + ${b4}) = ${missingB5}`,
    ],
  });
}

// 13. Average-Based Data Interpretation (Difference of two averages)
export function mainsAvg13MiniDI(exam, difficulty) {
  const avgA = randInt(40, 65) * 10;
  const avgB = avgA - randInt(4, 12) * 10;
  const a1 = avgA - 20, a2 = avgA, a3 = avgA + 20;
  const b1 = avgB - 30, b2 = avgB, b3 = avgB + 30;
  const diff = avgA - avgB;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_13_MINI_DI",
    questionText: `Quarterly Home Loans (in lakhs) disbursed by two banks:\n• Bank X: Q1 = ${a1}, Q2 = ${a2}, Q3 = ${a3}\n• Bank Y: Q1 = ${b1}, Q2 = ${b2}, Q3 = ${b3}\nWhat is the difference between the average quarterly disbursal of Bank X and Bank Y?`,
    optResult: buildAvgOptions(diff, { suffix: " lakhs", step: 10 }),
    solutionSteps: [
      `Avg(Bank X) = ${avgA} lakhs; Avg(Bank Y) = ${avgB} lakhs`,
      `Difference = ${avgA} - ${avgB} = ${diff} lakhs`,
    ],
  });
}

// 14. Average-Based Caselet
export function mainsAvg14Caselet(exam, difficulty) {
  const officers = 10, clerks = 20;
  const avgOff = randInt(60, 80) * 1000;
  const avgClk = randInt(30, 45) * 1000;
  // Ensure combined average is exact integer: (10*avgOff + 20*avgClk)/30 -> make (avgOff + 2*avgClk) divisible by 3
  const adjOff = avgOff - ((avgOff + 2 * avgClk) % 3000);
  const combined = (officers * adjOff + clerks * avgClk) / (officers + clerks);
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_14_CASELET",
    questionText: `A regional bank branch employs ${officers} Officers and ${clerks} Clerks. The average monthly salary of the Officers is Rs. ${adjOff}, and the average monthly salary of the Clerks is Rs. ${avgClk}. What is the overall average monthly salary of all 30 employees in the branch?`,
    optResult: buildAvgOptions(combined, { prefix: "Rs. ", step: 1000 }),
    solutionSteps: [
      `Total salary = (10 × ${adjOff}) + (20 × ${avgClk}) = Rs. ${10 * adjOff + 20 * avgClk}`,
      `Overall average = Rs. ${10 * adjOff + 20 * avgClk} / 30 = Rs. ${combined}`,
    ],
  });
}

// 15. Average with Percentage Changes
export function mainsAvg15PctChange(exam, difficulty) {
  const origAvg = randInt(25, 65) * 10;
  const pct = pickRandom([10, 20, 25, 30]);
  const newAvg = (origAvg * (100 + pct)) / 100;
  return makeAvgQ({
    exam, difficulty, level: "L3", subType: "MAINS_AVG_15_PCT_CHANGE",
    questionText: `The average monthly expenditure of 12 families is Rs. ${origAvg * 10}. If every family's expenditure increases by ${pct}%, what will be the new average monthly expenditure?`,
    optResult: buildAvgOptions(newAvg * 10, { prefix: "Rs. ", step: 100 }),
    solutionSteps: [
      `When every observation increases by ${pct}%, the average also increases by ${pct}%`,
      `New average = ${origAvg * 10} × ${(100 + pct) / 100} = Rs. ${newAvg * 10}`,
    ],
  });
}

export const MAINS_AVG_MAP = {
  1: mainsAvg1Weighted,
  2: mainsAvg2DiffGroupSizes,
  3: mainsAvg3MultiReplacements,
  4: mainsAvg4AddAndRemove,
  5: mainsAvg5AgeJoiningLeaving,
  6: mainsAvg6RatioBased,
  7: mainsAvg7SpeedDiffDist,
  8: mainsAvg8SpeedEqualDist,
  9: mainsAvg9SpeedEqualTime,
  10: mainsAvg10ConsecOddEven,
  11: mainsAvg11OverlappingMiddle,
  12: mainsAvg12MissingDataDI,
  13: mainsAvg13MiniDI,
  14: mainsAvg14Caselet,
  15: mainsAvg15PctChange,
};