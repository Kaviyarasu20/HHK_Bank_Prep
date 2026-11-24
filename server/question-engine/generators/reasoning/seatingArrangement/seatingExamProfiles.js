// Place at: server/question-engine/generators/reasoning/seatingArrangement/seatingExamProfiles.js

import { ARRANGEMENT_TYPES } from "./seatingGeometry.js";

export const SEATING_PERSON_SETS = [
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  ["P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y"],
  ["J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"],
  ["M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"],
  ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
];

export const ATTRIBUTE_POOLS = {
  profession: ["Doctor", "Engineer", "Banker", "Teacher", "Lawyer", "Architect", "Pilot", "Chef", "Scientist", "Accountant"],
  city: ["Chennai", "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Kolkata", "Jaipur", "Kochi", "Lucknow"],
  colour: ["Red", "Blue", "Green", "Yellow", "White", "Orange", "Violet", "Grey", "Maroon", "Indigo"],
};

/**
 * 12 Independently Configurable Banking Examination Profiles for Seating Arrangement
 * Grounded in Indian banking Prelims & Mains trends — configurable & overridable by Admin.
 */
export const SEATING_EXAM_PROFILES = {
  IBPS_RRB_CLERK_PRELIMS: {
    examCode: "IBPS-RRB-OA",
    stage: "Prelims",
    difficultyWeights: { Easy: 65, Medium: 30, Hard: 5 },
    personCount: { linear: 6, circular: 6, doubleRowPerRow: 3, parallelPerRow: 4 },
    useAttributes: false,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 180,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 28,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 26,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 16,
      [ARRANGEMENT_TYPES.SQUARE]: 12,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 6,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 8,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 4,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 0,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 0,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 0,
    },
  },
  IBPS_CLERK_PRELIMS: {
    examCode: "IBPS-CSA",
    stage: "Prelims",
    difficultyWeights: { Easy: 45, Medium: 45, Hard: 10 },
    personCount: { linear: 7, circular: 6, doubleRowPerRow: 4, parallelPerRow: 4 },
    useAttributes: false,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 210,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 22,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 20,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 16,
      [ARRANGEMENT_TYPES.SQUARE]: 14,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 8,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 10,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 5,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 5,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 0,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 0,
    },
  },
  SBI_CLERK_PRELIMS: {
    examCode: "SBI-JA",
    stage: "Prelims",
    difficultyWeights: { Easy: 30, Medium: 55, Hard: 15 },
    personCount: { linear: 7, circular: 8, doubleRowPerRow: 4, parallelPerRow: 4 },
    useAttributes: false,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 220,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 18,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 16,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 16,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 6,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 10,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 5,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 5,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 0,
    },
  },
  IBPS_RRB_PO_PRELIMS: {
    examCode: "IBPS-RRB-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 15, Medium: 55, Hard: 30 },
    personCount: { linear: 7, circular: 8, doubleRowPerRow: 4, parallelPerRow: 4 },
    useAttributes: false,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 240,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 14,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 12,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 14,
      [ARRANGEMENT_TYPES.SQUARE]: 14,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 8,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 8,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 6,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 8,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 6,
    },
  },
  IBPS_PO_PRELIMS: {
    examCode: "IBPS-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 10, Medium: 55, Hard: 35 },
    personCount: { linear: 7, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: false,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 250,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 12,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 18,
      [ARRANGEMENT_TYPES.SQUARE]: 14,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 10,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 8,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 6,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 6,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 6,
    },
  },
  SBI_PO_PRELIMS: {
    examCode: "SBI-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 5, Medium: 45, Hard: 50 },
    personCount: { linear: 7, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 270,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 20,
      [ARRANGEMENT_TYPES.SQUARE]: 14,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 10,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 8,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 8,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 7,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 7,
    },
  },
  IBPS_RRB_CLERK_MAINS: {
    examCode: "IBPS-RRB-OA",
    stage: "Mains",
    difficultyWeights: { Easy: 10, Medium: 55, Hard: 35 },
    personCount: { linear: 7, circular: 8, doubleRowPerRow: 4, parallelPerRow: 4 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 260,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 12,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 14,
      [ARRANGEMENT_TYPES.SQUARE]: 14,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 10,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 8,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 6,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 8,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 8,
    },
  },
  IBPS_RRB_PO_MAINS: {
    examCode: "IBPS-RRB-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 0, Medium: 40, Hard: 60 },
    personCount: { linear: 8, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 300,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 22,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 14,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 10,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 10,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 12,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 4,
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 4,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 0,
    },
  },
  IBPS_CLERK_MAINS: {
    examCode: "IBPS-CSA",
    stage: "Mains",
    difficultyWeights: { Easy: 5, Medium: 45, Hard: 50 },
    personCount: { linear: 8, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 290,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 20,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 14,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 10,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 8,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 12,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 5,
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 5,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 0,
    },
  },
  IBPS_PO_MAINS: {
    examCode: "IBPS-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 0, Medium: 30, Hard: 70 },
    personCount: { linear: 8, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 330,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 24,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 16,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 10,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 12,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 12,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 10,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 0,
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 0,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 0,
    },
  },
  SBI_CLERK_MAINS: {
    examCode: "SBI-JA",
    stage: "Mains",
    difficultyWeights: { Easy: 5, Medium: 45, Hard: 50 },
    personCount: { linear: 8, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 300,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 20,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 14,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 10,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 10,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 12,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 5,
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 5,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 0,
    },
  },
  SBI_PO_MAINS: {
    examCode: "SBI-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 0, Medium: 25, Hard: 75 },
    personCount: { linear: 8, circular: 8, doubleRowPerRow: 4, parallelPerRow: 5 },
    useAttributes: true,
    questionsPerPuzzle: 5,
    estimatedTimeSeconds: 360,
    arrangementWeights: {
      [ARRANGEMENT_TYPES.CIRCULAR_MIXED]: 26,
      [ARRANGEMENT_TYPES.SQUARE]: 16,
      [ARRANGEMENT_TYPES.RECTANGULAR]: 16,
      [ARRANGEMENT_TYPES.TRIANGULAR]: 10,
      [ARRANGEMENT_TYPES.HEXAGONAL]: 12,
      [ARRANGEMENT_TYPES.PARALLEL_ROWS]: 12,
      [ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW]: 8,
      [ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE]: 0,
      [ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW]: 0,
      [ARRANGEMENT_TYPES.CIRCULAR_CENTRE]: 0,
    },
  },
};

export function resolveSeatingExamProfile(examInput = "IBPS-PO", stageInput = "Prelims", adminOverride = null) {
  const e = String(examInput || "").toUpperCase();
  const s = String(stageInput || "").toUpperCase();
  const isMains = s.includes("MAIN") || e.includes("MAINS");

  let key = isMains ? "IBPS_PO_MAINS" : "IBPS_PO_PRELIMS";
  if (e.includes("RRB") && (e.includes("CLERK") || e.includes("OA") || e.includes("ASSISTANT"))) {
    key = isMains ? "IBPS_RRB_CLERK_MAINS" : "IBPS_RRB_CLERK_PRELIMS";
  } else if (e.includes("RRB")) {
    key = isMains ? "IBPS_RRB_PO_MAINS" : "IBPS_RRB_PO_PRELIMS";
  } else if (e.includes("SBI") && (e.includes("CLERK") || e.includes("JA"))) {
    key = isMains ? "SBI_CLERK_MAINS" : "SBI_CLERK_PRELIMS";
  } else if (e.includes("SBI")) {
    key = isMains ? "SBI_PO_MAINS" : "SBI_PO_PRELIMS";
  } else if (e.includes("CLERK") || e.includes("CSA")) {
    key = isMains ? "IBPS_CLERK_MAINS" : "IBPS_CLERK_PRELIMS";
  }

  const base = SEATING_EXAM_PROFILES[key] || SEATING_EXAM_PROFILES.IBPS_PO_PRELIMS;
  if (!adminOverride || typeof adminOverride !== "object") {
    return { profileKey: key, ...structuredClone(base) };
  }
  return {
    profileKey: key,
    ...structuredClone(base),
    ...adminOverride,
    arrangementWeights: {
      ...base.arrangementWeights,
      ...(adminOverride.arrangementWeights || {}),
    },
    difficultyWeights: {
      ...base.difficultyWeights,
      ...(adminOverride.difficultyWeights || {}),
    },
  };
}