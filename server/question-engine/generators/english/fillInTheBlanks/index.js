import {
  buildFillBlanksQuestion,
  createFillRng,
  FILL_BLANKS_SUBTOPICS,
} from "./fillBlanksBuilder.js";
import { computeFillBlanksFingerprint, validateFillBlanksQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("double")) return ["DOUBLE_FILLER"];
  if (s.includes("dual") || s.includes("common")) return ["DUAL_SENTENCE_COMMON_FILLER"];
  if (s.includes("connect") || s.includes("transit")) return ["CONNECTOR_TRANSITION_FILLER"];
  if (s.includes("gram") || s.includes("prep") || s.includes("phrasal")) return ["GRAMMAR_PREPOSITION_FILLER"];
  if (s.includes("single") || s.includes("vocab")) return ["SINGLE_FILLER_VOCAB"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SINGLE_FILLER_VOCAB", "GRAMMAR_PREPOSITION_FILLER", "DOUBLE_FILLER"];
  }
  if (diff === "Hard") {
    return ["DOUBLE_FILLER", "DUAL_SENTENCE_COMMON_FILLER", "CONNECTOR_TRANSITION_FILLER", "SINGLE_FILLER_VOCAB", "GRAMMAR_PREPOSITION_FILLER"];
  }
  return [
    "SINGLE_FILLER_VOCAB",
    "DOUBLE_FILLER",
    "GRAMMAR_PREPOSITION_FILLER",
    "DUAL_SENTENCE_COMMON_FILLER",
    "CONNECTOR_TRANSITION_FILLER",
  ];
}

export function generateFillInTheBlanksBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createFillRng(
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
    const subtopicKey =
      count === 1 && attempts <= 10
        ? rng.pick(plan)
        : plan[(idx + attempts) % plan.length];

    const raw = buildFillBlanksQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateFillBlanksQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeFillBlanksFingerprint(raw);
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
      validation: { solverVerified: true, blanks: _meta.expectedBlankCount },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Fill in the Blanks",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(FILL_BLANKS_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { FILL_BLANKS_SUBTOPICS };
