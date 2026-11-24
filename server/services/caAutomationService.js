import { validateAndNormalizeSourceUrl } from "./caUrlSecurity.js";
import { parseFeedXml } from "./safeXmlParser.js";
import { computeContentHash } from "./caAiEngineService.js";

/**
 * Phase 9: Configurable Daily Current Affairs Automation & Trusted Source Ingestion.
 * - Fetches only from admin-configured trusted RSS/official sources using SSRF guards.
 * - Flags unverified sources rather than generating confident factual questions.
 * - Never fabricates news when external feeds are unreachable.
 */
export async function fetchTrustedSourceItems({ source, fetchFn = fetch, maxItems = 15 }) {
  if (!source?.feed_url) {
    throw Object.assign(new Error(`Source "${source?.name || "Unknown"}" has no configured feed URL.`), {
      status: 400,
    });
  }

  const safeUrl = validateAndNormalizeSourceUrl(source.feed_url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let xmlText = "";
  try {
    const res = await fetchFn(safeUrl, {
      method: "GET",
      headers: { "User-Agent": "HHK-Banking-CA-Ingestor/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Source feed returned HTTP ${res.status}.`);
    }
    xmlText = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const parsedItems = parseFeedXml(xmlText).slice(0, maxItems);
  return parsedItems.map((item) => {
    const title = String(item.title || "").trim();
    const content = String(item.description || item.summary || item.content || title).trim();
    const link = item.link ? String(item.link).trim() : safeUrl;
    const pubDate = item.pubDate || item.published || item.updated || null;
    return {
      title: title.slice(0, 300),
      content: content.slice(0, 8000),
      sourceName: source.name,
      sourceUrl: link,
      publicationDate: pubDate ? new Date(pubDate).toISOString() : null,
      contentHash: computeContentHash(`${title} ${content.slice(0, 300)}`),
      verificationStatus: source.trust_level === "verified" ? "verified" : "unverified_flagged",
    };
  });
}
