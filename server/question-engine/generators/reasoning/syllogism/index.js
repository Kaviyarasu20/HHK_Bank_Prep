import {
  buildReverseSyllogismQuestion,
  buildThreeConclusionQuestion,
  buildTwoConclusionQuestion,
  createSyllogismRng,
  SYLLOGISM_SUBTOPICS,
} from "./statementBuilder.js";
import { computeSyllogismFingerprint, validateSyllogismQuestion } from "./validator.js";

/**
 * HHK Modular Syllogism Question Engine — Unified Entry Module
 *
 * Compatible with:
 *  - server/question-engine/core/engineRouter.js (`FINGERPRINTED_GENERATORS.syllogism`)
 *  - server/services/questionGenerator.js (`SUPPORTED_AUTO_TOPICS.reasoning`)
 *  - Exam-Wise Mock Tests, Topicwise Tests, and Question Bank Auto-Generator
 */

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("reverse")) return ["REVERSE_SYLLOGISM"];
  if (s.includes("3-conclusion") || s.includes("three")) return ["THREE_CONCLUSIONS"];
  if (s.includes("either") || s.includes("neither")) return ["EITHER_OR"];
  if (s.includes("possib") || s.includes("never")) return ["POSSIBILITY"];
  if (s.includes("only")) return ["ONLY_A_FEW"];
  if (s.includes("synonym") || s.includes("quantifier")) return ["MODERN_SYNONYMS"];
  if (s.includes("basic") || s.includes("definite")) return ["BASIC_DEFINITE"];

  const norm = normalizeDiffLabel(difficulty);
  if (norm === "Easy") {
    return ["BASIC_DEFINITE", "BASIC_DEFINITE", "ONLY_A_FEW", "EITHER_OR"];
  }
  if (norm === "Hard") {
    return [
      "ONLY_A_FEW",
      "POSSIBILITY",
      "EITHER_OR",
      "THREE_CONCLUSIONS",
      "REVERSE_SYLLOGISM",
      "MODERN_SYNONYMS",
    ];
  }
  // Medium (IBPS / SBI PO Prelims standard mix)
  return ["ONLY_A_FEW", "POSSIBILITY", "EITHER_OR", "BASIC_DEFINITE", "MODERN_SYNONYMS"];
}

const OUTCOME_ROTATION = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"];

export function generateSyllogismBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const masterRng = createSyllogismRng(
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
    const subtopicKey = count === 1 ? masterRng.pick(plan) : plan[(idx + Math.floor(attempts / 12)) % plan.length];
    const targetOutcome =
      subtopicKey === "EITHER_OR"
        ? idx % 3 === 0
          ? "NEITHER"
          : "EITHER_OR"
        : OUTCOME_ROTATION[(count === 1 ? masterRng.int(0, OUTCOME_ROTATION.length - 1) : idx + attempts) % OUTCOME_ROTATION.length];

    let raw = null;
    if (subtopicKey === "THREE_CONCLUSIONS") {
      raw = buildThreeConclusionQuestion({ difficulty: diffLabel, rng: masterRng });
    } else if (subtopicKey === "REVERSE_SYLLOGISM") {
      raw = buildReverseSyllogismQuestion({ difficulty: diffLabel, rng: masterRng });
    } else {
      raw = buildTwoConclusionQuestion({
        subtopicKey,
        difficulty: diffLabel,
        targetOutcome: attempts % 5 === 0 ? null : targetOutcome,
        rng: masterRng,
      });
    }

    if (!raw) continue;

    const check = validateSyllogismQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeSyllogismFingerprint(raw);
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
      validation: {
        solverVerified: true,
        mode: _meta.mode,
      },
      _solverMeta: _meta,
    });
  }

  return {
    questions,
    meta: {
      topic: "Syllogism",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: masterRng.seed,
      subtopicsAvailable: Object.values(SYLLOGISM_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export function generateSingleSyllogismQuestion(options = {}) {
  const res = generateSyllogismBatch({ ...options, count: 1 });
  return res.questions[0] || null;
}

export { SYLLOGISM_SUBTOPICS };
