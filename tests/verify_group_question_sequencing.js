import assert from "node:assert/strict";
import {
  arrangeSectionQuestionsGrouped,
  resolveQuestionGroupKey,
  verifyContiguousGroupOrdering,
} from "../server/exam-engine/questionSequencer.js";
import { generateIntelligentExamWiseMockTest } from "../server/exam-engine/intelligentMockTestEngine.js";

console.log("=== 1. Unit Testing Group-Aware Sequencer (DI, Seating, Puzzles, Standalone Mix) ===");
const diStem =
  "[Monthly Sales of Five Products | Unit: Units]\nProduct | Jan | Feb | Mar | Apr\nProduct A | 120 | 140 | 160 | 180\nProduct B | 200 | 150 | 175 | 225";
const puzzleStem =
  "Directions: Study the following information carefully and answer the questions given below.\nEight persons A, B, C, D, E, F, G, H live on 8 different floors of a building.\n1. A lives on an even numbered floor above floor 4.\n2. Two persons live between A and B.";

// Simulate interleaved/scrambled input where DI Set A (5 Qs), Puzzle Set B (5 Qs), and Standalones are mixed
const mixedInput = [
  { id: "di-1", topicName: "Data Interpretation", questionText: `${diStem}\n\nWhat is the total sales of Product A?` },
  { id: "s-1", topicName: "Simplification", questionText: "25% of 400 + 18 x 5 = ?" },
  { id: "puz-1", topicName: "Floor-Based Puzzles", questionText: `${puzzleStem}\n\nWho lives on the 8th floor?` },
  { id: "di-2", topicName: "Data Interpretation", questionText: `${diStem}\n\nWhat is the average sales in Feb?` },
  { id: "s-2", topicName: "Syllogism", questionText: "Statements: All banks are vaults. Some vaults are gold." },
  { id: "di-3", topicName: "Data Interpretation", questionText: `${diStem}\n\nFind the ratio of Jan to Apr.` },
  { id: "puz-2", topicName: "Floor-Based Puzzles", questionText: `${puzzleStem}\n\nWho lives immediately below A?` },
  { id: "di-4", topicName: "Data Interpretation", questionText: `${diStem}\n\nWhich month had highest sales?` },
  { id: "puz-3", topicName: "Floor-Based Puzzles", questionText: `${puzzleStem}\n\nHow many persons live between B and C?` },
  { id: "s-3", topicName: "Number Series", questionText: "Find the missing number: 4, 9, 19, 39, ?" },
  { id: "di-5", topicName: "Data Interpretation", questionText: `${diStem}\n\nPercentage increase from Jan to Apr?` },
  { id: "puz-4", topicName: "Floor-Based Puzzles", questionText: `${puzzleStem}\n\nWho lives on the 1st floor?` },
  { id: "puz-5", topicName: "Floor-Based Puzzles", questionText: `${puzzleStem}\n\nWhich floor does D live on?` },
];

const arranged = arrangeSectionQuestionsGrouped(mixedInput, () => 0.42);
assert.equal(arranged.length, mixedInput.length, "Total question count must be preserved");

const audit = verifyContiguousGroupOrdering(arranged);
assert.equal(audit.valid, true, `Expected 0 split-group violations, got: ${JSON.stringify(audit.violations)}`);

// Verify internal order of DI Set A is strictly di-1, di-2, di-3, di-4, di-5 and consecutive
const diPositions = ["di-1", "di-2", "di-3", "di-4", "di-5"].map((id) =>
  arranged.findIndex((q) => q.id === id)
);
for (let i = 1; i < diPositions.length; i++) {
  assert.equal(diPositions[i], diPositions[i - 1] + 1, `DI Set A not consecutive/sequential: ${diPositions}`);
}

// Verify internal order of Puzzle Set B is strictly puz-1..puz-5 and consecutive
const puzPositions = ["puz-1", "puz-2", "puz-3", "puz-4", "puz-5"].map((id) =>
  arranged.findIndex((q) => q.id === id)
);
for (let i = 1; i < puzPositions.length; i++) {
  assert.equal(puzPositions[i], puzPositions[i - 1] + 1, `Puzzle Set B not consecutive/sequential: ${puzPositions}`);
}
console.log(`Unit test passed: DI Set A at [${diPositions.join(",")}], Puzzle Set B at [${puzPositions.join(",")}] (strictly consecutive & sequential).\n`);

console.log("=== 2. Verifying Live Full Mock Tests (IBPS RRB OA Prelims 80 Qs & IBPS PO Prelims 100 Qs) ===");
for (const [examCode, stageName, expectedCount] of [
  ["IBPS-RRB-OA", "Prelims", 80],
  ["IBPS-PO", "Prelims", 100],
]) {
  const res = await generateIntelligentExamWiseMockTest({
    examCode,
    stageName,
    shortagePolicy: "ALLOW_PARTIAL_DRAFT",
    varyWithinRanges: false,
    seed: 20261127,
  });

  let multiGroupsFound = 0;
  for (const sec of res.mockTest.sections) {
    const check = verifyContiguousGroupOrdering(sec.questions);
    assert.equal(
      check.valid,
      true,
      `${examCode} ${stageName} -> ${sec.sectionName} had split group sets: ${JSON.stringify(check.violations)}`
    );

    // Count how many multi-question sets stayed intact
    const counts = new Map();
    for (const q of sec.questions) {
      const k = resolveQuestionGroupKey(q);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
    for (const c of counts.values()) {
      if (c >= 2) multiGroupsFound++;
    }
  }

  console.log(
    `  PASS: ${examCode} ${stageName} (${res.mockTest.questions.length}/${expectedCount} Qs) — ${multiGroupsFound} multi-question DI/Puzzle/Seating sets verified strictly consecutive!`
  );
  assert.ok(multiGroupsFound >= 2, `Expected >= 2 multi-question sets in ${examCode} ${stageName}`);
}

console.log("\nALL GROUP-BASED QUESTION SEQUENCING CHECKS PASSED!");
