import {
  ANALOGY_SUBTOPICS,
  buildAlphanumericAnalogyQuestion,
  buildLetterClusterAnalogyQuestion,
  buildNumberAnalogyQuestion,
  buildNumberSetAnalogyQuestion,
  buildSemanticWordAnalogyQuestion,
  createAnalogyRng,
} from "./analogyBuilder.js";
import { computeAnalogyFingerprint, validateAnalogyQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("set") || s.includes("triad")) return ["NUMBER_SET_ANALOGY"];
  if (s.includes("letter") || s.includes("cluster")) return ["LETTER_CLUSTER_ANALOGY"];
  if (s.includes("alpha") || s.includes("value")) return ["ALPHANUMERIC_ANALOGY"];
  if (s.includes("word") || s.includes("semantic") || s.includes("verbal")) return ["SEMANTIC_WORD_ANALOGY"];
  if (s.includes("number")) return ["NUMBER_ANALOGY"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SEMANTIC_WORD_ANALOGY", "NUMBER_ANALOGY", "LETTER_CLUSTER_ANALOGY", "ALPHANUMERIC_ANALOGY"];
  }
  if (diff === "Hard") {
    return ["NUMBER_SET_ANALOGY", "NUMBER_ANALOGY", "LETTER_CLUSTER_ANALOGY", "ALPHANUMERIC_ANALOGY", "SEMANTIC_WORD_ANALOGY"];
  }
  return ["NUMBER_ANALOGY", "NUMBER_SET_ANALOGY", "LETTER_CLUSTER_ANALOGY", "ALPHANUMERIC_ANALOGY", "SEMANTIC_WORD_ANALOGY"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "NUMBER_ANALOGY":
      return buildNumberAnalogyQuestion({ difficulty, rng });
    case "NUMBER_SET_ANALOGY":
      return buildNumberSetAnalogyQuestion({ difficulty, rng });
    case "LETTER_CLUSTER_ANALOGY":
      return buildLetterClusterAnalogyQuestion({ difficulty, rng });
    case "ALPHANUMERIC_ANALOGY":
      return buildAlphanumericAnalogyQuestion({ difficulty, rng });
    case "SEMANTIC_WORD_ANALOGY":
      return buildSemanticWordAnalogyQuestion({ difficulty, rng });
    default:
      return buildNumberAnalogyQuestion({ difficulty, rng });
  }
}

export function generateAnalogyBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createAnalogyRng(
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

    const check = validateAnalogyQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeAnalogyFingerprint(raw);
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
      topic: "Analogy",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(ANALOGY_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { ANALOGY_SUBTOPICS };
