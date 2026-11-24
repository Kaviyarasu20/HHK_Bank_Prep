/**
 * HHK Floor Arrangement Puzzle API Routes
 *
 * Generates CSP-verified Floor Arrangement reasoning questions (IBPS PO / Clerk,
 * SBI PO / Clerk, IBPS RRB) and returns them as JSON.
 *
 * Mounted at /api/puzzles/floor  (public, no admin required for generation)
 */

import { Router } from "express";
import { z } from "zod";
import {
  generateFloorPuzzleSet,
  generateFloorQuestionsForHHK,
  createFloorRegistryAdapter,
  FLOOR_PUZZLE_TYPES,
} from "../question-engine/generators/reasoning/floorArrangement/index.js";
import { generateFromQuestionEngine } from "../question-engine/core/engineRouter.js";

export const floorPuzzlesRouter = Router();

const PuzzleTypeSchema = z.enum([
  "SINGLE_BUILDING",
  "MULTI_BUILDING",
  "FLOOR_FLAT",
  "PROFESSIONS",
  "MULTI_VARIABLE",
  "AUTO",
]);

const DifficultySchema = z.enum(["Easy", "Medium", "Hard", "VeryDifficult", "MIXED", "AUTO"]);

const generateSchema = z.object({
  exam: z.string().trim().min(1).max(40).default("IBPS-PO"),
  stage: z.string().trim().min(1).max(40).default("Prelims"),
  puzzleType: PuzzleTypeSchema.default("AUTO"),
  difficulty: DifficultySchema.default("MIXED"),
  questionCount: z.number().int().min(1).max(8).default(5),
  seed: z.number().int().optional(),
});

/**
 * GET /api/puzzles/floor/types
 * List supported floor puzzle types and difficulties.
 */
floorPuzzlesRouter.get("/types", (_req, res) => {
  res.json({
    puzzleTypes: Object.values(FLOOR_PUZZLE_TYPES),
    difficulties: ["Easy", "Medium", "Hard", "VeryDifficult", "MIXED"],
    defaultQuestionCount: 5,
    optionCount: 5,
    description:
      "Floor-based arrangement reasoning questions for IBPS PO, IBPS Clerk, SBI PO, SBI Clerk and IBPS RRB.",
  });
});

/**
 * POST /api/puzzles/floor/generate
 * Generate one complete, CSP-verified floor arrangement puzzle set + 5 MCQs.
 * Returns JSON including the verified solution (for admin/answer-key use) and
 * the student-facing question payloads.
 */
floorPuzzlesRouter.post("/generate", validate(generateSchema), (req, res) => {
  const { exam, stage, puzzleType, difficulty, questionCount, seed } = req.validated || req.body;
  try {
    const set = generateFloorPuzzleSet({
      exam,
      stage,
      puzzleType: puzzleType === "AUTO" ? undefined : puzzleType,
      difficulty: difficulty === "MIXED" || difficulty === "AUTO" ? "MIXED" : difficulty,
      questionCount,
      seed,
    });

    // Student-facing payload (strip internal solution metadata)
    const questionsPayload = set.questions.map((q) => ({
      questionId: q.questionId,
      puzzleId: q.puzzleId,
      passageGroupKey: q.puzzleId,
      topicName: "Floor Arrangement",
      subtopicName: q.subtopicName,
      difficulty: q.difficulty,
      questionType: "mcq",
      questionText: q.questionText,
      options: q.options.map((o) => ({ key: o.key, text: o.text })),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      estimatedTimeSeconds: q.estimatedTimeSeconds,
      generatorVersion: q.generatorVersion,
    }));

    res.json({
      status: "ok",
      puzzle: {
        puzzleId: set.puzzleId,
        fingerprint: set.fingerprint,
        exam: set.examName,
        stage: set.examStage,
        puzzleType: set.puzzleType,
        puzzleLabel: set.puzzleLabel,
        difficulty: set.difficulty,
        clueStatements: set.clueStatements,
        persons: set.persons,
        questionCount: set.questions.length,
        validationStatus: set.validationStatus,
        generatorVersion: set.generatorVersion,
      },
      questions: questionsPayload,
      // Full verified solution (answer key) — include for admin/preview; omit in student mode via ?student=1
      ...(req.query.student !== "1"
        ? {
            answerKey: {
              solution: set.solutionData.positionMetadata.map((p) => ({
                person: p.person,
                floor: p.floor,
                building: p.building || null,
                flat: p.flat || null,
                attributes: p.attributes || null,
              })),
              constraints: set.constraints,
              attributesByPerson: set.attributesByPerson,
            },
          }
        : {}),
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message || "Failed to generate puzzle." });
  }
});

/**
 * POST /api/puzzles/floor/batch
 * Generate multiple floor puzzle sets (bulk).
 */
floorPuzzlesRouter.post("/batch", validate(generateSchema), (req, res) => {
  const { exam, stage, puzzleType, difficulty, questionCount, seed } =
    req.validated || req.body;
  const count = Number(req.body.puzzleCount || 3);
  try {
    const sets = [];
    const seen = [];
    const baseSeed = seed ?? Date.now();
    for (let i = 0; i < count; i++) {
      const set = generateFloorPuzzleSet({
        exam,
        stage,
        puzzleType: puzzleType === "AUTO" ? undefined : puzzleType,
        difficulty: difficulty === "MIXED" || difficulty === "AUTO" ? "MIXED" : difficulty,
        questionCount,
        seed: baseSeed + i * 1009,
        excludeFingerprints: seen,
      });
      seen.push(set.fingerprint);
      sets.push({
        puzzleId: set.puzzleId,
        fingerprint: set.fingerprint,
        puzzleType: set.puzzleType,
        difficulty: set.difficulty,
        clueStatements: set.clueStatements,
        questions: set.questions.map((q) => ({
          questionId: q.questionId,
          questionText: q.questionText,
          options: q.options.map((o) => ({ key: o.key, text: o.text })),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
      });
    }
    res.json({ status: "ok", count: sets.length, puzzles: sets });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message || "Failed to generate batch." });
  }
});

/**
 * GET /api/puzzles/floor/engine
 * Generate via the central Question Engine (engineRouter) — returns questions in
 * the standard HHK question record format used by mock tests / practice.
 */
floorPuzzlesRouter.post("/engine", validate(generateSchema), (req, res) => {
  const { exam, stage, puzzleType, difficulty, questionCount, seed } =
    req.validated || req.body;
  try {
    const questions = generateFromQuestionEngine({
      examCode: exam,
      stageName: stage,
      topicName: "Floor Arrangement",
      subtopicName: puzzleType === "AUTO" ? "" : puzzleType,
      difficulty: difficulty === "MIXED" || difficulty === "AUTO" ? "MEDIUM" : difficulty,
      count: questionCount,
      optionCount: 5,
    });
    res.json({ status: "ok", count: questions.length, questions });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message || "Engine generation failed." });
  }
});

// Lightweight request validation middleware (zod) local to this router
function validate(schema) {
  return (req, res, next) => {
    try {
      req.validated = schema.parse({
        ...req.body,
        ...(req.query.seed !== undefined ? { seed: Number(req.query.seed) } : {}),
      });
      next();
    } catch (err) {
      res
        .status(400)
        .json({ status: "error", error: err.errors ? err.errors.map((e) => e.message).join("; ") : err.message });
    }
  };
}
