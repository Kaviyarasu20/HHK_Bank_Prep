// Place at: server/question-engine/generators/quant/pipesCisterns/index.js
import { createRng } from "./rational.js";
import { PRELIMS_TEMPLATES } from "./prelimsTemplates.js";
import { MAINS_TEMPLATES } from "./mainsTemplates.js";
import {
  computeQuestionFingerprint,
  validatePipesCisternsQuestion,
} from "./independentValidator.js";

export const ALL_PIPES_TEMPLATES = [...PRELIMS_TEMPLATES, ...MAINS_TEMPLATES];

export const TEMPLATE_BY_ID = Object.fromEntries(
  ALL_PIPES_TEMPLATES.map((t) => [t.id, t])
);

/**
 * Exam-specific blueprints across IBPS RRB Clerk/PO, IBPS Clerk/PO, SBI Clerk/PO.
 */
export const PIPES_EXAM_BLUEPRINTS = {
  RRB_CLERK_PRELIMS: { examLevel: "PRELIMS", difficulties: ["EASY"] },
  IBPS_CLERK_PRELIMS: { examLevel: "PRELIMS", difficulties: ["EASY", "MODERATE"] },
  SBI_CLERK_PRELIMS: { examLevel: "PRELIMS", difficulties: ["EASY", "MODERATE"] },
  RRB_PO_PRELIMS: { examLevel: "PRELIMS", difficulties: ["EASY", "MODERATE"] },
  IBPS_PO_PRELIMS: { examLevel: "PRELIMS", difficulties: ["MODERATE"] },
  SBI_PO_PRELIMS: { examLevel: "PRELIMS", difficulties: ["MODERATE", "DIFFICULT"] },
  IBPS_PO_MAINS: { examLevel: "MAINS", difficulties: ["MODERATE", "DIFFICULT"] },
  SBI_PO_MAINS: { examLevel: "MAINS", difficulties: ["DIFFICULT"] },
};

function normalizeDifficultyFilter(diff) {
  if (!diff || String(diff).toUpperCase() === "AUTO") return null;
  const d = String(diff).toUpperCase();
  if (d === "MEDIUM") return "MODERATE";
  if (d === "HARD") return "DIFFICULT";
  return d; // EASY | MODERATE | DIFFICULT
}

/**
 * Formats a verified Pipes & Cisterns question into the canonical output contract
 * compatible with both Section 13 and the HHK Question Engine / PostgreSQL pipeline.
 */
function finalizeVerifiedQuestion(raw, fingerprint, seed) {
  return {
    // Section 13 conceptual contract
    topic: "Time and Work",
    subtopic: "Pipes and Cisterns",
    templateId: raw.templateId,
    templateVersion: raw.templateVersion,
    questionType: raw.questionType,
    exam: raw.exam,
    examLevel: raw.examLevel,
    difficulty: raw.difficulty,
    question: raw.question,
    options: raw.options,
    correctAnswer: raw.correctAnswer,
    correctValue: raw.correctValue,
    unit: raw.unit,
    solution: raw.solution,
    validationStatus: "PASSED",
    fingerprint,
    seed,

    // HHK Question Engine standard compatibility fields
    questionId: `${raw.templateId}_${fingerprint.slice(0, 8)}`,
    questionText: raw.question,
    subType: raw.questionType,
    correctOptionIndex: raw.correctOptionIndex,
    answer: raw.correctAnswer,
    solutionSteps: raw.solution,
    generationMode: "RULE_ENGINE",
  };
}

/**
 * Production-quality Pipes & Cisterns Batch Generator.
 * - Uses Engine A (36 modular exact-rational templates)
 * - Verifies every single question independently with Engine B
 * - Enforces normalized mathematical duplicate prevention
 * - Supports deterministic seeded generation & logs rejected attempts
 */
export function generatePipesCisternsBatch({
  exam = "IBPS_PO_PRELIMS",
  level = "AUTO", // "PRELIMS" | "MAINS" | "BOTH" | "AUTO"
  difficulty = "AUTO", // "EASY" | "MODERATE" | "DIFFICULT" | "MEDIUM" | "HARD" | "AUTO"
  templateIds = null,
  count = 10,
  seed = Date.now(),
  existingFingerprints = new Set(),
  returnDiagnostics = false,
} = {}) {
  const rng = createRng(seed);
  const normDiff = normalizeDifficultyFilter(difficulty);
  const blueprint = PIPES_EXAM_BLUEPRINTS[exam] || PIPES_EXAM_BLUEPRINTS.IBPS_PO_PRELIMS;

  // Select eligible templates
  let pool = ALL_PIPES_TEMPLATES;
  if (Array.isArray(templateIds) && templateIds.length > 0) {
    pool = templateIds.map((id) => TEMPLATE_BY_ID[id]).filter(Boolean);
  } else {
    const reqLevel = String(level || "AUTO").toUpperCase();
    const targetLevel =
      reqLevel === "AUTO" ? blueprint.examLevel : reqLevel;

    if (targetLevel === "PRELIMS") {
      pool = PRELIMS_TEMPLATES;
    } else if (targetLevel === "MAINS") {
      pool = MAINS_TEMPLATES;
    }

    if (normDiff) {
      const diffFiltered = pool.filter((t) => t.difficulty === normDiff);
      if (diffFiltered.length > 0) pool = diffFiltered;
    }
  }

  if (!pool.length) {
    throw new Error("No Pipes & Cisterns templates matched the requested criteria.");
  }

  const seenFingerprints = new Set(existingFingerprints);
  const verifiedQuestions = [];
  const failedAttempts = [];
  const maxTotalAttempts = Math.max(count * 12, 60);

  let attempts = 0;
  let cursor = 0;

  while (verifiedQuestions.length < count && attempts < maxTotalAttempts) {
    attempts++;
    const tpl = pool[cursor % pool.length];
    cursor++;

    let raw;
    try {
      raw = tpl.generate(rng, exam);
    } catch (err) {
      failedAttempts.push({ templateId: tpl.id, stage: "GENERATE", reason: err.message });
      continue;
    }

    const fingerprint = computeQuestionFingerprint(raw.mathModel, tpl.id);
    if (seenFingerprints.has(fingerprint)) {
      failedAttempts.push({ templateId: tpl.id, stage: "DEDUP", reason: "Duplicate mathematical fingerprint" });
      continue;
    }

    // Engine B Independent Verification Gate
    const verdict = validatePipesCisternsQuestion(raw);
    if (!verdict.passed) {
      failedAttempts.push({ templateId: tpl.id, stage: "ENGINE_B_VALIDATE", reason: verdict.reason });
      continue;
    }

    seenFingerprints.add(fingerprint);
    verifiedQuestions.push(finalizeVerifiedQuestion(raw, fingerprint, rng.seed));
  }

  if (returnDiagnostics) {
    return {
      questions: verifiedQuestions,
      failedAttempts,
      totalAttempts: attempts,
      seed: rng.seed,
    };
  }

  return verifiedQuestions;
}