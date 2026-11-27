import {
  buildErrorDetectionQuestion,
  createErrorDetRng,
  ERROR_DETECTION_SUBTOPICS,
} from "./errorDetectionBuilder.js";
import { computeErrorDetectionFingerprint, validateErrorDetectionQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("subject") || s.includes("verb") || s.includes("sva")) return ["SUBJECT_VERB_AGREEMENT"];
  if (s.includes("tense") || s.includes("condit")) return ["TENSE_CONDITIONALS"];
  if (s.includes("prep") || s.includes("phrasal")) return ["PREPOSITIONS_PHRASAL"];
  if (s.includes("pronoun") || s.includes("modif") || s.includes("article")) return ["PRONOUNS_MODIFIERS"];
  if (s.includes("parallel") || s.includes("conj") || s.includes("invers")) return ["PARALLELISM_CONJUNCTIONS"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SUBJECT_VERB_AGREEMENT", "PREPOSITIONS_PHRASAL", "PRONOUNS_MODIFIERS"];
  }
  if (diff === "Hard") {
    return ["TENSE_CONDITIONALS", "PARALLELISM_CONJUNCTIONS", "SUBJECT_VERB_AGREEMENT", "PREPOSITIONS_PHRASAL", "PRONOUNS_MODIFIERS"];
  }
  return [
    "SUBJECT_VERB_AGREEMENT",
    "TENSE_CONDITIONALS",
    "PREPOSITIONS_PHRASAL",
    "PRONOUNS_MODIFIERS",
    "PARALLELISM_CONJUNCTIONS",
  ];
}

export function generateErrorDetectionBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createErrorDetRng(
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

    const raw = buildErrorDetectionQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateErrorDetectionQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeErrorDetectionFingerprint(raw);
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
      validation: { solverVerified: true, ruleCode: _meta.ruleCode },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Error Detection",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(ERROR_DETECTION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { ERROR_DETECTION_SUBTOPICS };
