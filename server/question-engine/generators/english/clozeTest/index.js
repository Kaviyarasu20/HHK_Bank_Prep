import {
  buildClozeQuestion,
  CLOZE_SUBTOPICS,
  createClozeRng,
} from "./clozeBuilder.js";
import { computeClozeFingerprint, validateClozeQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("new") || s.includes("replace") || s.includes("mains")) return ["NEW_PATTERN_CLOZE"];
  if (s.includes("econ") || s.includes("monet") || s.includes("policy")) return ["ECONOMY_POLICY_CLOZE"];
  if (s.includes("climat") || s.includes("green")) return ["CLIMATE_FINANCE_CLOZE"];
  if (s.includes("cyber") || s.includes("govern")) return ["GOVERNANCE_CYBER_CLOZE"];
  if (s.includes("bank") || s.includes("digital")) return ["BANKING_DIGITAL_CLOZE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["BANKING_DIGITAL_CLOZE", "ECONOMY_POLICY_CLOZE", "CLIMATE_FINANCE_CLOZE"];
  }
  if (diff === "Hard") {
    return ["NEW_PATTERN_CLOZE", "ECONOMY_POLICY_CLOZE", "GOVERNANCE_CYBER_CLOZE", "CLIMATE_FINANCE_CLOZE", "BANKING_DIGITAL_CLOZE"];
  }
  return [
    "BANKING_DIGITAL_CLOZE",
    "ECONOMY_POLICY_CLOZE",
    "CLIMATE_FINANCE_CLOZE",
    "GOVERNANCE_CYBER_CLOZE",
    "NEW_PATTERN_CLOZE",
  ];
}

export function generateClozeTestBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createClozeRng(
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
    const subtopicKey = count === 1 && attempts <= 10 ? rng.pick(plan) : plan[(idx + attempts) % plan.length];

    const raw = buildClozeQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateClozeQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeClozeFingerprint(raw);
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
      subject: "English Language",
      subjectKey: "english",
      examName: exam,
      examStage: stage,
      fingerprint,
      generatorVersion: "1.0.0",
      validation: { solverVerified: true, passageId: _meta.passageId, blank: _meta.activeBlankNum },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Cloze Test",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(CLOZE_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { CLOZE_SUBTOPICS };
