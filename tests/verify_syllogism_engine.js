import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  CONCL,
  STMT,
  compileConstraints,
  evaluateConclusion,
  evaluateTwoConclusions,
  isSatisfiable,
} from "../server/question-engine/generators/reasoning/syllogism/solver.js";
import {
  generateSyllogismBatch,
  SYLLOGISM_SUBTOPICS,
} from "../server/question-engine/generators/reasoning/syllogism/index.js";
import { validateSyllogismQuestion } from "../server/question-engine/generators/reasoning/syllogism/validator.js";
import {
  generateTopicQuestions,
  isTopicAutoGeneratable,
} from "../server/services/questionGenerator.js";

/**
 * Independent brute-force finite-model enumerator for N=3 terms (all 2^8 - 1 = 255 subsets)
 * to mathematically cross-verify our fast bitmask SAT solver.
 */
function bruteForceModels3(statements) {
  const validModels = [];
  const has = (r, t) => ((r >> t) & 1) === 1;
  const occupied = (m, pred) => {
    for (let r = 0; r < 8; r += 1) {
      if (((m >> r) & 1) && pred(r)) return true;
    }
    return false;
  };
  for (let m = 1; m < 256; m += 1) {
    // All 3 terms must be non-empty
    if (!occupied(m, (r) => has(r, 0))) continue;
    if (!occupied(m, (r) => has(r, 1))) continue;
    if (!occupied(m, (r) => has(r, 2))) continue;

    let ok = true;
    for (const st of statements) {
      const { type, a, b } = st;
      if (type === STMT.ALL) {
        if (occupied(m, (r) => has(r, a) && !has(r, b))) { ok = false; break; }
      } else if (type === STMT.NO) {
        if (occupied(m, (r) => has(r, a) && has(r, b))) { ok = false; break; }
      } else if (type === STMT.SOME) {
        if (!occupied(m, (r) => has(r, a) && has(r, b))) { ok = false; break; }
      } else if (type === STMT.SOME_NOT) {
        if (!occupied(m, (r) => has(r, a) && !has(r, b))) { ok = false; break; }
      } else if (type === STMT.ONLY_A_FEW) {
        if (
          !occupied(m, (r) => has(r, a) && has(r, b)) ||
          !occupied(m, (r) => has(r, a) && !has(r, b))
        ) { ok = false; break; }
      } else if (type === STMT.ONLY) {
        if (occupied(m, (r) => has(r, b) && !has(r, a))) { ok = false; break; }
        const c = [0, 1, 2].find((x) => x !== a && x !== b);
        if (occupied(m, (r) => has(r, b) && has(r, c))) { ok = false; break; }
      }
    }
    if (ok) validModels.push(m);
  }
  return validModels;
}

function bruteHoldsInModel(m, c) {
  const has = (r, t) => ((r >> t) & 1) === 1;
  const occupied = (pred) => {
    for (let r = 0; r < 8; r += 1) {
      if (((m >> r) & 1) && pred(r)) return true;
    }
    return false;
  };
  const { type, a, b } = c;
  if (type === CONCL.ALL || type === CONCL.POSS_ALL) return !occupied((r) => has(r, a) && !has(r, b));
  if (type === CONCL.NO || type === CONCL.POSS_NO || type === CONCL.CAN_NEVER_BE_ALL) return !occupied((r) => has(r, a) && has(r, b));
  if (type === CONCL.SOME || type === CONCL.POSS_SOME) return occupied((r) => has(r, a) && has(r, b));
  if (type === CONCL.SOME_NOT || type === CONCL.POSS_SOME_NOT || type === CONCL.CAN_NEVER_BE_SOME) return occupied((r) => has(r, a) && !has(r, b));
  return false;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS [${passed}]: ${name}`);
}

test("1. Brute-force 3-term model enumeration matches fast bitmask SAT solver 100%", () => {
  const testCases = [
    [{ type: STMT.ONLY_A_FEW, a: 0, b: 1 }, { type: STMT.ALL, a: 1, b: 2 }],
    [{ type: STMT.ONLY, a: 0, b: 1 }, { type: STMT.SOME, a: 0, b: 2 }],
    [{ type: STMT.SOME, a: 0, b: 1 }, { type: STMT.NO, a: 1, b: 2 }],
    [{ type: STMT.ALL, a: 0, b: 1 }, { type: STMT.NO, a: 0, b: 2 }],
    [{ type: STMT.ONLY_A_FEW, a: 0, b: 1 }, { type: STMT.ONLY_A_FEW, a: 1, b: 2 }],
    // Contradictory case: All A are B + No A is B
    [{ type: STMT.ALL, a: 0, b: 1 }, { type: STMT.NO, a: 0, b: 1 }],
  ];
  const conclTypes = Object.values(CONCL);

  for (const stmts of testCases) {
    const models = bruteForceModels3(stmts);
    assert.equal(isSatisfiable(3, stmts), models.length > 0);
    if (!models.length) continue;

    const comp = compileConstraints(3, stmts);
    for (let a = 0; a < 3; a += 1) {
      for (let b = 0; b < 3; b += 1) {
        if (a === b) continue;
        for (const type of conclTypes) {
          const fast = evaluateConclusion(comp, { type, a, b });
          let expected;
          if (type.startsWith("POSS_")) {
            const holdsAll = models.every((m) => bruteHoldsInModel(m, { type, a, b }));
            const holdsSome = models.some((m) => bruteHoldsInModel(m, { type, a, b }));
            expected = holdsSome && !holdsAll;
          } else {
            expected = models.every((m) => bruteHoldsInModel(m, { type, a, b }));
          }
          assert.equal(
            fast.follows,
            expected,
            `Mismatch for stmts=${JSON.stringify(stmts)}, concl=${type}(${a},${b}): fast=${fast.follows}, brute=${expected}`,
          );
        }
      }
    }
  }
});

test("2. Strict banking rules: 'Only a few', 'Only', 'Can never be', and 'Either-Or'", () => {
  // Only a few A are B => Some A are B (TRUE), Some A are not B (TRUE), All A being B is a possibility (FALSE)
  const comp1 = compileConstraints(3, [{ type: STMT.ONLY_A_FEW, a: 0, b: 1 }]);
  assert.equal(evaluateConclusion(comp1, { type: CONCL.SOME, a: 0, b: 1 }).follows, true);
  assert.equal(evaluateConclusion(comp1, { type: CONCL.SOME_NOT, a: 0, b: 1 }).follows, true);
  assert.equal(evaluateConclusion(comp1, { type: CONCL.POSS_ALL, a: 0, b: 1 }).follows, false);
  // Reverse All B being A IS a possibility!
  assert.equal(evaluateConclusion(comp1, { type: CONCL.POSS_ALL, a: 1, b: 0 }).follows, true);

  // Only A are B + Some A are C => No B is C (TRUE), Some B being C is a possibility (FALSE)
  const comp2 = compileConstraints(3, [
    { type: STMT.ONLY, a: 0, b: 1 },
    { type: STMT.SOME, a: 0, b: 2 },
  ]);
  assert.equal(evaluateConclusion(comp2, { type: CONCL.ALL, a: 1, b: 0 }).follows, true);
  assert.equal(evaluateConclusion(comp2, { type: CONCL.NO, a: 1, b: 2 }).follows, true);
  assert.equal(evaluateConclusion(comp2, { type: CONCL.POSS_SOME, a: 1, b: 2 }).follows, false);

  // Either-Or: Some A are B + Some B are C => I: Some A are C, II: No A is C => EITHER_OR
  const eo = evaluateTwoConclusions(
    3,
    [{ type: STMT.SOME, a: 0, b: 1 }, { type: STMT.SOME, a: 1, b: 2 }],
    { type: CONCL.SOME, a: 0, b: 2 },
    { type: CONCL.NO, a: 0, b: 2 },
  );
  assert.equal(eo.satisfiable, true);
  assert.equal(eo.outcome, "EITHER_OR");
});

test("3. 500+ Question Stress Test across Easy, Medium, Hard & all 7 subtopics", () => {
  const answerDistribution = [0, 0, 0, 0, 0];
  let totalGenerated = 0;

  // 3a. 100 Easy + 150 Medium + 150 Hard = 400 mixed
  for (const [diff, cnt] of [["Easy", 100], ["Medium", 150], ["Hard", 150]]) {
    const res = generateSyllogismBatch({ difficulty: diff, count: cnt, seed: 1000 + cnt });
    assert.equal(res.questions.length, cnt, `Expected ${cnt} ${diff} questions, got ${res.questions.length}`);
    const batchFingerprints = new Set();
    for (const q of res.questions) {
      assert.equal(batchFingerprints.has(q.fingerprint), false, "Duplicate fingerprint in batch!");
      batchFingerprints.add(q.fingerprint);
      const v = validateSyllogismQuestion({
        ...q,
        options: q.optionsArray,
        _meta: q._solverMeta,
      });
      assert.equal(v.valid, true, `Validation failed: ${v.errors.join("; ")}`);
      answerDistribution[q.correctOptionIndex] += 1;
      totalGenerated += 1;
    }
  }

  // 3b. 20 questions for EACH of the 7 subtopics = 140 more (total = 540!)
  for (const subtopicLabel of Object.values(SYLLOGISM_SUBTOPICS)) {
    const res = generateSyllogismBatch({
      difficulty: "Hard",
      subtopicName: subtopicLabel,
      count: 20,
      seed: 9001,
    });
    assert.equal(res.questions.length, 20, `Subtopic "${subtopicLabel}" generated ${res.questions.length}/20`);
    for (const q of res.questions) {
      const v = validateSyllogismQuestion({
        ...q,
        options: q.optionsArray,
        _meta: q._solverMeta,
      });
      assert.equal(v.valid, true, `Subtopic "${subtopicLabel}" failed validation: ${v.errors.join("; ")}`);
      answerDistribution[q.correctOptionIndex] += 1;
      totalGenerated += 1;
    }
  }

  assert.ok(totalGenerated >= 540, `Expected >=540 verified questions, got ${totalGenerated}`);
  // Every option slot A-E must have reasonable representation (balanced distribution)
  for (let i = 0; i < 5; i += 1) {
    assert.ok(
      answerDistribution[i] >= 50,
      `Option ${String.fromCharCode(65 + i)} under-represented: ${JSON.stringify(answerDistribution)}`,
    );
  }
  console.log(`   Verified ${totalGenerated} questions! Answer distribution A-E:`, answerDistribution);
});

test("4. Performance benchmark (< 50ms per 20-question batch)", () => {
  const t0 = performance.now();
  const res = generateSyllogismBatch({ difficulty: "Medium", count: 20, seed: 4242 });
  const elapsedMs = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(elapsedMs < 50, `20-question batch took ${elapsedMs.toFixed(2)}ms (limit: 50ms)`);
  console.log(`   20-question Medium batch generated in ${elapsedMs.toFixed(2)}ms`);
});

test("5. Full HHK Integration via questionGenerator.js & engineRouter.js", () => {
  assert.equal(isTopicAutoGeneratable("Syllogism"), true);
  const out = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Syllogism",
    difficulty: "medium",
    count: 15,
    optionCount: 5,
  });
  assert.equal(out.mode, "standalone");
  assert.equal(out.standaloneQuestions.length, 15);
  for (const q of out.standaloneQuestions) {
    assert.equal(q.options.length, 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation.length > 30);
    assert.ok(q.questionText.includes("Statements:") || q.questionText.includes("Reverse Syllogism"));
  }
});

console.log(`\nALL SYLLOGISM ENGINE TESTS PASSED (${passed}/${passed})!`);
