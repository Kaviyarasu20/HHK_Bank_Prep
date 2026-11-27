/**
 * Modular Banking Exam Statement & Conclusion Question Builder
 *
 * Covers 5 real IBPS / SBI / RRB / RBI exam subtopics:
 * 1. BANKING_POLICY_SC      — Banking, monetary policy & digital payments conclusions
 * 2. QUANTITATIVE_DATA_SC   — Exact math-verified numeric/share/threshold conclusions
 * 3. CONDITIONAL_LOGIC_SC   — Exact propositional If-Then (Modus Ponens/Tollens + Either-Or)
 * 4. CIVIC_POLICY_SC        — Civic, urban transit, infrastructure & public policy conclusions
 * 5. CORPORATE_WORKPLACE_SC — Corporate HR, audit, productivity & compliance conclusions
 */

import {
  entailsUnderImplication,
  evaluateConclusionVerdict,
  evaluateQuantClaim,
  isEitherOrUnderImplication,
  SC_OPTIONS,
  VERDICT_ORDER,
} from "./solver.js";

export const STATEMENT_CONCLUSION_SUBTOPICS = {
  BANKING_POLICY_SC: "Banking & Economic Policy Conclusions",
  QUANTITATIVE_DATA_SC: "Quantitative & Data-Based Conclusions",
  CONDITIONAL_LOGIC_SC: "Conditional & Rule-Based Conclusions",
  CIVIC_POLICY_SC: "Civic & Public Policy Conclusions",
  CORPORATE_WORKPLACE_SC: "Corporate & Workplace Conclusions",
};

export function createScRng(seedInput) {
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
const REGIONS = ["State M", "District K", "Metro Zone A", "Region P", "City R"];
const NAMES = ["Aarav", "Priya", "Rohan", "Kavya", "Vikram", "Neha", "Arjun", "Meera"];

function buildCuratedDualSC({ subType, subtopicName, scenarios, difficulty, targetOutcome, rng }) {
  const sc = rng.pick(scenarios);
  const bank = rng.pick(BANKS);
  const region = rng.pick(REGIONS);
  const pct = rng.int(16, 38);
  const statement = sc.buildStatement(bank, region, pct);

  const outcomes = ["ONLY_I", "ONLY_II", "NEITHER", "BOTH"];
  const chosenOutcome =
    targetOutcome && outcomes.includes(targetOutcome) ? targetOutcome : rng.pick(outcomes);

  const followsI = chosenOutcome === "ONLY_I" || chosenOutcome === "BOTH";
  const followsII = chosenOutcome === "ONLY_II" || chosenOutcome === "BOTH";

  const valids = rng.shuffle(sc.validConclusions);
  const invalids = rng.shuffle(sc.invalidConclusions);

  const cI = followsI ? valids[0] : invalids[0];
  const cII = followsII ? (followsI ? valids[1] : valids[0]) : !followsI ? invalids[1] : invalids[0];

  const verdict = evaluateConclusionVerdict({ followsI, followsII });
  const correctIndex = VERDICT_ORDER.indexOf(verdict);

  const questionText =
    `Directions: In the following question, a statement is given followed by two conclusions I and II. You have to assume everything in the statement to be true and decide which of the given conclusions logically follows.\n\n` +
    `Statement: ${statement}\n\n` +
    `Conclusions:\n` +
    `I. ${cI.text(bank, region, pct)}\n` +
    `II. ${cII.text(bank, region, pct)}`;

  const explanation =
    `Conclusion I ${followsI ? "follows" : "does not follow"}: ${cI.reason}\n` +
    `Conclusion II ${followsII ? "follows" : "does not follow"}: ${cII.reason}\n` +
    `Hence, ${SC_OPTIONS[correctIndex]}.`;

  return {
    topic: "Statement & Conclusion",
    subType,
    subtopicName,
    difficulty,
    questionText,
    options: [...SC_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType, mode: "CURATED_DUAL", followsI, followsII, eitherOr: false },
  };
}

// ============================================================================
// 1. BANKING & ECONOMIC POLICY SCENARIOS
// ============================================================================
const BANKING_SCENARIOS = [
  {
    buildStatement: (b, r, pct) =>
      `The central bank raised the policy repo rate by 50 basis points to curb persistent retail inflation, prompting ${b} to increase its floating-rate home loan interest rates across ${r} by ${pct} basis points.`,
    validConclusions: [
      {
        text: (b) => `Borrowers with existing floating-rate home loans at ${b} will face higher interest costs or longer repayment tenures.`,
        reason: "Directly follows from an increase in floating-rate home loan interest rates.",
      },
      {
        text: () => `Controlling persistent retail inflation was a stated objective behind the central bank's repo rate hike.`,
        reason: "Explicitly stated in the opening clause of the statement.",
      },
    ],
    invalidConclusions: [
      {
        text: () => `Retail inflation across the entire country will drop to zero within one month.`,
        reason: "Extreme, unstated prediction not supported by the statement.",
      },
      {
        text: (b) => `${b} has stopped offering fixed-rate deposits to all its customers.`,
        reason: "Out-of-scope claim; fixed-rate deposits are never mentioned.",
      },
    ],
  },
  {
    buildStatement: (b, r, pct) =>
      `Over ${pct}% of small merchants in ${r} adopted QR-based instant digital payments offered by ${b} within six months of zero-MDR (Merchant Discount Rate) onboarding.`,
    validConclusions: [
      {
        text: (b, r) => `Zero-MDR onboarding accompanied measurable adoption of ${b}'s QR payment service among small merchants in ${r}.`,
        reason: "Directly entailed by the stated adoption figure following zero-MDR onboarding.",
      },
      {
        text: (b, r) => `Not all small merchants in ${r} have adopted ${b}'s QR-based digital payments yet.`,
        reason: "Since adoption is between 16% and 38%, the remaining majority has not adopted it.",
      },
    ],
    invalidConclusions: [
      {
        text: (_b, r) => `Cash transactions have been completely eliminated across ${r}.`,
        reason: "Extreme leap contradicting the partial adoption percentage.",
      },
      {
        text: (b, r) => `${b} is the only bank permitted to issue payment QR codes in ${r}.`,
        reason: "Unwarranted exclusivity ('only') not mentioned in the statement.",
      },
    ],
  },
  {
    buildStatement: (b, r, pct) =>
      `In its quarterly review, ${b} reported that automating KYC verification cut new account activation time in ${r} by ${pct}%, while manual review was still retained for high-risk corporate accounts.`,
    validConclusions: [
      {
        text: (b, r) => `Automated KYC verification sped up new account activation at ${b} in ${r}.`,
        reason: "Directly restated from the reported percentage reduction in activation time.",
      },
      {
        text: (b) => `High-risk corporate accounts at ${b} are not processed solely through automated KYC without manual review.`,
        reason: "Directly follows from retaining manual review for high-risk corporate accounts.",
      },
    ],
    invalidConclusions: [
      {
        text: (b) => `${b} dismissed all its compliance officers after introducing automated KYC.`,
        reason: "Contradicted by the retention of manual review and completely unstated.",
      },
      {
        text: () => `Manual KYC verification is always faster than automated digital verification.`,
        reason: "Directly contradicts the statement.",
      },
    ],
  },
  {
    buildStatement: (b, r, pct) =>
      `Due to higher provisioning for stressed agricultural loans in ${r}, ${b}'s net profit declined by ${pct}% in Q3 even though its net interest income rose steadily.`,
    validConclusions: [
      {
        text: (b) => `Rising net interest income alone was not sufficient to prevent a decline in ${b}'s Q3 net profit.`,
        reason: "Directly entailed because net profit fell despite steady growth in net interest income.",
      },
      {
        text: (b, r) => `Stressed agricultural loans in ${r} required higher provisioning by ${b} during Q3.`,
        reason: "Explicitly stated as the reason for the decline in net profit.",
      },
    ],
    invalidConclusions: [
      {
        text: (b) => `${b} suffered a net operating loss in every quarter of the last five years.`,
        reason: "Unsupported multi-year extrapolation; a profit decline is not even a net loss.",
      },
      {
        text: (b, r) => `${b} will permanently stop lending to farmers in ${r} next quarter.`,
        reason: "Speculative future action not stated in the premise.",
      },
    ],
  },
];

export function buildBankingPolicySC({ difficulty = "Medium", targetOutcome = null, rng }) {
  return buildCuratedDualSC({
    subType: "BANKING_POLICY_SC",
    subtopicName: STATEMENT_CONCLUSION_SUBTOPICS.BANKING_POLICY_SC,
    scenarios: BANKING_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}

// ============================================================================
// 2. QUANTITATIVE & DATA-BASED CONCLUSIONS (100% EXACT NUMERIC SOLVER)
// ============================================================================
export function buildQuantitativeDataSC({ difficulty = "Medium", rng }) {
  const bank = rng.pick(BANKS);
  const region = rng.pick(REGIONS);
  const a = rng.int(120, 480); // Retail loans (₹ crore)
  let b = rng.int(120, 480);   // Corporate loans (₹ crore)
  if (a === b) b += 25;

  const total = a + b;
  const diff = Math.abs(a - b);
  const tAbove = total - rng.int(15, 45);
  const tBelow = total + rng.int(15, 45);
  const dBelow = Math.max(5, diff - rng.int(5, 15));
  const dAbove = diff + rng.int(10, 30);

  const claimPool = [
    {
      claim: { type: "A_SHARE_GT_50" },
      text: `Retail loans accounted for more than 50% of the combined retail and corporate loan disbursement by ${bank} in ${region}.`,
    },
    {
      claim: { type: "B_SHARE_GT_50" },
      text: `Corporate loans accounted for more than 50% of the combined retail and corporate loan disbursement by ${bank} in ${region}.`,
    },
    {
      claim: { type: "TOTAL_GT_T", threshold: tAbove },
      text: `The combined retail and corporate loan disbursement by ${bank} in ${region} exceeded ₹${tAbove} crore.`,
    },
    {
      claim: { type: "TOTAL_LT_T", threshold: tAbove },
      text: `The combined retail and corporate loan disbursement by ${bank} in ${region} was less than ₹${tAbove} crore.`,
    },
    {
      claim: { type: "TOTAL_GT_T", threshold: tBelow },
      text: `The combined retail and corporate loan disbursement by ${bank} in ${region} exceeded ₹${tBelow} crore.`,
    },
    {
      claim: { type: "DIFF_GT_D", threshold: dBelow },
      text: `The difference between retail and corporate loan disbursements was more than ₹${dBelow} crore.`,
    },
    {
      claim: { type: "DIFF_GT_D", threshold: dAbove },
      text: `The difference between retail and corporate loan disbursements was more than ₹${dAbove} crore.`,
    },
  ];

  const [c1, c2] = rng.shuffle(claimPool).slice(0, 2);
  // Avoid mutually contradictory pair if we want clean independent evaluation
  const data = { a, b };
  const followsI = evaluateQuantClaim(data, c1.claim);
  const followsII = evaluateQuantClaim(data, c2.claim);
  const verdict = evaluateConclusionVerdict({ followsI, followsII });
  const correctIndex = VERDICT_ORDER.indexOf(verdict);

  const statement =
    `In FY 2025–26, ${bank} disbursed ₹${a} crore in retail loans and ₹${b} crore in corporate loans across ${region}.`;

  const questionText =
    `Directions: Study the following factual statement and decide which of the given conclusions logically follows.\n\n` +
    `Statement: ${statement}\n\n` +
    `Conclusions:\n` +
    `I. ${c1.text}\n` +
    `II. ${c2.text}`;

  const explanation =
    `Given Retail = ₹${a} crore, Corporate = ₹${b} crore → Combined total = ₹${total} crore, difference = ₹${diff} crore. ` +
    `Conclusion I is ${followsI ? "true (follows)" : "false (does not follow)"}; Conclusion II is ${followsII ? "true (follows)" : "false (does not follow)"}. ` +
    `Hence, ${SC_OPTIONS[correctIndex]}.`;

  return {
    topic: "Statement & Conclusion",
    subType: "QUANTITATIVE_DATA_SC",
    subtopicName: STATEMENT_CONCLUSION_SUBTOPICS.QUANTITATIVE_DATA_SC,
    difficulty,
    questionText,
    options: [...SC_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType: "QUANTITATIVE_DATA_SC", data, claim1: c1.claim, claim2: c2.claim },
  };
}

// ============================================================================
// 3. CONDITIONAL & RULE-BASED CONCLUSIONS (100% PROPOSITIONAL LOGIC SOLVER)
// ============================================================================
export function buildConditionalLogicSC({ difficulty = "Hard", rng }) {
  const name = rng.pick(NAMES);
  const bank = rng.pick(BANKS);

  const ruleTemplates = [
    {
      ruleText: `At ${bank}, if an applicant maintains a credit score of at least 750, their education loan receives fast-track approval.`,
      P: `${name} maintained a credit score of at least 750`,
      NOT_P: `${name} did not maintain a credit score of at least 750`,
      Q: `${name}'s education loan received fast-track approval`,
      NOT_Q: `${name}'s education loan did not receive fast-track approval`,
    },
    {
      ruleText: `In ${bank}'s internal audit policy, if a branch completes 100% digital KYC reconciliation, it qualifies for the Excellence Award.`,
      P: `${name}'s branch completed 100% digital KYC reconciliation`,
      NOT_P: `${name}'s branch did not complete 100% digital KYC reconciliation`,
      Q: `${name}'s branch qualified for the Excellence Award`,
      NOT_Q: `${name}'s branch did not qualify for the Excellence Award`,
    },
    {
      ruleText: `Under the bank's scholarship scheme, if a student secures above 90% in the national test, they receive a full tuition waiver.`,
      P: `${name} secured above 90% in the national test`,
      NOT_P: `${name} did not secure above 90% in the national test`,
      Q: `${name} received a full tuition waiver`,
      NOT_Q: `${name} did not receive a full tuition waiver`,
    },
  ];

  const tpl = rng.pick(ruleTemplates);
  const textOf = (lit) => tpl[lit];

  // Choose an informative scenario (including Either-Or when fact is Q or NOT_P!)
  const patterns = [
    // Modus Ponens (fact = P): Q follows, NOT_Q fails -> ONLY_I
    { fact: "P", q1: "Q", q2: "NOT_Q" },
    // Modus Tollens (fact = NOT_Q): NOT_P follows, P fails -> ONLY_II
    { fact: "NOT_Q", q1: "P", q2: "NOT_P" },
    // Affirming the consequent (fact = Q): neither P nor NOT_P follows individually -> EITHER_OR!
    { fact: "Q", q1: "P", q2: "NOT_P" },
    // Denying the antecedent (fact = NOT_P): neither Q nor NOT_Q follows individually -> EITHER_OR!
    { fact: "NOT_P", q1: "Q", q2: "NOT_Q" },
    // Fallacy test (fact = Q): P does not follow, NOT_Q does not follow -> NEITHER
    { fact: "Q", q1: "P", q2: "NOT_Q" },
    // Modus Ponens both valid (fact = P): P and Q both follow -> BOTH
    { fact: "P", q1: "Q", q2: "P" },
  ];

  const pat = rng.pick(patterns);
  const followsI = entailsUnderImplication(pat.fact, pat.q1);
  const followsII = entailsUnderImplication(pat.fact, pat.q2);
  const eitherOr = isEitherOrUnderImplication(pat.fact, pat.q1, pat.q2);
  const verdict = evaluateConclusionVerdict({ followsI, followsII, eitherOr });
  const correctIndex = VERDICT_ORDER.indexOf(verdict);

  const questionText =
    `Directions: Study the given statement (rule and observed fact) carefully and decide which of the conclusions logically follows.\n\n` +
    `Statement: ${tpl.ruleText} It is observed that ${textOf(pat.fact)}.\n\n` +
    `Conclusions:\n` +
    `I. ${textOf(pat.q1)}.\n` +
    `II. ${textOf(pat.q2)}.`;

  const explanation =
    `Using exact conditional logic (P → Q) with observed fact '${pat.fact}': ` +
    `Conclusion I ('${pat.q1}') ${followsI ? "definitely follows" : "does not definitely follow"}, ` +
    `Conclusion II ('${pat.q2}') ${followsII ? "definitely follows" : "does not definitely follow"}` +
    `${eitherOr ? ", and together they form an exhaustive complementary pair (Either I or II must hold)" : ""}. ` +
    `Hence, ${SC_OPTIONS[correctIndex]}.`;

  return {
    topic: "Statement & Conclusion",
    subType: "CONDITIONAL_LOGIC_SC",
    subtopicName: STATEMENT_CONCLUSION_SUBTOPICS.CONDITIONAL_LOGIC_SC,
    difficulty,
    questionText,
    options: [...SC_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType: "CONDITIONAL_LOGIC_SC", fact: pat.fact, q1: pat.q1, q2: pat.q2 },
  };
}

// ============================================================================
// 4. CIVIC & PUBLIC POLICY SCENARIOS
// ============================================================================
const CIVIC_SCENARIOS = [
  {
    buildStatement: (_b, r, pct) =>
      `After ${r} introduced dedicated electric bus lanes along its main arterial corridor, average commuter travel time fell by ${pct}% during morning peak hours.`,
    validConclusions: [
      {
        text: (_b, r) => `Morning peak-hour commuters using the main arterial corridor in ${r} experienced faster travel after dedicated bus lanes were introduced.`,
        reason: "Directly follows from the stated reduction in average commuter travel time.",
      },
      {
        text: (_b, r) => `Dedicated electric bus lanes were implemented along the main arterial corridor of ${r}.`,
        reason: "Explicitly stated as a factual premise.",
      },
    ],
    invalidConclusions: [
      {
        text: (_b, r) => `Traffic congestion has been permanently eliminated on every road in ${r}.`,
        reason: "Over-generalizes from one corridor to every road permanently.",
      },
      {
        text: () => `Electric buses cost less to manufacture than diesel buses.`,
        reason: "Unstated manufacturing-cost claim.",
      },
    ],
  },
  {
    buildStatement: (_b, r, pct) =>
      `A public-health audit in ${r} showed that districts installing solar-powered cold-chain units reduced vaccine spoilage by ${pct}% over twelve months.`,
    validConclusions: [
      {
        text: (_b, r) => `Solar-powered cold-chain units were associated with lower vaccine spoilage in audited districts of ${r}.`,
        reason: "Directly entailed by the audit findings.",
      },
      {
        text: (_b, r) => `Vaccine spoilage had been occurring in those districts of ${r} prior to installing the solar cold-chain units.`,
        reason: "A percentage reduction in spoilage entails spoilage existed beforehand.",
      },
    ],
    invalidConclusions: [
      {
        text: (_b, r) => `All hospitals in ${r} now run 100% on solar power.`,
        reason: "Extreme generalization beyond cold-chain units.",
      },
      {
        text: () => `Traditional grid electricity is never used anywhere in healthcare.`,
        reason: "Unsupported absolute claim ('never').",
      },
    ],
  },
];

export function buildCivicPolicySC({ difficulty = "Easy", targetOutcome = null, rng }) {
  return buildCuratedDualSC({
    subType: "CIVIC_POLICY_SC",
    subtopicName: STATEMENT_CONCLUSION_SUBTOPICS.CIVIC_POLICY_SC,
    scenarios: CIVIC_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}

// ============================================================================
// 5. CORPORATE & WORKPLACE POLICY SCENARIOS
// ============================================================================
const CORPORATE_SCENARIOS = [
  {
    buildStatement: (b, r, pct) =>
      `${b} shifted its back-office IT teams in ${r} to a four-day office plus one-day remote hybrid model, resulting in a ${pct}% drop in unplanned absenteeism without affecting project deadlines.`,
    validConclusions: [
      {
        text: (b, r) => `Back-office IT project deadlines at ${b} in ${r} were maintained under the hybrid work model.`,
        reason: "Explicitly stated ('without affecting project deadlines').",
      },
      {
        text: (b) => `Unplanned absenteeism among ${b}'s back-office IT staff decreased after introducing the hybrid schedule.`,
        reason: "Directly stated in the premise.",
      },
    ],
    invalidConclusions: [
      {
        text: (b) => `${b} has permanently closed all its physical branches and offices.`,
        reason: "Contradicts the four-day office schedule and over-generalizes beyond IT.",
      },
      {
        text: () => `Every employee in the banking sector prefers working remotely five days a week.`,
        reason: "Unsupported generalization.",
      },
    ],
  },
  {
    buildStatement: (b, r, pct) =>
      `Mandatory bi-annual cybersecurity workshops for frontline branch staff at ${b} in ${r} led to a ${pct}% rise in timely reporting of suspicious email attachments.`,
    validConclusions: [
      {
        text: (b, r) => `Frontline branch staff at ${b} in ${r} reported suspicious email attachments more promptly after attending the workshops.`,
        reason: "Directly follows from the stated rise in timely reporting.",
      },
      {
        text: (b) => `${b} conducts cybersecurity workshops for its frontline branch staff twice a year.`,
        reason: "Directly follows from 'mandatory bi-annual cybersecurity workshops'.",
      },
    ],
    invalidConclusions: [
      {
        text: (b) => `${b} will never face another cyberattack in the future.`,
        reason: "Unwarranted absolute guarantee ('never').",
      },
      {
        text: () => `Only frontline branch staff ever receive suspicious emails.`,
        reason: "Unsupported exclusivity ('only').",
      },
    ],
  },
];

export function buildCorporateWorkplaceSC({ difficulty = "Easy", targetOutcome = null, rng }) {
  return buildCuratedDualSC({
    subType: "CORPORATE_WORKPLACE_SC",
    subtopicName: STATEMENT_CONCLUSION_SUBTOPICS.CORPORATE_WORKPLACE_SC,
    scenarios: CORPORATE_SCENARIOS,
    difficulty,
    targetOutcome,
    rng,
  });
}
