import {
  buildBankingPolicySC,
  buildCivicPolicySC,
  buildConditionalLogicSC,
  buildCorporateWorkplaceSC,
  buildQuantitativeDataSC,
  createScRng,
  STATEMENT_CONCLUSION_SUBTOPICS,
} from "./statementConclusionBuilder.js";
import {
  computeStatementConclusionFingerprint,
  validateStatementConclusionQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("quant") || s.includes("data") || s.includes("numeric")) return ["QUANTITATIVE_DATA_SC"];
  if (s.includes("condit") || s.includes("rule") || s.includes("if")) return ["CONDITIONAL_LOGIC_SC"];
  if (s.includes("civic") || s.includes("public")) return ["CIVIC_POLICY_SC"];
  if (s.includes("corp") || s.includes("workplace") || s.includes("hr")) return ["CORPORATE_WORKPLACE_SC"];
  if (s.includes("bank") || s.includes("econ")) return ["BANKING_POLICY_SC"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CIVIC_POLICY_SC", "CORPORATE_WORKPLACE_SC", "QUANTITATIVE_DATA_SC", "BANKING_POLICY_SC"];
  }
  if (diff === "Hard") {
    return ["CONDITIONAL_LOGIC_SC", "QUANTITATIVE_DATA_SC", "BANKING_POLICY_SC", "CORPORATE_WORKPLACE_SC", "CIVIC_POLICY_SC"];
  }
  return ["BANKING_POLICY_SC", "QUANTITATIVE_DATA_SC", "CONDITIONAL_LOGIC_SC", "CIVIC_POLICY_SC", "CORPORATE_WORKPLACE_SC"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "BANKING_POLICY_SC":
      return buildBankingPolicySC({ difficulty, rng });
    case "QUANTITATIVE_DATA_SC":
      return buildQuantitativeDataSC({ difficulty, rng });
    case "CONDITIONAL_LOGIC_SC":
      return buildConditionalLogicSC({ difficulty, rng });
    case "CIVIC_POLICY_SC":
      return buildCivicPolicySC({ difficulty, rng });
    case "CORPORATE_WORKPLACE_SC":
      return buildCorporateWorkplaceSC({ difficulty, rng });
    default:
      return buildBankingPolicySC({ difficulty, rng });
  }
}

export function generateStatementConclusionBatch({
  exam = "IBPS-PO",
  stage = "Mains",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createScRng(
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

    const check = validateStatementConclusionQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeStatementConclusionFingerprint(raw);
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
      topic: "Statement & Conclusion",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(STATEMENT_CONCLUSION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { STATEMENT_CONCLUSION_SUBTOPICS };
