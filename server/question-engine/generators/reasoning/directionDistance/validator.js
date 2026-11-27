/**
 * Strict Independent Validator & Fingerprinter for Direction & Distance Questions
 */

import crypto from "node:crypto";
import {
  compassDirectionFromTo,
  exactDistanceSquared,
  formatExactDistance,
  solveAngularRotation,
  solveObserverFacingFromShadow,
  solvePath,
  solveRelativePoints,
  turnCardinal,
} from "./solver.js";

export function validateDirectionQuestion(q) {
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

  if (meta.subType === "PATH_SHORTEST_DISTANCE") {
    const solved = solvePath(meta.steps);
    let expected = solved.distanceLabel;
    if (meta.queryType === "DIST_AND_DIR") {
      expected = `${solved.distanceLabel}, ${solved.directionEndFromStart}`;
    } else if (meta.queryType === "DIR_END_FROM_START") {
      expected = solved.directionEndFromStart;
    } else if (meta.queryType === "DIR_START_FROM_END") {
      expected = solved.directionStartFromEnd;
    }
    if (chosen !== expected) {
      errors.push(`Path solver mismatch: expected "${expected}", got "${chosen}"`);
    }
  } else if (meta.subType === "RELATIVE_POINTS" || meta.subType === "CODED_DIRECTION") {
    const coords = solveRelativePoints(meta.anchor, meta.relations);
    const qm = meta.queryMeta;
    const expected =
      qm.mode === "DISTANCE"
        ? formatExactDistance(exactDistanceSquared(coords[qm.from], coords[qm.to]))
        : compassDirectionFromTo(coords[qm.from], coords[qm.to]);
    if (chosen !== expected) {
      errors.push(`Grid/Coded solver mismatch: expected "${expected}", got "${chosen}"`);
    }
  } else if (meta.subType === "SHADOW_DIRECTION") {
    const refFacing = solveObserverFacingFromShadow(meta.timeOfDay, meta.relativeSide);
    const expected = meta.targetSameAsRef ? refFacing : turnCardinal(refFacing, "BACK");
    if (chosen !== expected) {
      errors.push(`Shadow solver mismatch: expected "${expected}", got "${chosen}"`);
    }
  } else if (meta.subType === "ANGULAR_ROTATION") {
    const solved = solveAngularRotation(meta.startDirection, meta.turns);
    if (chosen !== solved.finalDirection) {
      errors.push(`Angular rotation mismatch: expected "${solved.finalDirection}", got "${chosen}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function computeDirectionFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
