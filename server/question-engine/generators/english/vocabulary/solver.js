/**
 * Exact Slot & Lexical Integrity Verifier for Banking Exam Vocabulary
 *
 * Covers:
 * 1. Misspelt / Inappropriate Word 4-slot verifier (+ Option E "All are correct"):
 *    - Ensures strictly 0 mutated words when errorSlot === 4, or strictly 1 mutated word at errorSlot ∈ {0..3}.
 * 2. Exact 5-option uniqueness & expected-answer verification for One-Word Substitution,
 *    Confusable Homophones, Banking Collocations, and Contextual Definitions.
 */

export function verifyMisspeltSlotIntegrity({ shownWords, correctWords, errorSlot, options, correctIndex }) {
  const errors = [];
  if (!Array.isArray(shownWords) || shownWords.length !== 4 || !Array.isArray(correctWords) || correctWords.length !== 4) {
    return { valid: false, errors: ["Misspelt check requires exactly 4 highlighted words"] };
  }
  if (!Array.isArray(options) || options.length !== 5 || options[4] !== "All are correct") {
    errors.push("Must have 5 options with Option E = 'All are correct'");
  }
  let diffs = 0;
  let diffIdx = -1;
  for (let i = 0; i < 4; i++) {
    if (shownWords[i] !== correctWords[i]) {
      diffs += 1;
      diffIdx = i;
    }
  }
  if (errorSlot === 4) {
    if (diffs !== 0 || correctIndex !== 4) errors.push("All-correct item must have 0 mutated words and correctIndex 4");
  } else {
    if (diffs !== 1 || diffIdx !== errorSlot || correctIndex !== errorSlot) {
      errors.push(`Expected 1 mutated word at slot ${errorSlot}, found ${diffs} at ${diffIdx}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function verifyVocabOptionsIntegrity({ options, correctIndex, expectedAnswer }) {
  const errors = [];
  if (!Array.isArray(options) || options.length !== 5) {
    return { valid: false, errors: ["Must have exactly 5 options"] };
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");
  if (options[correctIndex] !== expectedAnswer) {
    errors.push(`Expected '${expectedAnswer}' at index ${correctIndex}, found '${options[correctIndex]}'`);
  }
  return { valid: errors.length === 0, errors };
}
