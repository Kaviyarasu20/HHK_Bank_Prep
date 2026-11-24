import { validateAndNormalizeSourceUrl } from "./caUrlSecurity.js";
import { SUPPORTED_EXAM_CODES } from "./caExamMapper.js";

/**
 * Monthly Capsule Publication Safeguards Validator.
 * Verifies title, month/year, >=1 section, valid exam tags, valid source URLs,
 * and ensures zero unapproved/draft linked items before publication.
 */
export function validateMonthlyCapsuleForPublish({
  capsule,
  sections = [],
  links = [],
  examTags = [],
  unapprovedLinks = [],
}) {
  const errors = [];
  const warnings = [];

  if (!capsule || String(capsule.title || "").trim().length < 4) {
    errors.push("Capsule title must be at least 4 characters.");
  }
  const yr = Number(capsule?.capsule_year);
  const mo = Number(capsule?.capsule_month);
  if (!Number.isInteger(yr) || yr < 2020 || yr > 2100) {
    errors.push("Capsule year is invalid.");
  }
  if (!Number.isInteger(mo) || mo < 1 || mo > 12) {
    errors.push("Capsule month must be between 1 and 12.");
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("Capsule must contain at least one section before publishing.");
  }
  if (!Array.isArray(links) || links.length === 0) {
    warnings.push("Capsule currently has zero linked content items.");
  }
  if (Array.isArray(unapprovedLinks) && unapprovedLinks.length > 0) {
    errors.push(
      `${unapprovedLinks.length} linked content item(s) are not approved/published. Remove or approve them first.`,
    );
  }

  // Validate exam tags
  const validSet = new Set(SUPPORTED_EXAM_CODES);
  for (const tag of examTags) {
    const code = typeof tag === "string" ? tag : tag.exam_code;
    if (!validSet.has(code)) {
      errors.push(`Unsupported exam tag: "${code}".`);
    }
  }

  // Validate source URLs on links
  for (const link of links) {
    if (link.source_url) {
      const check = validateAndNormalizeSourceUrl(link.source_url, { allowEmpty: false });
      if (!check.ok) {
        errors.push(`Invalid source URL on linked ${link.content_type}: ${check.error}`);
      }
    }
  }

  const status = errors.length > 0 ? "failed" : warnings.length > 0 ? "warnings" : "passed";
  return { ok: errors.length === 0, status, errors, warnings };
}
