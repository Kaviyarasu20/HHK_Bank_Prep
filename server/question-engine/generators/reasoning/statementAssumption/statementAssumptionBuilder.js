/**
 * Modular Banking Exam Statement & Assumption Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. PUBLIC_NOTICE_SA      — Warnings, advisories, civic appeals & safety notices
 * 2. BANKING_OFFER_SA      — Banking product offers, loan campaigns & digital ads
 * 3. POLICY_DIRECTIVE_SA   — Regulatory mandates, e-KYC rules & public-policy circulars
 * 4. MANAGEMENT_DECISION_SA — Corporate HR, training, branch staffing & IT decisions
 * 5. THRESHOLD_POLICY_SA   — Parameterized numeric-threshold fee/benefit rules
 */

import { evaluateAssumptionVerdict, SA_OPTIONS, VERDICT_ORDER } from "./solver.js";

export const STATEMENT_ASSUMPTION_SUBTOPICS = {
  PUBLIC_NOTICE_SA: "Public Notices, Warnings & Appeals",
  BANKING_OFFER_SA: "Banking Offers & Advertisements",
  POLICY_DIRECTIVE_SA: "Policy & Regulatory Directives",
  MANAGEMENT_DECISION_SA: "Management & HR Decisions",
  THRESHOLD_POLICY_SA: "Quantitative Threshold Policies",
};

export function createSaRng(seedInput) {
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

const BANKS = ["Bank X", "Apex National Bank", "Horizon Bank", "Metro Bank", "Union Commercial Bank"];
const REGIONS = ["State M", "District K", "Metro Zone A", "City P", "Region R"];

function buildFromScenarios({ subType, subtopicName, scenarios, difficulty, targetOutcome, rng }) {
  const sc = rng.pick(scenarios);
  const bank = rng.pick(BANKS);
  const region = rng.pick(REGIONS);
  const num = rng.int(15, 45);
  const statement = sc.buildStatement(bank, region, num);

  const outcomes = ["ONLY_I", "ONLY_II", "NEITHER", "BOTH"];
  const chosenOutcome =
    targetOutcome && outcomes.includes(targetOutcome) ? targetOutcome : rng.pick(outcomes);

  const implicitI = chosenOutcome === "ONLY_I" || chosenOutcome === "BOTH";
  const implicitII = chosenOutcome === "ONLY_II" || chosenOutcome === "BOTH";

  const valids = rng.shuffle(sc.implicitAssumptions);
  const invalids = rng.shuffle(sc.nonImplicitAssumptions);

  const aI = implicitI ? valids[0] : invalids[0];
  const aII = implicitII ? (implicitI ? valids[1] : valids[0]) : !implicitI ? invalids[1] : invalids[0];

  const verdict = evaluateAssumptionVerdict({ implicitI, implicitII });
  const correctIndex = VERDICT_ORDER.indexOf(verdict);

  const questionText =
    `Directions: In the following question, a statement is given followed by two assumptions numbered I and II. Consider the statement and decide which of the given assumptions is implicit in the statement.\n\n` +
    `Statement: ${statement}\n\n` +
    `Assumptions:\n` +
    `I. ${aI.text(bank, region, num)}\n` +
    `II. ${aII.text(bank, region, num)}`;

  const explanation =
    `Assumption I is ${implicitI ? "implicit" : "not implicit"}: ${aI.reason}\n` +
    `Assumption II is ${implicitII ? "implicit" : "not implicit"}: ${aII.reason}\n` +
    `Hence, ${SA_OPTIONS[correctIndex]}.`;

  return {
    topic: "Statement & Assumption",
    subType,
    subtopicName,
    difficulty,
    questionText,
    options: [...SA_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType, implicitI, implicitII, eitherOr: false },
  };
}

// 1. Public Notices, Warnings & Appeals
const PUBLIC_NOTICE_SCENARIOS = [
  {
    buildStatement: (b) =>
      `A public advisory issued by ${b} states: "Never share your OTP, CVV, or UPI PIN with anyone claiming to be a bank official over phone or SMS."`,
    implicitAssumptions: [
      {
        text: (b) => `Some customers of ${b} may receive fraudulent calls or messages from impostors pretending to be bank officials.`,
        reason: "The warning is only meaningful if such impersonation attempts can occur.",
      },
      {
        text: () => `Customers who read the advisory are likely to become more cautious about protecting their credentials.`,
        reason: "Every public safety advisory implicitly assumes its target audience may heed the advice.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: () => `No customer will ever fall victim to financial fraud again after this advisory.`,
        reason: "Extreme absolute guarantee ('never') is not implicit in a precautionary warning.",
      },
      {
        text: (b) => `${b} is the only bank whose customers face phishing attempts.`,
        reason: "Unwarranted exclusivity ('only') not implied by the advisory.",
      },
    ],
  },
  {
    buildStatement: (_b, r) =>
      `A municipal notice in ${r} reads: "Please segregate dry and wet household waste before handing it to collection vans to help keep the city clean."`,
    implicitAssumptions: [
      {
        text: (_b, r) => `Residents of ${r} are capable of separating dry and wet waste at home.`,
        reason: "An appeal implicitly assumes the audience can perform the requested action.",
      },
      {
        text: () => `Proper waste segregation contributes toward keeping the city cleaner.`,
        reason: "Directly presupposed by the stated purpose ('to help keep the city clean').",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: (_b, r) => `Every resident of ${r} currently refuses to use municipal collection vans.`,
        reason: "Extreme claim not implied by a request to segregate waste.",
      },
      {
        text: () => `Other cities do not have any waste-collection systems.`,
        reason: "Out-of-scope comparison with other cities.",
      },
    ],
  },
  {
    buildStatement: (_b, r, num) =>
      `Traffic police in ${r} put up signboards stating: "Overspeeding beyond ${num + 35} km/h on this expressway attracts automated camera fines."`,
    implicitAssumptions: [
      {
        text: () => `Automated speed-enforcement cameras are installed or intended to monitor vehicles on the expressway.`,
        reason: "Required for the stated penalty mechanism to be credible.",
      },
      {
        text: () => `The prospect of automated fines may deter motorists from overspeeding.`,
        reason: "Standard assumption behind any public deterrence signboard.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: () => `All motorists on the expressway always drive above the speed limit.`,
        reason: "Extreme quantifier ('all', 'always') is never implicit.",
      },
      {
        text: () => `Road accidents occur solely because of overspeeding.`,
        reason: "Unwarranted exclusivity ('solely').",
      },
    ],
  },
];

// 2. Banking Product Offers & Advertisements
const BANKING_OFFER_SCENARIOS = [
  {
    buildStatement: (b, _r, num) =>
      `An advertisement by ${b} reads: "Open a digital savings account in 5 minutes with zero minimum balance and earn up to ${Math.min(7, 4 + (num % 3))}.5% annual interest."`,
    implicitAssumptions: [
      {
        text: () => `Prospective customers are attracted by quick digital onboarding, zero minimum balance, and competitive interest rates.`,
        reason: "Advertisements implicitly assume highlighted features appeal to target customers.",
      },
      {
        text: (b) => `${b} has the digital infrastructure to open savings accounts online rapidly.`,
        reason: "Presupposed by offering 5-minute digital account opening.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: (b) => `Every citizen in the country will close their existing bank accounts and switch to ${b}.`,
        reason: "Extreme, unrealistic assumption ('every citizen').",
      },
      {
        text: () => `No other bank in India offers digital savings accounts.`,
        reason: "Out-of-scope competitor comparison.",
      },
    ],
  },
  {
    buildStatement: (b, r, num) =>
      `${b} announced a festive home-loan campaign in ${r} waiving 100% of processing fees for applications submitted within the next ${num} days.`,
    implicitAssumptions: [
      {
        text: () => `Waiving processing fees is likely to encourage prospective homebuyers to apply during the campaign window.`,
        reason: "Core rationale behind a time-bound promotional fee waiver.",
      },
      {
        text: (b, r) => `There is active demand for home loans among residents of ${r} that ${b} seeks to capture.`,
        reason: "Implicitly assumed whenever launching a regional lending campaign.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: (b) => `${b} will never charge processing fees on any loan ever again.`,
        reason: "Contradicts the explicit time-bound campaign window.",
      },
      {
        text: (_b, r) => `Property prices in ${r} will fall by half immediately after the campaign.`,
        reason: "Unrelated external market assumption.",
      },
    ],
  },
];

// 3. Policy & Regulatory Directives
const POLICY_DIRECTIVE_SCENARIOS = [
  {
    buildStatement: (_b, r, num) =>
      `The state transport authority in ${r} announced a ${num}% road-tax rebate for buyers of electric two-wheelers over the next two years.`,
    implicitAssumptions: [
      {
        text: () => `Lower upfront tax costs may motivate more commuters to choose electric two-wheelers.`,
        reason: "Directly presupposed by offering a financial rebate to influence buyer behavior.",
      },
      {
        text: (_b, r) => `Increasing electric two-wheeler adoption is considered desirable by the authority in ${r}.`,
        reason: "Implicit policy intent behind subsidizing EV purchases.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: (_b, r) => `Petrol two-wheelers will be completely banned in ${r} starting tomorrow.`,
        reason: "Unstated extreme policy leap.",
      },
      {
        text: (_b, r) => `Every household in ${r} can immediately afford to buy a new electric vehicle.`,
        reason: "Extreme quantifier ('every household').",
      },
    ],
  },
  {
    buildStatement: (b, _r, num) =>
      `${b} issued a circular instructing all branches to resolve retail customer grievances within ${Math.max(3, num % 7 + 3)} working days through its centralized digital portal.`,
    implicitAssumptions: [
      {
        text: (b) => `All branches of ${b} have access to the centralized digital grievance portal.`,
        reason: "Necessary operational premise for branches to follow the instruction.",
      },
      {
        text: () => `Timely grievance resolution is achievable within the specified working-day window for routine retail complaints.`,
        reason: "Implicitly assumed when setting a mandatory service deadline.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: (b) => `Customers of ${b} will never have any complaints in the future.`,
        reason: "Extreme and contradicts the need for a grievance portal.",
      },
      {
        text: () => `Branch managers previously ignored every single customer complaint.`,
        reason: "Over-generalized negative accusation not implied by standardizing turnaround time.",
      },
    ],
  },
];

// 4. Management & HR Decisions
const MANAGEMENT_DECISION_SCENARIOS = [
  {
    buildStatement: (b, r, num) =>
      `${b} decided to enroll ${num * 10} junior credit officers in ${r} in a certified financial-risk modeling workshop before the new audit cycle begins.`,
    implicitAssumptions: [
      {
        text: () => `The workshop is expected to improve the officers' financial-risk assessment skills ahead of the audit cycle.`,
        reason: "Necessary purpose behind investing in targeted pre-audit training.",
      },
      {
        text: (b, r) => `The enrolled officers in ${r} can benefit from upgraded risk-modeling training.`,
        reason: "Presupposed by selecting them for the program.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: () => `All junior credit officers currently fail every internal audit.`,
        reason: "Extreme assumption not implied by proactive upskilling.",
      },
      {
        text: () => `Senior executives never need any professional training.`,
        reason: "Out-of-scope comparison with senior executives.",
      },
    ],
  },
  {
    buildStatement: (b) =>
      `To ease peak-hour crowding, ${b} introduced appointment-based booking for locker visits and large cash deposits across its metro branches.`,
    implicitAssumptions: [
      {
        text: (b) => `Locker visits and large cash deposits contribute noticeably to peak-hour crowding at ${b}'s metro branches.`,
        reason: "Implicitly assumed since targeting these services is meant to ease crowding.",
      },
      {
        text: () => `Customers will use the appointment booking system to schedule such visits.`,
        reason: "Operational premise for the system to work.",
      },
    ],
    nonImplicitAssumptions: [
      {
        text: () => `Customers without appointments will be permanently barred from holding accounts.`,
        reason: "Extreme punitive assumption not stated.",
      },
      {
        text: (b) => `${b} has no branches outside metro cities.`,
        reason: "Unwarranted negative inference from scoping the rollout to metro branches.",
      },
    ],
  },
];

// 5. Quantitative Threshold Policies
export function buildThresholdPolicySA({ difficulty = "Hard", targetOutcome = null, rng }) {
  const bank = rng.pick(BANKS);
  const bal = rng.pick([10000, 15000, 20000, 25000]);
  const fee = rng.pick([250, 300, 500]);

  const statement =
    `${bank} notified savings account holders: "Maintain a monthly average balance of at least ₹${bal.toLocaleString("en-IN")} to enjoy free unlimited ATM withdrawals and a waiver of the ₹${fee} annual debit-card fee."`;

  const implicitPool = [
    {
      text: `Some account holders value free ATM withdrawals and the ₹${fee} fee waiver enough to maintain at least ₹${bal.toLocaleString("en-IN")} in their accounts.`,
      reason: "A tiered balance incentive implicitly assumes the benefit motivates eligible customers.",
    },
    {
      text: `${bank} is able to track customers' monthly average balances to apply the fee waiver accurately.`,
      reason: "Necessary operational premise to enforce the stated threshold rule.",
    },
  ];
  const nonImplicitPool = [
    {
      text: `Every single savings account holder at ${bank} already maintains more than ₹${(bal * 2).toLocaleString("en-IN")} in their account.`,
      reason: "Extreme quantifier ('every single') and contradicts the incentive purpose.",
    },
    {
      text: `Account holders with balances below ₹${bal.toLocaleString("en-IN")} will immediately close their accounts at ${bank}.`,
      reason: "Unwarranted speculative reaction not implied by a fee-waiver notice.",
    },
  ];

  const outcomes = ["ONLY_I", "ONLY_II", "NEITHER", "BOTH"];
  const chosenOutcome =
    targetOutcome && outcomes.includes(targetOutcome) ? targetOutcome : rng.pick(outcomes);

  const implicitI = chosenOutcome === "ONLY_I" || chosenOutcome === "BOTH";
  const implicitII = chosenOutcome === "ONLY_II" || chosenOutcome === "BOTH";

  const valids = rng.shuffle(implicitPool);
  const invalids = rng.shuffle(nonImplicitPool);

  const aI = implicitI ? valids[0] : invalids[0];
  const aII = implicitII ? (implicitI ? valids[1] : valids[0]) : !implicitI ? invalids[1] : invalids[0];

  const verdict = evaluateAssumptionVerdict({ implicitI, implicitII });
  const correctIndex = VERDICT_ORDER.indexOf(verdict);

  const questionText =
    `Directions: In the following question, a statement is given followed by two assumptions numbered I and II. Decide which of the given assumptions is implicit in the statement.\n\n` +
    `Statement: ${statement}\n\n` +
    `Assumptions:\n` +
    `I. ${aI.text}\n` +
    `II. ${aII.text}`;

  const explanation =
    `Assumption I is ${implicitI ? "implicit" : "not implicit"}: ${aI.reason}\n` +
    `Assumption II is ${implicitII ? "implicit" : "not implicit"}: ${aII.reason}\n` +
    `Hence, ${SA_OPTIONS[correctIndex]}.`;

  return {
    topic: "Statement & Assumption",
    subType: "THRESHOLD_POLICY_SA",
    subtopicName: STATEMENT_ASSUMPTION_SUBTOPICS.THRESHOLD_POLICY_SA,
    difficulty,
    questionText,
    options: [...SA_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType: "THRESHOLD_POLICY_SA", implicitI, implicitII, eitherOr: false },
  };
}

export function buildPublicNoticeSA({ difficulty = "Easy", targetOutcome = null, rng }) {
  return buildFromScenarios({
    subType: "PUBLIC_NOTICE_SA",
    subtopicName: STATEMENT_ASSUMPTION_SUBTOPICS.PUBLIC_NOTICE_SA,
    scenarios: PUBLIC_NOTICE_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}

export function buildBankingOfferSA({ difficulty = "Medium", targetOutcome = null, rng }) {
  return buildFromScenarios({
    subType: "BANKING_OFFER_SA",
    subtopicName: STATEMENT_ASSUMPTION_SUBTOPICS.BANKING_OFFER_SA,
    scenarios: BANKING_OFFER_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}

export function buildPolicyDirectiveSA({ difficulty = "Medium", targetOutcome = null, rng }) {
  return buildFromScenarios({
    subType: "POLICY_DIRECTIVE_SA",
    subtopicName: STATEMENT_ASSUMPTION_SUBTOPICS.POLICY_DIRECTIVE_SA,
    scenarios: POLICY_DIRECTIVE_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}

export function buildManagementDecisionSA({ difficulty = "Hard", targetOutcome = null, rng }) {
  return buildFromScenarios({
    subType: "MANAGEMENT_DECISION_SA",
    subtopicName: STATEMENT_ASSUMPTION_SUBTOPICS.MANAGEMENT_DECISION_SA,
    scenarios: MANAGEMENT_DECISION_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}
