import {
  buildAlphanumericClassificationQuestion,
  buildLetterClusterClassificationQuestion,
  buildNumberClassificationQuestion,
  buildNumberPairClassificationQuestion,
  buildSemanticClassificationQuestion,
  CLASSIFICATION_SUBTOPICS,
  createClassRng,
} from "./classificationBuilder.js";
import { computeClassificationFingerprint, validateClassificationQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("pair") && s.includes("number")) return ["NUMBER_PAIR_CLASSIFICATION"];
  if (s.includes("letter") || s.includes("cluster")) return ["LETTER_CLUSTER_CLASSIFICATION"];
  if (s.includes("alpha")) return ["ALPHANUMERIC_CLASSIFICATION"];
  if (s.includes("word") || s.includes("semantic") || s.includes("verbal")) return ["SEMANTIC_WORD_CLASSIFICATION"];
  if (s.includes("number")) return ["NUMBER_CLASSIFICATION"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SEMANTIC_WORD_CLASSIFICATION", "NUMBER_CLASSIFICATION", "LETTER_CLUSTER_CLASSIFICATION", "NUMBER_PAIR_CLASSIFICATION"];
  }
  if (diff === "Hard") {
    return ["NUMBER_PAIR_CLASSIFICATION", "ALPHANUMERIC_CLASSIFICATION", "LETTER_CLUSTER_CLASSIFICATION", "NUMBER_CLASSIFICATION", "SEMANTIC_WORD_CLASSIFICATION"];
  }
  return ["NUMBER_CLASSIFICATION", "NUMBER_PAIR_CLASSIFICATION", "LETTER_CLUSTER_CLASSIFICATION", "ALPHANUMERIC_CLASSIFICATION", "SEMANTIC_WORD_CLASSIFICATION"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "NUMBER_CLASSIFICATION":
      return buildNumberClassificationQuestion({ difficulty, rng });
    case "NUMBER_PAIR_CLASSIFICATION":
      return buildNumberPairClassificationQuestion({ difficulty, rng });
    case "LETTER_CLUSTER_CLASSIFICATION":
      return buildLetterClusterClassificationQuestion({ difficulty, rng });
    case "ALPHANUMERIC_CLASSIFICATION":
      return buildAlphanumericClassificationQuestion({ difficulty, rng });
    case "SEMANTIC_WORD_CLASSIFICATION":
      return buildSemanticClassificationQuestion({ difficulty, rng });
    default:
      return buildNumberClassificationQuestion({ difficulty, rng });
  }
}

export function generateClassificationBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createClassRng(
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

    const check = validateClassificationQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeClassificationFingerprint(raw);
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
      topic: "Classification",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(CLASSIFICATION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { CLASSIFICATION_SUBTOPICS };
