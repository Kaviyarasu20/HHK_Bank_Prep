import {
  buildCauseEffectQuestion,
  CAUSE_EFFECT_SUBTOPICS,
  createCeRng,
} from "./causeEffectBuilder.js";
import { CE_VERDICT_ORDER } from "./solver.js";
import { computeCauseEffectFingerprint, validateCauseEffectQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("bank") || s.includes("monet") || s.includes("macro")) return ["BANKING_MACRO_CE"];
  if (s.includes("agri") || s.includes("weather") || s.includes("monsoon")) return ["AGRI_WEATHER_CE"];
  if (s.includes("infra") || s.includes("transit") || s.includes("metro")) return ["INFRA_TRANSIT_CE"];
  if (s.includes("cyber") || s.includes("tech") || s.includes("digital")) return ["CYBER_TECH_CE"];
  if (s.includes("civic") || s.includes("social") || s.includes("public")) return ["CIVIC_SOCIAL_CE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["AGRI_WEATHER_CE", "INFRA_TRANSIT_CE", "CIVIC_SOCIAL_CE", "BANKING_MACRO_CE"];
  }
  if (diff === "Hard") {
    return ["BANKING_MACRO_CE", "CYBER_TECH_CE", "INFRA_TRANSIT_CE", "AGRI_WEATHER_CE", "CIVIC_SOCIAL_CE"];
  }
  return ["BANKING_MACRO_CE", "AGRI_WEATHER_CE", "INFRA_TRANSIT_CE", "CYBER_TECH_CE", "CIVIC_SOCIAL_CE"];
}

export function generateCauseEffectBatch({
  exam = "IBPS-PO",
  stage = "Mains",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createCeRng(
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
    const verdictOffset = count === 1 ? rng.int(0, 4) : idx + attempts;
    const targetVerdict = CE_VERDICT_ORDER[verdictOffset % CE_VERDICT_ORDER.length];

    const raw = buildCauseEffectQuestion({
      subtopicKey,
      difficulty: diffLabel,
      targetVerdict,
      rng,
    });
    if (!raw) continue;

    const check = validateCauseEffectQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeCauseEffectFingerprint(raw);
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
      topic: "Cause & Effect",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(CAUSE_EFFECT_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { CAUSE_EFFECT_SUBTOPICS };
