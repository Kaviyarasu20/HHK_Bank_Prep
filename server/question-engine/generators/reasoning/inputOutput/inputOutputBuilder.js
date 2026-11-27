/**
 * Modular Banking Exam Input-Output Question Builder
 *
 * Covers 5 real IBPS / SBI / RBI Prelims & Mains subtopics:
 * 1. DUAL_END_WORD_NUMBER      — Dual-end word & number shifting machine
 * 2. INTERLEAVED_WORD_NUMBER   — Single-end interleaved auto-arrangement machine
 * 3. NUMBER_ARITHMETIC_MACHINE — 3-step number-only arithmetic machine (PO Mains)
 * 4. WORD_NUMBER_TRANSFORM     — Dual-end word+number shift & transform machine (PO Mains)
 * 5. DIGIT_OP_MACHINE          — 3-step digit-operation number machine (SBI PO Mains)
 */

import {
  simulateDigitOpMachine,
  simulateDualEndWordNumber,
  simulateInterleavedAutoArrange,
  simulateNumberArithmeticMachine,
  simulateWordNumberTransform,
} from "./solver.js";

export const INPUT_OUTPUT_SUBTOPICS = {
  DUAL_END_WORD_NUMBER: "Dual-End Word & Number Shifting",
  INTERLEAVED_WORD_NUMBER: "Interleaved Auto-Arrangement",
  NUMBER_ARITHMETIC_MACHINE: "Number-Only Arithmetic Machine (Mains)",
  WORD_NUMBER_TRANSFORM: "Word & Number Shift-Transform (Mains)",
  DIGIT_OP_MACHINE: "Digit-Operation Number Machine (Mains)",
};

export function createIoRng(seedInput) {
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

const WORD_POOL = [
  "bank", "cash", "debt", "earn", "fund", "gold", "hike", "iron", "join", "keen",
  "loan", "mint", "note", "open", "plan", "quit", "rate", "save", "term", "unit",
  "vast", "wire", "yard", "zero", "bond", "coin", "deal", "exit", "firm", "gain",
  "hold", "item", "jump", "kind", "link", "mark", "norm", "pack", "risk", "sale",
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function formatIllustration(sim) {
  const lines = [`Input: ${sim.input.join(" ")}`];
  sim.steps.forEach((st, i) => {
    lines.push(`Step ${ROMAN[i]}: ${st.join(" ")}`);
  });
  lines.push(`Step ${ROMAN[sim.steps.length - 1]} is the last step of the rearrangement.`);
  return lines.join("\n");
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

function pickDistinctNumbers(rng, count, min = 14, max = 94) {
  const set = new Set();
  while (set.size < count) {
    const n = rng.int(min, max);
    if (n % 10 === 0) continue; // avoid trailing zero for clean digit-reversals
    set.add(n);
  }
  return [...set];
}

function makeInterleavedInput(words, nums, rng) {
  const mixed = [];
  const wShuf = rng.shuffle(words);
  const nShuf = rng.shuffle(nums.map(String));
  for (let i = 0; i < wShuf.length; i++) {
    if (i % 2 === 0) {
      mixed.push(wShuf[i], nShuf[i]);
    } else {
      mixed.push(nShuf[i], wShuf[i]);
    }
  }
  return mixed;
}

/**
 * 1. Dual-End Word & Number Shifting Builder
 */
export function buildDualEndWordNumberQuestion({ difficulty = "Medium", rng }) {
  const pairCount = difficulty === "Easy" ? 4 : 5;
  const wordOrder = rng.pick(["ASC", "DESC"]);
  const numOrder = rng.pick(["ASC", "DESC"]);
  const placement = difficulty === "Hard" ? "INNER" : "OUTER";
  const cfg = { wordOrder, numOrder, placement };

  const allWords = rng.shuffle(WORD_POOL).slice(0, pairCount * 2);
  const exInput = makeInterleavedInput(allWords.slice(0, pairCount), pickDistinctNumbers(rng, pairCount, 12, 89), rng);
  const qInput = makeInterleavedInput(allWords.slice(pairCount), pickDistinctNumbers(rng, pairCount, 15, 96), rng);

  const exSim = simulateDualEndWordNumber(exInput, cfg);
  const qSim = simulateDualEndWordNumber(qInput, cfg);

  const stepIdx = rng.int(1, qSim.steps.length - 1); // 0-indexed (Step II..Step IV/V)
  const targetStep = qSim.steps[stepIdx];
  const fromEnd = rng.pick(["LEFT", "RIGHT"]);
  const pos = rng.int(2, targetStep.length - 1);
  const elemIdx = fromEnd === "LEFT" ? pos - 1 : targetStep.length - pos;
  const answer = targetStep[elemIdx];

  const nearby = [
    targetStep[elemIdx - 1],
    targetStep[elemIdx + 1],
    targetStep[elemIdx - 2],
    targetStep[elemIdx + 2],
    ...rng.shuffle(targetStep),
  ].filter((x) => x && x !== answer);

  const packed = shuffleOptionsWithAnswer(answer, nearby, rng);
  if (!packed) return null;

  const questionText =
    `Directions: A word and number arrangement machine, when given an input line of words and numbers, rearranges them following a particular rule in each step. The following is an illustration of input and rearrangement:\n` +
    `${formatIllustration(exSim)}\n\n` +
    `As per the rules followed in the above steps, find the answer for the following input:\n` +
    `Input: ${qInput.join(" ")}\n\n` +
    `Which element is ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end in Step ${ROMAN[stepIdx]}?`;

  const explanation =
    `Rule: In each step, one word is arranged in ${wordOrder === "ASC" ? "alphabetical" : "reverse alphabetical"} order at the left (${placement.toLowerCase()} shift) and one number in ${numOrder === "ASC" ? "ascending" : "descending"} order at the right.\n` +
    `Step ${ROMAN[stepIdx]}: ${targetStep.join(" ")}\n` +
    `The ${ordinal(pos)} element from the ${fromEnd.toLowerCase()} end is '${answer}'.`;

  return {
    topic: "Input-Output",
    subType: "DUAL_END_WORD_NUMBER",
    subtopicName: INPUT_OUTPUT_SUBTOPICS.DUAL_END_WORD_NUMBER,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "DUAL_END_WORD_NUMBER", cfg, qInput, stepIdx, pos, fromEnd },
  };
}

/**
 * 2. Interleaved Auto-Arrangement Builder
 */
export function buildInterleavedAutoArrangeQuestion({ difficulty = "Easy", rng }) {
  const pairCount = 4;
  const cfg = { wordOrder: rng.pick(["ASC", "DESC"]), numOrder: rng.pick(["DESC", "ASC"]) };
  const allWords = rng.shuffle(WORD_POOL).slice(0, pairCount * 2);

  const exInput = makeInterleavedInput(allWords.slice(0, pairCount), pickDistinctNumbers(rng, pairCount, 12, 88), rng);
  const qInput = makeInterleavedInput(allWords.slice(pairCount), pickDistinctNumbers(rng, pairCount, 14, 92), rng);

  const exSim = simulateInterleavedAutoArrange(exInput, cfg);
  const qSim = simulateInterleavedAutoArrange(qInput, cfg);
  if (exSim.steps.length < 4 || qSim.steps.length < 4) return null;

  const askTotalSteps = rng() < 0.45;
  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let queryMeta = {};
  let explanation = "";

  if (askTotalSteps) {
    const total = qSim.steps.length;
    questionLine = `How many steps will be required to complete the rearrangement for the given input?`;
    correctText = String(total);
    distractors = [total - 2, total - 1, total + 1, total + 2, total + 3]
      .filter((v) => v > 0 && v !== total)
      .map(String);
    queryMeta = { mode: "TOTAL_STEPS" };
    explanation =
      `Target order alternates ${cfg.wordOrder === "ASC" ? "alphabetical" : "reverse alphabetical"} words and ${cfg.numOrder === "DESC" ? "descending" : "ascending"} numbers, moving one out-of-place element per step.\n` +
      `Final Step (Step ${ROMAN[total - 1]}): ${qSim.steps[total - 1].join(" ")}.\n` +
      `Total steps required = ${total}.`;
  } else {
    const stepIdx = rng.int(1, qSim.steps.length - 1);
    const targetStep = qSim.steps[stepIdx];
    const pos = rng.int(2, targetStep.length - 1);
    const fromEnd = rng.pick(["LEFT", "RIGHT"]);
    const idx = fromEnd === "LEFT" ? pos - 1 : targetStep.length - pos;
    correctText = targetStep[idx];
    distractors = rng.shuffle(targetStep.filter((x) => x !== correctText)).slice(0, 4);
    questionLine = `Which element is ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end in Step ${ROMAN[stepIdx]}?`;
    queryMeta = { mode: "ELEMENT_AT", stepIdx, pos, fromEnd };
    explanation =
      `Step ${ROMAN[stepIdx]}: ${targetStep.join(" ")}. Counting ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end gives '${correctText}'.`;
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Study the following illustration of an input-output machine carefully:\n` +
    `${formatIllustration(exSim)}\n\n` +
    `Following the same rules, solve for the input below:\n` +
    `Input: ${qInput.join(" ")}\n\n` +
    `${questionLine}`;

  return {
    topic: "Input-Output",
    subType: "INTERLEAVED_WORD_NUMBER",
    subtopicName: INPUT_OUTPUT_SUBTOPICS.INTERLEAVED_WORD_NUMBER,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "INTERLEAVED_WORD_NUMBER", cfg, qInput, queryMeta },
  };
}

/**
 * 3. Number-Only 3-Step Arithmetic Machine Builder (PO Mains)
 */
export function buildNumberArithmeticMachineQuestion({ difficulty = "Hard", rng }) {
  const ruleVariant = rng.pick(["A", "B", "C"]);
  const exNums = pickDistinctNumbers(rng, 6, 14, 89);
  const qNums = pickDistinctNumbers(rng, 6, 16, 94);

  const exSim = simulateNumberArithmeticMachine(exNums, ruleVariant);
  const qSim = simulateNumberArithmeticMachine(qNums, ruleVariant);

  const finalNums = qSim.steps[2].map(Number);
  const askSum = rng() < 0.55;
  let questionLine = "";
  let correctVal = 0;
  let queryMeta = {};

  if (askSum) {
    const hi = Math.max(...finalNums);
    const lo = Math.min(...finalNums);
    correctVal = hi + lo;
    questionLine = `What is the sum of the highest and the lowest numbers obtained in Step III?`;
    queryMeta = { mode: "SUM_HIGH_LOW" };
  } else {
    correctVal = finalNums.reduce((a, b) => a + b, 0);
    questionLine = `What is the sum of all the numbers obtained in Step III?`;
    queryMeta = { mode: "SUM_ALL" };
  }

  const distractors = [-6, -3, -2, 2, 3, 5, 7]
    .map((d) => correctVal + d)
    .filter((v) => v > 0 && v !== correctVal)
    .map(String);

  const packed = shuffleOptionsWithAnswer(String(correctVal), distractors, rng);
  if (!packed) return null;

  const ruleText =
    ruleVariant === "A"
      ? "Step I sorts ascending; Step II halves even numbers and adds 5 to odd numbers; Step III takes the digit sum of each number."
      : ruleVariant === "B"
        ? "Step I reverses the digits of each number; Step II sorts descending; Step III adds 6 to even numbers and subtracts 3 from odd numbers."
        : "Step I sorts descending; Step II subtracts 4 from even numbers and adds 3 to odd numbers; Step III reverses the digits of each number.";

  const questionText =
    `Directions: A number rearrangement machine processes an input of six numbers through three steps as shown below:\n` +
    `${formatIllustration(exSim)}\n\n` +
    `Apply the same rules to the following input:\n` +
    `Input: ${qNums.join(" ")}\n\n` +
    `${questionLine}`;

  const explanation =
    `Pattern: ${ruleText}\n` +
    `Step I: ${qSim.steps[0].join(" ")}\nStep II: ${qSim.steps[1].join(" ")}\nStep III: ${qSim.steps[2].join(" ")}\n` +
    `Required value = ${correctVal}.`;

  return {
    topic: "Input-Output",
    subType: "NUMBER_ARITHMETIC_MACHINE",
    subtopicName: INPUT_OUTPUT_SUBTOPICS.NUMBER_ARITHMETIC_MACHINE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "NUMBER_ARITHMETIC_MACHINE", ruleVariant, qNums, queryMeta },
  };
}

/**
 * 4. Word + Number Shift & Transform Machine Builder (PO Mains)
 */
export function buildWordNumberTransformQuestion({ difficulty = "Hard", rng }) {
  const pairCount = 4;
  const cfg = {
    wordOp: rng.pick(["REVERSE", "SHIFT_FIRST"]),
    evenDelta: rng.pick([2, 4]),
    oddDelta: rng.pick([-1, 1]),
  };

  const allWords = rng.shuffle(WORD_POOL).slice(0, pairCount * 2);
  const exInput = makeInterleavedInput(allWords.slice(0, pairCount), pickDistinctNumbers(rng, pairCount, 14, 86), rng);
  const qInput = makeInterleavedInput(allWords.slice(pairCount), pickDistinctNumbers(rng, pairCount, 16, 92), rng);

  const exSim = simulateWordNumberTransform(exInput, cfg);
  const qSim = simulateWordNumberTransform(qInput, cfg);

  const stepIdx = rng.int(1, qSim.steps.length - 1);
  const targetStep = qSim.steps[stepIdx];
  const fromEnd = rng.pick(["LEFT", "RIGHT"]);
  const pos = rng.int(1, targetStep.length);
  const idx = fromEnd === "LEFT" ? pos - 1 : targetStep.length - pos;
  const answer = targetStep[idx];

  const distractors = rng.shuffle(targetStep.filter((x) => x !== answer)).slice(0, 4);
  const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
  if (!packed) return null;

  const wordDesc =
    cfg.wordOp === "REVERSE"
      ? "reversed"
      : "transformed by shifting its first letter by +1";
  const numDesc = `even +${cfg.evenDelta}, odd ${cfg.oddDelta > 0 ? `+${cfg.oddDelta}` : cfg.oddDelta}`;

  const questionText =
    `Directions: Study the following illustration of a word and number machine carefully:\n` +
    `${formatIllustration(exSim)}\n\n` +
    `Apply the same logic to the input below:\n` +
    `Input: ${qInput.join(" ")}\n\n` +
    `Which element is ${ordinal(pos)} from the ${fromEnd.toLowerCase()} end in Step ${ROMAN[stepIdx]}?`;

  const explanation =
    `Rule: Each step picks the next alphabetical word (${wordDesc}) at the left and next ascending number (${numDesc}) at the right.\n` +
    `Step ${ROMAN[stepIdx]}: ${targetStep.join(" ")}\n` +
    `The ${ordinal(pos)} element from the ${fromEnd.toLowerCase()} end is '${answer}'.`;

  return {
    topic: "Input-Output",
    subType: "WORD_NUMBER_TRANSFORM",
    subtopicName: INPUT_OUTPUT_SUBTOPICS.WORD_NUMBER_TRANSFORM,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "WORD_NUMBER_TRANSFORM", cfg, qInput, stepIdx, pos, fromEnd },
  };
}

/**
 * 5. Digit-Operation 3-Step Number Machine Builder (SBI PO Mains)
 */
export function buildDigitOpMachineQuestion({ difficulty = "Hard", rng }) {
  const step2Op = rng.pick(["DIFF", "SUM"]);
  const exNums = pickDistinctNumbers(rng, 6, 22, 89);
  const qNums = pickDistinctNumbers(rng, 6, 23, 94);

  const exSim = simulateDigitOpMachine(exNums, step2Op);
  const qSim = simulateDigitOpMachine(qNums, step2Op);

  const finalNums = qSim.steps[2].map(Number);
  const correctVal = finalNums.reduce((a, b) => a + b, 0);
  const distractors = [-5, -3, -2, -1, 1, 2, 4, 6]
    .map((d) => correctVal + d)
    .filter((v) => v > 0 && v !== correctVal)
    .map(String);

  const packed = shuffleOptionsWithAnswer(String(correctVal), distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Study the following number-machine illustration carefully:\n` +
    `${formatIllustration(exSim)}\n\n` +
    `Following the exact same logic, process the input below:\n` +
    `Input: ${qNums.join(" ")}\n\n` +
    `What is the sum of all the numbers in Step III?`;

  const explanation =
    `Pattern: Step I multiplies the two digits of each input number; Step II takes the ${step2Op === "DIFF" ? "absolute difference" : "sum"} of the digits of each Step-I number; Step III sorts the results in ascending order.\n` +
    `Step I: ${qSim.steps[0].join(" ")}\nStep II: ${qSim.steps[1].join(" ")}\nStep III: ${qSim.steps[2].join(" ")}\n` +
    `Sum of Step III = ${correctVal}.`;

  return {
    topic: "Input-Output",
    subType: "DIGIT_OP_MACHINE",
    subtopicName: INPUT_OUTPUT_SUBTOPICS.DIGIT_OP_MACHINE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "DIGIT_OP_MACHINE", step2Op, qNums },
  };
}
