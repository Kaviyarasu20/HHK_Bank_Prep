/**
 * Modular Banking Exam Idioms & Phrases Question Builder
 *
 * Covers 5 real IBPS PO / SBI PO / RRB / RBI Grade B formats:
 * 1. CONTEXTUAL_IDIOM_MEANING — Highlighted idiom in a banking/editorial sentence
 * 2. IDIOM_FILLER             — Fill in the blank with the contextually exact idiom
 * 3. PHRASAL_VERB_CONTEXT     — Banking-exam phrasal verbs in real editorial sentences
 * 4. IDIOM_USAGE_TRIPLE_MAINS — Evaluate idiom usage across 3 sentences I, II, III (PO Mains)
 * 5. IDIOM_SUBSTITUTION       — Replace a highlighted literal phrase with the exact idiom
 */

import { evaluateTripleUsageVerdict, TRIPLE_USAGE_OPTIONS } from "./solver.js";

export const IDIOMS_PHRASES_SUBTOPICS = {
  CONTEXTUAL_IDIOM_MEANING: "In-Context Idiom Meaning",
  IDIOM_FILLER: "Idiom Fill-in-the-Blank",
  PHRASAL_VERB_CONTEXT: "Phrasal Verbs in Banking Context",
  IDIOM_USAGE_TRIPLE_MAINS: "Triple-Sentence Idiom Usage (Mains)",
  IDIOM_SUBSTITUTION: "Literal-to-Idiom Substitution",
};

export function createIdiomRng(seedInput) {
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

const IDIOM_BANK = [
  {
    idiom: "bite the bullet",
    meaning: "to accept a difficult or unpleasant situation with courage and resolve",
    contextSentence: "After two quarters of mounting bad loans, the regional lender decided to [bite the bullet] and recognize the full write-off immediately.",
    blankSentence: "After two quarters of mounting bad loans, the regional lender decided to _____ and recognize the full write-off immediately.",
    literalSentence: "After two quarters of mounting bad loans, the regional lender decided to [accept the unpleasant loss resolutely] and clean up its balance sheet.",
    validUses: [
      "The bank finally chose to bite the bullet and retire its outdated legacy software despite high migration costs.",
      "To restore investor confidence, management had to bite the bullet and cut executive bonuses this year.",
      "Small exporters decided to bite the bullet and absorb the temporary freight surcharge to retain long-term clients.",
    ],
    invalidUses: [
      "The branch clerk decided to bite the bullet by eating lunch ten minutes early in the cafeteria.",
      "Because interest rates fell sharply, depositors had to bite the bullet and celebrate their windfall.",
    ],
  },
  {
    idiom: "in the red",
    meaning: "operating at a financial loss or owing more money than is earned",
    contextSentence: "Consecutive quarters of high provisioning pushed the cooperative bank [in the red] before the merger rescue.",
    blankSentence: "Consecutive quarters of high provisioning pushed the cooperative bank _____ before the merger rescue.",
    literalSentence: "Consecutive quarters of high provisioning left the cooperative bank [operating at a financial loss] before the merger rescue.",
    validUses: [
      "Several regional airlines remained in the red throughout the fiscal year due to elevated aviation fuel costs.",
      "Without fresh working capital, the textile mill risked slipping in the red during the off-season.",
      "Quarterly filings confirmed that the subsidiary was still in the red despite higher sales volume.",
    ],
    invalidUses: [
      "The newly renovated bank lobby looked very welcoming because the walls were painted in the red.",
      "After posting record net profits for five straight quarters, the bank proudly stayed in the red.",
    ],
  },
  {
    idiom: "turn the corner",
    meaning: "to pass a critical crisis point and begin to recover or improve",
    contextSentence: "Following strict NPA recovery drives, the public sector bank appears to have [turned the corner] and returned to steady profitability.",
    blankSentence: "Following strict NPA recovery drives, the public sector bank appears to have _____ and returned to steady profitability.",
    literalSentence: "Following strict NPA recovery drives, the public sector bank appears to have [passed the worst phase and begun recovering] this fiscal year.",
    validUses: [
      "Analysts believe rural consumer demand has finally turned the corner after a strong monsoon harvest.",
      "With bad-loan ratios falling for three quarters, the lender has clearly turned the corner.",
      "Export orders from European buyers suggest the manufacturing unit has turned the corner.",
    ],
    invalidUses: [
      "The courier van stopped right after the guard asked him to turn the corner of the parking ledger.",
      "Because defaults doubled again this quarter, the distressed firm has happily turned the corner.",
    ],
  },
  {
    idiom: "nip in the bud",
    meaning: "to stop a problem or undesirable trend at its very beginning before it grows",
    contextSentence: "Real-time AI transaction alerts allow fraud teams to [nip phishing scams in the bud] before funds leave the banking network.",
    blankSentence: "Real-time AI transaction alerts allow fraud teams to _____ before funds leave the banking network.",
    literalSentence: "Real-time AI transaction alerts allow fraud teams to [halt phishing scams at their very beginning] before funds leave the network.",
    validUses: [
      "Early-warning cash-flow audits help credit officers nip potential loan defaults in the bud.",
      "Prompt regulatory circulars were issued to nip misleading mis-selling practices in the bud.",
      "Swift software patching enabled the IT team to nip the security vulnerability in the bud.",
    ],
    invalidUses: [
      "After ignoring the accounting error for five full years, the firm tried to nip it in the bud retroactively.",
      "The branch manager ordered fresh floral bouquets to nip in the bud for the foundation day stage.",
    ],
  },
  {
    idiom: "red tape",
    meaning: "excessive bureaucratic procedures and paperwork that delay action",
    contextSentence: "Single-window digital licensing has eliminated much of the [red tape] that previously delayed small-enterprise credit approvals.",
    blankSentence: "Single-window digital licensing has eliminated much of the _____ that previously delayed small-enterprise credit approvals.",
    literalSentence: "Single-window digital licensing has eliminated much of the [excessive bureaucratic paperwork] that previously delayed credit approvals.",
    validUses: [
      "Entrepreneurs welcomed the online portal because it cut through months of municipal red tape.",
      "Streamlining customs clearance reduced red tape for perishable agricultural exporters.",
      "The committee recommended removing unnecessary red tape in rural micro-loan renewals.",
    ],
    invalidUses: [
      "The teller used a roll of red tape to wrap the birthday gift for a retiring colleague.",
      "Instant five-minute video KYC is a classic example of severe red tape slowing down depositors.",
    ],
  },
  {
    idiom: "weather the storm",
    meaning: "to survive a period of severe difficulty or crisis without major harm",
    contextSentence: "Strong capital buffers and diversified retail deposits helped domestic banks [weather the storm] of global rate hikes.",
    blankSentence: "Strong capital buffers and diversified retail deposits helped domestic banks _____ of global rate hikes.",
    literalSentence: "Strong capital buffers and diversified deposits helped domestic banks [survive the severe financial turbulence] of global rate hikes.",
    validUses: [
      "Firms with low debt and healthy cash reserves are better equipped to weather the storm during recessions.",
      "Prudent provisioning enabled the lender to weather the storm without cutting its dividend.",
      "Small farmers relied on crop insurance to weather the storm of unseasonal hail.",
    ],
    invalidUses: [
      "The meteorology desk forecasted sunny skies so the bank could weather the storm at the picnic.",
      "Because the company immediately declared bankruptcy, it managed to weather the storm effortlessly.",
    ],
  },
  {
    idiom: "call it a day",
    meaning: "to decide to stop working on a task for the rest of the day",
    contextSentence: "After reconciling all quarterly branch ledgers without a single discrepancy, the audit team decided to [call it a day].",
    blankSentence: "After reconciling all quarterly branch ledgers without a single discrepancy, the audit team decided to _____.",
    literalSentence: "After reconciling all quarterly branch ledgers cleanly, the audit team decided to [stop working for the rest of the day].",
    validUses: [
      "Once the final server patch passed verification at 8 PM, the engineers chose to call it a day.",
      "Having completed twenty customer interviews, the recruitment panel decided to call it a day.",
      "We have finished drafting all compliance circulars, so let us call it a day.",
    ],
    invalidUses: [
      "At 9 AM sharp, just as the branch opened for business, the eager cashier arrived to call it a day.",
      "The calendar committee met in January to call it a day on the official holiday list.",
    ],
  },
  {
    idiom: "a level playing field",
    meaning: "a fair and equal competitive environment where all participants follow the same rules",
    contextSentence: "Uniform digital-lending norms were introduced to ensure [a level playing field] between traditional banks and fintech apps.",
    blankSentence: "Uniform digital-lending norms were introduced to ensure _____ between traditional banks and fintech apps.",
    literalSentence: "Uniform digital-lending norms were introduced to ensure [fair and equal competitive rules] between traditional banks and fintech apps.",
    validUses: [
      "Transparent auction guidelines create a level playing field for both small and large bidders.",
      "Regulators updated disclosure standards to maintain a level playing field across all payment aggregators.",
      "Removing arbitrary regional exemptions helped establish a level playing field for domestic exporters.",
    ],
    invalidUses: [
      "The groundskeepers mowed the cricket stadium carefully to maintain a level playing field for the monsoon.",
      "Giving one bank an exclusive secret tax break guarantees a level playing field for its rivals.",
    ],
  },
  {
    idiom: "hit the nail on the head",
    meaning: "to describe or identify the exact cause of a problem accurately",
    contextSentence: "The chief economist [hit the nail on the head] by pointing out that rural logistics bottlenecks—not demand—drove vegetable inflation.",
    blankSentence: "The chief economist _____ by pointing out that rural logistics bottlenecks—not demand—drove vegetable inflation.",
    literalSentence: "The chief economist [identified the exact root cause accurately] by highlighting rural logistics bottlenecks.",
    validUses: [
      "Your audit remark hit the nail on the head regarding why branch turnaround times lagged.",
      "The committee hit the nail on the head when it linked ATM downtime to poor cash forecasting.",
      "By emphasizing vernacular cyber-safety alerts, the trainer hit the nail on the head.",
    ],
    invalidUses: [
      "The carpenter accidentally missed the board and hit the nail on the head during branch repairs.",
      "Her completely inaccurate guess about next year's inflation rate hit the nail on the head.",
    ],
  },
  {
    idiom: "burn the midnight oil",
    meaning: "to work or study late into the night with intense dedication",
    contextSentence: "IT engineers had to [burn the midnight oil] over the weekend to complete the core-banking database migration before Monday.",
    blankSentence: "IT engineers had to _____ over the weekend to complete the core-banking database migration before Monday.",
    literalSentence: "IT engineers had to [work tirelessly late into the night] to finish the database migration before Monday.",
    validUses: [
      "Aspirants preparing for the SBI PO Mains exam often burn the midnight oil practicing puzzles.",
      "The treasury desk burned the midnight oil analyzing global bond yields ahead of the policy announcement.",
      "Accountants had to burn the midnight oil during the final week of March to close annual books.",
    ],
    invalidUses: [
      "To save electricity during the afternoon lunch break, the office decided to burn the midnight oil.",
      "The generator technician forgot to refill the tank so the lamp could burn the midnight oil at noon.",
    ],
  },
];

const PHRASAL_VERB_BANK = [
  {
    phrasal: "shore up",
    meaning: "to support, strengthen, or bolster something that is weak or under pressure",
    sentence: "The board approved a fresh rights issue to [shore up] the lender's Tier-1 capital ratio.",
    blankSentence: "The board approved a fresh rights issue to _____ the lender's Tier-1 capital ratio.",
  },
  {
    phrasal: "rein in",
    meaning: "to control, restrain, or limit something that is growing too rapidly",
    sentence: "Higher risk weights on unsecured personal loans were introduced to [rein in] reckless credit expansion.",
    blankSentence: "Higher risk weights on unsecured personal loans were introduced to _____ reckless credit expansion.",
  },
  {
    phrasal: "iron out",
    meaning: "to resolve minor difficulties, glitches, or differences smoothly",
    sentence: "Payment operators met with NPCI engineers to [iron out] intermittent settlement glitches before the festive season.",
    blankSentence: "Payment operators met with NPCI engineers to _____ intermittent settlement glitches before the festive season.",
  },
  {
    phrasal: "phase out",
    meaning: "to gradually discontinue or withdraw something in stages",
    sentence: "Commercial banks were instructed to [phase out] magnetic-stripe debit cards in favor of EMV chip cards.",
    blankSentence: "Commercial banks were instructed to _____ magnetic-stripe debit cards in favor of EMV chip cards.",
  },
  {
    phrasal: "clamp down on",
    meaning: "to take strict official action to stop an illegal or undesirable activity",
    sentence: "Financial regulators vowed to [clamp down on] unregistered digital lending apps charging predatory interest.",
    blankSentence: "Financial regulators vowed to _____ unregistered digital lending apps charging predatory interest.",
  },
  {
    phrasal: "tide over",
    meaning: "to help someone get through a temporary period of financial difficulty",
    sentence: "Short-term working-capital loans helped small weavers [tide over] the seasonal slump in export orders.",
    blankSentence: "Short-term working-capital loans helped small weavers _____ the seasonal slump in export orders.",
  },
  {
    phrasal: "zero in on",
    meaning: "to focus closely and directly on a specific target or root cause",
    sentence: "Forensic auditors quickly managed to [zero in on] the three shell accounts used to layer the funds.",
    blankSentence: "Forensic auditors quickly managed to _____ the three shell accounts used to layer the funds.",
  },
  {
    phrasal: "bring about",
    meaning: "to cause something significant to happen",
    sentence: "Unified mobile banking rails helped [bring about] a historic rise in rural financial inclusion.",
    blankSentence: "Unified mobile banking rails helped _____ a historic rise in rural financial inclusion.",
  },
];

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

export function buildIdiomsPhrasesQuestion({
  subtopicKey = "CONTEXTUAL_IDIOM_MEANING",
  difficulty = "Medium",
  rng,
}) {
  // 1. In-Context Idiom Meaning
  if (subtopicKey === "CONTEXTUAL_IDIOM_MEANING") {
    const item = rng.pick(IDIOM_BANK);
    const otherMeanings = rng
      .shuffle(IDIOM_BANK.filter((x) => x.idiom !== item.idiom))
      .slice(0, 4)
      .map((x) => x.meaning);

    const packed = shuffleOptionsWithAnswer(item.meaning, otherMeanings, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Choose the option that best expresses the meaning of the highlighted idiom/phrase in the sentence below.\n\n` +
      `${item.contextSentence}`;

    return {
      topic: "Idioms & Phrases",
      subType: "CONTEXTUAL_IDIOM_MEANING",
      subtopicName: IDIOMS_PHRASES_SUBTOPICS.CONTEXTUAL_IDIOM_MEANING,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `The idiom '${item.idiom}' means "${item.meaning}".`,
      _meta: { subType: "CONTEXTUAL_IDIOM_MEANING", mode: "CONTEXTUAL_IDIOM_MEANING", expectedAnswer: item.meaning },
    };
  }

  // 2. Idiom Fill-in-the-Blank
  if (subtopicKey === "IDIOM_FILLER") {
    const item = rng.pick(IDIOM_BANK);
    const otherIdioms = rng
      .shuffle(IDIOM_BANK.filter((x) => x.idiom !== item.idiom))
      .slice(0, 4)
      .map((x) => x.idiom);

    const packed = shuffleOptionsWithAnswer(item.idiom, otherIdioms, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Select the most appropriate idiom/phrase to fill in the blank and complete the sentence meaningfully.\n\n` +
      `${item.blankSentence}`;

    return {
      topic: "Idioms & Phrases",
      subType: "IDIOM_FILLER",
      subtopicName: IDIOMS_PHRASES_SUBTOPICS.IDIOM_FILLER,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${item.idiom}' (${item.meaning}) fits the context of the sentence accurately.`,
      _meta: { subType: "IDIOM_FILLER", mode: "IDIOM_FILLER", expectedAnswer: item.idiom },
    };
  }

  // 3. Phrasal Verbs in Banking Context
  if (subtopicKey === "PHRASAL_VERB_CONTEXT") {
    const item = rng.pick(PHRASAL_VERB_BANK);
    const askMeaning = rng() < 0.5;

    if (askMeaning) {
      const otherMeanings = rng
        .shuffle(PHRASAL_VERB_BANK.filter((x) => x.phrasal !== item.phrasal))
        .slice(0, 4)
        .map((x) => x.meaning);
      const packed = shuffleOptionsWithAnswer(item.meaning, otherMeanings, rng);
      if (!packed) return null;

      return {
        topic: "Idioms & Phrases",
        subType: "PHRASAL_VERB_CONTEXT",
        subtopicName: IDIOMS_PHRASES_SUBTOPICS.PHRASAL_VERB_CONTEXT,
        difficulty,
        questionText: `Directions: Choose the option that best explains the meaning of the highlighted phrasal verb in the sentence below.\n\n${item.sentence}`,
        options: packed.options,
        correctIndex: packed.correctIndex,
        correctAnswer: packed.correctAnswer,
        explanation: `The phrasal verb '${item.phrasal}' means "${item.meaning}".`,
        _meta: { subType: "PHRASAL_VERB_CONTEXT", mode: "PHRASAL_MEANING", expectedAnswer: item.meaning },
      };
    }

    const otherPhrasals = rng
      .shuffle(PHRASAL_VERB_BANK.filter((x) => x.phrasal !== item.phrasal))
      .slice(0, 4)
      .map((x) => x.phrasal);
    const packed = shuffleOptionsWithAnswer(item.phrasal, otherPhrasals, rng);
    if (!packed) return null;

    return {
      topic: "Idioms & Phrases",
      subType: "PHRASAL_VERB_CONTEXT",
      subtopicName: IDIOMS_PHRASES_SUBTOPICS.PHRASAL_VERB_CONTEXT,
      difficulty,
      questionText: `Directions: Select the most appropriate phrasal verb to fill in the blank in the sentence below.\n\n${item.blankSentence}`,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${item.phrasal}' (${item.meaning}) completes the sentence accurately.`,
      _meta: { subType: "PHRASAL_VERB_CONTEXT", mode: "PHRASAL_FILLER", expectedAnswer: item.phrasal },
    };
  }

  // 4. Triple-Sentence Idiom Usage (PO Mains)
  if (subtopicKey === "IDIOM_USAGE_TRIPLE_MAINS") {
    const item = rng.pick(IDIOM_BANK);
    const masks = [
      [true, false, false],
      [false, true, false],
      [true, true, false],
      [false, true, true],
      [true, true, true],
    ];
    const mask = rng.pick(masks);
    const valids = rng.shuffle(item.validUses);
    const invalids = rng.shuffle(item.invalidUses);

    let vPtr = 0;
    let iPtr = 0;
    const sents = mask.map((isValid) => (isValid ? valids[vPtr++] : invalids[iPtr++]));
    const verdict = evaluateTripleUsageVerdict(mask[0], mask[1], mask[2]);
    const correctIndex = TRIPLE_USAGE_OPTIONS.indexOf(verdict);

    const questionText =
      `Directions: Below, the idiom '${item.idiom.toUpperCase()}' is used in three different sentences (I, II, and III). Identify which sentence(s) use the idiom correctly and contextually.\n\n` +
      `I. ${sents[0]}\n` +
      `II. ${sents[1]}\n` +
      `III. ${sents[2]}`;

    const explanation =
      `'${item.idiom}' means "${item.meaning}". ` +
      `Sentence I is ${mask[0] ? "correct" : "incorrect"}, Sentence II is ${mask[1] ? "correct" : "incorrect"}, and Sentence III is ${mask[2] ? "correct" : "incorrect"}. Hence, '${verdict}'.`;

    return {
      topic: "Idioms & Phrases",
      subType: "IDIOM_USAGE_TRIPLE_MAINS",
      subtopicName: IDIOMS_PHRASES_SUBTOPICS.IDIOM_USAGE_TRIPLE_MAINS,
      difficulty,
      questionText,
      options: [...TRIPLE_USAGE_OPTIONS],
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "IDIOM_USAGE_TRIPLE_MAINS",
        mode: "IDIOM_USAGE_TRIPLE_MAINS",
        tripleMask: mask,
        expectedAnswer: verdict,
      },
    };
  }

  // 5. Literal-to-Idiom Substitution
  const item = rng.pick(IDIOM_BANK);
  const otherIdioms = rng
    .shuffle(IDIOM_BANK.filter((x) => x.idiom !== item.idiom))
    .slice(0, 4)
    .map((x) => x.idiom);
  const packed = shuffleOptionsWithAnswer(item.idiom, otherIdioms, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Select the idiom/phrase that can best replace the bracketed literal phrase in the sentence below without changing its meaning.\n\n` +
    `${item.literalSentence}`;

  return {
    topic: "Idioms & Phrases",
    subType: "IDIOM_SUBSTITUTION",
    subtopicName: IDIOMS_PHRASES_SUBTOPICS.IDIOM_SUBSTITUTION,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `'${item.idiom}' directly expresses "${item.meaning}".`,
    _meta: { subType: "IDIOM_SUBSTITUTION", mode: "IDIOM_SUBSTITUTION", expectedAnswer: item.idiom },
  };
}
