/**
 * Strict Independent Validator & Fingerprinter for Analogy Questions
 */

import crypto from "node:crypto";
import {
  applyLetterAnalogyRule,
  applyNumberAnalogyRule,
  applyWordValueAnalogyRule,
  matchesTriadRule,
} from "./solver.js";

export function validateAnalogyQuestion(q) {
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

  const chosen = q.options?.[q.correctIndex];
  const meta = q._meta || {};

  if (meta.subType === "NUMBER_ANALOGY") {
    if (String(applyNumberAnalogyRule(meta.e, meta.rule)) !== chosen) {
      errors.push("Number analogy solver mismatch");
    }
  } else if (meta.subType === "NUMBER_SET_ANALOGY") {
    if (!matchesTriadRule(meta.ansTriad, meta.rule)) {
      errors.push("Answer triad fails rule");
    }
    // Verify none of the 4 distractor triads accidentally satisfy the rule
    for (let i = 0; i < q.options.length; i++) {
      if (i === q.correctIndex) continue;
      const nums = q.options[i].replace(/[()]/g, "").split(",").map((x) => Number(x.trim()));
      if (matchesTriadRule(nums, meta.rule)) {
        errors.push(`Distractor triad ${q.options[i]} also satisfies rule`);
      }
    }
  } else if (meta.subType === "LETTER_CLUSTER_ANALOGY") {
    if (applyLetterAnalogyRule(meta.target, meta.rule) !== chosen) {
      errors.push("Letter cluster analogy mismatch");
    }
  } else if (meta.subType === "ALPHANUMERIC_ANALOGY") {
    if (String(applyWordValueAnalogyRule(meta.target, meta.rule)) !== chosen) {
      errors.push("Alphanumeric analogy mismatch");
    }
  } else if (meta.subType === "SEMANTIC_WORD_ANALOGY") {
    if (chosen !== meta.expected) errors.push("Semantic analogy answer mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function computeAnalogyFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
