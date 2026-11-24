// Place at: server/question-engine/tests/auditTSD.js
import { generateTsdBatch, ALL_TSD_TEMPLATES } from "../generators/quant/timeSpeedDistance/index.js";
import { R } from "../generators/quant/timeSpeedDistance/tsdMath.js";
import { independentlyVerifyTsdModel, validateTsdQuestion } from "../generators/quant/timeSpeedDistance/tsdValidator.js";

console.log("=== HHK Time, Speed & Distance (TSD) Production QA Audit ===\n");

let totalPassed = 0;
let totalFailed = 0;

// 1. Exhaustive Template Coverage Audit across all 39 templates (Categories A - I)
for (const tpl of ALL_TSD_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generateTsdBatch({
    count: 5,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20260501 + ALL_TSD_TEMPLATES.indexOf(tpl) * 97,
  });

  if (questions.length < 3 || rejectedLogs.length > 0) {
    console.error(`[FAIL] ${tpl.id} (Cat ${tpl.category}): generated=${questions.length}, rejected=${rejectedLogs.length}`);
    if (rejectedLogs.length > 0) console.error("   First rejection:", rejectedLogs[0]);
    totalFailed++;
  } else {
    totalPassed += questions.length;
  }
}

console.log(`1. Template Coverage (${ALL_TSD_TEMPLATES.length} templates across Categories A–I): ${totalPassed} verified questions, ${totalFailed} template failures.`);

// 2. Seeded Reproducibility Check
const run1 = generateTsdBatch({ count: 15, difficulty: "Medium", seed: 777777 });
const run2 = generateTsdBatch({ count: 15, difficulty: "Medium", seed: 777777 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every((q, i) => q.question_text === run2.questions[i].question_text && q.answer === run2.questions[i].answer);
console.log(`2. Seeded Reproducibility (15 Qs, seed=777777): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailed++;

// 3. Boats & Streams Dedicated Mode Check
const boatsRun = generateTsdBatch({ count: 15, difficulty: "Medium", topicMode: "BOATS", seed: 888888 });
const boatsOk = boatsRun.questions.length === 15 && boatsRun.questions.every((q) => q.category === "E. Boats & Streams");
console.log(`3. Dedicated Boats & Streams Mode (15 Qs): ${boatsOk ? "PASS" : "FAIL"}`);
if (!boatsOk) totalFailed++;

// 4. Duplicate Prevention Across Multi-Set Generation
const set1 = generateTsdBatch({ count: 20, difficulty: "Medium", seed: 1001 });
const set2 = generateTsdBatch({
  count: 20,
  difficulty: "Medium",
  seed: 1001,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const zeroOverlap = set2.questions.length === 20 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`4. Multi-Set Duplicate Prevention (Set 1 vs Set 2): ${zeroOverlap ? "PASS" : "FAIL"}`);
if (!zeroOverlap) totalFailed++;

// 5. Engine B Adversarial Boundary & Tamper Rejection Tests
const adversarialCases = [
  {
    name: "Boat speed <= Stream speed",
    res: independentlyVerifyTsdModel({ kind: "BOAT_STREAM", boatSpeed: R(5), streamSpeed: R(5), solveFor: "UPSTREAM_SPEED" }),
    expectOk: false,
  },
  {
    name: "Same direction zero relative speed",
    res: independentlyVerifyTsdModel({ kind: "RELATIVE_MEETING", direction: "SAME", v1: R(40), v2: R(40), gap: R(100), solveFor: "MEETING_TIME" }),
    expectOk: false,
  },
  {
    name: "Circular track equal speed same direction",
    res: independentlyVerifyTsdModel({ kind: "CIRCULAR_TRACK", trackLen: R(400), v1: R(10), v2: R(10), direction: "SAME", solveFor: "MEETING_TIME" }),
    expectOk: false,
  },
  {
    name: "Stoppage speedIncl >= speedExcl",
    res: independentlyVerifyTsdModel({ kind: "STOPPAGE", speedExcl: R(50), speedIncl: R(55), solveFor: "STOPPAGE_MIN_PER_HR" }),
    expectOk: false,
  },
  {
    name: "Tampered answer rejected by Engine B",
    res: {
      ok: validateTsdQuestion({
        mathModel: { kind: "BASIC_SDT", solveFor: "SPEED", distance: R(120), time: R(3) },
        exactRationalAnswer: R(45), // Tampered! True answer is 40
        options: { A: "40 km/h", B: "45 km/h", C: "50 km/h", D: "60 km/h" },
        correct_answer: "B",
        correctOptionIndex: 1,
        unit: "km/h",
        solution: { steps: ["Step 1", "Step 2"] },
      }).passed,
    },
    expectOk: false,
  },
];

let boundaryFailures = 0;
for (const tc of adversarialCases) {
  if (tc.res.ok !== tc.expectOk) {
    console.error(`[FAIL] Adversarial test '${tc.name}' did not reject!`);
    boundaryFailures++;
    totalFailed++;
  }
}
console.log(`5. Engine B Adversarial & Tamper Rejection (${adversarialCases.length} checks): ${boundaryFailures === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Generated Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailed === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailed} FAILURES`} ===`);
process.exit(totalFailed === 0 ? 0 : 1);