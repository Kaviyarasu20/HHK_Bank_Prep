/**
 * Strict Independent Validator & Fingerprinter for Letter Series Questions
 */

import crypto from "node:crypto";
import {
  applyFillToTemplate,
  buildHalfReversedAlphabet,
  extractFillChars,
  findAlphabeticalPairs,
  generateClusterSequence,
  generateSingleLetterSequence,
} from "./solver.js";

const COUNT_LABELS = ["None", "One", "Two", "Three", "Four", "More than four"];

export function validateLetterSeriesQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 25) {
    errors.push("Question text missing or too short");
  }
  if (!Array.isArray(q.options) || q.options.length !== 5) {
    errors.push("Must have exactly 5 options");
  } else {
    const uniq = new Set(q.options.map((o) => String(o).trim()));
    if (uniq.size !== 5) errors.push("Duplicate options detected");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 4) {
    errors.push("Invalid correctIndex");
  }
  const expectedLetter = String.fromCharCode(65 + q.correctIndex);
  if (q.correctAnswer !== expectedLetter) {
    errors.push(`correctAnswer mismatch (${q.correctAnswer} vs ${expectedLetter})`);
  }

  const chosen = q.options?.[q.correctIndex];
  const meta = q._meta || {};

  if (meta.subType === "SINGLE_LETTER_SERIES") {
    const seq = generateSingleLetterSequence(meta.rule, meta.length);
    if (seq[meta.length - 1] !== chosen) errors.push("Single letter series mismatch");
  } else if (meta.subType === "LETTER_CLUSTER_SERIES") {
    const seq = generateClusterSequence(meta.starts, meta.diffs, meta.length);
    if (seq[meta.length - 1] !== chosen) errors.push("Letter cluster series mismatch");
  } else if (meta.subType === "CONTINUOUS_PATTERN_FILL") {
    const expected = extractFillChars(meta.fullStr, meta.blankIndices);
    if (expected !== chosen) errors.push("Continuous pattern fill mismatch");
    if (applyFillToTemplate(meta.template, chosen) !== meta.fullStr) {
      errors.push("Filled template does not reconstruct full pattern");
    }
  } else if (meta.subType === "WRONG_LETTER_CLUSTER") {
    const correctSeq = generateClusterSequence(meta.starts, meta.diffs, 5);
    if (correctSeq[meta.wrongIdx] === chosen || meta.wrongTerm !== chosen) {
      errors.push("Wrong letter cluster mismatch");
    }
  } else if (meta.subType === "ALPHABET_PAIR_AND_HALF") {
    if (meta.mode === "PAIR_COUNT") {
      const pairs = findAlphabeticalPairs(meta.word);
      const expected = pairs.length >= 5 ? "More than four" : COUNT_LABELS[pairs.length];
      if (expected !== chosen) errors.push("Alphabetical pair count mismatch");
    } else {
      const alpha = buildHalfReversedAlphabet(meta.reverseMode);
      const expected = alpha[meta.bFromLeft - meta.aLeft - 1];
      if (expected !== chosen) errors.push("Reversed-half alphabet lookup mismatch");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeLetterSeriesFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
