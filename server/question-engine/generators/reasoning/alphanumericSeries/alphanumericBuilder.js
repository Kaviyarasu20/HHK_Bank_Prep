/**
 * Modular Banking Exam Alphanumeric Series Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. SNL_PRECEDED_FOLLOWED  — Symbol–Number–Letter preceded/followed counts & drop-category queries
 * 2. SNL_POSITIONAL_NAV     — Left-of-left, right-of-left, left-of-right & exact midway element
 * 3. THREE_DIGIT_NUMBER_OPS — 5 × 3-digit number set operations (swap, sort, digit arithmetic, difference)
 * 4. THREE_LETTER_WORD_OPS  — 5 × 3-letter word set operations (vowel/consonant shift, dictionary order, gap)
 * 5. STEP_ALPHANUMERIC_MAINS — PO Mains multi-step conditional alphanumeric string transformations
 */

import {
  alphabeticalGapBetween,
  applyMainsSteps,
  countPrecededFollowed,
  solveDropAndFind,
  solvePositionalNav,
  transformThreeDigitNumber,
  transformWordVowelConsonant,
} from "./solver.js";

export const ALPHANUMERIC_SUBTOPICS = {
  SNL_PRECEDED_FOLLOWED: "Symbol–Number–Letter Pattern Count & Drop",
  SNL_POSITIONAL_NAV: "Positional Navigation & Midway",
  THREE_DIGIT_NUMBER_OPS: "3-Digit Number Set Operations",
  THREE_LETTER_WORD_OPS: "3-Letter Word Set Operations",
  STEP_ALPHANUMERIC_MAINS: "Step-Based Alphanumeric Transformation (Mains)",
};

export function createAlphaRng(seedInput) {
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

const VOWELS = ["A", "E", "I", "O", "U"];
const CONSONANTS = ["B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z"];
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const SYMBOLS = ["@", "#", "$", "%", "&", "*", "!", "?", "+", "="];

const THREE_LETTER_WORDS = [
  "CAT", "PEN", "BOX", "DIG", "RUN", "MAP", "CUP", "FAN", "HAT", "JUG",
  "KIT", "LOG", "NET", "POT", "RAT", "SUN", "TOP", "VAN", "WEB", "ZIP",
  "BAT", "DEN", "FIG", "GEM", "HOP", "INK", "JAM", "KEY", "LIP", "MUD",
  "NOD", "OWL", "PIG", "RED", "SIP", "TAG", "URN", "VET", "WAX", "YAM",
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
 * Build a 25-element unique-token mixed alphanumeric sequence (8 consonants, 3 vowels, 7 digits, 7 symbols).
 */
function buildUniqueSequence(rng, length = 25) {
  const c = rng.shuffle(CONSONANTS).slice(0, 8);
  const v = rng.shuffle(VOWELS).slice(0, 3);
  const d = rng.shuffle(DIGITS).slice(0, 7);
  const s = rng.shuffle(SYMBOLS).slice(0, 7);
  return rng.shuffle([...c, ...v, ...d, ...s]).slice(0, length);
}

const CAT_LABELS = {
  SYMBOL: "a symbol",
  NUMBER: "a number",
  LETTER: "a letter",
  CONSONANT: "a consonant",
  VOWEL: "a vowel",
  EVEN_NUMBER: "an even number",
  ODD_NUMBER: "an odd number",
};

const CAT_PLURALS = {
  SYMBOL: "symbols",
  NUMBER: "numbers",
  LETTER: "letters",
  CONSONANT: "consonants",
  VOWEL: "vowels",
};

/**
 * 1. Symbol-Number-Letter Preceded/Followed Count & Drop-Category Builder
 */
export function buildPrecededFollowedQuestion({ difficulty = "Easy", rng }) {
  const seq = buildUniqueSequence(rng, difficulty === "Easy" ? 23 : 25);
  const useDrop = difficulty !== "Easy" && rng() < 0.45;

  if (useDrop) {
    const dropCat = rng.pick(["SYMBOL", "NUMBER", "VOWEL"]);
    const fromEnd = rng.pick(["LEFT", "RIGHT"]);
    const pos = rng.int(5, 11);
    const res = solveDropAndFind(seq, dropCat, pos, fromEnd);
    if (!res) return null;

    const correctText = res.element;
    const distractors = rng.shuffle(res.filtered.filter((x) => x !== correctText)).slice(0, 4);
    const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Study the following arrangement carefully and answer the question given below.\n` +
      `${seq.join("  ")}\n\n` +
      `If all the ${CAT_PLURALS[dropCat]} are dropped from the above arrangement, which of the following will be the ${ordinal(pos)} element from the ${fromEnd.toLowerCase()} end?`;

    const explanation =
      `After dropping all ${CAT_PLURALS[dropCat]}, the remaining sequence is: ${res.filtered.join(" ")}. ` +
      `Counting ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end gives '${correctText}'.`;

    return {
      topic: "Alphanumeric Series",
      subType: "SNL_PRECEDED_FOLLOWED",
      subtopicName: ALPHANUMERIC_SUBTOPICS.SNL_PRECEDED_FOLLOWED,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "SNL_PRECEDED_FOLLOWED", mode: "DROP", seq, dropCat, pos, fromEnd },
    };
  }

  // Preceded / Followed count
  const templates = [
    { prev: "NUMBER", target: "SYMBOL", next: "LETTER" },
    { prev: "LETTER", target: "NUMBER", next: "SYMBOL" },
    { prev: "SYMBOL", target: "CONSONANT", next: "NUMBER" },
    { prev: "CONSONANT", target: "NUMBER", next: "LETTER" },
    { prev: "SYMBOL", target: "NUMBER", next: "CONSONANT" },
  ];
  const tpl = rng.pick(templates);
  const matches = countPrecededFollowed(seq, tpl.prev, tpl.target, tpl.next);
  if (matches.length > 4) return null;

  const countLabels = ["None", "One", "Two", "Three", "Four"];
  const correctText = countLabels[matches.length];
  const distractors = countLabels.filter((x) => x !== correctText);
  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Study the following arrangement carefully and answer the question given below.\n` +
    `${seq.join("  ")}\n\n` +
    `How many such ${CAT_PLURALS[tpl.target]} are there in the above arrangement, each of which is immediately preceded by ${CAT_LABELS[tpl.prev]} and immediately followed by ${CAT_LABELS[tpl.next]}?`;

  const matchStr =
    matches.length === 0
      ? "No such triplet exists in the sequence."
      : `Matching triplet(s): ${matches.map((m) => `(${m.triple})`).join(", ")}.`;

  const explanation = `${matchStr} Therefore, the count is ${correctText} (${matches.length}).`;

  return {
    topic: "Alphanumeric Series",
    subType: "SNL_PRECEDED_FOLLOWED",
    subtopicName: ALPHANUMERIC_SUBTOPICS.SNL_PRECEDED_FOLLOWED,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "SNL_PRECEDED_FOLLOWED", mode: "COUNT", seq, prev: tpl.prev, target: tpl.target, next: tpl.next },
  };
}

/**
 * 2. Positional Navigation & Midway Builder
 */
export function buildPositionalNavQuestion({ difficulty = "Easy", rng }) {
  const seq = buildUniqueSequence(rng, 25);
  const modes =
    difficulty === "Easy"
      ? ["LEFT_OF_LEFT", "RIGHT_OF_LEFT", "LEFT_OF_RIGHT"]
      : ["LEFT_OF_RIGHT", "RIGHT_OF_RIGHT", "MIDWAY", "LEFT_OF_LEFT"];
  const mode = rng.pick(modes);

  let a, b;
  if (mode === "LEFT_OF_LEFT") {
    b = rng.int(12, 22);
    a = rng.int(4, b - 2);
  } else if (mode === "RIGHT_OF_LEFT") {
    b = rng.int(4, 13);
    a = rng.int(4, 24 - b);
  } else if (mode === "LEFT_OF_RIGHT") {
    b = rng.int(5, 13);
    a = rng.int(4, 23 - b);
  } else if (mode === "RIGHT_OF_RIGHT") {
    b = rng.int(12, 22);
    a = rng.int(4, b - 2);
  } else {
    // MIDWAY: ensure (a + (25 - b + 1)) is even and a < posBFromLeft
    a = rng.int(3, 9);
    const possibleB = [];
    for (let candB = 3; candB <= 11; candB++) {
      const posB = 25 - candB + 1;
      if (posB > a + 2 && (a + posB) % 2 === 0) possibleB.push(candB);
    }
    if (possibleB.length === 0) return null;
    b = rng.pick(possibleB);
  }

  const solved = solvePositionalNav(seq, mode, a, b);
  if (!solved) return null;

  const correctText = solved.element;
  // Pick nearby elements as realistic off-by-1 / off-by-2 distractors
  const nearby = [
    seq[solved.oneIdx - 2],
    seq[solved.oneIdx],
    seq[solved.oneIdx - 3],
    seq[solved.oneIdx + 1],
    ...rng.shuffle(seq),
  ].filter((x) => x && x !== correctText);

  const packed = shuffleOptionsWithAnswer(correctText, nearby, rng);
  if (!packed) return null;

  let questionLine = "";
  let explanation = "";
  if (mode === "LEFT_OF_LEFT") {
    questionLine = `Which element is ${ordinal(a)} to the left of the ${ordinal(b)} element from the left end?`;
    explanation = `${ordinal(a)} to the left of ${ordinal(b)} from the left = (${b} − ${a}) = ${ordinal(solved.oneIdx)} from the left end, which is '${correctText}'.`;
  } else if (mode === "RIGHT_OF_LEFT") {
    questionLine = `Which element is ${ordinal(a)} to the right of the ${ordinal(b)} element from the left end?`;
    explanation = `${ordinal(a)} to the right of ${ordinal(b)} from the left = (${b} + ${a}) = ${ordinal(solved.oneIdx)} from the left end, which is '${correctText}'.`;
  } else if (mode === "LEFT_OF_RIGHT") {
    questionLine = `Which element is ${ordinal(a)} to the left of the ${ordinal(b)} element from the right end?`;
    explanation = `${ordinal(a)} to the left of ${ordinal(b)} from the right = (${b} + ${a}) = ${ordinal(a + b)} from the right end (${ordinal(solved.oneIdx)} from the left), which is '${correctText}'.`;
  } else if (mode === "RIGHT_OF_RIGHT") {
    questionLine = `Which element is ${ordinal(a)} to the right of the ${ordinal(b)} element from the right end?`;
    explanation = `${ordinal(a)} to the right of ${ordinal(b)} from the right = (${b} − ${a}) = ${ordinal(b - a)} from the right end (${ordinal(solved.oneIdx)} from the left), which is '${correctText}'.`;
  } else {
    questionLine = `Which element lies exactly midway between the ${ordinal(a)} element from the left end and the ${ordinal(b)} element from the right end?`;
    explanation = `The ${ordinal(b)} element from the right is the ${ordinal(25 - b + 1)} from the left. Midway position = (${a} + ${25 - b + 1}) / 2 = ${ordinal(solved.oneIdx)} from the left end, which is '${correctText}'.`;
  }

  return {
    topic: "Alphanumeric Series",
    subType: "SNL_POSITIONAL_NAV",
    subtopicName: ALPHANUMERIC_SUBTOPICS.SNL_POSITIONAL_NAV,
    difficulty,
    questionText: `Directions: Study the following arrangement carefully and answer the question given below.\n${seq.join("  ")}\n\n${questionLine}`,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "SNL_POSITIONAL_NAV", seq, mode, a, b },
  };
}

/**
 * 3. 3-Digit Number Set Operations Builder
 */
export function buildThreeDigitNumberOpsQuestion({ difficulty = "Medium", rng }) {
  // Generate 5 distinct 3-digit numbers with non-zero distinct digits
  const nums = [];
  const usedFirst = new Set();
  const usedLast = new Set();
  for (let tries = 0; tries < 60 && nums.length < 5; tries++) {
    const d1 = rng.int(2, 8);
    const d2 = rng.int(1, 9);
    const d3 = rng.int(2, 8);
    if (d1 === d2 || d2 === d3 || d1 === d3) continue;
    if (usedFirst.has(d1) || usedLast.has(d3)) continue;
    usedFirst.add(d1);
    usedLast.add(d3);
    nums.push(d1 * 100 + d2 * 10 + d3);
  }
  if (nums.length !== 5) return null;

  const op = rng.pick(
    difficulty === "Easy"
      ? ["SWAP_FIRST_THIRD", "DIGIT_DIFF_HIGH_LOW"]
      : ["SWAP_FIRST_THIRD", "SORT_DIGITS_DESC", "EVEN_PLUS_1_ODD_MINUS_1", "DIGIT_DIFF_HIGH_LOW"],
  );

  if (op === "DIGIT_DIFF_HIGH_LOW") {
    const sorted = [...nums].sort((a, b) => a - b);
    const lowest = sorted[0];
    const highest = sorted[4];
    const dHigh = Math.floor((highest % 100) / 10); // 2nd digit of highest
    const dLow = lowest % 10; // 3rd digit of lowest
    const ans = Math.abs(dHigh - dLow);
    const distractors = [ans + 1, ans + 2, ans + 3, Math.max(0, ans - 1), ans + 4].filter((v) => v !== ans);
    const packed = shuffleOptionsWithAnswer(String(ans), distractors.map(String), rng);
    if (!packed) return null;

    const questionText =
      `Directions: The following question is based on the five three-digit numbers given below:\n` +
      `${nums.join("   ")}\n\n` +
      `What is the absolute difference between the second digit of the highest number and the third digit of the lowest number?`;

    const explanation =
      `Highest number = ${highest} (second digit = ${dHigh}); lowest number = ${lowest} (third digit = ${dLow}). ` +
      `Absolute difference = |${dHigh} − ${dLow}| = ${ans}.`;

    return {
      topic: "Alphanumeric Series",
      subType: "THREE_DIGIT_NUMBER_OPS",
      subtopicName: ALPHANUMERIC_SUBTOPICS.THREE_DIGIT_NUMBER_OPS,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "THREE_DIGIT_NUMBER_OPS", op, nums },
    };
  }

  const transformed = nums.map((n) => ({ orig: n, val: transformThreeDigitNumber(n, op) }));
  // Ensure all transformed values are strictly unique
  if (new Set(transformed.map((t) => t.val)).size !== 5) return null;

  const byVal = [...transformed].sort((a, b) => b.val - a.val); // descending
  const askSecondHighest = rng() < 0.5;
  const target = askSecondHighest ? byVal[1] : byVal[3]; // 2nd highest or 2nd lowest
  const rankPhrase = askSecondHighest ? "second highest" : "second lowest";

  const opDesc =
    op === "SWAP_FIRST_THIRD"
      ? "the first and third digits of each number are interchanged"
      : op === "SORT_DIGITS_DESC"
        ? "the digits within each number are arranged in descending order from left to right"
        : "1 is added to every even digit and 1 is subtracted from every odd digit in each number";

  const correctText = String(target.orig);
  const distractors = nums.filter((n) => n !== target.orig).map(String);
  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: The following question is based on the five three-digit numbers given below:\n` +
    `${nums.join("   ")}\n\n` +
    `If ${opDesc}, which of the following original numbers will become the ${rankPhrase} number?`;

  const mappingStr = transformed.map((t) => `${t.orig} → ${t.val}`).join(", ");
  const explanation =
    `Transformed numbers: ${mappingStr}. Arranging in descending order gives ${byVal.map((t) => `${t.val} (${t.orig})`).join(" > ")}. ` +
    `Thus, the ${rankPhrase} number corresponds to original number ${correctText}.`;

  return {
    topic: "Alphanumeric Series",
    subType: "THREE_DIGIT_NUMBER_OPS",
    subtopicName: ALPHANUMERIC_SUBTOPICS.THREE_DIGIT_NUMBER_OPS,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "THREE_DIGIT_NUMBER_OPS", op, nums, askSecondHighest },
  };
}

/**
 * 4. 3-Letter Word Set Operations Builder
 */
export function buildThreeLetterWordOpsQuestion({ difficulty = "Medium", rng }) {
  const words = rng.shuffle(THREE_LETTER_WORDS).slice(0, 5);
  const mode = rng.pick(
    difficulty === "Easy"
      ? ["DICT_ORDER", "ALPHA_GAP"]
      : ["VOWEL_CONS_SHIFT_COUNT", "DICT_ORDER", "ALPHA_GAP"],
  );

  if (mode === "DICT_ORDER") {
    const sorted = [...words].sort();
    const askPos = rng.pick([1, 2, 3]); // 2nd, 3rd, or 4th from left
    const correctText = sorted[askPos];
    const distractors = words.filter((w) => w !== correctText);
    const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: The following question is based on the five three-letter words given below:\n` +
      `${words.join("   ")}\n\n` +
      `If all the words are arranged in alphabetical (dictionary) order from left to right, which word will be ${ordinal(askPos + 1)} from the left end?`;

    const explanation = `Alphabetical order: ${sorted.join(", ")}. The ${ordinal(askPos + 1)} word from the left is '${correctText}'.`;
    return {
      topic: "Alphanumeric Series",
      subType: "THREE_LETTER_WORD_OPS",
      subtopicName: ALPHANUMERIC_SUBTOPICS.THREE_LETTER_WORD_OPS,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "THREE_LETTER_WORD_OPS", mode, words, askPos },
    };
  }

  if (mode === "ALPHA_GAP") {
    const ch1 = words[1][1]; // 2nd letter of 2nd word from left
    const ch2 = words[3][2]; // 3rd letter of 2nd word from right
    const gap = alphabeticalGapBetween(ch1, ch2);
    const distractors = [gap + 1, gap + 2, gap + 3, Math.max(0, gap - 1), gap + 4].filter((v) => v !== gap);
    const packed = shuffleOptionsWithAnswer(String(gap), distractors.map(String), rng);
    if (!packed) return null;

    const questionText =
      `Directions: The following question is based on the five three-letter words given below:\n` +
      `${words.join("   ")}\n\n` +
      `How many letters are there in the English alphabetical series between the second letter of the second word from the left and the third letter of the second word from the right?`;

    const explanation =
      `Second letter of '${words[1]}' = '${ch1}'; third letter of '${words[3]}' = '${ch2}'. ` +
      `Number of letters strictly between '${ch1}' and '${ch2}' in the English alphabet = ${gap}.`;

    return {
      topic: "Alphanumeric Series",
      subType: "THREE_LETTER_WORD_OPS",
      subtopicName: ALPHANUMERIC_SUBTOPICS.THREE_LETTER_WORD_OPS,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: { subType: "THREE_LETTER_WORD_OPS", mode, words },
    };
  }

  // VOWEL_CONS_SHIFT_COUNT: vowel +1, consonant -1 => count how many words have NO vowel
  const transformed = words.map((w) => transformWordVowelConsonant(w, 1, -1));
  const withVowel = transformed.filter((w) => /[AEIOU]/.test(w)).length;
  const countLabels = ["None", "One", "Two", "Three", "Four", "Five"];
  const correctText = countLabels[withVowel];
  const distractors = countLabels.filter((x) => x !== correctText).slice(0, 4);
  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: The following question is based on the five three-letter words given below:\n` +
    `${words.join("   ")}\n\n` +
    `If in each word every vowel is changed to the next letter (+1) and every consonant is changed to the previous letter (−1) in the English alphabet, how many words thus formed will contain at least one vowel?`;

  const mapping = words.map((w, i) => `${w} → ${transformed[i]}`).join(", ");
  const explanation = `After shifting (vowel +1, consonant −1): ${mapping}. Count of words containing at least one vowel = ${withVowel} (${correctText}).`;

  return {
    topic: "Alphanumeric Series",
    subType: "THREE_LETTER_WORD_OPS",
    subtopicName: ALPHANUMERIC_SUBTOPICS.THREE_LETTER_WORD_OPS,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "THREE_LETTER_WORD_OPS", mode, words },
  };
}

/**
 * 5. PO Mains Step-Based Alphanumeric String Transformation Builder
 */
export function buildStepAlphanumericMainsQuestion({ difficulty = "Hard", rng }) {
  const seq = buildUniqueSequence(rng, 20);
  const steps =
    difficulty === "Hard"
      ? ["SWAP_SYMBOL_FOLLOWED_BY_NUMBER", "DROP_VOWELS_BEFORE_CONSONANT", "MOVE_EVEN_NUMBERS_TO_RIGHT_ASC"]
      : ["SWAP_SYMBOL_FOLLOWED_BY_NUMBER", "MOVE_EVEN_NUMBERS_TO_RIGHT_ASC"];

  const { finalSeq, trace } = applyMainsSteps(seq, steps);
  if (finalSeq.length < 12) return null;

  const fromEnd = rng.pick(["LEFT", "RIGHT"]);
  const pos = rng.int(4, Math.min(10, finalSeq.length - 3));
  const idx = fromEnd === "LEFT" ? pos - 1 : finalSeq.length - pos;
  const correctText = finalSeq[idx];

  const nearby = [
    finalSeq[idx - 1],
    finalSeq[idx + 1],
    finalSeq[idx - 2],
    finalSeq[idx + 2],
    ...rng.shuffle(finalSeq),
  ].filter((x) => x && x !== correctText);

  const packed = shuffleOptionsWithAnswer(correctText, nearby, rng);
  if (!packed) return null;

  const stepTexts =
    difficulty === "Hard"
      ? [
          "Step 1: Every number immediately preceded by a symbol is interchanged with that symbol (applied left to right).",
          "Step 2: Every vowel immediately followed by a consonant is dropped from the series.",
          "Step 3: All even numbers are moved to the extreme right end in ascending order.",
        ]
      : [
          "Step 1: Every number immediately preceded by a symbol is interchanged with that symbol (applied left to right).",
          "Step 2: All even numbers are moved to the extreme right end in ascending order.",
        ];

  const questionText =
    `Directions: Study the following alphanumeric series and apply the given steps sequentially (Step 2 is applied to the output of Step 1${difficulty === "Hard" ? ", and Step 3 to the output of Step 2" : ""}).\n` +
    `Input: ${seq.join("  ")}\n\n` +
    `${stepTexts.join("\n")}\n\n` +
    `Which element is ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end in the final step?`;

  const traceStr = trace.map((t, i) => `Step ${i + 1}: ${t.join(" ")}`).join("\n");
  const explanation =
    `${traceStr}\nCounting ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end in the final step gives '${correctText}'.`;

  return {
    topic: "Alphanumeric Series",
    subType: "STEP_ALPHANUMERIC_MAINS",
    subtopicName: ALPHANUMERIC_SUBTOPICS.STEP_ALPHANUMERIC_MAINS,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "STEP_ALPHANUMERIC_MAINS", seq, steps, pos, fromEnd },
  };
}
