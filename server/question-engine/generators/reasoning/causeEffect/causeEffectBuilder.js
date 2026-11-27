/**
 * Modular Banking Exam Cause & Effect Question Builder
 *
 * Uses an exact Directed Causal Graph across 5 banking-exam domains so all 5
 * standard verdicts (A–E) are generated cleanly and mathematically verified:
 * 1. BANKING_MACRO_CE — Banking, monetary policy & markets
 * 2. AGRI_WEATHER_CE  — Agriculture, monsoon & rural economy
 * 3. INFRA_TRANSIT_CE — Urban infrastructure & transport
 * 4. CYBER_TECH_CE    — Cybersecurity, telecom & digital operations
 * 5. CIVIC_SOCIAL_CE  — Public health, education & civic administration
 */

import { CE_OPTIONS, CE_VERDICT_ORDER, classifyCausalRelation } from "./solver.js";

export const CAUSE_EFFECT_SUBTOPICS = {
  BANKING_MACRO_CE: "Banking & Monetary Policy Cause–Effect",
  AGRI_WEATHER_CE: "Agriculture & Weather Cause–Effect",
  INFRA_TRANSIT_CE: "Infrastructure & Transit Cause–Effect",
  CYBER_TECH_CE: "Cybersecurity & Digital Ops Cause–Effect",
  CIVIC_SOCIAL_CE: "Civic & Public Administration Cause–Effect",
};

export function createCeRng(seedInput) {
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

const REGIONS = ["State M", "District K", "Metro Zone A", "City P", "Region R"];
const BANKS = ["Bank X", "Apex National Bank", "Horizon Bank", "Metro Bank"];

const CAUSAL_SCENARIOS = [
  // 1. BANKING_MACRO_CE
  {
    id: "REPO_HIKE",
    domain: "BANKING_MACRO_CE",
    cause: (_b, _r, n) =>
      `The central bank raised the policy repo rate by ${25 + (n % 3) * 25} basis points this quarter to tighten liquidity.`,
    effects: [
      (b) => `${b} increased interest rates on new and existing floating-rate home and auto loans.`,
      (b) => `Fixed-deposit interest rates offered by ${b} and peer commercial banks moved upward across 1-to-3-year tenures.`,
    ],
    commonCauseSummary: "the central bank's repo rate hike",
  },
  {
    id: "NPA_SPIKE",
    domain: "BANKING_MACRO_CE",
    cause: (b, r, n) =>
      `Several large corporate borrowers in ${r} defaulted on consecutive quarterly debt repayments owed to ${b} over the past ${n % 3 + 2} quarters.`,
    effects: [
      (b) => `${b} had to set aside significantly higher loan-loss provisions, reducing its quarterly net profit.`,
      (b, r) => `${b} tightened collateral requirements and credit-appraisal norms for corporate borrowers in ${r}.`,
    ],
    commonCauseSummary: "consecutive corporate loan defaults",
  },
  // 2. AGRI_WEATHER_CE
  {
    id: "DEFICIENT_MONSOON",
    domain: "AGRI_WEATHER_CE",
    cause: (_b, r, n) =>
      `${r} received ${30 + (n % 15)}% below-normal monsoon rainfall during the critical sowing months of June and July.`,
    effects: [
      (_b, r) => `Major irrigation reservoirs across ${r} dropped to less than half of their seasonal storage capacity.`,
      (_b, r) => `Wholesale prices of pulses and leafy vegetables surged sharply across retail markets in ${r}.`,
    ],
    commonCauseSummary: "deficient monsoon rainfall during the sowing season",
  },
  {
    id: "BUMPER_HARVEST",
    domain: "AGRI_WEATHER_CE",
    cause: (_b, r, n) =>
      `Favorable winter temperatures and timely canal irrigation produced a record ${15 + (n % 12)}% bumper wheat harvest across ${r}.`,
    effects: [
      (_b, r) => `State procurement agencies in ${r} opened additional temporary grain storage godowns to handle incoming arrivals.`,
      (_b, r) => `Domestic wheat flour prices stabilized across urban retail centers in ${r}.`,
    ],
    commonCauseSummary: "the record bumper wheat harvest",
  },
  // 3. INFRA_TRANSIT_CE
  {
    id: "METRO_CORRIDOR",
    domain: "INFRA_TRANSIT_CE",
    cause: (_b, r, n) =>
      `The civic transport authority commissioned a new ${18 + (n % 10)}-km elevated metro rail corridor linking the IT hub to the central railway station in ${r}.`,
    effects: [
      (_b, r) => `Peak-hour private car congestion along the parallel arterial highway in ${r} declined noticeably.`,
      (_b, r) => `Daily ridership on feeder electric buses near the newly opened metro stations in ${r} jumped sharply.`,
    ],
    commonCauseSummary: "the opening of the new elevated metro rail corridor",
  },
  {
    id: "BRIDGE_REPAIR",
    domain: "INFRA_TRANSIT_CE",
    cause: (_b, r, n) =>
      `Structural engineers closed the main four-lane river bridge in ${r} for ${n % 4 + 3} weeks to carry out urgent girder reinforcement.`,
    effects: [
      (_b, r) => `Heavy commercial trucks in ${r} were diverted onto the outer ring road, lengthening freight delivery times.`,
      (_b, r) => `Suburban commuter trains serving the river-crossing corridor in ${r} recorded a sudden surge in ticket sales.`,
    ],
    commonCauseSummary: "the temporary closure of the main river bridge for repairs",
  },
  // 4. CYBER_TECH_CE
  {
    id: "CORE_SERVER_OUTAGE",
    domain: "CYBER_TECH_CE",
    cause: (b, _r, n) =>
      `A faulty database firmware patch triggered a ${n % 3 + 3}-hour outage in ${b}'s primary core-banking data center.`,
    effects: [
      (b) => `Thousands of ${b} customers experienced failed UPI and mobile-banking fund transfers throughout the afternoon.`,
      (b) => `${b}'s customer-care helpline recorded a massive spike in complaint tickets and social-media escalations.`,
    ],
    commonCauseSummary: "the primary core-banking data center outage",
  },
  {
    id: "PHISHING_WAVE",
    domain: "CYBER_TECH_CE",
    cause: (_b, r, n) =>
      `Cyber-crime investigators detected a coordinated wave of fake KYC-update SMS links targeting mobile banking users in ${r} over the last ${n % 4 + 2} weeks.`,
    effects: [
      (b, r) => `${b} issued urgent in-app alerts warning depositors in ${r} never to click unverified KYC links.`,
      (_b, r) => `Telecom regulators in ${r} blacklisted hundreds of unregistered bulk-SMS headers used by fraudsters.`,
    ],
    commonCauseSummary: "the coordinated wave of fake KYC-update SMS phishing links",
  },
  // 5. CIVIC_SOCIAL_CE
  {
    id: "HEATWAVE_ALERT",
    domain: "CIVIC_SOCIAL_CE",
    cause: (_b, r, n) =>
      `Daytime temperatures across ${r} remained above ${43 + (n % 4)}°C for ten consecutive days due to an intense summer heatwave.`,
    effects: [
      (_b, r) => `Peak afternoon electricity demand in ${r} hit an all-time high as air-conditioning usage surged.`,
      (_b, r) => `The education department in ${r} advanced summer vacations for all primary and middle schools by two weeks.`,
    ],
    commonCauseSummary: "the prolonged severe summer heatwave",
  },
  {
    id: "PIPELINE_RUPTURE",
    domain: "CIVIC_SOCIAL_CE",
    cause: (_b, r) =>
      `A major municipal trunk water pipeline burst near the northern pumping station in ${r} during underground cable-laying work.`,
    effects: [
      (_b, r) => `Piped drinking-water supply remained suspended for 36 hours across twelve residential wards of ${r}.`,
      (_b, r) => `Residents in the affected wards of ${r} relied heavily on emergency municipal water tankers.`,
    ],
    commonCauseSummary: "the rupture of the major municipal trunk water pipeline",
  },
];

export function buildCauseEffectQuestion({
  subtopicKey = "BANKING_MACRO_CE",
  difficulty = "Medium",
  targetVerdict = null,
  rng,
}) {
  const domainScenarios = CAUSAL_SCENARIOS.filter((s) => s.domain === subtopicKey);
  const primary = rng.pick(domainScenarios.length > 0 ? domainScenarios : CAUSAL_SCENARIOS);
  const otherDomainPool = CAUSAL_SCENARIOS.filter((s) => s.domain !== primary.domain);
  const secondary = rng.pick(otherDomainPool);

  const bank1 = rng.pick(BANKS);
  const bank2 = rng.pick(BANKS.filter((b) => b !== bank1));
  const region1 = rng.pick(REGIONS);
  const region2 = rng.pick(REGIONS.filter((r) => r !== region1));
  const n1 = rng.int(10, 40);
  const n2 = rng.int(10, 40);

  const verdict =
    targetVerdict && CE_VERDICT_ORDER.includes(targetVerdict)
      ? targetVerdict
      : rng.pick(CE_VERDICT_ORDER);

  let textI = "";
  let textII = "";
  let nodeI = null;
  let nodeII = null;
  let explanation = "";

  if (verdict === "I_CAUSES_II") {
    const slot = rng.pick([0, 1]);
    textI = primary.cause(bank1, region1, n1);
    textII = primary.effects[slot](bank1, region1, n1);
    nodeI = { scenarioId: primary.id, role: "CAUSE" };
    nodeII = { scenarioId: primary.id, role: "EFFECT", effectSlot: slot };
    explanation = `Statement I directly triggers Statement II. Hence, ${CE_OPTIONS[0]}.`;
  } else if (verdict === "II_CAUSES_I") {
    const slot = rng.pick([0, 1]);
    textI = primary.effects[slot](bank1, region1, n1);
    textII = primary.cause(bank1, region1, n1);
    nodeI = { scenarioId: primary.id, role: "EFFECT", effectSlot: slot };
    nodeII = { scenarioId: primary.id, role: "CAUSE" };
    explanation = `Statement II directly triggers Statement I. Hence, ${CE_OPTIONS[1]}.`;
  } else if (verdict === "INDEPENDENT_CAUSES") {
    textI = primary.cause(bank1, region1, n1);
    textII = secondary.cause(bank2, region2, n2);
    nodeI = { scenarioId: primary.id, role: "CAUSE" };
    nodeII = { scenarioId: secondary.id, role: "CAUSE" };
    explanation = `Both statements describe distinct triggering events in unrelated domains with no causal link between them. Hence, ${CE_OPTIONS[2]}.`;
  } else if (verdict === "EFFECTS_OF_INDEPENDENT_CAUSES") {
    const s1 = rng.pick([0, 1]);
    const s2 = rng.pick([0, 1]);
    textI = primary.effects[s1](bank1, region1, n1);
    textII = secondary.effects[s2](bank2, region2, n2);
    nodeI = { scenarioId: primary.id, role: "EFFECT", effectSlot: s1 };
    nodeII = { scenarioId: secondary.id, role: "EFFECT", effectSlot: s2 };
    explanation = `Statement I results from ${primary.commonCauseSummary}, whereas Statement II results from ${secondary.commonCauseSummary}—two completely independent causes. Hence, ${CE_OPTIONS[3]}.`;
  } else {
    // EFFECTS_OF_COMMON_CAUSE
    textI = primary.effects[0](bank1, region1, n1);
    textII = primary.effects[1](bank1, region1, n1);
    nodeI = { scenarioId: primary.id, role: "EFFECT", effectSlot: 0 };
    nodeII = { scenarioId: primary.id, role: "EFFECT", effectSlot: 1 };
    explanation = `Neither statement causes the other; both are direct consequences of a common underlying cause (${primary.commonCauseSummary}). Hence, ${CE_OPTIONS[4]}.`;
  }

  const computed = classifyCausalRelation(nodeI, nodeII);
  const correctIndex = CE_VERDICT_ORDER.indexOf(computed);

  const questionText =
    `Directions: Two statements I and II are given below. These statements may be either independent causes or may be effects of independent causes or a common cause. One of these statements may be the effect of the other statement. Read both statements carefully and choose the correct relationship.\n\n` +
    `Statement I: ${textI}\n` +
    `Statement II: ${textII}`;

  return {
    topic: "Cause & Effect",
    subType: subtopicKey,
    subtopicName: CAUSE_EFFECT_SUBTOPICS[subtopicKey] || CAUSE_EFFECT_SUBTOPICS.BANKING_MACRO_CE,
    difficulty,
    questionText,
    options: [...CE_OPTIONS],
    correctIndex,
    correctAnswer: String.fromCharCode(65 + correctIndex),
    explanation,
    _meta: { subType: subtopicKey, nodeI, nodeII },
  };
}
