/**
 * Strict Independent Validator & Fingerprinter for English Sentence Rearrangement Questions
 */

import crypto from "node:crypto";
import { applyWordSwaps, reconstructFragments } from "./solver.js";

export function validateSentenceRearrangementQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 40) {
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

  if (meta.subType === "FOUR_PART_SENTENCE") {
    if (meta.noRearrange) {
      if (chosen !== "No rearrangement required") errors.push("Expected 'No rearrangement required'");
    } else {
      const recon = reconstructFragments(meta.displayed, chosen);
      if (JSON.stringify(recon) !== JSON.stringify(meta.canonical)) {
        errors.push("4-part fragment reconstruction mismatch");
      }
    }
  } else if (meta.subType === "FIVE_PART_SENTENCE" || meta.subType === "FIXED_START_SENTENCE") {
    const recon = reconstructFragments(meta.displayed, chosen);
    if (JSON.stringify(recon) !== JSON.stringify(meta.canonical)) {
      errors.push(`${meta.subType} reconstruction mismatch`);
    }
  } else if (meta.subType === "WORD_SWAP_SENTENCE" || meta.subType === "DOUBLE_WORD_SWAP_MAINS") {
    const restored = applyWordSwaps(meta.shownWords, meta.swapPairs);
    if (JSON.stringify(restored) !== JSON.stringify(meta.canonicalWords)) {
      errors.push("Word-swap restoration does not match canonical words");
    }
    if (chosen !== meta.expected) errors.push("Word-swap option text mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function computeSentenceRearrangementFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
