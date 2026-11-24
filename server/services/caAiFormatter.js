import { buildArticleStructuringPrompt } from "./caAiPromptBuilder.js";
import { executeAiCompletion } from "./caAiProvider.js";
import { evaluateBankingRelevanceResult } from "./caBankingRelevance.js";
import { extractAndNormalizeFacts } from "./caFactExtractor.js";
import { extractAndLinkStaticGk, normalizeImportantTerms } from "./caStaticGkExtractor.js";
import { validateSourceArticleForAi, validateStructuredAiOutput } from "./caAiValidator.js";

function parseJsonSafely(rawText) {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) {
    throw new Error("AI provider returned an empty response.");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI provider returned malformed JSON.");
  }
}

/**
 * End-to-end Current Affairs AI Structuring & Banking Relevance Triage orchestrator.
 * Always produces a draft/reviewable result — NEVER auto-publishes.
 */
export async function formatArticleWithAi(
  article,
  { db = null, env = process.env, fetchFn = fetch, providerFn = null } = {},
) {
  const sourceCheck = validateSourceArticleForAi(article);
  if (!sourceCheck.ok) {
    return {
      ok: false,
      processingStatus: "validation_failed",
      validationStatus: "failed",
      validationErrors: sourceCheck.errors,
      validationWarnings: sourceCheck.warnings,
      provider: "none",
      model: "",
      promptVersion: "ca-phase5-v1.0",
      structured: null,
      rawResponse: {},
      usage: {},
      errorMessage: sourceCheck.errors.join(" "),
    };
  }

  const { promptVersion, systemPrompt, userPrompt } = buildArticleStructuringPrompt(article);

  let completion;
  try {
    completion = await executeAiCompletion({
      systemPrompt,
      userPrompt,
      env,
      fetchFn,
      providerFn,
    });
  } catch (err) {
    return {
      ok: false,
      processingStatus: "failed",
      validationStatus: "failed",
      validationErrors: [err.message || "AI provider request failed."],
      validationWarnings: sourceCheck.warnings,
      provider: "configured",
      model: "",
      promptVersion,
      structured: null,
      rawResponse: {},
      usage: {},
      errorMessage: err.message || "AI provider request failed.",
    };
  }

  let parsed;
  try {
    parsed = parseJsonSafely(completion.rawText);
  } catch (err) {
    return {
      ok: false,
      processingStatus: "validation_failed",
      validationStatus: "failed",
      validationErrors: [err.message],
      validationWarnings: sourceCheck.warnings,
      provider: completion.provider || "mock",
      model: completion.model || "",
      promptVersion,
      structured: null,
      rawResponse: { rawTextSnippet: String(completion.rawText || "").slice(0, 500) },
      usage: completion.usage || {},
      errorMessage: err.message,
    };
  }

  const relevance = evaluateBankingRelevanceResult(parsed);
  const sourceText = `${article.title || ""}\n${article.body || ""}`;
  const { facts, ungroundedWarnings } = extractAndNormalizeFacts(parsed.facts, sourceText);
  const importantTerms = normalizeImportantTerms(parsed.importantTerms);
  const staticGkConnections = await extractAndLinkStaticGk(parsed.staticGkConnections, db);

  const takeaways = Array.isArray(parsed.takeaways)
    ? parsed.takeaways.map((t) => String(t || "").trim()).filter((t) => t.length >= 4).slice(0, 12)
    : [];

  const structured = {
    examHeadline: String(parsed.examHeadline || "").trim().slice(0, 240),
    summary: String(parsed.summary || "").trim().slice(0, 2000),
    detailedExplanation: String(parsed.detailedExplanation || "").trim().slice(0, 6000),
    whyItMatters: String(parsed.whyItMatters || "").trim().slice(0, 1500),
    takeaways,
    importantTerms,
    ...relevance,
    facts,
    staticGkConnections,
  };

  const validation = validateStructuredAiOutput({
    article,
    structured,
    ungroundedFactWarnings: ungroundedWarnings,
    sourceWarnings: sourceCheck.warnings,
  });

  const processingStatus =
    validation.status === "failed"
      ? "validation_failed"
      : validation.status === "warnings"
        ? "review_required"
        : "completed";

  return {
    ok: validation.status !== "failed",
    processingStatus,
    validationStatus: validation.status,
    validationErrors: [...validation.errors, ...validation.warnings],
    validationWarnings: validation.warnings,
    provider: completion.provider || "mock",
    model: completion.model || "",
    promptVersion,
    structured,
    rawResponse: parsed,
    usage: completion.usage || {},
    errorMessage: validation.errors.join(" "),
  };
}
