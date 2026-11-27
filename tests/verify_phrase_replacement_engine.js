import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  renderHighlightedSentence,
  verifyPhraseReplacementIntegrity,
} from "../server/question-engine/generators/english/phraseReplacement/solver.js";
import { generatePhraseReplacementBatch } from "../server/question-engine/generators/english/phraseReplacement/index.js";
import { validatePhraseReplacementQuestion } from "../server/question-engine/generators/english/phraseReplacement/validator.js";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

console.log("=== HHK English Language — Phrase Replacement Engine Verification ===\n");

// 1. Formal Verifier Unit Tests
{
  const sErr = renderHighlightedSentence("The panel ", "comprises of six auditors", " today.");
  assert.equal(
    verifyPhraseReplacementIntegrity({
      sentence: sErr,
      shownPhrase: "comprises of six auditors",
      correctPhrase: "comprises six auditors",
      isNoCorrection: false,
      options: ["comprises six auditors", "comprise of six auditors", "is comprising six auditors", "consists six auditors", "No correction required"],
      correctIndex: 0,
    }).valid,
    true,
  );
  const sOk = renderHighlightedSentence("The panel ", "comprises six auditors", " today.");
  assert.equal(
    verifyPhraseReplacementIntegrity({
      sentence: sOk,
      shownPhrase: "comprises six auditors",
      correctPhrase: "comprises six auditors",
      isNoCorrection: true,
      options: ["comprises of six auditors", "comprise of six auditors", "is comprising six auditors", "consists six auditors", "No correction required"],
      correctIndex: 4,
    }).valid,
    true,
  );
  console.log("[PASS] 1. Phrase-slot & No-Correction invariant unit tests");
}

// 2. Bulk Stress Verification (120 questions across Easy/Medium/Hard & all 5 subtopics)
{
  const batches = [
    { difficulty: "Easy", count: 25, seed: 851 },
    { difficulty: "Medium", count: 30, seed: 852 },
    { difficulty: "Hard", count: 30, seed: 853 },
    { difficulty: "Medium", count: 7, subtopicName: "Verb Tense", seed: 861 },
    { difficulty: "Medium", count: 7, subtopicName: "Preposition Phrasal", seed: 862 },
    { difficulty: "Hard", count: 7, subtopicName: "Conjunction Inversion", seed: 863 },
    { difficulty: "Easy", count: 7, subtopicName: "Modifier Idiom", seed: 864 },
    { difficulty: "Hard", count: 7, subtopicName: "Concision Parallelism", seed: 865 },
  ];

  let totalVerified = 0;
  const subTypeCounts = {};
  const ansDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const cfg of batches) {
    const res = generatePhraseReplacementBatch(cfg);
    assert.equal(res.questions.length, cfg.count, `Expected ${cfg.count} for ${JSON.stringify(cfg)}, got ${res.questions.length}`);
    for (const q of res.questions) {
      const check = validatePhraseReplacementQuestion({ ...q, options: q.optionsArray, _meta: q._solverMeta });
      assert.equal(check.valid, true, `Validation failed: ${check.errors.join("; ")}`);
      subTypeCounts[q.subType] = (subTypeCounts[q.subType] || 0) + 1;
      ansDist[q.correctAnswer] += 1;
      totalVerified += 1;
    }
  }

  assert.equal(totalVerified, 120);
  console.log(`[PASS] 2. Bulk verification: ${totalVerified}/120 questions verified across all 5 subtopics`);
  console.log("       Subtopics:", JSON.stringify(subTypeCounts));
  console.log("       Answer distribution A–E:", JSON.stringify(ansDist));
}

// 3. Performance Benchmark (20-question Medium batch)
{
  const t0 = performance.now();
  const res = generatePhraseReplacementBatch({ difficulty: "Medium", count: 20, seed: 996 });
  const ms = performance.now() - t0;
  assert.equal(res.questions.length, 20);
  assert.ok(ms < 250, `Expected < 250ms, took ${ms.toFixed(2)}ms`);
  console.log(`[PASS] 3. Performance: 20-question Medium batch generated in ${ms.toFixed(2)} ms`);
}

// 4. Full HHK questionGenerator.js Integration Test
{
  assert.equal(isEngineSupportedTopic("Phrase Replacement"), true);
  assert.equal(isEngineSupportedTopic("phrase replacement"), true);
  const generatedRes = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Phrase Replacement",
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

console.log("\nALL ENGLISH PHRASE REPLACEMENT ENGINE CHECKS PASSED (4/4).");
