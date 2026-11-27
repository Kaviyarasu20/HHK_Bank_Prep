/**
 * Strict Independent Validator & Fingerprinter for English Cloze Test Questions
 */

import crypto from "node:crypto";
import { verifyClozeBlankConsistency } from "./solver.js";

export function validateClozeQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 80) {
    errors.push("Cloze passage question text missing or too short");
  }
  if (!Array.isArray(q.options) || q.options.length !== 5) {
    errors.push("Must have exactly 5 options");
  }
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 4) {
    errors.push("Invalid correctIndex");
  }
  const expectedLetter = String.fromCharCode(65 + q.correctIndex);
  if (q.correctAnswer !== expectedLetter) {
    errors.push(`correctAnswer mismatch (${q.correctAnswer} vs ${expectedLetter})`);
  }

  const meta = q._meta || {};
  const check = verifyClozeBlankConsistency({
    templateText: meta.templateText,
    blanks: meta.blanks,
    activeBlankNum: meta.activeBlankNum,
    options: q.options,
    correctIndex: q.correctIndex,
    expectedAnswer: meta.expectedAnswer,
  });
  if (!check.valid) errors.push(...check.errors);

  return { valid: errors.length === 0, errors };
}

export function computeClozeFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    passageId: q._meta?.passageId,
    blank: q._meta?.activeBlankNum,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
