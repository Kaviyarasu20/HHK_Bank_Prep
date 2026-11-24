import { detectPromptInjectionSignals } from "./caBankingRelevance.js";

export const MIN_SOURCE_BODY_CHARS = 40;

/**
 * Validates source article suitability before invoking AI.
 * Refuses empty, too-short, or corrupted articles so AI cannot hallucinate.
 */
export function validateSourceArticleForAi(article) {
  const errors = [];
  const warnings = [];

  const title = String(article?.title || "").trim();
  const body = String(article?.body || "").trim();

  if (title.length < 8) {
    errors.push("Article title is too short for reliable AI structuring.");
  }
  if (body.length < MIN_SOURCE_BODY_CHARS) {
    errors.push(
      `Article body must contain at least ${MIN_SOURCE_BODY_CHARS} characters of source text to prevent unsupported claims.`,
    );
  }
  if (!String(article?.source_url || "").trim()) {
    warnings.push("Original article is missing a verified source URL; review carefully before approval.");
  }

  const injectionHits = detectPromptInjectionSignals(`${title}\n${body}`);
  if (injectionHits.length > 0) {
    warnings.push(
      "Potential prompt-injection phrasing detected in article text; strict isolation applied and manual review required.",
    );
  }

  return { ok: errors.length === 0, errors, warnings, hasPromptInjectionSignal: injectionHits.length > 0 };
}

/**
 * Validates structured AI output against schema, source-grounding, and URL safety rules.
 */
export function validateStructuredAiOutput({
  article,
  structured,
  ungroundedFactWarnings = [],
  sourceWarnings = [],
}) {
  const errors = [];
  const warnings = [...sourceWarnings, ...ungroundedFactWarnings];

  if (!structured || typeof structured !== "object") {
    return { status: "failed", errors: ["AI output is not a valid object."], warnings };
  }

  if (!structured.examHeadline || structured.examHeadline.length < 6) {
    errors.push("Missing or too-short examHeadline.");
  }
  if (!structured.summary || structured.summary.length < 20) {
    errors.push("Missing or too-short summary.");
  }
  if (!structured.detailedExplanation || structured.detailedExplanation.length < 25) {
    errors.push("Missing or too-short detailedExplanation.");
  }
  if (
    !Number.isFinite(structured.bankingRelevanceScore) ||
    structured.bankingRelevanceScore < 0 ||
    structured.bankingRelevanceScore > 100
  ) {
    errors.push("bankingRelevanceScore must be an integer between 0 and 100.");
  }
  if (!structured.relevanceReason || structured.relevanceReason.length < 10) {
    errors.push("Missing relevanceReason explaining the banking relevance score.");
  }
  if (!Array.isArray(structured.takeaways) || structured.takeaways.length === 0) {
    warnings.push("AI returned zero exam-oriented takeaways.");
  }

  // Reject fabricated URLs inside AI summary/explanation that are not in the original article
  const originalText = `${article?.title || ""} ${article?.body || ""} ${article?.source_url || ""}`.toLowerCase();
  const aiText = `${structured.summary || ""} ${structured.detailedExplanation || ""} ${structured.whyItMatters || ""}`;
  const urlsInAi = aiText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  for (const foundUrl of urlsInAi) {
    if (!originalText.includes(foundUrl.toLowerCase())) {
      errors.push(`AI output introduced an unverified URL not present in the source article: ${foundUrl}`);
    }
  }

  // Check for obvious prompt-injection leakage (e.g. secret/env terms)
  if (/(SESSION_SECRET|DATABASE_URL|RAZORPAY_KEY_SECRET|CA_AI_API_KEY)/i.test(aiText)) {
    errors.push("AI output contains disallowed internal configuration tokens.");
  }

  if (errors.length > 0) {
    return { status: "failed", errors, warnings };
  }
  if (warnings.length > 0) {
    return { status: "warnings", errors: [], warnings };
  }
  return { status: "passed", errors: [], warnings: [] };
}
