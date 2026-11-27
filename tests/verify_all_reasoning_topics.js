import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  generateTopicQuestions,
  isEngineSupportedTopic,
} from "../server/services/questionGenerator.js";

const REASONING_TOPICS = [
  "Puzzles",
  "Seating Arrangement",
  "Syllogism",
  "Inequality",
  "Coding-Decoding",
  "Blood Relations",
  "Direction & Distance",
  "Order & Ranking",
  "Alphanumeric Series",
  "Number Series",
  "Letter Series",
  "Input-Output",
  "Data Sufficiency",
  "Logical Reasoning",
  "Statement & Conclusion",
  "Statement & Assumption",
  "Cause & Effect",
  "Analogy",
  "Classification",
];

console.log("=== HHK All-19 Reasoning Ability End-to-End Verification ===\n");

let passed = 0;
let totalQuestions = 0;

for (const topic of REASONING_TOPICS) {
  const t0 = performance.now();
  assert.equal(isEngineSupportedTopic(topic), true, `${topic} must be Auto-Generate Ready`);

  const res = generateTopicQuestions({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: topic,
    difficulty: "medium",
    count: 10,
    optionCount: 5,
  });

  const qs = res.standaloneQuestions || [];
  const ms = (performance.now() - t0).toFixed(1);
  assert.equal(qs.length, 10, `${topic}: expected 10 questions, got ${qs.length}`);

  const keys = new Set();
  const subTypes = new Set();
  for (const q of qs) {
    assert.ok(q.questionText && q.questionText.length >= 15, `${topic}: invalid questionText`);
    assert.ok(Array.isArray(q.options) && q.options.length === 5, `${topic}: expected 5 options`);
    const optTexts = new Set(q.options.map((o) => String(o.text || "").trim()));
    assert.equal(optTexts.size, 5, `${topic}: duplicate option texts`);
    assert.ok(["A", "B", "C", "D", "E"].includes(q.correctAnswer), `${topic}: bad answer key ${q.correctAnswer}`);
    assert.ok(q.explanation && q.explanation.length >= 10, `${topic}: empty explanation`);
    keys.add(q.correctAnswer);
    subTypes.add(q.subType || q.subtopicName || "default");
    totalQuestions += 1;
  }

  assert.ok(keys.size >= 2, `${topic}: expected varied answer keys, got ${[...keys]}`);
  console.log(
    `[PASS] ${topic.padEnd(23)} | 10/10 | ${ms.padStart(5)} ms | keys: ${[...keys].sort().join(",").padEnd(9)} | subtypes: ${subTypes.size}`,
  );
  passed += 1;
}

console.log(`\nALL ${passed}/${REASONING_TOPICS.length} REASONING TOPICS PASSED (${totalQuestions}/${totalQuestions} questions verified).`);
