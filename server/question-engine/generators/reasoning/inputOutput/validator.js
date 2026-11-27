/**
 * Strict Independent Validator & Fingerprinter for Input-Output Questions
 */

import crypto from "node:crypto";
import {
  simulateDigitOpMachine,
  simulateDualEndWordNumber,
  simulateInterleavedAutoArrange,
  simulateNumberArithmeticMachine,
  simulateWordNumberTransform,
} from "./solver.js";

export function validateInputOutputQuestion(q) {
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

  if (meta.subType === "DUAL_END_WORD_NUMBER") {
    const sim = simulateDualEndWordNumber(meta.qInput, meta.cfg);
    const step = sim.steps[meta.stepIdx];
    const idx = meta.fromEnd === "LEFT" ? meta.pos - 1 : step.length - meta.pos;
    if (step[idx] !== chosen) errors.push("DUAL_END_WORD_NUMBER mismatch");
  } else if (meta.subType === "INTERLEAVED_WORD_NUMBER") {
    const sim = simulateInterleavedAutoArrange(meta.qInput, meta.cfg);
    if (meta.queryMeta.mode === "TOTAL_STEPS") {
      if (String(sim.steps.length) !== chosen) errors.push("INTERLEAVED total steps mismatch");
    } else {
      const step = sim.steps[meta.queryMeta.stepIdx];
      const idx = meta.queryMeta.fromEnd === "LEFT" ? meta.queryMeta.pos - 1 : step.length - meta.queryMeta.pos;
      if (step[idx] !== chosen) errors.push("INTERLEAVED element mismatch");
    }
  } else if (meta.subType === "NUMBER_ARITHMETIC_MACHINE") {
    const sim = simulateNumberArithmeticMachine(meta.qNums, meta.ruleVariant);
    const finalNums = sim.steps[2].map(Number);
    const expected =
      meta.queryMeta.mode === "SUM_HIGH_LOW"
        ? String(Math.max(...finalNums) + Math.min(...finalNums))
        : String(finalNums.reduce((a, b) => a + b, 0));
    if (expected !== chosen) errors.push("NUMBER_ARITHMETIC_MACHINE mismatch");
  } else if (meta.subType === "WORD_NUMBER_TRANSFORM") {
    const sim = simulateWordNumberTransform(meta.qInput, meta.cfg);
    const step = sim.steps[meta.stepIdx];
    const idx = meta.fromEnd === "LEFT" ? meta.pos - 1 : step.length - meta.pos;
    if (step[idx] !== chosen) errors.push("WORD_NUMBER_TRANSFORM mismatch");
  } else if (meta.subType === "DIGIT_OP_MACHINE") {
    const sim = simulateDigitOpMachine(meta.qNums, meta.step2Op);
    const expected = String(sim.steps[2].map(Number).reduce((a, b) => a + b, 0));
    if (expected !== chosen) errors.push("DIGIT_OP_MACHINE mismatch");
  }

  return { valid: errors.length === 0, errors };
}

export function computeInputOutputFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
