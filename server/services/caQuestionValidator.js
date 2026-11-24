import { SUPPORTED_QUESTION_TYPES } from "./caQuestionTemplates.js";
import { verifyQuestionAnswer } from "./caAnswerVerifier.js";
import { normalizeAndValidateExplanation } from "./caExplanationGenerator.js";

/**
 * Full deterministic structural, answer, source, and ambiguity validator for MCQs.
 * Mandatory validation failures block automatic acceptance and admin approval.
 */
export function validateGeneratedQuestion({
  question,
  sourceText = "",
  sourceFreshness = null,
  expectedOptionCount = null,
}) {
  const structuralErrors = [];
  const structuralWarnings = [];
  const ambiguityErrors = [];
  const ambiguityWarnings = [];

  const qText = String(question?.questionText || "").trim();
  if (qText.length < 12) {
    structuralErrors.push("Question text is missing or too short (minimum 12 characters).");
  }

  if (!SUPPORTED_QUESTION_TYPES.includes(question?.questionType)) {
    structuralErrors.push(`Unsupported questionType: "${question?.questionType}".`);
  }

  if (!["easy", "moderate", "difficult"].includes(question?.difficulty)) {
    structuralErrors.push(`Invalid difficulty: "${question?.difficulty}".`);
  }

  const options = Array.isArray(question?.options) ? question.options : [];
  if (options.length < 4 || options.length > 5) {
    structuralErrors.push(`Options count must be 4 or 5 (got ${options.length}).`);
  } else if (expectedOptionCount && options.length !== expectedOptionCount) {
    structuralWarnings.push(
      `Expected ${expectedOptionCount} options for target exam profile, got ${options.length}.`,
    );
  }

  // Check unique option keys and unique normalized option texts
  const seenKeys = new Set();
  const seenTexts = new Set();
  for (const opt of options) {
    const key = String(opt?.key || "").trim().toUpperCase();
    const text = String(opt?.text || "").trim();
    if (!/^[A-E]$/.test(key)) {
      structuralErrors.push(`Invalid option label "${key}".`);
    } else if (seenKeys.has(key)) {
      structuralErrors.push(`Duplicate option label "${key}".`);
    }
    seenKeys.add(key);

    if (!text) {
      structuralErrors.push(`Option ${key || "?"} has empty text.`);
    } else {
      const normText = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seenTexts.has(normText)) {
        ambiguityErrors.push(`Duplicate or equivalent option text detected: "${text}".`);
      }
      seenTexts.add(normText);
    }
  }

  const correctKey = String(question?.correctAnswer || "").trim().toUpperCase();
  if (!correctKey || !seenKeys.has(correctKey)) {
    structuralErrors.push("Correct answer is missing or does not reference a valid option.");
  }

  // Ambiguity checks: multiple-choice traps, missing date context on rate/limit questions
  if (/\b(current|present|latest)\s+(repo rate|crr|slr|sdf|msf|limit)\b/i.test(qText) && !/\b(20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|as of|effective)\b/i.test(qText)) {
    ambiguityWarnings.push(
      "Question asks for a changeable rate/limit without stating an effective date or review period.",
    );
  }
  if (/\ball of the above\b/i.test(options.map((o) => o.text).join(" ")) && /\bnone of the above\b/i.test(options.map((o) => o.text).join(" "))) {
    ambiguityWarnings.push("Combining 'All of the above' and 'None of the above' increases ambiguity.");
  }

  // Explanation check
  const correctOpt = options.find((o) => o.key === correctKey);
  const explRes = normalizeAndValidateExplanation({
    rawExplanation: question?.explanation,
    correctOptionText: correctOpt?.text || "",
    sourceReference: question?.sourceReference || "",
    sourceText,
  });

  // Answer & Source Verification
  const answerRes = verifyQuestionAnswer({
    question: { ...question, explanation: explRes.explanation },
    sourceText,
    sourceFreshness,
  });

  const allErrors = [...structuralErrors, ...ambiguityErrors, ...answerRes.errors];
  const allWarnings = [
    ...structuralWarnings,
    ...ambiguityWarnings,
    ...explRes.warnings,
    ...answerRes.warnings,
  ];

  const structuralStatus =
    structuralErrors.length > 0 ? "failed" : structuralWarnings.length > 0 ? "warnings" : "passed";
  const ambiguityStatus =
    ambiguityErrors.length > 0 ? "failed" : ambiguityWarnings.length > 0 ? "warnings" : "passed";
  const overallStatus =
    allErrors.length > 0 ? "failed" : allWarnings.length > 0 ? "warnings" : "passed";

  return {
    overallStatus,
    structuralStatus,
    answerValidationStatus: answerRes.answerStatus,
    sourceValidationStatus: answerRes.sourceStatus,
    ambiguityStatus,
    explanation: explRes.explanation,
    errors: allErrors,
    warnings: allWarnings,
  };
}
