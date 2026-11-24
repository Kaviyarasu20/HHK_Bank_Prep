/**
 * Fact Extractor & Grounding Verifier.
 * Normalizes AI-extracted facts, preserves units & event stage, and verifies
 * that numeric/percentage/date values appear in the original source text.
 */

const VALID_FACT_TYPES = new Set([
  "date",
  "figure",
  "percentage",
  "monetary_value",
  "institution",
  "person",
  "scheme",
  "location",
  "agreement",
  "report",
  "award",
  "appointment",
  "general",
]);

const VALID_EVENT_STAGES = new Set([
  "announced",
  "proposed",
  "approved",
  "implemented",
  "completed",
  "unspecified",
]);

function normalizeNumericToken(str) {
  return String(str || "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function isValueGroundedInSource(factValue, sourceText) {
  const val = String(factValue || "").trim();
  if (!val) return true;
  const normSource = normalizeNumericToken(sourceText);
  const normVal = normalizeNumericToken(val);
  if (normSource.includes(normVal)) return true;

  // Extract core digits (e.g. "6.50" from "6.50%" or "10900" from "Rs 10,900 crore")
  const digits = val.match(/\d+(?:[.,]\d+)*/g) || [];
  if (!digits.length) {
    // Non-numeric text value (name/institution/location): check case-insensitive word presence
    return String(sourceText || "").toLowerCase().includes(val.toLowerCase());
  }
  return digits.every((d) => {
    const clean = d.replace(/,/g, "");
    return normSource.includes(clean) || normSource.includes(String(Number(clean)));
  });
}

export function extractAndNormalizeFacts(rawFacts = [], sourceText = "") {
  if (!Array.isArray(rawFacts)) return { facts: [], ungroundedWarnings: [] };

  const facts = [];
  const ungroundedWarnings = [];

  for (const raw of rawFacts.slice(0, 30)) {
    const factText = String(raw?.factText || raw?.fact_text || "").trim().slice(0, 500);
    if (factText.length < 4) continue;

    const rawType = String(raw?.factType || raw?.fact_type || "general").trim().toLowerCase();
    const factType = VALID_FACT_TYPES.has(rawType) ? rawType : "general";

    const rawStage = String(raw?.eventStage || raw?.event_stage || "unspecified").trim().toLowerCase();
    const eventStage = VALID_EVENT_STAGES.has(rawStage) ? rawStage : "unspecified";

    const factValue = String(raw?.factValue ?? raw?.fact_value ?? "").trim().slice(0, 120);
    const unit = String(raw?.unit ?? "").trim().slice(0, 40);
    const context = String(raw?.context ?? "").trim().slice(0, 400);
    const sourceReference = String(raw?.sourceReference ?? raw?.source_reference ?? "").trim().slice(0, 300);
    const confidenceScore =
      raw?.confidenceScore != null && Number.isFinite(Number(raw.confidenceScore))
        ? Math.max(0, Math.min(1, Number(raw.confidenceScore)))
        : null;

    const needsNumericCheck = ["date", "figure", "percentage", "monetary_value"].includes(factType);
    if (needsNumericCheck && factValue && !isValueGroundedInSource(factValue, sourceText)) {
      ungroundedWarnings.push(
        `Extracted ${factType} value "${factValue}" was not found verbatim in the original article.`,
      );
    }

    facts.push({
      factType,
      factText,
      factValue,
      unit,
      eventStage,
      context,
      sourceReference,
      confidenceScore,
    });
  }

  return { facts, ungroundedWarnings };
}
