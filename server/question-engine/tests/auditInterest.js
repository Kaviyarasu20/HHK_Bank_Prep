// Place at: server/question-engine/tests/auditInterest.js
import { generateInterestBatch } from "../generators/quant/interest/index.js";
import { validateEngineQuestion } from "../core/validator.js";

function runInterestAudit() {
  let totalTested = 0;
  let errors = 0;

  // 20 Prelims Types (SI 1-10, CI 11-20)
  for (let typeId = 1; typeId <= 20; typeId++) {
    const batch = generateInterestBatch({
      exam: "IBPS_PO_PRELIMS",
      interestMode: "BOTH",
      level: "PRELIMS",
      allowedTypes: [typeId],
      difficulty: "MEDIUM",
      count: 100,
    });
    batch.forEach((q, idx) => {
      totalTested++;
      const check = validateEngineQuestion(q);
      if (!check.valid) {
        console.error(`Audit failed [PRELIMS Type ${typeId}] #${idx}:`, check.reason, q);
        errors++;
      }
    });
  }

  // 14 Mains Types (SI 1-4, CI 5-14)
  for (let typeId = 1; typeId <= 14; typeId++) {
    const batch = generateInterestBatch({
      exam: "IBPS_PO_MAINS",
      interestMode: "BOTH",
      level: "MAINS",
      allowedTypes: [typeId],
      difficulty: "HARD",
      count: 100,
    });
    batch.forEach((q, idx) => {
      totalTested++;
      const check = validateEngineQuestion(q);
      if (!check.valid) {
        console.error(`Audit failed [MAINS Type ${typeId}] #${idx}:`, check.reason, q);
        errors++;
      }
    });
  }

  console.log(
    `Audited ${totalTested} Simple & Compound Interest questions (20 Prelims + 14 Mains types). Errors: ${errors}`
  );
  if (errors > 0) process.exit(1);
}

runInterestAudit();