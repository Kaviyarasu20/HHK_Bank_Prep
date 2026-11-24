// Place at: server/question-engine/generators/reasoning/seatingArrangement/index.js

/**
 * HHK Exam-Wise Seating Arrangement Question Generator — Master Orchestrator
 *
 * Supports all 6 generation modes:
 *  - Mode 1: generateSingleSeatingQuestion()
 *  - Mode 2: generateSeatingPuzzleSet() (complete 5-question shared puzzle set)
 *  - Mode 3: generateSeatingBulk()
 *  - Mode 4: generateExamWiseSeating() (12 banking exam profiles + admin overrides)
 *  - Mode 5: generateDifficultySeating()
 *  - Mode 6: generateSeatingQuestionsForHHK() (Engine Router & Exam-Wise Mock Test Engine integration,
 *            preserving shared `passageGroupKey`/`puzzleId` so puzzle sets are never split!)
 */

import { ARRANGEMENT_TYPES } from "./seatingGeometry.js";
import {
  SEATING_EXAM_PROFILES,
  resolveSeatingExamProfile,
} from "./seatingExamProfiles.js";
import {
  ARRANGEMENT_GENERATOR_MAP,
  createRng,
} from "./seatingArrangementGenerators.js";
import {
  buildQuestionsForArrangement,
  computeSeatingPuzzleFingerprint,
  validateSeatingPuzzleSet,
} from "./seatingQuestionBuilder.js";
import { generateBloodRelationsBatch } from "../bloodRelations/index.js";

function pickWeightedKey(weightsMap, rng) {
  const entries = Object.entries(weightsMap || {}).filter(([, w]) => Number(w) > 0);
  if (!entries.length) return ARRANGEMENT_TYPES.CIRCULAR_CENTRE;
  const total = entries.reduce((s, [, w]) => s + Number(w), 0);
  let r = rng.random() * total;
  for (const [k, w] of entries) {
    r -= Number(w);
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function resolveArrangementType(input = "", profile = null, rng = null) {
  const s = String(input || "").trim().toUpperCase();
  if (ARRANGEMENT_GENERATOR_MAP[s]) return s;
  if (s.includes("DOUBLE")) return ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW;
  if (s.includes("PARALLEL")) return ARRANGEMENT_TYPES.PARALLEL_ROWS;
  if (s.includes("LINEAR") || s.includes("SINGLE")) return ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW;
  if (s.includes("MIXED")) return ARRANGEMENT_TYPES.CIRCULAR_MIXED;
  if (s.includes("OUTSIDE")) return ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE;
  if (s.includes("CIRCULAR") || s.includes("CENTRE") || s.includes("CENTER")) return ARRANGEMENT_TYPES.CIRCULAR_CENTRE;
  if (s.includes("SQUARE")) return ARRANGEMENT_TYPES.SQUARE;
  if (s.includes("RECTANG")) return ARRANGEMENT_TYPES.RECTANGULAR;
  if (s.includes("TRIANG")) return ARRANGEMENT_TYPES.TRIANGULAR;
  if (s.includes("HEXAG")) return ARRANGEMENT_TYPES.HEXAGONAL;

  if (profile && rng) return pickWeightedKey(profile.arrangementWeights, rng);
  return ARRANGEMENT_TYPES.CIRCULAR_CENTRE;
}

/**
 * Mode 2 & Mode 4: Generates ONE complete, CSP-verified Seating Arrangement Puzzle Set
 * (1 shared puzzle + `questionCount` linked questions).
 */
export function generateSeatingPuzzleSet({
  exam = "IBPS-PO",
  stage = "Prelims",
  arrangementType = "AUTO",
  difficulty = "MIXED",
  questionCount = 5,
  useAttributes = null,
  seed = null,
  excludeFingerprints = [],
  adminProfileOverride = null,
  maxAttempts = 15,
} = {}) {
  const profile = resolveSeatingExamProfile(exam, stage, adminProfileOverride);
  const baseSeed = seed !== null && seed !== undefined ? Number(seed) : Date.now() ^ Math.floor(Math.random() * 1e9);
  const seen = new Set(excludeFingerprints);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = createRng(baseSeed + attempt * 7919);
    const resolvedType = resolveArrangementType(arrangementType, profile, rng);
    const resolvedDiff =
      !difficulty || String(difficulty).toUpperCase() === "MIXED" || String(difficulty).toUpperCase() === "AUTO"
        ? pickWeightedKey(profile.difficultyWeights, rng)
        : String(difficulty).charAt(0).toUpperCase() + String(difficulty).slice(1).toLowerCase();

    const genFn = ARRANGEMENT_GENERATOR_MAP[resolvedType];
    const enableAttrs = useAttributes !== null ? Boolean(useAttributes) : Boolean(profile.useAttributes);

    const genParams = {
      useAttributes: enableAttrs,
      rng,
    };
    if (resolvedType === ARRANGEMENT_TYPES.LINEAR_SINGLE_ROW) {
      genParams.count = profile.personCount?.linear || 6;
    } else if (
      resolvedType === ARRANGEMENT_TYPES.CIRCULAR_CENTRE ||
      resolvedType === ARRANGEMENT_TYPES.CIRCULAR_OUTSIDE ||
      resolvedType === ARRANGEMENT_TYPES.CIRCULAR_MIXED
    ) {
      genParams.count = profile.personCount?.circular || 6;
    } else if (resolvedType === ARRANGEMENT_TYPES.LINEAR_DOUBLE_ROW) {
      genParams.perRow = profile.personCount?.doubleRowPerRow || 4;
    } else if (resolvedType === ARRANGEMENT_TYPES.PARALLEL_ROWS) {
      genParams.perRow = profile.personCount?.parallelPerRow || 5;
    }

    const built = genFn(genParams);
    if (!built) continue;

    const fingerprint = computeSeatingPuzzleFingerprint(built);
    if (seen.has(fingerprint)) continue;

    const puzzleId = `SEAT_${resolvedType}_${fingerprint.slice(0, 8)}`;
    const questions = buildQuestionsForArrangement({
      puzzleId,
      geometry: built.geometry,
      solvedArrangement: built.solvedArrangement,
      persons: built.persons,
      instructions: built.instructions,
      clueStatements: built.clueStatements,
      attrKey: built.attrKey,
      attributesByPerson: built.attributesByPerson,
      difficulty: resolvedDiff,
      profile,
      questionCount,
      rng,
    });

    if (questions.length < questionCount) continue;

    const candidateSet = {
      puzzleId,
      fingerprint,
      examName: profile.examCode,
      examStage: profile.stage,
      profileKey: profile.profileKey,
      arrangementType: resolvedType,
      arrangementLabel: built.geometry.label,
      difficulty: resolvedDiff,
      puzzleInstructions: built.instructions,
      clueStatements: built.clueStatements,
      persons: built.persons,
      geometry: built.geometry,
      constraints: built.constraints,
      attributesByPerson: built.attributesByPerson,
      // Internal solution metadata (kept separate from student-facing question payloads)
      solutionData: {
        validatedArrangement: built.solvedArrangement,
        positionMetadata: built.geometry.seats.map((seat, idx) => ({
          ...seat,
          person: built.solvedArrangement[idx],
          attributes: built.attributesByPerson?.[built.solvedArrangement[idx]] || null,
        })),
        facingDirections: Object.fromEntries(
          built.solvedArrangement.map((p, idx) => [p, built.geometry.seats[idx].facing])
        ),
        attributeData: built.attributesByPerson,
      },
      questions,
      validationStatus: "VERIFIED",
      generatorVersion: "1.0.0",
    };

    const report = validateSeatingPuzzleSet(candidateSet);
    if (report.valid) {
      // Strip internal _verifyFn before returning
      candidateSet.questions = candidateSet.questions.map(({ _verifyFn, ...cleanQ }) => ({
        ...cleanQ,
        fingerprint: `${fingerprint}_${cleanQ.questionId}`,
      }));
      return candidateSet;
    }
  }

  throw new Error(`Unable to synthesize a unique-solution ${arrangementType} seating puzzle after ${maxAttempts} attempts.`);
}

/**
 * Mode 1: Single independent seating question
 */
export function generateSingleSeatingQuestion(options = {}) {
  const set = generateSeatingPuzzleSet({ ...options, questionCount: 1 });
  return set.questions[0];
}

/**
 * Mode 3: Bulk puzzle set generation with strict structural deduplication
 */
export function generateSeatingBulk({ puzzleCount = 3, ...options } = {}) {
  const sets = [];
  const seen = new Set(options.excludeFingerprints || []);
  const baseSeed = options.seed ?? Date.now();
  for (let i = 0; i < puzzleCount; i++) {
    const set = generateSeatingPuzzleSet({
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
 * Mode 4 & Mode 5 aliases
 */
export const generateExamWiseSeating = (options = {}) => generateSeatingPuzzleSet(options);
export const generateDifficultySeating = (difficulty = "Medium", options = {}) =>
  generateSeatingPuzzleSet({ ...options, difficulty });

/**
 * Mode 6: HHK Engine Router & Mock Test Engine flat question array generator.
 * Preserves shared `passageGroupKey` / `puzzleId` across every 5-question puzzle set!
 */
export function generateSeatingQuestionsForHHK({
  exam = "IBPS-PO",
  stage = "Prelims",
  arrangementType = "AUTO",
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
    const puzzleSet = generateSeatingPuzzleSet({
      exam,
      stage,
      arrangementType,
      difficulty,
      questionCount: chunk,
      seed: baseSeed + setIdx * 3571,
      excludeFingerprints: Array.from(seen),
    });
    seen.add(puzzleSet.fingerprint);

    for (const q of puzzleSet.questions) {
      results.push({
        ...q,
        questionId: q.questionId,
        topic: "Seating Arrangement",
        subType: puzzleSet.arrangementType,
        options: q.optionsArray,
        optionsArray: q.optionsArray,
        correctOptionIndex: q.correctOptionIndex,
        answer: q.correctAnswerValue,
        solutionSteps: [q.explanation],
        generationMode: "RULE_ENGINE",
        passageGroupKey: puzzleSet.puzzleId,
        seatingSetMeta: {
          puzzleId: puzzleSet.puzzleId,
          arrangementType: puzzleSet.arrangementType,
          arrangementLabel: puzzleSet.arrangementLabel,
        },
      });
    }
    remaining -= puzzleSet.questions.length;
    setIdx++;
  }

  return results.slice(0, count);
}

/**
 * Unified Reasoning Ability Subject Generator Registry Adapter
 * Connects BOTH Blood Relations AND Seating Arrangement to the central Exam-Wise Mock Test Creator!
 */
export function createReasoningRegistryAdapter() {
  return {
    subjectKey: "reasoning",
    displayName: "Reasoning Ability",
    status: "ACTIVE",
    version: "1.1.0",
    supportedTopics: ["Blood Relations", "Seating Arrangement"],
    plannedTopics: ["Puzzles", "Syllogism", "Inequality", "Coding-Decoding", "Direction & Distance"],
    notes: "Backed by HHK Deterministic Blood Relations (Categories A–J) & Seating Arrangement (10 CSP-verified geometries).",

    supportsTopic(topicName = "") {
      const norm = String(topicName || "").trim().toLowerCase();
      return norm.includes("blood relation") || norm.includes("seating");
    },

    getAvailableCount({ topic = "" } = {}) {
      if (!topic || this.supportsTopic(topic)) return Number.POSITIVE_INFINITY;
      return 0;
    },

    generateQuestions({
      topic = "Seating Arrangement",
      subtopic = "",
      difficulty = "MIXED",
      count = 5,
      examCode = "IBPS-PO",
      stageName = "Prelims",
      excludeFingerprints = [],
      seed = null,
    }) {
      const norm = String(topic || "").trim().toLowerCase();

      if (norm.includes("seating")) {
        const raw = generateSeatingQuestionsForHHK({
          exam: examCode,
          stage: stageName,
          arrangementType: subtopic || "AUTO",
          difficulty,
          count,
          seed,
          excludeFingerprints,
        });
        const formatted = raw.map((q) => {
          const keys = ["A", "B", "C", "D", "E"];
          return {
            questionId: q.questionId,
            puzzleId: q.puzzleId,
            passageGroupKey: q.passageGroupKey,
            subjectKey: "reasoning",
            topicName: "Seating Arrangement",
            subtopicName: q.subtopicName,
            difficulty: q.difficulty,
            questionType: "mcq",
            questionText: q.questionText,
            options: q.optionsArray.map((text, idx) => ({ key: keys[idx], text })),
            correctAnswer: q.correctOption,
            explanation: q.explanation,
            fingerprint: q.fingerprint,
            estimatedTimeSeconds: q.estimatedTimeSeconds,
            generatorVersion: "1.0.0",
            generatorSource: "HHK_SEATING_ENGINE_V1",
          };
        });
        return {
          questions: formatted,
          metadata: {
            subjectKey: "reasoning",
            topic: "Seating Arrangement",
            requested: count,
            generated: formatted.length,
          },
        };
      }

      if (norm.includes("blood relation")) {
        const batch = generateBloodRelationsBatch({
          exam: examCode,
          stage: stageName,
          difficulty,
          count,
          seed,
          excludeFingerprints,
        });
        const formatted = batch.questions.map((q) => {
          const keys = ["A", "B", "C", "D", "E"];
          return {
            questionId: q.questionId,
            subjectKey: "reasoning",
            topicName: "Blood Relations",
            subtopicName: q.sub_type,
            difficulty: String(q.difficulty || "medium").toLowerCase(),
            questionType: "mcq",
            questionText: q.questionText,
            options: q.optionsArray.map((text, idx) => ({ key: keys[idx], text })),
            correctAnswer: q.correct_answer,
            explanation: q.solutionSteps.join(" → "),
            fingerprint: q.fingerprint,
            familyTreeData: q.familyTreeData,
            estimatedTimeSeconds: q.estimatedTimeSeconds,
            generatorVersion: "1.0.0",
            generatorSource: "HHK_BLOOD_RELATIONS_ENGINE_V1",
          };
        });
        return {
          questions: formatted,
          metadata: {
            subjectKey: "reasoning",
            topic: "Blood Relations",
            requested: count,
            generated: formatted.length,
          },
        };
      }

      return {
        questions: [],
        metadata: {
          subjectKey: "reasoning",
          topic,
          requested: count,
          generated: 0,
          error: `Reasoning topic "${topic}" is not built yet. Currently active: Blood Relations, Seating Arrangement.`,
        },
      };
    },
  };
}

export { ARRANGEMENT_TYPES, SEATING_EXAM_PROFILES };
export default generateSeatingPuzzleSet;