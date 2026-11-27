import { generateSeatingQuestionsForHHK } from "../seatingArrangement/index.js";
import { generateFloorPuzzleSet } from "../floorArrangement/index.js";
import { createPuzzleRng } from "./cspSolver.js";
import { generateBoxPuzzleSet } from "./boxPuzzle.js";
import { generateDaySchedulingSet } from "./dayScheduling.js";
import { generateMonthSchedulingSet } from "./monthScheduling.js";
import { generateComparisonPuzzleSet } from "./comparisonPuzzle.js";
import { generateDistributionPuzzleSet } from "./distributionPuzzle.js";
import { generateSchedulingPuzzleSet } from "./schedulingPuzzle.js";
import { generateHybridPuzzleSet } from "./hybridPuzzle.js";

/**
 * HHK Unified Banking Puzzles Orchestrator (10 Real-Exam Puzzle Families)
 *
 * Reuses existing audited engines without duplication:
 *  1. Linear Seating Arrangement   -> seatingArrangement/ (LINEAR_SINGLE_ROW / LINEAR_DOUBLE_ROW)
 *  2. Circular Seating Arrangement -> seatingArrangement/ (CIRCULAR_CENTRE / CIRCULAR_MIXED)
 *  3. Floor-Based Puzzles          -> floorArrangement/
 * Plus 7 CSP-verified unique-solution puzzle generators:
 *  4. Box-Based Puzzles            -> boxPuzzle.js
 *  5. Day-Based Scheduling         -> dayScheduling.js
 *  6. Month-Based Scheduling       -> monthScheduling.js (30/31-day & Month+2-Date)
 *  7. Comparison-Based Puzzles     -> comparisonPuzzle.js
 *  8. Distribution-Based Puzzles   -> distributionPuzzle.js
 *  9. Scheduling-Based Puzzles     -> schedulingPuzzle.js (Designation & Year/Age)
 * 10. Hybrid Puzzles               -> hybridPuzzle.js (Multi-variable PO Mains)
 */

export const ALL_PUZZLE_FAMILIES = [
  "Linear Seating Arrangement",
  "Circular Seating Arrangement",
  "Floor-Based Puzzles",
  "Box-Based Puzzles",
  "Day-Based Scheduling",
  "Month-Based Scheduling",
  "Comparison-Based Puzzles",
  "Distribution-Based Puzzles",
  "Scheduling-Based Puzzles",
  "Hybrid Puzzles",
];

function normalizeDiffLabel(difficulty) {
  const d = String(difficulty || "Medium").trim().toLowerCase();
  if (d === "easy") return "Easy";
  if (d === "hard") return "Hard";
  return "Medium";
}

function resolveRequestedFamily(subtopicName = "") {
  const s = String(subtopicName || "").trim().toLowerCase();
  if (!s || s === "auto" || s === "all" || s === "mixed" || s === "puzzles") return null;
  if (s.includes("linear")) return "Linear Seating Arrangement";
  if (s.includes("circular")) return "Circular Seating Arrangement";
  if (s.includes("floor")) return "Floor-Based Puzzles";
  if (s.includes("box")) return "Box-Based Puzzles";
  if (s.includes("day")) return "Day-Based Scheduling";
  if (s.includes("month")) return "Month-Based Scheduling";
  if (s.includes("compar")) return "Comparison-Based Puzzles";
  if (s.includes("distribut")) return "Distribution-Based Puzzles";
  if (s.includes("hybrid")) return "Hybrid Puzzles";
  if (s.includes("schedul") || s.includes("designat") || s.includes("year")) return "Scheduling-Based Puzzles";
  return null;
}

function generateOneFamilySet({ family, exam, stage, difficulty, countNeeded, rng }) {
  const setSize = Math.min(5, Math.max(1, countNeeded));
  const childSeed = rng.int(1, 1e9);

  if (family === "Linear Seating Arrangement") {
    const raw = generateSeatingQuestionsForHHK({
      exam,
      stage,
      arrangementType: difficulty === "Hard" ? "LINEAR_DOUBLE_ROW" : "LINEAR_SINGLE_ROW",
      difficulty,
      count: setSize,
      seed: childSeed,
    });
    return raw.map((q) => ({ ...q, topic: "Puzzles", subtopicName: "Linear Seating Arrangement" }));
  }

  if (family === "Circular Seating Arrangement") {
    const raw = generateSeatingQuestionsForHHK({
      exam,
      stage,
      arrangementType: difficulty === "Hard" ? "CIRCULAR_MIXED" : "CIRCULAR_CENTRE",
      difficulty,
      count: setSize,
      seed: childSeed,
    });
    return raw.map((q) => ({ ...q, topic: "Puzzles", subtopicName: "Circular Seating Arrangement" }));
  }

  if (family === "Floor-Based Puzzles") {
    const floorSet = generateFloorPuzzleSet({
      exam,
      stage,
      puzzleType: "AUTO",
      difficulty,
      questionCount: setSize,
      seed: childSeed,
    });
    const clues = Array.isArray(floorSet.clueStatements) ? floorSet.clueStatements.join(" ") : "";
    const instr = floorSet.puzzleInstructions || "";
    const fullPassage = `Directions: Study the following information carefully and answer the questions given below.\n\n${instr}\n${clues}`;
    return (floorSet.questions || []).slice(0, setSize).map((q) => {
      const optsArr = Array.isArray(q.optionsArray)
        ? q.optionsArray
        : Array.isArray(q.options)
          ? q.options.map((o) => (typeof o === "string" ? o : o.text))
          : Object.values(q.options || {});
      const correctIdx =
        typeof q.correctOptionIndex === "number"
          ? q.correctOptionIndex
          : Math.max(0, optsArr.indexOf(q.answer));
      return {
        ...q,
        topic: "Puzzles",
        subType: `PUZZLE_FLOOR_${floorSet.puzzleType || "STANDARD"}`,
        subtopicName: "Floor-Based Puzzles",
        difficulty,
        passageTitle: `Floor-Based Puzzle (${floorSet.puzzleLabel || "Building"})`,
        passageText: fullPassage,
        questionText: `${fullPassage}\n\nQuestion: ${q.questionText}`,
        options: optsArr,
        answer: optsArr[correctIdx] ?? q.answer,
        correctOptionIndex: correctIdx,
        solutionSteps: Array.isArray(q.solutionSteps) && q.solutionSteps.length
          ? q.solutionSteps
          : [q.explanation || `Answer: ${optsArr[correctIdx] ?? q.answer}`],
      };
    });
  }

  const generatorMap = {
    "Box-Based Puzzles": generateBoxPuzzleSet,
    "Day-Based Scheduling": generateDaySchedulingSet,
    "Month-Based Scheduling": generateMonthSchedulingSet,
    "Comparison-Based Puzzles": generateComparisonPuzzleSet,
    "Distribution-Based Puzzles": generateDistributionPuzzleSet,
    "Scheduling-Based Puzzles": generateSchedulingPuzzleSet,
    "Hybrid Puzzles": generateHybridPuzzleSet,
  };

  const fn = generatorMap[family] || generateBoxPuzzleSet;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const built = fn({ difficulty, rng });
    if (built && built.questions?.length) {
      return built.questions.slice(0, setSize).map((q) => ({
        ...q,
        examName: exam,
        examStage: stage,
        solutionCount: built.solutionCount,
      }));
    }
  }
  return [];
}

/**
 * Generates `count` real-exam puzzle questions organized in 5-question passage sets.
 * When `puzzleType` is AUTO/empty, automatically draws from varied families across all 10 types!
 */
export function generatePuzzlesForHHK({
  exam = "IBPS_PO_PRELIMS",
  stage = "Prelims",
  puzzleType = "AUTO",
  difficulty = "Medium",
  count = 20,
  seed = null,
} = {}) {
  const rng = createPuzzleRng(
    seed !== null && seed !== undefined
      ? seed
      : Date.now() ^ Math.floor(Math.random() * 1e9),
  );
  const diffLabel = normalizeDiffLabel(difficulty);
  const fixedFamily = resolveRequestedFamily(puzzleType);

  // Build difficulty-calibrated family rotation when AUTO/Mixed
  let rotation;
  if (fixedFamily) {
    rotation = [fixedFamily];
  } else if (diffLabel === "Easy") {
    rotation = rng.shuffle([
      "Box-Based Puzzles",
      "Day-Based Scheduling",
      "Comparison-Based Puzzles",
      "Linear Seating Arrangement",
      "Circular Seating Arrangement",
      "Floor-Based Puzzles",
      "Month-Based Scheduling",
      "Scheduling-Based Puzzles",
    ]);
  } else if (diffLabel === "Hard") {
    rotation = rng.shuffle([
      "Hybrid Puzzles",
      "Month-Based Scheduling",
      "Distribution-Based Puzzles",
      "Scheduling-Based Puzzles",
      "Floor-Based Puzzles",
      "Circular Seating Arrangement",
      "Linear Seating Arrangement",
      "Box-Based Puzzles",
      "Comparison-Based Puzzles",
      "Day-Based Scheduling",
    ]);
  } else {
    rotation = rng.shuffle([...ALL_PUZZLE_FAMILIES]);
  }

  const collected = [];
  let setIdx = 0;
  let guard = 0;

  while (collected.length < count && guard < 30) {
    guard += 1;
    const family = rotation[setIdx % rotation.length];
    setIdx += 1;
    const remaining = count - collected.length;
    const setQs = generateOneFamilySet({
      family,
      exam,
      stage,
      difficulty: diffLabel,
      countNeeded: Math.min(5, remaining),
      rng,
    });
    collected.push(...setQs);
  }

  return collected.slice(0, count);
}

export function generatePuzzlesBatch(options = {}) {
  const questions = generatePuzzlesForHHK(options);
  return {
    questions,
    meta: {
      topic: "Puzzles",
      requested: options.count ?? 20,
      generated: questions.length,
      familiesAvailable: ALL_PUZZLE_FAMILIES,
    },
  };
}
