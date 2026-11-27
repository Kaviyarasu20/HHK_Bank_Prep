/**
 * Exact Formal Evaluators for Banking Exam Statement & Conclusion
 *
 * Covers:
 * 1. Dual-Conclusion Verdict Solver -> ONLY_I | ONLY_II | EITHER_OR | NEITHER | BOTH
 * 2. Formal Propositional Conditional Evaluator (P -> Q):
 *    - Given P -> Q and observed fact (P, ~P, Q, or ~Q):
 *      - P entails Q (Modus Ponens)
 *      - ~Q entails ~P (Modus Tollens)
 *      - Q does NOT entail P (Affirming the Consequent fallacy)
 *      - ~P does NOT entail ~Q (Denying the Antecedent fallacy)
 *    - Also checks exact complementary Either-Or pairs (e.g., when fact is Q, "P" vs "~P" is a tautological Either-Or!)
 * 3. Formal Quantitative Comparison Evaluator for numeric/percentage banking statements
 */

export const SC_OPTIONS = [
  "Only conclusion I follows",
  "Only conclusion II follows",
  "Either conclusion I or II follows",
  "Neither conclusion I nor II follows",
  "Both conclusions I and II follow",
];

export const VERDICT_ORDER = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"];

export function evaluateConclusionVerdict({ followsI, followsII, eitherOr = false }) {
  if (eitherOr && !followsI && !followsII) return "EITHER_OR";
  if (followsI && followsII) return "BOTH";
  if (followsI && !followsII) return "ONLY_I";
  if (!followsI && followsII) return "ONLY_II";
  return "NEITHER";
}

/**
 * 2. Exact Propositional Logic Evaluator for rule (P -> Q) + observed fact.
 * fact: "P" | "NOT_P" | "Q" | "NOT_Q"
 * query: "P" | "NOT_P" | "Q" | "NOT_Q"
 * Returns true iff (P -> Q) ∧ fact |= query across all 4 truth assignments (P, Q) ∈ {T, F}².
 */
export function entailsUnderImplication(fact, query) {
  const models = [
    { P: true, Q: true },
    { P: true, Q: false },
    { P: false, Q: true },
    { P: false, Q: false },
  ];

  const evalLit = (m, lit) => {
    if (lit === "P") return m.P;
    if (lit === "NOT_P") return !m.P;
    if (lit === "Q") return m.Q;
    if (lit === "NOT_Q") return !m.Q;
    throw new Error(`Unknown literal: ${lit}`);
  };

  // Valid models satisfy (P -> Q) AND fact
  const validModels = models.filter((m) => (!m.P || m.Q) && evalLit(m, fact));
  if (validModels.length === 0) return false;
  return validModels.every((m) => evalLit(m, query));
}

/**
 * Exact Either-Or check under (P -> Q) ∧ fact:
 * True iff neither q1 nor q2 is individually entailed, AND in every valid model at least one of (q1, q2) holds.
 */
export function isEitherOrUnderImplication(fact, q1, q2) {
  if (entailsUnderImplication(fact, q1) || entailsUnderImplication(fact, q2)) return false;
  const models = [
    { P: true, Q: true },
    { P: true, Q: false },
    { P: false, Q: true },
    { P: false, Q: false },
  ];
  const evalLit = (m, lit) =>
    lit === "P" ? m.P : lit === "NOT_P" ? !m.P : lit === "Q" ? m.Q : !m.Q;
  const validModels = models.filter((m) => (!m.P || m.Q) && evalLit(m, fact));
  return validModels.length > 0 && validModels.every((m) => evalLit(m, q1) || evalLit(m, q2));
}

/**
 * 3. Exact Quantitative Statement Evaluator
 * Given two positive quantities { a, b } (e.g., retailLoans, corpLoans), evaluates exact claims:
 *   - "A_GT_B"       : a > b
 *   - "B_GT_A"       : b > a
 *   - "A_SHARE_GT_50": a > b (strictly > 50% of total)
 *   - "TOTAL_GT_T"   : a + b > threshold
 *   - "TOTAL_LT_T"   : a + b < threshold
 *   - "DIFF_GT_D"    : Math.abs(a - b) > diffThreshold
 */
export function evaluateQuantClaim(data, claim) {
  const { a, b } = data;
  const total = a + b;
  const diff = Math.abs(a - b);
  if (claim.type === "A_GT_B") return a > b;
  if (claim.type === "B_GT_A") return b > a;
  if (claim.type === "A_SHARE_GT_50") return a * 2 > total;
  if (claim.type === "B_SHARE_GT_50") return b * 2 > total;
  if (claim.type === "TOTAL_GT_T") return total > claim.threshold;
  if (claim.type === "TOTAL_LT_T") return total < claim.threshold;
  if (claim.type === "DIFF_GT_D") return diff > claim.threshold;
  throw new Error(`Unknown quant claim: ${claim.type}`);
}
