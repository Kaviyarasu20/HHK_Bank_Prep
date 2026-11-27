/**
 * Modular Banking Exam Fill in the Blanks Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. SINGLE_FILLER_VOCAB          — Single contextual vocabulary filler
 * 2. DOUBLE_FILLER                — Paired double fillers (word1 / word2)
 * 3. GRAMMAR_PREPOSITION_FILLER   — Fixed prepositions, phrasal verbs & grammar slots
 * 4. DUAL_SENTENCE_COMMON_FILLER  — Single polysemous word fitting BOTH sentences (PO Mains)
 * 5. CONNECTOR_TRANSITION_FILLER  — Logical discourse connectors & transitions (PO Mains)
 */

export const FILL_BLANKS_SUBTOPICS = {
  SINGLE_FILLER_VOCAB: "Single Contextual Vocabulary Filler",
  DOUBLE_FILLER: "Double Fillers (Paired Words)",
  GRAMMAR_PREPOSITION_FILLER: "Grammar, Prepositions & Phrasal Verbs",
  DUAL_SENTENCE_COMMON_FILLER: "Dual-Sentence Common-Word Filler (Mains)",
  CONNECTOR_TRANSITION_FILLER: "Logical Connector & Transition Filler (Mains)",
};

export function createFillRng(seedInput) {
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

const BANKS = ["the public sector bank", "the regional lender", "the commercial bank", "the apex financial regulator"];
const CITIES = ["Mumbai", "Chennai", "Bengaluru", "Hyderabad", "Pune", "Kolkata"];

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

// 1. Single Contextual Vocabulary Fillers
const SINGLE_VOCAB_ITEMS = [
  {
    build: (b) => `To safeguard retail depositors from phishing scams, ${b} has deployed a _____ fraud-detection engine that flags unusual transfers within milliseconds.`,
    answer: "proactive",
    distractors: ["complacent", "negligent", "obsolete", "reluctant"],
    reason: "'proactive' accurately describes a system that detects and stops threats in advance.",
  },
  {
    build: (b) => `Despite global market volatility, ${b} posted a _____ quarterly profit driven by steady retail loan growth and lower provisioning costs.`,
    answer: "resilient",
    distractors: ["fragile", "erratic", "dubious", "trivial"],
    reason: "'resilient' fits maintaining strong profit despite external volatility.",
  },
  {
    build: (_b, c) => `The new automated clearing system in ${c} has significantly _____ the time required to settle interbank commercial cheques.`,
    answer: "curtailed",
    distractors: ["prolonged", "inflated", "obstructed", "aggravated"],
    reason: "'curtailed' (reduced/cut short) fits lowering settlement time.",
  },
  {
    build: (b) => `Auditors emphasized that _____ disclosure of non-performing assets is essential for maintaining investor confidence in ${b}.`,
    answer: "transparent",
    distractors: ["opaque", "secretive", "ambiguous", "evasive"],
    reason: "'transparent' (open and clear) is the exact collocation for regulatory financial disclosures.",
  },
  {
    build: (_b, c) => `Small textile exporters in ${c} welcomed the credit-guarantee scheme, noting that it would _____ their working-capital stress during peak shipping months.`,
    answer: "alleviate",
    distractors: ["intensify", "provoke", "compound", "magnify"],
    reason: "'alleviate' (ease/relieve) fits reducing working-capital stress.",
  },
  {
    build: (b) => `The committee recommended a _____ rollout of the new core-banking software so that any technical glitches could be resolved before nationwide adoption.`,
    answer: "phased",
    distractors: ["hasty", "reckless", "abrupt", "chaotic"],
    reason: "'phased' (gradual, stage-by-stage) matches testing before nationwide adoption.",
  },
];

// 2. Double Fillers (Paired Words)
const DOUBLE_FILLER_ITEMS = [
  {
    build: (b) => `By raising the benchmark repo rate, the central bank aims to _____ persistent retail inflation while ensuring ${b} maintains adequate _____ for productive sectors.`,
    answer: "curb / liquidity",
    distractors: ["curb / insolvency", "fuel / liquidity", "ignore / scarcity", "provoke / deficit"],
    reason: "A repo rate hike seeks to 'curb' inflation while preserving 'liquidity' for productive lending.",
  },
  {
    build: (_b, c) => `Although digital payment adoption in ${c} has _____ rapidly, rural branches still play a _____ role in assisting first-time borrowers with documentation.`,
    answer: "expanded / pivotal",
    distractors: ["expanded / redundant", "shrunk / pivotal", "stalled / trivial", "declined / marginal"],
    reason: "Contrast ('Although') pairs rapid digital growth ('expanded') with the continuing 'pivotal' role of rural branches.",
  },
  {
    build: (b) => `Internal auditors warned that _____ oversight of third-party vendors could _____ ${b} to severe data-breach penalties.`,
    answer: "lax / expose",
    distractors: ["lax / shield", "strict / expose", "rigorous / blind", "diligent / trap"],
    reason: "'lax' (careless/weak) oversight would 'expose' the institution to penalties.",
  },
  {
    build: (_b, c) => `Timely monsoon rains across ${c} have _____ agricultural output, thereby helping to _____ food-price pressures in urban markets.`,
    answer: "boosted / moderate",
    distractors: ["boosted / aggravate", "damaged / moderate", "halted / inflame", "reduced / escalate"],
    reason: "Good rains have 'boosted' farm output, which helps 'moderate' (ease) food-price inflation.",
  },
  {
    build: (b) => `To _____ operational efficiency, ${b} decided to _____ repetitive manual ledger checks with automated reconciliation software.`,
    answer: "enhance / replace",
    distractors: ["enhance / preserve", "undermine / replace", "delay / duplicate", "weaken / expand"],
    reason: "To 'enhance' efficiency, manual checks are 'replaced' with automated software.",
  },
];

// 3. Grammar, Prepositions & Phrasal Verbs
const GRAMMAR_PREP_ITEMS = [
  {
    build: (b) => `Every scheduled commercial institution must strictly abide _____ the capital adequacy guidelines issued by ${b}.`,
    answer: "by",
    distractors: ["with", "to", "for", "from"],
    reason: "The fixed phrasal verb is always 'abide by' (follow/obey rules).",
  },
  {
    build: (b) => `All payment aggregators operating in India are required to comply _____ the latest data-localization directives of ${b}.`,
    answer: "with",
    distractors: ["by", "to", "upon", "against"],
    reason: "'comply' always takes the preposition 'with'.",
  },
  {
    build: () => `Customers are strongly advised to refrain _____ clicking on unverified KYC-update links received via SMS.`,
    answer: "from",
    distractors: ["to", "against", "of", "with"],
    reason: "'refrain' is always followed by 'from + gerund (-ing)'.",
  },
  {
    build: (b) => `Due to severe weather warnings across coastal districts, ${b} had to call _____ its outdoor financial-literacy camp.`,
    answer: "off",
    distractors: ["out", "up", "in", "over"],
    reason: "'call off' means to cancel an event.",
  },
  {
    build: (_b, c) => `The sudden surge in overdue credit-card balances in ${c} largely stems _____ unchecked unsecured lending over the past year.`,
    answer: "from",
    distractors: ["with", "into", "over", "by"],
    reason: "'stem from' means to originate or arise from a cause.",
  },
  {
    build: (b) => `Senior management held the regional compliance team directly accountable _____ the delayed regulatory filing at ${b}.`,
    answer: "for",
    distractors: ["to", "with", "about", "by"],
    reason: "You are 'accountable for' an outcome/action (and 'accountable to' a person/authority).",
  },
];

// 4. Dual-Sentence Common-Word Filler (PO Mains — polysemous banking/editorial words)
const DUAL_SENTENCE_ITEMS = [
  {
    s1: "The central bank maintained an adequate foreign-exchange _____ to cushion the currency against external shocks.",
    s2: "Managers decided to _____ two seats in the front row for the visiting statutory auditors.",
    answer: "reserve",
    distractors: ["deposit", "ledger", "credit", "margin"],
    reason: "'reserve' works as a noun ('foreign-exchange reserve') in Sentence I and as a verb ('reserve two seats') in Sentence II.",
  },
  {
    s1: "Higher benchmark _____ rates have made fixed deposits more attractive to retired households.",
    s2: "The fintech startup attracted strong _____ from domestic venture-capital funds during its Series B round.",
    answer: "interest",
    distractors: ["dividend", "equity", "yield", "principal"],
    reason: "'interest' fits both 'interest rates' (finance) and 'attracted strong interest' (attention/curiosity).",
  },
  {
    s1: "The legal department reviewed the initial _____ of the interbank settlement agreement before circulating it to directors.",
    s2: "The supplier requested payment via a demand _____ payable at the Mumbai main branch.",
    answer: "draft",
    distractors: ["cheque", "memo", "clause", "voucher"],
    reason: "'draft' fits both 'initial draft of an agreement' and 'demand draft' (banking instrument).",
  },
  {
    s1: "Investors purchased ten-year sovereign green _____ issues to fund solar transmission corridors.",
    s2: "Shared community outreach programs helped strengthen the _____ between rural branches and local farmers.",
    answer: "bond",
    distractors: ["share", "stock", "grant", "pledge"],
    reason: "'bond' fits both 'green bond' (debt security) and 'strengthen the bond' (connection/tie).",
  },
  {
    s1: "The startup struggled to _____ its digital lending platform across twelve states without adding server latency.",
    s2: "The RBI revised the pay _____ for newly recruited assistant managers across regional offices.",
    answer: "scale",
    distractors: ["launch", "grade", "frame", "boost"],
    reason: "'scale' works as a verb ('scale its platform') in Sentence I and as a noun ('pay scale') in Sentence II.",
  },
  {
    s1: "The bank issued a formal _____ inviting bids from cybersecurity vendors for its annual penetration audit.",
    s2: "Currency notes issued by the central bank are recognized as legal _____ throughout the country.",
    answer: "tender",
    distractors: ["warrant", "notice", "charter", "permit"],
    reason: "'tender' fits both 'formal tender inviting bids' and 'legal tender' (official currency).",
  },
];

// 5. Logical Connector & Transition Filler (PO Mains)
const CONNECTOR_ITEMS = [
  {
    build: (b) => `Global crude oil prices rose sharply during the second quarter; _____, ${b} kept its domestic retail lending rates unchanged to support MSME recovery.`,
    answer: "nevertheless",
    distractors: ["consequently", "moreover", "similarly", "therefore"],
    reason: "The two clauses express a clear contrast, requiring a concessive transition ('nevertheless').",
  },
  {
    build: (_b, c) => `Heavy monsoon rains flooded key wholesale markets in ${c}; _____, retail prices of perishable vegetables jumped by twenty percent.`,
    answer: "consequently",
    distractors: ["however", "although", "whereas", "instead"],
    reason: "The second clause states the direct result of the first, requiring a causal connector ('consequently').",
  },
  {
    build: (b) => `${b} will waive the annual locker maintenance fee, _____ the customer maintains the stipulated minimum balance throughout the fiscal year.`,
    answer: "provided that",
    distractors: ["even though", "whereas", "otherwise", "despite"],
    reason: "'provided that' introduces the exact condition required for the fee waiver.",
  },
  {
    build: () => `Urban metro branches recorded a steep decline in cash-counter footfall, _____ rural branches continued to see steady over-the-counter deposit activity.`,
    answer: "whereas",
    distractors: ["because", "therefore", "unless", "moreover"],
    reason: "'whereas' contrasts two simultaneous opposite trends (urban decline vs. rural stability).",
  },
  {
    build: (b) => `_____ temporary server maintenance over the weekend, ${b}'s core payment gateways achieved 99.95% uptime across the quarter.`,
    answer: "Notwithstanding",
    distractors: ["Because of", "Owing to", "Furthermore", "Therefore"],
    reason: "'Notwithstanding' (in spite of) introduces the concession before a noun phrase ('temporary server maintenance').",
  },
];

export function buildFillBlanksQuestion({
  subtopicKey = "SINGLE_FILLER_VOCAB",
  difficulty = "Medium",
  rng,
}) {
  const bank = rng.pick(BANKS);
  const city = rng.pick(CITIES);

  if (subtopicKey === "DUAL_SENTENCE_COMMON_FILLER") {
    const item = rng.pick(DUAL_SENTENCE_ITEMS);
    const packed = shuffleOptionsWithAnswer(item.answer, item.distractors, rng);
    if (!packed) return null;

    const template = `I. ${item.s1}\nII. ${item.s2}`;
    const questionText =
      `Directions: Two sentences with one blank each are given below. Choose the single word from the options that can fit BOTH blanks grammatically and contextually.\n\n` +
      `${template}`;

    return {
      topic: "Fill in the Blanks",
      subType: "DUAL_SENTENCE_COMMON_FILLER",
      subtopicName: FILL_BLANKS_SUBTOPICS.DUAL_SENTENCE_COMMON_FILLER,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `Correct word: '${item.answer}'. ${item.reason}`,
      _meta: {
        subType: "DUAL_SENTENCE_COMMON_FILLER",
        template,
        expectedBlankCount: 2,
        expectedAnswer: item.answer,
      },
    };
  }

  const pools = {
    SINGLE_FILLER_VOCAB: { list: SINGLE_VOCAB_ITEMS, blanks: 1, dir: "Select the most appropriate word to fill in the blank and make the sentence grammatically and contextually meaningful." },
    DOUBLE_FILLER: { list: DOUBLE_FILLER_ITEMS, blanks: 2, dir: "Select the most appropriate pair of words to fill in the two blanks in the sentence below." },
    GRAMMAR_PREPOSITION_FILLER: { list: GRAMMAR_PREP_ITEMS, blanks: 1, dir: "Select the grammatically correct preposition/word to complete the sentence below." },
    CONNECTOR_TRANSITION_FILLER: { list: CONNECTOR_ITEMS, blanks: 1, dir: "Select the most appropriate logical connector/transition to fill in the blank." },
  };

  const cfg = pools[subtopicKey] || pools.SINGLE_FILLER_VOCAB;
  const item = rng.pick(cfg.list);
  const template = item.build(bank, city);
  const packed = shuffleOptionsWithAnswer(item.answer, item.distractors, rng);
  if (!packed) return null;

  const questionText = `Directions: ${cfg.dir}\n\n${template}`;

  return {
    topic: "Fill in the Blanks",
    subType: subtopicKey,
    subtopicName: FILL_BLANKS_SUBTOPICS[subtopicKey] || FILL_BLANKS_SUBTOPICS.SINGLE_FILLER_VOCAB,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `Correct choice: '${item.answer}'. ${item.reason}`,
    _meta: {
      subType: subtopicKey,
      template,
      expectedBlankCount: cfg.blanks,
      expectedAnswer: item.answer,
    },
  };
}
