import crypto from "node:crypto";
import {
  compileConstraints,
  evaluateConclusion,
  evaluateThreeConclusions,
  evaluateTwoConclusions,
  isSatisfiable,
} from "./solver.js";
import { TWO_CONCLUSION_OPTIONS } from "./statementBuilder.js";

/**
 * Independent Mathematical Validator & Fingerprinter for Syllogism Questions.
 * Re-runs the exact Finite Venn-Region SAT Solver from scratch to guarantee 0 logical errors.
 */

export function computeSyllogismFingerprint(q) {
  const raw = `${q.subType}|${q.questionText}|${q.answer}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export function validateSyllogismQuestion(q) {
  const errors = [];
  if (!q || typeof q !== "object") {
    return { valid: false, errors: ["Question object is missing."] };
  }
  if (!q.questionText || String(q.questionText).length < 40) {
    errors.push("Question text is missing or too short.");
  }
  if (!Array.isArray(q.options) || q.options.length !== 5) {
    errors.push("Expected exactly 5 options.");
  } else {
    const unique = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
    if (unique.size !== 5) errors.push("Duplicate options detected.");
  }
  if (
    typeof q.correctOptionIndex !== "number" ||
    q.correctOptionIndex < 0 ||
    q.correctOptionIndex >= (q.options?.length ?? 0)
  ) {
    errors.push("Invalid correctOptionIndex.");
  } else if (q.options[q.correctOptionIndex] !== q.answer) {
    errors.push("answer does not match options[correctOptionIndex].");
  }
  if (!Array.isArray(q.solutionSteps) || q.solutionSteps.length < 3) {
    errors.push("Missing step-by-step explanation.");
  }

  // Independent Solver Re-Verification
  const meta = q._meta;
  if (!meta) {
    errors.push("Missing solver verification metadata.");
  } else if (meta.mode === "TWO_CONCLUSION") {
    const recheck = evaluateTwoConclusions(
      meta.numTerms,
      meta.statements,
      meta.conclusions[0],
      meta.conclusions[1],
    );
    if (!recheck.satisfiable) {
      errors.push("Statement set is unsatisfiable (self-contradictory).");
    } else if (recheck.outcome !== meta.expectedOutcome) {
      errors.push(`Solver mismatch: expected ${meta.expectedOutcome}, got ${recheck.outcome}.`);
    } else {
      const expectedText = TWO_CONCLUSION_OPTIONS[["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"].indexOf(recheck.outcome)];
      if (q.answer !== expectedText) {
        errors.push(`Answer text mismatch: expected "${expectedText}", got "${q.answer}".`);
      }
    }
  } else if (meta.mode === "THREE_CONCLUSION") {
    const recheck = evaluateThreeConclusions(meta.numTerms, meta.statements, meta.conclusions);
    if (!recheck.satisfiable) {
      errors.push("3-conclusion statement set is unsatisfiable.");
    } else if (JSON.stringify(recheck.followsFlags) !== JSON.stringify(meta.expectedFlags)) {
      errors.push("3-conclusion solver mismatch.");
    }
  } else if (meta.mode === "REVERSE") {
    let validCount = 0;
    meta.optionStatementSets.forEach((stmts, idx) => {
      if (!isSatisfiable(meta.numTerms, stmts)) {
        errors.push(`Reverse option ${idx} is unsatisfiable.`);
        return;
      }
      const comp = compileConstraints(meta.numTerms, stmts);
      const bothHold = meta.conclusions.every((c) => evaluateConclusion(comp, c).follows);
      if (bothHold) {
        validCount += 1;
        if (idx !== q.correctOptionIndex) {
          errors.push(`Reverse distractor at index ${idx} also satisfies both conclusions!`);
        }
      } else if (idx === q.correctOptionIndex) {
        errors.push("Marked correct Reverse option does not satisfy both conclusions!");
      }
    });
    if (validCount !== 1) {
      errors.push(`Reverse syllogism must have exactly 1 valid statement set, found ${validCount}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
