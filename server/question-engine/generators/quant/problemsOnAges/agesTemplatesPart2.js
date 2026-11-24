// Place at: server/question-engine/generators/quant/problemsOnAges/agesTemplatesPart2.js
import { R, ZERO } from "./agesMath.js";
import { assembleAgeQ } from "./agesTemplatesPart1.js";

const NAMES = [
  "Aarav", "Bhavna", "Chirag", "Deepak", "Esha", "Farhan",
  "Gauri", "Harsh", "Ishaan", "Jaya", "Karan", "Meera",
  "Neha", "Pranav", "Rohan", "Sneha", "Tanvi", "Vikram",
];

function pickPeople(rng, count = 3) {
  return rng.shuffle(NAMES).slice(0, count);
}

// ============================================================================
// CATEGORY E: Multiple-Person Age Problems (E1–E3)
// ============================================================================

// E1. Three-Person Ratio + Sum -> Youngest or Oldest Age
function genE1_ThreePersonRatio(rng, difficulty) {
  const triples = [
    [3, 4, 5], [2, 3, 5], [4, 5, 6], [3, 5, 7], [4, 5, 7], [2, 5, 7],
  ];
  const [r1, r2, r3] = rng.pick(triples);
  const k = rng.randInt(4, 8);
  const sum = (r1 + r2 + r3) * k;
  const askYoungest = rng.random() < 0.5;
  const ans = R((askYoungest ? r1 : r3) * k);
  const [p1, p2, p3] = pickPeople(rng, 3);

  return assembleAgeQ({
    templateId: "AGE_E1_THREE_PERSON_RATIO",
    question_type: "Multiple-Person Age Problems",
    sub_type: askYoungest ? "Three-Person Ratio — Youngest Age" : "Three-Person Ratio — Oldest Age",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The present ages of ${p1}, ${p2}, and ${p3} are in the ratio ${r1} : ${r2} : ${r3}. If the sum of their present ages is ${sum} years, what is the present age of the ${askYoungest ? "youngest" : "oldest"} person?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(r1), R(r2), R(r3)],
      ratioTime: ZERO,
      sumAtTime: R(sum),
      sumTime: ZERO,
      targetIdx: askYoungest ? "YOUNGEST" : "OLDEST",
    },
    exactRationalAnswer: ans,
    plausible: [R(r2 * k), R((askYoungest ? r3 : r1) * k), ans.add(R(k)), ans.sub(R(2))],
    solution: {
      given_data: [`Ratio = ${r1}:${r2}:${r3}`, `Sum of ages = ${sum} years`],
      variables: [`Let ages be ${r1}k, ${r2}k, and ${r3}k`],
      equations: [`(${r1} + ${r2} + ${r3})k = ${sum}`],
      steps: [
        `${r1 + r2 + r3}k = ${sum} ⇒ k = ${k}`,
        `Ages are ${r1 * k}, ${r2 * k}, and ${r3 * k} years ⇒ ${askYoungest ? "Youngest" : "Oldest"} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `1 part = ${sum}/${r1 + r2 + r3} = ${k}; multiply by ${askYoungest ? r1 : r3}.`,
    rng,
  });
}

// E2. Four-Person Age Problem with Relative Offsets
function genE2_FourPersonOffsets(rng, difficulty) {
  const base = rng.randInt(14, 26);
  const d1 = rng.pick([2, 3, 4]);
  const d2 = d1 + rng.pick([2, 3, 4]);
  const d3 = d2 + rng.pick([2, 3, 4]);
  const ages = [base, base + d1, base + d2, base + d3];
  const totalSum = ages.reduce((a, b) => a + b, 0);
  const [p1, p2, p3, p4] = pickPeople(rng, 4);
  const askOldest = rng.random() < 0.5;
  const targetIdx = askOldest ? 3 : 0;
  const ans = R(ages[targetIdx]);

  return assembleAgeQ({
    templateId: "AGE_E2_FOUR_PERSON_OFFSETS",
    question_type: "Multiple-Person Age Problems",
    sub_type: "Four-Person Relative Age Problem",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The sum of the present ages of four siblings ${p1}, ${p2}, ${p3}, and ${p4} is ${totalSum} years. ${p2} is ${d1} years older than ${p1}, ${p3} is ${d2 - d1} years older than ${p2}, and ${p4} is ${d3 - d2} years older than ${p3}. What is the present age of ${askOldest ? p4 : p1}?`,
    mathModel: {
      kind: "MULTI_OFFSET_SUM",
      offsets: [R(0), R(d1), R(d2), R(d3)],
      totalSum: R(totalSum),
      targetIdx,
    },
    exactRationalAnswer: ans,
    plausible: [R(ages[askOldest ? 0 : 3]), R(ages[1]), R(ages[2]), ans.add(R(2))],
    solution: {
      given_data: [`Sum of 4 ages = ${totalSum} years`, `Offsets from ${p1}: 0, +${d1}, +${d2}, +${d3}`],
      variables: [`Let ${p1}'s age = x`],
      equations: [`x + (x + ${d1}) + (x + ${d2}) + (x + ${d3}) = ${totalSum}`],
      steps: [
        `4x + ${d1 + d2 + d3} = ${totalSum} ⇒ 4x = ${totalSum - (d1 + d2 + d3)} ⇒ x = ${base}`,
        `Ages are ${ages.join(", ")} years ⇒ ${askOldest ? p4 : p1} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Subtract total offsets (${d1 + d2 + d3}) from ${totalSum} and divide by 4 to get youngest age (${base}).`,
    rng,
  });
}

// E3. Combined Ratio A:B and B:C + Sum -> Find Specific Age (Hard)
function genE3_CombinedThreeRatio(rng, difficulty) {
  const configs = [
    // [a:b, b:c => combA, combB, combC, k]
    [2, 3, 4, 5, 8, 12, 15, 2],  // 16, 24, 30 (sum 70)
    [3, 4, 2, 3, 3, 4, 6, 5],    // 15, 20, 30 (sum 65)
    [2, 3, 6, 7, 4, 6, 7, 4],    // 16, 24, 28 (sum 68)
    [3, 5, 5, 7, 3, 5, 7, 4],    // 12, 20, 28 (sum 60)
    [4, 5, 3, 4, 12, 15, 20, 2], // 24, 30, 40 (sum 94)
  ];
  const [a1, b1, b2, c2, rA, rB, rC, k] = rng.pick(configs);
  const sum = (rA + rB + rC) * k;
  const targetIdx = rng.pick([0, 1, 2]);
  const [p1, p2, p3] = pickPeople(rng, 3);
  const ages = [rA * k, rB * k, rC * k];
  const ans = R(ages[targetIdx]);

  return assembleAgeQ({
    templateId: "AGE_E3_COMBINED_THREE_RATIO",
    question_type: "Multiple-Person Age Problems",
    sub_type: "Combined Ratio Conditions (3 People)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `The ratio of the present ages of ${p1} and ${p2} is ${a1} : ${b1}, and the ratio of the present ages of ${p2} and ${p3} is ${b2} : ${c2}. If the sum of the present ages of all three is ${sum} years, what is the present age of ${[p1, p2, p3][targetIdx]}?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(rA), R(rB), R(rC)],
      ratioTime: ZERO,
      sumAtTime: R(sum),
      sumTime: ZERO,
      targetIdx,
    },
    exactRationalAnswer: ans,
    plausible: [R(ages[(targetIdx + 1) % 3]), R(ages[(targetIdx + 2) % 3]), ans.add(R(4)), ans.sub(R(2))],
    solution: {
      given_data: [`${p1}:${p2} = ${a1}:${b1}`, `${p2}:${p3} = ${b2}:${c2}`, `Total sum = ${sum} years`],
      variables: [`Combine ratios by matching ${p2}'s term`],
      equations: [`${p1} : ${p2} : ${p3} = ${rA} : ${rB} : ${rC}`, `(${rA} + ${rB} + ${rC})k = ${sum}`],
      steps: [
        `Combined ratio = ${rA} : ${rB} : ${rC} (Sum = ${rA + rB + rC} parts)`,
        `1 part = ${sum} / ${rA + rB + rC} = ${k}`,
        `${[p1, p2, p3][targetIdx]}'s age = ${[rA, rB, rC][targetIdx]} × ${k} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Merge ${a1}:${b1} and ${b2}:${c2} into ${rA}:${rB}:${rC}, then divide ${sum} by ${rA + rB + rC}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY F: Average Age Problems (F1–F4)
// ============================================================================

// F1. Find Missing Age from Average
function genF1_MissingAgeFromAverage(rng, difficulty) {
  const avg = rng.randInt(24, 42);
  const a1 = avg - rng.randInt(3, 8);
  const a2 = avg + rng.randInt(2, 7);
  const a3 = avg - rng.randInt(1, 5);
  const missing = 4 * avg - (a1 + a2 + a3);

  return assembleAgeQ({
    templateId: "AGE_F1_MISSING_FROM_AVG",
    question_type: "Average Age Problems",
    sub_type: "Find Missing Age from Average",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The average age of four friends is ${avg} years. If the ages of three of them are ${a1} years, ${a2} years, and ${a3} years, what is the age of the fourth friend?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "MISSING_FROM_AVG",
      count: 4,
      avg: R(avg),
      knownAges: [R(a1), R(a2), R(a3)],
    },
    exactRationalAnswer: R(missing),
    plausible: [R(avg), R(missing + 2), R(Math.max(1, missing - 2)), R(missing + 4)],
    solution: {
      given_data: [`Average of 4 friends = ${avg} years`, `Three known ages = ${a1}, ${a2}, ${a3}`],
      variables: [`Let the fourth friend's age = x`],
      equations: [`(${a1} + ${a2} + ${a3} + x) / 4 = ${avg}`],
      steps: [
        `Total age of 4 friends = 4 × ${avg} = ${4 * avg} years`,
        `Sum of 3 known ages = ${a1 + a2 + a3} years`,
        `Fourth friend's age x = ${4 * avg} − ${a1 + a2 + a3} = ${missing} years`,
      ],
      final_answer: `${missing} years`,
    },
    shortcut_method: `Total = 4 × ${avg} = ${4 * avg}; subtract ${a1 + a2 + a3} to get ${missing} years.`,
    rng,
  });
}

// F2. Average Age After / Ago N Years
function genF2_AvgTimeShift(rng, difficulty) {
  const groupSize = rng.randInt(5, 12);
  const oldAvg = rng.randInt(22, 40);
  const yrs = rng.pick([4, 5, 6, 7, 8]);
  const isFuture = rng.random() < 0.5;
  const shift = isFuture ? yrs : -yrs;
  const newAvg = oldAvg + shift;

  return assembleAgeQ({
    templateId: "AGE_F2_AVG_TIME_SHIFT",
    question_type: "Average Age Problems",
    sub_type: isFuture ? "Average Age After Given Years" : "Average Age Given Years Ago",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The present average age of a group of ${groupSize} employees is ${oldAvg} years. Assuming the same ${groupSize} employees remain in the group, what ${isFuture ? `will be their average age after ${yrs} years` : `was their average age ${yrs} years ago`}?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "AVG_TIME_SHIFT",
      oldAvg: R(oldAvg),
      shiftYears: R(shift),
    },
    exactRationalAnswer: R(newAvg),
    plausible: [R(oldAvg - shift), R(oldAvg + groupSize), R(newAvg + 2), R(newAvg - 2)],
    solution: {
      given_data: [`Group size = ${groupSize}`, `Present average = ${oldAvg} years`, `Time shift = ${isFuture ? `+${yrs}` : `-${yrs}`} years`],
      variables: [`Each person's age changes by ${shift} years`],
      equations: [`New Average = Old Average + (${shift})`],
      steps: [
        `When every member's age changes by ${shift} years, the average also changes by exactly ${shift} years`,
        `New average age = ${oldAvg} ${isFuture ? "+" : "−"} ${yrs} = ${newAvg} years`,
      ],
      final_answer: `${newAvg} years`,
    },
    shortcut_method: `Group size (${groupSize}) does not matter: simply ${isFuture ? `add ${yrs}` : `subtract ${yrs}`} to ${oldAvg}.`,
    rng,
  });
}

// F3. Average Age When a New Member Joins
function genF3_MemberJoins(rng, difficulty) {
  const oldCount = rng.randInt(12, 25);
  const oldAvg = rng.randInt(18, 28);
  const inc = rng.pick([1, 2]);
  const newAvg = oldAvg + inc;
  const memberAge = newAvg * (oldCount + 1) - oldAvg * oldCount;
  // Common distractor: forgetting to increment group size (oldAvg + oldCount * inc)
  const wrongGroupSize = oldAvg + oldCount * inc;

  return assembleAgeQ({
    templateId: "AGE_F3_MEMBER_JOINS",
    question_type: "Average Age Problems",
    sub_type: "Find New Member's Age When Joining",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The average age of ${oldCount} students in a batch is ${oldAvg} years. When the instructor's age is included, the average age of the group increases by ${inc} year(s). What is the age of the instructor?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "JOIN_MEMBER",
      oldCount,
      oldAvg: R(oldAvg),
      newAvg: R(newAvg),
    },
    exactRationalAnswer: R(memberAge),
    plausible: [R(wrongGroupSize), R(memberAge + 2), R(memberAge - 2), R(oldAvg + inc)],
    solution: {
      given_data: [`Old count = ${oldCount}, Old avg = ${oldAvg}`, `New count = ${oldCount + 1}, New avg = ${newAvg}`],
      variables: [`Let instructor's age = x`],
      equations: [`x = (${oldCount + 1} × ${newAvg}) − (${oldCount} × ${oldAvg})`],
      steps: [
        `Old total age = ${oldCount} × ${oldAvg} = ${oldCount * oldAvg} years`,
        `New total age = ${oldCount + 1} × ${newAvg} = ${(oldCount + 1) * newAvg} years`,
        `Instructor's age = ${(oldCount + 1) * newAvg} − ${oldCount * oldAvg} = ${memberAge} years`,
      ],
      final_answer: `${memberAge} years`,
    },
    shortcut_method: `New member age = Old Avg + (New Count × Increase) = ${oldAvg} + (${oldCount + 1} × ${inc}) = ${memberAge} years.`,
    rng,
  });
}

// F4. Average Age When a Member Leaves
function genF4_MemberLeaves(rng, difficulty) {
  const oldCount = rng.randInt(10, 20);
  const oldAvg = rng.randInt(28, 44);
  const dec = rng.pick([1, 2]);
  const newAvg = oldAvg - dec;
  const leftAge = oldAvg * oldCount - newAvg * (oldCount - 1);
  const wrongGroupSize = oldAvg + oldCount * dec;

  return assembleAgeQ({
    templateId: "AGE_F4_MEMBER_LEAVES",
    question_type: "Average Age Problems",
    sub_type: "Find Leaving Member's Age",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The average age of ${oldCount} members of a club is ${oldAvg} years. When one senior member leaves the club, the average age of the remaining ${oldCount - 1} members decreases by ${dec} year(s). What was the age of the member who left?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "LEAVE_MEMBER",
      oldCount,
      oldAvg: R(oldAvg),
      newAvg: R(newAvg),
    },
    exactRationalAnswer: R(leftAge),
    plausible: [R(wrongGroupSize), R(leftAge - 2), R(leftAge + 3), R(oldAvg - (oldCount - 1) * dec)],
    solution: {
      given_data: [`Old count = ${oldCount}, Old avg = ${oldAvg}`, `New count = ${oldCount - 1}, New avg = ${newAvg}`],
      variables: [`Let leaving member's age = x`],
      equations: [`x = (${oldCount} × ${oldAvg}) − (${oldCount - 1} × ${newAvg})`],
      steps: [
        `Old total = ${oldCount * oldAvg} years; New total = ${(oldCount - 1) * newAvg} years`,
        `Leaving member's age = ${oldCount * oldAvg} − ${(oldCount - 1) * newAvg} = ${leftAge} years`,
      ],
      final_answer: `${leftAge} years`,
    },
    shortcut_method: `Leaving age = Old Avg + (Remaining Count × Decrease) = ${oldAvg} + (${oldCount - 1} × ${dec}) = ${leftAge} years.`,
    rng,
  });
}

// ============================================================================
// CATEGORY G: Age Replacement Problems (G1–G3)
// ============================================================================

// G1. Single Person Replacement -> Find New Member's Age
function genG1_ReplaceFindNew(rng, difficulty) {
  const groupSize = rng.randInt(8, 16);
  const oldAge = rng.randInt(24, 42);
  const inc = rng.pick([1, 2, 3]);
  const newAge = oldAge + groupSize * inc;

  return assembleAgeQ({
    templateId: "AGE_G1_REPLACE_FIND_NEW",
    question_type: "Age Replacement Problems",
    sub_type: "One Person Replaced — Find New Member's Age",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The average age of a committee of ${groupSize} persons increases by ${inc} year(s) when a member aged ${oldAge} years is replaced by a new member. What is the age of the new member?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "REPLACE_SINGLE",
      groupSize,
      avgChange: R(inc),
      knownAge: R(oldAge),
      ask: "NEW_AGE",
    },
    exactRationalAnswer: R(newAge),
    plausible: [R(oldAge + (groupSize + 1) * inc), R(Math.max(1, oldAge - groupSize * inc)), R(newAge + 2), R(newAge - 2)],
    solution: {
      given_data: [`Group size = ${groupSize}`, `Average increase = +${inc} year(s)`, `Outgoing age = ${oldAge} years`],
      variables: [`Let incoming member's age = x`],
      equations: [`x − ${oldAge} = ${groupSize} × ${inc}`],
      steps: [
        `Total increase in group's age = ${groupSize} × ${inc} = ${groupSize * inc} years`,
        `Incoming member's age = ${oldAge} + ${groupSize * inc} = ${newAge} years`,
      ],
      final_answer: `${newAge} years`,
    },
    shortcut_method: `New Age = Outgoing Age + (N × ΔAvg) = ${oldAge} + (${groupSize} × ${inc}) = ${newAge} years.`,
    rng,
  });
}

// G2. Single Person Replacement -> Find Old Member's Age
function genG2_ReplaceFindOld(rng, difficulty) {
  const groupSize = rng.randInt(8, 15);
  const newAge = rng.randInt(20, 32);
  const dec = rng.pick([1, 2]);
  const oldAge = newAge + groupSize * dec;

  return assembleAgeQ({
    templateId: "AGE_G2_REPLACE_FIND_OLD",
    question_type: "Age Replacement Problems",
    sub_type: "One Person Replaced — Find Outgoing Member's Age",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `When a member of a team of ${groupSize} officers is replaced by a new officer aged ${newAge} years, the average age of the team decreases by ${dec} year(s). What was the age of the outgoing officer?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "REPLACE_SINGLE",
      groupSize,
      avgChange: R(-dec),
      knownAge: R(newAge),
      ask: "OLD_AGE",
    },
    exactRationalAnswer: R(oldAge),
    plausible: [R(Math.max(1, newAge - groupSize * dec)), R(newAge + (groupSize - 1) * dec), R(oldAge + 2), R(oldAge - 2)],
    solution: {
      given_data: [`Team size = ${groupSize}`, `Average decrease = -${dec} year(s)`, `New officer's age = ${newAge} years`],
      variables: [`Let outgoing officer's age = x`],
      equations: [`${newAge} − x = −(${groupSize} × ${dec})`],
      steps: [
        `Total decrease in team's age = ${groupSize} × ${dec} = ${groupSize * dec} years`,
        `Outgoing officer's age = ${newAge} + ${groupSize * dec} = ${oldAge} years`,
      ],
      final_answer: `${oldAge} years`,
    },
    shortcut_method: `Outgoing Age = Incoming Age + (N × Decrease) = ${newAge} + ${groupSize * dec} = ${oldAge} years.`,
    rng,
  });
}

// G3. Multiple Replacement (2 Persons Replaced) -> Average Age of Two New Members
function genG3_MultipleReplacement(rng, difficulty) {
  const groupSize = rng.pick([8, 10, 12, 14, 16]);
  const out1 = rng.randInt(24, 36);
  let out2 = rng.randInt(26, 40);
  const inc = rng.pick([2, 3]);
  if ((out1 + out2 + groupSize * inc) % 2 !== 0) out2 += 1;
  const sumIn = out1 + out2 + groupSize * inc;
  const avgIn = sumIn / 2;

  return assembleAgeQ({
    templateId: "AGE_G3_MULTIPLE_REPLACEMENT",
    question_type: "Age Replacement Problems",
    sub_type: "Multiple Replacement (2 Members)",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `The average age of ${groupSize} employees in a branch increases by ${inc} years when two employees aged ${out1} years and ${out2} years are replaced by two new recruits. What is the average age of the two new recruits?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "REPLACE_MULTIPLE",
      groupSize,
      avgChange: R(inc),
      outgoingAges: [R(out1), R(out2)],
    },
    exactRationalAnswer: R(avgIn),
    plausible: [R(sumIn), R((out1 + out2) / 2 + inc), R(avgIn + 2), R(avgIn - 2)],
    solution: {
      given_data: [`Group size = ${groupSize}`, `ΔAvg = +${inc} years`, `Outgoing ages = ${out1}, ${out2}`],
      variables: [`Let sum of ages of 2 new recruits = S`],
      equations: [`S − (${out1} + ${out2}) = ${groupSize} × ${inc}`],
      steps: [
        `Sum of two new recruits = ${out1 + out2} + (${groupSize} × ${inc}) = ${sumIn} years`,
        `Average age of the two new recruits = ${sumIn} / 2 = ${avgIn} years`,
      ],
      final_answer: `${avgIn} years`,
    },
    shortcut_method: `Sum of incoming = (${out1}+${out2}) + (${groupSize}×${inc}) = ${sumIn}; divide by 2 ⇒ ${avgIn} years.`,
    rng,
  });
}

// ============================================================================
// CATEGORY H: Advanced Age Problems (H1–H3)
// ============================================================================

// H1. Family Average Age Ago + Baby Born
function genH1_FamilyBabyBorn(rng, difficulty) {
  const members = rng.pick([4, 5, 6]);
  const yearsAgo = rng.pick([3, 4, 5]);
  const babyAge = rng.randInt(1, yearsAgo);
  // Present sum of old members = members * (pastAvg + yearsAgo)
  // Present sum with baby = (members + 1) * presentAvg
  // Choose pastAvg = presentAvg => babyAge = pastAvg - members * yearsAgo
  const pastAvg = members * yearsAgo + babyAge;

  return assembleAgeQ({
    templateId: "AGE_H1_FAMILY_BABY_BORN",
    question_type: "Advanced Age Problems",
    sub_type: "Family Average Age with Time Shift and New Birth",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains", "SBI PO Mains"],
    question: `${yearsAgo} years ago, the average age of a family of ${members} members was ${pastAvg} years. A baby having been born in the meantime, the average age of the family today is still ${pastAvg} years. What is the present age of the baby?`,
    mathModel: {
      kind: "AVERAGE_OPERATION",
      subKind: "FAMILY_BABY_BORN",
      oldMembers: members,
      yearsAgo,
      pastAvg: R(pastAvg),
      presentAvg: R(pastAvg),
    },
    exactRationalAnswer: R(babyAge),
    plausible: [R(babyAge + 1), R(babyAge + 2), R(yearsAgo + 1), R(babyAge + 3)],
    maxVal: 15,
    solution: {
      given_data: [`${yearsAgo} years ago: ${members} members, avg = ${pastAvg}`, `Today: ${members + 1} members, avg = ${pastAvg}`],
      variables: [`Let baby's present age = b`],
      equations: [`${members}(${pastAvg} + ${yearsAgo}) + b = ${members + 1} × ${pastAvg}`],
      steps: [
        `Present sum of original ${members} members = ${members} × (${pastAvg} + ${yearsAgo}) = ${members * (pastAvg + yearsAgo)} years`,
        `Present sum of all ${members + 1} members = ${members + 1} × ${pastAvg} = ${(members + 1) * pastAvg} years`,
        `Baby's present age b = ${(members + 1) * pastAvg} − ${members * (pastAvg + yearsAgo)} = ${babyAge} ${babyAge === 1 ? "year" : "years"}`,
      ],
      final_answer: `${babyAge} ${babyAge === 1 ? "year" : "years"}`,
    },
    shortcut_method: `When average stays unchanged at ${pastAvg}, Baby's Age = ${pastAvg} − (${members} × ${yearsAgo}) = ${babyAge}.`,
    rng,
  });
}

// H2. Parent-Child Multi-Condition Past & Future Ratios (Hard)
function genH2_ParentChildTwoRatios(rng, difficulty) {
  const configs = [
    // [tPast, a1, b1, tFut, a2, b2, parentNow, childNow]
    [4, 4, 1, 6, 3, 1, 44, 14], // 4 ago: 40:10=4:1; 6 hence: 50:20=5:2 -> fix: 44+6=50, 14+6=20 => 5:2
    [4, 4, 1, 6, 5, 2, 44, 14], // 4 ago: 40:10=4:1; 6 hence: 50:20=5:2
    [5, 5, 1, 5, 3, 1, 55, 15], // 5 ago: 50:10=5:1; 5 hence: 60:20=3:1
    [6, 4, 1, 6, 5, 2, 42, 15], // 6 ago: 36:9=4:1; 6 hence: 48:21 -> skip
    [3, 4, 1, 9, 5, 2, 39, 12], // 3 ago: 36:9=4:1; 9 hence: 48:21 -> skip
    [5, 4, 1, 10, 5, 2, 45, 15], // 5 ago: 40:10=4:1; 10 hence: 55:25 -> skip
    [6, 5, 1, 6, 2, 1, 46, 14],  // 6 ago: 40:8=5:1; 6 hence: 52:20 -> skip
    [4, 5, 1, 8, 2, 1, 44, 12],  // 4 ago: 40:8=5:1; 8 hence: 52:20 -> skip
    [6, 3, 1, 6, 2, 1, 42, 18],  // 6 ago: 36:12=3:1; 6 hence: 48:24=2:1
    [5, 4, 1, 5, 5, 2, 37, 13],  // 5 ago: 32:8=4:1; 5 hence: 42:18=7:3 -> fix:
    [5, 4, 1, 5, 7, 3, 37, 13],  // 5 ago: 32:8=4:1; 5 hence: 42:18=7:3
    [4, 3, 1, 8, 2, 1, 40, 16],  // 4 ago: 36:12=3:1; 8 hence: 48:24=2:1
  ].filter(([tp, a1, b1, tf, a2, b2, f, s]) => (f - tp) * b1 === (s - tp) * a1 && (f + tf) * b2 === (s + tf) * a2);

  const [tPast, a1, b1, tFut, a2, b2, f, s] = rng.pick(configs);
  const askFather = rng.random() < 0.5;
  const ans = R(askFather ? f : s);

  return assembleAgeQ({
    templateId: "AGE_H2_PARENT_CHILD_TWO_RATIOS",
    question_type: "Advanced Age Problems",
    sub_type: "Parent-Child Combined Past and Future Ratios",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "SBI PO Prelims"],
    question: `${tPast} years ago, the ratio of a father's age to his son's age was ${a1} : ${b1}. After ${tFut} years from now, the ratio of their ages will become ${a2} : ${b2}. What is the present age of the ${askFather ? "father" : "son"}?`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: R(-tPast),
      a1: R(a1),
      b1: R(b1),
      t2: R(tFut),
      a2: R(a2),
      b2: R(b2),
      ask: askFather ? "FIRST" : "SECOND",
      parentChild: true,
    },
    exactRationalAnswer: ans,
    plausible: [R(askFather ? s : f), ans.sub(R(tPast)), ans.add(R(tFut)), ans.add(R(4))],
    solution: {
      given_data: [`${tPast} yrs ago = ${a1}:${b1}`, `${tFut} yrs hence = ${a2}:${b2}`],
      variables: [`Let present ages of father and son be F and S`],
      equations: [`(F − ${tPast})/(S − ${tPast}) = ${a1}/${b1}`, `(F + ${tFut})/(S + ${tFut}) = ${a2}/${b2}`],
      steps: [
        `Solving the two linear equations yields F = ${f} years and S = ${s} years`,
        `Verification: ${tPast} yrs ago = ${f - tPast}:${s - tPast} = ${a1}:${b1}; ${tFut} yrs hence = ${f + tFut}:${s + tFut} = ${a2}:${b2}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Total span is ${tPast + tFut} years; equate ratio difference across ${a1}:${b1} and ${a2}:${b2}.`,
    rng,
  });
}

// H3. Three-Person Past Sum + Future Age Request (Hard)
function genH3_ThreePersonPastSumFutureAge(rng, difficulty) {
  const triples = [[3, 4, 5], [2, 3, 5], [4, 5, 7], [3, 5, 6]];
  const [r1, r2, r3] = rng.pick(triples);
  const k = rng.randInt(4, 7);
  const ages = [r1 * k, r2 * k, r3 * k];
  const pastYrs = rng.pick([3, 4, 5]);
  const futYrs = rng.pick([4, 5, 6]);
  const pastSum = ages[0] + ages[1] + ages[2] - 3 * pastYrs;
  const targetIdx = rng.pick([0, 1, 2]);
  const [p1, p2, p3] = pickPeople(rng, 3);
  const ans = R(ages[targetIdx] + futYrs);

  return assembleAgeQ({
    templateId: "AGE_H3_THREE_PAST_SUM_FUTURE",
    question_type: "Advanced Age Problems",
    sub_type: "Three-Person Ratio, Past Sum and Future Age",
    difficulty,
    exam_level: ["IBPS PO Mains", "SBI PO Mains", "IBPS PO Prelims"],
    question: `The present ages of ${p1}, ${p2}, and ${p3} are in the ratio ${r1} : ${r2} : ${r3}. ${pastYrs} years ago, the sum of their ages was ${pastSum} years. What will be the age of ${[p1, p2, p3][targetIdx]} after ${futYrs} years from now?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(r1), R(r2), R(r3)],
      ratioTime: ZERO,
      sumAtTime: R(pastSum),
      sumTime: R(-pastYrs),
      targetIdx,
      askOffset: R(futYrs),
    },
    exactRationalAnswer: ans,
    plausible: [R(ages[targetIdx]), R(ages[targetIdx] - pastYrs), ans.add(R(3)), ans.sub(R(2))],
    solution: {
      given_data: [`Present ratio = ${r1}:${r2}:${r3}`, `Sum ${pastYrs} yrs ago = ${pastSum}`, `Find ${[p1, p2, p3][targetIdx]}'s age after ${futYrs} yrs`],
      variables: [`Let present ages be ${r1}k, ${r2}k, ${r3}k`],
      equations: [`Present sum = ${pastSum} + 3(${pastYrs}) = ${ages[0] + ages[1] + ages[2]}`],
      steps: [
        `${r1 + r2 + r3}k = ${ages[0] + ages[1] + ages[2]} ⇒ k = ${k}`,
        `${[p1, p2, p3][targetIdx]}'s present age = ${ages[targetIdx]} years`,
        `Age after ${futYrs} years = ${ages[targetIdx]} + ${futYrs} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Add 3 × ${pastYrs} (for 3 people) to ${pastSum}, split in ${r1}:${r2}:${r3}, then add ${futYrs}.`,
    rng,
  });
}

export const AGES_TEMPLATES_PART_2 = [
  { id: "AGE_E1", category: "E", difficulties: ["Easy", "Medium"], fn: genE1_ThreePersonRatio },
  { id: "AGE_E2", category: "E", difficulties: ["Medium"], fn: genE2_FourPersonOffsets },
  { id: "AGE_E3", category: "E", difficulties: ["Hard"], fn: genE3_CombinedThreeRatio },

  { id: "AGE_F1", category: "F", difficulties: ["Easy"], fn: genF1_MissingAgeFromAverage },
  { id: "AGE_F2", category: "F", difficulties: ["Easy"], fn: genF2_AvgTimeShift },
  { id: "AGE_F3", category: "F", difficulties: ["Medium"], fn: genF3_MemberJoins },
  { id: "AGE_F4", category: "F", difficulties: ["Medium"], fn: genF4_MemberLeaves },

  { id: "AGE_G1", category: "G", difficulties: ["Medium"], fn: genG1_ReplaceFindNew },
  { id: "AGE_G2", category: "G", difficulties: ["Medium"], fn: genG2_ReplaceFindOld },
  { id: "AGE_G3", category: "G", difficulties: ["Hard"], fn: genG3_MultipleReplacement },

  { id: "AGE_H1", category: "H", difficulties: ["Hard"], fn: genH1_FamilyBabyBorn },
  { id: "AGE_H2", category: "H", difficulties: ["Hard"], fn: genH2_ParentChildTwoRatios },
  { id: "AGE_H3", category: "H", difficulties: ["Hard"], fn: genH3_ThreePersonPastSumFutureAge },
];