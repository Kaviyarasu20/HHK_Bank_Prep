/**
 * Modular Banking Exam Vocabulary Question Builder
 *
 * Covers 5 real IBPS PO / SBI PO / RRB / RBI Grade B Vocabulary formats:
 * 1. MISSPELT_INAPPROPRIATE_WORD — 4 highlighted words (A–D) + "All are correct" (E)
 * 2. ONE_WORD_SUBSTITUTION       — Banking, regulatory & formal editorial one-word substitution
 * 3. CONFUSABLE_HOMOPHONES       — High-frequency confusable pairs in banking sentences
 * 4. COLLOCATION_VOCAB           — Formal banking/economic collocations (verb + noun)
 * 5. CONTEXTUAL_DEFINITION       — Advanced financial/editorial term definition in context
 */

export const VOCABULARY_SUBTOPICS = {
  MISSPELT_INAPPROPRIATE_WORD: "Misspelt & Inappropriate Word Detection",
  ONE_WORD_SUBSTITUTION: "One-Word Substitution (Banking & Editorial)",
  CONFUSABLE_HOMOPHONES: "Confusable Words & Homophones",
  COLLOCATION_VOCAB: "Banking & Editorial Collocations",
  CONTEXTUAL_DEFINITION: "Contextual Financial & Editorial Definitions",
};

export function createVocabRng(seedInput) {
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

function shuffleOptionsWithAnswer(correctText, distractorTexts, rng) {
  const unique = new Set([String(correctText).toLowerCase()]);
  const pool = [];
  for (const d of distractorTexts) {
    const low = String(d || "").trim().toLowerCase();
    if (low && !unique.has(low)) {
      unique.add(low);
      pool.push(String(d).trim());
    }
    if (pool.length === 4) break;
  }
  if (pool.length < 4) return null;
  const all = rng.shuffle([String(correctText).trim(), ...pool]);
  const correctIndex = all.indexOf(String(correctText).trim());
  return {
    options: all,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
  };
}

// 1. Misspelt / Inappropriate Word Blueprints (4 words each, with exact misspelt variant per slot)
const MISSPELT_BLUEPRINTS = [
  {
    segments: [
      "The audit ",
      " recommended immediate ",
      " of legacy servers to ",
      " rising digital payment ",
      ".",
    ],
    correctWords: ["committee", "maintenance", "accommodate", "transactions"],
    wrongVariants: ["commitee", "maintainance", "accomodate", "transactons"],
  },
  {
    segments: [
      "Applicants will ",
      " a formal ",
      " notice once ",
      " verification is ",
      " completed.",
    ],
    correctWords: ["receive", "acknowledgment", "biometric", "successfully"],
    wrongVariants: ["recieve", "acknowlegment", "biometrik", "succesfully"],
  },
  {
    segments: [
      "Strict ",
      " oversight is ",
      " to prevent ",
      " accounting ",
      " in regional branches.",
    ],
    correctWords: ["regulatory", "indispensable", "fraudulent", "discrepancies"],
    wrongVariants: ["regulatery", "indispensible", "fradulent", "discrepencies"],
  },
  {
    segments: [
      "Eliminating unnecessary ",
      " delays has ",
      " improved loan ",
      " for small ",
      ".",
    ],
    correctWords: ["bureaucratic", "significantly", "disbursement", "entrepreneurs"],
    wrongVariants: ["bureacratic", "significently", "disbursment", "entreprenuers"],
  },
  {
    segments: [
      "An ",
      " spike in ",
      " inflation ",
      " the central bank's ",
      " rate hike.",
    ],
    correctWords: ["unforeseen", "commodity", "necessitated", "consequent"],
    wrongVariants: ["unforseen", "comodity", "necesitated", "consequant"],
  },
  {
    segments: [
      "Banks must ",
      " clear ",
      " protocols before ",
      " outdated security ",
      ".",
    ],
    correctWords: ["establish", "surveillance", "superseding", "mechanisms"],
    wrongVariants: ["establsh", "surveilance", "superceding", "machanisms"],
  },
];

// 2. One-Word Substitution (Banking, Finance & Formal Editorial)
const ONE_WORD_BANK = [
  {
    prompt: "A legal and financial state in which a debtor is unable to pay outstanding debts as they fall due",
    answer: "Insolvency",
    reason: "'Insolvency' is the exact legal/financial term for inability to meet debt obligations.",
  },
  {
    prompt: "A temporary official suspension of debt repayments or regulatory enforcement during a crisis",
    answer: "Moratorium",
    reason: "'Moratorium' denotes a temporary legally authorized suspension of repayments or activity.",
  },
  {
    prompt: "An independent official appointed to investigate and resolve customer complaints against banks",
    answer: "Ombudsman",
    reason: "The Banking Ombudsman is the designated official resolving customer grievances.",
  },
  {
    prompt: "The gradual repayment of a loan principal and interest through regular scheduled installments",
    answer: "Amortization",
    reason: "'Amortization' refers to paying off a debt gradually via periodic installments.",
  },
  {
    prompt: "An asset pledged by a borrower to a lender as security for the repayment of a loan",
    answer: "Collateral",
    reason: "'Collateral' is the pledged security backing a secured loan.",
  },
  {
    prompt: "The ease with which an asset can be converted rapidly into cash without significant loss of value",
    answer: "Liquidity",
    reason: "'Liquidity' measures how quickly an asset converts into cash.",
  },
  {
    prompt: "Simultaneous buying and selling of an asset in different markets to profit from tiny price differences",
    answer: "Arbitrage",
    reason: "'Arbitrage' exploits price discrepancies across two markets simultaneously.",
  },
  {
    prompt: "A person or institution legally entrusted to act in the best financial interest of another party",
    answer: "Fiduciary",
    reason: "'Fiduciary' denotes a legal duty of utmost good faith and loyalty toward a beneficiary.",
  },
  {
    prompt: "A sustained general fall in the price level of goods and services across an economy",
    answer: "Deflation",
    reason: "'Deflation' is a sustained decline in the general price level (negative inflation).",
  },
  {
    prompt: "The formal process of comparing two sets of financial records to ensure balances match accurately",
    answer: "Reconciliation",
    reason: "'Reconciliation' verifies that two independent ledger records are in complete agreement.",
  },
];

// 3. Confusable Words & Homophones in Context
const CONFUSABLE_ITEMS = [
  {
    sentence: "The borrower repaid the entire _____ amount along with accrued interest before the maturity date.",
    answer: "principal",
    distractors: ["principle", "principled", "principality", "principe"],
    reason: "'principal' refers to the original capital sum of a loan; 'principle' means a fundamental rule or belief.",
  },
  {
    sentence: "A fifty-basis-point hike in the repo rate will directly _____ floating-rate housing loan EMIs.",
    answer: "affect",
    distractors: ["effect", "afflict", "defect", "infect"],
    reason: "'affect' is the verb meaning 'to influence'; 'effect' is typically a noun meaning 'result'.",
  },
  {
    sentence: "Self-service passbook kiosks are designed to _____ digital mobile apps rather than replace branch advisors.",
    answer: "complement",
    distractors: ["compliment", "compliant", "implement", "supplemented"],
    reason: "'complement' means to enhance or go well together; 'compliment' means to praise.",
  },
  {
    sentence: "Auditors must remain strictly _____ when handling confidential merger valuations prior to public disclosure.",
    answer: "discreet",
    distractors: ["discrete", "decree", "discredit", "decrepit"],
    reason: "'discreet' means careful and tactful with secrets; 'discrete' means separate or distinct.",
  },
  {
    sentence: "Anti-money-laundering teams monitor cross-border transfers to detect _____ financial flows.",
    answer: "illicit",
    distractors: ["elicit", "explicit", "implicit", "solicit"],
    reason: "'illicit' means unlawful/forbidden; 'elicit' is a verb meaning 'to draw out a response'.",
  },
  {
    sentence: "The bank decided to _____ the annual debit-card maintenance fee for senior citizen pension accounts.",
    answer: "waive",
    distractors: ["wave", "weave", "waver", "wade"],
    reason: "'waive' means to voluntarily relinquish a fee or claim; 'wave' refers to a gesture or surge.",
  },
  {
    sentence: "The central bank invited an _____ macroeconomist to chair the monetary policy review panel.",
    answer: "eminent",
    distractors: ["imminent", "immanent", "emanate", "remnant"],
    reason: "'eminent' means distinguished and respected; 'imminent' means about to happen very soon.",
  },
  {
    sentence: "Due to temporary liquidity stress, the cooperative requested permission to _____ its bond redemption by six months.",
    answer: "defer",
    distractors: ["differ", "deter", "refer", "infer"],
    reason: "'defer' means to postpone; 'differ' means to disagree or be unlike.",
  },
];

// 4. Banking & Editorial Collocations
const COLLOCATION_ITEMS = [
  {
    sentence: "The regulator may _____ a monetary penalty on institutions that fail to report cybersecurity breaches on time.",
    answer: "levy",
    distractors: ["harvest", "bake", "paint", "weave"],
    reason: "'levy a penalty / tax' is the exact standard formal banking collocation.",
  },
  {
    sentence: "Once title deeds are verified, the branch will _____ the housing loan directly to the developer's escrow account.",
    answer: "disburse",
    distractors: ["disperse", "rehearse", "immerse", "converse"],
    reason: "'disburse a loan / funds' means to pay out money from a fund (distinct from 'disperse', meaning scatter).",
  },
  {
    sentence: "Clear forward guidance helps the central bank _____ long-term inflation expectations across bond markets.",
    answer: "anchor",
    distractors: ["paddle", "stitch", "carve", "roast"],
    reason: "'anchor inflation expectations' is the canonical central-banking collocation.",
  },
  {
    sentence: "Export-oriented IT firms routinely _____ their foreign-exchange exposure using forward currency contracts.",
    answer: "hedge",
    distractors: ["pledge", "dredge", "wedge", "sledge"],
    reason: "'hedge exposure / risk' means protecting against adverse price or currency movements.",
  },
  {
    sentence: "When a corporate borrower repeatedly fails to pay scheduled interest, it is said to _____ on its debt obligations.",
    answer: "default",
    distractors: ["vault", "halt", "exalt", "assault"],
    reason: "'default on a loan / debt' is the exact banking collocation for failing to repay.",
  },
  {
    sentence: "Every evening after counter hours, tellers must _____ physical cash balances with the core-banking ledger.",
    answer: "reconcile",
    distractors: ["compile", "exile", "beguile", "defile"],
    reason: "'reconcile balances / ledgers' is the exact accounting and banking collocation.",
  },
];

// 5. Contextual Financial & Editorial Definitions
const CONTEXTUAL_DEF_ITEMS = [
  {
    term: "FIDUCIARY",
    sentence: "As a [FIDUCIARY] managing retirement savings, the pension fund must place subscriber interests above its own fees.",
    definition: "an entity legally obligated to act solely in the best financial interest of its clients",
  },
  {
    term: "CONTAGION",
    sentence: "Prompt liquidity support by the central bank prevented stress at one small lender from triggering wider financial [CONTAGION].",
    definition: "the rapid spread of financial distress from one institution or market to others",
  },
  {
    term: "SOLVENCY",
    sentence: "Annual stress tests evaluate a commercial bank's [SOLVENCY] under severe recession and default scenarios.",
    definition: "the long-term financial capacity of an entity to meet all its liabilities and remain viable",
  },
  {
    term: "FISCAL",
    sentence: "Disciplined [FISCAL] consolidation helped narrow the government's annual budget deficit without cutting infrastructure outlays.",
    definition: "relating to government revenue, taxation, public expenditure, and debt management",
  },
  {
    term: "PROVISIONING",
    sentence: "Higher [PROVISIONING] for stressed loans reduced quarterly net profit even though operating revenue grew steadily.",
    definition: "setting aside a portion of bank earnings to cover potential future loan losses",
  },
  {
    term: "DISINTERMEDIATION",
    sentence: "Direct online bond platforms have accelerated [DISINTERMEDIATION] by letting retail savers invest without middlemen.",
    definition: "the removal of traditional intermediaries between savers, investors, and borrowers",
  },
];

function renderMisspeltSentence(segments, words) {
  const labels = ["A", "B", "C", "D"];
  let out = segments[0];
  for (let i = 0; i < 4; i++) {
    out += `[${words[i]}] (${labels[i]})${segments[i + 1]}`;
  }
  return out;
}

export function buildVocabularyQuestion({
  subtopicKey = "MISSPELT_INAPPROPRIATE_WORD",
  difficulty = "Medium",
  rng,
}) {
  // 1. Misspelt / Inappropriate Word
  if (subtopicKey === "MISSPELT_INAPPROPRIATE_WORD") {
    const bp = rng.pick(MISSPELT_BLUEPRINTS);
    const allCorrect = rng() < 0.2;
    const errorSlot = allCorrect ? 4 : rng.int(0, 3);
    const shownWords = [...bp.correctWords];
    if (!allCorrect) {
      shownWords[errorSlot] = bp.wrongVariants[errorSlot];
    }

    const sentence = renderMisspeltSentence(bp.segments, shownWords);
    const options = [...shownWords, "All are correct"];
    const correctIndex = errorSlot;

    const questionText =
      `Directions: In the sentence below, four words are highlighted in brackets as (A), (B), (C), and (D). One of these words may be misspelt or contextually inappropriate. Identify that word, or choose (E) 'All are correct'.\n\n` +
      `${sentence}`;

    const explanation = allCorrect
      ? `All four highlighted words (${bp.correctWords.join(", ")}) are spelt and used accurately. Hence, 'All are correct'.`
      : `'${shownWords[errorSlot]}' in (${String.fromCharCode(65 + errorSlot)}) is misspelt; the correct spelling is '${bp.correctWords[errorSlot]}'.`;

    return {
      topic: "Vocabulary",
      subType: "MISSPELT_INAPPROPRIATE_WORD",
      subtopicName: VOCABULARY_SUBTOPICS.MISSPELT_INAPPROPRIATE_WORD,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "MISSPELT_INAPPROPRIATE_WORD",
        shownWords,
        correctWords: bp.correctWords,
        errorSlot,
      },
    };
  }

  // 2. One-Word Substitution
  if (subtopicKey === "ONE_WORD_SUBSTITUTION") {
    const item = rng.pick(ONE_WORD_BANK);
    const distractors = rng
      .shuffle(ONE_WORD_BANK.filter((x) => x.answer !== item.answer))
      .slice(0, 4)
      .map((x) => x.answer);
    const packed = shuffleOptionsWithAnswer(item.answer, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Choose the single word that can best substitute the formal banking/editorial expression given below.\n\n` +
      `"${item.prompt}"`;

    return {
      topic: "Vocabulary",
      subType: "ONE_WORD_SUBSTITUTION",
      subtopicName: VOCABULARY_SUBTOPICS.ONE_WORD_SUBSTITUTION,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Correct term: '${item.answer}'. ${item.reason}`,
      _meta: { subType: "ONE_WORD_SUBSTITUTION", expectedAnswer: item.answer },
    };
  }

  // 3. Confusable Words & Homophones
  if (subtopicKey === "CONFUSABLE_HOMOPHONES") {
    const item = rng.pick(CONFUSABLE_ITEMS);
    const packed = shuffleOptionsWithAnswer(item.answer, item.distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Select the exact word from the commonly confused options below to complete the sentence accurately.\n\n` +
      `${item.sentence}`;

    return {
      topic: "Vocabulary",
      subType: "CONFUSABLE_HOMOPHONES",
      subtopicName: VOCABULARY_SUBTOPICS.CONFUSABLE_HOMOPHONES,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Correct word: '${item.answer}'. ${item.reason}`,
      _meta: { subType: "CONFUSABLE_HOMOPHONES", expectedAnswer: item.answer },
    };
  }

  // 4. Banking & Editorial Collocations
  if (subtopicKey === "COLLOCATION_VOCAB") {
    const item = rng.pick(COLLOCATION_ITEMS);
    const packed = shuffleOptionsWithAnswer(item.answer, item.distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Choose the word that forms the most accurate formal banking/editorial collocation in the sentence below.\n\n` +
      `${item.sentence}`;

    return {
      topic: "Vocabulary",
      subType: "COLLOCATION_VOCAB",
      subtopicName: VOCABULARY_SUBTOPICS.COLLOCATION_VOCAB,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Correct collocation: '${item.answer}'. ${item.reason}`,
      _meta: { subType: "COLLOCATION_VOCAB", expectedAnswer: item.answer },
    };
  }

  // 5. Contextual Financial & Editorial Definitions
  const item = rng.pick(CONTEXTUAL_DEF_ITEMS);
  const otherDefs = rng
    .shuffle(CONTEXTUAL_DEF_ITEMS.filter((x) => x.term !== item.term))
    .slice(0, 4)
    .map((x) => x.definition);
  const packed = shuffleOptionsWithAnswer(item.definition, otherDefs, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Read the sentence carefully and select the option that best defines the highlighted term [${item.term}] in context.\n\n` +
    `${item.sentence}`;

  return {
    topic: "Vocabulary",
    subType: "CONTEXTUAL_DEFINITION",
    subtopicName: VOCABULARY_SUBTOPICS.CONTEXTUAL_DEFINITION,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `In banking and economic writing, '${item.term}' means: ${item.definition}.`,
    _meta: { subType: "CONTEXTUAL_DEFINITION", expectedAnswer: item.definition },
  };
}
