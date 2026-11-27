/**
 * Modular Banking Exam Cloze Test Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam Cloze Test subtopics:
 * 1. BANKING_DIGITAL_CLOZE   — Digital payments, UPI, financial inclusion & KYC
 * 2. ECONOMY_POLICY_CLOZE    — Monetary policy, inflation, MSME credit & exports
 * 3. CLIMATE_FINANCE_CLOZE   — Green bonds, renewable energy & sustainable lending
 * 4. GOVERNANCE_CYBER_CLOZE  — Bank audits, cybersecurity & operational resilience
 * 5. NEW_PATTERN_CLOZE       — PO Mains highlighted-word replacement + "No correction required"
 */

import {
  renderNewPatternClozePassage,
  renderStandardClozePassage,
} from "./solver.js";

export const CLOZE_SUBTOPICS = {
  BANKING_DIGITAL_CLOZE: "Banking & Digital Payments Cloze",
  ECONOMY_POLICY_CLOZE: "Macroeconomy & Monetary Policy Cloze",
  CLIMATE_FINANCE_CLOZE: "Climate & Green Finance Cloze",
  GOVERNANCE_CYBER_CLOZE: "Governance & Cybersecurity Cloze",
  NEW_PATTERN_CLOZE: "New-Pattern Highlighted-Word Cloze (Mains)",
};

export function createClozeRng(seedInput) {
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

const PASSAGES = {
  BANKING_DIGITAL_CLOZE: [
    {
      id: "UPI_INCLUSION",
      template:
        "Over the past decade, India's instant digital payment architecture has {{1}} how households and small merchants settle daily transactions. " +
        "By allowing zero-cost transfers directly between bank accounts, unified mobile rails have {{2}} dependence on informal cash channels. " +
        "Small shopkeepers who once struggled to document their turnover can now build {{3}} transaction histories that support formal working-capital loans. " +
        "However, sustaining this momentum requires {{4}} fraud-monitoring systems so that first-time rural users remain protected. " +
        "When convenience is paired with strong consumer safeguards, digital banking becomes a truly {{5}} engine of economic growth.",
      blanks: [
        {
          num: 1,
          answer: "transformed",
          distractors: ["obstructed", "concealed", "postponed", "fragmented"],
          wrongReplacement: "obstructed",
          reason: "'transformed' fits the positive large-scale shift in how daily payments are settled.",
        },
        {
          num: 2,
          answer: "reduced",
          distractors: ["inflated", "mandated", "provoked", "imitated"],
          wrongReplacement: "inflated",
          reason: "Instant bank-to-bank rails have 'reduced' reliance on informal cash channels.",
        },
        {
          num: 3,
          answer: "verifiable",
          distractors: ["fragile", "arbitrary", "obsolete", "hostile"],
          wrongReplacement: "arbitrary",
          reason: "Lenders need 'verifiable' transaction histories to underwrite formal loans.",
        },
        {
          num: 4,
          answer: "robust",
          distractors: ["negligent", "trivial", "erratic", "dormant"],
          wrongReplacement: "erratic",
          reason: "Protecting first-time rural users requires 'robust' (strong and reliable) monitoring systems.",
        },
        {
          num: 5,
          answer: "inclusive",
          distractors: ["exclusive", "redundant", "punitive", "reluctant"],
          wrongReplacement: "exclusive",
          reason: "Broad-based digital banking with safeguards acts as an 'inclusive' growth engine.",
        },
      ],
    },
    {
      id: "DIGITAL_KYC",
      template:
        "Video-based Know Your Customer (KYC) verification has {{1}} the onboarding journey for retail depositors across semi-urban districts. " +
        "Instead of waiting weeks for physical paperwork to clear, applicants can now complete identity checks in minutes with {{2}} accuracy. " +
        "For commercial banks, automated document validation lowers operational overhead while {{3}} strict compliance with anti-money-laundering norms. " +
        "Nevertheless, institutions must periodically {{4}} their biometric matching algorithms to prevent spoofing attempts. " +
        "Balancing speed with regulatory {{5}} remains the hallmark of a resilient banking framework.",
      blanks: [
        {
          num: 1,
          answer: "streamlined",
          distractors: ["complicated", "halted", "distorted", "ignored"],
          wrongReplacement: "complicated",
          reason: "'streamlined' accurately conveys making the onboarding process faster and simpler.",
        },
        {
          num: 2,
          answer: "remarkable",
          distractors: ["dubious", "scarce", "sluggish", "adverse"],
          wrongReplacement: "dubious",
          reason: "Digital checks completed in minutes achieve 'remarkable' accuracy.",
        },
        {
          num: 3,
          answer: "maintaining",
          distractors: ["violating", "evading", "dismissing", "weakening"],
          wrongReplacement: "evading",
          reason: "Banks lower overhead while 'maintaining' strict regulatory compliance.",
        },
        {
          num: 4,
          answer: "audit",
          distractors: ["abandon", "conceal", "imitate", "delay"],
          wrongReplacement: "abandon",
          reason: "Preventing spoofing requires banks to periodically 'audit' (inspect and test) their algorithms.",
        },
        {
          num: 5,
          answer: "rigor",
          distractors: ["apathy", "lenience", "chaos", "fatigue"],
          wrongReplacement: "apathy",
          reason: "Resilient banking balances speed with regulatory 'rigor' (strict precision).",
        },
      ],
    },
  ],

  ECONOMY_POLICY_CLOZE: [
    {
      id: "MONETARY_STABILITY",
      template:
        "Central banks face a delicate balancing act whenever global commodity shocks {{1}} domestic retail inflation. " +
        "Raising benchmark policy rates helps {{2}} excess liquidity and anchor long-term inflation expectations across financial markets. " +
        "At the same time, policymakers must ensure that tighter credit conditions do not unduly {{3}} capital investment by small manufacturing firms. " +
        "Clear forward guidance from the monetary policy committee reduces uncertainty and enables commercial lenders to {{4}} their lending rates smoothly. " +
        "Ultimately, credible price stability provides the strongest {{5}} for durable employment and household savings.",
      blanks: [
        {
          num: 1,
          answer: "accelerate",
          distractors: ["pacify", "abolish", "reimburse", "certify"],
          wrongReplacement: "pacify",
          reason: "Global commodity shocks 'accelerate' (drive up) domestic inflation.",
        },
        {
          num: 2,
          answer: "absorb",
          distractors: ["multiply", "broadcast", "fabricate", "exempt"],
          wrongReplacement: "multiply",
          reason: "Higher policy rates help 'absorb' (drain) excess liquidity.",
        },
        {
          num: 3,
          answer: "stifle",
          distractors: ["celebrate", "subsidize", "endorse", "clarify"],
          wrongReplacement: "endorse",
          reason: "Policymakers avoid letting tight credit 'stifle' (suppress) MSME investment.",
        },
        {
          num: 4,
          answer: "calibrate",
          distractors: ["forfeit", "neglect", "disrupt", "provoke"],
          wrongReplacement: "forfeit",
          reason: "Forward guidance helps lenders 'calibrate' (carefully adjust) their lending rates.",
        },
        {
          num: 5,
          answer: "foundation",
          distractors: ["obstacle", "penalty", "symptom", "deterrent"],
          wrongReplacement: "obstacle",
          reason: "Price stability forms the strongest 'foundation' for durable growth and savings.",
        },
      ],
    },
    {
      id: "MSME_RECEIVABLES",
      template:
        "Micro and small enterprises generate a substantial share of industrial employment, yet delayed invoice payments frequently {{1}} their working capital. " +
        "When large buyers stretch settlement cycles beyond ninety days, smaller suppliers are forced to {{2}} expensive short-term credit just to pay wages. " +
        "Electronic invoice-discounting platforms address this bottleneck by enabling multiple financiers to {{3}} competitively for verified receivables. " +
        "As settlement times shrink, entrepreneurs can {{4}} funds back into machinery upgrades and skilled hiring. " +
        "Strengthening formal supply-chain finance therefore {{5}} both enterprise productivity and regional job creation.",
      blanks: [
        {
          num: 1,
          answer: "strain",
          distractors: ["enrich", "reward", "simplify", "validate"],
          wrongReplacement: "enrich",
          reason: "Delayed payments 'strain' (put pressure on) working capital.",
        },
        {
          num: 2,
          answer: "borrow",
          distractors: ["forgive", "export", "donate", "abolish"],
          wrongReplacement: "forgive",
          reason: "Cash-strapped suppliers are forced to 'borrow' expensive short-term credit.",
        },
        {
          num: 3,
          answer: "bid",
          distractors: ["retreat", "protest", "hesitate", "default"],
          wrongReplacement: "retreat",
          reason: "On TReDS-style platforms, financiers 'bid' competitively to discount invoices.",
        },
        {
          num: 4,
          answer: "reinvest",
          distractors: ["hoard", "forfeit", "conceal", "suspend"],
          wrongReplacement: "forfeit",
          reason: "Faster cash inflows let entrepreneurs 'reinvest' in machinery and hiring.",
        },
        {
          num: 5,
          answer: "bolsters",
          distractors: ["erodes", "delays", "restricts", "isolates"],
          wrongReplacement: "erodes",
          reason: "Formal supply-chain finance 'bolsters' (strengthens) productivity and job creation.",
        },
      ],
    },
  ],

  CLIMATE_FINANCE_CLOZE: [
    {
      id: "GREEN_BONDS",
      template:
        "Transitioning a rapidly growing economy toward clean power demands {{1}} long-term capital for solar grids, battery storage, and electric transit. " +
        "Sovereign and corporate green bonds have emerged as a vital instrument to {{2}} global institutional funds into verified low-carbon projects. " +
        "To prevent misleading environmental claims, regulators insist on {{3}} third-party disclosures tracking actual emission reductions. " +
        "Banks that integrate climate-risk scoring into project appraisals are better positioned to {{4}} stranded-asset losses over coming decades. " +
        "Consequently, sustainable finance is shifting from a niche pledge to a {{5}} pillar of prudent banking.",
      blanks: [
        {
          num: 1,
          answer: "substantial",
          distractors: ["negligible", "reluctant", "hostile", "trivial"],
          wrongReplacement: "negligible",
          reason: "Building clean-energy infrastructure requires 'substantial' (large-scale) capital.",
        },
        {
          num: 2,
          answer: "channel",
          distractors: ["block", "divert", "deplete", "scatter"],
          wrongReplacement: "block",
          reason: "Green bonds 'channel' (direct) institutional funds into low-carbon projects.",
        },
        {
          num: 3,
          answer: "transparent",
          distractors: ["secretive", "vague", "biassed", "casual"],
          wrongReplacement: "secretive",
          reason: "Preventing greenwashing requires 'transparent' third-party disclosures.",
        },
        {
          num: 4,
          answer: "mitigate",
          distractors: ["aggravate", "invite", "double", "ignore"],
          wrongReplacement: "aggravate",
          reason: "Climate-risk scoring helps banks 'mitigate' (reduce) stranded-asset losses.",
        },
        {
          num: 5,
          answer: "mainstream",
          distractors: ["obsolete", "marginal", "fragile", "temporary"],
          wrongReplacement: "marginal",
          reason: "The contrast with 'niche pledge' calls directly for 'mainstream'.",
        },
      ],
    },
    {
      id: "RENEWABLE_GRID",
      template:
        "Integrating large volumes of solar and wind power into national electricity grids requires {{1}} energy-storage capacity to balance evening demand peaks. " +
        "State utilities that invest early in pumped-hydro and grid-scale batteries can {{2}} costly coal-plant backups during heatwaves. " +
        "Long-term power purchase agreements give private developers the revenue {{3}} needed to attract low-cost international debt. " +
        "Clear tariff guidelines from electricity regulators also {{4}} disputes between generators and distribution companies. " +
        "Over time, modernized transmission networks make clean electricity both reliable and {{5}} for rural industry.",
      blanks: [
        { num: 1, answer: "dependable", distractors: ["erratic", "hostile", "obsolete", "scarce"], wrongReplacement: "erratic", reason: "Balancing evening demand peaks requires 'dependable' energy-storage capacity." },
        { num: 2, answer: "curb", distractors: ["expand", "praise", "imitate", "provoke"], wrongReplacement: "expand", reason: "Early storage investments help utilities 'curb' (limit) costly coal backups." },
        { num: 3, answer: "certainty", distractors: ["confusion", "penalty", "fatigue", "scarcity"], wrongReplacement: "confusion", reason: "Long-term contracts provide revenue 'certainty' to attract debt." },
        { num: 4, answer: "minimize", distractors: ["trigger", "reward", "amplify", "conceal"], wrongReplacement: "trigger", reason: "Clear tariff rules help 'minimize' disputes." },
        { num: 5, answer: "affordable", distractors: ["prohibitive", "trivial", "fragile", "arbitrary"], wrongReplacement: "prohibitive", reason: "Modern grids make clean power both reliable and 'affordable'." },
      ],
    },
  ],

  GOVERNANCE_CYBER_CLOZE: [
    {
      id: "ZERO_TRUST_BANKING",
      template:
        "As financial institutions migrate core workloads to cloud platforms, traditional perimeter firewalls alone can no longer {{1}} sophisticated cyber threats. " +
        "Modern security teams are therefore adopting zero-trust architectures that {{2}} every user request regardless of whether it originates inside or outside the office network. " +
        "Continuous behavioral analytics help analysts {{3}} anomalous login patterns before attackers can exfiltrate sensitive customer records. " +
        "Equally important is cultivating a workplace culture where employees promptly {{4}} suspicious links rather than fearing blame. " +
        "In digital finance, institutional trust depends as much on cyber {{5}} as on strong capital reserves.",
      blanks: [
        {
          num: 1,
          answer: "contain",
          distractors: ["encourage", "fabricate", "reward", "amplify"],
          wrongReplacement: "encourage",
          reason: "Legacy firewalls alone cannot 'contain' (hold back) sophisticated threats.",
        },
        {
          num: 2,
          answer: "authenticate",
          distractors: ["overlook", "dismiss", "postpone", "bypass"],
          wrongReplacement: "bypass",
          reason: "Zero-trust systems strictly 'authenticate' (verify) every single request.",
        },
        {
          num: 3,
          answer: "detect",
          distractors: ["conceal", "imitate", "provoke", "erase"],
          wrongReplacement: "conceal",
          reason: "Behavioral analytics help teams 'detect' anomalous logins early.",
        },
        {
          num: 4,
          answer: "report",
          distractors: ["forward", "endorse", "ignore", "conceal"],
          wrongReplacement: "ignore",
          reason: "Healthy security culture encourages employees to promptly 'report' suspicious links.",
        },
        {
          num: 5,
          answer: "resilience",
          distractors: ["negligence", "fragility", "complacency", "ambiguity"],
          wrongReplacement: "complacency",
          reason: "Institutional trust depends on cyber 'resilience' alongside strong capital reserves.",
        },
      ],
    },
    {
      id: "BOARD_AUDIT_COMPLIANCE",
      template:
        "Independent audit committees play a decisive role in {{1}} financial misstatements before they undermine depositor confidence. " +
        "When internal auditors have direct reporting lines to the board, operational irregularities are {{2}} without fear of managerial interference. " +
        "Automated reconciliation tools now allow compliance teams to {{3}} millions of daily ledger entries for unusual patterns in real time. " +
        "Transparent whistle-blower channels further {{4}} institutional accountability across regional branches. " +
        "Strong corporate governance is therefore not merely a legal formality, but a {{5}} safeguard of long-term franchise value.",
      blanks: [
        { num: 1, answer: "uncovering", distractors: ["concealing", "promoting", "delaying", "rewarding"], wrongReplacement: "concealing", reason: "Audit committees are tasked with 'uncovering' misstatements early." },
        { num: 2, answer: "escalated", distractors: ["buried", "ignored", "erased", "reversed"], wrongReplacement: "buried", reason: "Direct board reporting ensures irregularities are 'escalated' promptly." },
        { num: 3, answer: "scrutinize", distractors: ["neglect", "abandon", "distort", "bypass"], wrongReplacement: "neglect", reason: "Compliance teams 'scrutinize' (closely examine) daily ledger entries." },
        { num: 4, answer: "reinforce", distractors: ["weaken", "obstruct", "dismiss", "fragment"], wrongReplacement: "weaken", reason: "Whistle-blower channels 'reinforce' institutional accountability." },
        { num: 5, answer: "vital", distractors: ["trivial", "redundant", "adverse", "casual"], wrongReplacement: "trivial", reason: "Governance is a 'vital' safeguard of long-term franchise value." },
      ],
    },
  ],
};

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

export function buildClozeQuestion({
  subtopicKey = "BANKING_DIGITAL_CLOZE",
  difficulty = "Medium",
  rng,
}) {
  const isNewPattern = subtopicKey === "NEW_PATTERN_CLOZE";
  const allStandardKeys = [
    "BANKING_DIGITAL_CLOZE",
    "ECONOMY_POLICY_CLOZE",
    "CLIMATE_FINANCE_CLOZE",
    "GOVERNANCE_CYBER_CLOZE",
  ];
  const domainKey = isNewPattern ? rng.pick(allStandardKeys) : subtopicKey;
  const passageList = PASSAGES[domainKey] || PASSAGES.BANKING_DIGITAL_CLOZE;
  const passage = rng.pick(passageList);
  const blank = rng.pick(passage.blanks);

  if (isNewPattern) {
    const noCorrection = rng() < 0.25;
    const shownWord = noCorrection ? blank.answer : blank.wrongReplacement;
    const renderedPassage = renderNewPatternClozePassage(
      passage.template,
      passage.blanks,
      blank.num,
      shownWord,
    );

    let options;
    let correctIndex;
    if (noCorrection) {
      options = [...rng.shuffle(blank.distractors).slice(0, 4), "No correction required"];
      correctIndex = 4;
    } else {
      const threeDistractors = rng.shuffle(
        blank.distractors.filter((d) => d !== shownWord),
      ).slice(0, 3);
      const fourChoices = rng.shuffle([blank.answer, ...threeDistractors]);
      options = [...fourChoices, "No correction required"];
      correctIndex = options.indexOf(blank.answer);
    }

    const expectedAnswer = noCorrection ? "No correction required" : blank.answer;
    const questionText =
      `Directions: In the following passage, a numbered word is highlighted in brackets. Choose the most appropriate word from the options to replace it so the passage becomes grammatically and contextually meaningful. If the highlighted word is already correct, select (E) 'No correction required'.\n\n` +
      `${renderedPassage}\n\n` +
      `Which of the following should replace [${shownWord}] (${blank.num})?`;

    const explanation = noCorrection
      ? `The highlighted word '${shownWord}' is already contextually and grammatically exact: ${blank.reason} Hence, 'No correction required'.`
      : `'${shownWord}' does not fit the context here. Replacing it with '${blank.answer}' makes the sentence coherent: ${blank.reason}`;

    return {
      topic: "Cloze Test",
      subType: "NEW_PATTERN_CLOZE",
      subtopicName: CLOZE_SUBTOPICS.NEW_PATTERN_CLOZE,
      difficulty,
      questionText,
      options,
      correctIndex,
      correctAnswer: String.fromCharCode(65 + correctIndex),
      explanation,
      _meta: {
        subType: "NEW_PATTERN_CLOZE",
        passageId: passage.id,
        templateText: passage.template,
        blanks: passage.blanks,
        activeBlankNum: blank.num,
        expectedAnswer,
      },
    };
  }

  // Standard 5-blank Cloze Test
  const renderedPassage = renderStandardClozePassage(
    passage.template,
    passage.blanks,
    blank.num,
  );
  const packed = shuffleOptionsWithAnswer(blank.answer, blank.distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: In the following passage, some words have been left out and numbered. Read the passage carefully and select the most appropriate word for blank (${blank.num}).\n\n` +
    `${renderedPassage}\n\n` +
    `Which of the following words most appropriately fills blank (${blank.num})?`;

  const explanation = `Blank (${blank.num}) requires '${blank.answer}': ${blank.reason}`;

  return {
    topic: "Cloze Test",
    subType: domainKey,
    subtopicName: CLOZE_SUBTOPICS[domainKey] || CLOZE_SUBTOPICS.BANKING_DIGITAL_CLOZE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation,
    _meta: {
      subType: domainKey,
      passageId: passage.id,
      templateText: passage.template,
      blanks: passage.blanks,
      activeBlankNum: blank.num,
      expectedAnswer: blank.answer,
    },
  };
}
