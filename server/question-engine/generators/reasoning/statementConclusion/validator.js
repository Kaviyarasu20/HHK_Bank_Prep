/**
 * Strict Independent Validator & Fingerprinter for Statement & Conclusion Questions
 */

import crypto from "node:crypto";
import {
  entailsUnderImplication,
  evaluateConclusionVerdict,
  evaluateQuantClaim,
  isEitherOrUnderImplication,
  VERDICT_ORDER,
} from "./solver.js";

export function validateStatementConclusionQuestion(q) {
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
  if (meta.mode === "CURATED_DUAL") {
    const verdict = evaluateConclusionVerdict({
      followsI: meta.followsI,
      followsII: meta.followsII,
      eitherOr: meta.eitherOr,
    });
    if (VERDICT_ORDER.indexOf(verdict) !== q.correctIndex) {
      errors.push("Curated dual verdict mismatch");
    }
  } else if (meta.subType === "QUANTITATIVE_DATA_SC") {
    const followsI = evaluateQuantClaim(meta.data, meta.claim1);
    const followsII = evaluateQuantClaim(meta.data, meta.claim2);
    const verdict = evaluateConclusionVerdict({ followsI, followsII });
    if (VERDICT_ORDER.indexOf(verdict) !== q.correctIndex) {
      errors.push("Quantitative SC verdict mismatch");
    }
  } else if (meta.subType === "CONDITIONAL_LOGIC_SC") {
    const followsI = entailsUnderImplication(meta.fact, meta.q1);
    const followsII = entailsUnderImplication(meta.fact, meta.q2);
    const eitherOr = isEitherOrUnderImplication(meta.fact, meta.q1, meta.q2);
    const verdict = evaluateConclusionVerdict({ followsI, followsII, eitherOr });
    if (VERDICT_ORDER.indexOf(verdict) !== q.correctIndex) {
      errors.push("Conditional propositional SC verdict mismatch");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeStatementConclusionFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
