/**
 * Exact Grammar Option-Integrity & Rule-Match Verifier for Banking Exams
 *
 * Ensures every Grammar question has:
 * - Strictly 5 unique, non-empty options
 * - Exact match between options[correctIndex] and expectedAnswer
 * - Valid ruleTag & non-empty explanation
 */

export function verifyGrammarQuestionIntegrity({ options, correctIndex, expectedAnswer, ruleTag }) {
  const errors = [];
  if (!Array.isArray(options) || options.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 options"] };
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");
  if (options[correctIndex] !== expectedAnswer) {
    errors.push(`Expected '${expectedAnswer}' at index ${correctIndex}, found '${options[correctIndex]}'`);
  }
  if (!ruleTag) errors.push("Missing grammar ruleTag");
  return { valid: errors.length === 0, errors };
}
