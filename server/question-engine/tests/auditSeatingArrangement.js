// Place at: server/question-engine/tests/auditSeatingArrangement.js

/**
 * Comprehensive Automated Audit Suite for HHK Exam-Wise Seating Arrangement Generator
 *
 * Verifies:
 *  1. Known-answer geometry & directional fixtures for ALL 10 arrangement types
 *     (North vs South, Centre vs Outside, Mixed facing, Square, Rectangle, Triangle no-opposite,
 *      Hexagon opposite, Double Row & Parallel Row)
 *  2. CSP Solver integrity: 0-solution contradiction detection, >=2-solution ambiguity detection,
 *     rotational symmetry canonicalization, and exact 1-solution uniqueness proof
 *  3. Live generation + independent CSP re-validation across ALL 10 arrangement categories
 *  4. Live generation across ALL 12 banking exam profiles (including attributes on PO/Mains)
 *  5. Structural duplicate detection, shared puzzle-set integrity (`puzzleId`/`passageGroupKey`),
 *     Engine Router integration, and Exam-Wise Mock Test Creator integration
 */

import assert from "node:assert/strict";
import {
  ARRANGEMENT_TYPES,
  createLinearSingleRowGeometry,
  createLinearDoubleRowGeometry,
  createCircularCentreGeometry,
  createCircularOutsideGeometry,
  createCircularMixedGeometry,
  createSquareGeometry,
  createRectangularGeometry,
  createTriangularGeometry,
  createHexagonalGeometry,
  createParallelRowsGeometry,
} from "../generators/reasoning/seatingArrangement/seatingGeometry.js";
import { solveSeatingCSP } from "../generators/reasoning/seatingArrangement/seatingSolver.js";
import { SEATING_EXAM_PROFILES } from "../generators/reasoning/seatingArrangement/seatingExamProfiles.js";
import { validateSeatingPuzzleSet } from "../generators/reasoning/seatingArrangement/seatingQuestionBuilder.js";
import {
  generateSingleSeatingQuestion,
  generateSeatingPuzzleSet,
  generateSeatingBulk,
  generateSeatingQuestionsForHHK,
  createReasoningRegistryAdapter,
} from "../generators/reasoning/seatingArrangement/index.js";
import { generateFromQuestionEngine } from "../core/engineRouter.js";
import { SubjectGeneratorRegistry } from "../../exam-engine/subjectGeneratorRegistry.js";
import { generateIntelligentExamWiseMockTest } from "../../exam-engine/intelligentMockTestEngine.js";

console.log("=== HHK Seating Arrangement Generator — Comprehensive Audit ===\n");

// ============================================================================
// PART 1: KNOWN-ANSWER GEOMETRY & DIRECTIONAL FIXTURES (ALL 10 MODELS)
// ============================================================================
console.log("1. Verifying Geometry & Directional Fixtures (All 10 Models)...");

// 1A. Linear Single Row: North vs South left/right reversal
{
  const north = createLinearSingleRowGeometry({ count: 5, facing: "NORTH" });
  const south = createLinearSingleRowGeometry({ count: 5, facing: "SOUTH" });
  assert.equal(north.stepLeft(2, 1), 1);
  assert.equal(north.stepRight(2, 1), 3);
  assert.equal(south.stepLeft(2, 1), 3, "Facing South must invert Left to +1");
  assert.equal(south.stepRight(2, 1), 1, "Facing South must invert Right to -1");
  assert.equal(north.getExtremeLeftEnd(), 0);
  assert.equal(south.getExtremeLeftEnd(), 4);
}

// 1B. Circular Centre vs Circular Outside (strictly opposite directions!)
{
  const centre = createCircularCentreGeometry({ count: 6 });
  const outside = createCircularOutsideGeometry({ count: 6 });
  assert.equal(centre.stepLeft(0, 1), 1, "Centre facing: Left = Clockwise (+1)");
  assert.equal(centre.stepRight(0, 1), 5, "Centre facing: Right = Anticlockwise (-1)");
  assert.equal(outside.stepLeft(0, 1), 5, "Outside facing: Left = Anticlockwise (-1)");
  assert.equal(outside.stepRight(0, 1), 1, "Outside facing: Right = Clockwise (+1)");
  assert.equal(centre.getOpposite(1), 4);
}

// 1C. Circular Mixed Facing (per-seat individual direction!)
{
  const mixed = createCircularMixedGeometry({ count: 6, facings: ["IN", "OUT", "IN", "OUT", "IN", "OUT"] });
  assert.equal(mixed.stepLeft(0, 1), 1, "Seat 0 faces IN -> Left is +1");
  assert.equal(mixed.stepLeft(1, 1), 0, "Seat 1 faces OUT -> Left is -1");
  assert.equal(mixed.stepRight(1, 1), 2, "Seat 1 faces OUT -> Right is +1");
}

// 1D. Square (corners vs sides) & Rectangular (long vs short sides)
{
  const sq = createSquareGeometry({ cornerFacing: "IN", sideFacing: "OUT" });
  assert.equal(sq.seats[0].posType, "CORNER");
  assert.equal(sq.seats[1].posType, "SIDE");
  assert.equal(sq.getOpposite(0), 4);
  const rect = createRectangularGeometry({ cornerFacing: "IN", sideFacing: "IN" });
  assert.equal(rect.seats[1].posType, "LONG_SIDE");
  assert.equal(rect.seats[3].posType, "SHORT_SIDE");
}

// 1E. Triangular (NO circular opposite!) & Hexagonal (exact opposite (i+3)%6)
{
  const tri = createTriangularGeometry();
  assert.equal(tri.supportsOpposite, false, "Triangle must NOT support circular opposite");
  assert.equal(tri.getOpposite(0), null);
  const hex = createHexagonalGeometry({ facing: "IN" });
  assert.equal(hex.supportsOpposite, true);
  assert.equal(hex.getOpposite(2), 5);
}

// 1F. Double Row & Parallel Rows (opposite + diagonal opposite + facing-relative left/right)
{
  const dbl = createLinearDoubleRowGeometry({ perRow: 4, facingMode: "FACING_EACH_OTHER" });
  assert.equal(dbl.getOpposite(0), 4);
  assert.equal(dbl.getDiagonalOpposite(0), 7);
  assert.equal(dbl.stepLeft(0, 1), 1, "Row 1 faces South -> Left is col+1");
  assert.equal(dbl.stepLeft(4, 1), null, "Row 2 Seat 0 faces North -> Left is out of bounds");
  const par = createParallelRowsGeometry({ perRow: 5, facingMode: "FACING_EACH_OTHER" });
  assert.equal(par.getOpposite(2), 7);
  assert.equal(par.getDiagonalOpposite(0), 9);
}

console.log("   [PASS] All 10 geometry & directional models verified.\n");

// ============================================================================
// PART 2: CSP SOLVER — CONTRADICTION, AMBIGUITY & SYMMETRY CHECKS
// ============================================================================
console.log("2. Verifying CSP Solver (0-Solution, Multiple-Solution & Rotational Symmetry)...");

// 2A. Contradictory clues -> NO_SOLUTION
{
  const g = createLinearSingleRowGeometry({ count: 4, facing: "NORTH" });
  const res = solveSeatingCSP({
    geometry: g,
    persons: ["A", "B", "C", "D"],
    constraints: [
      { type: "EXTREME_LEFT", person: "A" },
      { type: "RELATIVE_SHIFT", personA: "B", personB: "A", direction: "LEFT", steps: 1 }, // impossible: A is at extreme left!
    ],
  });
  assert.equal(res.status, "NO_SOLUTION");
  assert.equal(res.solutionCount, 0);
}

// 2B. Under-constrained clues -> MULTIPLE_SOLUTIONS
{
  const g = createLinearSingleRowGeometry({ count: 4, facing: "NORTH" });
  const res = solveSeatingCSP({
    geometry: g,
    persons: ["A", "B", "C", "D"],
    constraints: [{ type: "EXTREME_LEFT", person: "A" }],
    maxSolutions: 2,
  });
  assert.equal(res.status, "MULTIPLE_SOLUTIONS");
  assert.equal(res.unique, false);
}

// 2C. Rotational equivalence on Circular Centre (exact 1 canonical solution)
{
  const g = createCircularCentreGeometry({ count: 4 });
  const res = solveSeatingCSP({
    geometry: g,
    persons: ["A", "B", "C", "D"],
    constraints: [
      { type: "RELATIVE_SHIFT", personA: "B", personB: "A", direction: "LEFT", steps: 1 },
      { type: "OPPOSITE", personA: "C", personB: "A" },
    ],
    maxSolutions: 2,
  });
  assert.equal(res.unique, true, "Fixed clockwise cyclic order must yield 1 unique canonical solution");
  assert.equal(res.solutionCount, 1);
}

console.log("   [PASS] CSP contradiction, ambiguity, and symmetry canonicalization verified.\n");

// ============================================================================
// PART 3: LIVE GENERATION & INDEPENDENT CSP AUDIT ACROSS ALL 10 CATEGORIES
// ============================================================================
console.log("3. Auditing Live Generation Across ALL 10 Arrangement Categories...");
let totalPuzzles = 0;
let totalQuestions = 0;

for (const arrType of Object.values(ARRANGEMENT_TYPES)) {
  const puzzle = generateSeatingPuzzleSet({
    exam: "IBPS-PO",
    stage: "Prelims",
    arrangementType: arrType,
    questionCount: 5,
    seed: 1000 + totalPuzzles * 137,
  });

  // Independent CSP re-check (re-validating from scratch!)
  const check = validateSeatingPuzzleSet(puzzle);
  assert.equal(check.valid, true, `${arrType} failed independent CSP validation: ${check.errors?.join("; ")}`);
  assert.equal(puzzle.questions.length, 5, `${arrType} must emit 5 linked questions`);
  const sharedIds = new Set(puzzle.questions.map((q) => q.passageGroupKey));
  assert.equal(sharedIds.size, 1, `${arrType}: all 5 questions must share one passageGroupKey`);

  totalPuzzles++;
  totalQuestions += puzzle.questions.length;
}
console.log(`   [PASS] All 10 categories passed independent CSP verification (${totalPuzzles} puzzles, ${totalQuestions} questions, 0 errors).\n`);

// ============================================================================
// PART 4: ALL 12 BANKING EXAM PROFILES + ATTRIBUTES + BULK DEDUP
// ============================================================================
console.log("4. Auditing All 12 Banking Exam Profiles, Attributes & Bulk Deduplication...");
const profileKeys = Object.keys(SEATING_EXAM_PROFILES);
assert.equal(profileKeys.length, 12);

for (const key of profileKeys) {
  const prof = SEATING_EXAM_PROFILES[key];
  const puzzle = generateSeatingPuzzleSet({
    exam: prof.examCode,
    stage: prof.stage,
    questionCount: 5,
    seed: 4000 + key.length * 41,
  });
  assert.equal(puzzle.profileKey, key);
  assert.equal(puzzle.questions.length, 5);
  if (prof.useAttributes) {
    assert.ok(Object.keys(puzzle.attributesByPerson).length > 0, `${key} should attach attributes`);
  }
  totalPuzzles++;
  totalQuestions += puzzle.questions.length;
}

// Bulk structural deduplication check
const bulk = generateSeatingBulk({ exam: "IBPS-CLERK", stage: "Prelims", puzzleCount: 3, questionCount: 3, seed: 8080 });
assert.equal(bulk.length, 3);
assert.equal(new Set(bulk.map((p) => p.fingerprint)).size, 3, "Bulk generation must yield 3 structurally distinct puzzles");

// Mode 1: Single question
const single = generateSingleSeatingQuestion({ exam: "IBPS-RRB-OA", stage: "Prelims", seed: 55 });
assert.ok(single && single.options.length === 5);

console.log(`   [PASS] All 12 exam profiles, attributes, and bulk dedup verified.\n`);

// ============================================================================
// PART 5: ENGINE ROUTER + MOCK TEST ENGINE INTEGRATION (SHARED PUZZLE SETS)
// ============================================================================
console.log("5. Verifying Engine Router & Centralized Exam-Wise Mock Test Integration...");

// Engine Router check
const routerQs = generateFromQuestionEngine({
  examCode: "IBPS-PO",
  stageName: "Prelims",
  topicName: "Seating Arrangement",
  subtopicName: "Circular Arrangement",
  difficulty: "medium",
  count: 5,
  optionCount: 5,
});
assert.equal(routerQs.length, 5);
assert.ok(routerQs.every((q) => q.options.length === 5 && q.topicName === "Seating Arrangement"));

// Mock Test Engine integration with combined Reasoning adapter (Blood Relations + Seating Arrangement!)
const reg = new SubjectGeneratorRegistry();
reg.register(createReasoningRegistryAdapter());

const reasoningPattern = {
  examCode: "IBPS-PO",
  examName: "IBPS PO",
  stageName: "Prelims",
  totalQuestions: 10,
  totalMarks: 10,
  durationSeconds: 600,
  sectionalTimingEnabled: true,
  negativeMarkingRatio: 0.25,
  optionCount: 5,
  shortagePolicy: "FAIL_STRICT",
  sections: [
    {
      sectionName: "Reasoning Ability",
      subjectKey: "reasoning",
      questionCount: 10,
      marksPerQuestion: 1,
      negativeMarks: 0.25,
      durationSeconds: 600,
      difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
      topicDistributions: [
        { topic: "Seating Arrangement", minQuestions: 5, maxQuestions: 5, defaultQuestions: 5, weight: 50, priority: 1, enabled: true },
        { topic: "Blood Relations", minQuestions: 5, maxQuestions: 5, defaultQuestions: 5, weight: 50, priority: 1, enabled: true },
      ],
    },
  ],
};

const mockRes = await generateIntelligentExamWiseMockTest({
  pattern: reasoningPattern,
  registry: reg,
  seed: 2026,
});
assert.equal(mockRes.patternFulfilled, true, "Mock Test Engine should fulfill 5 Seating + 5 Blood Relations = 10/10");
assert.equal(mockRes.mockTest.totalQuestions, 10);

console.log("   [PASS] Engine Router & Exam-Wise Mock Test Integration verified!\n");
console.log(`=== AUDIT COMPLETE: ${totalPuzzles} CSP-verified puzzles (${totalQuestions} questions) + 10 geometry fixtures passed. Total Errors: 0 ===`);