/**
 * Strict Independent Validator & Fingerprinter for Logical Reasoning Questions
 */

import crypto from "node:crypto";
import {
  DECISION_LABELS,
  evaluateDualVerdict,
  evaluateEligibilityDecision,
} from "./solver.js";

const VERDICT_ORDER = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"];

export function validateLogicalReasoningQuestion(q) {
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

  if (meta.subType === "COURSE_OF_ACTION" || meta.subType === "STRONG_WEAK_ARGUMENT") {
    const verdict = evaluateDualVerdict({
      validI: meta.validI,
      validII: meta.validII,
      mutuallyExclusive: meta.mutuallyExclusive,
    });
    const expectedIdx = VERDICT_ORDER.indexOf(verdict);
    if (q.correctIndex !== expectedIdx) {
      errors.push(`Dual verdict index mismatch (${q.correctIndex} vs ${expectedIdx})`);
    }
  } else if (meta.subType === "DECISION_MAKING_ELIGIBILITY") {
    const decision = evaluateEligibilityDecision(meta.profile, meta.rules);
    if (DECISION_LABELS[decision] !== chosen) {
      errors.push(`Decision-making mismatch: expected "${DECISION_LABELS[decision]}", got "${chosen}"`);
    }
  } else if (meta.subType === "PASSAGE_INFERENCE" || meta.subType === "STRENGTHEN_WEAKEN") {
    if (chosen !== meta.expectedAnswer) {
      errors.push(`${meta.subType} answer mismatch`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeLogicalReasoningFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
