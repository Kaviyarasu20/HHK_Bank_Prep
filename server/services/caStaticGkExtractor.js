/**
 * Static GK & Important Terminology Extractor.
 * Links AI-identified Static GK connections to verified Phase 4 Reference Hub
 * records when an exact published match exists—never auto-creating duplicates.
 */

const VALID_REF_TYPES = new Set([
  "institution",
  "regulatory_body",
  "terminology",
  "static_gk",
  "scheme",
  "general",
]);

export function normalizeImportantTerms(rawTerms = []) {
  if (!Array.isArray(rawTerms)) return [];
  const seen = new Set();
  const out = [];
  for (const t of rawTerms.slice(0, 15)) {
    const term = String(t?.term || "").trim().slice(0, 120);
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push({
      term,
      fullForm: String(t?.fullForm || t?.full_form || "").trim().slice(0, 180),
      definition: String(t?.definition || "").trim().slice(0, 600),
      contextInArticle: String(t?.contextInArticle || t?.context_in_article || "").trim().slice(0, 300),
      relatedTopic: String(t?.relatedTopic || t?.related_topic || "").trim().slice(0, 100),
    });
  }
  return out;
}

export async function extractAndLinkStaticGk(rawConnections = [], db = null) {
  if (!Array.isArray(rawConnections)) return [];
  const normalized = [];
  const seen = new Set();

  for (const item of rawConnections.slice(0, 12)) {
    const title = String(item?.title || "").trim().slice(0, 180);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());

    const rawType = String(item?.referenceType || item?.reference_type || "general")
      .trim()
      .toLowerCase();
    const referenceType = VALID_REF_TYPES.has(rawType) ? rawType : "general";
    const description = String(item?.description || "").trim().slice(0, 800);
    const sourceReference = String(item?.sourceReference || item?.source_reference || "")
      .trim()
      .slice(0, 240);

    let referenceId = null;
    if (db) {
      try {
        if (referenceType === "institution") {
          const hit = await db.query(
            `SELECT id FROM banking_institutions
             WHERE status = 'published'
               AND (lower(institution_name) = lower($1) OR lower(short_name) = lower($1))
             LIMIT 1`,
            [title],
          );
          referenceId = hit.rows[0]?.id ?? null;
        } else if (referenceType === "regulatory_body") {
          const hit = await db.query(
            `SELECT id FROM banking_regulatory_bodies
             WHERE status = 'published'
               AND (lower(organization_name) = lower($1) OR lower(short_name) = lower($1))
             LIMIT 1`,
            [title],
          );
          referenceId = hit.rows[0]?.id ?? null;
        } else if (referenceType === "terminology") {
          const hit = await db.query(
            `SELECT id FROM banking_terminology
             WHERE status = 'published'
               AND (lower(term) = lower($1) OR lower(abbreviation) = lower($1))
             LIMIT 1`,
            [title],
          );
          referenceId = hit.rows[0]?.id ?? null;
        } else if (referenceType === "static_gk") {
          const hit = await db.query(
            `SELECT id FROM banking_static_gk
             WHERE status = 'published' AND lower(title) = lower($1)
             LIMIT 1`,
            [title],
          );
          referenceId = hit.rows[0]?.id ?? null;
        }
      } catch {
        // Non-fatal: Phase 4 reference link remains null if table/match unavailable
        referenceId = null;
      }
    }

    normalized.push({
      title,
      description,
      referenceType,
      referenceId,
      sourceReference,
    });
  }

  return normalized;
}
