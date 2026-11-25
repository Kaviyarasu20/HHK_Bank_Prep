import { validateOutboundFeedUrl } from "./caUrlSecurity.js";
import { parseFeedXml } from "./safeXmlParser.js";
import { computeContentHash } from "./caAiEngineService.js";

/**
 * Phase 9: Configurable Daily Current Affairs Automation & Trusted Source Ingestion.
 * - Fetches only from admin-configured trusted RSS/Atom/official sources using SSRF guards.
 * - Flags unverified sources rather than generating confident factual questions.
 * - Never fabricates news when external feeds are unreachable.
 */
function safeIsoDate(rawDate) {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function fetchTrustedSourceItems({ source, fetchFn = fetch, maxItems = 15 }) {
  if (!source?.feed_url) {
    throw Object.assign(new Error(`Source "${source?.name || "Unknown"}" has no configured feed URL.`), {
      status: 400,
    });
  }

  const urlCheck = await validateOutboundFeedUrl(source.feed_url);
  if (!urlCheck.ok) {
    throw Object.assign(new Error(urlCheck.error || "Invalid or blocked feed URL."), { status: 400 });
  }
  const safeUrl = urlCheck.url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let xmlText = "";
  try {
    const res = await fetchFn(safeUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HHK-Banking-CA-Ingestor/1.0)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Source feed returned HTTP ${res.status}.`);
    }
    xmlText = await res.text();
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Source feed timed out after 20 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const parsedFeed = parseFeedXml(xmlText);
  const rawItems = Array.isArray(parsedFeed?.items) ? parsedFeed.items : [];

  return rawItems
    .slice(0, maxItems)
    .map((item) => {
      const title = String(item.title || "").trim();
      const content = String(item.description || item.summary || item.content || title).trim();
      const link = item.link ? String(item.link).trim() : safeUrl;
      const pubDate = item.pubDateRaw || item.pubDate || item.published || item.updated || null;
      return {
        title: title.slice(0, 300),
        content: content.slice(0, 8000),
        sourceName: source.name,
        sourceUrl: link,
        publicationDate: safeIsoDate(pubDate),
        contentHash: computeContentHash(`${title} ${content.slice(0, 300)}`),
        verificationStatus: source.trust_level === "verified" ? "verified" : "unverified_flagged",
      };
    })
    .filter((it) => it.title.length > 0);
}