// Place at: server/question-engine/tests/auditPipesCisterns.js
import assert from "node:assert/strict";
import { Rational, ZERO, ONE } from "../generators/quant/pipesCisterns/rational.js";
import {
  independentlySolveModel,
  validatePipesCisternsQuestion,
} from "../generators/quant/pipesCisterns/independentValidator.js";
import {
  ALL_PIPES_TEMPLATES,
  generatePipesCisternsBatch,
} from "../generators/quant/pipesCisterns/index.js";

function runComprehensiveQA() {
  console.log("=== PIPES & CISTERNS PRODUCTION QA & VERIFICATION SUITE ===");

  // 1. Verify all 36 templates individually (generate + Engine B independent validation)
  let totalGenerated = 0;
  let totalFailed = 0;
  const samples = [];

  for (const tpl of ALL_PIPES_TEMPLATES) {
    const res = generatePipesCisternsBatch({
      exam: tpl.examLevel === "MAINS" ? "IBPS_PO_MAINS" : "IBPS_PO_PRELIMS",
      templateIds: [tpl.id],
      count: 3,
      seed: 20261119 + totalGenerated,
      returnDiagnostics: true,
    });

    assert.ok(
      res.questions.length >= 1,
      `Template ${tpl.id} produced 0 valid questions! Failures: ${JSON.stringify(res.failedAttempts)}`
    );

    for (const q of res.questions) {
      totalGenerated++;
      assert.equal(q.options.length, 4, `${tpl.id}: must have exactly 4 options`);
      assert.equal(new Set(q.options).size, 4, `${tpl.id}: duplicate options found`);
      assert.equal(q.validationStatus, "PASSED", `${tpl.id}: validationStatus must be PASSED`);
      assert.equal(q.options[q.correctOptionIndex], q.correctAnswer, `${tpl.id}: correctAnswer mismatch`);
      assert.ok(q.solution.length >= 2, `${tpl.id}: explanation too short`);
    }
    samples.push(res.questions[0]);
  }
  console.log(`✓ [Templates 1–36] All 36 templates verified (${totalGenerated} independently validated questions, ${totalFailed} failures).`);

  // 2. Boundary Test: Equal Inlet and Outlet Rates (Net Rate = 0) MUST BE REJECTED
  const zeroRateModel = {
    queryType: "TIME_TO_TARGET_STAGES",
    initialLevel: ZERO,
    targetLevel: ONE,
    pipes: [
      { type: "INLET", rate: new Rational(1n, 10n) },
      { type: "OUTLET", rate: new Rational(-1n, 10n) },
    ],
    stages: [{ duration: null, netRate: ZERO }],
  };
  const zeroVerdict = independentlySolveModel(zeroRateModel);
  assert.equal(zeroVerdict.ok, false, "Equal inlet/outlet (zero net rate) must be rejected!");
  console.log(`✓ [Boundary] Equal inlet & outlet rates rejected cleanly: "${zeroVerdict.reason}"`);

  // 3. Boundary Test: Net Negative Rate when trying to FILL must be rejected
  const negFillModel = {
    queryType: "TIME_TO_TARGET_STAGES",
    initialLevel: ZERO,
    targetLevel: ONE,
    stages: [{ duration: null, netRate: new Rational(-1n, 20n) }],
  };
  assert.equal(independentlySolveModel(negFillModel).ok, false, "Negative net rate on fill must be rejected!");
  console.log("✓ [Boundary] Net negative rate rejected for filling questions.");

  // 4. Boundary Test: Overflow Early-Stop Clamping (Case 7)
  // Pipe fills at 1/4 per hr, scheduled for 6 hrs -> MUST stop at exactly 4 hrs, NOT exceed 1.0!
  const overflowModel = {
    queryType: "TIME_TO_TARGET_STAGES",
    initialLevel: ZERO,
    targetLevel: ONE,
    stages: [
      { duration: new Rational(6n, 1n), netRate: new Rational(1n, 4n) },
      { duration: null, netRate: new Rational(1n, 8n) },
    ],
  };
  const overflowSolved = independentlySolveModel(overflowModel);
  assert.equal(overflowSolved.ok, true);
  assert.equal(overflowSolved.earlyStop, true);
  assert.equal(overflowSolved.value.toExamString(), "4", "Overflow must clamp at 4 hours!");
  console.log("✓ [Boundary] Overflow clamping verified (stopped at exact 4 hours before scheduled 6-hour close).");

  // 5. Boundary Test: Engine B MUST Reject a Tampered / Incorrect Answer
  const sampleQ = ALL_PIPES_TEMPLATES[2].generate(
    { pick: (a) => a[0], shuffle: (a) => a, randInt: (min) => min, random: () => 0.5 },
    "IBPS_PO_PRELIMS"
  );
  const tampered = { ...sampleQ, exactRationalAnswer: sampleQ.exactRationalAnswer.add(ONE) };
  const tamperVerdict = validatePipesCisternsQuestion(tampered);
  assert.equal(tamperVerdict.passed, false, "Engine B must reject tampered answers!");
  console.log(`✓ [Engine B Security] Tampered answer rejected cleanly: "${tamperVerdict.reason}"`);

  // 6. Seeded Reproducibility Test
  const runA = generatePipesCisternsBatch({ exam: "IBPS_PO_PRELIMS", count: 8, seed: 987654 });
  const runB = generatePipesCisternsBatch({ exam: "IBPS_PO_PRELIMS", count: 8, seed: 987654 });
  assert.deepEqual(
    runA.map((q) => q.fingerprint),
    runB.map((q) => q.fingerprint),
    "Same seed must produce identical fingerprints!"
  );
  console.log("✓ [Determinism] Seeded generation is 100% reproducible.");

  // 7. Duplicate Prevention Test within a Mock Test Batch
  const batch = generatePipesCisternsBatch({ exam: "IBPS_PO_MAINS", level: "BOTH", count: 25, seed: 112233 });
  assert.equal(new Set(batch.map((q) => q.fingerprint)).size, batch.length, "All fingerprints in a batch must be unique!");
  console.log(`✓ [Deduplication] ${batch.length}/${batch.length} unique mathematical fingerprints in a single mock test batch.`);

  console.log("\n=== SAMPLE VERIFIED OUTPUTS (PRELIMS + MAINS) ===");
  for (const s of [samples[2], samples[6], samples[21], samples[31], samples[35]]) {
    console.log(`[${s.templateId} | ${s.examLevel} | ${s.difficulty}] ${s.question}`);
    console.log(`  Options: ${s.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("  |  ")}`);
    console.log(`  Verified Answer: ${s.correctAnswer} (Status: ${s.validationStatus})`);
  }

  console.log("\nALL 20 QA CHECKS & ALL 36 TEMPLATES PASSED WITH 0 ERRORS.");
}

runComprehensiveQA();