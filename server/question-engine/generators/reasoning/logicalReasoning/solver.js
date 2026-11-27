/**
 * Exact Formal Evaluators for Banking Exam Logical Reasoning
 *
 * Covers:
 * 1. Dual-Item Outcome Evaluator (Course of Action & Strong/Weak Arguments):
 *    Maps (isItem1Valid, isItem2Valid, isMutuallyExclusiveEitherOr) -> exact 5-option verdict
 * 2. Formal Eligibility / Decision-Making Rule Solver:
 *    Evaluates candidate attributes against primary criteria + exception referrals + missing-data detection
 * 3. Single-Correct Critical Reasoning Verifier (Inference, Strengthen/Weaken)
 */

export const DUAL_OUTCOME_KEYS = [
  "ONLY_I",
  "ONLY_II",
  "EITHER_OR",
  "NEITHER",
  "BOTH",
];

/**
 * 1. Exact Dual-Item Outcome Evaluator for Course of Action & Strong/Weak Arguments.
 */
export function evaluateDualVerdict({ validI, validII, mutuallyExclusive = false }) {
  if (mutuallyExclusive && validI && validII) return "EITHER_OR";
  if (validI && validII) return "BOTH";
  if (validI && !validII) return "ONLY_I";
  if (!validI && validII) return "ONLY_II";
  return "NEITHER";
}

/**
 * 2. Exact Decision-Making / Eligibility Criteria Rule Solver.
 *
 * Primary Criteria (configurable thresholds):
 *   c1: age >= minAge && age <= maxAge
 *   c2: gradPct >= minGrad
 *   c3: testPct >= minTest
 *   c4: expYears >= minExp
 *
 * Exception Clauses:
 *   exA: Fails ONLY c2 (gradPct), passes c1, c3, c4, AND pgPct >= minPg => "REFER_GM"
 *   exB: Fails ONLY c4 (expYears), passes c1, c2, c3, AND testPct >= highTest => "REFER_HR"
 *
 * Missing-data check:
 *   If any required criterion needed to reach a definitive verdict is null/undefined
 *   (and no already-known failure forces rejection), returns "DATA_INADEQUATE".
 */
export function evaluateEligibilityDecision(profile, rules) {
  const check = (val, fn) => (val === null || val === undefined ? "UNKNOWN" : fn(val) ? "PASS" : "FAIL");

  const c1 = check(profile.age, (v) => v >= rules.minAge && v <= rules.maxAge);
  const c2 = check(profile.gradPct, (v) => v >= rules.minGrad);
  const c3 = check(profile.testPct, (v) => v >= rules.minTest);
  const c4 = check(profile.expYears, (v) => v >= rules.minExp);

  // Hard failures that have NO exception clause: c1 (age) or c3 (written test)
  if (c1 === "FAIL" || c3 === "FAIL") return "REJECT";

  // Count known failures among exceptionable criteria (c2, c4)
  const failCount = [c1, c2, c3, c4].filter((x) => x === "FAIL").length;
  if (failCount >= 2) return "REJECT"; // Cannot trigger two exceptions simultaneously

  // If c2 failed (only failure so far)
  if (c2 === "FAIL") {
    if (c1 === "UNKNOWN" || c3 === "UNKNOWN" || c4 === "UNKNOWN") return "DATA_INADEQUATE";
    const pgCheck = check(profile.pgPct, (v) => v >= rules.minPg);
    if (pgCheck === "PASS") return "REFER_GM";
    if (pgCheck === "UNKNOWN") return "DATA_INADEQUATE";
    return "REJECT";
  }

  // If c4 failed (only failure so far)
  if (c4 === "FAIL") {
    if (c1 === "UNKNOWN" || c2 === "UNKNOWN" || c3 === "UNKNOWN") return "DATA_INADEQUATE";
    const highTestCheck = check(profile.testPct, (v) => v >= rules.highTest);
    if (highTestCheck === "PASS") return "REFER_HR";
    return "REJECT";
  }

  // No known failures; if any primary criterion is unknown => DATA_INADEQUATE
  if (c1 === "UNKNOWN" || c2 === "UNKNOWN" || c3 === "UNKNOWN" || c4 === "UNKNOWN") {
    return "DATA_INADEQUATE";
  }

  return "SELECT";
}

export const DECISION_LABELS = {
  SELECT: "The candidate is to be selected",
  REJECT: "The candidate is not to be selected",
  REFER_GM: "The case is to be referred to the General Manager",
  REFER_HR: "The case is to be referred to the HR Head",
  DATA_INADEQUATE: "The data provided are inadequate to take a decision",
};
