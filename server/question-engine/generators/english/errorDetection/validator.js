/**
 * Strict Independent Validator & Fingerprinter for English Error Detection Questions
 */

import crypto from "node:crypto";
import { verifySingleErrorInvariant } from "./solver.js";

export function validateErrorDetectionQuestion(q) {
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
    if (q.options[4] !== "No error") errors.push("Option E must be 'No error'");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 4) {
    errors.push("Invalid correctIndex");
  }
  const expectedLetter = String.fromCharCode(65 + q.correctIndex);
  if (q.correctAnswer !== expectedLetter) {
    errors.push(`correctAnswer mismatch (${q.correctAnswer} vs ${expectedLetter})`);
  }

  const meta = q._meta || {};
  const inv = verifySingleErrorInvariant({
    segments: meta.segments,
    correctSegments: meta.correctSegments,
    errorSlot: meta.errorSlot,
  });
  if (!inv.valid) errors.push(...inv.errors);

  return { valid: errors.length === 0, errors };
}

export function computeErrorDetectionFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.correctAnswer,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
