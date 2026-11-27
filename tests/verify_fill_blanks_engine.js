import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  fillBlankTemplate,
  verifyFillerQuestionIntegrity,
} from "../server/question-engine/generators/english/fillInTheBlanks/solver.js";
import { generateFillInTheBlanksBatch } from "../server/question-engine/generators/english/fillInTheBlanks/index.js";
import { validateFillBlanksQuestion } from "../server/question-engine/generators/english/fillInTheBlanks/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Fill in the Blanks Engine Verification ===\n");

// 1. Formal Slot-Substitution Verifier Unit Tests
{
  const filled = fillBlankTemplate("Banks must _____ inflation while maintaining _____.", ["curb", "liquidity"]);
  assert.equal(filled, "Banks must curb inflation while maintaining liquidity.");
  const check = verifyFillerQuestionIntegrity({
    template: "Banks must _____ inflation while maintaining _____.",
    expectedBlankCount: 2,
    options: ["curb / liquidity", "fuel / liquidity", "curb / deficit", "ignore / scarcity", "delay / stress"],
    correctIndex: 0,
    expectedAnswer: "curb / liquidity",
  });
  assert.equal(check.valid, true);
  console.log("[PASS] 1. Slot-substitution & option-integrity unit tests");
}

// 2. Bulk Stress Verification (100 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 20, seed: 701 },
    { difficulty: "Medium", count: 25, seed: 702 },
    { difficulty: "Hard", count: 25, seed: 703 },
    { difficulty: "Easy", count: 6, subtopicName: "Single Contextual Vocab", seed: 711 },
    { difficulty: "Medium", count: 6, subtopicName: "Double Fillers", seed: 712 },
    { difficulty: "Easy", count: 6, subtopicName: "Grammar Preposition", seed: 713 },
    { difficulty: "Hard", count: 6, subtopicName: "Dual Sentence Common", seed: 714 },
    { difficulty: "Hard", count: 6, subtopicName: "Connector Transition", seed: 715 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateFillInTheBlanksBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateFillBlanksQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 100);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/100 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateFillInTheBlanksBatch({ difficulty: "Medium", count: 20, seed: 993 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Fill in the Blanks"), true);
  assert.equal(isEngineSupportedTopic("fill in the blanks"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Fill in the Blanks",
    difficulty: "Medium",
    count: 15,
  });
  const generated = generatedRes.standaloneQuestions;
  assert.equal(generated.length, 15);
  for (const q of generated) {
    assert.ok(q.questionText && q.questionText.length > 40);
    assert.ok(Array.isArray(q.options) && q.options.length === 5);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer));
    assert.ok(q.explanation && q.explanation.length > 15);
  }
  const formattedKeys = new Set(generated.map((q) => q.correctAnswer));
  assert.ok(formattedKeys.size >= 3, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL ENGLISH FILL IN THE BLANKS ENGINE CHECKS PASSED (4/4).");
