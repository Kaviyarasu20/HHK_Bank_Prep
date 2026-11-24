// Place at: server/question-engine/tests/auditNumberSystem.js
import { generateNumberSystemBatch } from "../generators/quant/numberSystem/index.js";
import { validateEngineQuestion } from "../core/validator.js";

function runNumberSystemAudit() {
  let totalTested = 0;
  let errors = 0;

  for (let typeId = 1; typeId <= 29; typeId++) {
    const diff = typeId <= 14 ? "EASY" : typeId <= 24 ? "MEDIUM" : "HARD";
    const batch = generateNumberSystemBatch({
      exam: typeId >= 25 ? "IBPS_PO_MAINS" : "IBPS_PO_PRELIMS",
      allowedTypes: [typeId],
      difficulty: diff,
      count: 100,
    });

    batch.forEach((q, idx) => {
      totalTested++;
      const check = validateEngineQuestion(q);
      if (!check.valid) {
        console.error(`Audit failed [Type ${typeId}] #${idx}:`, check.reason, q);
        errors++;
      }
    });
  }

  console.log(
    `Audited ${totalTested} Number System questions (Level 1: 1-14, Level 2: 15-24, Level 3: 25-29). Errors: ${errors}`
  );
  if (errors > 0) process.exit(1);
}

runNumberSystemAudit();