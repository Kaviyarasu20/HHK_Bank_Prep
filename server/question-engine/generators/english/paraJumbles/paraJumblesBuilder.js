/**
 * Modular Banking Exam Para Jumbles Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. FIVE_SENTENCE_SEQUENCE       — 5 jumbled sentences (A–E), identify full coherent order
 * 2. POSITIONAL_SENTENCE_QUERY    — Identify 1st / 2nd / 3rd / Last sentence after rearrangement
 * 3. FIXED_ANCHOR_PARAJUMBLE      — Fixed S1 and S6 anchors with 4 jumbled middle sentences (P–S)
 * 4. ODD_SENTENCE_OUT_PARAJUMBLE  — Identify the 1 thematic outlier among 5 sentences (PO Mains)
 * 5. MANDATORY_PAIR_PARAJUMBLE    — Identify the consecutive pair that must follow in sequence
 */

import { buildJumbledMapping } from "./solver.js";

export const PARA_JUMBLES_SUBTOPICS = {
  FIVE_SENTENCE_SEQUENCE: "5-Sentence Complete Rearrangement",
  POSITIONAL_SENTENCE_QUERY: "Positional Sentence Identification (1st/2nd/Last)",
  FIXED_ANCHOR_PARAJUMBLE: "Fixed-Anchor (S1–S6) Rearrangement",
  ODD_SENTENCE_OUT_PARAJUMBLE: "Odd-Sentence-Out Para Jumble (Mains)",
  MANDATORY_PAIR_PARAJUMBLE: "Mandatory Consecutive Pair Identification",
};

export function createPjRng(seedInput) {
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
 * Cohesive banking/economic/editorial paragraph blueprints.
 * Each has 6 ordered sentences (so we can slice 5 for standard Para Jumbles OR use S1..S6 for Fixed-Anchor!)
 * plus a strictly off-topic `oddSentence` for PO Mains Odd-Sentence-Out!
 */
const PARAGRAPHS = [
  {
    id: "UPI_GROWTH",
    theme: "Unified Payments Interface and rural financial inclusion",
    sentences: [
      "Over the past decade, India's Unified Payments Interface (UPI) has reshaped everyday retail transactions across both cities and villages.",
      "Previously, small shopkeepers relied almost exclusively on cash because card-swiping terminals carried steep monthly rental charges.",
      "By eliminating merchant onboarding fees and enabling instant QR-code transfers, UPI removed that major cost barrier.",
      "As a result, millions of street vendors and micro-enterprises began building digital sales records for the very first time.",
      "Banks now leverage these verifiable digital cash-flow histories to extend formal working-capital loans without demanding heavy collateral.",
      "Consequently, instant mobile payments have evolved from a mere convenience into a foundational bridge for formal credit inclusion.",
    ],
    oddSentence:
      "Astronomers recently catalogued three new exoplanets orbiting a distant red-dwarf star using infrared space telescopes.",
  },
  {
    id: "MONETARY_POLICY",
    theme: "Central bank inflation targeting and monetary transmission",
    sentences: [
      "Maintaining low and stable retail inflation is the primary statutory mandate of India's Monetary Policy Committee.",
      "Whenever supply shocks push food and fuel prices sharply higher, household purchasing power erodes rapidly.",
      "To anchor inflation expectations in such periods, the central bank raises its benchmark policy repo rate.",
      "This rate hike increases short-term borrowing costs for commercial banks, prompting them to adjust lending and deposit rates upward.",
      "Although tighter credit temporarily cools discretionary demand, it prevents price pressures from becoming permanently entrenched.",
      "Over the medium term, credible price stability creates the predictable macroeconomic environment required for durable private investment.",
    ],
    oddSentence:
      "Classical Carnatic violin recitals traditionally begin with a brief rhythmic improvisation known as a varnam.",
  },
  {
    id: "GREEN_BONDS",
    theme: "Sovereign green bonds and renewable energy financing",
    sentences: [
      "Meeting India's ambitious clean-energy targets requires massive long-term financing for solar parks, wind farms, and grid-scale storage.",
      "Traditional commercial bank deposits, however, are largely short-term in maturity and poorly matched to twenty-year infrastructure projects.",
      "To bridge this asset-liability mismatch, governments and development institutions have increasingly turned to sovereign green bonds.",
      "These dedicated debt instruments channel global institutional capital directly into projects with verified carbon-reduction milestones.",
      "Strict third-party reporting norms ensure that proceeds are not diverted toward unrelated general expenditure.",
      "With rising global investor appetite for sustainable assets, green bonds are rapidly becoming a mainstream pillar of infrastructure finance.",
    ],
    oddSentence:
      "Migratory flamingos travel thousands of kilometers each winter to nest in shallow coastal salt marshes.",
  },
  {
    id: "CYBER_RESILIENCE",
    theme: "Zero-trust cybersecurity in modern digital banking",
    sentences: [
      "As commercial banks shift core payment systems to cloud platforms, cyber threats have grown far more automated and persistent.",
      "Historically, financial institutions depended heavily on perimeter firewalls that trusted any user already inside the office network.",
      "Modern phishing campaigns easily bypass those static defenses by stealing legitimate employee credentials.",
      "In response, banking security teams are adopting zero-trust frameworks that continuously verify every device and login request.",
      "Alongside technical controls, mandatory quarterly phishing drills train frontline staff to report suspicious attachments immediately.",
      "Together, continuous verification and employee vigilance form the twin pillars of institutional cyber resilience.",
    ],
    oddSentence:
      "Botanists discovered that certain alpine wildflowers bloom earlier when winter snowpacks melt ahead of schedule.",
  },
  {
    id: "MSME_TREDS",
    theme: "Invoice discounting and MSME working-capital relief",
    sentences: [
      "Micro, small, and medium enterprises account for a vital share of India's manufacturing output and regional employment.",
      "Despite their economic importance, many small suppliers struggle when large corporate buyers delay invoice payments beyond ninety days.",
      "Such prolonged receivable cycles starve entrepreneurs of the cash needed to purchase raw materials and pay monthly wages.",
      "Regulated electronic invoice-discounting platforms solve this liquidity crunch by letting multiple financiers bid on verified bills.",
      "Once a bid is accepted, the small supplier receives immediate working capital at competitive interest rates while the buyer pays at maturity.",
      "Wider corporate participation on these platforms therefore strengthens both supply-chain stability and small-business growth.",
    ],
    oddSentence:
      "Deep-sea hydrothermal vents support unique marine ecosystems that thrive without any sunlight.",
  },
  {
    id: "BRANCH_TRANSFORMATION",
    theme: "Evolution of physical bank branches into advisory hubs",
    sentences: [
      "Rapid growth in mobile banking has dramatically reduced the number of routine cash and passbook visits at urban bank branches.",
      "Some industry observers initially predicted that physical bank branches would soon become completely obsolete.",
      "Yet customer surveys consistently show that households still prefer face-to-face guidance for complex financial decisions like home loans and retirement planning.",
      "Recognizing this shift, leading banks are redesigning branches with self-service kiosks for routine tasks and dedicated desks for personal wealth advice.",
      "Frontline staff are simultaneously being reskilled from manual data-entry clerks into certified financial relationship advisors.",
      "Far from disappearing, the modern branch is thus evolving into a high-value advisory hub complementing digital channels.",
    ],
    oddSentence:
      "Archaeologists unearthed bronze coins dating back to the third century during excavations near an ancient river port.",
  },
];

function nonIdentityPermutation(n, rng) {
  const base = Array.from({ length: n }, (_, i) => i);
  let perm = rng.shuffle(base);
  let tries = 0;
  while (perm.every((v, i) => v === i) && tries < 10) {
    perm = rng.shuffle(base);
    tries += 1;
  }
  return perm;
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

function makeSequenceDistractors(correctOrder, rng) {
  const correctStr = correctOrder.join("-");
  const out = [];
  const seen = new Set([correctStr]);
  for (let tries = 0; tries < 40 && out.length < 4; tries++) {
    const arr = [...correctOrder];
    if (tries % 2 === 0) {
      // Swap two adjacent labels for a realistic close distractor
      const i = rng.int(0, arr.length - 2);
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    } else {
      // Swap two arbitrary labels
      const i = rng.int(0, arr.length - 1);
      const j = rng.int(0, arr.length - 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const s = arr.join("-");
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function buildParaJumblesQuestion({
  subtopicKey = "FIVE_SENTENCE_SEQUENCE",
  difficulty = "Medium",
  rng,
}) {
  const para = rng.pick(PARAGRAPHS);

  // 1. 5-Sentence Complete Sequence
  if (subtopicKey === "FIVE_SENTENCE_SEQUENCE") {
    const ordered = para.sentences.slice(0, 5);
    const perm = nonIdentityPermutation(5, rng);
    const mapping = buildJumbledMapping(ordered, perm, ["A", "B", "C", "D", "E"]);
    const distractors = makeSequenceDistractors(mapping.correctLabelOrder, rng);
    const packed = shuffleOptionsWithAnswer(mapping.correctSequenceStr, distractors, rng);
    if (!packed) return null;

    const block = mapping.displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");
    const questionText =
      `Directions: Rearrange the following five sentences (A), (B), (C), (D), and (E) in the proper sequence to form a meaningful and coherent paragraph.\n\n` +
      `${block}\n\n` +
      `Which of the following is the correct sequence after rearrangement?`;

    const explanation =
      `Logical flow (${para.theme}): ${mapping.correctSequenceStr}. Sentence (${mapping.correctLabelOrder[0]}) introduces the core theme, followed sequentially by (${mapping.correctLabelOrder.slice(1).join(") → (")}).`;

    return {
      topic: "Para Jumbles",
      subType: "FIVE_SENTENCE_SEQUENCE",
      subtopicName: PARA_JUMBLES_SUBTOPICS.FIVE_SENTENCE_SEQUENCE,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: {
        subType: "FIVE_SENTENCE_SEQUENCE",
        paraId: para.id,
        ordered,
        displayed: mapping.displayed,
        expected: mapping.correctSequenceStr,
      },
    };
  }

  // 2. Positional Sentence Identification (1st / 2nd / 3rd / Last)
  if (subtopicKey === "POSITIONAL_SENTENCE_QUERY") {
    const ordered = para.sentences.slice(0, 5);
    const perm = nonIdentityPermutation(5, rng);
    const mapping = buildJumbledMapping(ordered, perm, ["A", "B", "C", "D", "E"]);
    const posChoices = [
      { idx: 0, label: "FIRST" },
      { idx: 1, label: "SECOND" },
      { idx: 2, label: "THIRD" },
      { idx: 4, label: "LAST (FIFTH)" },
    ];
    const target = rng.pick(posChoices);
    const ansLabel = mapping.correctLabelOrder[target.idx];

    const options = ["A", "B", "C", "D", "E"];
    const correctIndex = options.indexOf(ansLabel);
    const block = mapping.displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");

    const questionText =
      `Directions: Rearrange the following five sentences (A), (B), (C), (D), and (E) in the proper sequence to form a coherent paragraph, and answer the question below.\n\n` +
      `${block}\n\n` +
      `Which of the following should be the ${target.label} sentence after rearrangement?`;

    const explanation =
      `The coherent sequence is ${mapping.correctSequenceStr}. Therefore, sentence (${ansLabel}) is the ${target.label.toLowerCase()} sentence.`;

    return {
      topic: "Para Jumbles",
      subType: "POSITIONAL_SENTENCE_QUERY",
      subtopicName: PARA_JUMBLES_SUBTOPICS.POSITIONAL_SENTENCE_QUERY,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: ansLabel,
      explanation,
      _meta: {
        subType: "POSITIONAL_SENTENCE_QUERY",
        paraId: para.id,
        ordered,
        displayed: mapping.displayed,
        targetIdx: target.idx,
        expected: ansLabel,
      },
    };
  }

  // 3. Fixed-Anchor S1–S6 Rearrangement
  if (subtopicKey === "FIXED_ANCHOR_PARAJUMBLE") {
    const s1 = para.sentences[0];
    const middleOrdered = para.sentences.slice(1, 5);
    const s6 = para.sentences[5];
    const perm = nonIdentityPermutation(4, rng);
    const mapping = buildJumbledMapping(middleOrdered, perm, ["P", "Q", "R", "S"]);
    const distractors = makeSequenceDistractors(mapping.correctLabelOrder, rng);
    const packed = shuffleOptionsWithAnswer(mapping.correctSequenceStr, distractors, rng);
    if (!packed) return null;

    const midBlock = mapping.displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");
    const questionText =
      `Directions: In the following question, the first sentence (S1) and the last sentence (S6) are fixed in their positions. Rearrange the four middle sentences (P), (Q), (R), and (S) to form a coherent paragraph.\n\n` +
      `S1: ${s1}\n` +
      `${midBlock}\n` +
      `S6: ${s6}\n\n` +
      `Which of the following is the correct sequence of the middle sentences?`;

    const explanation =
      `Bridging S1 to S6 cleanly requires the middle sequence ${mapping.correctSequenceStr}.`;

    return {
      topic: "Para Jumbles",
      subType: "FIXED_ANCHOR_PARAJUMBLE",
      subtopicName: PARA_JUMBLES_SUBTOPICS.FIXED_ANCHOR_PARAJUMBLE,
      difficulty,
      questionText,
      options: packed.options,
      correctIndex: packed.correctIndex,
      correctAnswer: packed.correctAnswer,
      explanation,
      _meta: {
        subType: "FIXED_ANCHOR_PARAJUMBLE",
        paraId: para.id,
        ordered: middleOrdered,
        displayed: mapping.displayed,
        expected: mapping.correctSequenceStr,
      },
    };
  }

  // 4. Odd-Sentence-Out Para Jumble (PO Mains)
  if (subtopicKey === "ODD_SENTENCE_OUT_PARAJUMBLE") {
    const fourCoherent = para.sentences.slice(0, 4);
    const allFive = [...fourCoherent, para.oddSentence];
    const perm = nonIdentityPermutation(5, rng);
    const labels = ["A", "B", "C", "D", "E"];
    const displayed = perm.map((canonIdx, slotIdx) => ({
      label: labels[slotIdx],
      isOdd: canonIdx === 4,
      text: allFive[canonIdx],
    }));

    const oddItem = displayed.find((d) => d.isOdd);
    const correctIndex = labels.indexOf(oddItem.label);
    const block = displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");

    const questionText =
      `Directions: Four of the five sentences below can be rearranged to form a coherent paragraph on a single theme, while one sentence does NOT fit the context. Identify the odd sentence out.\n\n` +
      `${block}\n\n` +
      `Which sentence is the odd one out?`;

    const explanation =
      `Four sentences form a coherent paragraph about ${para.theme}. Sentence (${oddItem.label}) introduces a completely unrelated topic and is therefore the odd sentence out.`;

    return {
      topic: "Para Jumbles",
      subType: "ODD_SENTENCE_OUT_PARAJUMBLE",
      subtopicName: PARA_JUMBLES_SUBTOPICS.ODD_SENTENCE_OUT_PARAJUMBLE,
      difficulty,
      questionText,
      options: labels,
      correctIndex,
      correctAnswer: oddItem.label,
      explanation,
      _meta: {
        subType: "ODD_SENTENCE_OUT_PARAJUMBLE",
        paraId: para.id,
        expected: oddItem.label,
      },
    };
  }

  // 5. Mandatory Consecutive Pair Identification
  const ordered = para.sentences.slice(0, 5);
  const perm = nonIdentityPermutation(5, rng);
  const mapping = buildJumbledMapping(ordered, perm, ["A", "B", "C", "D", "E"]);
  const validPairSet = new Set(mapping.mandatoryPairs);
  const targetPair = rng.pick(mapping.mandatoryPairs);

  // Build 4 strictly non-consecutive distractors
  const labels = ["A", "B", "C", "D", "E"];
  const invalidPairs = [];
  for (const x of labels) {
    for (const y of labels) {
      if (x === y) continue;
      const p = `${x}-${y}`;
      if (!validPairSet.has(p)) invalidPairs.push(p);
    }
  }
  const distractors = rng.shuffle(invalidPairs).slice(0, 4);
  const packed = shuffleOptionsWithAnswer(targetPair, distractors, rng);
  if (!packed) return null;

  const block = mapping.displayed.map((d) => `(${d.label}) ${d.text}`).join("\n");
  const questionText =
    `Directions: Rearrange the following five sentences (A)–(E) into a coherent paragraph. Identify which of the following pairs of sentences MUST occur consecutively in the exact order given.\n\n` +
    `${block}\n\n` +
    `Which of the following is a valid mandatory consecutive pair in the rearranged paragraph?`;

  const explanation =
    `The complete rearranged sequence is ${mapping.correctSequenceStr}. Among the choices, only '${targetPair}' appears as an immediately consecutive pair in this order.`;

  return {
    topic: "Para Jumbles",
    subType: "MANDATORY_PAIR_PARAJUMBLE",
    subtopicName: PARA_JUMBLES_SUBTOPICS.MANDATORY_PAIR_PARAJUMBLE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: "MANDATORY_PAIR_PARAJUMBLE",
      paraId: para.id,
      ordered,
      displayed: mapping.displayed,
      validPairs: mapping.mandatoryPairs,
      expected: targetPair,
    },
  };
}
