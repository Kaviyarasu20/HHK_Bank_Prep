import {
  buildSentenceRearrangementQuestion,
  createSrRng,
  SENTENCE_REARRANGEMENT_SUBTOPICS,
} from "./sentenceRearrangementBuilder.js";
import {
  computeSentenceRearrangementFingerprint,
  validateSentenceRearrangementQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("double") && s.includes("swap")) return ["DOUBLE_WORD_SWAP_MAINS"];
  if (s.includes("swap") || s.includes("word")) return ["WORD_SWAP_SENTENCE"];
  if (s.includes("fixed")) return ["FIXED_START_SENTENCE"];
  if (s.includes("five") || s.includes("5-part")) return ["FIVE_PART_SENTENCE"];
  if (s.includes("four") || s.includes("4-part")) return ["FOUR_PART_SENTENCE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["FOUR_PART_SENTENCE", "WORD_SWAP_SENTENCE", "FIXED_START_SENTENCE"];
  }
  if (diff === "Hard") {
    return ["FIVE_PART_SENTENCE", "DOUBLE_WORD_SWAP_MAINS", "FIXED_START_SENTENCE", "WORD_SWAP_SENTENCE", "FOUR_PART_SENTENCE"];
  }
  return [
    "FOUR_PART_SENTENCE",
    "FIVE_PART_SENTENCE",
    "FIXED_START_SENTENCE",
    "WORD_SWAP_SENTENCE",
    "DOUBLE_WORD_SWAP_MAINS",
  ];
}

export function generateSentenceRearrangementBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createSrRng(
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

    const raw = buildSentenceRearrangementQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateSentenceRearrangementQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeSentenceRearrangementFingerprint(raw);
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
      validation: { solverVerified: true, subType: raw.subType },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Sentence Rearrangement",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(SENTENCE_REARRANGEMENT_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { SENTENCE_REARRANGEMENT_SUBTOPICS };
