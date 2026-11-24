// tests/auditGenerator.js
import { generateSimplificationBatch } from "../generators/quant/simplification/index.js";
import { generateApproximationBatch } from "../generators/quant/approximation/index.js";
import { generateFromQuestionEngine } from "../core/engineRouter.js";
import { validateEngineQuestion } from "../core/validator.js";

function runAudit() {
  const difficulties = ["EASY", "MEDIUM", "HARD"];
  let simpTested = 0;
  let approxTested = 0;
  let errors = 0;

  // 1. Audit all 9 Simplification types across EASY, MEDIUM, HARD
  for (const diff of difficulties) {
    const batch = generateSimplificationBatch({
      exam: "IBPS_CLERK_PRELIMS",
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      difficulty: diff,
      count: 400,
    });

    batch.forEach((q, idx) => {
      simpTested++;
      const check = validateEngineQuestion(q);
      if (!check.valid || q.options.some((opt) => opt.startsWith("-"))) {
        console.error(`Simplification Audit failed [${diff}] at index ${idx}:`, check.reason, q);
        errors++;
      }
    });
  }

  // 2. Audit all 12 Approximation types across EASY, MEDIUM, HARD
  for (const diff of difficulties) {
    const batch = generateApproximationBatch({
      exam: "IBPS_PO_PRELIMS",
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficulty: diff,
      count: 400,
    });

    batch.forEach((q, idx) => {
      approxTested++;
      const check = validateEngineQuestion(q);
      if (!check.valid || q.options.some((opt) => Number(opt) <= 0)) {
        console.error(`Approximation Audit failed [${diff}] at index ${idx}:`, check.reason, q);
        errors++;
      }
    });
  }

  // 3. Audit HHK formatted questions via engineRouter
  const hhkBatch = generateFromQuestionEngine({
    examCode: "IBPS_PO",
    stageName: "Prelims",
    topicName: "Simplification & Approximation",
    subtopicName: "",
    difficulty: "medium",
    count: 100,
  });

  hhkBatch.forEach((hq, idx) => {
    if (
      !Array.isArray(hq.options) ||
      hq.options.length !== 5 ||
      !["A", "B", "C", "D", "E"].includes(hq.correctAnswer) ||
      !hq.explanation
    ) {
      console.error(`HHK Router format check failed at index ${idx}:`, hq);
      errors++;
    }
  });

  console.log(
    `Audited ${simpTested} Simplification (Types 1-9) + ${approxTested} Approximation (Types 1-12) + ${hhkBatch.length} HHK Router questions. Total Logic/Format Errors: ${errors}`
  );
  if (errors > 0) {
    process.exit(1);
  }
}

runAudit();