/**
 * Modular Banking Exam Word Usage Question Builder
 *
 * Covers 5 real IBPS PO / SBI PO / RBI Grade B Word Usage formats:
 * 1. TRIPLE_SENTENCE_USAGE      — Evaluate target word across 3 sentences (I, II, III)
 * 2. INCORRECT_USAGE_OUTLIER    — 4 valid usages + 1 incorrect usage (identify the wrong one)
 * 3. POLYSEMY_USAGE_MATCH       — Match the exact meaning/POS of a word in a reference sentence
 * 4. CONTEXTUAL_APPROPRIATENESS — Highlighted word in sentence + 4 replacements + "No replacement required"
 * 5. DUAL_CONTEXT_WORD_USAGE    — Single polysemous word fitting TWO distinct banking sentences
 */

import { evaluateWordUsageTriple, WORD_USAGE_TRIPLE_OPTIONS } from "./solver.js";

export const WORD_USAGE_SUBTOPICS = {
  TRIPLE_SENTENCE_USAGE: "Triple-Sentence Word Usage (I, II, III)",
  INCORRECT_USAGE_OUTLIER: "Identify Incorrect Word Usage (1-of-5)",
  POLYSEMY_USAGE_MATCH: "Polysemy & Same-Sense Usage Match",
  CONTEXTUAL_APPROPRIATENESS: "Contextual Word Appropriateness",
  DUAL_CONTEXT_WORD_USAGE: "Dual-Context Polysemous Word Usage (Mains)",
};

export function createWuRng(seedInput) {
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

// 1 & 2. Rich Word Usage Bank (each has 4 valid usages + 2 invalid usages)
const WORD_USAGE_BANK = [
  {
    word: "SANCTION",
    note: "'sanction' legitimately means either 'official approval/authorization' (verb/noun) or 'a regulatory penalty/restriction' (noun/verb).",
    valid: [
      "The regional credit committee agreed to sanction a ₹50-lakh working-capital loan for the textile exporter.",
      "International regulators imposed strict financial sanctions on entities linked to money laundering.",
      "Without formal board sanction, no branch can waive collateral norms on large corporate loans.",
      "The policy circular clearly outlines the sanctions applicable to delayed cybersecurity reporting.",
    ],
    invalid: [
      "The customer walked into the sanction to withdraw five thousand rupees from the ATM.",
      "Because the server was very sanction yesterday, all mobile transfers failed immediately.",
    ],
  },
  {
    word: "PROVISION",
    note: "'provision' means 'setting aside funds for potential loan losses', 'a clause in a legal/policy rule', or 'supplying resources'.",
    valid: [
      "The bank made a higher provision for stressed agricultural loans during the third quarter.",
      "Under Section 35A, there is a clear statutory provision empowering the regulator to issue binding directives.",
      "IT teams worked overnight to provision additional cloud servers ahead of the festival payment surge.",
      "Every credit agreement includes a specific provision governing prepayment penalties.",
    ],
    invalid: [
      "The clerk felt very provision after finishing all passbook entries before lunch.",
      "We decided to provision the train station because the express train arrived early.",
    ],
  },
  {
    word: "DEFAULT",
    note: "'default' means 'failure to repay a debt/obligation' or 'a preselected standard setting'.",
    valid: [
      "Rising interest costs increased the risk of default among highly leveraged corporate borrowers.",
      "Two-factor authentication is enabled by default on all newly activated mobile banking apps.",
      "If the borrower defaults on three consecutive EMIs, the account is classified as a non-performing asset.",
      "Depositors can change their default primary bank account inside the UPI app settings.",
    ],
    invalid: [
      "The branch manager congratulated the team for achieving a very default quarterly profit.",
      "Please default the newly printed cheque book inside the glass display cabinet.",
    ],
  },
  {
    word: "EXPOSURE",
    note: "'exposure' means 'financial risk/total credit lent to a sector or borrower' or 'public visibility/contact'.",
    valid: [
      "Commercial lenders were advised to cap their credit exposure to any single infrastructure conglomerate.",
      "Exporters used forward contracts to hedge their foreign-exchange exposure against currency swings.",
      "Rural literacy workshops gave first-time savers practical exposure to safe digital banking.",
      "Auditors reviewed the bank's total exposure to commercial real estate before approving fresh limits.",
    ],
    invalid: [
      "The teller exposure the cash bundle twice before locking the evening vault.",
      "Our mobile app is much more exposure than the legacy desktop portal.",
    ],
  },
  {
    word: "FACILITY",
    note: "'facility' means 'a credit line/banking service' or 'a physical building/infrastructure'.",
    valid: [
      "The small manufacturer availed an overdraft facility to manage seasonal raw-material purchases.",
      "A new Tier-4 data-center facility was commissioned to ensure zero downtime for UPI settlements.",
      "Senior citizens can opt for the doorstep banking facility to submit annual life certificates.",
      "The RBI's Marginal Standing Facility allows scheduled banks to borrow overnight liquidity.",
    ],
    invalid: [
      "The auditor facility the quarterly balance sheet with remarkable precision.",
      "The interest rate was too facility for rural borrowers to afford.",
    ],
  },
  {
    word: "MARGIN",
    note: "'margin' means 'profit spread (e.g., net interest margin)', 'borrower's down-payment contribution', or 'a narrow difference'.",
    valid: [
      "Lower funding costs helped the lender expand its net interest margin by twelve basis points.",
      "Borrowers must contribute a fifteen-percent margin upfront when availing a commercial vehicle loan.",
      "The resolution passed the shareholders' meeting by a comfortable margin.",
      "Clearing houses require traders to maintain an initial margin against derivative contracts.",
    ],
    invalid: [
      "The branch manager margin the new employees on anti-phishing protocols.",
      "The quarterly report was written in a very margin tone.",
    ],
  },
];

// 3. Polysemy & Same-Sense Usage Match
const POLYSEMY_ITEMS = [
  {
    word: "CLEAR",
    refSentence: "The central clearing house took less than two hours to [CLEAR] all interbank commercial cheques.",
    senseDesc: "verb meaning 'to settle and pass a financial payment/cheque through a clearing system'",
    matchSentence: "Once the outstation draft clears on Tuesday morning, the funds will be credited to your savings account.",
    distractors: [
      "The regulatory circular provided clear instructions on video-KYC verification.",
      "After the morning fog lifted, the highway to the regional office became completely clear.",
      "Security staff asked visitors to clear the lobby before the evening vault audit.",
      "It was clear from the quarterly earnings call that retail deposits had surged.",
    ],
  },
  {
    word: "ISSUE",
    refSentence: "The public sector bank announced a ₹2,000-crore bond [ISSUE] to strengthen its Tier-2 capital.",
    senseDesc: "noun meaning 'a formal offering/sale of financial securities or bonds to investors'",
    matchSentence: "Institutional investors oversubscribed the sovereign green-bond issue by more than three times.",
    distractors: [
      "Customer-care teams resolved the mobile-app login issue within thirty minutes.",
      "The regulator will issue revised guidelines on digital lending next month.",
      "Delayed invoice settlement remains a major issue for small manufacturing units.",
      "Each branch must issue a signed receipt for every physical cheque deposit.",
    ],
  },
  {
    word: "CREDIT",
    refSentence: "The employer will [CREDIT] monthly salaries directly into employees' accounts by the last working day.",
    senseDesc: "verb meaning 'to deposit or add money into a bank account'",
    matchSentence: "Under the DBT scheme, agricultural subsidies are credited straight to verified farmer accounts.",
    distractors: [
      "Strong retail credit growth drove the lender's quarterly revenue higher.",
      "The IT team deserves full credit for completing the server migration with zero downtime.",
      "A credit score above 750 helps borrowers qualify for lower home-loan interest rates.",
      "Small exporters sought formal working-capital credit from scheduled commercial banks.",
    ],
  },
  {
    word: "WEATHER",
    refSentence: "Healthy capital buffers enabled domestic banks to [WEATHER] the sharp global interest-rate cycle.",
    senseDesc: "verb meaning 'to survive or come safely through a difficult period'",
    matchSentence: "Firms with low debt and steady cash flows can easily weather temporary demand slowdowns.",
    distractors: [
      "Severe coastal weather forced regional branches to close two hours early.",
      "Crop insurance shields farmers against unpredictable monsoon weather patterns.",
      "The outdoor financial-literacy camp was postponed due to stormy weather.",
      "Weather forecasts predicted normal rainfall across northern wheat-growing states.",
    ],
  },
];

// 4. Contextual Word Appropriateness (+ No replacement required)
const APPROPRIATENESS_ITEMS = [
  {
    prefix: "The banking regulator ",
    wrongWord: "appraised",
    correctWord: "imposed",
    suffix: " a monetary penalty on the lender for delayed fraud reporting.",
    distractors: ["harvested", "borrowed", "consulted", "applauded"],
    reason: "A regulator 'imposes' a penalty ('appraised' means evaluated/estimated value).",
  },
  {
    prefix: "Automated reconciliation helped auditors ",
    wrongWord: "conceal",
    correctWord: "uncover",
    suffix: " duplicate entries across three regional ledgers.",
    distractors: ["postpone", "imitate", "reward", "multiply"],
    reason: "Auditors work to 'uncover' discrepancies, not 'conceal' them.",
  },
  {
    prefix: "Higher policy repo rates are designed to ",
    wrongWord: "ignite",
    correctWord: "contain",
    suffix: " persistent retail inflation without derailing growth.",
    distractors: ["celebrate", "export", "fabricate", "exempt"],
    reason: "Rate hikes are meant to 'contain' (restrain) inflation, not 'ignite' it.",
  },
  {
    prefix: "Branches were instructed to ",
    wrongWord: "disperse",
    correctWord: "disburse",
    suffix: " approved crop-loan funds directly into farmers' Aadhaar-linked accounts.",
    distractors: ["rehearse", "immerse", "converse", "reverse"],
    reason: "'disburse' means to pay out money from a fund; 'disperse' means to scatter.",
  },
  {
    prefix: "To prevent identity theft, customers must never ",
    wrongWord: "preserve",
    correctWord: "divulge",
    suffix: " their one-time passwords or UPI PINs to unknown callers.",
    distractors: ["verify", "encrypt", "compile", "reconcile"],
    reason: "'divulge' means to reveal private information; customers should preserve—not divulge—their PINs.",
  },
];

// 5. Dual-Context Polysemous Word Usage (PO Mains)
const DUAL_CONTEXT_ITEMS = [
  {
    s1: "During a prolonged _____ market, equity investors typically shift funds toward safer government bonds.",
    s2: "Under the revised policy, the bank will _____ the entire SMS-alert fee for senior citizen accounts.",
    answer: "bear",
    distractors: ["bull", "hold", "carry", "fund"],
    reason: "'bear' fits both 'bear market' (falling market) and 'bear the fee' (absorb the cost).",
  },
  {
    s1: "Strict monetary tightening helped keep core retail inflation firmly in _____.",
    s2: "Every new corporate borrower undergoes a thorough background _____ before credit sanction.",
    answer: "check",
    distractors: ["draft", "limit", "audit", "bond"],
    reason: "'check' fits both 'keep inflation in check' (under control) and 'background check' (verification).",
  },
  {
    s1: "The lender offered a floating interest _____ linked directly to the central bank's external benchmark.",
    s2: "Independent credit agencies _____ sovereign green bonds based on fiscal strength and repayment history.",
    answer: "rate",
    distractors: ["yield", "score", "grade", "price"],
    reason: "'rate' works as a noun ('interest rate') in I and a verb ('agencies rate bonds') in II.",
  },
  {
    s1: "The newly launched digital _____ allows small enterprises to upload verified invoices for instant discounting.",
    s2: "The train carrying currency chests arrived at _____ four under tight security escort.",
    answer: "platform",
    distractors: ["portal", "channel", "window", "station"],
    reason: "'platform' fits both 'digital platform' (software system) and 'platform four' (railway platform).",
  },
  {
    s1: "Auditors verified that the cooperative maintained an adequate liquid cash _____ at the close of business.",
    s2: "The judge ordered the defendant to _____ the disputed property until the insolvency tribunal ruled.",
    answer: "balance",
    distractors: ["reserve", "margin", "ledger", "vault"],
    reason: "'balance' fits 'cash balance' — wait: let's keep Sentence II exact too!",
  },
];
// Replace last DUAL_CONTEXT item with 100% idiomatic pair for 'balance'
DUAL_CONTEXT_ITEMS[4] = {
  s1: "Auditors verified that the cooperative maintained an adequate liquid cash _____ at the close of business.",
  s2: "Central banks must carefully _____ inflation control against the need to support industrial job growth.",
  answer: "balance",
  distractors: ["reserve", "margin", "ledger", "credit"],
  reason: "'balance' works as a noun ('cash balance') in Sentence I and a verb ('balance inflation control against growth') in Sentence II.",
};

export function buildWordUsageQuestion({
  subtopicKey = "TRIPLE_SENTENCE_USAGE",
  difficulty = "Medium",
  rng,
}) {
  // 1. Triple-Sentence Word Usage (I, II, III)
  if (subtopicKey === "TRIPLE_SENTENCE_USAGE") {
    const item = rng.pick(WORD_USAGE_BANK);
    const masks = [
      [true, false, false],
      [false, true, false],
      [true, true, false],
      [false, true, true],
      [true, true, true],
    ];
    const mask = rng.pick(masks);
    const valids = rng.shuffle(item.valid);
    const invalids = rng.shuffle(item.invalid);

    let vPtr = 0;
    let iPtr = 0;
    const sents = mask.map((ok) => (ok ? valids[vPtr++] : invalids[iPtr++]));
    const verdict = evaluateWordUsageTriple(mask[0], mask[1], mask[2]);
    const correctIndex = WORD_USAGE_TRIPLE_OPTIONS.indexOf(verdict);

    const questionText =
      `Directions: Below, the word '${item.word}' is used in three different sentences (I, II, and III). Identify which sentence(s) use the word grammatically and contextually correctly.\n\n` +
      `I. ${sents[0]}\n` +
      `II. ${sents[1]}\n` +
      `III. ${sents[2]}`;

    const explanation =
      `${item.note} Sentence I is ${mask[0] ? "correct" : "incorrect"}, Sentence II is ${mask[1] ? "correct" : "incorrect"}, and Sentence III is ${mask[2] ? "correct" : "incorrect"}. Hence, '${verdict}'.`;

    return {
      topic: "Word Usage",
      subType: "TRIPLE_SENTENCE_USAGE",
      subtopicName: WORD_USAGE_SUBTOPICS.TRIPLE_SENTENCE_USAGE,
      difficulty,
      questionText,
      options: [...WORD_USAGE_TRIPLE_OPTIONS],
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "TRIPLE_SENTENCE_USAGE",
        mode: "TRIPLE_SENTENCE_USAGE",
        word: item.word,
        tripleMask: mask,
        expectedAnswer: verdict,
      },
    };
  }

  // 2. Identify Incorrect Word Usage (1-of-5)
  if (subtopicKey === "INCORRECT_USAGE_OUTLIER") {
    const item = rng.pick(WORD_USAGE_BANK);
    const fourValid = rng.shuffle(item.valid).slice(0, 4).map((t) => ({ text: t, isValid: true }));
    const oneInvalid = { text: rng.pick(item.invalid), isValid: false };
    const tagged = rng.shuffle([...fourValid, oneInvalid]);
    const correctIndex = tagged.findIndex((o) => !o.isValid);

    const questionText =
      `Directions: The word '${item.word}' has been used in five different sentences below. Identify the ONLY sentence in which '${item.word}' is used INCORRECTLY.`;

    return {
      topic: "Word Usage",
      subType: "INCORRECT_USAGE_OUTLIER",
      subtopicName: WORD_USAGE_SUBTOPICS.INCORRECT_USAGE_OUTLIER,
      difficulty,
      questionText,
      options: tagged.map((o) => o.text),
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation: `Option (${String.fromCharCode(65 + correctIndex)}) misuses '${item.word}'. ${item.note}`,
      _meta: {
        subType: "INCORRECT_USAGE_OUTLIER",
        mode: "INCORRECT_USAGE_OUTLIER",
        word: item.word,
        taggedOptions: tagged,
      },
    };
  }

  // 3. Polysemy & Same-Sense Usage Match
  if (subtopicKey === "POLYSEMY_USAGE_MATCH") {
    const item = rng.pick(POLYSEMY_ITEMS);
    const packed = shuffleOptionsWithAnswer(item.matchSentence, item.distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Read the reference sentence below and select the option sentence that uses the highlighted word [${item.word}] in the EXACT SAME meaning and grammatical role.\n\n` +
      `Reference: ${item.refSentence}`;

    return {
      topic: "Word Usage",
      subType: "POLYSEMY_USAGE_MATCH",
      subtopicName: WORD_USAGE_SUBTOPICS.POLYSEMY_USAGE_MATCH,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `In the reference sentence, '${item.word}' is used as a ${item.senseDesc}. Only Option (${packed.correctAnswer}) matches this exact sense.`,
      _meta: {
        subType: "POLYSEMY_USAGE_MATCH",
        mode: "POLYSEMY_USAGE_MATCH",
        word: item.word,
        expectedAnswer: item.matchSentence,
      },
    };
  }

  // 4. Contextual Word Appropriateness (+ No replacement required)
  if (subtopicKey === "CONTEXTUAL_APPROPRIATENESS") {
    const item = rng.pick(APPROPRIATENESS_ITEMS);
    const noReplace = rng() < 0.22;
    const shownWord = noReplace ? item.correctWord : item.wrongWord;
    const sentence = `${item.prefix}[${shownWord}]${item.suffix}`;

    let options;
    let correctIndex;
    if (noReplace) {
      const fourWrong = rng.shuffle(item.distractors).slice(0, 4);
      options = [...fourWrong, "No replacement required"];
      correctIndex = 4;
    } else {
      const threeWrong = rng.shuffle(item.distractors).slice(0, 3);
      const fourChoices = rng.shuffle([item.correctWord, ...threeWrong]);
      options = [...fourChoices, "No replacement required"];
      correctIndex = options.indexOf(item.correctWord);
    }

    const expectedAnswer = noReplace ? "No replacement required" : item.correctWord;
    const questionText =
      `Directions: In the sentence below, a word is highlighted in brackets. Choose the word that should replace it to make the sentence contextually accurate, or select (E) 'No replacement required' if it is already correct.\n\n` +
      `${sentence}`;

    const explanation = noReplace
      ? `'${item.correctWord}' is already contextually accurate here. ${item.reason} Hence, 'No replacement required'.`
      : `Replace '${item.wrongWord}' with '${item.correctWord}': ${item.reason}`;

    return {
      topic: "Word Usage",
      subType: "CONTEXTUAL_APPROPRIATENESS",
      subtopicName: WORD_USAGE_SUBTOPICS.CONTEXTUAL_APPROPRIATENESS,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "CONTEXTUAL_APPROPRIATENESS",
        mode: "CONTEXTUAL_APPROPRIATENESS",
        expectedAnswer,
      },
    };
  }

  // 5. Dual-Context Polysemous Word Usage (Mains)
  const item = rng.pick(DUAL_CONTEXT_ITEMS);
  const packed = shuffleOptionsWithAnswer(item.answer, item.distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Two sentences with one blank each are given below. Choose the single word that can be used appropriately in BOTH sentences.\n\n` +
    `I. ${item.s1}\nII. ${item.s2}`;

  return {
    topic: "Word Usage",
    subType: "DUAL_CONTEXT_WORD_USAGE",
    subtopicName: WORD_USAGE_SUBTOPICS.DUAL_CONTEXT_WORD_USAGE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `Correct word: '${item.answer}'. ${item.reason}`,
    _meta: {
      subType: "DUAL_CONTEXT_WORD_USAGE",
      mode: "DUAL_CONTEXT_WORD_USAGE",
      expectedAnswer: item.answer,
    },
  };
}
