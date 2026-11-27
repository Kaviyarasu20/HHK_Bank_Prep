import {
  buildMissingSymbolQuestion,
  buildStandardInequalityQuestion,
  createInequalityRng,
  INEQUALITY_SUBTOPICS,
} from "./inequalityBuilder.js";
import { computeInequalityFingerprint, validateInequalityQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("coded")) return ["CODED_INEQUALITY"];
  if (s.includes("missing") || s.includes("blank") || s.includes("fill")) return ["MISSING_SYMBOL"];
  if (s.includes("either") || s.includes("neither")) return ["EITHER_OR"];
  if (s.includes("multi") || s.includes("comma")) return ["MULTI_STATEMENT"];
  if (s.includes("direct") || s.includes("single")) return ["DIRECT_CHAIN"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") return ["DIRECT_CHAIN", "DIRECT_CHAIN", "EITHER_OR", "MULTI_STATEMENT"];
  if (diff === "Hard") return ["CODED_INEQUALITY", "MISSING_SYMBOL", "EITHER_OR", "MULTI_STATEMENT"];
  return ["MULTI_STATEMENT", "EITHER_OR", "DIRECT_CHAIN", "CODED_INEQUALITY"];
}

const OUTCOME_ROTATION = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"];

export function generateInequalityBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createInequalityRng(
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
    const targetOutcome =
      subtopicKey === "EITHER_OR"
        ? idx % 3 === 0
          ? "NEITHER"
          : "EITHER_OR"
        : OUTCOME_ROTATION[(count === 1 ? rng.int(0, OUTCOME_ROTATION.length - 1) : idx + attempts) % OUTCOME_ROTATION.length];

    const raw =
      subtopicKey === "MISSING_SYMBOL"
        ? buildMissingSymbolQuestion({ difficulty: diffLabel, rng })
        : buildStandardInequalityQuestion({
            subtopicKey,
            difficulty: diffLabel,
            targetOutcome: attempts % 5 === 0 ? null : targetOutcome,
            rng,
          });

    if (!raw) continue;
    const check = validateInequalityQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeInequalityFingerprint(raw);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const { _meta, ...publicFields } = raw;
    const optionsMap = Object.fromEntries(
      raw.options.map((text, oIdx) => [String.fromCharCode(65 + oIdx), text]),
    );
    questions.push({
      ...publicFields,
      answer: raw.answer ?? raw.options[raw.correctIndex ?? raw.correctOptionIndex],
      correctOptionIndex: raw.correctOptionIndex ?? raw.correctIndex,
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
      validation: { solverVerified: true, mode: _meta.mode },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Inequality",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(INEQUALITY_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { INEQUALITY_SUBTOPICS };
