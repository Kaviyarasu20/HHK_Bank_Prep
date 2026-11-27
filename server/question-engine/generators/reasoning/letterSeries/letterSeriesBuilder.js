/**
 * Modular Banking Exam Letter Series Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. SINGLE_LETTER_SERIES     — Constant, progressive, prime-gap, and dual-alternating letter series
 * 2. LETTER_CLUSTER_SERIES    — 3-letter cluster missing-term progression
 * 3. CONTINUOUS_PATTERN_FILL  — Repeating / cyclic letter-block fill-in-the-blanks
 * 4. WRONG_LETTER_CLUSTER     — Identify the single wrong 3-letter cluster in a series
 * 5. ALPHABET_PAIR_AND_HALF   — Alphabetical letter-pair count & reversed-half alphabet position
 */

import {
  buildHalfReversedAlphabet,
  charToNum,
  extractFillChars,
  findAlphabeticalPairs,
  generateClusterSequence,
  generateSingleLetterSequence,
  shiftChar,
} from "./solver.js";

export const LETTER_SERIES_SUBTOPICS = {
  SINGLE_LETTER_SERIES: "Single-Letter Progressive & Alternating Series",
  LETTER_CLUSTER_SERIES: "Letter-Cluster Triplet Series",
  CONTINUOUS_PATTERN_FILL: "Continuous Repeating Pattern Fill",
  WRONG_LETTER_CLUSTER: "Wrong Term in Letter-Cluster Series",
  ALPHABET_PAIR_AND_HALF: "Alphabetical Pair Count & Reverse-Half Position",
};

export function createLetterRng(seedInput) {
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

const PAIR_WORDS = [
  "BANKING", "CREDITS", "DIGITAL", "RESERVE", "ECONOMY", "FINANCE", "ACCOUNT",
  "BALANCE", "DEPOSIT", "CAPITAL", "GENERAL", "PAYMENT", "NETWORK", "HISTORY",
  "PRODUCT", "CENTRAL", "MONTHLY", "JOURNAL", "VENTURE", "PENSION", "FORTUNE",
  "PROBLEM", "SECTION", "QUALITY", "PROJECT", "STUDENT", "CURRENT", "DYNAMIC",
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
  const unique = new Set([String(correctText)]);
  const pool = [];
  for (const d of distractorTexts) {
    if (d !== null && d !== undefined && d !== "" && !unique.has(String(d))) {
      unique.add(String(d));
      pool.push(String(d));
    }
    if (pool.length === 4) break;
  }
  if (pool.length < 4) return null;
  const all = rng.shuffle([String(correctText), ...pool]);
  const correctIndex = all.indexOf(String(correctText));
  return {
    options: all,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
  };
}

/**
 * 1. Single-Letter Progressive & Alternating Series Builder
 */
export function buildSingleLetterSeriesQuestion({ difficulty = "Easy", rng }) {
  let rule;
  let length = 6;
  let ruleDesc = "";

  if (difficulty === "Easy") {
    const diff = rng.pick([2, 3, 4, -2, -3]);
    const start = diff > 0 ? rng.int(1, 26 - 5 * diff) : rng.int(1 - 5 * diff, 26);
    rule = { type: "CONSTANT_DIFF", start, diff };
    ruleDesc = `constant shift of ${diff > 0 ? `+${diff}` : diff} at each step`;
  } else if (difficulty === "Medium") {
    if (rng() < 0.55) {
      const d0 = rng.pick([1, 2]);
      const start = rng.int(1, 6);
      rule = { type: "PROGRESSIVE_DIFF", start, d0, step: 1 };
      ruleDesc = `increasing gap (+${d0}, +${d0 + 1}, +${d0 + 2}, +${d0 + 3}, +${d0 + 4})`;
    } else {
      const startA = rng.int(1, 8);
      const diffA = rng.pick([2, 3]);
      const startB = rng.int(18, 26);
      const diffB = rng.pick([-2, -3]);
      length = 7;
      rule = { type: "DUAL_ALTERNATING", startA, diffA, startB, diffB };
      ruleDesc = `two interleaved series: odd positions shift by +${diffA}, even positions shift by ${diffB}`;
    }
  } else {
    // Hard: Prime differences or dual alternating
    if (rng() < 0.5) {
      const start = rng.int(1, 10);
      rule = { type: "PRIME_DIFF", start };
      ruleDesc = `prime-number increments (+2, +3, +5, +7, +11, wrapping around A–Z)`;
    } else {
      const startA = rng.int(2, 10);
      const diffA = rng.pick([3, 4]);
      const startB = rng.int(20, 26);
      const diffB = rng.pick([-3, -4]);
      length = 7;
      rule = { type: "DUAL_ALTERNATING", startA, diffA, startB, diffB };
      ruleDesc = `two interleaved series: odd positions shift by +${diffA}, even positions shift by ${diffB}`;
    }
  }

  const seq = generateSingleLetterSequence(rule, length);
  const shown = seq.slice(0, length - 1);
  const answer = seq[length - 1];
  const distractors = [-2, -1, 1, 2, 3].map((d) => shiftChar(answer, d));

  const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
  if (!packed) return null;

  const questionText =
    `What will come in place of the question mark (?) in the following letter series?\n` +
    `${shown.join(", ")}, ?`;

  const explanation = `The series follows a ${ruleDesc}. Applying the pattern to the sequence gives '${answer}'.`;

  return {
    topic: "Letter Series",
    subType: "SINGLE_LETTER_SERIES",
    subtopicName: LETTER_SERIES_SUBTOPICS.SINGLE_LETTER_SERIES,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "SINGLE_LETTER_SERIES", rule, length },
  };
}

/**
 * 2. Letter-Cluster Triplet Series Builder
 */
export function buildLetterClusterSeriesQuestion({ difficulty = "Medium", rng }) {
  const diffPool =
    difficulty === "Easy"
      ? [1, 2, 3]
      : difficulty === "Medium"
        ? [-3, -2, -1, 2, 3, 4]
        : [-4, -3, -2, 2, 3, 4, 5];

  const diffs = [rng.pick(diffPool), rng.pick(diffPool), rng.pick(diffPool)];
  const starts = [rng.int(1, 26), rng.int(1, 26), rng.int(1, 26)];
  const length = 5;
  const seq = generateClusterSequence(starts, diffs, length);

  const shown = seq.slice(0, 4);
  const answer = seq[4];

  const mutate = (str, col, d) => {
    const a = [...str];
    a[col] = shiftChar(a[col], d);
    return a.join("");
  };
  const distractors = [
    mutate(answer, 0, 1),
    mutate(answer, 1, -1),
    mutate(answer, 2, 1),
    mutate(mutate(answer, 0, -1), 2, 1),
    mutate(answer, 1, 2),
  ];

  const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
  if (!packed) return null;

  const fmtD = (d) => (d > 0 ? `+${d}` : String(d));
  const questionText =
    `Select the letter-cluster that can replace the question mark (?) in the following series:\n` +
    `${shown.join(", ")}, ?`;

  const explanation =
    `Column-wise shifts across consecutive terms: 1st letter ${fmtD(diffs[0])}, 2nd letter ${fmtD(diffs[1])}, 3rd letter ${fmtD(diffs[2])} (mod 26). ` +
    `Applying these shifts to '${shown[3]}' gives '${answer}'.`;

  return {
    topic: "Letter Series",
    subType: "LETTER_CLUSTER_SERIES",
    subtopicName: LETTER_SERIES_SUBTOPICS.LETTER_CLUSTER_SERIES,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "LETTER_CLUSTER_SERIES", starts, diffs, length },
  };
}

/**
 * 3. Continuous Repeating / Cyclic Block Pattern Fill Builder
 */
export function buildContinuousPatternQuestion({ difficulty = "Medium", rng }) {
  const alphaSets = [
    ["a", "b", "c", "d"],
    ["p", "q", "r", "s"],
    ["m", "n", "o", "p"],
    ["x", "y", "z", "w"],
  ];
  const letters = rng.shuffle(rng.pick(alphaSets));
  let fullStr = "";
  let patternDesc = "";

  if (difficulty === "Easy") {
    const block = letters.slice(0, 4).join("");
    fullStr = block.repeat(4); // 16 chars
    patternDesc = `repeating 4-letter block '${block}' (${block} / ${block} / ${block} / ${block})`;
  } else if (difficulty === "Medium") {
    // 5-letter block repeated 3 times = 15 chars, e.g. a b c b a
    const block = `${letters[0]}${letters[1]}${letters[2]}${letters[1]}${letters[0]}`;
    fullStr = block.repeat(3);
    patternDesc = `repeating 5-letter palindromic block '${block}'`;
  } else {
    // Cyclic 4-letter rotation x 4 = 16 chars
    const b0 = letters.join("");
    const b1 = b0.slice(1) + b0[0];
    const b2 = b1.slice(1) + b1[0];
    const b3 = b2.slice(1) + b2[0];
    fullStr = b0 + b1 + b2 + b3;
    patternDesc = `cyclic 1-step left rotation of 4-letter blocks (${b0} / ${b1} / ${b2} / ${b3})`;
  }

  // Pick 4 or 5 blank positions spread across the blocks (ensuring every letter in the block appears visibly)
  const numBlanks = difficulty === "Easy" ? 4 : 5;
  const step = Math.floor(fullStr.length / numBlanks);
  const blankIndices = [];
  for (let i = 0; i < numBlanks; i++) {
    const pos = Math.min(fullStr.length - 1, i * step + rng.int(0, Math.max(0, step - 1)));
    if (!blankIndices.includes(pos)) blankIndices.push(pos);
  }
  blankIndices.sort((a, b) => a - b);
  if (blankIndices.length !== numBlanks) return null;

  const template = [...fullStr].map((ch, idx) => (blankIndices.includes(idx) ? "_" : ch)).join("");
  const answer = extractFillChars(fullStr, blankIndices);

  // Build close distractors by changing 1 or 2 characters of answer to other letters from the same set
  const distractors = [];
  for (let tries = 0; tries < 30 && distractors.length < 4; tries++) {
    const arr = [...answer];
    const idx1 = rng.int(0, arr.length - 1);
    const other = rng.pick(letters.filter((c) => c !== arr[idx1]));
    arr[idx1] = other;
    if (tries % 2 === 1 && arr.length > 2) {
      const idx2 = (idx1 + 1) % arr.length;
      arr[idx2] = rng.pick(letters.filter((c) => c !== arr[idx2]));
    }
    const cand = arr.join("");
    if (cand !== answer && !distractors.includes(cand)) distractors.push(cand);
  }

  const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Which one set of letters, when sequentially placed at the gaps in the given letter series, shall complete it?\n` +
    `${template.split("").join(" ")}`;

  const explanation =
    `The completed series follows a ${patternDesc}: ${fullStr}. Filling the blanks in order yields '${answer}'.`;

  return {
    topic: "Letter Series",
    subType: "CONTINUOUS_PATTERN_FILL",
    subtopicName: LETTER_SERIES_SUBTOPICS.CONTINUOUS_PATTERN_FILL,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "CONTINUOUS_PATTERN_FILL", fullStr, blankIndices, template },
  };
}

/**
 * 4. Wrong Term in Letter-Cluster Series Builder
 */
export function buildWrongLetterClusterQuestion({ difficulty = "Medium", rng }) {
  const diffPool = difficulty === "Hard" ? [-4, -3, -2, 2, 3, 4] : [-2, 2, 3];
  const diffs = [rng.pick(diffPool), rng.pick(diffPool), rng.pick(diffPool)];
  const starts = [rng.int(1, 26), rng.int(1, 26), rng.int(1, 26)];
  const correctSeq = generateClusterSequence(starts, diffs, 5);

  // Corrupt exactly one term (index 1..4) by shifting one letter by ±1 or ±2
  const wrongIdx = rng.int(1, 4);
  const corruptCol = rng.int(0, 2);
  const corruptDelta = rng.pick([-2, -1, 1, 2]);
  const arr = [...correctSeq[wrongIdx]];
  arr[corruptCol] = shiftChar(arr[corruptCol], corruptDelta);
  const wrongTerm = arr.join("");

  const displaySeq = [...correctSeq];
  displaySeq[wrongIdx] = wrongTerm;

  const packed = shuffleOptionsWithAnswer(
    wrongTerm,
    displaySeq.filter((_, i) => i !== wrongIdx),
    rng,
  );
  if (!packed) return null;

  const fmtD = (d) => (d > 0 ? `+${d}` : String(d));
  const questionText =
    `Find the wrong term in the following letter-cluster series:\n` +
    `${displaySeq.join(", ")}`;

  const explanation =
    `Each term advances column-wise by (${fmtD(diffs[0])}, ${fmtD(diffs[1])}, ${fmtD(diffs[2])}). ` +
    `Thus, the ${ordinal(wrongIdx + 1)} term should be '${correctSeq[wrongIdx]}' instead of '${wrongTerm}'.`;

  return {
    topic: "Letter Series",
    subType: "WRONG_LETTER_CLUSTER",
    subtopicName: LETTER_SERIES_SUBTOPICS.WRONG_LETTER_CLUSTER,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "WRONG_LETTER_CLUSTER", starts, diffs, wrongIdx, wrongTerm, expectedTerm: correctSeq[wrongIdx] },
  };
}

/**
 * 5. Alphabetical Pair Count & Reverse-Half Position Builder
 */
export function buildAlphabetPairAndHalfQuestion({ difficulty = "Medium", rng }) {
  const usePairCount = rng() < 0.6;

  if (usePairCount) {
    const word = rng.pick(PAIR_WORDS);
    const pairs = findAlphabeticalPairs(word);
    const count = pairs.length;
    if (count > 5) return null;

    const labels = ["None", "One", "Two", "Three", "Four", "More than four"];
    const correctText = count >= 5 ? "More than four" : labels[count];
    const distractors = labels.filter((l) => l !== correctText).slice(0, 4);

    const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
    if (!packed) return null;

    const questionText =
      `How many pairs of letters are there in the word '${word}', each of which has as many letters between them in the word (in both forward and backward directions) as they have between them in the English alphabetical series?`;

    const pairList =
      pairs.length === 0
        ? "No such pairs exist."
        : `Valid pair(s): ${pairs.map((p) => `${p.pair} (${p.direction})`).join(", ")}.`;

    const explanation =
      `Checking all index distances |pos(L₂) − pos(L₁)| = (j − i) for '${word}': ${pairList} Total = ${count} (${correctText}).`;

    return {
      topic: "Letter Series",
      subType: "ALPHABET_PAIR_AND_HALF",
      subtopicName: LETTER_SERIES_SUBTOPICS.ALPHABET_PAIR_AND_HALF,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "ALPHABET_PAIR_AND_HALF", mode: "PAIR_COUNT", word },
    };
  }

  // Reversed-Half English Alphabet Positional Lookup
  const reverseMode =
    difficulty === "Easy"
      ? "FIRST_HALF"
      : difficulty === "Medium"
        ? "SECOND_HALF"
        : "BOTH_HALVES";
  const alpha = buildHalfReversedAlphabet(reverseMode);

  const bFromLeft = rng.int(10, 20);
  const aLeft = rng.int(3, 8);
  const targetOneIdx = bFromLeft - aLeft;
  const answer = alpha[targetOneIdx - 1];

  const nearby = [
    alpha[targetOneIdx - 2],
    alpha[targetOneIdx],
    alpha[targetOneIdx - 3],
    alpha[targetOneIdx + 1],
    ...rng.shuffle(alpha),
  ].filter((c) => c && c !== answer);

  const packed = shuffleOptionsWithAnswer(answer, nearby, rng);
  if (!packed) return null;

  const modePhrase =
    reverseMode === "FIRST_HALF"
      ? "the first half (A to M) of the English alphabet is written in reverse order"
      : reverseMode === "SECOND_HALF"
        ? "the second half (N to Z) of the English alphabet is written in reverse order"
        : "both the first half (A to M) and the second half (N to Z) of the English alphabet are written in reverse order";

  const questionText =
    `If ${modePhrase}, which letter will be ${ordinal(aLeft)} to the left of the ${ordinal(bFromLeft)} letter from the left end?`;

  const explanation =
    `Modified alphabet: ${alpha.join("")}. ${ordinal(aLeft)} to the left of ${ordinal(bFromLeft)} from the left = (${bFromLeft} − ${aLeft}) = ${ordinal(targetOneIdx)} letter from the left, which is '${answer}'.`;

  return {
    topic: "Letter Series",
    subType: "ALPHABET_PAIR_AND_HALF",
    subtopicName: LETTER_SERIES_SUBTOPICS.ALPHABET_PAIR_AND_HALF,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "ALPHABET_PAIR_AND_HALF", mode: "HALF_REVERSE", reverseMode, bFromLeft, aLeft },
  };
}
