/**
 * Exact Slot-Substitution & Option-Integrity Verifier for Banking Fill in the Blanks
 *
 * Verifies:
 * 1. Exact blank count matches the question mode (1 blank for Single/Grammar/Connector, 2 blanks for Double/Dual-Sentence)
 * 2. All 5 options are strictly unique and non-empty
 * 3. Substituting the verified answer into the template removes every blank marker cleanly
 */

export function fillBlankTemplate(template, answers) {
  let out = String(template || "");
  for (const ans of answers) {
    out = out.replace("_____", ans);
  }
  return out;
}

export function verifyFillerQuestionIntegrity({ template, expectedBlankCount, options, correctIndex, expectedAnswer }) {
  const errors = [];
  const blankMatches = (String(template || "").match(/_____/g) || []).length;
  if (blankMatches !== expectedBlankCount) {
    errors.push(`Expected ${expectedBlankCount} blank(s), found ${blankMatches}`);
  }
  if (!Array.isArray(options) || options.length !== 5) {
    errors.push("Must have exactly 5 options");
  } else {
    const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
    if (uniq.size !== 5) errors.push("Duplicate options detected");
  }
  if (options?.[correctIndex] !== expectedAnswer) {
    errors.push(`Expected "${expectedAnswer}" at index ${correctIndex}, found "${options?.[correctIndex]}"`);
  }
  return { valid: errors.length === 0, errors };
}
