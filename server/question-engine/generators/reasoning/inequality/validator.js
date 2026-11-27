import crypto from "node:crypto";
import {
  evaluateInequalityConclusion,
  evaluateTwoInequalityConclusions,
  solveInequalityGraph,
} from "./solver.js";
import { STANDARD_5_OPTIONS } from "./inequalityBuilder.js";

export function computeInequalityFingerprint(q) {
  return crypto
    .createHash("sha256")
    .update(`${q.subType}|${q.questionText}|${q.answer}`)
    .digest("hex")
    .slice(0, 24);
}

export function validateInequalityQuestion(q) {
  const errors = [];
  if (!q || !q.questionText || q.questionText.length < 40) {
    errors.push("Question text is missing or too short.");
  }
  if (!Array.isArray(q.options) || q.options.length !== 5) {
    errors.push("Expected exactly 5 options.");
  } else {
    const uniq = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
    if (uniq.size !== 5) errors.push("Duplicate options detected.");
  }
  if (q.options?.[q.correctOptionIndex] !== q.answer) {
    errors.push("answer does not match options[correctOptionIndex].");
  }

  const meta = q._meta;
  if (!meta) {
    errors.push("Missing solver verification metadata.");
  } else if (meta.mode === "STANDARD") {
    const recheck = evaluateTwoInequalityConclusions(
      meta.numVars,
      meta.edges,
      meta.conclusions[0],
      meta.conclusions[1],
    );
    if (!recheck.consistent) {
      errors.push("Inequality graph is inconsistent.");
    } else if (recheck.outcome !== meta.expectedOutcome) {
      errors.push(`Solver mismatch: expected ${meta.expectedOutcome}, got ${recheck.outcome}.`);
    } else {
      const idx = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"].indexOf(recheck.outcome);
      if (q.answer !== STANDARD_5_OPTIONS[idx]) {
        errors.push("Answer label does not match verified outcome.");
      }
    }
  } else if (meta.mode === "MISSING_SYMBOL") {
    let validCount = 0;
    meta.optionOpSequences.forEach((ops, idx) => {
      const edges = ops.map((op, i) => ({ a: i, b: i + 1, op }));
      const solved = solveInequalityGraph(meta.numVars, edges);
      if (!solved.consistent) return;
      const bothHold = meta.conclusions.every((c) => evaluateInequalityConclusion(solved.reach, c));
      if (bothHold) {
        validCount += 1;
        if (idx !== q.correctOptionIndex) {
          errors.push(`Distractor option ${idx} also satisfies both target conclusions.`);
        }
      } else if (idx === q.correctOptionIndex) {
        errors.push("Marked correct option fails target conclusions.");
      }
    });
    if (validCount !== 1) {
      errors.push(`Missing-symbol question must have exactly 1 valid option, found ${validCount}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
