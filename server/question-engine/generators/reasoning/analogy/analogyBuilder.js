/**
 * Modular Banking Exam Analogy Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. NUMBER_ANALOGY         — Exact numeric relation A : B :: C : ?
 * 2. NUMBER_SET_ANALOGY     — Exact triad set analogy (a, b, c) with zero-ambiguity distractor check
 * 3. LETTER_CLUSTER_ANALOGY — Modular-26 letter-cluster transformation analogy
 * 4. ALPHANUMERIC_ANALOGY   — Word-to-alphabetical-value analogy
 * 5. SEMANTIC_WORD_ANALOGY  — Banking, regulatory, geography, science & profession relational analogy
 */

import {
  applyLetterAnalogyRule,
  applyNumberAnalogyRule,
  applyWordValueAnalogyRule,
  matchesTriadRule,
  posChar,
  shiftChar,
} from "./solver.js";

export const ANALOGY_SUBTOPICS = {
  NUMBER_ANALOGY: "Number Analogy (A : B :: C : ?)",
  NUMBER_SET_ANALOGY: "Number-Triad Set Analogy",
  LETTER_CLUSTER_ANALOGY: "Letter-Cluster Analogy",
  ALPHANUMERIC_ANALOGY: "Alphanumeric Word-Value Analogy",
  SEMANTIC_WORD_ANALOGY: "Semantic & Banking Word Analogy",
};

export function createAnalogyRng(seedInput) {
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

const FOUR_LETTER_WORDS = [
  "BANK", "LOAN", "CASH", "GOLD", "FUND", "BOND", "RATE", "RISK", "TERM", "UNIT",
  "COIN", "DEBT", "EARN", "GAIN", "MINT", "NOTE", "PLAN", "SAVE", "WIRE", "DEAL",
  "FIRM", "ITEM", "LINK", "MARK", "NORM", "PACK", "SALE", "OPEN", "HOLD", "COST",
];

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
 * 1. Number Analogy Builder (A : B :: C : ?)
 */
export function buildNumberAnalogyQuestion({ difficulty = "Medium", rng }) {
  const rulesByDiff = {
    Easy: [
      { type: "SQUARE_PLUS_K", k: rng.pick([1, 2, 3, -1, -2]), min: 4, max: 14, desc: (k) => `n → n² ${k >= 0 ? `+ ${k}` : `− ${Math.abs(k)}`}` },
      { type: "PROD_NEXT", min: 4, max: 14, desc: () => "n → n × (n + 1)" },
      { type: "LINEAR", m: rng.pick([3, 4, 5]), c: rng.pick([2, 3, -2]), min: 5, max: 18, desc: (m, c) => `n → ${m}n ${c >= 0 ? `+ ${c}` : `− ${Math.abs(c)}`}` },
    ],
    Medium: [
      { type: "CUBE_PLUS_SELF", min: 2, max: 8, desc: () => "n → n³ + n" },
      { type: "CUBE_MINUS_SELF", min: 3, max: 8, desc: () => "n → n³ − n" },
      { type: "SQUARE_PLUS_K", k: rng.pick([4, 5, -3, -4]), min: 5, max: 16, desc: (k) => `n → n² ${k >= 0 ? `+ ${k}` : `− ${Math.abs(k)}`}` },
    ],
    Hard: [
      { type: "DIGIT_SUM_SQ", min: 14, max: 89, desc: () => "n → (sum of digits of n)²" },
      { type: "CUBE_PLUS_SELF", min: 4, max: 9, desc: () => "n → n³ + n" },
      { type: "CUBE_MINUS_SELF", min: 4, max: 9, desc: () => "n → n³ − n" },
    ],
  };

  const spec = rng.pick(rulesByDiff[difficulty] || rulesByDiff.Medium);
  const rule = { type: spec.type, k: spec.k, m: spec.m, c: spec.c };

  const a = rng.int(spec.min, spec.max);
  let c = rng.int(spec.min, spec.max);
  if (c === a) c = a < spec.max ? a + 1 : a - 1;
  // Provide 2 anchor pairs on Hard/Medium so linear/digit rules are 100% uniquely determined
  let e = rng.int(spec.min, spec.max);
  while (e === a || e === c) e = rng.int(spec.min, spec.max);

  const b = applyNumberAnalogyRule(a, rule);
  const d = applyNumberAnalogyRule(c, rule);
  const f = applyNumberAnalogyRule(e, rule);

  const deltas = f > 50 ? [-6, -3, -2, 2, 4, 6] : [-4, -2, -1, 1, 2, 4];
  const distractors = deltas
    .map((dl) => f + dl)
    .filter((v) => v > 0 && v !== f)
    .map(String);

  const packed = shuffleOptionsWithAnswer(String(f), distractors, rng);
  if (!packed) return null;

  const descStr =
    spec.type === "SQUARE_PLUS_K"
      ? spec.desc(spec.k)
      : spec.type === "LINEAR"
        ? spec.desc(spec.m, spec.c)
        : spec.desc();

  const questionText =
    `Select the number that is related to the fifth number in the same way as the second number is related to the first number and the fourth number is related to the third number:\n` +
    `${a} : ${b} :: ${c} : ${d} :: ${e} : ?`;

  const explanation =
    `The relationship is ${descStr}. Verified on ${a} → ${b} and ${c} → ${d}. Applying the same rule to ${e} gives ${f}.`;

  return {
    topic: "Analogy",
    subType: "NUMBER_ANALOGY",
    subtopicName: ANALOGY_SUBTOPICS.NUMBER_ANALOGY,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "NUMBER_ANALOGY", rule, e },
  };
}

/**
 * 2. Number-Triad Set Analogy Builder
 */
export function buildNumberSetAnalogyQuestion({ difficulty = "Medium", rng }) {
  const ruleChoices = [
    { type: "DOUBLE_PLUS_K", k: rng.pick([1, 2, 3]), desc: (k) => `b = 2a + ${k} and c = 2b + ${k}` },
    { type: "SUM_TIMES_K", k: rng.pick([2, 3, 4]), desc: (k) => `c = (a + b) × ${k}` },
    { type: "SQUARE_PLUS_SECOND", desc: () => `c = a² + b` },
    { type: "DIFF_TIMES_K", k: rng.pick([3, 4, 5]), desc: (k) => `c = |b − a| × ${k}` },
  ];

  const spec = rng.pick(ruleChoices);
  const rule = { type: spec.type, k: spec.k };

  function makeValidTriad() {
    if (rule.type === "DOUBLE_PLUS_K") {
      const a = rng.int(3, 12);
      const b = 2 * a + rule.k;
      const c = 2 * b + rule.k;
      return [a, b, c];
    }
    if (rule.type === "SUM_TIMES_K") {
      const a = rng.int(4, 15);
      const b = rng.int(5, 18);
      return [a, b, (a + b) * rule.k];
    }
    if (rule.type === "SQUARE_PLUS_SECOND") {
      const a = rng.int(3, 10);
      const b = rng.int(4, 25);
      return [a, b, a * a + b];
    }
    const a = rng.int(4, 14);
    const b = a + rng.int(3, 11);
    return [a, b, (b - a) * rule.k];
  }

  const ref1 = makeValidTriad();
  const ref2 = makeValidTriad();
  const ansTriad = makeValidTriad();
  const fmt = (t) => `(${t.join(", ")})`;
  if (fmt(ref1) === fmt(ansTriad) || fmt(ref2) === fmt(ansTriad)) return null;

  const distractors = [];
  const seen = new Set([fmt(ansTriad)]);
  for (let tries = 0; tries < 40 && distractors.length < 4; tries++) {
    const base = makeValidTriad();
    base[2] += rng.pick([-5, -3, -2, 2, 3, 5]);
    if (base[2] <= 0 || matchesTriadRule(base, rule)) continue;
    const s = fmt(base);
    if (!seen.has(s)) {
      seen.add(s);
      distractors.push(s);
    }
  }

  const packed = shuffleOptionsWithAnswer(fmt(ansTriad), distractors, rng);
  if (!packed) return null;

  const descStr = rule.k !== undefined ? spec.desc(rule.k) : spec.desc();
  const questionText =
    `Select the set in which the numbers are related in the same way as are the numbers of the following given sets:\n` +
    `${fmt(ref1)}  and  ${fmt(ref2)}`;

  const explanation =
    `In both reference sets, the numbers satisfy ${descStr}. Only ${fmt(ansTriad)} satisfies the exact same relationship.`;

  return {
    topic: "Analogy",
    subType: "NUMBER_SET_ANALOGY",
    subtopicName: ANALOGY_SUBTOPICS.NUMBER_SET_ANALOGY,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "NUMBER_SET_ANALOGY", rule, ansTriad },
  };
}

/**
 * 3. Letter-Cluster Analogy Builder
 */
export function buildLetterClusterAnalogyQuestion({ difficulty = "Easy", rng }) {
  const rulesByDiff = {
    Easy: [
      { type: "UNIFORM_SHIFT", k: 2, desc: "each letter is shifted by +2" },
      { type: "UNIFORM_SHIFT", k: 3, desc: "each letter is shifted by +3" },
      { type: "UNIFORM_SHIFT", k: -2, desc: "each letter is shifted by −2" },
      { type: "OPPOSITE_SHIFT", k: 0, desc: "each letter is replaced by its opposite letter (A↔Z)" },
    ],
    Medium: [
      { type: "ALTERNATING_SHIFT", a: 2, b: -1, desc: "letters are shifted alternately by +2 and −1" },
      { type: "PROGRESSIVE_SHIFT", start: 1, desc: "letters are shifted progressively by +1, +2, +3, +4" },
      { type: "REVERSE_SHIFT", k: 1, desc: "the cluster is reversed and each letter is shifted by +1" },
    ],
    Hard: [
      { type: "OPPOSITE_SHIFT", k: 1, desc: "each letter is replaced by its opposite letter (A↔Z) and shifted by +1" },
      { type: "REVERSE_SHIFT", k: -2, desc: "the cluster is reversed and each letter is shifted by −2" },
      { type: "ALTERNATING_SHIFT", a: 3, b: -2, desc: "letters are shifted alternately by +3 and −2" },
    ],
  };

  const rule = rng.pick(rulesByDiff[difficulty] || rulesByDiff.Medium);
  const makeCluster = () =>
    Array.from({ length: 4 }, () => posChar(rng.int(1, 26))).join("");

  const c1 = makeCluster();
  const c2 = makeCluster();
  const target = makeCluster();
  const r1 = applyLetterAnalogyRule(c1, rule);
  const r2 = applyLetterAnalogyRule(c2, rule);
  const ans = applyLetterAnalogyRule(target, rule);

  const mutate = (str, idx, d) => {
    const a = [...str];
    a[idx] = shiftChar(a[idx], d);
    return a.join("");
  };
  const distractors = [
    mutate(ans, 0, 1),
    mutate(ans, 1, -1),
    mutate(ans, 2, 1),
    mutate(ans, 3, -1),
    mutate(ans, 1, 2),
  ];

  const packed = shuffleOptionsWithAnswer(ans, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Select the letter-cluster that is related to the fifth letter-cluster in the same way as the second is related to the first and the fourth is related to the third:\n` +
    `${c1} : ${r1} :: ${c2} : ${r2} :: ${target} : ?`;

  const explanation =
    `In both '${c1}' → '${r1}' and '${c2}' → '${r2}', ${rule.desc}. Applying the same rule to '${target}' yields '${ans}'.`;

  return {
    topic: "Analogy",
    subType: "LETTER_CLUSTER_ANALOGY",
    subtopicName: ANALOGY_SUBTOPICS.LETTER_CLUSTER_ANALOGY,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "LETTER_CLUSTER_ANALOGY", rule, target },
  };
}

/**
 * 4. Alphanumeric Word-Value Analogy Builder
 */
export function buildAlphanumericAnalogyQuestion({ difficulty = "Medium", rng }) {
  const rules = [
    { type: "FWD_SUM", desc: "sum of forward alphabetical positions (A=1..Z=26)" },
    { type: "REV_SUM", desc: "sum of reverse alphabetical positions (A=26..Z=1)" },
    { type: "FWD_TIMES_2", desc: "twice the sum of forward alphabetical positions" },
    { type: "FWD_PLUS_LEN", desc: "(sum of forward alphabetical positions) + (number of letters)" },
  ];
  const rule = rng.pick(rules);
  const [w1, w2, target] = rng.shuffle(FOUR_LETTER_WORDS).slice(0, 3);
  const v1 = applyWordValueAnalogyRule(w1, rule);
  const v2 = applyWordValueAnalogyRule(w2, rule);
  const ans = applyWordValueAnalogyRule(target, rule);

  const distractors = [-4, -2, -1, 1, 2, 4]
    .map((d) => ans + d)
    .filter((v) => v > 0 && v !== ans)
    .map(String);

  const packed = shuffleOptionsWithAnswer(String(ans), distractors, rng);
  if (!packed) return null;

  const questionText =
    `Select the option that is related to the fifth term in the same way as the second term is related to the first and the fourth is related to the third:\n` +
    `${w1} : ${v1} :: ${w2} : ${v2} :: ${target} : ?`;

  const explanation =
    `Each word maps to the ${rule.desc}. Verified on ${w1} = ${v1} and ${w2} = ${v2}. Thus, ${target} = ${ans}.`;

  return {
    topic: "Analogy",
    subType: "ALPHANUMERIC_ANALOGY",
    subtopicName: ANALOGY_SUBTOPICS.ALPHANUMERIC_ANALOGY,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "ALPHANUMERIC_ANALOGY", rule, target },
  };
}

/**
 * 5. Semantic & Banking Word Analogy Builder
 */
const SEMANTIC_FAMILIES = [
  {
    name: "Country : Currency",
    relationDesc: "Country to its official currency",
    pairs: [
      ["India", "Rupee"],
      ["Japan", "Yen"],
      ["United Kingdom", "Pound Sterling"],
      ["Bangladesh", "Taka"],
      ["Switzerland", "Franc"],
      ["Thailand", "Baht"],
      ["South Korea", "Won"],
      ["Russia", "Ruble"],
    ],
  },
  {
    name: "Regulator : Sector",
    relationDesc: "Indian regulatory body to the sector it regulates",
    pairs: [
      ["RBI", "Banking"],
      ["SEBI", "Capital Markets"],
      ["IRDAI", "Insurance"],
      ["PFRDA", "Pension"],
      ["TRAI", "Telecom"],
      ["NABARD", "Agriculture & Rural Credit"],
      ["FSSAI", "Food Safety"],
    ],
  },
  {
    name: "State : Capital",
    relationDesc: "Indian state to its capital city",
    pairs: [
      ["Tamil Nadu", "Chennai"],
      ["Karnataka", "Bengaluru"],
      ["Maharashtra", "Mumbai"],
      ["Gujarat", "Gandhinagar"],
      ["Rajasthan", "Jaipur"],
      ["Kerala", "Thiruvananthapuram"],
      ["Telangana", "Hyderabad"],
      ["Assam", "Dispur"],
    ],
  },
  {
    name: "Instrument : Measurement",
    relationDesc: "Scientific instrument to the quantity it measures",
    pairs: [
      ["Barometer", "Atmospheric Pressure"],
      ["Seismograph", "Earthquakes"],
      ["Thermometer", "Temperature"],
      ["Anemometer", "Wind Speed"],
      ["Hygrometer", "Humidity"],
      ["Ammeter", "Electric Current"],
      ["Lactometer", "Milk Purity"],
    ],
  },
  {
    name: "Study : Subject",
    relationDesc: "Scientific branch of study to its subject matter",
    pairs: [
      ["Cardiology", "Heart"],
      ["Ornithology", "Birds"],
      ["Entomology", "Insects"],
      ["Nephrology", "Kidneys"],
      ["Mycology", "Fungi"],
      ["Dermatology", "Skin"],
      ["Hematology", "Blood"],
    ],
  },
  {
    name: "Profession : Workplace",
    relationDesc: "Profession to its primary workplace",
    pairs: [
      ["Judge", "Courtroom"],
      ["Doctor", "Hospital"],
      ["Chef", "Kitchen"],
      ["Astronomer", "Observatory"],
      ["Curator", "Museum"],
      ["Pharmacist", "Dispensary"],
      ["Pilot", "Cockpit"],
    ],
  },
];

export function buildSemanticWordAnalogyQuestion({ difficulty = "Easy", rng }) {
  const fam = rng.pick(SEMANTIC_FAMILIES);
  const picked = rng.shuffle(fam.pairs);
  const [a1, b1] = picked[0];
  const [a2, b2] = picked[1];

  const distractors = picked.slice(2, 6).map((p) => p[1]);
  const packed = shuffleOptionsWithAnswer(b2, distractors, rng);
  if (!packed) return null;

  const questionText =
    `Select the option that is related to the third term in the same way as the second term is related to the first term:\n` +
    `${a1} : ${b1} :: ${a2} : ?`;

  const explanation =
    `Relation: ${fam.relationDesc}. Just as '${a1}' corresponds to '${b1}', '${a2}' corresponds to '${b2}'.`;

  return {
    topic: "Analogy",
    subType: "SEMANTIC_WORD_ANALOGY",
    subtopicName: ANALOGY_SUBTOPICS.SEMANTIC_WORD_ANALOGY,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: { subType: "SEMANTIC_WORD_ANALOGY", family: fam.name, expected: b2 },
  };
}
