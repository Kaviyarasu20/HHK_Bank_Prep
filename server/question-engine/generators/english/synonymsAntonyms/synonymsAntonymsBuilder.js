/**
 * Modular Banking Exam Synonyms & Antonyms Question Builder
 *
 * Uses a curated high-frequency IBPS PO / SBI PO / RBI Grade B banking & editorial lexicon
 * across 5 authentic exam formats:
 * 1. CONTEXTUAL_SYNONYM         — Highlighted word in banking/editorial sentence (Most Similar)
 * 2. CONTEXTUAL_ANTONYM         — Highlighted word in banking/editorial sentence (Most Opposite)
 * 3. PAIR_SYNONYM_ANTONYM_MAINS — Choose exact (Synonym / Antonym) pair for highlighted word (PO Mains)
 * 4. SYNONYM_CLUSTER_OUTLIER    — 4 synonyms + 1 antonym ("Which is NOT a synonym?") (PO Mains)
 * 5. EDITORIAL_TONE_SYN_ANT     — 2-sentence editorial excerpt testing contextual synonym or antonym
 */

import { verifyLexiconEntry } from "./solver.js";

export const SYNONYMS_ANTONYMS_SUBTOPICS = {
  CONTEXTUAL_SYNONYM: "In-Context Sentence Synonym",
  CONTEXTUAL_ANTONYM: "In-Context Sentence Antonym",
  PAIR_SYNONYM_ANTONYM_MAINS: "Synonym–Antonym Pair Selection (Mains)",
  SYNONYM_CLUSTER_OUTLIER: "Non-Synonym Outlier Identification (Mains)",
  EDITORIAL_TONE_SYN_ANT: "Editorial Context Synonym & Antonym",
};

export function createSynAntRng(seedInput) {
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

/**
 * High-frequency IBPS PO / SBI PO / RBI Grade B Editorial & Banking Vocabulary Bank
 * Each entry has:
 * - word, pos ("ADJ"|"VERB"|"NOUN"), level ("Easy"|"Medium"|"Hard")
 * - sentence (banking/economic editorial context with [WORD])
 * - meaning
 * - 4 verified synonyms, 4 verified antonyms (strictly disjoint)
 */
const LEXICON = [
  {
    word: "PRUDENT",
    pos: "ADJ",
    level: "Medium",
    sentence: "The central bank adopted a [PRUDENT] monetary stance to guard against imported inflation while supporting rural credit.",
    meaning: "acting with or showing care, foresight, and sound judgment",
    synonyms: ["judicious", "cautious", "sensible", "discreet"],
    antonyms: ["reckless", "imprudent", "rash", "careless"],
  },
  {
    word: "MITIGATE",
    pos: "VERB",
    level: "Medium",
    sentence: "Diversifying loan portfolios across sectors helps commercial banks [MITIGATE] the risk of sudden regional defaults.",
    meaning: "to make less severe, serious, or painful",
    synonyms: ["alleviate", "lessen", "moderate", "cushion"],
    antonyms: ["aggravate", "intensify", "worsen", "exacerbate"],
  },
  {
    word: "BOLSTER",
    pos: "VERB",
    level: "Medium",
    sentence: "Fresh tier-1 equity infusions were approved to [BOLSTER] the capital adequacy ratio of regional public lenders.",
    meaning: "to support, strengthen, or reinforce",
    synonyms: ["strengthen", "reinforce", "fortify", "buttress"],
    antonyms: ["undermine", "weaken", "erode", "diminish"],
  },
  {
    word: "RESILIENT",
    pos: "ADJ",
    level: "Easy",
    sentence: "Domestic retail deposits remained remarkably [RESILIENT] despite sharp fluctuations in global equity markets.",
    meaning: "able to withstand or recover quickly from difficult conditions",
    synonyms: ["sturdy", "robust", "durable", "buoyant"],
    antonyms: ["fragile", "vulnerable", "brittle", "weak"],
  },
  {
    word: "CURTAIL",
    pos: "VERB",
    level: "Medium",
    sentence: "Automated document checks enabled branches to [CURTAIL] average loan-processing turnaround times by nearly half.",
    meaning: "to reduce in extent or quantity; to cut short",
    synonyms: ["reduce", "trim", "abridge", "shorten"],
    antonyms: ["prolong", "extend", "expand", "lengthen"],
  },
  {
    word: "TRANSPARENT",
    pos: "ADJ",
    level: "Easy",
    sentence: "Regulators insisted on [TRANSPARENT] disclosure of restructured loans so depositors could assess balance-sheet health.",
    meaning: "open, clear, and easy to perceive or verify",
    synonyms: ["candid", "lucid", "open", "forthright"],
    antonyms: ["opaque", "secretive", "obscure", "evasive"],
  },
  {
    word: "STIFLE",
    pos: "VERB",
    level: "Hard",
    sentence: "Economists warned that overly rigid compliance paperwork could [STIFLE] innovation among early-stage fintech startups.",
    meaning: "to restrain, suppress, or prevent from developing",
    synonyms: ["suppress", "curb", "hinder", "smother"],
    antonyms: ["foster", "encourage", "stimulate", "nurture"],
  },
  {
    word: "SCRUTINIZE",
    pos: "VERB",
    level: "Medium",
    sentence: "Forensic auditors will [SCRUTINIZE] high-value corporate credit accounts flagged by the early-warning system.",
    meaning: "to examine or inspect closely and thoroughly",
    synonyms: ["inspect", "examine", "investigate", "audit"],
    antonyms: ["overlook", "neglect", "ignore", "disregard"],
  },
  {
    word: "VOLATILE",
    pos: "ADJ",
    level: "Easy",
    sentence: "Exporters hedged their currency exposure to protect earnings from [VOLATILE] foreign-exchange swings.",
    meaning: "liable to change rapidly and unpredictably",
    synonyms: ["unstable", "erratic", "unpredictable", "turbulent"],
    antonyms: ["stable", "steady", "constant", "predictable"],
  },
  {
    word: "STRINGENT",
    pos: "ADJ",
    level: "Medium",
    sentence: "The regulator introduced [STRINGENT] cybersecurity norms requiring real-time incident reporting within six hours.",
    meaning: "strict, precise, and exacting",
    synonyms: ["strict", "rigorous", "severe", "exacting"],
    antonyms: ["lenient", "lax", "permissive", "mild"],
  },
  {
    word: "LUCRATIVE",
    pos: "ADJ",
    level: "Easy",
    sentence: "Wealth-management advisory services have become a highly [LUCRATIVE] fee-income vertical for private banks.",
    meaning: "producing a great deal of profit",
    synonyms: ["profitable", "remunerative", "gainful", "rewarding"],
    antonyms: ["unprofitable", "loss-making", "unrewarding", "barren"],
  },
  {
    word: "OBSOLETE",
    pos: "ADJ",
    level: "Easy",
    sentence: "Instant mobile transfers have rendered manual paper passbook queues largely [OBSOLETE] in metropolitan branches.",
    meaning: "no longer produced or used; out of date",
    synonyms: ["outdated", "antiquated", "archaic", "defunct"],
    antonyms: ["modern", "contemporary", "current", "up-to-date"],
  },
  {
    word: "ALLEVIATE",
    pos: "VERB",
    level: "Medium",
    sentence: "Emergency working-capital credit lines were extended to [ALLEVIATE] liquidity pressure on small dairy cooperatives.",
    meaning: "to make suffering, deficiency, or a problem less severe",
    synonyms: ["relieve", "ease", "soothe", "assuage"],
    antonyms: ["aggravate", "worsen", "intensify", "heighten"],
  },
  {
    word: "EXACERBATE",
    pos: "VERB",
    level: "Hard",
    sentence: "Unseasonal heavy rainfall could [EXACERBATE] rural supply-chain bottlenecks and push wholesale vegetable prices higher.",
    meaning: "to make a problem, bad situation, or negative feeling worse",
    synonyms: ["worsen", "aggravate", "compound", "intensify"],
    antonyms: ["ameliorate", "alleviate", "ease", "mitigate"],
  },
  {
    word: "AMBIGUOUS",
    pos: "ADJ",
    level: "Medium",
    sentence: "The banking ombudsman directed lenders to rewrite [AMBIGUOUS] penalty clauses in retail credit-card agreements.",
    meaning: "open to more than one interpretation; unclear",
    synonyms: ["vague", "unclear", "equivocal", "obscure"],
    antonyms: ["explicit", "unambiguous", "clear", "precise"],
  },
  {
    word: "COMPLACENT",
    pos: "ADJ",
    level: "Hard",
    sentence: "Board members cautioned IT teams against becoming [COMPLACENT] after passing a single quarterly phishing drill.",
    meaning: "showing uncritical satisfaction with oneself while unaware of potential danger",
    synonyms: ["smug", "self-satisfied", "unconcerned", "lax"],
    antonyms: ["vigilant", "watchful", "alert", "attentive"],
  },
  {
    word: "PROLIFERATE",
    pos: "VERB",
    level: "Hard",
    sentence: "QR-based digital payment points continue to [PROLIFERATE] rapidly across semi-urban markets and rural mandis.",
    meaning: "to increase rapidly in numbers; multiply",
    synonyms: ["multiply", "expand", "mushroom", "burgeon"],
    antonyms: ["dwindle", "shrink", "decline", "diminish"],
  },
  {
    word: "PRAGMATIC",
    pos: "ADJ",
    level: "Hard",
    sentence: "The committee proposed a [PRAGMATIC] phased schedule for transitioning cooperative banks onto core-banking clouds.",
    meaning: "dealing with things sensibly and realistically",
    synonyms: ["practical", "realistic", "sensible", "matter-of-fact"],
    antonyms: ["impractical", "idealistic", "unrealistic", "quixotic"],
  },
  {
    word: "DISCREPANCY",
    pos: "NOUN",
    level: "Medium",
    sentence: "Automated reconciliation immediately flagged a minor [DISCREPANCY] between the branch vault ledger and ATM cash logs.",
    meaning: "an illogical or surprising lack of compatibility or similarity between two facts",
    synonyms: ["mismatch", "inconsistency", "variance", "divergence"],
    antonyms: ["consistency", "agreement", "harmony", "concordance"],
  },
  {
    word: "AUSTERITY",
    pos: "NOUN",
    level: "Hard",
    sentence: "Following consecutive fiscal deficits, the municipality introduced strict [AUSTERITY] measures across non-essential departments.",
    meaning: "sternness or severity of manner, or difficult economic conditions created by spending cuts",
    synonyms: ["frugality", "thrift", "restraint", "economy"],
    antonyms: ["extravagance", "lavishness", "opulence", "profligacy"],
  },
];

// Neutral same-POS distractors guaranteed not to collide with synonyms/antonyms of unrelated entries
const NEUTRAL_DISTRACTORS = {
  ADJ: ["annual", "regional", "coastal", "numerical", "metallic", "seasonal", "vertical", "acoustic", "domestic", "thermal"],
  VERB: ["compile", "translate", "navigate", "illustrate", "broadcast", "calculate", "assemble", "transport", "archive", "measure"],
  NOUN: ["corridor", "calendar", "diagram", "blueprint", "inventory", "directory", "schedule", "monument", "station", "catalog"],
};

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

function pickLexiconEntry(difficulty, rng) {
  const valid = LEXICON.filter(verifyLexiconEntry);
  if (difficulty === "Easy") {
    const easy = valid.filter((e) => e.level === "Easy" || e.level === "Medium");
    return rng.pick(easy);
  }
  if (difficulty === "Hard") {
    const hard = valid.filter((e) => e.level === "Hard" || e.level === "Medium");
    return rng.pick(hard);
  }
  return rng.pick(valid);
}

export function buildSynonymAntonymQuestion({
  subtopicKey = "CONTEXTUAL_SYNONYM",
  difficulty = "Medium",
  rng,
}) {
  const entry = pickLexiconEntry(difficulty, rng);
  const synSet = new Set(entry.synonyms.map((s) => s.toLowerCase()));
  const antSet = new Set(entry.antonyms.map((a) => a.toLowerCase()));
  const neutrals = rng.shuffle(NEUTRAL_DISTRACTORS[entry.pos] || NEUTRAL_DISTRACTORS.ADJ).filter(
    (w) => !synSet.has(w.toLowerCase()) && !antSet.has(w.toLowerCase()),
  );

  // 1. In-Context Sentence Synonym
  if (subtopicKey === "CONTEXTUAL_SYNONYM") {
    const answer = rng.pick(entry.synonyms);
    const antonymTrap = rng.pick(entry.antonyms);
    const distractors = [antonymTrap, ...neutrals.slice(0, 3)];
    const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Choose the word that is MOST SIMILAR in meaning to the highlighted word as used in the sentence below.\n\n` +
      `${entry.sentence}`;

    return {
      topic: "Synonyms & Antonyms",
      subType: "CONTEXTUAL_SYNONYM",
      subtopicName: SYNONYMS_ANTONYMS_SUBTOPICS.CONTEXTUAL_SYNONYM,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${entry.word}' means "${entry.meaning}". Its closest contextual synonym among the choices is '${answer}' (note: '${antonymTrap}' is an antonym).`,
      _meta: { subType: "CONTEXTUAL_SYNONYM", mode: "CONTEXTUAL_SYNONYM", entry },
    };
  }

  // 2. In-Context Sentence Antonym
  if (subtopicKey === "CONTEXTUAL_ANTONYM") {
    const answer = rng.pick(entry.antonyms);
    const synonymTrap = rng.pick(entry.synonyms);
    const distractors = [synonymTrap, ...neutrals.slice(0, 3)];
    const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Choose the word that is MOST OPPOSITE in meaning to the highlighted word as used in the sentence below.\n\n` +
      `${entry.sentence}`;

    return {
      topic: "Synonyms & Antonyms",
      subType: "CONTEXTUAL_ANTONYM",
      subtopicName: SYNONYMS_ANTONYMS_SUBTOPICS.CONTEXTUAL_ANTONYM,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${entry.word}' means "${entry.meaning}". Its direct contextual antonym is '${answer}' (note: '${synonymTrap}' is a synonym).`,
      _meta: { subType: "CONTEXTUAL_ANTONYM", mode: "CONTEXTUAL_ANTONYM", entry },
    };
  }

  // 3. Synonym–Antonym Pair Selection (PO Mains)
  if (subtopicKey === "PAIR_SYNONYM_ANTONYM_MAINS") {
    const [s1, s2] = rng.shuffle(entry.synonyms);
    const [a1, a2] = rng.shuffle(entry.antonyms);
    const [n1, n2] = neutrals;

    const correctPair = `${s1} / ${a1}`;
    const distractors = [
      `${a1} / ${s1}`, // reversed order trap!
      `${s1} / ${s2}`, // both synonyms
      `${a1} / ${a2}`, // both antonyms
      `${n1} / ${n2}`, // both unrelated
    ];
    const packed = shuffleOptionsWithAnswer(correctPair, distractors, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Read the sentence below and choose the option that gives the SYNONYM and ANTONYM (in that exact order) of the highlighted word.\n\n` +
      `${entry.sentence}`;

    return {
      topic: "Synonyms & Antonyms",
      subType: "PAIR_SYNONYM_ANTONYM_MAINS",
      subtopicName: SYNONYMS_ANTONYMS_SUBTOPICS.PAIR_SYNONYM_ANTONYM_MAINS,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${entry.word}' means "${entry.meaning}". '${s1}' is its synonym and '${a1}' is its antonym, making '${correctPair}' the only valid (Synonym / Antonym) pair.`,
      _meta: { subType: "PAIR_SYNONYM_ANTONYM_MAINS", mode: "PAIR_SYNONYM_ANTONYM_MAINS", entry },
    };
  }

  // 4. Non-Synonym Outlier Identification (PO Mains: 4 synonyms + 1 antonym)
  if (subtopicKey === "SYNONYM_CLUSTER_OUTLIER") {
    const fourSyns = rng.shuffle(entry.synonyms).slice(0, 4);
    const oddAnt = rng.pick(entry.antonyms);
    const packed = shuffleOptionsWithAnswer(oddAnt, fourSyns, rng);
    if (!packed) return null;

    const questionText =
      `Directions: Four of the five options below are synonyms of the highlighted word in the sentence, while ONE option is opposite in meaning. Identify the word that is NOT a synonym of the highlighted word.\n\n` +
      `${entry.sentence}`;

    return {
      topic: "Synonyms & Antonyms",
      subType: "SYNONYM_CLUSTER_OUTLIER",
      subtopicName: SYNONYMS_ANTONYMS_SUBTOPICS.SYNONYM_CLUSTER_OUTLIER,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation: `'${entry.word}' means "${entry.meaning}". Four options (${fourSyns.join(", ")}) are synonyms of '${entry.word}', whereas '${oddAnt}' is an antonym.`,
      _meta: { subType: "SYNONYM_CLUSTER_OUTLIER", mode: "SYNONYM_CLUSTER_OUTLIER", entry },
    };
  }

  // 5. Editorial Tone Synonym & Antonym (2-sentence context)
  const askOpposite = rng() < 0.5;
  const answer = askOpposite ? rng.pick(entry.antonyms) : rng.pick(entry.synonyms);
  const trap = askOpposite ? rng.pick(entry.synonyms) : rng.pick(entry.antonyms);
  const distractors = [trap, ...neutrals.slice(0, 3)];
  const packed = shuffleOptionsWithAnswer(answer, distractors, rng);
  if (!packed) return null;

  const mode = askOpposite ? "DUAL_CONTEXT_ANT" : "DUAL_CONTEXT_SYN";
  const intent = askOpposite
    ? "MOST OPPOSITE in meaning to"
    : "CLOSEST in meaning to";

  const questionText =
    `Directions: Read the editorial excerpt carefully and choose the word that is ${intent} the highlighted word [${entry.word}].\n\n` +
    `Excerpt: ${entry.sentence} Policy analysts emphasized that this approach will shape institutional performance over the coming fiscal quarters.`;

  return {
    topic: "Synonyms & Antonyms",
    subType: "EDITORIAL_TONE_SYN_ANT",
    subtopicName: SYNONYMS_ANTONYMS_SUBTOPICS.EDITORIAL_TONE_SYN_ANT,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `In this editorial context, '${entry.word}' means "${entry.meaning}". The word ${intent.toLowerCase()} it is '${answer}'.`,
    _meta: { subType: "EDITORIAL_TONE_SYN_ANT", mode, entry },
  };
}
