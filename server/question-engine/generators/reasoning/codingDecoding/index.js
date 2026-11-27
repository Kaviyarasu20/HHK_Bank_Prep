import {
  buildChineseCodingQuestion,
  buildConditionalCodingQuestion,
  buildLetterShiftQuestion,
  buildNewPatternQuestion,
  buildNumberCodingQuestion,
  CODING_SUBTOPICS,
  createCodingRng,
} from "./codingBuilder.js";
import { computeCodingFingerprint, validateCodingQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("chinese") || s.includes("substit")) return ["CHINESE_CODING"];
  if (s.includes("new") || s.includes("symbol") || s.includes("snl")) return ["NEW_PATTERN_SNL"];
  if (s.includes("condit") || s.includes("table")) return ["CONDITIONAL_CODING"];
  if (s.includes("letter") || s.includes("shift")) return ["LETTER_SHIFT"];
  if (s.includes("number") || s.includes("value")) return ["NUMBER_CODING"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CHINESE_CODING", "LETTER_SHIFT", "NUMBER_CODING", "CONDITIONAL_CODING"];
  }
  if (diff === "Hard") {
    return ["NEW_PATTERN_SNL", "CHINESE_CODING", "CONDITIONAL_CODING", "NUMBER_CODING", "LETTER_SHIFT"];
  }
  return ["CHINESE_CODING", "CONDITIONAL_CODING", "NEW_PATTERN_SNL", "LETTER_SHIFT", "NUMBER_CODING"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "CHINESE_CODING":
      return buildChineseCodingQuestion({ difficulty, rng });
    case "NEW_PATTERN_SNL":
      return buildNewPatternQuestion({ difficulty, rng });
    case "CONDITIONAL_CODING":
      return buildConditionalCodingQuestion({ difficulty, rng });
    case "LETTER_SHIFT":
      return buildLetterShiftQuestion({ difficulty, rng });
    case "NUMBER_CODING":
      return buildNumberCodingQuestion({ difficulty, rng });
    default:
      return buildChineseCodingQuestion({ difficulty, rng });
  }
}

export function generateCodingDecodingBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createCodingRng(
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

    const check = validateCodingQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeCodingFingerprint(raw);
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
      topic: "Coding-Decoding",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(CODING_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { CODING_SUBTOPICS };
