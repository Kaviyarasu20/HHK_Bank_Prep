import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { classifyCausalRelation } from "../server/question-engine/generators/reasoning/causeEffect/solver.js";
import { generateCauseEffectBatch } from "../server/question-engine/generators/reasoning/causeEffect/index.js";
import { validateCauseEffectQuestion } from "../server/question-engine/generators/reasoning/causeEffect/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK Cause & Effect Question Engine Verification ===\n");

// 1. Formal Causal Graph Classifier Unit Tests
{
  assert.equal(
    classifyCausalRelation({ scenarioId: "A", role: "CAUSE" }, { scenarioId: "A", role: "EFFECT", effectSlot: 0 }),
    "I_CAUSES_II",
  );
  assert.equal(
    classifyCausalRelation({ scenarioId: "A", role: "EFFECT", effectSlot: 1 }, { scenarioId: "A", role: "CAUSE" }),
    "II_CAUSES_I",
  );
  assert.equal(
    classifyCausalRelation({ scenarioId: "A", role: "CAUSE" }, { scenarioId: "B", role: "CAUSE" }),
    "INDEPENDENT_CAUSES",
  );
  assert.equal(
    classifyCausalRelation({ scenarioId: "A", role: "EFFECT", effectSlot: 0 }, { scenarioId: "B", role: "EFFECT", effectSlot: 1 }),
    "EFFECTS_OF_INDEPENDENT_CAUSES",
  );
  assert.equal(
    classifyCausalRelation({ scenarioId: "A", role: "EFFECT", effectSlot: 0 }, { scenarioId: "A", role: "EFFECT", effectSlot: 1 }),
    "EFFECTS_OF_COMMON_CAUSE",
  );
  console.log("[PASS] 1. Formal causal graph classifier unit tests (all 5 relations A–E)");
}

// 2. Bulk Stress Verification (250 questions across Easy/Medium/Hard & all 5 domains)
{
  const batches = [
    { difficulty: "Easy", count: 50, seed: 191 },
    { difficulty: "Medium", count: 75, seed: 293 },
    { difficulty: "Hard", count: 75, seed: 395 },
    { difficulty: "Medium", count: 10, subtopicName: "Banking Monetary", seed: 491 },
    { difficulty: "Medium", count: 10, subtopicName: "Agriculture Weather", seed: 492 },
    { difficulty: "Medium", count: 10, subtopicName: "Infrastructure Transit", seed: 493 },
    { difficulty: "Hard", count: 10, subtopicName: "Cybersecurity Digital", seed: 494 },
    { difficulty: "Easy", count: 10, subtopicName: "Civic Public", seed: 495 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generateCauseEffectBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validateCauseEffectQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 250);
  // Confirm all 5 options A-E are well-represented!
  for (const k of ["A", "B", "C", "D", "E"]) {
    assert.ok(ansDist[k] >= 15, `Expected balanced distribution for ${k}, got ${ansDist[k]}`);
  }
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/250 questions verified across all 5 domains`);
  console.log("       Domains:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generateCauseEffectBatch({ difficulty: "Medium", count: 20, seed: 989 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Cause & Effect"), true);
  assert.equal(isEngineSupportedTopic("cause and effect"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Mains",
    topicName: "Cause & Effect",
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
  assert.ok(formattedKeys.size >= 4, `Expected varied formatted correctAnswer keys, got ${[...formattedKeys]}`);
  console.log(`[PASS] 4. Full questionGenerator.js integration (15/15 HHK-formatted questions, keys: ${[...formattedKeys].sort().join(",")})`);
}

console.log("\nALL CAUSE & EFFECT ENGINE CHECKS PASSED (4/4).");
