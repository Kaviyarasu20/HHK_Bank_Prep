// Place at: server/question-engine/tests/auditPartnership.js
import {
  generatePartnershipBatch,
  ALL_PARTNERSHIP_TEMPLATES,
} from "../generators/quant/partnership/index.js";
import { R } from "../generators/quant/partnership/partnershipMath.js";
import {
  independentlyVerifyPartnershipModel,
  validatePartnershipQuestion,
} from "../generators/quant/partnership/partnershipValidator.js";

console.log("=== HHK Partnership Production QA Audit (5-Option Standard) ===\n");

let totalVerified = 0;
let totalFailures = 0;
const answerPositionDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

// 1. Exhaustive Template Coverage Audit across all 26 templates (Categories A–G)
for (const tpl of ALL_PARTNERSHIP_TEMPLATES) {
  const diff = tpl.difficulties[0];
  const { questions, rejectedLogs } = generatePartnershipBatch({
    count: 4,
    difficulty: diff,
    templateId: tpl.id,
    seed: 20261120 + ALL_PARTNERSHIP_TEMPLATES.indexOf(tpl) * 107,
  });

  if (questions.length < 2 || rejectedLogs.length > 0) {
    console.error(`[FAIL] ${tpl.id} (Cat ${tpl.category}): generated=${questions.length}, rejected=${rejectedLogs.length}`);
    if (rejectedLogs.length > 0) console.error("   Rejection:", rejectedLogs[0]);
    totalFailures++;
  } else {
    for (const q of questions) {
      if (q.optionsArray.length !== 5 || Object.keys(q.options).length !== 5) {
        console.error(`[FAIL] ${tpl.id} did not produce exactly 5 options!`);
        totalFailures++;
      }
      answerPositionDist[q.correct_answer]++;
      totalVerified++;
    }
  }
}
console.log(
  `1. Template Coverage (${ALL_PARTNERSHIP_TEMPLATES.length} templates across Categories A–G): ${totalVerified} verified 5-option questions, ${totalFailures} failures.`
);
console.log(`   Correct Answer Position Distribution (A–E):`, answerPositionDist);

// 2. Seeded Reproducibility Check
const run1 = generatePartnershipBatch({ count: 15, difficulty: "Medium", seed: 444555 });
const run2 = generatePartnershipBatch({ count: 15, difficulty: "Medium", seed: 444555 });
const reproducible =
  run1.questions.length === 15 &&
  run1.questions.every(
    (q, i) => q.question === run2.questions[i].question && q.correct_answer_value === run2.questions[i].correct_answer_value
  );
console.log(`2. Seeded Reproducibility (15 Qs): ${reproducible ? "PASS" : "FAIL"}`);
if (!reproducible) totalFailures++;

// 3. Multi-Set Duplicate Prevention Check
const set1 = generatePartnershipBatch({ count: 15, difficulty: "Medium", seed: 8080 });
const set2 = generatePartnershipBatch({
  count: 15,
  difficulty: "Medium",
  seed: 8080,
  excludeFingerprints: set1.questions.map((q) => q.fingerprint),
});
const set1Fps = new Set(set1.questions.map((q) => q.fingerprint));
const noOverlap = set2.questions.length === 15 && set2.questions.every((q) => !set1Fps.has(q.fingerprint));
console.log(`3. Multi-Set Duplicate Prevention: ${noOverlap ? "PASS" : "FAIL"}`);
if (!noOverlap) totalFailures++;

// 4. Engine B Adversarial Boundary & Tamper Rejection Tests
const adversarialCases = [
  {
    name: "Partner duration exceeds 12-month business period",
    ok: independentlyVerifyPartnershipModel({
      kind: "PROFIT_RATIO",
      businessMonths: R(12),
      partners: [
        { name: "A", segments: [{ capital: R(20000), months: R(15) }] },
        { name: "B", segments: [{ capital: R(30000), months: R(12) }] },
      ],
    }).ok,
  },
  {
    name: "Salary + Commission exceeds total profit (negative distributable profit)",
    ok: independentlyVerifyPartnershipModel({
      kind: "PROFIT_DISTRIBUTION",
      businessMonths: R(12),
      totalProfit: R(10000),
      salaryTotal: R(12000),
      commissionPct: R(10),
      workingPartnerIdx: 0,
      targetIdx: 0,
      partners: [
        { name: "A", segments: [{ capital: R(20000), months: R(12) }] },
        { name: "B", segments: [{ capital: R(30000), months: R(12) }] },
      ],
    }).ok,
  },
  {
    name: "Only 4 options provided instead of mandatory 5 options (A–E)",
    ok: validatePartnershipQuestion({
      mathModel: {
        kind: "PROFIT_RATIO",
        businessMonths: R(12),
        partners: [
          { name: "A", segments: [{ capital: R(20000), months: R(12) }] },
          { name: "B", segments: [{ capital: R(30000), months: R(12) }] },
        ],
      },
      ratioAnswer: "2 : 3",
      options: { A: "2 : 3", B: "3 : 2", C: "4 : 5", D: "1 : 2" },
      correct_answer: "A",
      correctOptionIndex: 0,
      solution: { steps: ["Step 1", "Step 2"] },
    }).passed,
  },
  {
    name: "Tampered answer rejected by Engine B",
    ok: validatePartnershipQuestion({
      mathModel: {
        kind: "PROFIT_DISTRIBUTION",
        businessMonths: R(12),
        totalProfit: R(25000),
        targetIdx: 0,
        ask: "TARGET_PROFIT_SHARE",
        partners: [
          { name: "A", segments: [{ capital: R(40000), months: R(12) }] },
          { name: "B", segments: [{ capital: R(60000), months: R(12) }] },
        ],
      },
      exactRationalAnswer: R(12000), // Tampered! True share is 10000
      options: { A: "₹10,000", B: "₹12,000", C: "₹15,000", D: "₹11,000", E: "₹9,000" },
      correct_answer: "B",
      correctOptionIndex: 1,
      isCurrency: true,
      solution: { steps: ["Step 1", "Step 2"] },
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
console.log(`4. Engine B Adversarial & 5-Option Enforcement (${adversarialCases.length} checks): ${boundaryErrors === 0 ? "PASS" : "FAIL"}`);

console.log("\n=== Sample Verified 5-Option Partnership Question ===");
console.log(JSON.stringify(run1.questions[0], null, 2));

console.log(`\n=== FINAL AUDIT STATUS: ${totalFailures === 0 ? "ALL CHECKS PASSED (0 ERRORS)" : `${totalFailures} FAILURES`} ===`);
process.exit(totalFailures === 0 ? 0 : 1);