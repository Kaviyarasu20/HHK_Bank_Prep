import {
  buildAngularRotationQuestion,
  buildCodedDirectionQuestion,
  buildPathShortestDistanceQuestion,
  buildRelativePointsQuestion,
  buildShadowDirectionQuestion,
  createDirectionRng,
  DIRECTION_SUBTOPICS,
} from "./directionBuilder.js";
import { computeDirectionFingerprint, validateDirectionQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("coded")) return ["CODED_DIRECTION"];
  if (s.includes("shadow") || s.includes("sun")) return ["SHADOW_DIRECTION"];
  if (s.includes("angle") || s.includes("angular") || s.includes("rotat")) return ["ANGULAR_ROTATION"];
  if (s.includes("point") || s.includes("relative") || s.includes("grid")) return ["RELATIVE_POINTS"];
  if (s.includes("path") || s.includes("shortest") || s.includes("pythag")) return ["PATH_SHORTEST_DISTANCE"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["PATH_SHORTEST_DISTANCE", "SHADOW_DIRECTION", "ANGULAR_ROTATION", "RELATIVE_POINTS"];
  }
  if (diff === "Hard") {
    return ["CODED_DIRECTION", "RELATIVE_POINTS", "PATH_SHORTEST_DISTANCE", "SHADOW_DIRECTION", "ANGULAR_ROTATION"];
  }
  return ["PATH_SHORTEST_DISTANCE", "RELATIVE_POINTS", "CODED_DIRECTION", "SHADOW_DIRECTION", "ANGULAR_ROTATION"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "PATH_SHORTEST_DISTANCE":
      return buildPathShortestDistanceQuestion({ difficulty, rng });
    case "RELATIVE_POINTS":
      return buildRelativePointsQuestion({ difficulty, rng });
    case "CODED_DIRECTION":
      return buildCodedDirectionQuestion({ difficulty, rng });
    case "SHADOW_DIRECTION":
      return buildShadowDirectionQuestion({ difficulty, rng });
    case "ANGULAR_ROTATION":
      return buildAngularRotationQuestion({ difficulty, rng });
    default:
      return buildPathShortestDistanceQuestion({ difficulty, rng });
  }
}

export function generateDirectionDistanceBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createDirectionRng(
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

    const check = validateDirectionQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeDirectionFingerprint(raw);
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
      topic: "Direction & Distance",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(DIRECTION_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { DIRECTION_SUBTOPICS };
