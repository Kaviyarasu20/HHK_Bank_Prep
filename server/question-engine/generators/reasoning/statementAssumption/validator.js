/**
 * Strict Independent Validator & Fingerprinter for Statement & Assumption Questions
 */

import crypto from "node:crypto";
import { evaluateAssumptionVerdict, VERDICT_ORDER } from "./solver.js";

export function validateStatementAssumptionQuestion(q) {
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

  const meta = q._meta || {};
  const verdict = evaluateAssumptionVerdict({
    implicitI: meta.implicitI,
    implicitII: meta.implicitII,
    eitherOr: meta.eitherOr,
  });
  if (VERDICT_ORDER.indexOf(verdict) !== q.correctIndex) {
    errors.push("Statement & Assumption verdict mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function computeStatementAssumptionFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
