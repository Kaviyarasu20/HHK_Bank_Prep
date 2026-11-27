/**
 * Exact Idiom, Phrasal-Verb & Triple-Sentence Usage Verifier for Banking Exams
 *
 * Covers:
 * 1. Exact 5-option uniqueness & expected-answer verification for contextual idiom meaning,
 *    idiom fillers, phrasal verbs, and literal-to-idiom substitution.
 * 2. Exact 3-bit Boolean subset verdict evaluator for PO Mains Triple-Sentence Usage (I, II, III).
 */

export const TRIPLE_USAGE_OPTIONS = [
  "Only I",
  "Only II",
  "Both I and II",
  "Both II and III",
  "All I, II and III",
];

export function evaluateTripleUsageVerdict(v1, v2, v3) {
  if (v1 && !v2 && !v3) return "Only I";
  if (!v1 && v2 && !v3) return "Only II";
  if (v1 && v2 && !v3) return "Both I and II";
  if (!v1 && v2 && v3) return "Both II and III";
  if (v1 && v2 && v3) return "All I, II and III";
  throw new Error(`Unsupported triple-usage mask (${v1},${v2},${v3})`);
}

export function verifyIdiomQuestionIntegrity({ mode, options, correctIndex, expectedAnswer, tripleMask }) {
  const errors = [];
  if (!Array.isArray(options) || options.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 options"] };
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");

  if (mode === "IDIOM_USAGE_TRIPLE_MAINS") {
    const expected = evaluateTripleUsageVerdict(tripleMask[0], tripleMask[1], tripleMask[2]);
    if (options[correctIndex] !== expected) {
      errors.push(`Triple usage mismatch: expected '${expected}', got '${options[correctIndex]}'`);
    }
  } else {
    if (options[correctIndex] !== expectedAnswer) {
      errors.push(`Expected '${expectedAnswer}' at index ${correctIndex}, found '${options[correctIndex]}'`);
    }
  }
  return { valid: errors.length === 0, errors };
}
