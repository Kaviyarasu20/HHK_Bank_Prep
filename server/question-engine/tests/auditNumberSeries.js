// tests/auditNumberSeries.js
import { generateNumberSeriesBatch } from "../generators/quant/numberSeries/index.js";
import { validateEngineQuestion } from "../core/validator.js";

function runNumberSeriesAudit() {
  const difficulties = ["EASY", "MEDIUM", "HARD"];
  let totalTested = 0;
  let errors = 0;

  for (const diff of difficulties) {
    for (const mode of ["MISSING", "WRONG"]) {
      const batch = generateNumberSeriesBatch({
        exam: "IBPS_PO_PRELIMS",
        allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8],
        difficulty: diff,
        mode,
        count: 300,
      });

      batch.forEach((q, idx) => {
        totalTested++;
        const check = validateEngineQuestion(q);
        const hasInvalidOpt = q.options.some((opt) => Number(opt) <= 0);
        if (!check.valid || hasInvalidOpt) {
          console.error(`Number Series Audit failed [${mode}][${diff}] at ${idx}:`, check.reason, q);
          errors++;
        }
      });
    }
  }

  console.log(
    `Audited ${totalTested} Number Series questions (Missing & Wrong, Types 1-8, EASY/MEDIUM/HARD). Errors: ${errors}`
  );
  if (errors > 0) process.exit(1);
}

runNumberSeriesAudit();
