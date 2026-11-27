/**
 * Exact Formal Evaluator for Banking Exam Statement & Assumption
 *
 * Maps (implicitI, implicitII, mutuallyExclusiveEitherOr) -> exact 5-option verdict.
 */

export const SA_OPTIONS = [
  "Only assumption I is implicit",
  "Only assumption II is implicit",
  "Either assumption I or II is implicit",
  "Neither assumption I nor II is implicit",
  "Both assumptions I and II are implicit",
];

export const VERDICT_ORDER = ["ONLY_I", "ONLY_II", "EITHER_OR", "NEITHER", "BOTH"];

export function evaluateAssumptionVerdict({ implicitI, implicitII, eitherOr = false }) {
  if (eitherOr && !implicitI && !implicitII) return "EITHER_OR";
  if (implicitI && implicitII) return "BOTH";
  if (implicitI && !implicitII) return "ONLY_I";
  if (!implicitI && implicitII) return "ONLY_II";
  return "NEITHER";
}
