/**
 * Modular Banking Exam Sentence Rearrangement Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. FOUR_PART_SENTENCE      — 4 jumbled clauses (A–D) + "No rearrangement required"
 * 2. FIVE_PART_SENTENCE      — 5 jumbled clauses (A–E) full sequence
 * 3. FIXED_START_SENTENCE    — Fixed opening clause + 4 jumbled clauses (P–S)
 * 4. WORD_SWAP_SENTENCE      — Single pair word-swap among 4 highlighted words (A–D) + "No interchange required"
 * 5. DOUBLE_WORD_SWAP_MAINS  — Two simultaneous word-swap pairs (PO Mains)
 */

import { applyWordSwaps, mapJumbledFragments } from "./solver.js";

export const SENTENCE_REARRANGEMENT_SUBTOPICS = {
  FOUR_PART_SENTENCE: "4-Part Sentence Rearrangement",
  FIVE_PART_SENTENCE: "5-Part Sentence Rearrangement",
  FIXED_START_SENTENCE: "Fixed-Start Clause Rearrangement",
  WORD_SWAP_SENTENCE: "Single Word-Swap Rearrangement",
  DOUBLE_WORD_SWAP_MAINS: "Double Word-Swap Rearrangement (Mains)",
};

export function createSrRng(seedInput) {
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

const FIVE_FRAGMENT_SENTENCES = [
  {
    id: "REPO_TRANSMISSION",
    parts: [
      "The central bank raised its benchmark repo rate",
      "by fifty basis points during the quarterly review",
      "to curb persistent retail food inflation",
      "while signaling that commercial lenders should calibrate",
      "their floating-rate loan pricing transparently.",
    ],
  },
  {
    id: "UPI_MERCHANTS",
    parts: [
      "By eliminating monthly terminal rental charges",
      "and enabling instant zero-cost QR transfers,",
      "the unified digital payment network has empowered",
      "millions of rural micro-merchants to build",
      "verifiable cash-flow records for formal credit.",
    ],
  },
  {
    id: "GREEN_BONDS_GRID",
    parts: [
      "Sovereign green bonds issued over the past fiscal year",
      "have successfully channeled long-term institutional capital",
      "into grid-scale solar parks and battery storage,",
      "thereby reducing reliance on imported thermal fuel",
      "during peak summer electricity demand.",
    ],
  },
  {
    id: "CYBER_ZERO_TRUST",
    parts: [
      "To safeguard core-banking databases against phishing attacks,",
      "leading financial institutions are replacing static firewalls",
      "with zero-trust security architectures that continuously",
      "authenticate every internal login request before",
      "granting access to sensitive depositor records.",
    ],
  },
  {
    id: "MSME_INVOICE_TREDS",
    parts: [
      "Regulated electronic invoice-discounting platforms help",
      "small manufacturing suppliers overcome liquidity crunches",
      "by allowing multiple competing commercial financiers",
      "to bid transparently on verified corporate receivables",
      "within twenty-four hours of invoice upload.",
    ],
  },
  {
    id: "BRANCH_ADVISORY_HUB",
    parts: [
      "Although mobile apps now handle most routine passbook",
      "and utility-bill transactions effortlessly,",
      "households still prefer visiting physical bank branches",
      "for personalized face-to-face advisory guidance on",
      "long-term home loans and retirement portfolios.",
    ],
  },
];

// Word-swap sentence blueprints: 4 distinct words (A, B, C, D) in their EXACT canonical slots
const WORD_SWAP_BLUEPRINTS = [
  {
    id: "WS_INFLATION_CREDIT",
    segments: [
      "The central bank ",
      " its benchmark policy rate to ",
      " retail inflation without stalling ",
      " growth in the ",
      " sector.",
    ],
    words: ["raised", "curb", "credit", "manufacturing"],
  },
  {
    id: "WS_DIGITAL_FRAUD",
    segments: [
      "Banks must ",
      " real-time transaction alerts to ",
      " senior citizens from ",
      " links sent by ",
      " callers.",
    ],
    words: ["deploy", "protect", "phishing", "fraudulent"],
  },
  {
    id: "WS_GREEN_INFRA",
    segments: [
      "Long-term ",
      " bonds allow utilities to ",
      " clean solar grids and ",
      " carbon emissions across ",
      " corridors.",
    ],
    words: ["green", "finance", "lower", "industrial"],
  },
  {
    id: "WS_AUDIT_COMPLIANCE",
    segments: [
      "Independent ",
      " committees must rigorously ",
      " quarterly ledgers to ",
      " operational lapses before they ",
      " depositor trust.",
    ],
    words: ["audit", "scrutinize", "detect", "erode"],
  },
  {
    id: "WS_MSME_LIQUIDITY",
    segments: [
      "Delayed ",
      " payments frequently ",
      " small enterprises, forcing them to ",
      " short-term working capital at ",
      " rates.",
    ],
    words: ["invoice", "strain", "borrow", "elevated"],
  },
  {
    id: "WS_KYC_ONBOARDING",
    segments: [
      "Automated video ",
      " has drastically ",
      " account activation times while ",
      " strict regulatory ",
      " across branches.",
    ],
    words: ["verification", "shortened", "maintaining", "compliance"],
  },
];

function nonIdentityPerm(n, rng) {
  const base = Array.from({ length: n }, (_, i) => i);
  let perm = rng.shuffle(base);
  let tries = 0;
  while (perm.every((v, i) => v === i) && tries < 10) {
    perm = rng.shuffle(base);
    tries += 1;
  }
  return perm;
}

function makeSeqDistractors(correctOrder, rng, countNeeded = 4) {
  const correctStr = correctOrder.join("-");
  const out = [];
  const seen = new Set([correctStr]);
  for (let tries = 0; tries < 40 && out.length < countNeeded; tries++) {
    const arr = [...correctOrder];
    const i = rng.int(0, arr.length - 2);
    const j = tries % 2 === 0 ? i + 1 : rng.int(0, arr.length - 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const s = arr.join("-");
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function shuffleOptionsWithAnswer(correctText, distractorTexts, rng) {
  const unique = new Set([String(correctText)]);
  const pool = [];
  for (const d of distractorTexts) {
    if (d && !unique.has(String(d))) {
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

function renderWordSwapSentence(segments, words) {
  const labels = ["A", "B", "C", "D"];
  let out = segments[0];
  for (let i = 0; i < 4; i++) {
    out += `[${words[i]}] (${labels[i]})${segments[i + 1]}`;
  }
  return out;
}

export function buildSentenceRearrangementQuestion({
  subtopicKey = "FOUR_PART_SENTENCE",
  difficulty = "Medium",
  rng,
}) {
  // 1. 4-Part Sentence Rearrangement (+ No rearrangement required ~20%)
  if (subtopicKey === "FOUR_PART_SENTENCE") {
    const bp = rng.pick(FIVE_FRAGMENT_SENTENCES);
    const fourParts = [bp.parts[0], bp.parts[1], bp.parts[2], `${bp.parts[3]} ${bp.parts[4]}`];
    const noRearrange = rng() < 0.22;
    const perm = noRearrange ? [0, 1, 2, 3] : nonIdentityPerm(4, rng);
    const mapped = mapJumbledFragments(fourParts, perm, ["A", "B", "C", "D"]);

    let options;
    let correctIndex;
    if (noRearrange) {
      const fourWrong = makeSeqDistractors(["A", "B", "C", "D"], rng, 4);
      options = [...fourWrong, "No rearrangement required"];
      correctIndex = 4;
    } else {
      const threeWrong = makeSeqDistractors(mapped.correctOrder, rng, 3);
      const fourChoices = rng.shuffle([mapped.correctSequenceStr, ...threeWrong]);
      options = [...fourChoices, "No rearrangement required"];
      correctIndex = options.indexOf(mapped.correctSequenceStr);
    }

    const line = mapped.displayed.map((d) => `(${d.label}) ${d.text}`).join(" / ");
    const questionText =
      `Directions: Rearrange the four parts (A), (B), (C), and (D) of the sentence below to form a grammatically correct and meaningful sentence. If no rearrangement is needed, choose (E).\n\n` +
      `${line}`;

    const fullSentence = fourParts.join(" ");
    const explanation = noRearrange
      ? `The sentence is already in its exact logical order (A-B-C-D): "${fullSentence}". Hence, 'No rearrangement required'.`
      : `Correct order is ${mapped.correctSequenceStr}: "${fullSentence}".`;

    return {
      topic: "Sentence Rearrangement",
      subType: "FOUR_PART_SENTENCE",
      subtopicName: SENTENCE_REARRANGEMENT_SUBTOPICS.FOUR_PART_SENTENCE,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "FOUR_PART_SENTENCE",
        canonical: fourParts,
        displayed: mapped.displayed,
        noRearrange,
        expected: noRearrange ? "No rearrangement required" : mapped.correctSequenceStr,
      },
    };
  }

  // 2. 5-Part Sentence Rearrangement
  if (subtopicKey === "FIVE_PART_SENTENCE") {
    const bp = rng.pick(FIVE_FRAGMENT_SENTENCES);
    const perm = nonIdentityPerm(5, rng);
    const mapped = mapJumbledFragments(bp.parts, perm, ["A", "B", "C", "D", "E"]);
    const distractors = makeSeqDistractors(mapped.correctOrder, rng, 4);
    const packed = shuffleOptionsWithAnswer(mapped.correctSequenceStr, distractors, rng);
    if (!packed) return null;

    const line = mapped.displayed.map((d) => `(${d.label}) ${d.text}`).join(" / ");
    const questionText =
      `Directions: Rearrange the following five fragments (A), (B), (C), (D), and (E) to form a single grammatically sound and coherent sentence.\n\n` +
      `${line}`;

    return {
      topic: "Sentence Rearrangement",
      subType: "FIVE_PART_SENTENCE",
      subtopicName: SENTENCE_REARRANGEMENT_SUBTOPICS.FIVE_PART_SENTENCE,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Correct sequence is ${mapped.correctSequenceStr}: "${bp.parts.join(" ")}".`,
      _meta: {
        subType: "FIVE_PART_SENTENCE",
        canonical: bp.parts,
        displayed: mapped.displayed,
        expected: mapped.correctSequenceStr,
      },
    };
  }

  // 3. Fixed-Start Fragment Rearrangement (1 + P, Q, R, S)
  if (subtopicKey === "FIXED_START_SENTENCE") {
    const bp = rng.pick(FIVE_FRAGMENT_SENTENCES);
    const fixedFirst = bp.parts[0];
    const rest = bp.parts.slice(1);
    const perm = nonIdentityPerm(4, rng);
    const mapped = mapJumbledFragments(rest, perm, ["P", "Q", "R", "S"]);
    const distractors = makeSeqDistractors(mapped.correctOrder, rng, 4);
    const packed = shuffleOptionsWithAnswer(mapped.correctSequenceStr, distractors, rng);
    if (!packed) return null;

    const restBlock = mapped.displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");
    const questionText =
      `Directions: The first part (1) of the sentence is fixed. Rearrange the remaining four parts (P), (Q), (R), and (S) to form a meaningful sentence.\n\n` +
      `1. ${fixedFirst}\n${restBlock}`;

    return {
      topic: "Sentence Rearrangement",
      subType: "FIXED_START_SENTENCE",
      subtopicName: SENTENCE_REARRANGEMENT_SUBTOPICS.FIXED_START_SENTENCE,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Following part (1), the correct order is ${mapped.correctSequenceStr}: "${bp.parts.join(" ")}".`,
      _meta: {
        subType: "FIXED_START_SENTENCE",
        canonical: rest,
        displayed: mapped.displayed,
        expected: mapped.correctSequenceStr,
      },
    };
  }

  // 4. Single Word-Swap Rearrangement
  if (subtopicKey === "WORD_SWAP_SENTENCE") {
    const bp = rng.pick(WORD_SWAP_BLUEPRINTS);
    const allPairs = [
      ["A", "B"],
      ["A", "C"],
      ["A", "D"],
      ["B", "C"],
      ["B", "D"],
      ["C", "D"],
    ];
    const noSwap = rng() < 0.2;
    const chosenPair = noSwap ? null : rng.pick(allPairs);
    const shownWords = noSwap ? [...bp.words] : applyWordSwaps(bp.words, [chosenPair]);
    const sentence = renderWordSwapSentence(bp.segments, shownWords);

    let options;
    let correctIndex;
    if (noSwap) {
      const fourPairs = rng.shuffle(allPairs).slice(0, 4).map((p) => p.join("-"));
      options = [...fourPairs, "No interchange required"];
      correctIndex = 4;
    } else {
      const ansStr = chosenPair.join("-");
      const threeWrong = rng.shuffle(allPairs.map((p) => p.join("-")).filter((s) => s !== ansStr)).slice(0, 3);
      const fourChoices = rng.shuffle([ansStr, ...threeWrong]);
      options = [...fourChoices, "No interchange required"];
      correctIndex = options.indexOf(ansStr);
    }

    const questionText =
      `Directions: In the sentence below, four words are highlighted in brackets as (A), (B), (C), and (D). One pair of words may need to be interchanged to make the sentence grammatically and contextually correct. Choose the correct pair, or select (E) 'No interchange required'.\n\n` +
      `${sentence}`;

    const restored = renderWordSwapSentence(bp.segments, bp.words).replace(/\[|\]|\s\([A-D]\)/g, "");
    const explanation = noSwap
      ? `All four highlighted words are already in their correct positions: "${restored}". Hence, 'No interchange required'.`
      : `Interchanging (${chosenPair[0]}) and (${chosenPair[1]}) restores the meaningful sentence: "${restored}".`;

    return {
      topic: "Sentence Rearrangement",
      subType: "WORD_SWAP_SENTENCE",
      subtopicName: SENTENCE_REARRANGEMENT_SUBTOPICS.WORD_SWAP_SENTENCE,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "WORD_SWAP_SENTENCE",
        canonicalWords: bp.words,
        shownWords,
        swapPairs: noSwap ? [] : [chosenPair],
        expected: noSwap ? "No interchange required" : chosenPair.join("-"),
      },
    };
  }

  // 5. Double Word-Swap (PO Mains)
  const bp = rng.pick(WORD_SWAP_BLUEPRINTS);
  const doubleConfigs = [
    { pairs: [["A", "B"], ["C", "D"]], label: "A-B & C-D" },
    { pairs: [["A", "C"], ["B", "D"]], label: "A-C & B-D" },
    { pairs: [["A", "D"], ["B", "C"]], label: "A-D & B-C" },
  ];
  const chosen = rng.pick(doubleConfigs);
  const shownWords = applyWordSwaps(bp.words, chosen.pairs);
  const sentence = renderWordSwapSentence(bp.segments, shownWords);

  const otherDoubleLabels = doubleConfigs.filter((c) => c.label !== chosen.label).map((c) => c.label);
  const distractors = [...otherDoubleLabels, "Only A-C", "Only B-D"];
  const packed = shuffleOptionsWithAnswer(chosen.label, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: In the sentence below, four words labeled (A), (B), (C), and (D) have been interchanged. Identify which pair(s) must be swapped to restore a grammatically and contextually coherent sentence.\n\n` +
    `${sentence}`;

  const restored = renderWordSwapSentence(bp.segments, bp.words).replace(/\[|\]|\s\([A-D]\)/g, "");
  return {
    topic: "Sentence Rearrangement",
    subType: "DOUBLE_WORD_SWAP_MAINS",
    subtopicName: SENTENCE_REARRANGEMENT_SUBTOPICS.DOUBLE_WORD_SWAP_MAINS,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `Swapping ${chosen.label} restores the exact sentence: "${restored}".`,
    _meta: {
      subType: "DOUBLE_WORD_SWAP_MAINS",
      canonicalWords: bp.words,
      shownWords,
      swapPairs: chosen.pairs,
      expected: chosen.label,
    },
  };
}
