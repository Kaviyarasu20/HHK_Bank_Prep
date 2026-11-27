/**
 * Modular Banking Exam Order & Ranking Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. TOTAL_AND_RANK          — Single-row total, opposite-end rank, and shifted position
 * 2. INTERCHANGE_POSITIONS   — Position interchange (total, new rank, persons between)
 * 3. MAX_MIN_OVERLAP         — Maximum/minimum persons (non-overlapping vs overlapping) & exact midpoint
 * 4. COMPARISON_RANKING      — Unique 6-person height/weight/marks ranking + numeric anchor
 * 5. RATIO_CONDITIONAL_RANK  — Ratio-based boys/girls class ranking (ahead & behind)
 */

import {
  countValidRankings,
  solveInterchange,
  solveMaxMinOverlap,
  solveMidpointInRow,
  solveOppositeRank,
  solveRatioClassRanking,
  solveTotalFromRanks,
} from "./solver.js";

export const ORDER_RANKING_SUBTOPICS = {
  TOTAL_AND_RANK: "Single-Row Total & Rank Conversion",
  INTERCHANGE_POSITIONS: "Interchanging Positions",
  MAX_MIN_OVERLAP: "Max/Min Overlap & Midpoint",
  COMPARISON_RANKING: "Relative Comparison & Ranking",
  RATIO_CONDITIONAL_RANK: "Ratio & Conditional Class Ranking",
};

export function createOrderRng(seedInput) {
  let state = (Number(seedInput) || Date.now()) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  const rng = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.seed = state;
  rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return rng;
}

const NAMES = [
  "Aarav", "Priya", "Rohan", "Kavya", "Vikram", "Neha", "Arjun", "Meera",
  "Siddharth", "Ananya", "Karthik", "Divya", "Rahul", "Sneha", "Nikhil", "Pooja",
];

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function shuffleOptionsWithAnswer(correctText, distractorTexts, rng) {
  const unique = new Set([correctText]);
  const pool = [];
  for (const d of distractorTexts) {
    if (d && !unique.has(d)) {
      unique.add(d);
      pool.push(d);
    }
    if (pool.length === 4) break;
  }
  if (pool.length < 4) return null;
  const all = rng.shuffle([correctText, ...pool]);
  const correctIndex = all.indexOf(correctText);
  return {
    options: all,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
  };
}

function numericDistractors(val, rng, asOrdinal = false) {
  const deltas = [-3, -2, -1, 1, 2, 3, 4];
  const nums = rng.shuffle(deltas)
    .map((d) => val + d)
    .filter((v) => v > 0 && v !== val);
  return nums.map((v) => (asOrdinal ? ordinal(v) : String(v)));
}

/**
 * 1. Single-Row Total & Rank Conversion Builder
 */
export function buildTotalAndRankQuestion({ difficulty = "Easy", rng }) {
  const person = rng.pick(NAMES);
  const mode =
    difficulty === "Easy"
      ? rng.pick(["FIND_TOTAL", "FIND_OPPOSITE"])
      : rng.pick(["SHIFT_OPPOSITE", "FIND_TOTAL", "FIND_OPPOSITE"]);

  if (mode === "FIND_TOTAL") {
    const left = rng.int(8, 35);
    const right = rng.int(9, 38);
    const total = solveTotalFromRanks(left, right);
    const questionText =
      `In a row of students facing North, ${person} is ranked ${ordinal(left)} from the left end and ${ordinal(right)} from the right end. How many students are there in the row?`;
    const packed = shuffleOptionsWithAnswer(String(total), numericDistractors(total, rng), rng);
    if (!packed) return null;
    return {
      topic: "Order & Ranking",
      subType: "TOTAL_AND_RANK",
      subtopicName: ORDER_RANKING_SUBTOPICS.TOTAL_AND_RANK,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Total students = Left rank + Right rank − 1 = ${left} + ${right} − 1 = ${total}.`,
      _meta: { subType: "TOTAL_AND_RANK", mode, left, right },
    };
  }

  if (mode === "FIND_OPPOSITE") {
    const total = rng.int(32, 75);
    const top = rng.int(7, total - 6);
    const bottom = solveOppositeRank(total, top);
    const questionText =
      `In a class of ${total} students, ${person} secured the ${ordinal(top)} rank from the top. What is ${person}'s rank from the bottom?`;
    const packed = shuffleOptionsWithAnswer(ordinal(bottom), numericDistractors(bottom, rng, true), rng);
    if (!packed) return null;
    return {
      topic: "Order & Ranking",
      subType: "TOTAL_AND_RANK",
      subtopicName: ORDER_RANKING_SUBTOPICS.TOTAL_AND_RANK,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Rank from bottom = Total − Rank from top + 1 = ${total} − ${top} + 1 = ${ordinal(bottom)}.`,
      _meta: { subType: "TOTAL_AND_RANK", mode, total, top },
    };
  }

  // SHIFT_OPPOSITE (Medium/Hard)
  const total = rng.int(35, 65);
  const origLeft = rng.int(12, total - 12);
  const shift = rng.int(3, 7);
  const shiftDir = rng() < 0.5 ? "RIGHT" : "LEFT";
  const newLeft = shiftDir === "RIGHT" ? origLeft + shift : origLeft - shift;
  const newRight = solveOppositeRank(total, newLeft);

  const questionText =
    `In a row of ${total} persons facing North, ${person} was ${ordinal(origLeft)} from the left end. When ${person} was shifted ${shift} places to the ${shiftDir.toLowerCase()}, what became ${person}'s new position from the right end?`;
  const packed = shuffleOptionsWithAnswer(ordinal(newRight), numericDistractors(newRight, rng, true), rng);
  if (!packed) return null;

  return {
    topic: "Order & Ranking",
    subType: "TOTAL_AND_RANK",
    subtopicName: ORDER_RANKING_SUBTOPICS.TOTAL_AND_RANK,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `After shifting ${shift} places to the ${shiftDir.toLowerCase()}, ${person}'s new position from the left = ${origLeft} ${shiftDir === "RIGHT" ? "+" : "−"} ${shift} = ${ordinal(newLeft)}. New position from the right = ${total} − ${newLeft} + 1 = ${ordinal(newRight)}.`,
    _meta: { subType: "TOTAL_AND_RANK", mode, total, origLeft, shift, shiftDir },
  };
}

/**
 * 2. Interchanging Positions Builder
 */
export function buildInterchangeQuestion({ difficulty = "Medium", rng }) {
  const [p1, p2] = rng.shuffle(NAMES).slice(0, 2);
  const leftA = rng.int(9, 22);
  const rightB = rng.int(10, 24);
  const overlap = difficulty !== "Easy" && rng() < 0.4;

  const newLeftA = overlap
    ? rng.int(Math.max(3, leftA - 6), leftA - 2)
    : rng.int(leftA + 3, leftA + 12);

  let solved;
  try {
    solved = solveInterchange(leftA, rightB, newLeftA);
  } catch {
    return null;
  }

  const askMode =
    difficulty === "Easy"
      ? "TOTAL"
      : rng.pick(["TOTAL", "NEW_RIGHT_B", "BETWEEN"]);

  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let explanation = "";

  if (askMode === "TOTAL") {
    questionLine = `How many persons are there in the row?`;
    correctText = String(solved.total);
    distractors = numericDistractors(solved.total, rng, false);
    explanation = `After interchanging, ${p1} occupies ${p2}'s original spot (${ordinal(newLeftA)} from left and ${ordinal(rightB)} from right). Total persons = ${newLeftA} + ${rightB} − 1 = ${solved.total}.`;
  } else if (askMode === "NEW_RIGHT_B") {
    questionLine = `What will be ${p2}'s new position from the right end after the interchange?`;
    correctText = ordinal(solved.newRightB);
    distractors = numericDistractors(solved.newRightB, rng, true);
    explanation = `Total persons = ${newLeftA} + ${rightB} − 1 = ${solved.total}. After interchanging, ${p2} occupies ${p1}'s original spot (${ordinal(leftA)} from left), so ${p2}'s rank from right = ${solved.total} − ${leftA} + 1 = ${ordinal(solved.newRightB)}.`;
  } else {
    questionLine = `How many persons are sitting strictly between ${p1} and ${p2}?`;
    correctText = String(solved.between);
    distractors = numericDistractors(solved.between, rng, false);
    explanation = `Since ${p1} moved from ${ordinal(leftA)} to ${ordinal(newLeftA)} from the left, the number of persons strictly between ${p1} and ${p2} = |${newLeftA} − ${leftA}| − 1 = ${solved.between}.`;
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `In a row of persons facing North, ${p1} is ${ordinal(leftA)} from the left end and ${p2} is ${ordinal(rightB)} from the right end. If they interchange their positions, ${p1} becomes ${ordinal(newLeftA)} from the left end. ${questionLine}`;

  return {
    topic: "Order & Ranking",
    subType: "INTERCHANGE_POSITIONS",
    subtopicName: ORDER_RANKING_SUBTOPICS.INTERCHANGE_POSITIONS,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "INTERCHANGE_POSITIONS", leftA, rightB, newLeftA, askMode },
  };
}

/**
 * 3. Max/Min Overlap & Midpoint Builder
 */
export function buildMaxMinOverlapQuestion({ difficulty = "Medium", rng }) {
  const [p1, p2, p3] = rng.shuffle(NAMES).slice(0, 3);
  const useMidpoint = difficulty === "Hard" && rng() < 0.45;

  if (useMidpoint) {
    const total = rng.int(35, 65);
    const leftA = rng.int(8, Math.floor(total / 2) - 4);
    const rightB = rng.int(8, Math.floor(total / 2) - 4);
    const mid = solveMidpointInRow(total, leftA, rightB);
    if (!mid) return null;

    const askFromRight = rng() < 0.5;
    const ansNum = askFromRight ? mid.midFromRight : mid.midFromLeft;
    const endLabel = askFromRight ? "right" : "left";

    const questionText =
      `In a row of ${total} students facing North, ${p1} is ${ordinal(leftA)} from the left end and ${p2} is ${ordinal(rightB)} from the right end. If ${p3} sits exactly midway between ${p1} and ${p2}, what is ${p3}'s position from the ${endLabel} end?`;

    const packed = shuffleOptionsWithAnswer(ordinal(ansNum), numericDistractors(ansNum, rng, true), rng);
    if (!packed) return null;

    const explanation =
      `${p2}'s position from left = ${total} − ${rightB} + 1 = ${ordinal(mid.leftB)}. ` +
      `Midpoint ${p3}'s position from left = (${leftA} + ${mid.leftB}) / 2 = ${ordinal(mid.midFromLeft)}` +
      (askFromRight ? `, and from right = ${total} − ${mid.midFromLeft} + 1 = ${ordinal(mid.midFromRight)}.` : ".");

    return {
      topic: "Order & Ranking",
      subType: "MAX_MIN_OVERLAP",
      subtopicName: ORDER_RANKING_SUBTOPICS.MAX_MIN_OVERLAP,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "MAX_MIN_OVERLAP", mode: "MIDPOINT", total, leftA, rightB, askFromRight },
    };
  }

  // Max or Min total with M persons between A and B
  const leftA = rng.int(12, 26);
  const rightB = rng.int(12, 26);
  const maxAllowedBetween = Math.min(leftA, rightB) - 3;
  if (maxAllowedBetween < 2) return null;
  const between = rng.int(2, Math.min(8, maxAllowedBetween));

  const solved = solveMaxMinOverlap(leftA, rightB, between);
  const askMin = difficulty !== "Easy" && rng() < 0.65;
  const ansVal = askMin ? solved.minTotal : solved.maxTotal;
  const kindWord = askMin ? "minimum" : "maximum";

  const questionText =
    `In a row of students facing North, ${p1} is ${ordinal(leftA)} from the left end and ${p2} is ${ordinal(rightB)} from the right end. If there are ${between} students sitting between ${p1} and ${p2}, what is the ${kindWord} possible number of students in the row?`;

  const distractors = [
    String(askMin ? solved.maxTotal : solved.minTotal),
    ...numericDistractors(ansVal, rng, false),
  ];
  const packed = shuffleOptionsWithAnswer(String(ansVal), distractors, rng);
  if (!packed) return null;

  const explanation = askMin
    ? `For the minimum total (overlapping case, valid since ${between} ≤ min(${leftA}, ${rightB}) − 2): Minimum = ${leftA} + ${rightB} − ${between} − 2 = ${ansVal}.`
    : `For the maximum total (non-overlapping case): Maximum = ${leftA} + ${rightB} + ${between} = ${ansVal}.`;

  return {
    topic: "Order & Ranking",
    subType: "MAX_MIN_OVERLAP",
    subtopicName: ORDER_RANKING_SUBTOPICS.MAX_MIN_OVERLAP,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "MAX_MIN_OVERLAP", mode: askMin ? "MIN" : "MAX", leftA, rightB, between },
  };
}

/**
 * 4. Multi-Person Relative Comparison & Numeric Anchor Builder
 */
export function buildComparisonRankingQuestion({ difficulty = "Medium", rng }) {
  const items = ["A", "B", "C", "D", "E", "F"];
  const trueOrder = rng.shuffle(items); // index 0 = highest/tallest, index 5 = lowest/shortest
  const [p0, p1, p2, p3, p4, p5] = trueOrder;

  const metric = rng.pick([
    { noun: "heights", high: "taller", low: "shorter", superHigh: "tallest", superLow: "shortest", unit: "cm", base: 155, step: 4 },
    { noun: "weights", high: "heavier", low: "lighter", superHigh: "heaviest", superLow: "lightest", unit: "kg", base: 52, step: 5 },
    { noun: "marks", high: "more marks than", low: "fewer marks than", superHigh: "highest marks", superLow: "lowest marks", unit: "marks", base: 62, step: 6 },
  ]);

  const isMarks = metric.noun === "marks";
  const cmpHigh = (a, b) => (isMarks ? `${a} scored more marks than ${b}` : `${a} is ${metric.high} than ${b}`);

  // Structured banking clues that uniquely determine trueOrder = [p0, p1, p2, p3, p4, p5]:
  // 1. p2 has exact pos 2 ("Only two persons are taller than p2")
  // 2. p0 > p1 > p2  -> fixes p0=0, p1=1
  // 3. p2 > p3 > p4 > p5 expressed naturally as banking clues:
  //    - p3 is taller than p4 but shorter than p2
  //    - p4 is taller than p5
  //    - p5 is the shortest (or p4 is not the shortest & p3 > p4 & p4 > p5)
  const constraints = [
    { type: "FIXED_POS", a: p2, pos: 2 },
    { type: "GT", a: p0, b: p1 },
    { type: "GT", a: p1, b: p2 },
    { type: "GT", a: p2, b: p3 },
    { type: "GT", a: p3, b: p4 },
    { type: "GT", a: p4, b: p5 },
  ];

  // Verify uniqueness via exact backtracking solver
  const sols = countValidRankings(items, constraints, 2);
  if (sols.length !== 1) return null;

  const clueSentences = rng.shuffle([
    isMarks
      ? `Only two persons scored more marks than ${p2}.`
      : `Only two persons are ${metric.high} than ${p2}.`,
    `${cmpHigh(p0, p1)}, who ${isMarks ? `scored more marks than ${p2}` : `is ${metric.high} than ${p2}`}.`,
    isMarks
      ? `${p3} scored fewer marks than ${p2} but more marks than ${p4}.`
      : `${p3} is ${metric.low} than ${p2} but ${metric.high} than ${p4}.`,
    `${cmpHigh(p4, p5)}.`,
  ]);

  const askNumeric = difficulty === "Hard" && rng() < 0.55;
  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let queryMeta = {};

  if (askNumeric) {
    // Anchor p1 (2nd highest) and p4 (5th highest), ask possible value of p3 (4th highest)
    const valHigh = metric.base + 4 * metric.step;
    const valLow = metric.base + 1 * metric.step;
    const validMid = valLow + Math.floor((valHigh - valLow) / 2);
    questionLine =
      `If the ${isMarks ? "second highest scorer got" : `second ${metric.superHigh} person has`} ${valHigh} ${metric.unit} ` +
      `and the ${isMarks ? "second lowest scorer got" : `second ${metric.superLow} person has`} ${valLow} ${metric.unit}, ` +
      `what could be the possible value for ${p3}?`;
    correctText = `${validMid} ${metric.unit}`;
    distractors = [
      `${valHigh + 4} ${metric.unit}`,
      `${valHigh + 1} ${metric.unit}`,
      `${valLow - 2} ${metric.unit}`,
      `${valLow - 5} ${metric.unit}`,
    ];
    queryMeta = { mode: "NUMERIC_ANCHOR", target: p3, valLow, valHigh, validMid };
  } else {
    const targetPos = rng.pick([0, 1, 3, 4, 5]);
    const posLabels = isMarks
      ? ["the highest marks", "the second highest marks", "the third highest marks", "the fourth highest marks", "the second lowest marks", "the lowest marks"]
      : [`the ${metric.superHigh}`, `the second ${metric.superHigh}`, `the third ${metric.superHigh}`, `the fourth ${metric.superHigh}`, `the second ${metric.superLow}`, `the ${metric.superLow}`];
    questionLine = isMarks
      ? `Who among the following scored ${posLabels[targetPos]}?`
      : `Who among the following is ${posLabels[targetPos]}?`;
    correctText = trueOrder[targetPos];
    distractors = rng.shuffle(items.filter((x) => x !== correctText)).slice(0, 4);
    queryMeta = { mode: "POSITION", targetPos };
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Six persons A, B, C, D, E, and F have different ${metric.noun}.\n` +
    `${clueSentences.join(" ")}\n\n${questionLine}`;

  const explanation =
    `Arranging in descending order gives: ${trueOrder.join(" > ")}. ` +
    (queryMeta.mode === "NUMERIC_ANCHOR"
      ? `Since ${p1} = ${queryMeta.valHigh} ${metric.unit} and ${p4} = ${queryMeta.valLow} ${metric.unit}, ${p3} must lie strictly between ${queryMeta.valLow} and ${queryMeta.valHigh} ${metric.unit}, making ${correctText} the only valid choice.`
      : `From this order, the answer is ${correctText}.`);

  return {
    topic: "Order & Ranking",
    subType: "COMPARISON_RANKING",
    subtopicName: ORDER_RANKING_SUBTOPICS.COMPARISON_RANKING,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "COMPARISON_RANKING",
      items,
      constraints,
      queryMeta,
    },
  };
}

/**
 * 5. Ratio & Conditional Class Ranking Builder (PO Prelims/Mains)
 */
export function buildRatioClassRankingQuestion({ difficulty = "Hard", rng }) {
  const boyName = rng.pick(["Aarav", "Rohan", "Vikram", "Arjun", "Karthik", "Nikhil"]);
  const ratios = [
    { g: 2, b: 1, phrase: "the number of girls is twice that of boys" },
    { g: 3, b: 2, phrase: "the ratio of girls to boys is 3 : 2" },
    { g: 1, b: 2, phrase: "the number of boys is twice that of girls" },
  ];
  const r = rng.pick(ratios);
  const mult = rng.int(10, 20);
  const totalStudents = (r.g + r.b) * mult;
  const totalGirls = r.g * mult;
  const totalBoys = r.b * mult;

  const targetRankFromTop = rng.int(12, Math.min(35, totalStudents - 15));
  const totalAhead = targetRankFromTop - 1;
  const minGirlsAhead = Math.max(2, totalAhead - (totalBoys - 3));
  const maxGirlsAhead = Math.min(totalAhead - 2, totalGirls - 3);
  if (minGirlsAhead > maxGirlsAhead) return null;

  const girlsAhead = rng.int(minGirlsAhead, maxGirlsAhead);
  const solved = solveRatioClassRanking({
    totalStudents,
    girlsRatio: r.g,
    boysRatio: r.b,
    targetRankFromTop,
    targetGender: "BOY",
    girlsAhead,
  });

  const askGirlsAfter = difficulty === "Hard" && rng() < 0.4;
  const ansVal = askGirlsAfter ? solved.girlsAfter : solved.boysAfter;
  const targetGroup = askGirlsAfter ? "girls" : "boys";

  const questionText =
    `In a class of ${totalStudents} students, where ${r.phrase}, ${boyName} (a boy) ranked ${ordinal(targetRankFromTop)} from the top. ` +
    `If there are ${girlsAhead} girls ahead of ${boyName}, how many ${targetGroup} are ranked after him?`;

  const packed = shuffleOptionsWithAnswer(String(ansVal), numericDistractors(ansVal, rng, false), rng);
  if (!packed) return null;

  const explanation =
    `Total girls = ${solved.totalGirls} and total boys = ${solved.totalBoys}. ` +
    `Students ahead of ${boyName} = ${totalAhead}, of which ${girlsAhead} are girls and ${solved.boysAhead} are boys. ` +
    `Hence boys after ${boyName} = ${solved.totalBoys} − ${solved.boysAhead} − 1 = ${solved.boysAfter}, and girls after ${boyName} = ${solved.totalGirls} − ${girlsAhead} = ${solved.girlsAfter}.`;

  return {
    topic: "Order & Ranking",
    subType: "RATIO_CONDITIONAL_RANK",
    subtopicName: ORDER_RANKING_SUBTOPICS.RATIO_CONDITIONAL_RANK,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "RATIO_CONDITIONAL_RANK",
      params: {
        totalStudents,
        girlsRatio: r.g,
        boysRatio: r.b,
        targetRankFromTop,
        targetGender: "BOY",
        girlsAhead,
      },
      askGirlsAfter,
    },
  };
}
