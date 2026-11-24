// Place at: server/question-engine/generators/reasoning/bloodRelations/index.js

/**
 * HHK Exam-Wise Blood Relations Question Generator — Unified Entry Module
 *
 * Supports all 5 generation modes:
 *  - Mode 1: generateSingleBloodRelationsQuestion()
 *  - Mode 2: generateBloodRelationsBatch() (Bulk)
 *  - Mode 3: generateExamWiseBloodRelations() (12 exam-specific profiles + admin overrides)
 *  - Mode 4: generateDifficultyBloodRelations() (Easy / Medium / Hard)
 *  - Mode 5: createBloodRelationsRegistryAdapter() (Plugs directly into SubjectGeneratorRegistry)
 */

import { runVerifiedTemplateBatch, normalizeDifficulty } from "../../../core/batchUtils.js";
import {
  resolveBloodRelationsProfile,
  BLOOD_RELATIONS_CATEGORIES,
  BLOOD_RELATIONS_EXAM_PROFILES,
} from "./bloodRelationsExamProfiles.js";
import {
  createRng,
  validateBloodRelationsQuestion,
  computeBloodRelationsFingerprint,
} from "./bloodRelationsValidator.js";
import { BLOOD_RELATIONS_TEMPLATES_PART_1 } from "./bloodRelationsTemplatesPart1.js";
import { BLOOD_RELATIONS_TEMPLATES_PART_2 } from "./bloodRelationsTemplatesPart2.js";

export const ALL_BLOOD_RELATIONS_TEMPLATES = [
  ...BLOOD_RELATIONS_TEMPLATES_PART_1,
  ...BLOOD_RELATIONS_TEMPLATES_PART_2,
];

const formatBloodRelationsSolutionSteps = (raw) => [
  `Given: ${raw.solution.given_data.join("; ")}`,
  `Method: ${raw.solution.formula}`,
  ...raw.solution.steps,
  `Final Answer: ${raw.solution.final_answer}`,
];

function pickDifficultyFromProfile(difficultyWeights, rng) {
  const entries = [
    ["Easy", Number(difficultyWeights?.Easy ?? 30)],
    ["Medium", Number(difficultyWeights?.Medium ?? 50)],
    ["Hard", Number(difficultyWeights?.Hard ?? 20)],
  ];
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return "Medium";
  let r = rng.random() * total;
  for (const [label, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return label;
  }
  return "Medium";
}

/**
 * Mode 2 & Mode 3 & Mode 4: Exam-Wise / Bulk / Difficulty-Wise Batch Generator
 */
export function generateBloodRelationsBatch({
  exam = "IBPS-PO",
  stage = "Prelims",
  difficulty = "AUTO",
  count = 5,
  allowedCategories = null,
  templateId = null,
  seed = null,
  excludeFingerprints = [],
  adminProfileOverride = null,
} = {}) {
  const profile = resolveBloodRelationsProfile(exam, stage, adminProfileOverride);
  const masterRng = createRng(
    seed !== null && seed !== undefined
      ? seed
      : Date.now() ^ Math.floor(Math.random() * 1e9)
  );

  const enabledCategories =
    Array.isArray(allowedCategories) && allowedCategories.length > 0
      ? allowedCategories
      : Object.entries(profile.categoryWeights)
          .filter(([, w]) => Number(w) > 0)
          .map(([cat]) => cat);

  const isMixedOrAuto =
    !difficulty ||
    String(difficulty).toUpperCase() === "AUTO" ||
    String(difficulty).toUpperCase() === "MIXED";

  // If fixed difficulty requested, run a single verified batch call
  if (!isMixedOrAuto) {
    const res = runVerifiedTemplateBatch({
      topic: "Blood Relations",
      allTemplates: ALL_BLOOD_RELATIONS_TEMPLATES,
      categoryWeights: profile.categoryWeights,
      defaultWeight: 10,
      maxAttemptsMultiplier: 35,
      minAttempts: 120,
      createRng,
      validateQuestion: validateBloodRelationsQuestion,
      computeFingerprint: computeBloodRelationsFingerprint,
      formatSolutionSteps: formatBloodRelationsSolutionSteps,
      stringifyAnswer: true,
      count,
      difficulty: normalizeDifficulty(difficulty),
      exam: `${profile.examCode}_${profile.stage.toUpperCase()}`,
      allowedCategories: enabledCategories,
      templateId,
      seed: masterRng.seed,
      excludeFingerprints,
    });

    return {
      ...res,
      questions: res.questions.map((q) => enrichWithBloodRelationsMetadata(q, profile)),
      meta: { ...res.meta, profileKey: profile.profileKey },
    };
  }

  // Exam-wise MIXED/AUTO mode: sample each question's difficulty from the exam profile
  const collected = [];
  const seen = new Set(excludeFingerprints);
  const allRejected = [];
  let totalAttempts = 0;

  for (let i = 0; i < count; i++) {
    const pickedDiff = pickDifficultyFromProfile(profile.difficultyWeights, masterRng);
    const single = runVerifiedTemplateBatch({
      topic: "Blood Relations",
      allTemplates: ALL_BLOOD_RELATIONS_TEMPLATES,
      categoryWeights: profile.categoryWeights,
      defaultWeight: 10,
      maxAttemptsMultiplier: 40,
      minAttempts: 80,
      createRng,
      validateQuestion: validateBloodRelationsQuestion,
      computeFingerprint: computeBloodRelationsFingerprint,
      formatSolutionSteps: formatBloodRelationsSolutionSteps,
      stringifyAnswer: true,
      count: 1,
      difficulty: pickedDiff,
      exam: `${profile.examCode}_${profile.stage.toUpperCase()}`,
      allowedCategories: enabledCategories,
      templateId,
      seed: masterRng.int(1, 1e9),
      excludeFingerprints: Array.from(seen),
    });

    totalAttempts += single.meta.attempts;
    allRejected.push(...single.rejectedLogs);

    if (single.questions[0]) {
      const q = enrichWithBloodRelationsMetadata(single.questions[0], profile);
      seen.add(q.fingerprint);
      collected.push(q);
    }
  }

  return {
    questions: collected,
    meta: {
      requested: count,
      generated: collected.length,
      attempts: totalAttempts,
      rejectedCount: allRejected.length,
      seed: masterRng.seed,
      difficulty: "MIXED",
      profileKey: profile.profileKey,
    },
    rejectedLogs: allRejected,
  };
}

function enrichWithBloodRelationsMetadata(q, profile) {
  return {
    ...q,
    subject: "Reasoning Ability",
    subjectKey: "reasoning",
    examName: profile.examCode,
    examStage: profile.stage,
    estimatedTimeSeconds: profile.estimatedTimeSeconds,
    familyTreeData: q.validation?.familyTreeData || null,
    generatorVersion: "1.0.0",
    validationStatus: q.validation?.solverVerified ? "VERIFIED" : "UNVERIFIED",
  };
}

/**
 * Mode 1: Single Question Generator
 */
export function generateSingleBloodRelationsQuestion(options = {}) {
  const res = generateBloodRelationsBatch({ ...options, count: 1 });
  return res.questions[0] || null;
}

/**
 * Mode 3: Exam-Wise Alias
 */
export function generateExamWiseBloodRelations(options = {}) {
  return generateBloodRelationsBatch({ ...options, difficulty: options.difficulty || "MIXED" });
}

/**
 * Mode 4: Difficulty-Wise Alias
 */
export function generateDifficultyBloodRelations(difficulty = "Medium", options = {}) {
  return generateBloodRelationsBatch({ ...options, difficulty });
}

/**
 * Mode 5: Adapter for HHK Centralized SubjectGeneratorRegistry
 */
export function createBloodRelationsRegistryAdapter() {
  return {
    subjectKey: "reasoning",
    displayName: "Reasoning Ability",
    status: "ACTIVE",
    version: "1.0.0",
    supportedTopics: ["Blood Relations"],
    plannedTopics: ["Puzzles", "Seating Arrangement", "Syllogism", "Inequality", "Coding-Decoding", "Direction & Distance"],
    notes: "Backed by HHK Deterministic Family Graph Blood Relations Generator (Categories A–J, 12 exam profiles).",

    supportsTopic(topicName = "") {
      const norm = String(topicName || "").trim().toLowerCase();
      return norm.includes("blood relation");
    },

    getAvailableCount({ topic = "" } = {}) {
      if (!topic || this.supportsTopic(topic)) return Number.POSITIVE_INFINITY;
      return 0;
    },

    generateQuestions({
      topic = "Blood Relations",
      difficulty = "MIXED",
      count = 5,
      examCode = "IBPS-PO",
      stageName = "Prelims",
      excludeFingerprints = [],
      seed = null,
    }) {
      if (!this.supportsTopic(topic)) {
        return {
          questions: [],
          metadata: {
            subjectKey: "reasoning",
            topic,
            requested: count,
            generated: 0,
            error: `Reasoning topic "${topic}" is not built yet. Currently supported: Blood Relations.`,
          },
        };
      }

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
        const options = q.optionsArray.map((text, idx) => ({ key: keys[idx], text }));
        return {
          questionId: q.questionId,
          subjectKey: "reasoning",
          topicName: "Blood Relations",
          subtopicName: q.sub_type,
          difficulty: String(q.difficulty || "medium").toLowerCase(),
          questionType: "mcq",
          questionText: q.questionText,
          options,
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
          profileKey: batch.meta.profileKey,
        },
      };
    },
  };
}

export { BLOOD_RELATIONS_CATEGORIES, BLOOD_RELATIONS_EXAM_PROFILES };
export default generateBloodRelationsBatch;