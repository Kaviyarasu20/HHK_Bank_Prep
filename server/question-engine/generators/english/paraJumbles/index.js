import {
  buildParaJumblesQuestion,
  createPjRng,
  PARA_JUMBLES_SUBTOPICS,
} from "./paraJumblesBuilder.js";
import { computeParaJumblesFingerprint, validateParaJumblesQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("odd")) return ["ODD_SENTENCE_OUT_PARAJUMBLE"];
  if (s.includes("fixed") || s.includes("anchor") || s.includes("s1")) return ["FIXED_ANCHOR_PARAJUMBLE"];
  if (s.includes("pair") || s.includes("mandat")) return ["MANDATORY_PAIR_PARAJUMBLE"];
  if (s.includes("pos") || s.includes("first") || s.includes("last")) return ["POSITIONAL_SENTENCE_QUERY"];
  if (s.includes("five") || s.includes("complete") || s.includes("seq")) return ["FIVE_SENTENCE_SEQUENCE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["FIVE_SENTENCE_SEQUENCE", "POSITIONAL_SENTENCE_QUERY", "FIXED_ANCHOR_PARAJUMBLE"];
  }
  if (diff === "Hard") {
    return ["ODD_SENTENCE_OUT_PARAJUMBLE", "MANDATORY_PAIR_PARAJUMBLE", "FIXED_ANCHOR_PARAJUMBLE", "FIVE_SENTENCE_SEQUENCE", "POSITIONAL_SENTENCE_QUERY"];
  }
  return [
    "FIVE_SENTENCE_SEQUENCE",
    "POSITIONAL_SENTENCE_QUERY",
    "FIXED_ANCHOR_PARAJUMBLE",
    "ODD_SENTENCE_OUT_PARAJUMBLE",
    "MANDATORY_PAIR_PARAJUMBLE",
  ];
}

export function generateParaJumblesBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createPjRng(
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

    const raw = buildParaJumblesQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateParaJumblesQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeParaJumblesFingerprint(raw);
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
      validation: { solverVerified: true, paraId: _meta.paraId },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Para Jumbles",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(PARA_JUMBLES_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { PARA_JUMBLES_SUBTOPICS };
