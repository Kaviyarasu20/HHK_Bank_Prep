import {
  buildGrammarQuestion,
  createGrammarRng,
  GRAMMAR_SUBTOPICS,
} from "./grammarBuilder.js";
import {
  computeGrammarFingerprint,
  validateGrammarQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("voice") || s.includes("active") || s.includes("passive")) return ["ACTIVE_PASSIVE_VOICE"];
  if (s.includes("speech") || s.includes("direct") || s.includes("indirect")) return ["DIRECT_INDIRECT_SPEECH"];
  if (s.includes("tense") || s.includes("modal") || s.includes("condit")) return ["TENSE_MODAL_GRAMMAR"];
  if (s.includes("article") || s.includes("determin") || s.includes("quant")) return ["ARTICLES_DETERMINERS"];
  if (s.includes("prep") || s.includes("conj") || s.includes("tag")) return ["PREPOSITIONS_CONJUNCTIONS_TAGS"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["ARTICLES_DETERMINERS", "ACTIVE_PASSIVE_VOICE", "PREPOSITIONS_CONJUNCTIONS_TAGS"];
  }
  if (diff === "Hard") {
    return ["DIRECT_INDIRECT_SPEECH", "TENSE_MODAL_GRAMMAR", "ACTIVE_PASSIVE_VOICE", "PREPOSITIONS_CONJUNCTIONS_TAGS", "ARTICLES_DETERMINERS"];
  }
  return [
    "ACTIVE_PASSIVE_VOICE",
    "DIRECT_INDIRECT_SPEECH",
    "TENSE_MODAL_GRAMMAR",
    "ARTICLES_DETERMINERS",
    "PREPOSITIONS_CONJUNCTIONS_TAGS",
  ];
}

export function generateGrammarBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createGrammarRng(
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

    const raw = buildGrammarQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateGrammarQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeGrammarFingerprint(raw);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const { _meta, ...publicFields } = raw;
    const optionsMap = Object.fromEntries(
      raw.options.map((text, oIdx) => [String.fromCharCode(65 + oIdx), text]),
    );

    questions.push({
      ...publicFields,
      questionId: `GRAM_${rng.seed}_${idx}_${attempts}`,
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
      validation: { solverVerified: true, ruleTag: _meta.ruleTag },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Grammar",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(GRAMMAR_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { GRAMMAR_SUBTOPICS };
