/**
 * Exact Directed Causal Graph Classifier for Banking Exam Cause & Effect
 *
 * Every statement node has:
 *   { scenarioId: string, role: "CAUSE" | "EFFECT", effectSlot?: number }
 *
 * Exact 5-way causal relation classifier:
 *   0 (A): I is CAUSE and II is EFFECT of the same scenarioId       -> I_CAUSES_II
 *   1 (B): II is CAUSE and I is EFFECT of the same scenarioId       -> II_CAUSES_I
 *   2 (C): Both I and II are CAUSE nodes of DIFFERENT scenarioIds   -> INDEPENDENT_CAUSES
 *   3 (D): Both I and II are EFFECT nodes of DIFFERENT scenarioIds  -> EFFECTS_OF_INDEPENDENT_CAUSES
 *   4 (E): Both I and II are distinct EFFECT nodes of SAME scenario -> EFFECTS_OF_COMMON_CAUSE
 */

export const CE_OPTIONS = [
  "Statement I is the cause and statement II is its effect",
  "Statement II is the cause and statement I is its effect",
  "Both statements I and II are independent causes",
  "Both statements I and II are effects of independent causes",
  "Both statements I and II are effects of some common cause",
];

export const CE_VERDICT_ORDER = [
  "I_CAUSES_II",
  "II_CAUSES_I",
  "INDEPENDENT_CAUSES",
  "EFFECTS_OF_INDEPENDENT_CAUSES",
  "EFFECTS_OF_COMMON_CAUSE",
];

export function classifyCausalRelation(nodeI, nodeII) {
  const sameScenario = nodeI.scenarioId === nodeII.scenarioId;

  if (sameScenario) {
    if (nodeI.role === "CAUSE" && nodeII.role === "EFFECT") return "I_CAUSES_II";
    if (nodeI.role === "EFFECT" && nodeII.role === "CAUSE") return "II_CAUSES_I";
    if (
      nodeI.role === "EFFECT" &&
      nodeII.role === "EFFECT" &&
      nodeI.effectSlot !== nodeII.effectSlot
    ) {
      return "EFFECTS_OF_COMMON_CAUSE";
    }
    throw new Error("Invalid same-scenario causal pair");
  }

  if (nodeI.role === "CAUSE" && nodeII.role === "CAUSE") {
    return "INDEPENDENT_CAUSES";
  }
  if (nodeI.role === "EFFECT" && nodeII.role === "EFFECT") {
    return "EFFECTS_OF_INDEPENDENT_CAUSES";
  }
  throw new Error("Cross-scenario CAUSE + EFFECT pair is ambiguous in standard 5-option CE");
}
