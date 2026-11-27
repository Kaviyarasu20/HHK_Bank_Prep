import {
  buildBankingOfferSA,
  buildManagementDecisionSA,
  buildPolicyDirectiveSA,
  buildPublicNoticeSA,
  buildThresholdPolicySA,
  createSaRng,
  STATEMENT_ASSUMPTION_SUBTOPICS,
} from "./statementAssumptionBuilder.js";
import {
  computeStatementAssumptionFingerprint,
  validateStatementAssumptionQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("notice") || s.includes("warn") || s.includes("appeal")) return ["PUBLIC_NOTICE_SA"];
  if (s.includes("offer") || s.includes("ad")) return ["BANKING_OFFER_SA"];
  if (s.includes("policy") || s.includes("regulat") || s.includes("directive")) return ["POLICY_DIRECTIVE_SA"];
  if (s.includes("manage") || s.includes("hr") || s.includes("decision")) return ["MANAGEMENT_DECISION_SA"];
  if (s.includes("threshold") || s.includes("quant")) return ["THRESHOLD_POLICY_SA"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["PUBLIC_NOTICE_SA", "BANKING_OFFER_SA", "POLICY_DIRECTIVE_SA"];
  }
  if (diff === "Hard") {
    return ["POLICY_DIRECTIVE_SA", "MANAGEMENT_DECISION_SA", "THRESHOLD_POLICY_SA", "PUBLIC_NOTICE_SA", "BANKING_OFFER_SA"];
  }
  return ["PUBLIC_NOTICE_SA", "BANKING_OFFER_SA", "POLICY_DIRECTIVE_SA", "MANAGEMENT_DECISION_SA", "THRESHOLD_POLICY_SA"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "PUBLIC_NOTICE_SA":
      return buildPublicNoticeSA({ difficulty, rng });
    case "BANKING_OFFER_SA":
      return buildBankingOfferSA({ difficulty, rng });
    case "POLICY_DIRECTIVE_SA":
      return buildPolicyDirectiveSA({ difficulty, rng });
    case "MANAGEMENT_DECISION_SA":
      return buildManagementDecisionSA({ difficulty, rng });
    case "THRESHOLD_POLICY_SA":
      return buildThresholdPolicySA({ difficulty, rng });
    default:
      return buildPublicNoticeSA({ difficulty, rng });
  }
}

export function generateStatementAssumptionBatch({
  exam = "IBPS-PO",
  stage = "Mains",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createSaRng(
    seed !== null && seed !== undefined
      ? seed
      : Date.now() ^ Math.floor(Math.random() * 1e9),
  );
  const diffLabel = normalizeDiffLabel(difficulty);
  const plan = resolveSubtopicPlan(diffLabel, subtopicName);
  const seen = new Set(excludeFingerprints);
  const questions = [];
  const rejectedLogs = [];
  let attempts = 0;
  const maxAttempts = Math.max(80, count * 25);

  while (questions.length < count && attempts < maxAttempts) {
    attempts += 1;
    const idx = questions.length;
    const subtopicKey = count === 1 ? rng.pick(plan) : plan[(idx + Math.floor(attempts / 12)) % plan.length];

    const raw = buildBySubtopic(subtopicKey, diffLabel, rng);
    if (!raw) continue;

    const check = validateStatementAssumptionQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeStatementAssumptionFingerprint(raw);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const { _meta, ...publicFields } = raw;
    const optionsMap = Object.fromEntries(
      raw.options.map((text, oIdx) => [String.fromCharCode(65 + oIdx), text]),
    );

    questions.push({
      ...publicFields,
      answer: raw.options[raw.correctIndex],
      correctOptionIndex: raw.correctIndex,
      templateId: raw.subType,
      sub_type: raw.subType,
      optionsArray: [...raw.options],
      options: optionsMap,
      subject: "Reasoning Ability",
      subjectKey: "reasoning",
      examName: exam,
      examStage: stage,
      fingerprint,
      generatorVersion: "1.0.0",
      validation: { solverVerified: true, subType: raw.subType },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Statement & Assumption",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(STATEMENT_ASSUMPTION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { STATEMENT_ASSUMPTION_SUBTOPICS };
