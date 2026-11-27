/**
 * Strict Independent Validator & Fingerprinter for Classification Questions
 */

import crypto from "node:crypto";
import {
  clusterGapSignature,
  evalAlphaPairValue,
  findUniqueOddIndex,
  matchesNumberPair,
  matchesNumberProperty,
} from "./solver.js";

export function validateClassificationQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 25) {
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
  if (meta.subType === "NUMBER_CLASSIFICATION") {
    const idx = findUniqueOddIndex(meta.items, (n) => matchesNumberProperty(n, meta.prop));
    if (idx !== q.correctIndex) errors.push("Number classification 4-vs-1 check failed");
  } else if (meta.subType === "NUMBER_PAIR_CLASSIFICATION") {
    const idx = findUniqueOddIndex(meta.pairs, (p) => matchesNumberPair(p, meta.rule));
    if (idx !== q.correctIndex) errors.push("Number-pair classification 4-vs-1 check failed");
  } else if (meta.subType === "LETTER_CLUSTER_CLASSIFICATION") {
    const idx = findUniqueOddIndex(meta.items, (cl) => clusterGapSignature(cl) === meta.targetSig);
    if (idx !== q.correctIndex) errors.push("Letter-cluster classification 4-vs-1 check failed");
  } else if (meta.subType === "ALPHANUMERIC_CLASSIFICATION") {
    const idx = findUniqueOddIndex(
      meta.items,
      (it) => evalAlphaPairValue(it.word, meta.ruleType) === it.val,
    );
    if (idx !== q.correctIndex) errors.push("Alphanumeric classification 4-vs-1 check failed");
  } else if (meta.subType === "SEMANTIC_WORD_CLASSIFICATION") {
    if (q.options?.[q.correctIndex] !== meta.oddLabel) {
      errors.push("Semantic classification answer mismatch");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeClassificationFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    opts: [...(q.options || [])].sort(),
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
