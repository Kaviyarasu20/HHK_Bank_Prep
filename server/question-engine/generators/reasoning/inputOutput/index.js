import {
  buildDigitOpMachineQuestion,
  buildDualEndWordNumberQuestion,
  buildInterleavedAutoArrangeQuestion,
  buildNumberArithmeticMachineQuestion,
  buildWordNumberTransformQuestion,
  createIoRng,
  INPUT_OUTPUT_SUBTOPICS,
} from "./inputOutputBuilder.js";
import { computeInputOutputFingerprint, validateInputOutputQuestion } from "./validator.js";

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveSubtopicPlan(difficulty, subtopicName = "") {
  const s = String(subtopicName || "").toLowerCase();
  if (s.includes("digit")) return ["DIGIT_OP_MACHINE"];
  if (s.includes("transform")) return ["WORD_NUMBER_TRANSFORM"];
  if (s.includes("arith") || s.includes("number-only") || s.includes("number only")) return ["NUMBER_ARITHMETIC_MACHINE"];
  if (s.includes("interleav") || s.includes("auto")) return ["INTERLEAVED_WORD_NUMBER"];
  if (s.includes("dual") || s.includes("shift")) return ["DUAL_END_WORD_NUMBER"];

  const diff = normalizeDiffLabel(difficulty);
  if (diff === "Easy") {
    return ["DUAL_END_WORD_NUMBER", "INTERLEAVED_WORD_NUMBER", "NUMBER_ARITHMETIC_MACHINE"];
  }
  if (diff === "Hard") {
    return ["WORD_NUMBER_TRANSFORM", "NUMBER_ARITHMETIC_MACHINE", "DIGIT_OP_MACHINE", "DUAL_END_WORD_NUMBER", "INTERLEAVED_WORD_NUMBER"];
  }
  return ["DUAL_END_WORD_NUMBER", "INTERLEAVED_WORD_NUMBER", "NUMBER_ARITHMETIC_MACHINE", "WORD_NUMBER_TRANSFORM", "DIGIT_OP_MACHINE"];
}

function buildBySubtopic(subtopicKey, difficulty, rng) {
  switch (subtopicKey) {
    case "DUAL_END_WORD_NUMBER":
      return buildDualEndWordNumberQuestion({ difficulty, rng });
    case "INTERLEAVED_WORD_NUMBER":
      return buildInterleavedAutoArrangeQuestion({ difficulty, rng });
    case "NUMBER_ARITHMETIC_MACHINE":
      return buildNumberArithmeticMachineQuestion({ difficulty, rng });
    case "WORD_NUMBER_TRANSFORM":
      return buildWordNumberTransformQuestion({ difficulty, rng });
    case "DIGIT_OP_MACHINE":
      return buildDigitOpMachineQuestion({ difficulty, rng });
    default:
      return buildDualEndWordNumberQuestion({ difficulty, rng });
  }
}

export function generateInputOutputBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "Medium",
  count = 5,
  subtopicName = "",
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const rng = createIoRng(
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

    const check = validateInputOutputQuestion(raw);
    if (!check.valid) {
      rejectedLogs.push({ subtopicKey, errors: check.errors });
      continue;
    }

    const fingerprint = computeInputOutputFingerprint(raw);
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
      topic: "Input-Output",
      requested: count,
      generated: questions.length,
      attempts,
      rejectedCount: rejectedLogs.length,
      difficulty: diffLabel,
      seed: rng.seed,
      subtopicsAvailable: Object.values(INPUT_OUTPUT_SUBTOPICS),
    },
    rejectedLogs,
  };
}

export { INPUT_OUTPUT_SUBTOPICS };
