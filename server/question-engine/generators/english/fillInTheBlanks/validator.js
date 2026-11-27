/**
 * Strict Independent Validator & Fingerprinter for English Fill in the Blanks Questions
 */

import crypto from "node:crypto";
import { verifyFillerQuestionIntegrity } from "./solver.js";

export function validateFillBlanksQuestion(q) {
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
  const check = verifyFillerQuestionIntegrity({
    template: meta.template,
    expectedBlankCount: meta.expectedBlankCount,
    options: q.options,
    correctIndex: q.correctIndex,
    expectedAnswer: meta.expectedAnswer,
  });
  if (!check.valid) errors.push(...check.errors);

  return { valid: errors.length === 0, errors };
}

export function computeFillBlanksFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
