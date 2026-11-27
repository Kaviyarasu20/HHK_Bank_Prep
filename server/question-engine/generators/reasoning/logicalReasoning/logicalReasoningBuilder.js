/**
 * Modular Banking Exam Logical Reasoning Question Builder
 *
 * Covers 5 real IBPS PO / SBI PO / RBI Grade B Mains subtopics:
 * 1. COURSE_OF_ACTION             — Practical banking/policy problem + 2 courses of action (5-option verdict)
 * 2. STRONG_WEAK_ARGUMENT         — Policy/banking Yes-No debate + 2 arguments (Strong vs Weak verdict)
 * 3. PASSAGE_INFERENCE            — Parameterized fact passage + 1 strictly entailed inference vs 4 fallacies
 * 4. STRENGTHEN_WEAKEN            — Causal claim/conclusion + strengthener or weakener identification
 * 5. DECISION_MAKING_ELIGIBILITY  — Formal Boolean/threshold bank recruitment eligibility with exception clauses
 */

import {
  DECISION_LABELS,
  evaluateDualVerdict,
  evaluateEligibilityDecision,
} from "./solver.js";

export const LOGICAL_REASONING_SUBTOPICS = {
  COURSE_OF_ACTION: "Statement & Course of Action",
  STRONG_WEAK_ARGUMENT: "Strong & Weak Arguments",
  PASSAGE_INFERENCE: "Passage Inference & Deduction",
  STRENGTHEN_WEAKEN: "Strengthening & Weakening Arguments",
  DECISION_MAKING_ELIGIBILITY: "Decision Making & Eligibility Criteria",
};

export function createLogicalRng(seedInput) {
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

const REGIONS = ["District X", "Metro Zone A", "State M", "Region K", "City P", "Cluster B"];
const BANKS = ["Bank X", "National Bank A", "Apex Bank", "Metro Cooperative Bank", "Horizon Bank"];
const NAMES = [
  "Aarav", "Priya", "Rohan", "Kavya", "Vikram", "Neha", "Arjun", "Meera",
  "Siddharth", "Ananya", "Karthik", "Divya", "Rahul", "Sneha", "Nikhil", "Pooja",
];

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

// ============================================================================
// 1. COURSE OF ACTION SCENARIO FAMILIES
// ============================================================================
const COA_SCENARIOS = [
  {
    id: "UPI_FRAUD",
    buildStatement: (r, pct) =>
      `A sharp ${pct}% rise in unauthorized UPI phishing transactions targeting senior citizens has been reported across ${r} over the last quarter.`,
    validActions: [
      {
        text: "Banks should run targeted digital-safety awareness drives and enable optional transaction caps with cooling-off alerts for senior citizen accounts.",
        reason: "Practical preventive measure directly addressing the vulnerable group.",
      },
      {
        text: "The cyber-crime cell and payment operators should establish a rapid-freeze helpline to block suspected fraudulent transfers in real time.",
        reason: "Directly mitigates financial loss and strengthens enforcement.",
      },
    ],
    invalidActions: [
      {
        text: "All UPI services across the region should be permanently suspended for customers aged above 60.",
        reason: "Extreme and disproportionate measure that denies legitimate banking access.",
      },
      {
        text: "Senior citizens should be fined if they accidentally share an OTP with fraudsters.",
        reason: "Punishes victims instead of addressing fraudsters or systemic safeguards.",
      },
    ],
  },
  {
    id: "ATM_CASHOUT",
    buildStatement: (r, pct) =>
      `Over ${pct}% of off-site ATMs operated by public sector banks in ${r} remained out of cash during festival weekends, causing severe inconvenience to depositors.`,
    validActions: [
      {
        text: "Banks should implement predictive cash-forecasting models and schedule additional cash replenishment vans ahead of peak festival dates.",
        reason: "Directly resolves the operational forecasting bottleneck.",
      },
      {
        text: "Service-level agreements with cash-management agencies should include automated low-cash alerts and penalty clauses for prolonged downtime.",
        reason: "Strengthens accountability and speeds up replenishment.",
      },
    ],
    invalidActions: [
      {
        text: "Banks should permanently shut down all off-site ATMs and force customers to visit branches for cash withdrawals.",
        reason: "Extreme action that worsens customer inconvenience.",
      },
      {
        text: "Customers should be prohibited from withdrawing cash during festival weeks.",
        reason: "Unfeasible and violates basic depositor rights.",
      },
    ],
  },
  {
    id: "MSME_NPA",
    buildStatement: (r, pct) =>
      `Non-Performing Assets (NPAs) in the small-enterprise loan portfolio of ${r} banks increased by ${pct}% due to delayed receivables from large buyers.`,
    validActions: [
      {
        text: "Banks should encourage MSME borrowers to onboard onto regulated invoice-discounting platforms (such as TReDS) to accelerate cash-flow recovery.",
        reason: "Practical structural solution directly tackling delayed receivables.",
      },
      {
        text: "Credit officers should conduct early-warning cash-flow audits and offer timely restructuring for viable units facing temporary liquidity stress.",
        reason: "Proactive risk management that prevents viable loans from turning bad.",
      },
    ],
    invalidActions: [
      {
        text: "Banks should stop sanctioning all new loans to small enterprises indefinitely.",
        reason: "Extreme blanket ban that harms credit growth and healthy businesses.",
      },
      {
        text: "All overdue MSME loans should be immediately written off without reviewing borrower viability.",
        reason: "Creates moral hazard and erodes bank capital unnecessarily.",
      },
    ],
  },
  {
    id: "BRANCH_QUEUES",
    buildStatement: (r, pct) =>
      `Average customer waiting times at urban retail branches in ${r} jumped by ${pct}% following the merger of three regional branches.`,
    validActions: [
      {
        text: "Branch management should deploy digital token kiosks, separate fast-track counters for routine passbook/KYC updates, and reallocate staff during peak hours.",
        reason: "Directly optimizes queue flow and staffing.",
      },
      {
        text: "The bank should guide routine-transaction customers toward self-service kiosks and mobile banking desks inside the branch lobby.",
        reason: "Practical channel-migration step that eases counter congestion.",
      },
    ],
    invalidActions: [
      {
        text: "Branches should cut public business hours to two hours per day to reduce crowding.",
        reason: "Counterproductive; shorter hours increase queue density.",
      },
      {
        text: "Walk-in customers should be charged a heavy entry fee to discourage branch visits.",
        reason: "Unfair and alienates core retail depositors.",
      },
    ],
  },
  {
    id: "URBAN_WATER",
    buildStatement: (r, pct) =>
      `Groundwater levels in ${r} declined by ${pct}% over the past two years due to unregulated borewell extraction and poor rainwater harvesting.`,
    validActions: [
      {
        text: "Municipal authorities should mandate rainwater harvesting structures in new buildings and audit commercial groundwater extraction.",
        reason: "Directly addresses both recharge and unregulated extraction.",
      },
      {
        text: "The civic body should restore local lakes and percolation tanks before the next monsoon season.",
        reason: "Practical long-term recharge step.",
      },
    ],
    invalidActions: [
      {
        text: "The city administration should cut off piped drinking water supply to all residential neighborhoods immediately.",
        reason: "Extreme action that creates an immediate humanitarian crisis.",
      },
      {
        text: "All construction workers in the region should be relocated to another state.",
        reason: "Irrelevant and unfeasible response to a water-management issue.",
      },
    ],
  },
  {
    id: "PHISHING_EMAILS",
    buildStatement: (r, pct) =>
      `An internal security audit at ${r} financial institutions revealed that ${pct}% of employees clicked on simulated phishing emails containing malicious attachments.`,
    validActions: [
      {
        text: "Institutions should conduct mandatory quarterly cybersecurity drills and enable automated email-attachment sandboxing.",
        reason: "Combines human training with technical defense-in-depth.",
      },
      {
        text: "IT teams should enforce phishing-resistant multi-factor authentication across all internal portals.",
        reason: "Limits credential compromise even if an employee clicks a link.",
      },
    ],
    invalidActions: [
      {
        text: "Every employee who clicked the simulated link should be dismissed from service immediately.",
        reason: "Excessively harsh; training and technical controls are the proportionate fix.",
      },
      {
        text: "Internal email communication should be banned permanently across all offices.",
        reason: "Impractical and disrupts essential banking operations.",
      },
    ],
  },
];

const COA_OPTIONS = [
  "Only I follows",
  "Only II follows",
  "Either I or II follows",
  "Neither I nor II follows",
  "Both I and II follow",
];

export function buildCourseOfActionQuestion({ difficulty = "Medium", targetOutcome = null, rng }) {
  const sc = rng.pick(COA_SCENARIOS);
  const region = rng.pick(REGIONS);
  const pct = rng.int(18, 42);
  const statement = sc.buildStatement(region, pct);

  // Pick desired outcome among ONLY_I, ONLY_II, NEITHER, BOTH
  const outcomes = ["ONLY_I", "ONLY_II", "NEITHER", "BOTH"];
  const chosenOutcome =
    targetOutcome && outcomes.includes(targetOutcome) ? targetOutcome : rng.pick(outcomes);

  const validI = chosenOutcome === "ONLY_I" || chosenOutcome === "BOTH";
  const validII = chosenOutcome === "ONLY_II" || chosenOutcome === "BOTH";

  const valids = rng.shuffle(sc.validActions);
  const invalids = rng.shuffle(sc.invalidActions);

  const itemI = validI ? valids[0] : invalids[0];
  const itemII = validII ? (validI ? valids[1] : valids[0]) : !validI ? invalids[1] : invalids[0];

  const verdict = evaluateDualVerdict({ validI, validII });
  const verdictIdx = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"].indexOf(verdict);

  const questionText =
    `Directions: A statement is given followed by two courses of action numbered I and II. Decide which of the courses of action logically follows for pursuing.\n\n` +
    `Statement: ${statement}\n\n` +
    `Courses of Action:\n` +
    `I. ${itemI.text}\n` +
    `II. ${itemII.text}`;

  const explanation =
    `Course of Action I ${validI ? "follows" : "does not follow"}: ${itemI.reason}\n` +
    `Course of Action II ${validII ? "follows" : "does not follow"}: ${itemII.reason}\n` +
    `Hence, ${COA_OPTIONS[verdictIdx]}.`;

  return {
    topic: "Logical Reasoning",
    subType: "COURSE_OF_ACTION",
    subtopicName: LOGICAL_REASONING_SUBTOPICS.COURSE_OF_ACTION,
    difficulty,
    questionText,
    options: [...COA_OPTIONS],
    correctIndex: verdictIdx,
    correctAnswer: String.fromCharCode(65 + verdictIdx),
    explanation,
    _meta: { subType: "COURSE_OF_ACTION", validI, validII, mutuallyExclusive: false },
  };
}

// ============================================================================
// 2. STRONG & WEAK ARGUMENTS SCENARIO FAMILIES
// ============================================================================
const ARG_SCENARIOS = [
  {
    id: "BIOMETRIC_TXN",
    statement: "Should banks mandate biometric authentication for all high-value digital fund transfers above ₹1 lakh?",
    strongArgs: [
      {
        text: "Yes, biometric verification significantly reduces account-takeover fraud caused by stolen passwords or SIM-swap OTP interception.",
        reason: "Directly cites a concrete security benefit addressing known fraud vectors.",
      },
      {
        text: "No, older feature-phone users and rural customers without biometric-enabled devices could face exclusion unless an alternative secure fallback is provided.",
        reason: "Raises a substantive financial-inclusion and operational feasibility concern.",
      },
    ],
    weakArgs: [
      {
        text: "Yes, because many people enjoy using fingerprint scanners on their smartphones.",
        reason: "Trivial personal preference; not a strong policy justification.",
      },
      {
        text: "No, because banks should focus only on opening physical branches rather than digital security.",
        reason: "Irrelevant tangent that ignores the digital fraud risk.",
      },
    ],
  },
  {
    id: "FOUR_DAY_WEEK",
    statement: "Should commercial banks in India adopt a five-day work week with slightly extended daily branch hours?",
    strongArgs: [
      {
        text: "Yes, predictable weekend rest improves employee productivity and morale while extended weekday hours still preserve total customer service time.",
        reason: "Balances workforce well-being with concrete service-hour continuity.",
      },
      {
        text: "No, salaried customers who rely on Saturday visits for physical documentation and locker access may face inconvenience unless digital alternatives cover those services.",
        reason: "Identifies a real, practical customer-access impact.",
      },
    ],
    weakArgs: [
      {
        text: "Yes, because employees in other unrelated industries already get two days off every week.",
        reason: "Weak bandwagon argument without evaluating banking-specific impact.",
      },
      {
        text: "No, because bank buildings would remain empty on Saturdays and look dull.",
        reason: "Superficial and irrelevant reasoning.",
      },
    ],
  },
  {
    id: "AI_CREDIT_SCORING",
    statement: "Should banks use alternative digital payment data alongside traditional credit bureau scores when evaluating first-time small borrowers?",
    strongArgs: [
      {
        text: "Yes, verified utility and UPI cash-flow histories help assess creditworthy new-to-credit borrowers who lack formal collateral or credit history.",
        reason: "Directly addresses financial inclusion with verifiable repayment signals.",
      },
      {
        text: "No, without strict data-privacy consent and algorithmic bias audits, alternative scoring models could unfairly penalize low-income applicants.",
        reason: "Substantive regulatory, privacy, and fairness risk.",
      },
    ],
    weakArgs: [
      {
        text: "Yes, because artificial intelligence is a trending technology in modern conferences.",
        reason: "Buzzword appeal with no substantive banking rationale.",
      },
      {
        text: "No, because traditional paper ledgers have always been sufficient for decades.",
        reason: "Appeal to tradition that ignores modern credit-access gaps.",
      },
    ],
  },
  {
    id: "FINANCIAL_LITERACY_SCHOOL",
    statement: "Should personal finance and basic banking literacy be introduced as a mandatory subject in high schools?",
    strongArgs: [
      {
        text: "Yes, early understanding of compounding, budgeting, and digital fraud prevention equips young adults to make sound financial decisions and avoid debt traps.",
        reason: "Concrete, measurable long-term societal and economic benefit.",
      },
      {
        text: "No, adding a separate mandatory subject without trimming existing curriculum load or training teachers could strain school schedules and dilute learning quality.",
        reason: "Practical implementation and resource-constraint concern.",
      },
    ],
    weakArgs: [
      {
        text: "Yes, because every student dreams of becoming a bank manager.",
        reason: "Factually baseless generalization.",
      },
      {
        text: "No, because teenagers do not earn salaries so they will never need to understand money.",
        reason: "Short-sighted; education prepares students for adulthood.",
      },
    ],
  },
  {
    id: "CASHLESS_SUBSIDIES",
    statement: "Should all government agricultural subsidies be disbursed exclusively through Direct Benefit Transfer (DBT) into Aadhaar-linked bank accounts?",
    strongArgs: [
      {
        text: "Yes, direct electronic transfers eliminate middlemen, curb leakages, and create a transparent audit trail of public funds.",
        reason: "Strong governance and fiscal-efficiency evidence.",
      },
      {
        text: "No, until last-mile banking connectivity and biometric authentication errors in remote villages are fully resolved, an exclusive mandate could delay urgent aid to genuine farmers.",
        reason: "Concrete operational exclusion risk affecting vulnerable beneficiaries.",
      },
    ],
    weakArgs: [
      {
        text: "Yes, because printing paper vouchers uses too much ink.",
        reason: "Trivial point compared to the scale of agricultural subsidies.",
      },
      {
        text: "No, because farmers prefer visiting government offices in person.",
        reason: "Unsupported assumption.",
      },
    ],
  },
];

const ARG_OPTIONS = [
  "Only argument I is strong",
  "Only argument II is strong",
  "Either I or II is strong",
  "Neither I nor II is strong",
  "Both I and II are strong",
];

export function buildStrongWeakArgumentQuestion({ difficulty = "Medium", targetOutcome = null, rng }) {
  const sc = rng.pick(ARG_SCENARIOS);
  const outcomes = ["ONLY_I", "ONLY_II", "NEITHER", "BOTH"];
  const chosenOutcome =
    targetOutcome && outcomes.includes(targetOutcome) ? targetOutcome : rng.pick(outcomes);

  const validI = chosenOutcome === "ONLY_I" || chosenOutcome === "BOTH";
  const validII = chosenOutcome === "ONLY_II" || chosenOutcome === "BOTH";

  const strongs = rng.shuffle(sc.strongArgs);
  const weaks = rng.shuffle(sc.weakArgs);

  const argI = validI ? strongs[0] : weaks[0];
  const argII = validII ? (validI ? strongs[1] : strongs[0]) : !validI ? weaks[1] : weaks[0];

  const verdict = evaluateDualVerdict({ validI, validII });
  const verdictIdx = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"].indexOf(verdict);

  const questionText =
    `Directions: A question statement is followed by two arguments I and II. Decide which of the arguments is 'strong' and which is 'weak'.\n\n` +
    `Statement: ${sc.statement}\n\n` +
    `Arguments:\n` +
    `I. ${argI.text}\n` +
    `II. ${argII.text}`;

  const explanation =
    `Argument I is ${validI ? "strong" : "weak"}: ${argI.reason}\n` +
    `Argument II is ${validII ? "strong" : "weak"}: ${argII.reason}\n` +
    `Hence, ${ARG_OPTIONS[verdictIdx]}.`;

  return {
    topic: "Logical Reasoning",
    subType: "STRONG_WEAK_ARGUMENT",
    subtopicName: LOGICAL_REASONING_SUBTOPICS.STRONG_WEAK_ARGUMENT,
    difficulty,
    questionText,
    options: [...ARG_OPTIONS],
    correctIndex: verdictIdx,
    correctAnswer: String.fromCharCode(65 + verdictIdx),
    explanation,
    _meta: { subType: "STRONG_WEAK_ARGUMENT", validI, validII, mutuallyExclusive: false },
  };
}

// ============================================================================
// 3. PASSAGE INFERENCE & DEDUCTION
// ============================================================================
export function buildPassageInferenceQuestion({ difficulty = "Hard", rng }) {
  const bank = rng.pick(BANKS);
  const region = rng.pick(REGIONS);
  const pct1 = rng.int(18, 34);
  const pct2 = rng.int(6, 14);
  const share = rng.int(62, 78);

  const templates = [
    {
      passage:
        `In FY 2025–26, ${bank} recorded a ${pct1}% growth in retail mobile-banking transactions across ${region}, while physical branch footfall fell by ${pct2}%. ` +
        `However, ${share}% of high-value home-loan applications were still finalized in person at physical branches.`,
      correct: `Digital adoption grew rapidly for routine retail transactions at ${bank}, yet physical branches remained the primary channel for finalizing most home-loan applications.`,
      distractors: [
        `${bank} will close all physical branches in ${region} within the next financial year.`,
        `No customer at ${bank} ever uses mobile banking for any loan-related inquiry.`,
        `Physical branch footfall rose across ${region} because of higher home-loan demand.`,
        `${bank} has the highest mobile-banking market share among all banks in the country.`,
      ],
      why: "Directly restates the two verified facts from the passage without extrapolating beyond the given data; all other choices either contradict the figures or introduce unsupported extreme claims.",
    },
    {
      passage:
        `Following a ${pct2}% reduction in average processing time after introducing automated document verification, ${bank} approved ${pct1}% more MSME working-capital loans in ${region}. ` +
        `Despite higher approvals, the bank maintained its strict minimum credit-score cutoff throughout the year.`,
      correct: `Faster document verification coincided with higher MSME loan approvals at ${bank} without the bank lowering its minimum credit-score requirement.`,
      distractors: [
        `${bank} relaxed its credit-score cutoff to approve more MSME loans.`,
        `Automated document verification completely eliminated loan defaults at ${bank}.`,
        `Every MSME applicant in ${region} received a loan approval from ${bank}.`,
        `Manual document verification is legally banned across ${region}.`,
      ],
      why: "Strictly follows from the stated facts; the distractors contradict the unchanged credit-score cutoff or make extreme/unsupported claims.",
    },
    {
      passage:
        `A survey of ${region} commuters found that ${share}% switched to metro rail after feeder electric buses reduced last-mile travel time by ${pct1}%. ` +
        `Still, commuters living more than 5 km from feeder routes continued to rely primarily on private two-wheelers.`,
      correct: `Improving last-mile connectivity via feeder buses encouraged metro adoption among served commuters, though coverage gaps beyond 5 km left many dependent on two-wheelers.`,
      distractors: [
        `Private two-wheeler sales fell to zero across ${region} after feeder buses launched.`,
        `Metro rail fares were made completely free for all residents of ${region}.`,
        `Commuters living near feeder routes refused to use metro rail.`,
        `Electric buses are more expensive to operate than metro trains.`,
      ],
      why: "Accurately synthesizes both sentences of the passage without adding external assumptions.",
    },
    {
      passage:
        `Over the past three quarters, ${bank} increased its Current and Savings Account (CASA) deposit ratio by ${pct2} percentage points in ${region} while cutting promotional interest rates on bulk term deposits by ${pct1} basis points. ` +
        `As a result, its overall cost of funds declined compared with the previous year.`,
      correct: `A higher share of low-cost CASA deposits alongside lower bulk-deposit rates contributed to reducing ${bank}'s overall cost of funds.`,
      distractors: [
        `${bank}'s overall cost of funds increased sharply over the past three quarters.`,
        `${bank} stopped accepting all bulk term deposits permanently.`,
        `Every competing bank in ${region} also reduced its cost of funds by the exact same margin.`,
        `Savings account holders at ${bank} withdrew all their balances due to lower bulk rates.`,
      ],
      why: "Directly supported by the passage's stated cause-and-effect relationship.",
    },
  ];

  const tpl = rng.pick(templates);
  const packed = shuffleOptionsWithAnswer(tpl.correct, tpl.distractors, rng);
  if (!packed) return null;

  const questionText =
    `Directions: Read the following passage carefully and choose the inference that most logically and definitely follows from the given facts.\n\n` +
    `Passage: ${tpl.passage}\n\n` +
    `Which of the following can be most logically inferred from the passage above?`;

  return {
    topic: "Logical Reasoning",
    subType: "PASSAGE_INFERENCE",
    subtopicName: LOGICAL_REASONING_SUBTOPICS.PASSAGE_INFERENCE,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `Correct Inference: "${tpl.correct}". ${tpl.why}`,
    _meta: { subType: "PASSAGE_INFERENCE", expectedAnswer: tpl.correct },
  };
}

// ============================================================================
// 4. STRENGTHENING & WEAKENING AN ARGUMENT
// ============================================================================
export function buildStrengthenWeakenQuestion({ difficulty = "Hard", rng }) {
  const bank = rng.pick(BANKS);
  const region = rng.pick(REGIONS);
  const pct = rng.int(18, 35);
  const mode = rng() < 0.5 ? "WEAKEN" : "STRENGTHEN";

  const cases = [
    {
      passage:
        `After ${bank} launched a redesigned mobile app in ${region}, its new savings account openings jumped by ${pct}% in the very next quarter. ` +
        `Management therefore concluded that the new mobile app interface was the primary driver of the deposit-account surge.`,
      weaken: `In the same quarter, a major rival bank in ${region} shut down 14 branches, forcing thousands of local residents to shift their accounts to ${bank}.`,
      strengthen: `In neighboring districts where the same rival banks remained unchanged and ${bank} launched the new app, new account openings similarly jumped by ${pct}%, whereas districts without the app update saw flat growth.`,
      distractors: [
        `${bank} also updated the color scheme of its printed cheque books last year.`,
        `Smartphone screen sizes have increased globally over the past decade.`,
        `${bank}'s head office is located in a central business district.`,
        `Several employees of ${bank} attended a banking technology seminar in March.`,
      ],
      weakenWhy: "Introduces a strong alternative cause (competitor branch closures) that explains the account surge without crediting the app redesign.",
      strengthenWhy: "Provides control-group evidence isolating the app update as the actual driver of growth.",
    },
    {
      passage:
        `A municipal study in ${region} showed that intersections fitted with automated red-light cameras recorded ${pct}% fewer collisions over six months. ` +
        `City planners concluded that installing automated cameras across every intersection will reduce city-wide road accidents by the same proportion.`,
      weaken: `Traffic police simultaneously deployed full-time speed-enforcement patrols and repainted faded pedestrian crossings at those exact intersections during the six-month period.`,
      strengthen: `Intersections in ${region} that received only automated red-light cameras—with no changes in police patrols or road markings—experienced the same ${pct}% drop in collisions.`,
      distractors: [
        `Traffic cameras are manufactured by both domestic and international electronics firms.`,
        `Some drivers prefer listening to music while commuting during rush hour.`,
        `The city plans to host an international marathon next winter.`,
        `Red-light cameras use weatherproof metal casings.`,
      ],
      weakenWhy: "Identifies confounding interventions (patrols and repainted crossings) that undermine attributing the entire drop to cameras alone.",
      strengthenWhy: "Rules out confounding factors by showing the effect holds when cameras are the only change.",
    },
    {
      passage:
        `${bank} introduced a 24×7 AI chat assistant for credit-card billing queries, and within two months customer-care phone calls dropped by ${pct}%. ` +
        `Operations heads concluded that the AI assistant successfully resolved the vast majority of billing complaints.`,
      weaken: `A post-interaction survey revealed that over half of callers abandoned their queries in frustration after encountering long wait loops, without their billing issues being resolved.`,
      strengthen: `Follow-up ticket audits confirmed that repeat complaints and unresolved billing escalations fell sharply alongside the ${pct}% drop in phone calls.`,
      distractors: [
        `The AI assistant's icon on the website is colored blue and white.`,
        `${bank} offers both Visa and RuPay debit cards to account holders.`,
        `Customer-care agents work in three rotational shifts across the call center.`,
        `Credit-card usage typically increases during holiday shopping seasons.`,
      ],
      weakenWhy: "Breaks the link between fewer calls and resolved complaints by showing customers simply gave up unresolved.",
      strengthenWhy: "Confirms that lower call volume actually corresponded to genuine issue resolution rather than abandonment.",
    },
  ];

  const c = rng.pick(cases);
  const correctText = mode === "WEAKEN" ? c.weaken : c.strengthen;
  const why = mode === "WEAKEN" ? c.weakenWhy : c.strengthenWhy;
  const packed = shuffleOptionsWithAnswer(correctText, c.distractors, rng);
  if (!packed) return null;

  const verb = mode === "WEAKEN" ? "weakens" : "strengthens";
  const questionText =
    `Directions: Read the argument carefully and select the option that most strongly ${verb} the conclusion.\n\n` +
    `Argument: ${c.passage}\n\n` +
    `Which of the following, if true, most seriously ${verb} the conclusion above?`;

  return {
    topic: "Logical Reasoning",
    subType: "STRENGTHEN_WEAKEN",
    subtopicName: LOGICAL_REASONING_SUBTOPICS.STRENGTHEN_WEAKEN,
    difficulty,
    questionText,
    options: packed.options,
    correctIndex: packed.correctIndex,
    correctAnswer: packed.correctAnswer,
    explanation: `Correct choice: "${correctText}". ${why}`,
    _meta: { subType: "STRENGTHEN_WEAKEN", mode, expectedAnswer: correctText },
  };
}

// ============================================================================
// 5. FORMAL DECISION MAKING & ELIGIBILITY CRITERIA (100% LOGIC-GATE SOLVER)
// ============================================================================
export function buildDecisionMakingQuestion({ difficulty = "Medium", rng }) {
  const name = rng.pick(NAMES);
  const rules = {
    minAge: 22,
    maxAge: 30,
    minGrad: 60,
    minTest: 70,
    minExp: 2,
    minPg: 65,
    highTest: 85,
  };

  // Pick a target decision cleanly so all 5 outcomes are evenly represented
  const targetDecision = rng.pick(["SELECT", "REJECT", "REFER_GM", "REFER_HR", "DATA_INADEQUATE"]);

  let profile = {
    age: rng.int(23, 29),
    gradPct: rng.int(62, 78),
    testPct: rng.int(72, 83),
    expYears: rng.int(2, 5),
    pgPct: null,
  };

  if (targetDecision === "REFER_GM") {
    profile.gradPct = rng.int(52, 58); // fails c2 only
    profile.pgPct = rng.int(67, 78);   // satisfies exA
  } else if (targetDecision === "REFER_HR") {
    profile.expYears = rng.pick([0, 1]); // fails c4 only
    profile.testPct = rng.int(86, 94);   // satisfies exB
  } else if (targetDecision === "REJECT") {
    const rejectReason = rng.pick(["AGE", "TEST", "BOTH_FAIL", "GM_FAIL"]);
    if (rejectReason === "AGE") profile.age = rng.pick([20, 32, 34]);
    else if (rejectReason === "TEST") profile.testPct = rng.int(55, 67);
    else if (rejectReason === "BOTH_FAIL") {
      profile.gradPct = 55;
      profile.expYears = 1;
      profile.pgPct = 70;
      profile.testPct = 88;
    } else {
      profile.gradPct = 56;
      profile.pgPct = 59; // fails exA too
    }
  } else if (targetDecision === "DATA_INADEQUATE") {
    const omitField = rng.pick(["AGE", "EXP", "PG_FOR_EXA"]);
    if (omitField === "AGE") {
      profile.age = null;
    } else if (omitField === "EXP") {
      profile.expYears = null;
    } else {
      profile.gradPct = 56; // triggers exA check, but pgPct is omitted!
      profile.pgPct = null;
    }
  }

  const computed = evaluateEligibilityDecision(profile, rules);
  if (computed !== targetDecision) return null;

  const profileParts = [];
  if (profile.age !== null) profileParts.push(`is ${profile.age} years old`);
  if (profile.gradPct !== null) profileParts.push(`scored ${profile.gradPct}% in graduation`);
  if (profile.testPct !== null) profileParts.push(`secured ${profile.testPct}% in the written test`);
  if (profile.expYears !== null) {
    profileParts.push(
      profile.expYears === 0
        ? `has no prior work experience`
        : `has ${profile.expYears} year${profile.expYears > 1 ? "s" : ""} of banking work experience`,
    );
  }
  if (profile.pgPct !== null) profileParts.push(`holds a postgraduate degree with ${profile.pgPct}% marks`);

  const criteriaBlock =
    `Conditions for selecting a Credit Officer in a bank:\n` +
    `(i) Be between ${rules.minAge} and ${rules.maxAge} years of age.\n` +
    `(ii) Have secured at least ${rules.minGrad}% marks in graduation.\n` +
    `(iii) Have secured at least ${rules.minTest}% marks in the written test.\n` +
    `(iv) Have at least ${rules.minExp} years of banking work experience.\n` +
    `Exceptions:\n` +
    `(a) If a candidate fulfills all conditions except (ii) above, but holds a postgraduate degree with at least ${rules.minPg}% marks, the case is to be referred to the General Manager.\n` +
    `(b) If a candidate fulfills all conditions except (iv) above, but secured at least ${rules.highTest}% marks in the written test, the case is to be referred to the HR Head.`;

  const questionText =
    `Directions: Study the following eligibility criteria carefully and decide the course of action for the candidate given below.\n\n` +
    `${criteriaBlock}\n\n` +
    `Candidate Profile: ${name} ${profileParts.join(", ")}. What decision should be taken in ${name}'s case?`;

  const options = [
    DECISION_LABELS.SELECT,
    DECISION_LABELS.REJECT,
    DECISION_LABELS.REFER_GM,
    DECISION_LABELS.REFER_HR,
    DECISION_LABELS.DATA_INADEQUATE,
  ];
  const correctIndex = options.indexOf(DECISION_LABELS[computed]);

  const explanation =
    `Evaluating ${name} against (i) Age ${rules.minAge}–${rules.maxAge}, (ii) Graduation ≥${rules.minGrad}%, (iii) Written Test ≥${rules.minTest}%, (iv) Experience ≥${rules.minExp} yrs and exceptions (a)/(b) gives the exact verdict: ${DECISION_LABELS[computed]}.`;

  return {
    topic: "Logical Reasoning",
    subType: "DECISION_MAKING_ELIGIBILITY",
    subtopicName: LOGICAL_REASONING_SUBTOPICS.DECISION_MAKING_ELIGIBILITY,
    difficulty,
    questionText,
    options,
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType: "DECISION_MAKING_ELIGIBILITY", profile, rules },
  };
}
