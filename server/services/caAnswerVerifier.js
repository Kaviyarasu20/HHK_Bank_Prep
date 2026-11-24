import { isValueGroundedInSource } from "./caFactExtractor.js";

/**
 * Deterministic Answer & Source Verifier.
 * Verifies that:
 * 1. Correct option text & numerical/date values are grounded in the source text.
 * 2. Explanation supports the chosen correct answer and does not contradict it.
 * 3. Phase 4 reference records are not stale/archived/pending_verification.
 */
export function verifyQuestionAnswer({
  question,
  sourceText = "",
  sourceFreshness = null,
}) {
  const errors = [];
  const warnings = [];

  const options = Array.isArray(question?.options) ? question.options : [];
  const correctOpt = options.find((o) => o.key === question?.correctAnswer);

  if (!correctOpt) {
    errors.push("Correct answer key does not match any listed option.");
    return {
      answerStatus: "failed",
      sourceStatus: "failed",
      errors,
      warnings,
    };
  }

  // Check if reference source is stale/archived/unverified
  if (sourceFreshness) {
    if (sourceFreshness.state === "outdated" || sourceFreshness.state === "historical") {
      errors.push(
        `Source reference is marked "${sourceFreshness.label}"; outdated or archived reference records cannot produce current questions.`,
      );
    } else if (
      sourceFreshness.state === "verification_due" ||
      sourceFreshness.state === "pending_verification"
    ) {
      warnings.push(
        `Source reference is "${sourceFreshness.label}"; manual verification required before approval.`,
      );
    }
  }

  // Verify numeric/date tokens in the correct option appear in source text (skip pure statement-combo options like "Only 1 and 2")
  const isComboOption = /^(only\s+|both\s+|all\s+|neither\s+|1\s*[-–]|a-\d)/i.test(
    correctOpt.text.trim(),
  );
  if (sourceText && !isComboOption) {
    const nums = correctOpt.text.match(/\d+(?:[.,]\d+)*/g) || [];
    for (const num of nums) {
      if (!isValueGroundedInSource(num, sourceText)) {
        errors.push(
          `Numerical/date value "${num}" in correct option "${correctOpt.text}" is not found in the source material.`,
        );
      }
    }
  }

  // Check explanation supports correct answer and does not contradict it
  const expl = String(question?.explanation || "").trim();
  if (!expl || expl.length < 15) {
    errors.push("Explanation is missing or too brief to substantiate the answer.");
  } else {
    const lowerExpl = expl.toLowerCase();
    // Detect obvious contradiction like "the correct answer is B" when correctAnswer is A
    const explicitKeyMatch = lowerExpl.match(/correct\s+(?:answer|option)\s+is\s+(?:option\s+)?([a-e])\b/i);
    if (explicitKeyMatch && explicitKeyMatch[1].toUpperCase() !== question.correctAnswer) {
      errors.push(
        `Explanation states option ${explicitKeyMatch[1].toUpperCase()} while correctAnswer is ${question.correctAnswer}.`,
      );
    }
  }

  if (!String(question?.sourceReference || "").trim()) {
    warnings.push("Missing supporting sourceReference excerpt.");
  }

  const answerStatus = errors.length > 0 ? "failed" : warnings.length > 0 ? "warnings" : "passed";
  const sourceStatus =
    errors.some((e) => e.includes("source") || e.includes("Source"))
      ? "failed"
      : warnings.length > 0
        ? "warnings"
        : "passed";

  return { answerStatus, sourceStatus, errors, warnings };
}
