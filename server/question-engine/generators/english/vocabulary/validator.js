/**
 * Strict Independent Validator & Fingerprinter for English Vocabulary Questions
 */

import crypto from "node:crypto";
import {
  verifyMisspeltSlotIntegrity,
  verifyVocabOptionsIntegrity,
} from "./solver.js";

export function validateVocabularyQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 35) {
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
  if (meta.subType === "MISSPELT_INAPPROPRIATE_WORD") {
    const check = verifyMisspeltSlotIntegrity({
      shownWords: meta.shownWords,
      correctWords: meta.correctWords,
      errorSlot: meta.errorSlot,
      options: q.options,
      correctIndex: q.correctIndex,
    });
    if (!check.valid) errors.push(...check.errors);
  } else {
    const check = verifyVocabOptionsIntegrity({
      options: q.options,
      correctIndex: q.correctIndex,
      expectedAnswer: meta.expectedAnswer,
    });
    if (!check.valid) errors.push(...check.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function computeVocabularyFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
