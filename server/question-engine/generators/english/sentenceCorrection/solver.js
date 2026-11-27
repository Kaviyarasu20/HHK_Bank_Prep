/**
 * Exact 1-of-5 Full-Sentence Correct/Incorrect Integrity Verifier
 *
 * Every Sentence Correction item carries 5 tagged sentence options:
 *   [{ text: string, isCorrect: boolean }]
 * - In "FIND_CORRECT" mode: strictly 1 option has isCorrect === true, 4 have isCorrect === false.
 * - In "FIND_INCORRECT" mode: strictly 1 option has isCorrect === false, 4 have isCorrect === true.
 */

export function verifySentenceCorrectionSet({ mode, taggedOptions, correctIndex }) {
  const errors = [];
  if (!Array.isArray(taggedOptions) || taggedOptions.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 tagged sentence options"] };
  }
  const uniq = new Set(taggedOptions.map((o) => String(o.text || "").trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate sentence options detected");

  const targetFlag = mode === "FIND_CORRECT";
  const matchingIndices = [];
  for (let i = 0; i < 5; i++) {
    if (Boolean(taggedOptions[i].isCorrect) === targetFlag) {
      matchingIndices.push(i);
    }
  }

  if (matchingIndices.length !== 1) {
    errors.push(`Expected strictly 1 option matching ${mode}, found ${matchingIndices.length}`);
  } else if (matchingIndices[0] !== correctIndex) {
    errors.push(`correctIndex ${correctIndex} != unique matching index ${matchingIndices[0]}`);
  }

  return { valid: errors.length === 0, errors };
}
