import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  ALL_PUZZLE_FAMILIES,
  generatePuzzlesForHHK,
} from "../server/question-engine/generators/reasoning/puzzles/index.js";
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

test("1. All 10 real-exam banking puzzle families are registered", () => {
  assert.equal(ALL_PUZZLE_FAMILIES.length, 10);
  assert.equal(isTopicAutoGeneratable("Puzzles"), true);
  assert.equal(isTopicAutoGeneratable("Floor-Based Puzzles"), true);
});

test("2. All 10 puzzle families generate valid 5-question sets across Easy, Medium & Hard (150 questions)", () => {
  let totalChecked = 0;
  for (const family of ALL_PUZZLE_FAMILIES) {
    for (const diff of ["Easy", "Medium", "Hard"]) {
      const qs = generatePuzzlesForHHK({
        exam: "IBPS_PO_PRELIMS",
        stage: diff === "Hard" ? "Mains" : "Prelims",
        puzzleType: family,
        difficulty: diff,
        count: 5,
        seed: 7000 + totalChecked,
      });
      assert.equal(
        qs.length,
        5,
        `Family "${family}" (${diff}) returned ${qs.length}/5 questions`,
      );
      const stems = new Set();
      for (const q of qs) {
        assert.ok(q.questionText && q.questionText.length > 60, `Short questionText in ${family}`);
        assert.equal(stems.has(q.questionText), false, `Duplicate questionText in ${family} (${diff})`);
        stems.add(q.questionText);
        assert.equal(q.options.length, 5, `Expected 5 options in ${family}`);
        const uniqOpts = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
        assert.equal(uniqOpts.size, 5, `Duplicate option detected in ${family}: ${JSON.stringify(q.options)}`);
        assert.equal(q.options[q.correctOptionIndex], q.answer, `Answer index mismatch in ${family}`);
        if (q.solutionCount !== undefined) {
          assert.equal(q.solutionCount, 1, `Non-unique CSP solutionCount (${q.solutionCount}) in ${family}`);
        }
        totalChecked += 1;
      }
    }
  }
  assert.equal(totalChecked, 150);
  console.log(`   Verified ${totalChecked} questions (30 full 5-question passage sets) across all 10 families × 3 difficulties!`);
});

test("3. Unified 'Puzzles' 20-question batch automatically mixes 4 distinct puzzle families", () => {
  const t0 = performance.now();
  const out = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Puzzles",
    difficulty: "medium",
    count: 20,
    optionCount: 5,
  });
  const elapsed = performance.now() - t0;
  assert.equal(out.standaloneQuestions.length, 20);

  const familiesSeen = new Set(out.standaloneQuestions.map((q) => q.subtopicName));
  assert.ok(
    familiesSeen.size >= 4,
    `Expected 4 distinct puzzle families in 20Q AUTO batch, got ${familiesSeen.size}: ${[...familiesSeen].join(", ")}`,
  );

  for (const q of out.standaloneQuestions) {
    assert.equal(q.options.length, 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 40);
  }
  console.log(`   20Q mixed Puzzles batch generated in ${elapsed.toFixed(1)}ms across: ${[...familiesSeen].join(" | ")}`);
});

test("4. Specific subtopic routing works through generateTopicQuestions (e.g., Hybrid Puzzles & Month-Based Scheduling)", () => {
  for (const sub of ["Hybrid Puzzles", "Month-Based Scheduling", "Box-Based Puzzles"]) {
    const out = generateTopicQuestions({
      examCode: "SBI_PO",
      stageName: "Mains",
      topicName: "Puzzles",
      subtopicName: sub,
      difficulty: "hard",
      count: 10,
      optionCount: 5,
    });
    assert.equal(out.standaloneQuestions.length, 10);
    for (const q of out.standaloneQuestions) {
      assert.equal(q.subtopicName, sub);
      assert.equal(q.options.length, 5);
    }
  }
});

console.log(`\nALL UNIFIED PUZZLES ENGINE TESTS PASSED (${passed}/${passed})!`);
