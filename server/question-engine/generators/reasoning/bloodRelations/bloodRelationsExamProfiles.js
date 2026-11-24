// Place at: server/question-engine/generators/reasoning/bloodRelations/bloodRelationsExamProfiles.js

/**
 * Examination-Wise Blood Relations Configuration Profiles
 *
 * Covers all 12 core banking examinations (6 exams x Prelims & Mains) plus admin override support.
 * These are initial engineering guidelines grounded in Indian banking exam trends —
 * NOT fixed official quotas. Every profile can be overridden at runtime by an administrator.
 */

export const MALE_NAMES = [
  "Aarav", "Rohan", "Vikram", "Siddharth", "Karthik", "Aditya", "Pranav", "Nikhil",
  "Arjun", "Manish", "Deepak", "Suresh", "Rajesh", "Harish", "Varun", "Kunal",
  "Tarun", "Gaurav", "Rahul", "Sameer", "Ankit", "Vivek", "Prakash", "Ramesh",
  "Mahesh", "Dinesh", "Santosh", "Ashok", "Vinod", "Naveen", "Pankaj", "Sachin",
  "Abhishek", "Yash", "Dev", "Rishi", "Kabir", "Ishaan", "Nitin", "Hemant",
];

export const FEMALE_NAMES = [
  "Ananya", "Priya", "Kavya", "Sneha", "Meera", "Divya", "Pooja", "Neha",
  "Riya", "Shreya", "Swati", "Nisha", "Aarti", "Sunita", "Rekha", "Geeta",
  "Seema", "Kiran", "Pallavi", "Rashmi", "Bhavna", "Deepika", "Sonal", "Monika",
  "Anjali", "Vandana", "Archana", "Shilpa", "Preeti", "Meenakshi", "Lakshmi", "Saritha",
  "Radha", "Sita", "Nandini", "Tanya", "Simran", "Aditi", "Kritika", "Jhanvi",
];

export const LETTER_SETS = [
  ["A", "B", "C", "D", "E", "F", "G", "H"],
  ["P", "Q", "R", "S", "T", "U", "V", "W"],
  ["J", "K", "L", "M", "N", "O", "P", "Q"],
  ["M", "N", "O", "P", "Q", "R", "S", "T"],
  ["D", "E", "F", "G", "H", "I", "J", "K"],
];

export const BLOOD_RELATIONS_CATEGORIES = {
  A: "Direct Blood Relationships",
  B: "Pointing to a Person",
  C: "Introduction-Based Relationships",
  D: "Family Tree / Generation-Based",
  E: "Coded Blood Relationships",
  F: "Multiple Statement-Based",
  G: "Conditional Blood Relationships",
  H: "Cannot Be Determined",
  I: "Family Counting",
  J: "Advanced Family Relationship Puzzles",
};

/**
 * 12 Independently Configurable Examination Profiles
 */
export const BLOOD_RELATIONS_EXAM_PROFILES = {
  IBPS_RRB_CLERK_PRELIMS: {
    examCode: "IBPS-RRB-OA",
    stage: "Prelims",
    difficultyWeights: { Easy: 65, Medium: 30, Hard: 5 },
    categoryWeights: { A: 20, B: 20, C: 18, D: 10, E: 2, F: 15, G: 3, H: 4, I: 8, J: 0 },
    maxMembers: 6,
    maxGenerations: 3,
    maxSteps: 3,
    estimatedTimeSeconds: 35,
  },
  IBPS_CLERK_PRELIMS: {
    examCode: "IBPS-CSA",
    stage: "Prelims",
    difficultyWeights: { Easy: 45, Medium: 45, Hard: 10 },
    categoryWeights: { A: 14, B: 14, C: 12, D: 16, E: 10, F: 14, G: 6, H: 6, I: 8, J: 0 },
    maxMembers: 7,
    maxGenerations: 3,
    maxSteps: 4,
    estimatedTimeSeconds: 45,
  },
  SBI_CLERK_PRELIMS: {
    examCode: "SBI-JA",
    stage: "Prelims",
    difficultyWeights: { Easy: 30, Medium: 55, Hard: 15 },
    categoryWeights: { A: 10, B: 12, C: 10, D: 18, E: 12, F: 16, G: 8, H: 6, I: 8, J: 0 },
    maxMembers: 7,
    maxGenerations: 3,
    maxSteps: 4,
    estimatedTimeSeconds: 50,
  },
  IBPS_RRB_PO_PRELIMS: {
    examCode: "IBPS-RRB-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 20, Medium: 55, Hard: 25 },
    categoryWeights: { A: 6, B: 8, C: 8, D: 20, E: 12, F: 16, G: 12, H: 8, I: 6, J: 4 },
    maxMembers: 8,
    maxGenerations: 3,
    maxSteps: 5,
    estimatedTimeSeconds: 55,
  },
  IBPS_PO_PRELIMS: {
    examCode: "IBPS-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 15, Medium: 55, Hard: 30 },
    categoryWeights: { A: 5, B: 6, C: 6, D: 20, E: 16, F: 14, G: 13, H: 8, I: 6, J: 6 },
    maxMembers: 8,
    maxGenerations: 3,
    maxSteps: 5,
    estimatedTimeSeconds: 60,
  },
  SBI_PO_PRELIMS: {
    examCode: "SBI-PO",
    stage: "Prelims",
    difficultyWeights: { Easy: 10, Medium: 45, Hard: 45 },
    categoryWeights: { A: 4, B: 4, C: 4, D: 20, E: 16, F: 14, G: 14, H: 10, I: 6, J: 8 },
    maxMembers: 8,
    maxGenerations: 4,
    maxSteps: 6,
    estimatedTimeSeconds: 65,
  },
  IBPS_RRB_CLERK_MAINS: {
    examCode: "IBPS-RRB-OA",
    stage: "Mains",
    difficultyWeights: { Easy: 15, Medium: 55, Hard: 30 },
    categoryWeights: { A: 4, B: 6, C: 6, D: 22, E: 18, F: 14, G: 10, H: 8, I: 6, J: 6 },
    maxMembers: 8,
    maxGenerations: 3,
    maxSteps: 5,
    estimatedTimeSeconds: 65,
  },
  IBPS_RRB_PO_MAINS: {
    examCode: "IBPS-RRB-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 5, Medium: 45, Hard: 50 },
    categoryWeights: { A: 0, B: 4, C: 4, D: 20, E: 20, F: 12, G: 14, H: 10, I: 4, J: 12 },
    maxMembers: 9,
    maxGenerations: 4,
    maxSteps: 6,
    estimatedTimeSeconds: 75,
  },
  IBPS_CLERK_MAINS: {
    examCode: "IBPS-CSA",
    stage: "Mains",
    difficultyWeights: { Easy: 10, Medium: 50, Hard: 40 },
    categoryWeights: { A: 0, B: 4, C: 4, D: 20, E: 22, F: 12, G: 14, H: 8, I: 6, J: 10 },
    maxMembers: 9,
    maxGenerations: 4,
    maxSteps: 6,
    estimatedTimeSeconds: 75,
  },
  IBPS_PO_MAINS: {
    examCode: "IBPS-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 0, Medium: 35, Hard: 65 },
    categoryWeights: { A: 0, B: 0, C: 0, D: 18, E: 26, F: 10, G: 16, H: 10, I: 4, J: 16 },
    maxMembers: 10,
    maxGenerations: 4,
    maxSteps: 7,
    estimatedTimeSeconds: 90,
  },
  SBI_CLERK_MAINS: {
    examCode: "SBI-JA",
    stage: "Mains",
    difficultyWeights: { Easy: 10, Medium: 45, Hard: 45 },
    categoryWeights: { A: 0, B: 4, C: 4, D: 20, E: 22, F: 12, G: 14, H: 8, I: 6, J: 10 },
    maxMembers: 9,
    maxGenerations: 4,
    maxSteps: 6,
    estimatedTimeSeconds: 80,
  },
  SBI_PO_MAINS: {
    examCode: "SBI-PO",
    stage: "Mains",
    difficultyWeights: { Easy: 0, Medium: 30, Hard: 70 },
    categoryWeights: { A: 0, B: 0, C: 0, D: 16, E: 26, F: 8, G: 16, H: 12, I: 4, J: 18 },
    maxMembers: 10,
    maxGenerations: 4,
    maxSteps: 7,
    estimatedTimeSeconds: 95,
  },
};

/**
 * Resolves any exam code + stage string to one of the 12 profiles (with optional admin overrides).
 */
export function resolveBloodRelationsProfile(examInput = "IBPS-PO", stageInput = "Prelims", adminOverride = null) {
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

  const base = BLOOD_RELATIONS_EXAM_PROFILES[key] || BLOOD_RELATIONS_EXAM_PROFILES.IBPS_PO_PRELIMS;
  if (!adminOverride || typeof adminOverride !== "object") {
    return { profileKey: key, ...structuredClone(base) };
  }
  return {
    profileKey: key,
    ...structuredClone(base),
    ...adminOverride,
    categoryWeights: {
      ...base.categoryWeights,
      ...(adminOverride.categoryWeights || {}),
    },
    difficultyWeights: {
      ...base.difficultyWeights,
      ...(adminOverride.difficultyWeights || {}),
    },
  };
}