import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  OP,
  evaluateTwoInequalityConclusions,
  solveInequalityGraph,
} from "../server/question-engine/generators/reasoning/inequality/solver.js";
import {
  generateInequalityBatch,
  INEQUALITY_SUBTOPICS,
} from "../server/question-engine/generators/reasoning/inequality/index.js";
import { validateInequalityQuestion } from "../server/question-engine/generators/reasoning/inequality/validator.js";
import {
  generateTopicQuestions,
  isTopicAutoGeneratable,
} from "../server/services/questionGenerator.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS [${passed}]: ${name}`);
}

test("1. Exact Partial-Order Solver checks strict transitivity, contradictions, and 2-sign & 3-sign Either-Or", () => {
  // Contradiction: A > B > C > A
  const bad = solveInequalityGraph(3, [
    { a: 0, b: 1, op: OP.GT },
    { a: 1, b: 2, op: OP.GT },
    { a: 2, b: 0, op: OP.GT },
  ]);
  assert.equal(bad.consistent, false);

  // 2-sign Either-Or: A >= B = C => I: A > C, II: A = C => EITHER_OR
  const eo2 = evaluateTwoInequalityConclusions(
    3,
    [{ a: 0, b: 1, op: OP.GTE }, { a: 1, b: 2, op: OP.EQ }],
    { a: 0, b: 2, op: OP.GT },
    { a: 0, b: 2, op: OP.EQ },
  );
  assert.equal(eo2.outcome, "EITHER_OR");

  // 3-sign Either-Or (opposite signs): A > B < C => I: A > C, II: A <= C => EITHER_OR
  const eo3 = evaluateTwoInequalityConclusions(
    3,
    [{ a: 0, b: 1, op: OP.GT }, { a: 1, b: 2, op: OP.LT }],
    { a: 0, b: 2, op: OP.GT },
    { a: 0, b: 2, op: OP.LTE },
  );
  assert.equal(eo3.outcome, "EITHER_OR");

  // Trap: Opposite signs with ONLY 2 signs covered (A > C and A < C, missing =) => NEITHER!
  const trap = evaluateTwoInequalityConclusions(
    3,
    [{ a: 0, b: 1, op: OP.GT }, { a: 1, b: 2, op: OP.LT }],
    { a: 0, b: 2, op: OP.GT },
    { a: 0, b: 2, op: OP.LT },
  );
  assert.equal(trap.outcome, "NEITHER");
});

test("2. 500-Question Stress Test across Easy, Medium, Hard & all 5 subtopics", () => {
  const dist = [0, 0, 0, 0, 0];
  let total = 0;

  for (const [diff, cnt] of [["Easy", 100], ["Medium", 150], ["Hard", 150]]) {
    const res = generateInequalityBatch({ difficulty: diff, count: cnt, seed: 3000 + cnt });
    assert.equal(res.questions.length, cnt);
    const seen = new Set();
    for (const q of res.questions) {
      assert.equal(seen.has(q.fingerprint), false, "Duplicate fingerprint!");
      seen.add(q.fingerprint);
      const v = validateInequalityQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(v.valid, true, `Validation error: ${v.errors.join("; ")}`);
      dist[q.correctOptionIndex] += 1;
      total += 1;
    }
  }

  for (const sub of Object.values(INEQUALITY_SUBTOPICS)) {
    const res = generateInequalityBatch({ difficulty: "Hard", subtopicName: sub, count: 20, seed: 8888 });
    assert.equal(res.questions.length, 20, `Subtopic "${sub}" returned ${res.questions.length}/20`);
    for (const q of res.questions) {
      const v = validateInequalityQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(v.valid, true, `Subtopic "${sub}" failed: ${v.errors.join("; ")}`);
      dist[q.correctOptionIndex] += 1;
      total += 1;
    }
  }

  assert.equal(total, 500);
  console.log(`   Verified ${total} Inequality questions! Answer distribution A-E:`, dist);
});

test("3. Performance benchmark (< 50ms per 20-question batch)", () => {
  const t0 = performance.now();
  const res = generateInequalityBatch({ difficulty: "Medium", count: 20, seed: 5555 });
  const elapsed = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(elapsed < 50, `Took ${elapsed.toFixed(2)}ms`);
  console.log(`   20-question Medium batch generated in ${elapsed.toFixed(2)}ms`);
});

test("4. Full HHK Integration via questionGenerator.js & engineRouter.js", () => {
  assert.equal(isTopicAutoGeneratable("Inequality"), true);
  const out = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Inequality",
    difficulty: "medium",
    count: 15,
    optionCount: 5,
  });
  assert.equal(out.standaloneQuestions.length, 15);
  for (const q of out.standaloneQuestions) {
    assert.equal(q.options.length, 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation.length > 30);
  }
});

console.log(`\nALL INEQUALITY ENGINE TESTS PASSED (${passed}/${passed})!`);
