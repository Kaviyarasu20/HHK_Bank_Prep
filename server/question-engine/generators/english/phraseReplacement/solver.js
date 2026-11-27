/**
 * Exact Phrase-Slot Substitution & No-Correction Verifier for Banking Phrase Replacement
 *
 * Verifies:
 * 1. Highlighted phrase `[shownPhrase]` appears verbatim in the rendered sentence.
 * 2. Option E (index 4) is always `"No correction required"`.
 * 3. If `isNoCorrection === true`: `shownPhrase === correctPhrase`, answer is index 4,
 *    and none of the 4 distractor phrases equals `correctPhrase`.
 * 4. If `isNoCorrection === false`: `shownPhrase !== correctPhrase`, answer is the exact
 *    index of `correctPhrase` in A–D, and all 5 options are strictly distinct.
 */

export function renderHighlightedSentence(prefix, shownPhrase, suffix) {
  return `${prefix}[${shownPhrase}]${suffix}`;
}

export function verifyPhraseReplacementIntegrity({
  sentence,
  shownPhrase,
  correctPhrase,
  isNoCorrection,
  options,
  correctIndex,
}) {
  const errors = [];
  if (!String(sentence || "").includes(`[${shownPhrase}]`)) {
    errors.push(`Sentence does not contain highlighted phrase [${shownPhrase}]`);
  }
  if (!Array.isArray(options) || options.length !== 5) {
    errors.push("Must have exactly 5 options");
    return { valid: false, errors };
  }
  if (options[4] !== "No correction required") {
    errors.push("Option E must be 'No correction required'");
  }
  const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
  if (uniq.size !== 5) errors.push("Duplicate options detected");

  if (isNoCorrection) {
    if (shownPhrase !== correctPhrase) errors.push("No-correction item must display correctPhrase");
    if (correctIndex !== 4) errors.push(`Expected correctIndex 4 for No correction, got ${correctIndex}`);
    if (options.slice(0, 4).includes(correctPhrase)) {
      errors.push("Distractor A-D duplicates correctPhrase on No-correction item");
    }
  } else {
    if (shownPhrase === correctPhrase) errors.push("Error item must not display correctPhrase");
    if (correctIndex < 0 || correctIndex > 3) errors.push(`Expected correctIndex 0..3, got ${correctIndex}`);
    if (options[correctIndex] !== correctPhrase) {
      errors.push(`Expected '${correctPhrase}' at index ${correctIndex}, found '${options[correctIndex]}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}
