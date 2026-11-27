import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  compassDirectionFromTo,
  exactDistanceSquared,
  formatExactDistance,
  solveAngularRotation,
  solveObserverFacingFromShadow,
  solvePath,
  solveRelativePoints,
} from "../server/question-engine/generators/reasoning/directionDistance/solver.js";
import {
  generateDirectionDistanceBatch,
} from "../server/question-engine/generators/reasoning/directionDistance/index.js";
import { validateDirectionQuestion } from "../server/question-engine/generators/reasoning/directionDistance/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Direction & Distance Question Engine Verification ===\n");

// 1. Formal Solver Unit Tests
{
  // Path solver: 6m North, turn right 8m East => (8, 6), dist = 10m, North-East
  const path = solvePath([
    { turn: "START", initialDir: "North", distance: 6 },
    { turn: "RIGHT", distance: 8 },
  ]);
  assert.equal(path.distanceLabel, "10 m");
  assert.equal(path.directionEndFromStart, "North-East");
  assert.equal(path.directionStartFromEnd, "South-West");

  // Relative points
  const coords = solveRelativePoints("A", [
    { point: "B", ref: "A", dir: "North", dist: 5 },
    { point: "C", ref: "B", dir: "East", dist: 12 },
  ]);
  assert.equal(formatExactDistance(exactDistanceSquared(coords.A, coords.C)), "13 m");
  assert.equal(compassDirectionFromTo(coords.A, coords.C), "North-East");

  // Solar shadow: Morning (shadow West) -> shadow to observer's LEFT means observer faces North
  assert.equal(solveObserverFacingFromShadow("MORNING", "LEFT"), "North");
  assert.equal(solveObserverFacingFromShadow("MORNING", "RIGHT"), "South");
  // Evening (shadow East) -> shadow to observer's LEFT means observer faces South
  assert.equal(solveObserverFacingFromShadow("EVENING", "LEFT"), "South");
  assert.equal(solveObserverFacingFromShadow("EVENING", "RIGHT"), "North");

  // Angular rotation: North + 135° CW - 90° ACW = 45° => North-East
  const rot = solveAngularRotation("North", [
    { dir: "CW", deg: 135 },
    { dir: "ACW", deg: 90 },
  ]);
  assert.equal(rot.finalDirection, "North-East");

  console.log("[PASS] 1. Formal solver unit tests (Path, Relative Grid, Solar Shadow, Angular Rotation)");
}

// 2. Bulk Stress Verification (500 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 100, seed: 111 },
    { difficulty: "Medium", count: 150, seed: 222 },
    { difficulty: "Hard", count: 150, seed: 333 },
    { difficulty: "Medium", count: 20, subtopicName: "Path Shortest Distance", seed: 411 },
    { difficulty: "Medium", count: 20, subtopicName: "Relative Points Grid", seed: 412 },
    { difficulty: "Hard", count: 20, subtopicName: "Coded Direction", seed: 413 },
    { difficulty: "Easy", count: 20, subtopicName: "Shadow Sunrise", seed: 414 },
    { difficulty: "Easy", count: 20, subtopicName: "Angular Rotation", seed: 415 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateDirectionDistanceBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateDirectionQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 500);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/500 questions verified across all 5 subtopics`);
  console.log("       Subtypes:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateDirectionDistanceBatch({ difficulty: "Medium", count: 20, seed: 909 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Direction & Distance"), true);
  assert.equal(isEngineSupportedTopic("direction sense"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Direction & Distance",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 25);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL DIRECTION & DISTANCE ENGINE CHECKS PASSED (4/4).");
