/**
 * Modular Banking Exam Coding-Decoding Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. CHINESE_CODING     — Substitutional 4-statement sentence coding (1-word, 2-word, new-word, Either-Or)
 * 2. NEW_PATTERN_SNL    — PO Mains / Hard Prelims Symbol–Number–Letter rule deduction
 * 3. CONDITIONAL_CODING — Digit/Letter-to-Symbol table with priority banking conditions
 * 4. LETTER_SHIFT       — Uniform, alternating, progressive, reverse+shift, half-swap, opposite, vowel/consonant
 * 5. NUMBER_CODING      — Forward/reverse alphabetical sums, scaled/length-weighted, vowel-adjusted
 */

import {
  encodeLetterShift,
  encodeNumberCoding,
  evaluateConditionalCode,
  evaluateNewPatternWord,
  isVowel,
  letterPos,
  oppositeLetter,
  shiftLetter,
  solveChineseCoding,
} from "./solver.js";

export const CODING_SUBTOPICS = {
  CHINESE_CODING: "Chinese / Substitutional Coding",
  NEW_PATTERN_SNL: "New-Pattern Symbol–Number–Letter Coding",
  CONDITIONAL_CODING: "Conditional Table Coding",
  LETTER_SHIFT: "Letter-Shift & Positional Coding",
  NUMBER_CODING: "Number & Alphabetical Value Coding",
};

export function createCodingRng(seedInput) {
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

const BANKING_WORDS_LOWER = [
  "bank", "credit", "growth", "market", "policy", "money", "digital", "reform",
  "profit", "branch", "capital", "saving", "budget", "equity", "future", "global",
  "income", "ledger", "mobile", "nation", "office", "public", "retail", "sector",
  "target", "wealth", "system", "secure", "portal", "scheme", "agency", "export",
  "import", "invest", "mentor", "output", "rating", "review", "supply", "update",
];

const TWO_LETTER_CODES = [
  "kp", "mx", "rt", "ql", "zn", "vx", "bd", "hj", "nm", "tr", "pl", "wk",
  "fg", "cy", "ds", "jt", "mv", "pq", "sx", "yb", "zr", "ch", "dk", "gn",
  "lm", "np", "rv", "tw", "xc", "zf", "br", "kl", "mn", "pt", "st", "wd",
];

const UPPER_WORDS_6 = [
  "BANKER", "CREDIT", "MARKET", "POLICY", "PROFIT", "BUDGET", "GROWTH", "EQUITY",
  "INCOME", "SAVING", "GLOBAL", "BRANCH", "RETAIL", "SECTOR", "SECURE", "PORTAL",
  "SYSTEM", "SCHEME", "TARGET", "WEALTH", "FUTURE", "LEDGER", "MOBILE", "NATION",
  "OFFICE", "PUBLIC", "AGENCY", "EXPORT", "IMPORT", "INVEST", "OUTPUT", "RATING",
  "SUPPLY", "UPDATE", "SILVER", "GOLDEN", "PLANET", "GARDEN", "BRIDGE", "CASTLE",
  "DOCTOR", "FACTOR", "FOREST", "IMPACT", "ISLAND", "JUNGLE", "KERNEL", "LAPTOP",
  "MAGNET", "NUMBER", "ORANGE", "PACKET", "QUARTZ", "ROCKET", "SIGNAL", "TEMPLE",
];

const UPPER_WORDS_MIXED = [
  "BANK", "LOAN", "GOLD", "CASH", "FUND", "RATE", "BOND", "RISK", "TERM", "UNIT",
  "CREDIT", "MARKET", "POLICY", "INCOME", "EQUITY", "SAVING", "BRANCH", "EXPORT",
  "IMPORT", "INVEST", "OFFICE", "OUTPUT", "UPDATE", "AGENCY", "SYSTEM", "FUTURE",
  "DIGITAL", "CAPITAL", "RESERVE", "ECONOMY", "ACCOUNT", "DEPOSIT", "FINANCE",
  "BALANCE", "INSURE", "AUDIT", "ASSET", "INDEX", "ORDER", "ALERT", "VALUE",
];

const SYMBOLS_POOL = ["@", "#", "$", "%", "&", "*", "!", "?", "+", "="];

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

/**
 * 1. Chinese / Substitutional Sentence Coding Builder
 */
export function buildChineseCodingQuestion({ difficulty = "Medium", rng }) {
  const words = rng.shuffle(BANKING_WORDS_LOWER).slice(0, 12);
  const codes = rng.shuffle(TWO_LETTER_CODES).slice(0, 14);
  const wordToCode = new Map();
  for (let i = 0; i < 10; i++) {
    wordToCode.set(words[i], codes[i]);
  }
  const unusedWord = words[10];
  const unusedCode = codes[10];
  const extraUnusedCodes = [codes[11], codes[12], codes[13]];

  // Construct 4 overlapping 4-word sentences that guarantee rich unique deductions AND 1-2 clean ambiguous pairs
  // Words 0..9 distributed across 4 sentences (4 words each):
  // S1: 0, 1, 2, 3
  // S2: 1, 4, 5, 6
  // S3: 2, 5, 7, 8
  // S4: 3, 6, 8, 9
  // Wait: let's check deductions!
  // 1 in S1∩S2 -> unique
  // 2 in S1∩S3 -> unique
  // 3 in S1∩S4 -> unique
  // 0 only in S1 -> unique (since 1,2,3 solved!)
  // 5 in S2∩S3 -> unique
  // 6 in S2∩S4 -> unique
  // 4 only in S2 -> unique
  // 8 in S3∩S4 -> unique
  // 7 only in S3 -> unique
  // 9 only in S4 -> unique
  // For Either-Or mode, we make a variant where S4 has 3, 6, 8, 9 AND S3 has 2, 5, 7, 10?
  // Even simpler: if S3 has [2, 5, 7, 8] and S4 has [3, 6, 7, 8], then {7, 8} appear ONLY together in S3 and S4 => exact 2-code ambiguous pair!
  const wantAmbiguous = difficulty !== "Easy" && rng() < 0.35;
  const rawSentences = wantAmbiguous
    ? [
        [words[0], words[1], words[2], words[3]],
        [words[1], words[4], words[5], words[6]],
        [words[2], words[5], words[7], words[8]],
        [words[3], words[6], words[7], words[8]],
      ]
    : [
        [words[0], words[1], words[2], words[3]],
        [words[1], words[4], words[5], words[6]],
        [words[2], words[5], words[7], words[8]],
        [words[3], words[6], words[8], words[9]],
      ];

  const statements = rawSentences.map((wList) => {
    const shuffledWords = rng.shuffle(wList);
    const shuffledCodes = rng.shuffle(wList.map((w) => wordToCode.get(w)));
    return { words: shuffledWords, codes: shuffledCodes };
  });

  const solved = solveChineseCoding(statements);
  const statementLines = statements
    .map(
      (st) =>
        `'${st.words.join(" ")}' is coded as '${st.codes.join(" ")}'`,
    )
    .join("\n");

  const stemHeader =
    `Directions: Study the following information carefully and answer the question given below.\nIn a certain code language:\n${statementLines}\n\n`;

  let questionLine = "";
  let correctText = "";
  let distractors = [];
  let explanation = "";
  let queryMeta = {};

  if (wantAmbiguous && solved.ambiguousPairs.length >= 2) {
    const pair = rng.pick(solved.ambiguousPairs);
    const [c1, c2] = pair.codes;
    questionLine = `What is the code for '${pair.word}' in the given code language?`;
    correctText = `Either '${c1}' or '${c2}'`;
    const otherUniqueCodes = [...solved.uniqueWordToCode.values()];
    distractors = [
      `'${c1}'`,
      `'${c2}'`,
      `Either '${c1}' or '${otherUniqueCodes[0]}'`,
      `Either '${c2}' or '${otherUniqueCodes[1]}'`,
    ];
    explanation =
      `Comparing statements 3 and 4, '${pair.word}' appears only alongside its paired word in both statements, while the remaining words in those statements are uniquely eliminated. Hence, the code for '${pair.word}' is ${correctText}.`;
    queryMeta = { mode: "AMBIGUOUS_PAIR", targetWord: pair.word, pairCodes: pair.codes };
  } else if (difficulty === "Hard" || (difficulty === "Medium" && rng() < 0.55)) {
    const uniqueWords = [...solved.uniqueWordToCode.keys()];
    const includeNewWord = difficulty === "Hard" && rng() < 0.5;
    if (includeNewWord) {
      const knownW = rng.pick(uniqueWords);
      const knownC = solved.uniqueWordToCode.get(knownW);
      questionLine = `What may be the code for '${knownW} ${unusedWord}' in the given code language?`;
      correctText = `${knownC} ${unusedCode}`;
      const otherCodes = [...solved.uniqueWordToCode.values()].filter((c) => c !== knownC);
      distractors = [
        `${knownC} ${otherCodes[0]}`,
        `${otherCodes[0]} ${unusedCode}`,
        `${knownC} ${otherCodes[1]}`,
        `${otherCodes[1]} ${otherCodes[2]}`,
      ];
      explanation =
        `From common words across the statements, '${knownW}' = '${knownC}'. Since '${unusedWord}' does not appear in any given statement, its code must be a new code not present in the statements ('${unusedCode}'). Thus, '${knownW} ${unusedWord}' can be coded as '${correctText}'.`;
      queryMeta = { mode: "PHRASE_WITH_NEW_WORD", knownWord: knownW, newWord: unusedWord, knownCode: knownC, newCode: unusedCode };
    } else {
      const [w1, w2] = rng.shuffle(uniqueWords).slice(0, 2);
      const c1 = solved.uniqueWordToCode.get(w1);
      const c2 = solved.uniqueWordToCode.get(w2);
      questionLine = `What is the code for '${w1} ${w2}' in the given code language?`;
      correctText = `${c1} ${c2}`;
      const otherCodes = [...solved.uniqueWordToCode.values()].filter((c) => c !== c1 && c !== c2);
      distractors = [
        `${c1} ${otherCodes[0]}`,
        `${otherCodes[0]} ${c2}`,
        `${otherCodes[1]} ${otherCodes[2]}`,
        `${c1} ${extraUnusedCodes[0]}`,
      ];
      explanation =
        `By intersecting common words across the statements, '${w1}' = '${c1}' and '${w2}' = '${c2}'. Therefore, the code for '${w1} ${w2}' is '${correctText}'.`;
      queryMeta = { mode: "TWO_WORD_PHRASE", targetWords: [w1, w2], expectedCodes: [c1, c2] };
    }
  } else {
    const uniqueWords = [...solved.uniqueWordToCode.keys()];
    const askWordFromCode = rng() < 0.45;
    const targetW = rng.pick(uniqueWords);
    const targetC = solved.uniqueWordToCode.get(targetW);

    if (askWordFromCode) {
      questionLine = `Which word is coded as '${targetC}' in the given code language?`;
      correctText = targetW;
      distractors = rng.shuffle(uniqueWords.filter((w) => w !== targetW)).slice(0, 4);
      explanation =
        `By comparing common codes across the four statements, '${targetC}' uniquely corresponds to '${targetW}'.`;
      queryMeta = { mode: "SINGLE_CODE_TO_WORD", targetCode: targetC, expectedWord: targetW };
    } else {
      questionLine = `What is the code for '${targetW}' in the given code language?`;
      correctText = targetC;
      const otherCodes = [...solved.uniqueWordToCode.values()].filter((c) => c !== targetC);
      distractors = rng.shuffle(otherCodes).slice(0, 4);
      explanation =
        `By comparing common words across the four statements, '${targetW}' uniquely maps to '${targetC}'.`;
      queryMeta = { mode: "SINGLE_WORD_TO_CODE", targetWord: targetW, expectedCode: targetC };
    }
  }

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  return {
    topic: "Coding-Decoding",
    subType: "CHINESE_CODING",
    subtopicName: CODING_SUBTOPICS.CHINESE_CODING,
    difficulty,
    questionText: `${stemHeader}${questionLine}`,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "CHINESE_CODING",
      statements,
      queryMeta,
    },
  };
}

/**
 * 2. New-Pattern Symbol–Number–Letter Coding Builder (PO Prelims/Mains)
 */
export function buildNewPatternQuestion({ difficulty = "Hard", rng }) {
  const syms = rng.shuffle(SYMBOLS_POOL);
  const symbolConfigs = [
    {
      symbolType: "LENGTH_PARITY",
      symbols: { even: syms[0], odd: syms[1] },
      desc: `Symbol is '${syms[0]}' if the word has an even number of letters, and '${syms[1]}' if odd`,
    },
    {
      symbolType: "FIRST_VOWEL",
      symbols: { vowel: syms[0], consonant: syms[1] },
      desc: `Symbol is '${syms[0]}' if the word starts with a vowel, and '${syms[1]}' if it starts with a consonant`,
    },
    {
      symbolType: "LAST_VOWEL",
      symbols: { vowel: syms[0], consonant: syms[1] },
      desc: `Symbol is '${syms[0]}' if the word ends with a vowel, and '${syms[1]}' if it ends with a consonant`,
    },
  ];

  const numberConfigs =
    difficulty === "Hard"
      ? [
          { numberType: "FIRST_POS", desc: "Number is the alphabetical position of the first letter (A=1..Z=26)" },
          { numberType: "LAST_POS", desc: "Number is the alphabetical position of the last letter (A=1..Z=26)" },
          { numberType: "LEN_TIMES_2", desc: "Number is twice the total number of letters in the word" },
          { numberType: "FIRST_PLUS_LAST_POS", desc: "Number is the sum of alphabetical positions of the first and last letters" },
        ]
      : [
          { numberType: "LEN", desc: "Number is the total number of letters in the word" },
          { numberType: "LEN_PLUS_K", numberParam: 2, desc: "Number is (total letters in the word + 2)" },
          { numberType: "FIRST_POS", desc: "Number is the alphabetical position of the first letter (A=1..Z=26)" },
        ];

  const letterConfigs = [
    { letterType: "FIRST_SHIFT", letterShift: 1, desc: "Letter is the next letter (+1) after the first letter" },
    { letterType: "LAST_SHIFT", letterShift: 1, desc: "Letter is the next letter (+1) after the last letter" },
    { letterType: "LAST_SHIFT", letterShift: -1, desc: "Letter is the previous letter (-1) before the last letter" },
    { letterType: "FIRST_OPPOSITE", desc: "Letter is the reverse-alphabet (opposite) of the first letter (A↔Z)" },
    { letterType: "LAST_OPPOSITE", desc: "Letter is the reverse-alphabet (opposite) of the last letter (A↔Z)" },
  ];

  const sCfg = rng.pick(symbolConfigs);
  const nCfg = rng.pick(numberConfigs);
  const lCfg = rng.pick(letterConfigs);
  const order = rng.pick(["SNL", "NSL"]);

  const rule = {
    symbolType: sCfg.symbolType,
    symbols: sCfg.symbols,
    numberType: nCfg.numberType,
    numberParam: nCfg.numberParam || 0,
    letterType: lCfg.letterType,
    letterShift: lCfg.letterShift || 0,
    order,
  };

  // Select 13 distinct words (12 for 3 example sentences of 4 words each + 1 target word)
  // Ensure BOTH symbol branches appear in the example sentences so the rule is 100% observable!
  const pool = rng.shuffle(UPPER_WORDS_MIXED);
  const branchA = [];
  const branchB = [];
  for (const w of pool) {
    const isBranchA =
      rule.symbolType === "LENGTH_PARITY"
        ? w.length % 2 === 0
        : rule.symbolType === "FIRST_VOWEL"
          ? isVowel(w[0])
          : isVowel(w[w.length - 1]);
    if (isBranchA) branchA.push(w);
    else branchB.push(w);
  }
  if (branchA.length < 4 || branchB.length < 9) return null;

  const selectedExamples = rng.shuffle([...branchA.slice(0, 4), ...branchB.slice(0, 8)]);
  const targetWord = branchA.length > 4 && rng() < 0.5 ? branchA[4] : branchB[8];

  const exampleSentences = [
    selectedExamples.slice(0, 4),
    selectedExamples.slice(4, 8),
    selectedExamples.slice(8, 12),
  ].map((wList) => ({
    words: wList,
    codes: wList.map((w) => evaluateNewPatternWord(w, rule)),
  }));

  const correctCode = evaluateNewPatternWord(targetWord, rule);

  // Build realistic close distractors by perturbing 1 component at a time
  const wrongSymbol =
    rule.symbolType === "LENGTH_PARITY"
      ? targetWord.length % 2 === 0
        ? rule.symbols.odd
        : rule.symbols.even
      : isVowel(rule.symbolType === "FIRST_VOWEL" ? targetWord[0] : targetWord[targetWord.length - 1])
        ? rule.symbols.consonant
        : rule.symbols.vowel;

  const altRuleSym = {
    ...rule,
    symbols:
      rule.symbolType === "LENGTH_PARITY"
        ? { even: rule.symbols.odd, odd: rule.symbols.even }
        : { vowel: rule.symbols.consonant, consonant: rule.symbols.vowel },
  };
  const d1 = evaluateNewPatternWord(targetWord, altRuleSym);

  // Perturb number by +1 and -1, and letter by +1
  const match =
    order === "SNL"
      ? /^([^0-9A-Z])(\d+)([A-Z])$/.exec(correctCode)
      : /^(\d+)([^0-9A-Z])([A-Z])$/.exec(correctCode);
  if (!match) return null;

  const cSym = order === "SNL" ? match[1] : match[2];
  const cNum = Number(order === "SNL" ? match[2] : match[1]);
  const cLet = match[3];
  const fmt = (s, n, l) => (order === "SNL" ? `${s}${n}${l}` : `${n}${s}${l}`);

  const distractors = [
    d1,
    fmt(cSym, cNum + 1, cLet),
    fmt(cSym, Math.max(1, cNum - 1), shiftLetter(cLet, 1)),
    fmt(cSym, cNum, shiftLetter(cLet, 1)),
    fmt(wrongSymbol, cNum + 2, shiftLetter(cLet, -1)),
  ];

  const packed = shuffleOptionsWithAnswer(correctCode, distractors, rng);
  if (!packed) return null;

  const lines = exampleSentences
    .map((s) => `'${s.words.join(" ")}' is coded as '${s.codes.join("  ")}'`)
    .join("\n");

  const questionText =
    `Directions: Study the following information carefully and answer the question given below.\nIn a certain code language:\n${lines}\n\nWhat is the code for '${targetWord}' in the given code language?`;

  const explanation =
    `Pattern deduced from the given examples:\n` +
    `• ${sCfg.desc}.\n` +
    `• ${nCfg.desc}.\n` +
    `• ${lCfg.desc}.\n` +
    `Applying these rules to '${targetWord}' gives '${correctCode}'.`;

  return {
    topic: "Coding-Decoding",
    subType: "NEW_PATTERN_SNL",
    subtopicName: CODING_SUBTOPICS.NEW_PATTERN_SNL,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "NEW_PATTERN_SNL",
      rule,
      exampleSentences,
      targetWord,
    },
  };
}

/**
 * 3. Conditional Table Coding Builder (Digit/Letter-to-Symbol with Priority Conditions)
 */
export function buildConditionalCodingQuestion({ difficulty = "Medium", rng }) {
  const isDigitMode = rng() < 0.6;
  const keys = isDigitMode
    ? ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    : ["A", "E", "I", "O", "K", "M", "P", "R", "T"];
  const codeLetters = rng.shuffle(
    isDigitMode
      ? ["@", "#", "$", "%", "&", "*", "M", "K", "P"]
      : ["@", "#", "$", "%", "&", "*", "2", "5", "8"],
  );

  const tableMap = {};
  keys.forEach((k, i) => {
    tableMap[k] = codeLetters[i];
  });

  const overrideA = isDigitMode ? "X" : "©";
  const overrideB = "^";

  const conditions = isDigitMode
    ? [
        {
          id: "i",
          type: "FIRST_ODD_LAST_EVEN",
          text: "(i) If the first digit is odd and the last digit is even, their codes are to be interchanged.",
        },
        {
          id: "ii",
          type: "BOTH_ODD",
          text: "(ii) If both the first and the last digits are odd, both are to be coded as the code for the first digit.",
        },
        {
          id: "iii",
          type: "FIRST_EVEN_LAST_ODD",
          overrideCode: overrideA,
          text: `(iii) If the first digit is even and the last digit is odd, both are to be coded as '${overrideA}'.`,
        },
        ...(difficulty === "Hard"
          ? [
              {
                id: "iv",
                type: "MIDDLE_PRIME_OVERRIDE",
                overrideCode: overrideB,
                text: `(iv) If any middle digit (excluding first and last) is a prime number (2, 3, 5, 7), it is to be coded as '${overrideB}'.`,
              },
            ]
          : []),
      ]
    : [
        {
          id: "i",
          type: "FIRST_VOWEL_LAST_CONSONANT",
          text: "(i) If the first letter is a vowel and the last letter is a consonant, their codes are to be interchanged.",
        },
        {
          id: "ii",
          type: "BOTH_CONSONANTS",
          text: "(ii) If both the first and the last letters are consonants, both are to be coded as the code for the first letter.",
        },
        {
          id: "iii",
          type: "FIRST_CONSONANT_LAST_VOWEL",
          overrideCode: overrideA,
          text: `(iii) If the first letter is a consonant and the last letter is a vowel, both are to be coded as '${overrideA}'.`,
        },
      ];

  // Build a 6-element sequence guaranteed to trigger at least one condition (or cleanly none on rare Easy)
  const seqLen = difficulty === "Easy" ? 5 : 6;
  const seqChars = rng.shuffle(keys).slice(0, seqLen);
  const sequence = seqChars.join("");

  const res = evaluateConditionalCode(sequence, tableMap, conditions);
  if (res.appliedConditions.length === 0 && difficulty !== "Easy") {
    return null;
  }

  const raw = res.rawCode;
  const correctCode = res.code;

  // Distractors: raw unconditioned code, reversed ends, wrong override, swapped middle
  const charsOut = [...correctCode];
  const swapEnds = (str) => {
    const a = [...str];
    [a[0], a[a.length - 1]] = [a[a.length - 1], a[0]];
    return a.join("");
  };
  const sameFirst = (str) => {
    const a = [...str];
    a[a.length - 1] = a[0];
    return a.join("");
  };
  const sameLast = (str) => {
    const a = [...str];
    a[0] = a[a.length - 1];
    return a.join("");
  };
  const swapMid = (str) => {
    const a = [...str];
    [a[1], a[2]] = [a[2], a[1]];
    return a.join("");
  };

  const distractors = [
    raw,
    swapEnds(correctCode),
    sameFirst(raw),
    sameLast(raw),
    swapMid(correctCode),
    overrideA + charsOut.slice(1, -1).join("") + overrideA,
  ];

  const packed = shuffleOptionsWithAnswer(correctCode, distractors, rng);
  if (!packed) return null;

  const keyHeader = keys.join("  ");
  const codeHeader = keys.map((k) => tableMap[k]).join("  ");
  const condBlock = conditions.map((c) => c.text).join("\n");

  const questionText =
    `Directions: In the following question, a group of ${isDigitMode ? "digits" : "letters"} is to be coded using the table and conditions given below.\n` +
    `${isDigitMode ? "Digit" : "Letter"}: ${keyHeader}\n` +
    `Code : ${codeHeader}\n\n` +
    `Conditions:\n${condBlock}\n\n` +
    `What is the code for '${sequence}'?`;

  const appliedStr =
    res.appliedConditions.length > 0
      ? `Condition(s) (${res.appliedConditions.join("), (")}) apply`
      : "None of the conditions apply";

  const explanation =
    `Direct table code for '${sequence}' is '${raw}'. ${appliedStr}, giving the final code '${correctCode}'.`;

  return {
    topic: "Coding-Decoding",
    subType: "CONDITIONAL_CODING",
    subtopicName: CODING_SUBTOPICS.CONDITIONAL_CODING,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "CONDITIONAL_CODING",
      sequence,
      tableMap,
      conditions,
      appliedConditions: res.appliedConditions,
    },
  };
}

/**
 * 4. Letter-Shift & Positional Coding Builder
 */
export function buildLetterShiftQuestion({ difficulty = "Easy", rng }) {
  const patternsByDiff = {
    Easy: [
      { type: "UNIFORM_SHIFT", k: 2, desc: "each letter is shifted forward by +2" },
      { type: "UNIFORM_SHIFT", k: 3, desc: "each letter is shifted forward by +3" },
      { type: "UNIFORM_SHIFT", k: -2, desc: "each letter is shifted backward by -2" },
      { type: "ALTERNATING_SHIFT", a: 1, b: -1, desc: "letters are shifted alternately by +1 and -1" },
      { type: "OPPOSITE_SHIFT", k: 0, desc: "each letter is replaced by its opposite letter in the alphabet (A↔Z)" },
    ],
    Medium: [
      { type: "PROGRESSIVE_SHIFT", start: 1, step: 1, desc: "letters are shifted progressively by +1, +2, +3, +4, +5, +6" },
      { type: "REVERSE_THEN_SHIFT", k: 1, desc: "the word is reversed and then each letter is shifted by +1" },
      { type: "HALF_REVERSE_SHIFT", k: 1, desc: "each half of the word is reversed and then shifted by +1" },
      { type: "VOWEL_CONSONANT_SHIFT", vowelShift: 1, consonantShift: -1, desc: "each vowel is shifted by +1 and each consonant by -1" },
      { type: "ALTERNATING_SHIFT", a: 2, b: -1, desc: "letters are shifted alternately by +2 and -1" },
    ],
    Hard: [
      { type: "HALF_REVERSE_SHIFT", k: -1, desc: "each half of the word is reversed and then shifted by -1" },
      { type: "OPPOSITE_SHIFT", k: 1, desc: "each letter is replaced by its opposite letter (A↔Z) and then shifted by +1" },
      { type: "VOWEL_CONSONANT_SHIFT", vowelShift: 2, consonantShift: -1, desc: "each vowel is shifted by +2 and each consonant by -1" },
      { type: "REVERSE_THEN_SHIFT", k: -2, desc: "the word is reversed and then each letter is shifted by -2" },
    ],
  };

  const pattern = rng.pick(patternsByDiff[difficulty] || patternsByDiff.Medium);
  const [ex1, ex2, target] = rng.shuffle(UPPER_WORDS_6).slice(0, 3);
  const c1 = encodeLetterShift(ex1, pattern);
  const c2 = encodeLetterShift(ex2, pattern);
  const correctCode = encodeLetterShift(target, pattern);

  // Close distractors (1 or 2 letters shifted by ±1)
  const mutateAt = (str, idx, delta) => {
    const a = [...str];
    a[idx] = shiftLetter(a[idx], delta);
    return a.join("");
  };
  const distractors = [
    mutateAt(correctCode, 1, 1),
    mutateAt(correctCode, 2, -1),
    mutateAt(correctCode, 4, 1),
    mutateAt(mutateAt(correctCode, 0, 1), 5, -1),
    mutateAt(correctCode, 3, 2),
  ];

  const packed = shuffleOptionsWithAnswer(correctCode, distractors, rng);
  if (!packed) return null;

  const questionText =
    `In a certain code language, '${ex1}' is written as '${c1}' and '${ex2}' is written as '${c2}'. How will '${target}' be written in that same code language?`;

  const explanation =
    `In both '${ex1}' → '${c1}' and '${ex2}' → '${c2}', ${pattern.desc}. Applying the same rule to '${target}' gives '${correctCode}'.`;

  return {
    topic: "Coding-Decoding",
    subType: "LETTER_SHIFT",
    subtopicName: CODING_SUBTOPICS.LETTER_SHIFT,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "LETTER_SHIFT",
      pattern,
      examples: [
        { word: ex1, code: c1 },
        { word: ex2, code: c2 },
      ],
      target,
    },
  };
}

/**
 * 5. Number & Alphabetical Value Coding Builder
 */
export function buildNumberCodingQuestion({ difficulty = "Easy", rng }) {
  const patternsByDiff = {
    Easy: [
      { type: "FWD_SUM", desc: "the sum of forward alphabetical positions (A=1..Z=26)" },
      { type: "REV_SUM", desc: "the sum of reverse alphabetical positions (A=26..Z=1)" },
      { type: "FWD_SUM_TIMES_K", k: 2, desc: "twice the sum of forward alphabetical positions" },
    ],
    Medium: [
      { type: "FWD_SUM_PLUS_LEN", k: 1, desc: "(sum of forward alphabetical positions) + (number of letters)" },
      { type: "FWD_SUM_PLUS_LEN", k: 2, desc: "(sum of forward alphabetical positions) + 2 × (number of letters)" },
      { type: "REV_SUM_PLUS_VOWELS", k: 2, desc: "(sum of reverse alphabetical positions) + 2 × (number of vowels)" },
    ],
    Hard: [
      { type: "FWD_SUM_TIMES_LEN", desc: "(sum of forward alphabetical positions) × (number of letters)" },
      { type: "FWD_MINUS_VOWEL_SUM", desc: "(sum of all letter positions) − (sum of vowel positions), i.e. sum of consonant positions" },
      { type: "REV_SUM_PLUS_VOWELS", k: 5, desc: "(sum of reverse alphabetical positions) + 5 × (number of vowels)" },
    ],
  };

  const pattern = rng.pick(patternsByDiff[difficulty] || patternsByDiff.Medium);
  const [ex1, ex2, target] = rng.shuffle(UPPER_WORDS_MIXED).slice(0, 3);
  const n1 = encodeNumberCoding(ex1, pattern);
  const n2 = encodeNumberCoding(ex2, pattern);
  const correctNum = encodeNumberCoding(target, pattern);
  const correctText = String(correctNum);

  const deltas = pattern.type === "FWD_SUM_TIMES_LEN" ? [-12, -6, 6, 12, 18] : [-4, -2, 2, 4, 6];
  const distractors = deltas
    .map((d) => correctNum + d)
    .filter((v) => v > 0 && v !== correctNum)
    .map(String);

  const packed = shuffleOptionsWithAnswer(correctText, distractors, rng);
  if (!packed) return null;

  const questionText =
    `In a certain code language, '${ex1}' is coded as '${n1}' and '${ex2}' is coded as '${n2}'. How will '${target}' be coded in that same language?`;

  const letterBreakdown = [...target].map((c) => `${c}(${letterPos(c)})`).join(" + ");
  const explanation =
    `Each word's code equals ${pattern.desc}. Verified on '${ex1}' = ${n1} and '${ex2}' = ${n2}. For '${target}' [${letterBreakdown}], the resulting code is ${correctText}.`;

  return {
    topic: "Coding-Decoding",
    subType: "NUMBER_CODING",
    subtopicName: CODING_SUBTOPICS.NUMBER_CODING,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "NUMBER_CODING",
      pattern,
      examples: [
        { word: ex1, code: n1 },
        { word: ex2, code: n2 },
      ],
      target,
    },
  };
}
