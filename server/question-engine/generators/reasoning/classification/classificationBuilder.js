/**
 * Modular Banking Exam Classification (Odd One Out) Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. NUMBER_CLASSIFICATION         — Prime, square, cube, divisibility, and digit-sum 4-vs-1
 * 2. NUMBER_PAIR_CLASSIFICATION    — 4 pairs obey f(a)=b, 1 pair breaks f(a)=b
 * 3. LETTER_CLUSTER_CLASSIFICATION — 4 clusters share exact mod-26 gap signature, 1 breaks it
 * 4. ALPHANUMERIC_CLASSIFICATION   — 4 word–number pairs obey exact alphabetical sum rule, 1 breaks it
 * 5. SEMANTIC_WORD_CLASSIFICATION  — Disjoint banking, regulatory, economic, geography & science groups
 */

import {
  clusterGapSignature,
  evalAlphaPairValue,
  evalPairFormula,
  findUniqueOddIndex,
  matchesNumberPair,
  matchesNumberProperty,
  posChar,
} from "./solver.js";

export const CLASSIFICATION_SUBTOPICS = {
  NUMBER_CLASSIFICATION: "Number Property Classification",
  NUMBER_PAIR_CLASSIFICATION: "Number-Pair Classification",
  LETTER_CLUSTER_CLASSIFICATION: "Letter-Cluster Classification",
  ALPHANUMERIC_CLASSIFICATION: "Alphanumeric Pair Classification",
  SEMANTIC_WORD_CLASSIFICATION: "Semantic & Banking Word Classification",
};

export function createClassRng(seedInput) {
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

const STEM_STANDARD =
  "Four of the following five are alike in a certain way and hence form a group. Find the one that does NOT belong to that group.";

const PRIMES_POOL = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const ODD_COMPOSITES_POOL = [21, 27, 33, 39, 45, 51, 57, 63, 69, 75, 81, 87, 91, 93, 95];
const SQUARES_POOL = [49, 64, 81, 100, 121, 144, 169, 196, 225, 256, 289, 324, 361];
const NON_SQUARES_POOL = [52, 68, 84, 112, 132, 156, 178, 210, 240, 272, 310, 342];
const CUBES_POOL = [27, 64, 125, 216, 343, 512, 729, 1000];
const NON_CUBES_POOL = [36, 81, 144, 225, 324, 484, 625, 900];

const WORDS_POOL = [
  "BANK", "LOAN", "CASH", "GOLD", "FUND", "BOND", "RATE", "RISK", "TERM", "UNIT",
  "COIN", "DEBT", "EARN", "GAIN", "MINT", "NOTE", "PLAN", "SAVE", "WIRE", "DEAL",
  "FIRM", "ITEM", "LINK", "MARK", "NORM", "PACK", "SALE", "OPEN", "HOLD", "COST",
];

/**
 * 1. Number Property Classification Builder
 */
export function buildNumberClassificationQuestion({ difficulty = "Easy", rng }) {
  const modes =
    difficulty === "Easy"
      ? ["PRIME", "PERFECT_SQUARE", "PERFECT_CUBE"]
      : difficulty === "Medium"
        ? ["PRIME", "DIVISIBLE_BY", "PERFECT_SQUARE", "DIGIT_SUM_EQ"]
        : ["DIVISIBLE_BY", "DIGIT_SUM_EQ", "PRIME", "PERFECT_CUBE"];

  const mode = rng.pick(modes);
  let prop;
  let validFour = [];
  let oddOne = 0;
  let groupDesc = "";

  if (mode === "PRIME") {
    prop = { type: "PRIME" };
    validFour = rng.shuffle(PRIMES_POOL).slice(0, 4);
    oddOne = rng.pick(ODD_COMPOSITES_POOL);
    groupDesc = "prime numbers";
  } else if (mode === "PERFECT_SQUARE") {
    prop = { type: "PERFECT_SQUARE" };
    validFour = rng.shuffle(SQUARES_POOL).slice(0, 4);
    oddOne = rng.pick(NON_SQUARES_POOL);
    groupDesc = "perfect squares";
  } else if (mode === "PERFECT_CUBE") {
    prop = { type: "PERFECT_CUBE" };
    validFour = rng.shuffle(CUBES_POOL).slice(0, 4);
    oddOne = rng.pick(NON_CUBES_POOL);
    groupDesc = "perfect cubes";
  } else if (mode === "DIVISIBLE_BY") {
    const divisor = rng.pick([7, 9, 11, 13]);
    prop = { type: "DIVISIBLE_BY", divisor };
    const mults = rng.shuffle([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 4).map((m) => m * divisor);
    validFour = mults;
    oddOne = rng.int(4, 11) * divisor + rng.pick([1, 2, 3]);
    groupDesc = `exact multiples of ${divisor}`;
  } else {
    const targetSum = rng.pick([12, 14, 15, 16, 18]);
    prop = { type: "DIGIT_SUM_EQ", targetSum };
    const pool = [];
    for (let n = 123; n <= 987; n++) {
      const s = String(n);
      if (s.includes("0")) continue;
      const ds = Number(s[0]) + Number(s[1]) + Number(s[2]);
      if (ds === targetSum) pool.push(n);
    }
    validFour = rng.shuffle(pool).slice(0, 4);
    let cand = rng.int(215, 876);
    while (matchesNumberProperty(cand, prop)) cand += 1;
    oddOne = cand;
    groupDesc = `numbers whose digits sum to ${targetSum}`;
  }

  const allNums = rng.shuffle([...validFour, oddOne]);
  const oddIdx = findUniqueOddIndex(allNums, (n) => matchesNumberProperty(n, prop));
  if (oddIdx === -1) return null;

  const options = allNums.map(String);
  const explanation =
    `Four numbers (${validFour.join(", ")}) are ${groupDesc}, whereas ${oddOne} does not share this property. Hence, ${oddOne} is the odd one out.`;

  return {
    topic: "Classification",
    subType: "NUMBER_CLASSIFICATION",
    subtopicName: CLASSIFICATION_SUBTOPICS.NUMBER_CLASSIFICATION,
    difficulty,
    questionText: STEM_STANDARD,
    options,
    correctIndex: oddIdx,
    correctAnswer: String.fromCharCode(65 + oddIdx),
    explanation,
    _meta: { subType: "NUMBER_CLASSIFICATION", prop, items: allNums },
  };
}

/**
 * 2. Number-Pair Classification Builder
 */
export function buildNumberPairClassificationQuestion({ difficulty = "Medium", rng }) {
  const rules =
    difficulty === "Easy"
      ? [
          { type: "SQUARE_PLUS_K", k: rng.pick([1, 2, 3]), min: 4, max: 13, desc: (k) => `second = first² + ${k}` },
          { type: "PROD_NEXT", min: 4, max: 14, desc: () => `second = first × (first + 1)` },
        ]
      : [
          { type: "LINEAR", m: rng.pick([3, 4, 5]), c: rng.pick([2, 3, -2]), min: 5, max: 18, desc: (m, c) => `second = ${m} × first ${c >= 0 ? `+ ${c}` : `− ${Math.abs(c)}`}` },
          { type: "CUBE_MINUS_SELF", min: 3, max: 8, desc: () => `second = first³ − first` },
          { type: "SQUARE_PLUS_K", k: rng.pick([-2, -3, 4, 5]), min: 5, max: 15, desc: (k) => `second = first² ${k >= 0 ? `+ ${k}` : `− ${Math.abs(k)}`}` },
        ];

  const spec = rng.pick(rules);
  const rule = { type: spec.type, k: spec.k, m: spec.m, c: spec.c };

  const bases = [];
  for (let n = spec.min; n <= spec.max; n++) bases.push(n);
  if (bases.length < 5) return null;
  const pickedBases = rng.shuffle(bases).slice(0, 5);

  const pairs = pickedBases.slice(0, 4).map((a) => [a, evalPairFormula(a, rule)]);
  const oddBase = pickedBases[4];
  const expectedOddVal = evalPairFormula(oddBase, rule);
  const brokenVal = expectedOddVal + rng.pick([-3, -2, 2, 3, 4]);
  pairs.push([oddBase, brokenVal]);

  const shuffledPairs = rng.shuffle(pairs);
  const oddIdx = findUniqueOddIndex(shuffledPairs, (p) => matchesNumberPair(p, rule));
  if (oddIdx === -1) return null;

  const options = shuffledPairs.map(([a, b]) => `${a} : ${b}`);
  const descStr =
    spec.type === "SQUARE_PLUS_K"
      ? spec.desc(spec.k)
      : spec.type === "LINEAR"
        ? spec.desc(spec.m, spec.c)
        : spec.desc();

  const explanation =
    `Four pairs satisfy ${descStr}, whereas ${oddBase} : ${brokenVal} breaks the rule (expected ${oddBase} : ${expectedOddVal}).`;

  return {
    topic: "Classification",
    subType: "NUMBER_PAIR_CLASSIFICATION",
    subtopicName: CLASSIFICATION_SUBTOPICS.NUMBER_PAIR_CLASSIFICATION,
    difficulty,
    questionText: STEM_STANDARD,
    options,
    correctIndex: oddIdx,
    correctAnswer: String.fromCharCode(65 + oddIdx),
    explanation,
    _meta: { subType: "NUMBER_PAIR_CLASSIFICATION", rule, pairs: shuffledPairs },
  };
}

/**
 * 3. Letter-Cluster Classification Builder
 */
export function buildLetterClusterClassificationQuestion({ difficulty = "Medium", rng }) {
  const gapPatterns =
    difficulty === "Easy"
      ? [
          [2, 2, 2],
          [3, 3, 3],
          [1, 2, 3],
        ]
      : [
          [2, 3, 2],
          [3, 2, 3],
          [4, 2, 4],
          [2, 4, 2],
          [25, 25, 25], // -1, -1, -1
          [24, 24, 24], // -2, -2, -2
        ];

  const gaps = rng.pick(gapPatterns);
  const makeCluster = (startNum, gArr) => {
    let cur = startNum;
    const out = [posChar(cur)];
    for (const g of gArr) {
      cur += g;
      out.push(posChar(cur));
    }
    return out.join("");
  };

  const starts = rng.shuffle(Array.from({ length: 26 }, (_, i) => i + 1)).slice(0, 5);
  const validFour = starts.slice(0, 4).map((s) => makeCluster(s, gaps));
  const brokenGaps = [...gaps];
  brokenGaps[brokenGaps.length - 1] = (brokenGaps[brokenGaps.length - 1] + 1) % 26;
  const oddCluster = makeCluster(starts[4], brokenGaps);

  const allClusters = rng.shuffle([...validFour, oddCluster]);
  const targetSig = clusterGapSignature(validFour[0]);
  const oddIdx = findUniqueOddIndex(allClusters, (cl) => clusterGapSignature(cl) === targetSig);
  if (oddIdx === -1) return null;

  const fmtGaps = gaps.map((g) => (g > 13 ? `${g - 26}` : `+${g}`)).join(", ");
  const explanation =
    `Four clusters follow the exact internal letter-step pattern (${fmtGaps}), whereas '${oddCluster}' breaks this progression at the final letter.`;

  return {
    topic: "Classification",
    subType: "LETTER_CLUSTER_CLASSIFICATION",
    subtopicName: CLASSIFICATION_SUBTOPICS.LETTER_CLUSTER_CLASSIFICATION,
    difficulty,
    questionText: STEM_STANDARD,
    options: allClusters,
    correctIndex: oddIdx,
    correctAnswer: String.fromCharCode(65 + oddIdx),
    explanation,
    _meta: { subType: "LETTER_CLUSTER_CLASSIFICATION", targetSig, items: allClusters },
  };
}

/**
 * 4. Alphanumeric Pair Classification Builder
 */
export function buildAlphanumericClassificationQuestion({ difficulty = "Hard", rng }) {
  const ruleSpec = rng.pick([
    { type: "FWD_SUM", desc: "the sum of forward alphabetical positions (A=1..Z=26)" },
    { type: "REV_SUM", desc: "the sum of reverse alphabetical positions (A=26..Z=1)" },
    { type: "FIRST_PLUS_LAST", desc: "the sum of the first and last letters' alphabetical positions" },
  ]);

  const pickedWords = rng.shuffle(WORDS_POOL).slice(0, 5);
  const items = pickedWords.slice(0, 4).map((w) => ({
    word: w,
    val: evalAlphaPairValue(w, ruleSpec.type),
  }));
  const oddWord = pickedWords[4];
  const expectedVal = evalAlphaPairValue(oddWord, ruleSpec.type);
  const brokenVal = expectedVal + rng.pick([-3, -2, 2, 3]);
  items.push({ word: oddWord, val: brokenVal });

  const shuffled = rng.shuffle(items);
  const oddIdx = findUniqueOddIndex(
    shuffled,
    (it) => evalAlphaPairValue(it.word, ruleSpec.type) === it.val,
  );
  if (oddIdx === -1) return null;

  const options = shuffled.map((it) => `${it.word} – ${it.val}`);
  const explanation =
    `In four pairs, the number equals ${ruleSpec.desc}, whereas '${oddWord} – ${brokenVal}' does not (expected ${expectedVal}).`;

  return {
    topic: "Classification",
    subType: "ALPHANUMERIC_CLASSIFICATION",
    subtopicName: CLASSIFICATION_SUBTOPICS.ALPHANUMERIC_CLASSIFICATION,
    difficulty,
    questionText: STEM_STANDARD,
    options,
    correctIndex: oddIdx,
    correctAnswer: String.fromCharCode(65 + oddIdx),
    explanation,
    _meta: { subType: "ALPHANUMERIC_CLASSIFICATION", ruleType: ruleSpec.type, items: shuffled },
  };
}

/**
 * 5. Semantic & Banking Category Classification Builder
 */
const SEMANTIC_GROUPS = [
  {
    name: "Public Sector Banks vs Non-PSU",
    groupDesc: "Public Sector Banks in India",
    members: ["State Bank of India", "Punjab National Bank", "Bank of Baroda", "Canara Bank", "Union Bank of India", "Indian Bank"],
    outsiders: [
      { label: "HDFC Bank", reason: "a private sector bank" },
      { label: "ICICI Bank", reason: "a private sector bank" },
      { label: "Axis Bank", reason: "a private sector bank" },
    ],
  },
  {
    name: "RBI Monetary Policy Tools vs Fiscal/Tax",
    groupDesc: "RBI monetary policy instruments",
    members: ["Repo Rate", "Reverse Repo Rate", "Cash Reserve Ratio (CRR)", "Statutory Liquidity Ratio (SLR)", "Bank Rate", "Marginal Standing Facility (MSF)"],
    outsiders: [
      { label: "Goods & Services Tax (GST)", reason: "an indirect fiscal tax rather than a monetary policy tool" },
      { label: "Customs Duty", reason: "a trade/fiscal tax rather than a monetary policy tool" },
      { label: "Income Tax", reason: "a direct fiscal tax rather than a monetary policy tool" },
    ],
  },
  {
    name: "Electronic Payment Systems vs Paper Instruments",
    groupDesc: "electronic/digital fund transfer systems",
    members: ["UPI", "NEFT", "RTGS", "IMPS", "AEPS", "NACH"],
    outsiders: [
      { label: "Demand Draft", reason: "a paper-based negotiable instrument" },
      { label: "Promissory Note", reason: "a paper-based negotiable instrument" },
      { label: "Bearer Cheque", reason: "a paper-based negotiable instrument" },
    ],
  },
  {
    name: "Indian Financial Regulators vs Commercial Banks",
    groupDesc: "Indian financial sector regulatory bodies",
    members: ["RBI", "SEBI", "IRDAI", "PFRDA", "IFSCA"],
    outsiders: [
      { label: "State Bank of India", reason: "a commercial bank rather than a sector regulator" },
      { label: "HDFC Bank", reason: "a commercial bank rather than a sector regulator" },
      { label: "ICICI Bank", reason: "a commercial bank rather than a sector regulator" },
    ],
  },
  {
    name: "Kharif Crops vs Rabi Crops",
    groupDesc: "Kharif (monsoon) crops",
    members: ["Rice", "Maize", "Cotton", "Bajra", "Jowar", "Soybean"],
    outsiders: [
      { label: "Wheat", reason: "a Rabi (winter) crop" },
      { label: "Barley", reason: "a Rabi (winter) crop" },
      { label: "Mustard", reason: "a Rabi (winter) crop" },
    ],
  },
  {
    name: "Classical Indian Dances vs Folk Dances",
    groupDesc: "recognized classical Indian dance forms",
    members: ["Bharatanatyam", "Kathak", "Kathakali", "Kuchipudi", "Odissi", "Manipuri"],
    outsiders: [
      { label: "Bhangra", reason: "a traditional folk dance of Punjab" },
      { label: "Garba", reason: "a traditional folk dance of Gujarat" },
      { label: "Lavani", reason: "a traditional folk dance of Maharashtra" },
    ],
  },
  {
    name: "Solid Metals vs Non-Metals",
    groupDesc: "metallic elements",
    members: ["Iron", "Copper", "Aluminium", "Zinc", "Silver", "Gold"],
    outsiders: [
      { label: "Sulfur", reason: "a non-metal" },
      { label: "Carbon", reason: "a non-metal" },
      { label: "Phosphorus", reason: "a non-metal" },
    ],
  },
];

export function buildSemanticClassificationQuestion({ difficulty = "Easy", rng }) {
  const grp = rng.pick(SEMANTIC_GROUPS);
  const four = rng.shuffle(grp.members).slice(0, 4);
  const outsider = rng.pick(grp.outsiders);
  const all = rng.shuffle([...four, outsider.label]);
  const oddIdx = all.indexOf(outsider.label);

  const explanation =
    `Four options (${four.join(", ")}) are ${grp.groupDesc}, whereas ${outsider.label} is ${outsider.reason}.`;

  return {
    topic: "Classification",
    subType: "SEMANTIC_WORD_CLASSIFICATION",
    subtopicName: CLASSIFICATION_SUBTOPICS.SEMANTIC_WORD_CLASSIFICATION,
    difficulty,
    questionText: STEM_STANDARD,
    options: all,
    correctIndex: oddIdx,
    correctAnswer: String.fromCharCode(65 + oddIdx),
    explanation,
    _meta: { subType: "SEMANTIC_WORD_CLASSIFICATION", groupName: grp.name, oddLabel: outsider.label },
  };
}
