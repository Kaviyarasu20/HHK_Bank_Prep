// Place at: server/question-engine/generators/reasoning/floorArrangement/index.js

/**
 * HHK Exam-Wise Floor Arrangement Question Generator — Master Orchestrator
 *
 * Supports 5 puzzle families:
 *  1. SINGLE_BUILDING      - 1 building, N floors (5-12), 1 person/floor
 *  2. MULTI_BUILDING       - 2-3 buildings, 4-8 floors each
 *  3. FLOOR_FLAT           - 1 building, floors x flats
 *  4. PROFESSIONS          - 1 building, 1 person/floor + unique profession
 *  5. MULTI_VARIABLE       - 1 building, 1 person/floor + 3-5 unique attributes
 *
 * Modes:
 *  - Mode 1: generateFloorPuzzleSet()            -> 1 shared puzzle + 5 linked MCQs
 *  - Mode 2: generateFloorBulk()                 -> multiple puzzle sets
 *  - Mode 3: generateFloorQuestionsForHHK()      -> flat array for engine router / mock tests
 *  - Mode 4: createFloorRegistryAdapter()        -> central registry adapter
 */

import { solveFloorCSP } from "./floorSolver.js";
import { generateFloorArrangement } from "./floorGenerators.js";
import { buildFloorQuestions } from "./floorQuestionBuilder.js";
import {
  FLOOR_PUZZLE_TYPES,
  createSingleBuildingGeometry,
  createMultiBuildingGeometry,
  createFloorFlatGeometry,
} from "./floorGeometry.js";
import {
  FLOOR_EXAM_PROFILES,
  resolveFloorExamProfile,
  pickPuzzleType,
  resolveDifficulty,
} from "./floorExamProfiles.js";

export function resolvePuzzleType(input = "", profile = null, rng = null) {
  const s = String(input || "").trim().toUpperCase();
  const map = {
    SINGLE: FLOOR_PUZZLE_TYPES.SINGLE_BUILDING,
    SINGLE_BUILDING: FLOOR_PUZZLE_TYPES.SINGLE_BUILDING,
    MULTI: FLOOR_PUZZLE_TYPES.MULTI_BUILDING,
    MULTI_BUILDING: FLOOR_PUZZLE_TYPES.MULTI_BUILDING,
    FLAT: FLOOR_PUZZLE_TYPES.FLOOR_FLAT,
    FLOOR_FLAT: FLOOR_PUZZLE_TYPES.FLOOR_FLAT,
    PROFESSION: FLOOR_PUZZLE_TYPES.PROFESSIONS,
    PROFESSIONS: FLOOR_PUZZLE_TYPES.PROFESSIONS,
    MULTI_VARIABLE: FLOOR_PUZZLE_TYPES.MULTI_VARIABLE,
    VARIABLE: FLOOR_PUZZLE_TYPES.MULTI_VARIABLE,
  };
  if (map[s]) return map[s];
  if (profile && rng) return pickPuzzleType(profile.puzzleTypeWeights, rng);
  return FLOOR_PUZZLE_TYPES.SINGLE_BUILDING;
}

/**
 * Mode 1 & 2: Generates ONE complete, CSP-verified Floor Arrangement Puzzle Set
 * (1 shared puzzle + questionCount linked MCQs).
 */
export function generateFloorPuzzleSet({
  exam = "IBPS-PO",
  stage = "Prelims",
  puzzleType = "AUTO",
  difficulty = "MIXED",
  questionCount = 5,
  seed = null,
  excludeFingerprints = [],
  adminProfileOverride = null,
  maxAttempts = 40,
} = {}) {
  const profile = resolveFloorExamProfile(exam, stage, adminProfileOverride);
  const baseSeed =
    seed !== null && seed !== undefined
      ? Number(seed)
      : Date.now() ^ Math.floor(Math.random() * 1e9);
  const seen = new Set(excludeFingerprints);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rngSeed = baseSeed + attempt * 7919;
    const rng = createFloorRng(rngSeed);
    const resolvedType = resolvePuzzleType(puzzleType, profile, rng);
    const resolvedDiff = resolveDifficulty(difficulty, profile, rng);

    const personCount = rng.int(profile.personCountRange.min, profile.personCountRange.max);
    const clueCount = rng.int(profile.clueCountRange.min, profile.clueCountRange.max);
    const attrCount = profile.attributeCount;

    let floorCount = null;
    let flatsPerFloor = null;
    let buildings = null;

    if (resolvedType === FLOOR_PUZZLE_TYPES.SINGLE_BUILDING) {
      floorCount = rng.int(5, 10);
    } else if (resolvedType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
      floorCount = rng.int(5, 8);
      flatsPerFloor = rng.int(2, 3);
    } else if (resolvedType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
      const bCount = rng.int(2, 3);
      buildings = [];
      for (let i = 0; i < bCount; i++) {
        buildings.push({ name: ["A", "B", "C"][i], floors: rng.int(4, 7) });
      }
    }

    let built;
    try {
      built = generateFloorArrangement({
        puzzleType: resolvedType,
        difficulty: resolvedDiff,
        exam,
        stage,
        seed: rngSeed,
        maxAttempts: 1,
        clueCount,
        personCount,
        buildings,
        floorCount,
        flatsPerFloor,
        attributeCount: resolvedType === FLOOR_PUZZLE_TYPES.MULTI_VARIABLE ? attrCount : 0,
      });
    } catch {
      continue;
    }

    const fingerprint = computeFloorPuzzleFingerprint(built);
    if (seen.has(fingerprint)) continue;

    const puzzleId = `FLOOR_${resolvedType}_${fingerprint.slice(0, 8)}`;
    const questions = buildFloorQuestions({
      puzzleId,
      geometry: built.geometry,
      solvedArrangement: built.solvedArrangement,
      persons: built.persons,
      attributesByPerson: built.attributesByPerson,
      constraints: built.constraints,
      clueStatements: built.clueStatements,
      difficulty: resolvedDiff,
      puzzleType: built.puzzleType,
      buildingInfo: built.buildingInfo,
      rng,
      questionCount,
    });

    if (questions.length < questionCount) continue;

    const candidateSet = {
      puzzleId,
      fingerprint,
      examName: profile.examCode,
      examStage: stage,
      profileKey: profile.profileKey,
      puzzleType: built.puzzleType,
      puzzleLabel: built.geometry.label,
      difficulty: resolvedDiff,
      puzzleInstructions: builtPuzzleInstructions(built),
      clueStatements: built.clueStatements,
      persons: built.persons,
      geometry: built.geometry,
      constraints: built.constraints,
      attributesByPerson: built.attributesByPerson,
      solutionData: {
        validatedArrangement: built.solvedArrangement,
        positionMetadata: built.geometry.positions.map((pos, idx) => ({
          ...pos,
          person: built.solvedArrangement[idx],
          attributes: built.attributesByPerson?.[built.solvedArrangement[idx]] || null,
        })),
        attributeData: built.attributesByPerson,
      },
      questions,
      validationStatus: "VERIFIED",
      generatorVersion: "1.0.0",
    };

    // Strip nothing needed; all question fields are student-safe
    return candidateSet;
  }

  throw new Error(`Unable to synthesize a unique-solution ${puzzleType} floor puzzle after ${maxAttempts} attempts.`);
}

function builtPuzzleInstructions(built) {
  const { puzzleType, geometry, buildingInfo } = built;
  if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
    return `Persons live across multiple buildings (${Object.values(buildingInfo.buildings || {}).map((b) => `${b.name}: ${b.floors} floors`).join(", ")}). Floor comparisons are valid within the same building unless stated otherwise.`;
  }
  if (puzzleType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
    return `Each floor has ${geometry.flatsPerFloor} flats (left to right). Each flat has exactly one occupant.`;
  }
  return `One person per floor. Floors are numbered from bottom (1) to top (${geometry.floorCount}).`;
}

function computeFloorPuzzleFingerprint(built) {
  const { persons, solvedArrangement, attributesByPerson } = built;
  return [puzzleTypeHash(built.puzzleType), ...solvedArrangement, ...persons.sort(), JSON.stringify(attributesByPerson)].join("|");
}

function puzzleTypeHash(t) {
  return t.substring(0, 3);
}

/**
 * Mode 1: Single independent floor-arrangement question
 */
export function generateSingleFloorQuestion(options = {}) {
  const set = generateFloorPuzzleSet({ ...options, questionCount: 1 });
  return set.questions[0];
}

/**
 * Mode 2: Bulk puzzle set generation
 */
export function generateFloorBulk({ puzzleCount = 3, ...options } = {}) {
  const sets = [];
  const seen = new Set(options.excludeFingerprints || []);
  const baseSeed = options.seed ?? Date.now();
  for (let i = 0; i < puzzleCount; i++) {
    const set = generateFloorPuzzleSet({
      ...options,
      seed: baseSeed + i * 1009,
      excludeFingerprints: Array.from(seen),
    });
    seen.add(set.fingerprint);
    sets.push(set);
  }
  return sets;
}

/**
 * Mode 3: HHK Engine Router & Mock Test Engine flat question array generator.
 * Preserves shared puzzleId / passageGroupKey across every question in a puzzle set!
 */
export function generateFloorQuestionsForHHK({
  exam = "IBPS-PO",
  stage = "Prelims",
  puzzleType = "AUTO",
  difficulty = "MIXED",
  count = 5,
  seed = null,
  excludeFingerprints = [],
} = {}) {
  const results = [];
  const seen = new Set(excludeFingerprints);
  const baseSeed = seed ?? Date.now();
  let remaining = Math.max(1, Number(count || 5));
  let setIdx = 0;

  while (remaining > 0 && setIdx < 10) {
    const chunk = Math.min(5, remaining);
    const puzzleSet = generateFloorPuzzleSet({
      exam,
      stage,
      puzzleType,
      difficulty,
      questionCount: chunk,
      seed: baseSeed + setIdx * 3571,
      excludeFingerprints: Array.from(seen),
    });
    seen.add(puzzleSet.fingerprint);

    for (const q of puzzleSet.questions) {
      results.push({
        ...q,
        topic: "Floor Arrangement",
        subType: puzzleSet.puzzleType,
        options: q.optionsArray || q.options.map((o) => o.text),
        optionsArray: q.options.map((o) => o.text),
        correctOptionIndex: q.correctOptionIndex,
        answer: q.correctAnswer,
        solutionSteps: [q.explanation],
        generationMode: "RULE_ENGINE",
        passageGroupKey: puzzleSet.puzzleId,
        floorSetMeta: {
          puzzleId: puzzleSet.puzzleId,
          puzzleType: puzzleSet.puzzleType,
          puzzleLabel: puzzleSet.puzzleLabel,
        },
      });
    }
    remaining -= puzzleSet.questions.length;
    setIdx++;
  }

  return results.slice(0, count);
}

/**
 * Mode 4: Central registry adapter
 */
export function createFloorRegistryAdapter() {
  return {
    subjectKey: "reasoning",
    displayName: "Reasoning Ability",
    status: "ACTIVE",
    version: "1.0.0",
    supportedTopics: ["Floor Arrangement"],
    plannedTopics: ["Puzzles", "Syllogism", "Inequality"],

    supportsTopic(topicName = "") {
      const norm = String(topicName || "").trim().toLowerCase();
      return norm.includes("floor") || norm.includes("arrangement");
    },

    getAvailableCount({ topic = "" } = {}) {
      if (!topic || this.supportsTopic(topic)) return Number.POSITIVE_INFINITY;
      return 0;
    },

    generateQuestions({
      topic = "Floor Arrangement",
      subtopic = "",
      difficulty = "MIXED",
      count = 5,
      examCode = "IBPS-PO",
      stageName = "Prelims",
      excludeFingerprints = [],
      seed = null,
    } = {}) {
      const norm = String(topic || "").trim().toLowerCase();
      if (!norm.includes("floor") && !norm.includes("arrangement")) {
        return {
          questions: [],
          metadata: {
            subjectKey: "reasoning",
            topic: "Floor Arrangement",
            requested: count,
            generated: 0,
            error: `Reasoning topic "${topic}" not handled by floor adapter.`,
          },
        };
      }
      const raw = generateFloorQuestionsForHHK({
        exam: examCode,
        stage: stageName,
        puzzleType: subtopic || "AUTO",
        difficulty,
        count,
        seed,
        excludeFingerprints,
      });
      const keys = ["A", "B", "C", "D", "E"];
      const formatted = raw.map((q) => ({
        questionId: q.questionId,
        puzzleId: q.puzzleId,
        passageGroupKey: q.passageGroupKey,
        subjectKey: "reasoning",
        topicName: "Floor Arrangement",
        subtopicName: q.subtopicName || q.subType,
        difficulty: q.difficulty,
        questionType: "mcq",
        questionText: q.questionText,
        options: q.optionsArray.map((text, idx) => ({ key: keys[idx], text })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        fingerprint: q.fingerprint,
        estimatedTimeSeconds: q.estimatedTimeSeconds,
        generatorVersion: "1.0.0",
        generatorSource: "HHK_FLOOR_ARRANGEMENT_ENGINE_V1",
      }));
      return {
        questions: formatted,
        metadata: {
          subjectKey: "reasoning",
          topic: "Floor Arrangement",
          requested: count,
          generated: formatted.length,
        },
      };
    },
  };
}

function createFloorRng(seedInput = Date.now()) {
  const seed = (Number(seedInput) >>> 0) || 0x9e3779b9;
  let state = seed;
  return {
    seed,
    random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (state >>> 7), 61 | t)) ^ t;
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
export { FLOOR_PUZZLE_TYPES };
export default generateFloorPuzzleSet;
