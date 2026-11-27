import {
  ALPHANUMERIC_SUBTOPICS,
  buildPositionalNavQuestion,
  buildPrecededFollowedQuestion,
  buildStepAlphanumericMainsQuestion,
  buildThreeDigitNumberOpsQuestion,
  buildThreeLetterWordOpsQuestion,
  createAlphaRng,
} from "./alphanumericBuilder.js";
import { computeAlphanumericFingerprint, validateAlphanumericQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("step") || s.includes("mains")) return ["STEP_ALPHANUMERIC_MAINS"];
  if (s.includes("digit") || s.includes("3-digit")) return ["THREE_DIGIT_NUMBER_OPS"];
  if (s.includes("word") || s.includes("3-letter")) return ["THREE_LETTER_WORD_OPS"];
  if (s.includes("pos") || s.includes("midway") || s.includes("nav")) return ["SNL_POSITIONAL_NAV"];
  if (s.includes("preced") || s.includes("follow") || s.includes("symbol") || s.includes("drop")) return ["SNL_PRECEDED_FOLLOWED"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SNL_PRECEDED_FOLLOWED", "SNL_POSITIONAL_NAV", "THREE_DIGIT_NUMBER_OPS", "THREE_LETTER_WORD_OPS"];
  }
  if (diff === "Hard") {
    return ["STEP_ALPHANUMERIC_MAINS", "SNL_PRECEDED_FOLLOWED", "THREE_DIGIT_NUMBER_OPS", "THREE_LETTER_WORD_OPS", "SNL_POSITIONAL_NAV"];
  }
  return ["SNL_PRECEDED_FOLLOWED", "SNL_POSITIONAL_NAV", "THREE_DIGIT_NUMBER_OPS", "THREE_LETTER_WORD_OPS", "STEP_ALPHANUMERIC_MAINS"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "SNL_PRECEDED_FOLLOWED":
      return buildPrecededFollowedQuestion({ difficulty, rng });
    case "SNL_POSITIONAL_NAV":
      return buildPositionalNavQuestion({ difficulty, rng });
    case "THREE_DIGIT_NUMBER_OPS":
      return buildThreeDigitNumberOpsQuestion({ difficulty, rng });
    case "THREE_LETTER_WORD_OPS":
      return buildThreeLetterWordOpsQuestion({ difficulty, rng });
    case "STEP_ALPHANUMERIC_MAINS":
      return buildStepAlphanumericMainsQuestion({ difficulty, rng });
    default:
      return buildPrecededFollowedQuestion({ difficulty, rng });
  }
}

export function generateAlphanumericSeriesBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createAlphaRng(
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

    const check = validateAlphanumericQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeAlphanumericFingerprint(raw);
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
      topic: "Alphanumeric Series",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(ALPHANUMERIC_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { ALPHANUMERIC_SUBTOPICS };
