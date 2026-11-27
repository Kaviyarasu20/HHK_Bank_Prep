import {
  buildWordUsageQuestion,
  createWuRng,
  WORD_USAGE_SUBTOPICS,
} from "./wordUsageBuilder.js";
import {
  computeWordUsageFingerprint,
  validateWordUsageQuestion,
} from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("triple")) return ["TRIPLE_SENTENCE_USAGE"];
  if (s.includes("incorrect") || s.includes("outlier")) return ["INCORRECT_USAGE_OUTLIER"];
  if (s.includes("polysem") || s.includes("same-sense") || s.includes("match")) return ["POLYSEMY_USAGE_MATCH"];
  if (s.includes("approp") || s.includes("replace")) return ["CONTEXTUAL_APPROPRIATENESS"];
  if (s.includes("dual")) return ["DUAL_CONTEXT_WORD_USAGE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["CONTEXTUAL_APPROPRIATENESS", "TRIPLE_SENTENCE_USAGE", "DUAL_CONTEXT_WORD_USAGE"];
  }
  if (diff === "Hard") {
    return ["TRIPLE_SENTENCE_USAGE", "POLYSEMY_USAGE_MATCH", "INCORRECT_USAGE_OUTLIER", "DUAL_CONTEXT_WORD_USAGE", "CONTEXTUAL_APPROPRIATENESS"];
  }
  return [
    "TRIPLE_SENTENCE_USAGE",
    "INCORRECT_USAGE_OUTLIER",
    "POLYSEMY_USAGE_MATCH",
    "CONTEXTUAL_APPROPRIATENESS",
    "DUAL_CONTEXT_WORD_USAGE",
  ];
}

export function generateWordUsageBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createWuRng(
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

    const raw = buildWordUsageQuestion({
      subtopicKey,
      difficulty: diffLabel,
      rng,
    });
    if (!raw) continue;

    const check = validateWordUsageQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeWordUsageFingerprint(raw);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const { _meta, ...publicFields } = raw;
    const optionsMap = Object.fromEntries(
      raw.options.map((text, oIdx) => [String.fromCharCode(65 + oIdx), text]),
    );

    questions.push({
      ...publicFields,
      questionId: `WU_${rng.seed}_${idx}_${attempts}`,
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
      validation: { solverVerified: true, mode: _meta.mode },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Word Usage",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(WORD_USAGE_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { WORD_USAGE_SUBTOPICS };
