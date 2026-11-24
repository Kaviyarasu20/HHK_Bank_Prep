import { isValueGroundedInSource } from "./caFactExtractor.js";

export function validateOneLiner({ oneLiner, sourceText = "", sourceFreshness = null }) {
  const errors = [];
  const warnings = [];
  const factText = String(oneLiner?.factText || "").trim();

  if (factText.length < 18) {
    errors.push("One-liner fact is too short to be self-contained (minimum 18 characters).");
  }
  if (factText.length > 340) {
    warnings.push("One-liner exceeds 340 characters; tighten wording while keeping key context.");
  }
  if (sourceFreshness && (sourceFreshness.state === "outdated" || sourceFreshness.state === "historical")) {
    errors.push(`Source reference is "${sourceFreshness.label}"; outdated references cannot be published as current one-liners.`);
  }

  // Verify numbers/percentages/figures appear in source text
  if (sourceText) {
    const nums = factText.match(/\d+(?:[.,]\d+)*%?/g) || [];
    for (const num of nums) {
      if (!isValueGroundedInSource(num, sourceText)) {
        errors.push(`Figure "${num}" in one-liner was not found in the original source.`);
      }
    }
  }

  // Reject fabricated URLs
  const urls = factText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  if (urls.length > 0) {
    warnings.push("Move URLs to sourceUrl metadata rather than embedding them inside factText.");
  }

  const status = errors.length > 0 ? "failed" : warnings.length > 0 ? "warnings" : "passed";
  return { status, errors, warnings };
}
