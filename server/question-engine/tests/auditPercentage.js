// Place at: server/question-engine/tests/auditPercentage.js
import { generatePercentageBatch } from "../generators/quant/percentage/index.js";
import { validateEngineQuestion } from "../core/validator.js";

function runPercentageAudit() {
  let totalTested = 0;
  let errors = 0;

  // 15 Prelims Types
  for (let typeId = 1; typeId <= 15; typeId++) {
    const batch = generatePercentageBatch({
      exam: "IBPS_PO_PRELIMS",
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

  // 10 Mains Types
  for (let typeId = 1; typeId <= 10; typeId++) {
    const batch = generatePercentageBatch({
      exam: "IBPS_PO_MAINS",
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
    `Audited ${totalTested} Percentage questions (15 Prelims + 10 Mains types). Errors: ${errors}`
  );
  if (errors > 0) process.exit(1);
}

runPercentageAudit();