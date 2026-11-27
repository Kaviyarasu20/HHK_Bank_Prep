import {
  buildVocabularyQuestion,
  createVocabRng,
  VOCABULARY_SUBTOPICS,
} from "./vocabularyBuilder.js";
import {
  computeVocabularyFingerprint,
  validateVocabularyQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("spell") || s.includes("misspelt") || s.includes("inapprop")) return ["MISSPELT_INAPPROPRIATE_WORD"];
  if (s.includes("one-word") || s.includes("one word") || s.includes("substit")) return ["ONE_WORD_SUBSTITUTION"];
  if (s.includes("confus") || s.includes("homoph")) return ["CONFUSABLE_HOMOPHONES"];
  if (s.includes("colloc")) return ["COLLOCATION_VOCAB"];
  if (s.includes("definit") || s.includes("context")) return ["CONTEXTUAL_DEFINITION"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["MISSPELT_INAPPROPRIATE_WORD", "ONE_WORD_SUBSTITUTION", "CONFUSABLE_HOMOPHONES"];
  }
  if (diff === "Hard") {
    return ["COLLOCATION_VOCAB", "CONTEXTUAL_DEFINITION", "CONFUSABLE_HOMOPHONES", "MISSPELT_INAPPROPRIATE_WORD", "ONE_WORD_SUBSTITUTION"];
  }
  return [
    "MISSPELT_INAPPROPRIATE_WORD",
    "ONE_WORD_SUBSTITUTION",
    "CONFUSABLE_HOMOPHONES",
    "COLLOCATION_VOCAB",
    "CONTEXTUAL_DEFINITION",
  ];
}

export function generateVocabularyBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createVocabRng(
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

    const raw = buildVocabularyQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateVocabularyQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeVocabularyFingerprint(raw);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const { _meta, ...publicFields } = raw;
    const optionsMap = Object.fromEntries(
      raw.options.map((text, oIdx) => [String.fromCharCode(65 + oIdx), text]),
    );

    questions.push({
      ...publicFields,
      questionId: `VOCAB_${rng.seed}_${idx}_${attempts}`,
      exam,
      solutionSteps: [raw.explanation],
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
      validation: { solverVerified: true, subType: raw.subType },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Vocabulary",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(VOCABULARY_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { VOCABULARY_SUBTOPICS };
