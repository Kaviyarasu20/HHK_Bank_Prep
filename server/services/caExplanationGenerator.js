/**
 * Explanation normalizer & grounding helper.
 * Ensures explanations are concise, exam-ready, and do not introduce fabricated URLs or claims.
 */

export function normalizeAndValidateExplanation({
  rawExplanation = "",
  correctOptionText = "",
  sourceReference = "",
  sourceText = "",
}) {
  const cleaned = String(rawExplanation || "").replace(/\s+/g, " ").trim().slice(0, 4000);
  const warnings = [];

  if (!cleaned) {
    if (correctOptionText && sourceReference) {
      return {
        explanation: `Correct answer: ${correctOptionText}. Supported by source: "${sourceReference}".`,
        warnings: ["Explanation was synthesized strictly from the source reference; review wording."],
      };
    }
    return { explanation: "", warnings: ["Explanation is empty."] };
  }

  // Flag any fabricated URL in explanation
  const urls = cleaned.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const lowerSrc = String(sourceText || "").toLowerCase();
  for (const u of urls) {
    if (!lowerSrc.includes(u.toLowerCase())) {
      warnings.push(`Explanation contains unverified URL: ${u}`);
    }
  }

  return { explanation: cleaned, warnings };
}
