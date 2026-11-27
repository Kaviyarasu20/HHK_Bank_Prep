import {
  buildSentenceCorrectionQuestion,
  createScEngRng,
  SENTENCE_CORRECTION_SUBTOPICS,
} from "./sentenceCorrectionBuilder.js";
import {
  computeSentenceCorrectionFingerprint,
  validateSentenceCorrectionQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("incorrect")) return ["INCORRECT_SENTENCE_CHOICE"];
  if (s.includes("modifier") || s.includes("dangl")) return ["MODIFIER_CORRECTION"];
  if (s.includes("parallel") || s.includes("compar")) return ["PARALLEL_COMPARISON_CORRECTION"];
  if (s.includes("subjunct") || s.includes("condit")) return ["SUBJUNCTIVE_CONDITIONAL_CORRECTION"];
  if (s.includes("correct")) return ["CORRECT_SENTENCE_CHOICE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CORRECT_SENTENCE_CHOICE", "INCORRECT_SENTENCE_CHOICE", "PARALLEL_COMPARISON_CORRECTION"];
  }
  if (diff === "Hard") {
    return ["MODIFIER_CORRECTION", "SUBJUNCTIVE_CONDITIONAL_CORRECTION", "PARALLEL_COMPARISON_CORRECTION", "INCORRECT_SENTENCE_CHOICE", "CORRECT_SENTENCE_CHOICE"];
  }
  return [
    "CORRECT_SENTENCE_CHOICE",
    "INCORRECT_SENTENCE_CHOICE",
    "MODIFIER_CORRECTION",
    "PARALLEL_COMPARISON_CORRECTION",
    "SUBJUNCTIVE_CONDITIONAL_CORRECTION",
  ];
}

export function generateSentenceCorrectionBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createScEngRng(
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

    const raw = buildSentenceCorrectionQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateSentenceCorrectionQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeSentenceCorrectionFingerprint(raw);
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
      validation: { solverVerified: true, mode: _meta.mode },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Sentence Correction",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(SENTENCE_CORRECTION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { SENTENCE_CORRECTION_SUBTOPICS };
