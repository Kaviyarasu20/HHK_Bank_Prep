import {
  buildCourseOfActionQuestion,
  buildDecisionMakingQuestion,
  buildPassageInferenceQuestion,
  buildStrengthenWeakenQuestion,
  buildStrongWeakArgumentQuestion,
  createLogicalRng,
  LOGICAL_REASONING_SUBTOPICS,
} from "./logicalReasoningBuilder.js";
import { computeLogicalReasoningFingerprint, validateLogicalReasoningQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("course") || s.includes("action")) return ["COURSE_OF_ACTION"];
  if (s.includes("strong") || s.includes("weak argument") || s.includes("argument")) return ["STRONG_WEAK_ARGUMENT"];
  if (s.includes("infer") || s.includes("deduct")) return ["PASSAGE_INFERENCE"];
  if (s.includes("strengthen") || s.includes("weaken")) return ["STRENGTHEN_WEAKEN"];
  if (s.includes("decision") || s.includes("eligib")) return ["DECISION_MAKING_ELIGIBILITY"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["COURSE_OF_ACTION", "STRONG_WEAK_ARGUMENT", "DECISION_MAKING_ELIGIBILITY"];
  }
  if (diff === "Hard") {
    return ["PASSAGE_INFERENCE", "STRENGTHEN_WEAKEN", "DECISION_MAKING_ELIGIBILITY", "COURSE_OF_ACTION", "STRONG_WEAK_ARGUMENT"];
  }
  return ["COURSE_OF_ACTION", "STRONG_WEAK_ARGUMENT", "DECISION_MAKING_ELIGIBILITY", "PASSAGE_INFERENCE", "STRENGTHEN_WEAKEN"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "COURSE_OF_ACTION":
      return buildCourseOfActionQuestion({ difficulty, rng });
    case "STRONG_WEAK_ARGUMENT":
      return buildStrongWeakArgumentQuestion({ difficulty, rng });
    case "PASSAGE_INFERENCE":
      return buildPassageInferenceQuestion({ difficulty, rng });
    case "STRENGTHEN_WEAKEN":
      return buildStrengthenWeakenQuestion({ difficulty, rng });
    case "DECISION_MAKING_ELIGIBILITY":
      return buildDecisionMakingQuestion({ difficulty, rng });
    default:
      return buildCourseOfActionQuestion({ difficulty, rng });
  }
}

export function generateLogicalReasoningBatch({
  exam = "IBPS-PO",
  stage = "Mains",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createLogicalRng(
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

    const check = validateLogicalReasoningQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeLogicalReasoningFingerprint(raw);
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
      topic: "Logical Reasoning",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(LOGICAL_REASONING_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { LOGICAL_REASONING_SUBTOPICS };
