// core/validator.js
import { assertEngineQuestionSchema } from "../schemas/questionSchema.js";

/**
 * Performs strict mathematical and structural validation on a generated question
 * to guarantee zero NaN/undefined leaks, unique options, and exact answer key match.
 */
export function validateEngineQuestion(question) {
  try {
    assertEngineQuestionSchema(question);
  } catch (err) {
    return { valid: false, reason: err.message };
  }

  const text = String(question.questionText);
  if (text.includes("NaN") || text.includes("undefined") || text.includes("null")) {
    return { valid: false, reason: "questionText contains NaN/undefined/null." };
  }

  const normalizedOptions = question.options.map((opt) => String(opt ?? "").trim());
  const hasInvalidOption = normalizedOptions.some(
    (opt) =>
      !opt ||
      opt.includes("NaN") ||
      opt.includes("undefined") ||
      opt.includes("Infinity")
  );
  if (hasInvalidOption) {
    return { valid: false, reason: "One or more options contain invalid/NaN values." };
  }

  const uniqueOptions = new Set(normalizedOptions.map((o) => o.toLowerCase()));
  if (uniqueOptions.size !== normalizedOptions.length) {
    return { valid: false, reason: "Duplicate options detected." };
  }

  const indexedAnswer = normalizedOptions[question.correctOptionIndex];
  const declaredAnswer = String(question.answer ?? "").trim();
  if (indexedAnswer !== declaredAnswer) {
    return {
      valid: false,
      reason: `Answer mismatch: options[${question.correctOptionIndex}]='${indexedAnswer}' !== answer='${declaredAnswer}'.`,
    };
  }

  return { valid: true, reason: null };
}
