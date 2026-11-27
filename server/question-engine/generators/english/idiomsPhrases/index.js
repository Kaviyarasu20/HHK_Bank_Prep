import {
  buildIdiomsPhrasesQuestion,
  createIdiomRng,
  IDIOMS_PHRASES_SUBTOPICS,
} from "./idiomsPhrasesBuilder.js";
import {
  computeIdiomsPhrasesFingerprint,
  validateIdiomsPhrasesQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("phrasal")) return ["PHRASAL_VERB_CONTEXT"];
  if (s.includes("triple") || s.includes("usage") || s.includes("mains")) return ["IDIOM_USAGE_TRIPLE_MAINS"];
  if (s.includes("substit") || s.includes("literal")) return ["IDIOM_SUBSTITUTION"];
  if (s.includes("fill") || s.includes("blank")) return ["IDIOM_FILLER"];
  if (s.includes("meaning") || s.includes("context")) return ["CONTEXTUAL_IDIOM_MEANING"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CONTEXTUAL_IDIOM_MEANING", "IDIOM_FILLER", "PHRASAL_VERB_CONTEXT"];
  }
  if (diff === "Hard") {
    return ["IDIOM_USAGE_TRIPLE_MAINS", "PHRASAL_VERB_CONTEXT", "IDIOM_SUBSTITUTION", "CONTEXTUAL_IDIOM_MEANING", "IDIOM_FILLER"];
  }
  return [
    "CONTEXTUAL_IDIOM_MEANING",
    "IDIOM_FILLER",
    "PHRASAL_VERB_CONTEXT",
    "IDIOM_USAGE_TRIPLE_MAINS",
    "IDIOM_SUBSTITUTION",
  ];
}

export function generateIdiomsPhrasesBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createIdiomRng(
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

    const raw = buildIdiomsPhrasesQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateIdiomsPhrasesQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeIdiomsPhrasesFingerprint(raw);
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
      topic: "Idioms & Phrases",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(IDIOMS_PHRASES_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { IDIOMS_PHRASES_SUBTOPICS };
