// schemas/questionSchema.js

export const ENGINE_QUESTION_REQUIRED_FIELDS = [
  "questionId",
  "exam",
  "topic",
  "subType",
  "difficulty",
  "questionText",
  "options",
  "correctOptionIndex",
  "answer",
  "solutionSteps",
];

/**
 * Validates the raw question schema emitted by any Question Engine generator.
 */
export function assertEngineQuestionSchema(question) {
  if (!question || typeof question !== "object") {
    throw new Error("Generated question must be an object.");
  }

  for (const field of ENGINE_QUESTION_REQUIRED_FIELDS) {
    if (question[field] === undefined || question[field] === null) {
      throw new Error(`Missing required field '${field}' in generated question.`);
    }
  }

  if (typeof question.questionText !== "string" || !question.questionText.trim()) {
    throw new Error("questionText must be a non-empty string.");
  }

  if (!Array.isArray(question.options) || question.options.length < 4) {
    throw new Error("options must be an array with at least 4 items.");
  }

  if (
    typeof question.correctOptionIndex !== "number" ||
    question.correctOptionIndex < 0 ||
    question.correctOptionIndex >= question.options.length
  ) {
    throw new Error("correctOptionIndex is out of bounds.");
  }

  if (!Array.isArray(question.solutionSteps) || question.solutionSteps.length === 0) {
    throw new Error("solutionSteps must be a non-empty array.");
  }

  return true;
}
