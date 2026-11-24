// Place at: server/question-engine/generators/quant/problemsOnAges/agesTemplatesPart1.js
import { R, ZERO, reduceMultiRatio, buildFiveAgeOptions } from "./agesMath.js";

const MALE_NAMES = ["Aarav", "Rohan", "Vikram", "Karan", "Deepak", "Harsh", "Arjun", "Nikhil", "Pranav", "Siddharth"];
const FEMALE_NAMES = ["Priya", "Sneha", "Ananya", "Meera", "Divya", "Bhavna", "Gauri", "Jaya", "Neha", "Tanvi"];
const ALL_NAMES = [...MALE_NAMES, ...FEMALE_NAMES];

function pickPeople(rng, count = 2) {
  return rng.shuffle(ALL_NAMES).slice(0, count);
}

export function assembleAgeQ({
  templateId,
  question_type,
  sub_type,
  difficulty,
  exam_level,
  question,
  mathModel,
  exactRationalAnswer = null,
  ratioAnswer = null,
  ratioFormat = null,
  plausible = [],
  unit = "years",
  maxVal = 120,
  solution,
  shortcut_method = "",
  rng,
}) {
  const built = buildFiveAgeOptions(exactRationalAnswer, plausible, {
    unit,
    rng,
    ratioFormat,
    maxVal,
  });

  return {
    templateId,
    question_type,
    sub_type,
    difficulty,
    exam_level,
    question,
    mathModel,
    exactRationalAnswer,
    ratioAnswer,
    unit,
    options: built.optionsObj,
    optionsArray: built.optionsArray,
    correct_answer: built.correctKey,
    correctOptionIndex: built.correctOptionIndex,
    correct_answer_value: built.correctValue,
    solution,
    shortcut_method,
  };
}

// ============================================================================
// CATEGORY A: Basic Age Problems (A1–A3)
// ============================================================================

// A1. Find Individual Age from Sum and Difference
function genA1_SumAndDiff(rng, difficulty) {
  const younger = rng.randInt(14, 34);
  const diff = rng.pick([4, 6, 8, 10, 12, 14]);
  const older = younger + diff;
  const sum = older + younger;
  const askOlder = rng.random() < 0.5;
  const [p1, p2] = pickPeople(rng, 2);
  const ans = R(askOlder ? older : younger);
  const other = R(askOlder ? younger : older);

  return assembleAgeQ({
    templateId: "AGE_A1_SUM_DIFF",
    question_type: "Basic Age Problems",
    sub_type: "Find Individual Age from Sum and Difference",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The sum of the present ages of ${p1} and ${p2} is ${sum} years. If ${p1} is ${diff} years older than ${p2}, what is the present age of ${askOlder ? p1 : p2}?`,
    mathModel: {
      kind: "SUM_AND_DIFF",
      sum: R(sum),
      diff: R(diff),
      ask: askOlder ? "OLDER" : "YOUNGER",
    },
    exactRationalAnswer: ans,
    plausible: [other, R(sum / 2), ans.add(R(2)), ans.sub(R(2))],
    solution: {
      given_data: [`Sum of ages = ${sum} years`, `${p1} − ${p2} = ${diff} years`],
      variables: [`Let ${p1}'s age = x and ${p2}'s age = y`],
      equations: [`x + y = ${sum}`, `x − y = ${diff}`],
      steps: [
        `Adding both equations: 2x = ${sum + diff} ⇒ x = ${older} years`,
        `Subtracting: y = ${sum} − ${older} = ${younger} years`,
        `Verification: ${older} + ${younger} = ${sum} and ${older} − ${younger} = ${diff}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Older = (Sum + Diff)/2 = ${older}; Younger = (Sum − Diff)/2 = ${younger}.`,
    rng,
  });
}

// A2. Find Future or Past Age from Sum and Difference
function genA2_FutureOrPastAge(rng, difficulty) {
  const younger = rng.randInt(16, 32);
  const diff = rng.pick([4, 6, 8, 10]);
  const older = younger + diff;
  const sum = older + younger;
  const isFuture = rng.random() < 0.5;
  const shift = rng.pick([4, 5, 6, 7]);
  const offset = isFuture ? R(shift) : R(-shift);
  const ans = R(older).add(offset);
  const wrongDir = R(older).sub(offset); // Adding instead of subtracting (or vice versa)
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_A2_FUTURE_PAST_AGE",
    question_type: "Basic Age Problems",
    sub_type: isFuture ? "Find Age After Given Years" : "Find Age Given Years Ago",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The sum of the present ages of ${p1} and ${p2} is ${sum} years, and ${p1} is ${diff} years older than ${p2}. What ${isFuture ? `will be ${p1}'s age after ${shift} years` : `was ${p1}'s age ${shift} years ago`}?`,
    mathModel: {
      kind: "SUM_AND_DIFF",
      sum: R(sum),
      diff: R(diff),
      ask: "OLDER",
      offset,
    },
    exactRationalAnswer: ans,
    plausible: [R(older), wrongDir, R(younger).add(offset), ans.add(R(2))],
    solution: {
      given_data: [`Sum = ${sum} years`, `Difference = ${diff} years`, `Time shift = ${isFuture ? `+${shift}` : `-${shift}`} years`],
      variables: [`Let ${p1}'s present age = x`],
      equations: [`x + (x − ${diff}) = ${sum}`],
      steps: [
        `2x = ${sum + diff} ⇒ ${p1}'s present age x = ${older} years`,
        `${isFuture ? `After ${shift} years` : `${shift} years ago`}: ${older} ${isFuture ? "+" : "−"} ${shift} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Find present age (${older}) first, then ${isFuture ? `add ${shift}` : `subtract ${shift}`} years.`,
    rng,
  });
}

// A3. Age Difference Remains Constant Over Time
function genA3_ConstantAgeDiff(rng, difficulty) {
  const unit = rng.randInt(4, 9);
  const a = rng.pick([3, 4, 5]);
  const b = a + rng.pick([2, 3]);
  const age1 = a * unit;
  const age2 = b * unit;
  const futureYrs = rng.pick([5, 8, 10, 12]);
  const diff = age2 - age1;
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_A3_CONSTANT_DIFF",
    question_type: "Basic Age Problems",
    sub_type: "Find Age Difference (Constant Over Time)",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The present ages of ${p1} and ${p2} are in the ratio ${a} : ${b}, and the sum of their present ages is ${age1 + age2} years. What will be the difference between their ages after ${futureYrs} years?`,
    mathModel: {
      kind: "SUM_AND_DIFF",
      sum: R(age1 + age2),
      diff: R(diff),
      ask: "DIFF",
    },
    exactRationalAnswer: R(diff),
    plausible: [R(diff + futureYrs), R(diff + 2 * futureYrs), R(age1), R(diff + 2)],
    solution: {
      given_data: [`Present ratio = ${a}:${b}`, `Present sum = ${age1 + age2} years`],
      variables: [`Let ages be ${a}k and ${b}k`],
      equations: [`${a}k + ${b}k = ${age1 + age2}`],
      steps: [
        `${a + b}k = ${age1 + age2} ⇒ k = ${unit}`,
        `Present ages are ${age1} and ${age2} years ⇒ Present difference = ${diff} years`,
        `Since the age difference between two people never changes over time, the difference after ${futureYrs} years is still ${diff} years`,
      ],
      final_answer: `${diff} years`,
    },
    shortcut_method: `Age difference is invariant over time: (${b}−${a}) × ${unit} = ${diff} years.`,
    rng,
  });
}

// ============================================================================
// CATEGORY B: Age Ratio Problems (B1–B4)
// ============================================================================

// B1. Present Ratio + Sum -> Find Present Age
function genB1_PresentRatioSum(rng, difficulty) {
  const r1 = rng.pick([3, 4, 5, 7]);
  const r2 = r1 + rng.pick([1, 2, 3]);
  const k = rng.randInt(4, 9);
  const sum = (r1 + r2) * k;
  const askFirst = rng.random() < 0.5;
  const ans = R((askFirst ? r1 : r2) * k);
  const other = R((askFirst ? r2 : r1) * k);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_B1_PRESENT_RATIO_SUM",
    question_type: "Age Ratio Problems",
    sub_type: "Find Present Age from Ratio and Sum",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The present ages of ${p1} and ${p2} are in the ratio ${r1} : ${r2}. If the sum of their present ages is ${sum} years, what is the present age of ${askFirst ? p1 : p2}?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(r1), R(r2)],
      ratioTime: ZERO,
      sumAtTime: R(sum),
      sumTime: ZERO,
      targetIdx: askFirst ? 0 : 1,
    },
    exactRationalAnswer: ans,
    plausible: [other, ans.add(R(k)), ans.sub(R(2)), ans.add(R(3))],
    solution: {
      given_data: [`Ratio ${p1}:${p2} = ${r1}:${r2}`, `Sum = ${sum} years`],
      variables: [`Let ${p1}'s age = ${r1}x and ${p2}'s age = ${r2}x`],
      equations: [`${r1}x + ${r2}x = ${sum}`],
      steps: [
        `${r1 + r2}x = ${sum} ⇒ x = ${k}`,
        `${askFirst ? p1 : p2}'s present age = ${askFirst ? r1 : r2} × ${k} = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `1 unit = ${sum}/${r1 + r2} = ${k}; multiply by ${askFirst ? r1 : r2}.`,
    rng,
  });
}

// B2. Present Ratio + Future Ratio -> Find Present Age
function genB2_PresentAndFutureRatio(rng, difficulty) {
  const configs = [
    // [a1, b1, n, a2, b2, x, y]
    [3, 4, 6, 4, 5, 18, 24],
    [4, 5, 8, 5, 6, 32, 40],
    [5, 7, 6, 3, 4, 30, 42],
    [2, 3, 10, 3, 4, 20, 30],
    [5, 6, 7, 6, 7, 35, 42],
    [3, 5, 8, 2, 3, 24, 40],
    [4, 7, 6, 5, 8, 24, 42],
  ];
  const [a1, b1, n, a2, b2, x, y] = rng.pick(configs);
  const askFirst = rng.random() < 0.5;
  const ans = R(askFirst ? x : y);
  const other = R(askFirst ? y : x);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_B2_PRESENT_FUTURE_RATIO",
    question_type: "Age Ratio Problems",
    sub_type: "Present and Future Age Ratios",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The present ages of ${p1} and ${p2} are in the ratio ${a1} : ${b1}. After ${n} years, the ratio of their ages will become ${a2} : ${b2}. What is the present age of ${askFirst ? p1 : p2}?`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: ZERO,
      a1: R(a1),
      b1: R(b1),
      t2: R(n),
      a2: R(a2),
      b2: R(b2),
      ask: askFirst ? "FIRST" : "SECOND",
    },
    exactRationalAnswer: ans,
    plausible: [other, ans.add(R(n)), ans.sub(R(n)), ans.add(R(4))],
    solution: {
      given_data: [`Present ratio = ${a1}:${b1}`, `Ratio after ${n} years = ${a2}:${b2}`],
      variables: [`Let present ages of ${p1} and ${p2} be ${a1}k and ${b1}k`],
      equations: [`(${a1}k + ${n}) / (${b1}k + ${n}) = ${a2} / ${b2}`],
      steps: [
        `Cross-multiply: ${b2}(${a1}k + ${n}) = ${a2}(${b1}k + ${n})`,
        `Solving gives k = ${x / a1} ⇒ Present ages: ${p1} = ${x} years, ${p2} = ${y} years`,
        `Verification: (${x}+${n}) : (${y}+${n}) = ${x + n} : ${y + n} = ${a2} : ${b2}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Equate the ratio difference between (${a1}:${b1}) and (${a2}:${b2}); the uniform part shift equals ${n} years.`,
    rng,
  });
}

// B3. Present Ratio + Past Ratio -> Find Present Age
function genB3_PresentAndPastRatio(rng, difficulty) {
  const configs = [
    // [a1, b1 (present), n (years ago), a2, b2 (past), x, y]
    [4, 5, 6, 3, 4, 24, 30],
    [5, 6, 5, 4, 5, 25, 30],
    [5, 7, 8, 3, 5, 20, 28],
    [7, 9, 6, 5, 7, 21, 27],
    [4, 7, 6, 1, 2, 24, 42],
    [5, 8, 9, 2, 5, 15, 24],
    [6, 7, 8, 4, 5, 24, 28],
  ];
  const [a1, b1, n, a2, b2, x, y] = rng.pick(configs);
  const askFirst = rng.random() < 0.5;
  const ans = R(askFirst ? x : y);
  const other = R(askFirst ? y : x);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_B3_PRESENT_PAST_RATIO",
    question_type: "Age Ratio Problems",
    sub_type: "Present and Past Age Ratios",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The present ages of ${p1} and ${p2} are in the ratio ${a1} : ${b1}. ${n} years ago, the ratio of their ages was ${a2} : ${b2}. Find the present age of ${askFirst ? p1 : p2}.`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: ZERO,
      a1: R(a1),
      b1: R(b1),
      t2: R(-n),
      a2: R(a2),
      b2: R(b2),
      ask: askFirst ? "FIRST" : "SECOND",
    },
    exactRationalAnswer: ans,
    plausible: [other, ans.sub(R(n)), ans.add(R(n)), ans.add(R(3))],
    solution: {
      given_data: [`Present ratio = ${a1}:${b1}`, `Ratio ${n} years ago = ${a2}:${b2}`],
      variables: [`Let present ages be ${a1}k and ${b1}k`],
      equations: [`(${a1}k − ${n}) / (${b1}k − ${n}) = ${a2} / ${b2}`],
      steps: [
        `Cross-multiply: ${b2}(${a1}k − ${n}) = ${a2}(${b1}k − ${n})`,
        `Solving gives k = ${x / a1} ⇒ Present ages: ${p1} = ${x} years, ${p2} = ${y} years`,
        `Verification: (${x}−${n}) : (${y}−${n}) = ${x - n} : ${y - n} = ${a2} : ${b2}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Match the ratio gap between ${a1}:${b1} and ${a2}:${b2}; the drop in parts equals ${n} years.`,
    rng,
  });
}

// B4. Past Ratio + Future Ratio -> Find Present Age
function genB4_PastAndFutureRatio(rng, difficulty) {
  const configs = [
    // [tPast, a1, b1, tFut, a2, b2, x, y]
    [4, 3, 4, 4, 5, 6, 16, 20],  // 4 ago: 12:16=3:4; 4 hence: 20:24=5:6
    [5, 2, 3, 5, 3, 4, 25, 35],  // 5 ago: 20:30=2:3; 5 hence: 30:40=3:4
    [6, 3, 5, 6, 2, 3, 24, 36],  // 6 ago: 18:30=3:5; 6 hence: 30:42=5:7 -> fix: 30/42=5/7!
    [6, 3, 5, 6, 5, 7, 24, 36],  // 6 ago: 18:30=3:5; 6 hence: 30:42=5:7
    [3, 4, 5, 6, 7, 8, 15, 18],  // 3 ago: 12:15=4:5; 6 hence: 21:24=7:8
    [4, 5, 7, 8, 7, 9, 34, 46],  // 4 ago: 30:42=5:7; 8 hence: 42:54=7:9
    [5, 4, 7, 5, 3, 5, 25, 40],  // 5 ago: 20:35=4:7; 5 hence: 30:45=2:3 -> fix:
    [5, 4, 7, 5, 2, 3, 25, 40],  // 5 ago: 20:35=4:7; 5 hence: 30:45=2:3
  ].filter(([tp, a1, b1, tf, a2, b2, x, y]) => (x - tp) * b1 === (y - tp) * a1 && (x + tf) * b2 === (y + tf) * a2);

  const [tPast, a1, b1, tFut, a2, b2, x, y] = rng.pick(configs);
  const askFirst = rng.random() < 0.5;
  const ans = R(askFirst ? x : y);
  const other = R(askFirst ? y : x);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_B4_PAST_FUTURE_RATIO",
    question_type: "Age Ratio Problems",
    sub_type: "Find Present Age Using Past and Future Ratios",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `${tPast} years ago, the ages of ${p1} and ${p2} were in the ratio ${a1} : ${b1}. After ${tFut} years from now, the ratio of their ages will become ${a2} : ${b2}. What is the present age of ${askFirst ? p1 : p2}?`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: R(-tPast),
      a1: R(a1),
      b1: R(b1),
      t2: R(tFut),
      a2: R(a2),
      b2: R(b2),
      ask: askFirst ? "FIRST" : "SECOND",
    },
    exactRationalAnswer: ans,
    plausible: [other, ans.sub(R(tPast)), ans.add(R(tFut)), ans.add(R(4))],
    solution: {
      given_data: [`${tPast} years ago ratio = ${a1}:${b1}`, `${tFut} years hence ratio = ${a2}:${b2}`, `Total span = ${tPast + tFut} years`],
      variables: [`Let ${tPast} years ago, ages of ${p1} and ${p2} be ${a1}k and ${b1}k`],
      equations: [`(${a1}k + ${tPast + tFut}) / (${b1}k + ${tPast + tFut}) = ${a2} / ${b2}`],
      steps: [
        `Solving the equation yields ${p1}'s age ${tPast} years ago = ${x - tPast} and ${p2}'s = ${y - tPast}`,
        `Add ${tPast} years to get present ages: ${p1} = ${x} years, ${p2} = ${y} years`,
        `Verification: ${tFut} years hence = ${x + tFut} : ${y + tFut} = ${a2} : ${b2}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Total time gap between ratios is ${tPast} + ${tFut} = ${tPast + tFut} years; solve for past age first, then add ${tPast}.`,
    rng,
  });
}

// ============================================================================
// CATEGORY C: Parent and Child Problems (C1–C4)
// ============================================================================

// C1. Father and Son Present Ratio + Future Multiple
function genC1_FatherSonRatio(rng, difficulty) {
  const configs = [
    // [presentFather, presentSon, futYrs, futMult]
    [40, 10, 20, 2], // 4:1 now; +20 => 60:30 = 2:1
    [45, 15, 15, 2], // 3:1 now; +15 => 60:30 = 2:1
    [48, 12, 6, 3],  // 4:1 now; +6 => 54:18 = 3:1
    [42, 14, 14, 2], // 3:1 now; +14 => 56:28 = 2:1
    [50, 20, 10, 2], // 5:2 now; +10 => 60:30 = 2:1
    [44, 12, 4, 3],  // 11:3 now; +4 => 48:16 = 3:1
  ];
  const [f, s, futYrs, mult] = rng.pick(configs);
  const presRed = reduceMultiRatio([f, s]);
  const askFather = rng.random() < 0.5;
  const ans = R(askFather ? f : s);

  return assembleAgeQ({
    templateId: "AGE_C1_FATHER_SON",
    question_type: "Parent and Child Problems",
    sub_type: "Father and Son Age Ratio",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The present ages of a father and his son are in the ratio ${presRed.str}. After ${futYrs} years, the father will be ${mult} times as old as his son. What is the present age of the ${askFather ? "father" : "son"}?`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: ZERO,
      a1: R(presRed.parts[0]),
      b1: R(presRed.parts[1]),
      t2: R(futYrs),
      a2: R(mult),
      b2: R(1),
      ask: askFather ? "FIRST" : "SECOND",
      parentChild: true,
    },
    exactRationalAnswer: ans,
    plausible: [R(askFather ? s : f), ans.add(R(futYrs)), ans.sub(R(4)), ans.add(R(6))],
    solution: {
      given_data: [`Present Father : Son = ${presRed.str}`, `After ${futYrs} years, Father : Son = ${mult} : 1`],
      variables: [`Let present ages be ${presRed.parts[0]}k and ${presRed.parts[1]}k`],
      equations: [`(${presRed.parts[0]}k + ${futYrs}) / (${presRed.parts[1]}k + ${futYrs}) = ${mult} / 1`],
      steps: [
        `${presRed.parts[0]}k + ${futYrs} = ${mult * presRed.parts[1]}k + ${mult * futYrs}`,
        `Solving gives Father = ${f} years, Son = ${s} years`,
        `Verification: After ${futYrs} years, ${f + futYrs} = ${mult} × ${s + futYrs}`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Father's age (${f}) − Son's age (${s}) = ${f - s} years stays constant; in ${futYrs} yrs, (${mult}−1) parts = ${f - s}.`,
    rng,
  });
}

// C2. Mother and Daughter Past Ratio + Present Sum
function genC2_MotherDaughter(rng, difficulty) {
  const configs = [
    // [m, d, pastYrs, pastA, pastB]
    [40, 16, 4, 3, 1], // 4 ago: 36:12 = 3:1
    [46, 18, 4, 3, 1], // 4 ago: 42:14 = 3:1
    [45, 17, 3, 3, 1], // 3 ago: 42:14 = 3:1
    [50, 20, 5, 3, 1], // 5 ago: 45:15 = 3:1
    [47, 19, 5, 3, 1], // 5 ago: 42:14 = 3:1
    [44, 20, 4, 5, 2], // 4 ago: 40:16 = 5:2
    [41, 17, 5, 3, 1], // 5 ago: 36:12 = 3:1
  ];
  const [m, d, pastYrs, pastA, pastB] = rng.pick(configs);
  const presentSum = m + d;
  const askMother = rng.random() < 0.5;
  const ans = R(askMother ? m : d);

  return assembleAgeQ({
    templateId: "AGE_C2_MOTHER_DAUGHTER",
    question_type: "Parent and Child Problems",
    sub_type: "Mother and Daughter Age Problem",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims"],
    question: `The sum of the present ages of a mother and her daughter is ${presentSum} years. ${pastYrs} years ago, the ratio of the mother's age to her daughter's age was ${pastA} : ${pastB}. What is the present age of the ${askMother ? "mother" : "daughter"}?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(pastA), R(pastB)],
      ratioTime: R(-pastYrs),
      sumAtTime: R(presentSum),
      sumTime: ZERO,
      targetIdx: askMother ? 0 : 1,
      parentChild: true,
    },
    exactRationalAnswer: ans,
    plausible: [R(askMother ? d : m), ans.sub(R(pastYrs)), ans.add(R(pastYrs)), ans.add(R(3))],
    solution: {
      given_data: [`Present sum = ${presentSum} years`, `${pastYrs} years ago ratio = ${pastA}:${pastB}`],
      variables: [`Let ${pastYrs} years ago, Mother = ${pastA}k and Daughter = ${pastB}k`],
      equations: [`Sum ${pastYrs} years ago = ${presentSum} − 2(${pastYrs}) = ${presentSum - 2 * pastYrs}`],
      steps: [
        `${pastA + pastB}k = ${presentSum - 2 * pastYrs} ⇒ k = ${(presentSum - 2 * pastYrs) / (pastA + pastB)}`,
        `Ages ${pastYrs} years ago: Mother = ${m - pastYrs}, Daughter = ${d - pastYrs}`,
        `Present ages: Mother = ${m} years, Daughter = ${d} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Subtract 2 × ${pastYrs} from present sum (${presentSum}) to get sum ${pastYrs} years ago, split in ${pastA}:${pastB}, then add ${pastYrs}.`,
    rng,
  });
}

// C3. Parent's Age When Child Was Born
function genC3_ParentAgeAtBirth(rng, difficulty) {
  const childAge = rng.randInt(10, 22);
  const gap = rng.randInt(24, 34);
  const parentAge = childAge + gap;
  const futureYrs = rng.pick([4, 6, 8]);
  const futureSum = parentAge + childAge + 2 * futureYrs;

  return assembleAgeQ({
    templateId: "AGE_C3_AGE_AT_BIRTH",
    question_type: "Parent and Child Problems",
    sub_type: "Parent's Age When Child Was Born",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `A father is currently ${parentAge} years old. In ${futureYrs} years, the sum of the ages of the father and his son will be ${futureSum} years. How old was the father when his son was born?`,
    mathModel: {
      kind: "AGE_AT_BIRTH",
      parentAge: R(parentAge),
      childAge: R(childAge),
    },
    exactRationalAnswer: R(gap),
    plausible: [R(childAge), R(gap + futureYrs), R(gap - 2), R(parentAge - futureYrs)],
    solution: {
      given_data: [`Father's present age = ${parentAge} years`, `Sum after ${futureYrs} years = ${futureSum} years`],
      variables: [`Let son's present age = s`],
      equations: [`(${parentAge} + ${futureYrs}) + (s + ${futureYrs}) = ${futureSum}`],
      steps: [
        `Present sum of ages = ${futureSum} − 2(${futureYrs}) = ${parentAge + childAge} years`,
        `Son's present age s = ${parentAge + childAge} − ${parentAge} = ${childAge} years`,
        `Father's age when son was born = ${parentAge} − ${childAge} = ${gap} years`,
      ],
      final_answer: `${gap} years`,
    },
    shortcut_method: `Parent's age at child's birth is always equal to their constant age difference (${parentAge} − ${childAge} = ${gap} years).`,
    rng,
  });
}

// C4. When Will Parent Be Twice / Three Times the Child's Age?
function genC4_WhenParentMultiple(rng, difficulty) {
  const configs = [
    // [parentNow, childNow, mult, yrs]
    [36, 12, 2, 12], // +12 => 48 : 24 = 2:1
    [40, 14, 2, 12], // +12 => 52 : 26 = 2:1
    [42, 16, 2, 10], // +10 => 52 : 26 = 2:1
    [38, 15, 2, 8],  // +8  => 46 : 23 = 2:1
    [44, 10, 3, 7],  // +7  => 51 : 17 = 3:1
    [46, 12, 3, 5],  // +5  => 51 : 17 = 3:1
    [48, 14, 3, 3],  // +3  => 51 : 17 = 3:1
  ];
  const [pNow, cNow, mult, yrs] = rng.pick(configs);

  return assembleAgeQ({
    templateId: "AGE_C4_WHEN_PARENT_MULTIPLE",
    question_type: "Parent and Child Problems",
    sub_type: mult === 2 ? "When Parent Will Be Twice Child's Age" : "When Parent Will Be Three Times Child's Age",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `A father is currently ${pNow} years old and his daughter is ${cNow} years old. After how many years will the father's age be ${mult === 2 ? "twice" : "three times"} his daughter's age?`,
    mathModel: {
      kind: "YEARS_FOR_RATIO",
      age1: R(pNow),
      age2: R(cNow),
      targetA: R(mult),
      targetB: R(1),
      parentChild: true,
    },
    exactRationalAnswer: R(yrs),
    plausible: [R(yrs + 2), R(Math.max(1, yrs - 2)), R(pNow - cNow), R(yrs + 4)],
    solution: {
      given_data: [`Father = ${pNow} years`, `Daughter = ${cNow} years`, `Target multiple = ${mult}`],
      variables: [`Let the required number of years be n`],
      equations: [`${pNow} + n = ${mult}(${cNow} + n)`],
      steps: [
        `${pNow} + n = ${mult * cNow} + ${mult}n`,
        `${mult - 1}n = ${pNow - mult * cNow} ⇒ n = ${yrs} years`,
        `Verification: ${pNow + yrs} = ${mult} × ${cNow + yrs}`,
      ],
      final_answer: `${yrs} years`,
    },
    shortcut_method: `n = (${pNow} − ${mult}×${cNow}) / (${mult} − 1) = ${yrs} years.`,
    rng,
  });
}

// ============================================================================
// CATEGORY D: Past and Future Age Problems (D1–D4)
// ============================================================================

// D1. Find Future or Past Ratio from Present Ages
function genD1_FindFuturePastRatio(rng, difficulty) {
  const age1 = rng.randInt(18, 36);
  let age2 = rng.randInt(20, 44);
  if (age1 === age2) age2 += 4;
  const isFuture = rng.random() < 0.5;
  const yrs = rng.pick([4, 5, 6, 8]);
  const offset = isFuture ? yrs : -yrs;
  const red = reduceMultiRatio([age1 + offset, age2 + offset]);
  const wrongPres = reduceMultiRatio([age1, age2]).str;
  const wrongOpp = reduceMultiRatio([age1 - offset, age2 - offset]).str;
  const rev = `${red.parts[1]} : ${red.parts[0]}`;
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_D1_FIND_SHIFTED_RATIO",
    question_type: "Past and Future Age Problems",
    sub_type: isFuture ? "Ratio of Ages in the Future" : "Ratio of Ages in the Past",
    difficulty,
    exam_level: ["IBPS RRB Clerk", "IBPS Clerk Prelims", "SBI Clerk Prelims"],
    question: `The present ages of ${p1} and ${p2} are ${age1} years and ${age2} years respectively. What ${isFuture ? `will be the ratio of their ages after ${yrs} years` : `was the ratio of their ages ${yrs} years ago`}?`,
    mathModel: {
      kind: "FIND_RATIO_AT_OFFSET",
      ages: [R(age1), R(age2)],
      offset: R(offset),
    },
    ratioAnswer: red.str,
    ratioFormat: {
      correct: red.str,
      parts: red.parts,
      distractors: [rev, wrongPres, wrongOpp, `${red.parts[0] + 1} : ${red.parts[1]}`],
    },
    solution: {
      given_data: [`Present ages: ${p1} = ${age1}, ${p2} = ${age2}`, `Shift = ${isFuture ? `+${yrs}` : `-${yrs}`} years`],
      variables: [`Shifted ages = ${age1 + offset} and ${age2 + offset}`],
      equations: [`Required Ratio = (${age1} ${isFuture ? "+" : "−"} ${yrs}) : (${age2} ${isFuture ? "+" : "−"} ${yrs})`],
      steps: [
        `New ages = ${age1 + offset} years and ${age2 + offset} years`,
        `Simplifying ${age1 + offset} : ${age2 + offset} gives ${red.str}`,
      ],
      final_answer: red.str,
    },
    shortcut_method: `Apply the ${isFuture ? `+${yrs}` : `-${yrs}`} shift to both ages first, then divide by their HCF.`,
    rng,
  });
}

// D2. Find Number of Years When a Given Ratio Occurs
function genD2_YearsForRatio(rng, difficulty) {
  const configs = [
    [20, 30, 3, 4, 10], // +10 => 30:40 = 3:4
    [18, 24, 4, 5, 6],  // +6 => 24:30 = 4:5
    [22, 34, 5, 7, 8],  // +8 => 30:42 = 5:7
    [25, 35, 7, 9, 10], // +10 => 35:45 = 7:9
    [16, 28, 2, 3, 8],  // +8 => 24:36 = 2:3
    [24, 32, 5, 6, 16], // +16 => 40:48 = 5:6
  ];
  const [a1, a2, tA, tB, yrs] = rng.pick(configs);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_D2_YEARS_FOR_RATIO",
    question_type: "Past and Future Age Problems",
    sub_type: "Find Number of Years When a Given Ratio Occurs",
    difficulty,
    exam_level: ["IBPS Clerk Prelims", "IBPS PO Prelims", "SBI Clerk Prelims", "IBPS RRB PO"],
    question: `The present ages of ${p1} and ${p2} are ${a1} years and ${a2} years respectively. After how many years will the ratio of their ages become ${tA} : ${tB}?`,
    mathModel: {
      kind: "YEARS_FOR_RATIO",
      age1: R(a1),
      age2: R(a2),
      targetA: R(tA),
      targetB: R(tB),
    },
    exactRationalAnswer: R(yrs),
    plausible: [R(yrs + 2), R(Math.max(1, yrs - 2)), R(a2 - a1), R(yrs + 4)],
    solution: {
      given_data: [`Present ages: ${p1} = ${a1}, ${p2} = ${a2}`, `Target ratio = ${tA}:${tB}`],
      variables: [`Let the required number of years be n`],
      equations: [`(${a1} + n) / (${a2} + n) = ${tA} / ${tB}`],
      steps: [
        `Cross-multiply: ${tB}(${a1} + n) = ${tA}(${a2} + n)`,
        `(${tB - tA})n = ${tA * a2 - tB * a1} ⇒ n = ${yrs} years`,
        `Verification: (${a1 + yrs}) : (${a2 + yrs}) = ${tA} : ${tB}`,
      ],
      final_answer: `${yrs} years`,
    },
    shortcut_method: `Since age gap (${a2 - a1}) is constant, ${tB - tA} ratio parts = ${a2 - a1} ⇒ future age of ${p1} = ${a1 + yrs} ⇒ ${yrs} years.`,
    rng,
  });
}

// D3. Sum of Ages in Past + Present Ratio -> Find Future Age
function genD3_PastSumPresentRatioFutureAge(rng, difficulty) {
  const r1 = rng.pick([3, 4, 5]);
  const r2 = r1 + rng.pick([2, 3]);
  const k = rng.randInt(4, 8);
  const age1 = r1 * k;
  const age2 = r2 * k;
  const pastYrs = rng.pick([4, 5, 6]);
  const futYrs = rng.pick([4, 5, 6]);
  const pastSum = age1 + age2 - 2 * pastYrs;
  const ans = R(age1 + futYrs);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_D3_PAST_SUM_FUTURE_AGE",
    question_type: "Past and Future Age Problems",
    sub_type: "Find Future Age from Past Sum and Present Ratio",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS Clerk Mains", "IBPS RRB PO"],
    question: `The present ages of ${p1} and ${p2} are in the ratio ${r1} : ${r2}. ${pastYrs} years ago, the sum of their ages was ${pastSum} years. What will be ${p1}'s age after ${futYrs} years from now?`,
    mathModel: {
      kind: "RATIO_AND_SUM",
      ratioParts: [R(r1), R(r2)],
      ratioTime: ZERO,
      sumAtTime: R(pastSum),
      sumTime: R(-pastYrs),
      targetIdx: 0,
      askOffset: R(futYrs),
    },
    exactRationalAnswer: ans,
    plausible: [R(age1), R(age1 - pastYrs), R(age2 + futYrs), ans.add(R(3))],
    solution: {
      given_data: [`Present ratio = ${r1}:${r2}`, `Sum ${pastYrs} years ago = ${pastSum} years`],
      variables: [`Let present ages be ${r1}k and ${r2}k`],
      equations: [`Present sum = ${pastSum} + 2(${pastYrs}) = ${age1 + age2}`],
      steps: [
        `${r1 + r2}k = ${age1 + age2} ⇒ k = ${k}`,
        `${p1}'s present age = ${r1} × ${k} = ${age1} years`,
        `${p1}'s age after ${futYrs} years = ${age1} + ${futYrs} = ${age1 + futYrs} years`,
      ],
      final_answer: `${age1 + futYrs} years`,
    },
    shortcut_method: `Add 2×${pastYrs} to ${pastSum} to get present sum (${age1 + age2}), find ${p1}'s present age (${age1}), then add ${futYrs}.`,
    rng,
  });
}

// D4. Find Sum of Ages After N Years from Past & Future Ratio
function genD4_FutureSumFromTwoRatios(rng, difficulty) {
  const configs = [
    [4, 3, 4, 4, 5, 6, 16, 20, 6],
    [5, 2, 3, 5, 3, 4, 25, 35, 5],
    [6, 3, 5, 6, 5, 7, 24, 36, 4],
    [3, 4, 5, 6, 7, 8, 15, 18, 7],
  ];
  const [tPast, a1, b1, tFut, a2, b2, x, y, askFut] = rng.pick(configs);
  const ans = R(x + y + 2 * askFut);
  const [p1, p2] = pickPeople(rng, 2);

  return assembleAgeQ({
    templateId: "AGE_D4_FUTURE_SUM_TWO_RATIOS",
    question_type: "Past and Future Age Problems",
    sub_type: "Find Future Sum from Past and Future Conditions",
    difficulty,
    exam_level: ["IBPS PO Prelims", "SBI PO Prelims", "IBPS PO Mains"],
    question: `${tPast} years ago, the ratio of the ages of ${p1} and ${p2} was ${a1} : ${b1}. ${tFut} years hence, the ratio of their ages will be ${a2} : ${b2}. What will be the sum of their ages ${askFut} years from now?`,
    mathModel: {
      kind: "TWO_RATIO_SYSTEM",
      t1: R(-tPast),
      a1: R(a1),
      b1: R(b1),
      t2: R(tFut),
      a2: R(a2),
      b2: R(b2),
      ask: "SUM",
      askOffset: R(askFut),
    },
    exactRationalAnswer: ans,
    plausible: [R(x + y), R(x + y + askFut), ans.add(R(4)), ans.sub(R(4))],
    solution: {
      given_data: [`${tPast} yrs ago = ${a1}:${b1}`, `${tFut} yrs hence = ${a2}:${b2}`, `Find sum after ${askFut} yrs`],
      variables: [`Let present ages be x and y`],
      equations: [`(x − ${tPast})/(y − ${tPast}) = ${a1}/${b1}`, `(x + ${tFut})/(y + ${tFut}) = ${a2}/${b2}`],
      steps: [
        `Solving both equations gives present ages: ${p1} = ${x} years, ${p2} = ${y} years`,
        `Present sum = ${x + y} years`,
        `Sum after ${askFut} years = ${x + y} + 2(${askFut}) = ${ans.toExamString()} years`,
      ],
      final_answer: `${ans.toExamString()} years`,
    },
    shortcut_method: `Remember to add 2 × ${askFut} (for both people) to the present sum (${x + y}).`,
    rng,
  });
}

export const AGES_TEMPLATES_PART_1 = [
  { id: "AGE_A1", category: "A", difficulties: ["Easy"], fn: genA1_SumAndDiff },
  { id: "AGE_A2", category: "A", difficulties: ["Easy"], fn: genA2_FutureOrPastAge },
  { id: "AGE_A3", category: "A", difficulties: ["Easy"], fn: genA3_ConstantAgeDiff },

  { id: "AGE_B1", category: "B", difficulties: ["Easy"], fn: genB1_PresentRatioSum },
  { id: "AGE_B2", category: "B", difficulties: ["Medium"], fn: genB2_PresentAndFutureRatio },
  { id: "AGE_B3", category: "B", difficulties: ["Medium"], fn: genB3_PresentAndPastRatio },
  { id: "AGE_B4", category: "B", difficulties: ["Medium", "Hard"], fn: genB4_PastAndFutureRatio },

  { id: "AGE_C1", category: "C", difficulties: ["Medium"], fn: genC1_FatherSonRatio },
  { id: "AGE_C2", category: "C", difficulties: ["Medium"], fn: genC2_MotherDaughter },
  { id: "AGE_C3", category: "C", difficulties: ["Easy", "Medium"], fn: genC3_ParentAgeAtBirth },
  { id: "AGE_C4", category: "C", difficulties: ["Medium"], fn: genC4_WhenParentMultiple },

  { id: "AGE_D1", category: "D", difficulties: ["Easy"], fn: genD1_FindFuturePastRatio },
  { id: "AGE_D2", category: "D", difficulties: ["Medium"], fn: genD2_YearsForRatio },
  { id: "AGE_D3", category: "D", difficulties: ["Medium"], fn: genD3_PastSumPresentRatioFutureAge },
  { id: "AGE_D4", category: "D", difficulties: ["Hard"], fn: genD4_FutureSumFromTwoRatios },
];