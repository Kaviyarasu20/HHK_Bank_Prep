/**
 * Strict Independent Validator & Fingerprinter for English Synonyms & Antonyms Questions
 */

import crypto from "node:crypto";
import { verifySynonymAntonymQuestionIntegrity } from "./solver.js";

export function validateSynonymAntonymQuestion(q) {
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
  const check = verifySynonymAntonymQuestionIntegrity({
    mode: meta.mode,
    entry: meta.entry,
    options: q.options,
    correctIndex: q.correctIndex,
  });
  if (!check.valid) errors.push(...check.errors);

  return { valid: errors.length === 0, errors };
}

export function computeSynonymAntonymFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    word: q._meta?.entry?.word,
    mode: q._meta?.mode,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
