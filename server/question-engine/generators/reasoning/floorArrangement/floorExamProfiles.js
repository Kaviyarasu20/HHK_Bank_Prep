// Place at: server/question-engine/generators/reasoning/floorArrangement/floorExamProfiles.js

/**
 * HHK Floor Arrangement - Exam Profiles
 * Maps banking exams + stages to puzzle-type weights, difficulty weights, and person/floor counts.
 */

export const FLOOR_EXAM_PROFILES = {
  "IBPS-PO": {
    profileKey: "ibps_po",
    examCode: "IBPS-PO",
    displayName: "IBPS PO",
    puzzleTypeWeights: {
      SINGLE_BUILDING: 30,
      MULTI_BUILDING: 20,
      FLOOR_FLAT: 20,
      PROFESSIONS: 20,
      MULTI_VARIABLE: 10,
    },
    difficultyWeights: { Easy: 25, Medium: 45, Hard: 30, VeryDifficult: 0 },
    personCountRange: { min: 6, max: 8 },
    clueCountRange: { min: 6, max: 8 },
    attributeCount: 2,
  },
  "IBPS-CLERK": {
    profileKey: "ibps_clerk",
    examCode: "IBPS-CLERK",
    displayName: "IBPS Clerk",
    puzzleTypeWeights: {
      SINGLE_BUILDING: 40,
      MULTI_BUILDING: 10,
      FLOOR_FLAT: 15,
      PROFESSIONS: 25,
      MULTI_VARIABLE: 10,
    },
    difficultyWeights: { Easy: 35, Medium: 45, Hard: 20, VeryDifficult: 0 },
    personCountRange: { min: 6, max: 7 },
    clueCountRange: { min: 5, max: 7 },
    attributeCount: 1,
  },
  "SBI-PO": {
    profileKey: "sbi_po",
    examCode: "SBI-PO",
    displayName: "SBI PO",
    puzzleTypeWeights: {
      SINGLE_BUILDING: 20,
      MULTI_BUILDING: 25,
      FLOOR_FLAT: 25,
      PROFESSIONS: 20,
      MULTI_VARIABLE: 10,
    },
    difficultyWeights: { Easy: 15, Medium: 35, Hard: 40, VeryDifficult: 10 },
    personCountRange: { min: 7, max: 9 },
    clueCountRange: { min: 7, max: 10 },
    attributeCount: 3,
  },
  "SBI-CLERK": {
    profileKey: "sbi_clerk",
    examCode: "SBI-CLERK",
    displayName: "SBI Clerk",
    puzzleTypeWeights: {
      SINGLE_BUILDING: 45,
      MULTI_BUILDING: 10,
      FLOOR_FLAT: 15,
      PROFESSIONS: 20,
      MULTI_VARIABLE: 10,
    },
    difficultyWeights: { Easy: 40, Medium: 40, Hard: 20, VeryDifficult: 0 },
    personCountRange: { min: 6, max: 7 },
    clueCountRange: { min: 5, max: 7 },
    attributeCount: 1,
  },
  "IBPS-RRB": {
    profileKey: "ibps_rrb",
    examCode: "IBPS-RRB",
    displayName: "IBPS RRB",
    puzzleTypeWeights: {
      SINGLE_BUILDING: 50,
      MULTI_BUILDING: 10,
      FLOOR_FLAT: 15,
      PROFESSIONS: 15,
      MULTI_VARIABLE: 10,
    },
    difficultyWeights: { Easy: 35, Medium: 45, Hard: 20, VeryDifficult: 0 },
    personCountRange: { min: 5, max: 7 },
    clueCountRange: { min: 5, max: 7 },
    attributeCount: 1,
  },
};

export function resolveFloorExamProfile(exam = "IBPS-PO", stage = "Prelims", adminProfileOverride = null) {
  const key = String(exam || "IBPS-PO").toUpperCase().replace(/\s/g, "-");
  const profile = FLOOR_EXAM_PROFILES[key] || FLOOR_EXAM_PROFILES["IBPS-PO"];
  return adminProfileOverride ? { ...profile, ...adminProfileOverride } : profile;
}

export function pickPuzzleType(weightsMap, rng) {
  const entries = Object.entries(weightsMap || {}).filter(([, w]) => Number(w) > 0);
  if (!entries.length) return "SINGLE_BUILDING";
  const total = entries.reduce((s, [, w]) => s + Number(w), 0);
  let r = rng.random() * total;
  for (const [k, w] of entries) {
    r -= Number(w);
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function resolveDifficulty(difficulty, profile, rng) {
  if (!difficulty || difficulty.toUpperCase() === "MIXED" || difficulty.toUpperCase() === "AUTO") {
    return pickPuzzleType(profile.difficultyWeights, rng);
  }
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}
