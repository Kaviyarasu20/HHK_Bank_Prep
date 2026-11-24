// tests/auditApproximation.js
import { generateApproximationBatch } from "../generators/quant/approximation/index.js";

function runApproximationAudit() {
  const difficulties = ["EASY", "MEDIUM", "HARD"];
  let totalTested = 0;
  let errors = 0;

  for (const diff of difficulties) {
    const batch = generateApproximationBatch({
      exam: "IBPS_PO_PRELIMS",
      allowedTypes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      difficulty: diff,
      count: 400,
    });

    batch.forEach((q, idx) => {
      totalTested++;
      const uniqueOptions = new Set(q.options);
      const hasInvalid = q.options.some(
        (opt) => !opt || opt.includes("NaN") || opt.includes("undefined") || Number(opt) <= 0
      );

      if (
        q.options.length !== 5 ||
        uniqueOptions.size !== 5 ||
        q.correctOptionIndex < 0 ||
        q.options[q.correctOptionIndex] !== q.answer ||
        hasInvalid
      ) {
        console.error(`Audit failed [${diff}] at index ${idx}:`, q);
        errors++;
      }
    });
  }

  console.log(`Audited ${totalTested} Approximation questions across Types 1-12. Errors: ${errors}`);
}

runApproximationAudit();