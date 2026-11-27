/**
 * Exact Formal Verifiers for Banking Exam Word Usage
 *
 * Covers:
 * 1. Triple-Sentence Boolean subset evaluator (I, II, III) -> exact 5-option verdict
 * 2. 1-of-5 Incorrect Usage & Polysemy Match verifier
 * 3. Contextual Appropriateness (+ No replacement required) verifier
 */

export const WORD_USAGE_TRIPLE_OPTIONS = [
  "Only I",
  "Only II",
  "Both I and II",
  "Both II and III",
  "All I, II and III",
];

export function evaluateWordUsageTriple(v1, v2, v3) {
  if (v1 && !v2 && !v3) return "Only I";
  if (!v1 && v2 && !v3) return "Only II";
  if (v1 && v2 && !v3) return "Both I and II";
  if (!v1 && v2 && v3) return "Both II and III";
  if (v1 && v2 && v3) return "All I, II and III";
  throw new Error(`Unsupported triple mask (${v1},${v2},${v3})`);
}

export function verifyWordUsageIntegrity({ mode, options, correctIndex, expectedAnswer, tripleMask, taggedOptions }) {
  const errors = [];
  if (!Array.isArray(options) || options.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 options"] };
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");

  if (mode === "TRIPLE_SENTENCE_USAGE") {
    const expected = evaluateWordUsageTriple(tripleMask[0], tripleMask[1], tripleMask[2]);
    if (options[correctIndex] !== expected) {
      errors.push(`Triple usage mismatch: expected '${expected}', got '${options[correctIndex]}'`);
    }
  } else if (mode === "INCORRECT_USAGE_OUTLIER") {
    const bads = taggedOptions.map((o, i) => (!o.isValid ? i : -1)).filter((i) => i !== -1);
    if (bads.length !== 1 || bads[0] !== correctIndex) {
      errors.push(`Expected 1 invalid usage at ${correctIndex}, found ${JSON.stringify(bads)}`);
    }
  } else {
    if (options[correctIndex] !== expectedAnswer) {
      errors.push(`Expected '${expectedAnswer}' at index ${correctIndex}, found '${options[correctIndex]}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}
