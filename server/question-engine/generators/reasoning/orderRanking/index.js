import {
  buildComparisonRankingQuestion,
  buildInterchangeQuestion,
  buildMaxMinOverlapQuestion,
  buildRatioClassRankingQuestion,
  buildTotalAndRankQuestion,
  createOrderRng,
  ORDER_RANKING_SUBTOPICS,
} from "./orderRankingBuilder.js";
import { computeOrderRankingFingerprint, validateOrderRankingQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("interchange") || s.includes("swap")) return ["INTERCHANGE_POSITIONS"];
  if (s.includes("max") || s.includes("min") || s.includes("overlap") || s.includes("mid")) return ["MAX_MIN_OVERLAP"];
  if (s.includes("compar") || s.includes("height") || s.includes("weight")) return ["COMPARISON_RANKING"];
  if (s.includes("ratio") || s.includes("class") || s.includes("boy") || s.includes("girl")) return ["RATIO_CONDITIONAL_RANK"];
  if (s.includes("total") || s.includes("single") || s.includes("shift")) return ["TOTAL_AND_RANK"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["TOTAL_AND_RANK", "INTERCHANGE_POSITIONS", "COMPARISON_RANKING", "MAX_MIN_OVERLAP"];
  }
  if (diff === "Hard") {
    return ["MAX_MIN_OVERLAP", "RATIO_CONDITIONAL_RANK", "COMPARISON_RANKING", "INTERCHANGE_POSITIONS", "TOTAL_AND_RANK"];
  }
  return ["INTERCHANGE_POSITIONS", "MAX_MIN_OVERLAP", "COMPARISON_RANKING", "RATIO_CONDITIONAL_RANK", "TOTAL_AND_RANK"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "TOTAL_AND_RANK":
      return buildTotalAndRankQuestion({ difficulty, rng });
    case "INTERCHANGE_POSITIONS":
      return buildInterchangeQuestion({ difficulty, rng });
    case "MAX_MIN_OVERLAP":
      return buildMaxMinOverlapQuestion({ difficulty, rng });
    case "COMPARISON_RANKING":
      return buildComparisonRankingQuestion({ difficulty, rng });
    case "RATIO_CONDITIONAL_RANK":
      return buildRatioClassRankingQuestion({ difficulty, rng });
    default:
      return buildTotalAndRankQuestion({ difficulty, rng });
  }
}

export function generateOrderRankingBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createOrderRng(
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

    const check = validateOrderRankingQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeOrderRankingFingerprint(raw);
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
      topic: "Order & Ranking",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(ORDER_RANKING_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { ORDER_RANKING_SUBTOPICS };
