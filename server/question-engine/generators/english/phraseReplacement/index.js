import {
  buildPhraseReplacementQuestion,
  createPrRng,
  PHRASE_REPLACEMENT_SUBTOPICS,
} from "./phraseReplacementBuilder.js";
import {
  computePhraseReplacementFingerprint,
  validatePhraseReplacementQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("verb") || s.includes("tense")) return ["VERB_TENSE_REPLACEMENT"];
  if (s.includes("prep") || s.includes("phrasal")) return ["PREPOSITION_PHRASAL_REPLACEMENT"];
  if (s.includes("conj") || s.includes("invers") || s.includes("correl")) return ["CONJUNCTION_INVERSION_REPLACEMENT"];
  if (s.includes("modif") || s.includes("idiom") || s.includes("compar")) return ["MODIFIER_IDIOM_REPLACEMENT"];
  if (s.includes("concis") || s.includes("parallel") || s.includes("redund")) return ["CONCISION_PARALLELISM_REPLACEMENT"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["VERB_TENSE_REPLACEMENT", "PREPOSITION_PHRASAL_REPLACEMENT", "MODIFIER_IDIOM_REPLACEMENT"];
  }
  if (diff === "Hard") {
    return ["CONJUNCTION_INVERSION_REPLACEMENT", "CONCISION_PARALLELISM_REPLACEMENT", "VERB_TENSE_REPLACEMENT", "PREPOSITION_PHRASAL_REPLACEMENT", "MODIFIER_IDIOM_REPLACEMENT"];
  }
  return [
    "VERB_TENSE_REPLACEMENT",
    "PREPOSITION_PHRASAL_REPLACEMENT",
    "CONJUNCTION_INVERSION_REPLACEMENT",
    "MODIFIER_IDIOM_REPLACEMENT",
    "CONCISION_PARALLELISM_REPLACEMENT",
  ];
}

export function generatePhraseReplacementBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createPrRng(
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

    const raw = buildPhraseReplacementQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validatePhraseReplacementQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computePhraseReplacementFingerprint(raw);
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
      validation: { solverVerified: true, isNoCorrection: _meta.isNoCorrection },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Phrase Replacement",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(PHRASE_REPLACEMENT_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { PHRASE_REPLACEMENT_SUBTOPICS };
