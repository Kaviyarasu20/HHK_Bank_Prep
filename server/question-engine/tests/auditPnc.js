// Place at: server/question-engine/tests/auditPnc.js
import {
  generatePncBatch,
  ALL_PNC_TEMPLATES,
} from "../generators/quant/permutationCombination/index.js";
import {
  independentlyVerifyPncModel,
  validatePncQuestion,
} from "../generators/quant/permutationCombination/pncValidator.js";

console.log("=== HHK Permutation & Combination Production QA Audit (5-Option Standard) ===\n");

let totalVerified = 0;
let totalFailures = 0;
const answerPositionDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

// 1. Exhaustive Template Coverage Audit across all 32 templates (Categories A–N)
for (const tpl of ALL_PNC_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generatePncBatch({
    count: 3,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20261120 + ALL_PNC_TEMPLATES.indexOf(tpl) * 137,
  });

  if (questions.length < 1 || rejectedLogs.length > 0) {
    console.error(`[FAIL] ${tpl.id} (Cat ${tpl.category}): generated=${questions.length}, rejected=${rejectedLogs.length}`);
    if (rejectedLogs.length > 0) console.error("   Rejection:", rejectedLogs[0]);
    totalFailures++;
  } else {
    for (const q of questions) {
      if (q.optionsArray.length !== 5 || Object.keys(q.options).length !== 5) {
        console.error(`[FAIL] ${tpl.id} did not produce exactly 5 options!`);
        totalFailures++;
      }
      if (typeof q.correct_answer_value !== "number" || !Number.isInteger(q.correct_answer_value)) {
        console.error(`[FAIL] ${tpl.id} correct_answer_value must be an integer!`);
        totalFailures++;
      }
      answerPositionDist[q.correct_answer]++;
      totalVerified++;
    }
  }
}
console.log(
  `1. Template Coverage (${ALL_PNC_TEMPLATES.length} templates across Categories A–N): ${totalVerified} verified 5-option questions, ${totalFailures} failures.`
);
console.log("   Correct Answer Position Distribution (A–E):", answerPositionDist);

// 2. Seeded Reproducibility Check
const run1 = generatePncBatch({ count: 15, difficulty: "Medium", seed: 515151 });
const run2 = generatePncBatch({ count: 15, difficulty: "Medium", seed: 515151 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every(
    (q, i) => q.question === run2.questions[i].question && q.correct_answer_value === run2.questions[i].correct_answer_value
  );
console.log(`2. Seeded Reproducibility (15 Qs): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 3. Multi-Set Duplicate Prevention Check
const set1 = generatePncBatch({ count: 15, difficulty: "Medium", seed: 4242 });
const set2 = generatePncBatch({
  count: 15,
  difficulty: "Medium",
  seed: 4242,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const noOverlap = set2.questions.length === 15 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`3. Multi-Set Duplicate Prevention: ${noOverlap ? "PASS" : "FAIL"}`);
if (!noOverlap) totalFailures++;

// 4. Engine B Mathematical Identity & Brute-Force Verification Checks
const zeroEvenCheck = independentlyVerifyPncModel({
  kind: "DIGIT_FORMATION",
  digits: [0, 1, 2, 3, 4, 5],
  length: 3,
  allowRepetition: false,
  condition: "EVEN",
});
const derang5Check = independentlyVerifyPncModel({ kind: "DERANGEMENT", n: 5 });
const mathChecksOk =
  zeroEvenCheck.ok && zeroEvenCheck.value === 52n &&
  derang5Check.ok && derang5Check.value === 44n;
console.log(`4. Brute-Force Checks (3-digit even from {0..5} = 52; !5 = 44): ${mathChecksOk ? "PASS" : "FAIL"}`);
if (!mathChecksOk) totalFailures++;

// 5. Engine B Adversarial & 5-Option Enforcement Tests
const adversarialCases = [
  {
    name: "Invalid permutation r > n",
    ok: independentlyVerifyPncModel({ kind: "PERM_BASIC", n: 4, r: 6 }).ok,
  },
  {
    name: "Invalid group sizes not summing to n",
    ok: independentlyVerifyPncModel({ kind: "GROUP_DIST", mode: "UNLABELLED_GROUPS", n: 8, sizes: [3, 3] }).ok,
  },
  {
    name: "Only 4 options provided instead of mandatory 5 options (A–E)",
    ok: validatePncQuestion({
      mathModel: { kind: "PERM_BASIC", n: 5, r: 5 },
      exactBigIntAnswer: 120n,
      correct_answer_value: 120,
      options: { A: "60", B: "120", C: "240", D: "720" },
      correct_answer: "B",
      correctOptionIndex: 1,
      solution: { concept: "Permutation", steps: ["Step 1", "Step 2"] },
    }).passed,
  },
  {
    name: "Tampered answer rejected by Engine B (forgetting repeated letter division)",
    ok: validatePncQuestion({
      mathModel: { kind: "WORD_ARRANGEMENT", word: "APPLE", mode: "ALL" },
      exactBigIntAnswer: 120n, // Tampered! True value is 5!/2! = 60
      correct_answer_value: 120,
      options: { A: "30", B: "60", C: "120", D: "240", E: "720" },
      correct_answer: "C",
      correctOptionIndex: 2,
      solution: { concept: "Permutation", steps: ["Step 1", "Step 2"] },
    }).passed,
  },
];

let boundaryErrors = 0;
for (const tc of adversarialCases) {
  if (tc.ok !== false) {
    console.error(`[FAIL] Engine B failed to reject: ${tc.name}`);
    boundaryErrors++;
    totalFailures++;
  }
}
console.log(`5. Engine B Adversarial & 5-Option Enforcement (${adversarialCases.length} checks): ${boundaryErrors === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Verified 5-Option P&C Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailures} FAILURES`} ===`);
process.exit(totalFailures === 0 ? 0 : 1);