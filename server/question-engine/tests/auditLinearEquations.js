// Place at: server/question-engine/tests/auditLinearEquations.js
import { generateLinearEquationsBatch } from "../generators/quant/linearEquations/index.js";
import { validateEngineQuestion } from "../core/validator.js";

function runLinearEquationsAudit() {
  let totalTested = 0;
  let errors = 0;

  for (const level of ["PRELIMS", "MAINS"]) {
    for (let typeId = 1; typeId <= 15; typeId++) {
      const batch = generateLinearEquationsBatch({
        exam: level === "MAINS" ? "IBPS_PO_MAINS" : "IBPS_PO_PRELIMS",
        level,
        allowedTypes: [typeId],
        difficulty: level === "MAINS" ? "HARD" : "MEDIUM",
        count: 100,
      });

      batch.forEach((q, idx) => {
        totalTested++;
        const check = validateEngineQuestion(q);
        if (!check.valid) {
          console.error(`Audit failed [${level} Type ${typeId}] #${idx}:`, check.reason, q);
          errors++;
        }
      });
    }
  }

  console.log(
    `Audited ${totalTested} Linear Simultaneous Equations (15 Prelims + 15 Mains types). Errors: ${errors}`
  );
  if (errors > 0) process.exit(1);
}

runLinearEquationsAudit();