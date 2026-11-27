/**
 * Strict Independent Validator & Fingerprinter for Order & Ranking Questions
 */

import crypto from "node:crypto";
import {
  countValidRankings,
  solveInterchange,
  solveMaxMinOverlap,
  solveMidpointInRow,
  solveOppositeRank,
  solveRatioClassRanking,
  solveTotalFromRanks,
} from "./solver.js";

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

export function validateOrderRankingQuestion(q) {
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

  if (meta.subType === "TOTAL_AND_RANK") {
    let expected = "";
    if (meta.mode === "FIND_TOTAL") {
      expected = String(solveTotalFromRanks(meta.left, meta.right));
    } else if (meta.mode === "FIND_OPPOSITE") {
      expected = ordinal(solveOppositeRank(meta.total, meta.top));
    } else if (meta.mode === "SHIFT_OPPOSITE") {
      const newLeft = meta.shiftDir === "RIGHT" ? meta.origLeft + meta.shift : meta.origLeft - meta.shift;
      expected = ordinal(solveOppositeRank(meta.total, newLeft));
    }
    if (chosen !== expected) errors.push(`TOTAL_AND_RANK mismatch: expected "${expected}", got "${chosen}"`);
  } else if (meta.subType === "INTERCHANGE_POSITIONS") {
    const solved = solveInterchange(meta.leftA, meta.rightB, meta.newLeftA);
    const expected =
      meta.askMode === "TOTAL"
        ? String(solved.total)
        : meta.askMode === "NEW_RIGHT_B"
          ? ordinal(solved.newRightB)
          : String(solved.between);
    if (chosen !== expected) errors.push(`INTERCHANGE mismatch: expected "${expected}", got "${chosen}"`);
  } else if (meta.subType === "MAX_MIN_OVERLAP") {
    let expected = "";
    if (meta.mode === "MIDPOINT") {
      const mid = solveMidpointInRow(meta.total, meta.leftA, meta.rightB);
      expected = ordinal(meta.askFromRight ? mid.midFromRight : mid.midFromLeft);
    } else {
      const solved = solveMaxMinOverlap(meta.leftA, meta.rightB, meta.between);
      expected = String(meta.mode === "MIN" ? solved.minTotal : solved.maxTotal);
    }
    if (chosen !== expected) errors.push(`MAX_MIN_OVERLAP mismatch: expected "${expected}", got "${chosen}"`);
  } else if (meta.subType === "COMPARISON_RANKING") {
    const sols = countValidRankings(meta.items, meta.constraints, 2);
    if (sols.length !== 1) {
      errors.push(`Expected unique ranking, found ${sols.length}`);
    } else if (meta.queryMeta.mode === "POSITION") {
      const expected = sols[0][meta.queryMeta.targetPos];
      if (chosen !== expected) errors.push(`COMPARISON_RANKING mismatch: expected "${expected}", got "${chosen}"`);
    } else if (meta.queryMeta.mode === "NUMERIC_ANCHOR") {
      const numVal = parseInt(chosen, 10);
      if (!(numVal > meta.queryMeta.valLow && numVal < meta.queryMeta.valHigh)) {
        errors.push(`NUMERIC_ANCHOR out of bounds: ${chosen}`);
      }
      // Also confirm no distractor falls strictly inside (valLow, valHigh)
      for (let i = 0; i < q.options.length; i++) {
        if (i === q.correctIndex) continue;
        const dv = parseInt(q.options[i], 10);
        if (dv > meta.queryMeta.valLow && dv < meta.queryMeta.valHigh) {
          errors.push(`Ambiguous numeric distractor inside range: ${q.options[i]}`);
        }
      }
    }
  } else if (meta.subType === "RATIO_CONDITIONAL_RANK") {
    const solved = solveRatioClassRanking(meta.params);
    const expected = String(meta.askGirlsAfter ? solved.girlsAfter : solved.boysAfter);
    if (chosen !== expected) errors.push(`RATIO_CONDITIONAL_RANK mismatch: expected "${expected}", got "${chosen}"`);
  }

  return { valid: errors.length === 0, errors };
}

export function computeOrderRankingFingerprint(q) {
  const payload = JSON.stringify({
    subType: q.subType,
    q: q.questionText,
    ans: q.options?.[q.correctIndex],
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
}
