import {
  buildAlphabetPairAndHalfQuestion,
  buildContinuousPatternQuestion,
  buildLetterClusterSeriesQuestion,
  buildSingleLetterSeriesQuestion,
  buildWrongLetterClusterQuestion,
  createLetterRng,
  LETTER_SERIES_SUBTOPICS,
} from "./letterSeriesBuilder.js";
import { computeLetterSeriesFingerprint, validateLetterSeriesQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("wrong")) return ["WRONG_LETTER_CLUSTER"];
  if (s.includes("continu") || s.includes("repeat") || s.includes("fill")) return ["CONTINUOUS_PATTERN_FILL"];
  if (s.includes("pair") || s.includes("half")) return ["ALPHABET_PAIR_AND_HALF"];
  if (s.includes("cluster") || s.includes("triplet")) return ["LETTER_CLUSTER_SERIES"];
  if (s.includes("single") || s.includes("progress")) return ["SINGLE_LETTER_SERIES"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["SINGLE_LETTER_SERIES", "LETTER_CLUSTER_SERIES", "CONTINUOUS_PATTERN_FILL", "ALPHABET_PAIR_AND_HALF"];
  }
  if (diff === "Hard") {
    return ["WRONG_LETTER_CLUSTER", "CONTINUOUS_PATTERN_FILL", "LETTER_CLUSTER_SERIES", "ALPHABET_PAIR_AND_HALF", "SINGLE_LETTER_SERIES"];
  }
  return ["LETTER_CLUSTER_SERIES", "CONTINUOUS_PATTERN_FILL", "WRONG_LETTER_CLUSTER", "ALPHABET_PAIR_AND_HALF", "SINGLE_LETTER_SERIES"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "SINGLE_LETTER_SERIES":
      return buildSingleLetterSeriesQuestion({ difficulty, rng });
    case "LETTER_CLUSTER_SERIES":
      return buildLetterClusterSeriesQuestion({ difficulty, rng });
    case "CONTINUOUS_PATTERN_FILL":
      return buildContinuousPatternQuestion({ difficulty, rng });
    case "WRONG_LETTER_CLUSTER":
      return buildWrongLetterClusterQuestion({ difficulty, rng });
    case "ALPHABET_PAIR_AND_HALF":
      return buildAlphabetPairAndHalfQuestion({ difficulty, rng });
    default:
      return buildLetterClusterSeriesQuestion({ difficulty, rng });
  }
}

export function generateLetterSeriesBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createLetterRng(
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

    const raw = buildBySubtopic(subtopicKey, diffLabel, rng);
    if (!raw) continue;

    const check = validateLetterSeriesQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeLetterSeriesFingerprint(raw);
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
      subject: "Reasoning Ability",
      subjectKey: "reasoning",
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
      topic: "Letter Series",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(LETTER_SERIES_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { LETTER_SERIES_SUBTOPICS };
