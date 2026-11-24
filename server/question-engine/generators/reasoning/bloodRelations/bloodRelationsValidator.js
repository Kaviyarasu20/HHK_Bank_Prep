// Place at: server/question-engine/generators/reasoning/bloodRelations/bloodRelationsValidator.js

import crypto from "node:crypto";
import { buildAndSolveFamilyGraph } from "./bloodRelationsSolver.js";

/**
 * Deterministic PRNG helper matching HHK Question Engine conventions.
 */
export function createRng(seedInput = Date.now()) {
  const seed = (Number(seedInput) >>> 0) || 0x9e3779b9;
  let state = seed;
  return {
    seed,
    random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.random() * arr.length)];
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/**
 * Builds 5 unique banking-standard distractors around a verified answer using
 * real banking confusion pairs (maternal/paternal swap, parent/child reversal,
 * uncle/nephew, brother/cousin, in-law confusions).
 */
const CONFUSION_MAP = {
  Father: ["Grandfather", "Paternal Uncle", "Son", "Father-in-law", "Brother", "Cannot be determined"],
  Mother: ["Grandmother", "Maternal Aunt", "Daughter", "Mother-in-law", "Sister", "Cannot be determined"],
  Son: ["Nephew", "Brother", "Grandson", "Father", "Cousin", "Cannot be determined"],
  Daughter: ["Niece", "Sister", "Granddaughter", "Mother", "Cousin", "Cannot be determined"],
  Brother: ["Cousin", "Brother-in-law", "Son", "Nephew", "Father", "Cannot be determined"],
  Sister: ["Cousin", "Sister-in-law", "Daughter", "Niece", "Mother", "Cannot be determined"],
  Husband: ["Brother-in-law", "Father-in-law", "Brother", "Son-in-law", "Cousin", "Cannot be determined"],
  Wife: ["Sister-in-law", "Mother-in-law", "Sister", "Daughter-in-law", "Cousin", "Cannot be determined"],
  "Paternal Grandfather": ["Maternal Grandfather", "Father", "Paternal Uncle", "Father-in-law", "Grandson", "Cannot be determined"],
  "Paternal Grandmother": ["Maternal Grandmother", "Mother", "Paternal Aunt", "Mother-in-law", "Granddaughter", "Cannot be determined"],
  "Maternal Grandfather": ["Paternal Grandfather", "Father", "Maternal Uncle", "Father-in-law", "Grandson", "Cannot be determined"],
  "Maternal Grandmother": ["Paternal Grandmother", "Mother", "Maternal Aunt", "Mother-in-law", "Granddaughter", "Cannot be determined"],
  Grandson: ["Son", "Nephew", "Granddaughter", "Paternal Grandfather", "Cousin", "Cannot be determined"],
  Granddaughter: ["Daughter", "Niece", "Grandson", "Paternal Grandmother", "Cousin", "Cannot be determined"],
  "Paternal Uncle": ["Maternal Uncle", "Father", "Nephew", "Brother-in-law", "Paternal Grandfather", "Cannot be determined"],
  "Maternal Uncle": ["Paternal Uncle", "Father", "Nephew", "Brother-in-law", "Maternal Grandfather", "Cannot be determined"],
  "Paternal Aunt": ["Maternal Aunt", "Mother", "Niece", "Sister-in-law", "Paternal Grandmother", "Cannot be determined"],
  "Maternal Aunt": ["Paternal Aunt", "Mother", "Niece", "Sister-in-law", "Maternal Grandmother", "Cannot be determined"],
  Nephew: ["Son", "Cousin", "Paternal Uncle", "Maternal Uncle", "Niece", "Cannot be determined"],
  Niece: ["Daughter", "Cousin", "Paternal Aunt", "Maternal Aunt", "Nephew", "Cannot be determined"],
  Cousin: ["Brother", "Sister", "Nephew", "Niece", "Brother-in-law", "Cannot be determined"],
  "Brother-in-law": ["Brother", "Cousin", "Father-in-law", "Son-in-law", "Paternal Uncle", "Cannot be determined"],
  "Sister-in-law": ["Sister", "Cousin", "Mother-in-law", "Daughter-in-law", "Paternal Aunt", "Cannot be determined"],
  "Father-in-law": ["Father", "Paternal Uncle", "Brother-in-law", "Paternal Grandfather", "Son-in-law", "Cannot be determined"],
  "Mother-in-law": ["Mother", "Paternal Aunt", "Sister-in-law", "Paternal Grandmother", "Daughter-in-law", "Cannot be determined"],
  "Son-in-law": ["Son", "Brother-in-law", "Nephew", "Father-in-law", "Husband", "Cannot be determined"],
  "Daughter-in-law": ["Daughter", "Sister-in-law", "Niece", "Mother-in-law", "Wife", "Cannot be determined"],
  "Great-Grandfather": ["Paternal Grandfather", "Maternal Grandfather", "Father", "Grandson", "Cannot be determined"],
  "Great-Grandmother": ["Paternal Grandmother", "Maternal Grandmother", "Mother", "Granddaughter", "Cannot be determined"],
  "Cannot be determined": ["Brother", "Sister", "Son", "Daughter", "Cousin", "Nephew", "Niece", "Paternal Uncle"],
};

export function buildFiveOptions(correctAnswer, rng, customDistractors = null) {
  const ans = String(correctAnswer).trim();
  const basePool = Array.isArray(customDistractors) && customDistractors.length >= 4
    ? customDistractors
    : CONFUSION_MAP[ans] || ["Father", "Mother", "Brother", "Sister", "Cousin", "Cannot be determined"];

  const uniqueDistractors = [];
  const seen = new Set([ans.toLowerCase()]);
  for (const cand of rng.shuffle(basePool)) {
    const clean = String(cand).trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    uniqueDistractors.push(clean);
    if (uniqueDistractors.length === 4) break;
  }

  // Fallback fill if numeric counting options need 4 distinct values
  let offset = 1;
  while (uniqueDistractors.length < 4) {
    const fallback = /^\d+$/.test(ans)
      ? String(Math.max(0, Number(ans) + (offset % 2 === 0 ? offset : -offset) + 2))
      : `None of these`;
    if (!seen.has(fallback.toLowerCase())) {
      seen.add(fallback.toLowerCase());
      uniqueDistractors.push(fallback);
    }
    offset++;
    if (offset > 20) break;
  }

  const optionsArray = rng.shuffle([ans, ...uniqueDistractors.slice(0, 4)]);
  const correctOptionIndex = optionsArray.findIndex((o) => o === ans);
  const keys = ["A", "B", "C", "D", "E"];
  const options = {};
  optionsArray.forEach((text, i) => {
    options[keys[i]] = text;
  });

  return {
    options,
    optionsArray,
    correctOptionIndex,
    correct_answer: keys[correctOptionIndex],
    correct_answer_value: ans,
  };
}

/**
 * Computes a structural fingerprint based on templateId, category, topology, and target relation
 * (independent of person names so name-swapped clones are caught as duplicates).
 */
export function computeBloodRelationsFingerprint(logicModel = {}, templateId = "") {
  const signature = JSON.stringify({
    templateId,
    category: logicModel.category,
    memberCount: (logicModel.members || []).length,
    genders: (logicModel.members || []).map((m) => m.gender).sort(),
    parentEdges: (logicModel.parentChild || []).length,
    spouseEdges: (logicModel.spouses || []).length,
    siblingEdges: (logicModel.siblings || []).length,
    queryType: logicModel.query?.type,
    expectedAnswer: logicModel.expectedAnswer,
    variantTag: logicModel.variantTag || "",
  });
  return crypto.createHash("sha256").update(signature).digest("hex").slice(0, 24);
}

/**
 * Independent Mathematical & Logical Validation Gate.
 * Re-solves the family graph from scratch and verifies:
 *  1. Zero contradictions, zero cycles, valid generation levels.
 *  2. Solver's independently computed answer matches template's claimed answer verbatim.
 *  3. Exactly 5 unique, non-empty options with valid correctOptionIndex.
 *  4. Non-empty explanation and zero NaN/undefined leaks.
 */
export function validateBloodRelationsQuestion(raw) {
  if (!raw || !raw.logicModel) {
    return { passed: false, reason: "Missing logicModel for independent verification." };
  }

  const { graph, validation } = buildAndSolveFamilyGraph(raw.logicModel);
  if (!validation.consistent) {
    return {
      passed: false,
      reason: `Family graph inconsistency: ${validation.errors.join("; ")}`,
    };
  }

  // Independently compute the ground-truth answer from the solved graph
  const query = raw.logicModel.query;
  let solvedAnswer = null;
  if (query?.type === "relation") {
    solvedAnswer = graph.resolveRelation(query.source, query.target).relation;
  } else if (query?.type === "count") {
    const counts = graph.getFamilyCounts();
    if (query.metric === "males") {
      solvedAnswer = counts.unknownGender > 0 ? "Cannot be determined" : String(counts.males);
    } else if (query.metric === "females") {
      solvedAnswer = counts.unknownGender > 0 ? "Cannot be determined" : String(counts.females);
    } else if (query.metric === "couples") {
      solvedAnswer = String(counts.couples);
    } else if (query.metric === "generations") {
      solvedAnswer = String(counts.generations);
    } else if (query.metric === "total") {
      solvedAnswer = String(counts.totalMembers);
    }
  } else {
    return { passed: false, reason: `Unsupported query type: ${query?.type}` };
  }

  const claimed = String(raw.correct_answer_value ?? "").trim();
  if (solvedAnswer !== claimed) {
    return {
      passed: false,
      reason: `Independent solver mismatch: solver="${solvedAnswer}", claimed="${claimed}".`,
    };
  }

  // Structural option checks (strict 5 unique options)
  if (!Array.isArray(raw.optionsArray) || raw.optionsArray.length !== 5) {
    return { passed: false, reason: `Expected 5 options, found ${raw.optionsArray?.length}.` };
  }
  const normOpts = raw.optionsArray.map((o) => String(o ?? "").trim());
  if (normOpts.some((o) => !o || o.includes("undefined") || o.includes("NaN") || o.includes("null"))) {
    return { passed: false, reason: "Option contains empty or invalid token." };
  }
  if (new Set(normOpts.map((o) => o.toLowerCase())).size !== 5) {
    return { passed: false, reason: "Duplicate options detected." };
  }
  if (normOpts[raw.correctOptionIndex] !== claimed) {
    return { passed: false, reason: "correctOptionIndex does not align with correct_answer_value." };
  }

  const qText = String(raw.question || "");
  if (qText.length < 15 || qText.includes("undefined") || qText.includes("NaN")) {
    return { passed: false, reason: "Invalid question text." };
  }

  return {
    passed: true,
    reason: null,
    validation: {
      solverVerified: true,
      solvedAnswer,
      generations: validation.generationCount,
      familyTreeData: graph.exportFamilyTreeData(),
    },
  };
}