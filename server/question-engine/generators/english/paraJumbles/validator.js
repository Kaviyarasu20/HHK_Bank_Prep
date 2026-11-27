/**
 * Strict Independent Validator & Fingerprinter for English Para Jumbles Questions
 */

import crypto from "node:crypto";
import { reconstructFromLabelSequence } from "./solver.js";

export function validateParaJumblesQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") return { valid: false, errors: ["Null question"] };

  if (!q.questionText || q.questionText.length < 80) {
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

  if (meta.subType === "FIVE_SENTENCE_SEQUENCE" || meta.subType === "FIXED_ANCHOR_PARAJUMBLE") {
    const reconstructed = reconstructFromLabelSequence(meta.displayed, chosen);
    if (JSON.stringify(reconstructed) !== JSON.stringify(meta.ordered)) {
      errors.push("Reconstructed paragraph from chosen sequence does not match canonical order");
    }
  } else if (meta.subType === "POSITIONAL_SENTENCE_QUERY") {
    const entry = meta.displayed.find((d) => d.label === chosen);
    if (!entry || entry.canonicalIndex !== meta.targetIdx) {
      errors.push("Positional sentence query label does not match target canonical index");
    }
  } else if (meta.subType === "ODD_SENTENCE_OUT_PARAJUMBLE") {
    if (chosen !== meta.expected) errors.push("Odd-sentence-out label mismatch");
  } else if (meta.subType === "MANDATORY_PAIR_PARAJUMBLE") {
    const validSet = new Set(meta.validPairs || []);
    if (!validSet.has(chosen)) errors.push("Chosen mandatory pair is not consecutive");
    // Ensure NO distractor option is also a valid consecutive pair!
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue;
      if (validSet.has(q.options[i])) {
        errors.push(`Ambiguous distractor pair '${q.options[i]}' is also consecutive`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeParaJumblesFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
