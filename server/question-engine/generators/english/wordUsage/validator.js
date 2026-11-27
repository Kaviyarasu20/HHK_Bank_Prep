/**
 * Strict Independent Validator & Fingerprinter for English Word Usage Questions
 */

import crypto from "node:crypto";
import { verifyWordUsageIntegrity } from "./solver.js";

export function validateWordUsageQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 40) {
    errors.push("Question text missing or too short");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 4) {
    errors.push("Invalid correctIndex");
  }
  const expectedLetter = String.fromCharCode(65 + q.correctIndex);
  if (q.correctAnswer !== expectedLetter) {
    errors.push(`correctAnswer mismatch (${q.correctAnswer} vs ${expectedLetter})`);
  }

  const meta = q._meta || {};
  const check = verifyWordUsageIntegrity({
    mode: meta.mode,
    options: q.options,
    correctIndex: q.correctIndex,
    expectedAnswer: meta.expectedAnswer,
    tripleMask: meta.tripleMask,
    taggedOptions: meta.taggedOptions,
  });
  if (!check.valid) errors.push(...check.errors);

  return { valid: errors.length === 0, errors };
}

export function computeWordUsageFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
