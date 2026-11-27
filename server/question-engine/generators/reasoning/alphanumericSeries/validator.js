/**
 * Strict Independent Validator & Fingerprinter for Alphanumeric Series Questions
 */

import crypto from "node:crypto";
import {
  alphabeticalGapBetween,
  applyMainsSteps,
  countPrecededFollowed,
  solveDropAndFind,
  solvePositionalNav,
  transformThreeDigitNumber,
  transformWordVowelConsonant,
} from "./solver.js";

const COUNT_LABELS = ["None", "One", "Two", "Three", "Four", "Five"];

export function validateAlphanumericQuestion(q) {
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

  if (meta.subType === "SNL_PRECEDED_FOLLOWED") {
    if (meta.mode === "DROP") {
      const res = solveDropAndFind(meta.seq, meta.dropCat, meta.pos, meta.fromEnd);
      if (!res || res.element !== chosen) errors.push("SNL DROP mismatch");
    } else {
      const matches = countPrecededFollowed(meta.seq, meta.prev, meta.target, meta.next);
      if (COUNT_LABELS[matches.length] !== chosen) errors.push("SNL COUNT mismatch");
    }
  } else if (meta.subType === "SNL_POSITIONAL_NAV") {
    const solved = solvePositionalNav(meta.seq, meta.mode, meta.a, meta.b);
    if (!solved || solved.element !== chosen) errors.push("SNL POSITIONAL NAV mismatch");
  } else if (meta.subType === "THREE_DIGIT_NUMBER_OPS") {
    if (meta.op === "DIGIT_DIFF_HIGH_LOW") {
      const sorted = [...meta.nums].sort((a, b) => a - b);
      const dHigh = Math.floor((sorted[4] % 100) / 10);
      const dLow = sorted[0] % 10;
      if (String(Math.abs(dHigh - dLow)) !== chosen) errors.push("3-digit diff mismatch");
    } else {
      const transformed = meta.nums
        .map((n) => ({ orig: n, val: transformThreeDigitNumber(n, meta.op) }))
        .sort((a, b) => b.val - a.val);
      const expected = String(meta.askSecondHighest ? transformed[1].orig : transformed[3].orig);
      if (expected !== chosen) errors.push("3-digit transform mismatch");
    }
  } else if (meta.subType === "THREE_LETTER_WORD_OPS") {
    if (meta.mode === "DICT_ORDER") {
      const sorted = [...meta.words].sort();
      if (sorted[meta.askPos] !== chosen) errors.push("Word dict order mismatch");
    } else if (meta.mode === "ALPHA_GAP") {
      const gap = alphabeticalGapBetween(meta.words[1][1], meta.words[3][2]);
      if (String(gap) !== chosen) errors.push("Word alpha gap mismatch");
    } else {
      const transformed = meta.words.map((w) => transformWordVowelConsonant(w, 1, -1));
      const cnt = transformed.filter((w) => /[AEIOU]/.test(w)).length;
      if (COUNT_LABELS[cnt] !== chosen) errors.push("Word vowel-consonant shift mismatch");
    }
  } else if (meta.subType === "STEP_ALPHANUMERIC_MAINS") {
    const { finalSeq } = applyMainsSteps(meta.seq, meta.steps);
    const idx = meta.fromEnd === "LEFT" ? meta.pos - 1 : finalSeq.length - meta.pos;
    if (finalSeq[idx] !== chosen) errors.push("Step mains transformation mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function computeAlphanumericFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
