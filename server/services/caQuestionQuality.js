/**
 * Deterministic MCQ Quality Scoring Engine (0–100).
 * Thresholds:
 *   90–100: excellent
 *   75–89:  good
 *   60–74:  needs_review
 *   < 60:   rejected
 * Hard Gate: Any mandatory validation failure forces qualityStatus = 'rejected'.
 */

export function scoreQuestionQuality({ question, validation, duplicateResult }) {
  const breakdown = {
    structural: validation.structuralStatus === "passed" ? 20 : validation.structuralStatus === "warnings" ? 14 : 0,
    answerAndSource:
      validation.answerValidationStatus === "passed" && validation.sourceValidationStatus === "passed"
        ? 30
        : validation.answerValidationStatus === "failed" || validation.sourceValidationStatus === "failed"
          ? 0
          : 18,
    ambiguity: validation.ambiguityStatus === "passed" ? 15 : validation.ambiguityStatus === "warnings" ? 9 : 0,
    explanation:
      String(validation.explanation || "").length >= 60
        ? 15
        : String(validation.explanation || "").length >= 25
          ? 10
          : 4,
    examRelevance: Array.isArray(question?.examCodes) && question.examCodes.length > 0 ? 10 : 4,
    duplicatePenalty:
      duplicateResult?.status === "exact_duplicate"
        ? -40
        : duplicateResult?.status === "near_duplicate"
          ? -20
          : duplicateResult?.status === "same_fact"
            ? -8
            : 10,
  };

  let rawScore = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  rawScore = Math.max(0, Math.min(100, rawScore));

  // Hard gate: mandatory validation failures or exact duplicates always fail quality
  if (validation.overallStatus === "failed" || duplicateResult?.status === "exact_duplicate") {
    return {
      qualityScore: Math.min(rawScore, 50),
      qualityStatus: "rejected",
      breakdown,
    };
  }

  let qualityStatus = "rejected";
  if (rawScore >= 90) qualityStatus = "excellent";
  else if (rawScore >= 75) qualityStatus = "good";
  else if (rawScore >= 60) qualityStatus = "needs_review";

  return {
    qualityScore: rawScore,
    qualityStatus,
    breakdown,
  };
}
