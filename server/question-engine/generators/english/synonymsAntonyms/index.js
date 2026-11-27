import {
  buildSynonymAntonymQuestion,
  createSynAntRng,
  SYNONYMS_ANTONYMS_SUBTOPICS,
} from "./synonymsAntonymsBuilder.js";
import {
  computeSynonymAntonymFingerprint,
  validateSynonymAntonymQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("pair")) return ["PAIR_SYNONYM_ANTONYM_MAINS"];
  if (s.includes("outlier") || s.includes("not a synonym")) return ["SYNONYM_CLUSTER_OUTLIER"];
  if (s.includes("editorial") || s.includes("tone")) return ["EDITORIAL_TONE_SYN_ANT"];
  if (s.includes("antonym") && !s.includes("synonym")) return ["CONTEXTUAL_ANTONYM"];
  if (s.includes("synonym") && !s.includes("antonym")) return ["CONTEXTUAL_SYNONYM"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CONTEXTUAL_SYNONYM", "CONTEXTUAL_ANTONYM", "EDITORIAL_TONE_SYN_ANT"];
  }
  if (diff === "Hard") {
    return ["PAIR_SYNONYM_ANTONYM_MAINS", "SYNONYM_CLUSTER_OUTLIER", "EDITORIAL_TONE_SYN_ANT", "CONTEXTUAL_SYNONYM", "CONTEXTUAL_ANTONYM"];
  }
  return [
    "CONTEXTUAL_SYNONYM",
    "CONTEXTUAL_ANTONYM",
    "PAIR_SYNONYM_ANTONYM_MAINS",
    "SYNONYM_CLUSTER_OUTLIER",
    "EDITORIAL_TONE_SYN_ANT",
  ];
}

export function generateSynonymsAntonymsBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createSynAntRng(
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

    const raw = buildSynonymAntonymQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateSynonymAntonymQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeSynonymAntonymFingerprint(raw);
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
      validation: { solverVerified: true, word: _meta.entry.word },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Synonyms & Antonyms",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(SYNONYMS_ANTONYMS_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { SYNONYMS_ANTONYMS_SUBTOPICS };
