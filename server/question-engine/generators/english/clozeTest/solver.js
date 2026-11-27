/**
 * Exact Cloze Passage Blank-Slot & Replacement Verifier for Banking Exams
 *
 * Supports:
 * 1. Standard 5-Blank Cloze Passage (fill blank #(k) with exact contextual word)
 * 2. New-Pattern Highlighted-Word Cloze (PO Mains): given [word] at blank #(k),
 *    replace it with the exact contextual word OR select "No correction required"
 */

export function renderStandardClozePassage(templateText, blanks, activeBlankNum) {
  let text = templateText;
  for (const b of blanks) {
    const marker = `{{${b.num}}}`;
    const display = b.num === activeBlankNum ? `_____(${b.num})_____` : `___(${b.num})___`;
    text = text.replace(marker, display);
  }
  return text;
}

export function renderNewPatternClozePassage(templateText, blanks, activeBlankNum, shownWord) {
  let text = templateText;
  for (const b of blanks) {
    const marker = `{{${b.num}}}`;
    const display =
      b.num === activeBlankNum
        ? `[${shownWord}] (${b.num})`
        : b.answer;
    text = text.replace(marker, display);
  }
  return text;
}

export function verifyClozeBlankConsistency({ templateText, blanks, activeBlankNum, options, correctIndex, expectedAnswer }) {
  const errors = [];
  const target = blanks.find((b) => b.num === activeBlankNum);
  if (!target) {
    errors.push(`Active blank #${activeBlankNum} not found in passage blueprint`);
    return { valid: false, errors };
  }
  if (!templateText.includes(`{{${activeBlankNum}}}`)) {
    errors.push(`Template text missing placeholder {{${activeBlankNum}}}`);
  }
  if (!Array.isArray(options) || options.length !== 5) {
    errors.push("Must have exactly 5 options");
  } else {
    const uniq = new Set(options.map((o) => String(o).trim().toLowerCase()));
    if (uniq.size !== 5) errors.push("Duplicate options detected");
  }
  if (options?.[correctIndex] !== expectedAnswer) {
    errors.push(`Expected answer "${expectedAnswer}" at index ${correctIndex}, found "${options?.[correctIndex]}"`);
  }
  return { valid: errors.length === 0, errors };
}
