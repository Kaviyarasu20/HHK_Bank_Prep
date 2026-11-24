// config/examBlueprints.js

export const EXAM_BLUEPRINTS = {
  RRB_CLERK_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.7, MEDIUM: 0.3, HARD: 0.0 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.7, MEDIUM: 0.3, HARD: 0.0 },
    },
  },
  IBPS_CLERK_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.4, MEDIUM: 0.5, HARD: 0.1 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      difficultyDistribution: { EASY: 0.4, MEDIUM: 0.5, HARD: 0.1 },
    },
  },
  SBI_CLERK_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.35, MEDIUM: 0.5, HARD: 0.15 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficultyDistribution: { EASY: 0.35, MEDIUM: 0.5, HARD: 0.15 },
    },
  },
  RBI_ASSISTANT_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.45, MEDIUM: 0.45, HARD: 0.1 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      difficultyDistribution: { EASY: 0.45, MEDIUM: 0.45, HARD: 0.1 },
    },
  },
  RRB_PO_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.2, MEDIUM: 0.6, HARD: 0.2 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficultyDistribution: { EASY: 0.2, MEDIUM: 0.6, HARD: 0.2 },
    },
  },
  IBPS_PO_PRELIMS: {
    simplification: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficultyDistribution: { EASY: 0.1, MEDIUM: 0.6, HARD: 0.3 },
    },
    approximation: {
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficultyDistribution: { EASY: 0.1, MEDIUM: 0.6, HARD: 0.3 },
    },
  },
  SBI_PO_PRELIMS: {
    simplification: {
      allowedTypes: [2, 3, 4, 5, 7, 8, 9],
      difficultyDistribution: { EASY: 0.0, MEDIUM: 0.5, HARD: 0.5 },
    },
    approximation: {
      allowedTypes: [4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficultyDistribution: { EASY: 0.0, MEDIUM: 0.5, HARD: 0.5 },
    },
  },
  IBPS_PO_MAINS: {
    simplification: {
      allowedTypes: [2, 3, 4, 5, 7, 8, 9],
      difficultyDistribution: { EASY: 0.0, MEDIUM: 0.25, HARD: 0.75 },
    },
    approximation: {
      allowedTypes: [4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficultyDistribution: { EASY: 0.0, MEDIUM: 0.25, HARD: 0.75 },
    },
  },
};

/**
 * Resolves any HHK exam code (e.g., "IBPS-PO", "SBI-CLERK", "RRB-OFFICE-ASSISTANT")
 * and stage name ("Prelims", "Mains") into a canonical EXAM_BLUEPRINTS key.
 */
export function resolveExamBlueprintKey(examCode = "", stageName = "Prelims") {
  const code = String(examCode || "").toUpperCase();
  const stage = String(stageName || "").toUpperCase();
  const isMains = stage.includes("MAIN") || stage.includes("PHASE II");

  if (isMains) return "IBPS_PO_MAINS";
  if (code.includes("RRB") && (code.includes("CLERK") || code.includes("ASSISTANT") || code.includes("MULTIPURPOSE"))) {
    return "RRB_CLERK_PRELIMS";
  }
  if (code.includes("RRB")) return "RRB_PO_PRELIMS";
  if (code.includes("SBI") && code.includes("CLERK")) return "SBI_CLERK_PRELIMS";
  if (code.includes("SBI")) return "SBI_PO_PRELIMS";
  if (code.includes("RBI") && code.includes("ASSISTANT")) return "RBI_ASSISTANT_PRELIMS";
  if (code.includes("CLERK")) return "IBPS_CLERK_PRELIMS";
  return "IBPS_PO_PRELIMS";
}