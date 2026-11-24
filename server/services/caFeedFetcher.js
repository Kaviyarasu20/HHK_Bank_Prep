import {
  computeArticleContentHash,
  validateAndNormalizeSourceUrl,
  validateOutboundFeedUrl,
} from "./caUrlSecurity.js";
import { parseFeedXml } from "./safeXmlParser.js";

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CONCURRENCY = 2;

export const APPROVED_RSS_DOMAINS = [
  "rbi.org.in",
  "www.rbi.org.in",
  "pib.gov.in",
  "www.pib.gov.in",
  "news.google.com",
];

export const FEEDS = {
  rbi: {
    key: "rbi",
    label: "RBI Press Releases",
    sourceName: "RBI",
    url: "https://rbi.org.in/pressreleases_rss.xml",
    allowedDomains: ["rbi.org.in", "www.rbi.org.in"],
    defaultCategory: "RBI Updates",
  },
  pib: {
    key: "pib",
    label: "PIB India Press Releases",
    sourceName: "PIB",
    url: "https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
    fallbackUrl:
      "https://news.google.com/rss/search?q=site:pib.gov.in&hl=en-IN&gl=IN&ceid=IN:en",
    allowedDomains: ["pib.gov.in", "www.pib.gov.in", "news.google.com"],
    defaultCategory: "National",
  },
};

const REQUEST_HEADERS = {
  "User-Agent": "HHK-BankingPrep-FeedReader/2.0 (+https://hhk.local)",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "en-IN,en;q=0.9",
};

export function detectCategory(title, description, fallback) {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(rbi|reserve bank|repo rate|crr|slr|mpc|monetary policy|nbfc|forex)\b/.test(text)) {
    return "RBI Updates";
  }
  if (/\b(bank|upi|npci|sebi|irdai|pfrda|nabard|sidbi|credit|deposit|atm|payment)\b/.test(text)) {
    return "Banking Awareness";
  }
  if (/\b(index|ranking|report|survey|outlook|scorecard)\b/.test(text)) {
    return "Reports, Rankings & Indexes";
  }
  if (/\b(mou|memorandum of understanding|pact|agreement|partnership|tie-up)\b/.test(text)) {
    return "MoUs & Agreements";
  }
  if (/\b(yojana|scheme|mission|abhiyan|pm-|pradhan mantri|subsidy|cabinet approves)\b/.test(text)) {
    return "Government Schemes";
  }
  if (/\b(gdp|inflation|cpi|wpi|gst|budget|fiscal|export|import|economy|trade|tax)\b/.test(text)) {
    return "Economy";
  }
  if (/\b(appointed|appointment|resigns|resigned|resignation|takes charge|ceo|md & ceo|chairman|governor|director)\b/.test(text)) {
    return "Appointments";
  }
  if (/\b(award|prize|honour|padma|bharat ratna|medal|felicitated)\b/.test(text)) {
    return "Awards";
  }
  if (/\b(important day|world .* day|national .* day|theme of .* day|commemorat)\b/.test(text)) {
    return "Important Days & Themes";
  }
  if (/\b(sport|cricket|olympic|badminton|chess|hockey|football|championship|tournament)\b/.test(text)) {
    return "Sports";
  }
  if (/\b(un |unesco|imf|world bank|brics|g20|asean|bilateral|summit|foreign|global)\b/.test(text)) {
    return "International";
  }
  return fallback;
}

/**
 * Safely reads a Fetch Response body with a strict byte ceiling to prevent OOM/unlimited downloads.
 */
async function readResponseWithLimit(res, maxBytes = MAX_RESPONSE_BYTES) {
  const contentLength = Number(res.headers?.get?.("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Feed response exceeds maximum allowed size (${maxBytes} bytes).`);
  }

  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        total += buf.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`Feed response exceeded maximum allowed size (${maxBytes} bytes).`);
        }
        chunks.push(buf);
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  const text = await res.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error(`Feed response exceeds maximum allowed size (${maxBytes} bytes).`);
  }
  return text;
}

/**
 * Fetches an external feed URL with SSRF validation, manual redirect validation,
 * timeout enforcement, and response size capping.
 */
export async function safeFetchXml(
  initialUrl,
  {
    allowedDomains = APPROVED_RSS_DOMAINS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = MAX_REDIRECTS,
    maxBytes = MAX_RESPONSE_BYTES,
    fetchFn = fetch,
    lookupFn,
  } = {},
) {
  let currentUrl = initialUrl;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const check = await validateOutboundFeedUrl(currentUrl, {
        allowedDomains,
        ...(lookupFn ? { lookupFn } : {}),
      });
      if (!check.ok) {
        throw new Error(`SSRF/URL validation failed: ${check.error}`);
      }

      const res = await fetchFn(check.url, {
        method: "GET",
        headers: REQUEST_HEADERS,
        redirect: "manual",
        signal: controller.signal,
      });

      const isRedirect = res.status >= 300 && res.status < 400;
      if (isRedirect) {
        const location = res.headers?.get?.("location");
        if (!location) {
          throw new Error(`HTTP ${res.status} redirect without Location header.`);
        }
        if (redirectCount >= maxRedirects) {
          throw new Error(`Exceeded maximum redirects (${maxRedirects}).`);
        }
        let nextUrl;
        try {
          nextUrl = new URL(location, check.url).toString();
        } catch {
          throw new Error("Invalid redirect destination URL.");
        }
        currentUrl = nextUrl;
        continue;
      }

      if (!res.ok) {
        throw new Error(`Upstream HTTP ${res.status}`);
      }

      const xml = await readResponseWithLimit(res, maxBytes);
      return { xml, finalUrl: check.url };
    }
    throw new Error(`Exceeded maximum redirects (${maxRedirects}).`);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Feed request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeSourceDate(rawDate) {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject implausible dates (before 1990 or more than 2 days in the future)
  const year = parsed.getUTCFullYear();
  const maxFuture = Date.now() + 2 * 24 * 60 * 60 * 1000;
  if (year < 1990 || parsed.getTime() > maxFuture) return null;
  return parsed.toISOString();
}

/**
 * Parses raw XML into validated, normalized Current Affairs draft candidates.
 * Rejects unusable/malformed entries and never fabricates source URLs.
 */
export function normalizeParsedFeedItems(xml, feedConfig, { limit = 8 } = {}) {
  const parsedFeed = parseFeedXml(xml);
  const discoveredCount = parsedFeed.items.length;
  const accepted = [];
  let rejectedCount = 0;
  let duplicateInBatchCount = 0;

  const seenUrls = new Set();
  const seenHashes = new Set();
  const seenTitles = new Set();

  for (const raw of parsedFeed.items) {
    if (accepted.length >= limit) break;

    const title = String(raw.title || "").trim().slice(0, 240);
    if (title.length < 8) {
      rejectedCount += 1;
      continue;
    }

    // Validate & preserve original source URL without fabricating one
    let normalizedUrl = "";
    if (raw.link && String(raw.link).trim()) {
      const urlCheck = validateAndNormalizeSourceUrl(raw.link, { allowEmpty: false });
      if (!urlCheck.ok) {
        rejectedCount += 1;
        continue;
      }
      normalizedUrl = urlCheck.url;
    }

    const description = String(raw.description || "").trim();
    const body =
      description.length >= 15
        ? description.slice(0, 30000)
        : `${title} (Source: ${feedConfig.label}). Review the official release and add key exam points before publishing.`;

    const contentHash = computeArticleContentHash({ title, body });
    const titleKey = title.toLowerCase();

    if (
      (normalizedUrl && seenUrls.has(normalizedUrl)) ||
      seenHashes.has(contentHash) ||
      seenTitles.has(titleKey)
    ) {
      duplicateInBatchCount += 1;
      continue;
    }

    if (normalizedUrl) seenUrls.add(normalizedUrl);
    seenHashes.add(contentHash);
    seenTitles.add(titleKey);

    const sourcePublishedAt = normalizeSourceDate(raw.pubDateRaw);
    const sourceName = (feedConfig.sourceName || raw.sourceName || feedConfig.label || "").slice(0, 120);

    accepted.push({
      feedKey: feedConfig.key,
      source: (feedConfig.key || "RSS").toUpperCase(),
      sourceName,
      title,
      body,
      sourceUrl: normalizedUrl,
      sourcePublishedAt,
      publishedAt: sourcePublishedAt || new Date().toISOString(),
      contentHash,
      categoryName: detectCategory(title, description, feedConfig.defaultCategory),
      verificationStatus: "unverified",
      approvalStatus: "pending",
    });
  }

  return {
    format: parsedFeed.format,
    discoveredCount,
    items: accepted,
    rejectedCount,
    duplicateInBatchCount,
  };
}

async function fetchSingleFeed(feed, { limitPerSource, timeoutMs, maxBytes, fetchFn, lookupFn }) {
  const startedAt = new Date().toISOString();
  const report = {
    feedKey: feed.key,
    feedName: feed.label,
    status: "failed",
    lastSuccessfulFetch: null,
    discoveredCount: 0,
    acceptedCount: 0,
    duplicateInBatchCount: 0,
    rejectedCount: 0,
    error: null,
  };

  try {
    let xml = null;
    let primaryErr = null;
    try {
      const primary = await safeFetchXml(feed.url, {
        allowedDomains: feed.allowedDomains || APPROVED_RSS_DOMAINS,
        timeoutMs,
        maxBytes,
        fetchFn,
        lookupFn,
      });
      xml = primary.xml;
    } catch (err) {
      primaryErr = err;
    }

    let normalized = null;
    if (xml) {
      try {
        normalized = normalizeParsedFeedItems(xml, feed, { limit: limitPerSource });
      } catch (parseErr) {
        primaryErr = parseErr;
      }
    }

    if ((!normalized || !normalized.items.length) && feed.fallbackUrl) {
      const fb = await safeFetchXml(feed.fallbackUrl, {
        allowedDomains: feed.allowedDomains || APPROVED_RSS_DOMAINS,
        timeoutMs,
        maxBytes,
        fetchFn,
        lookupFn,
      });
      normalized = normalizeParsedFeedItems(fb.xml, feed, { limit: limitPerSource });
    } else if (!normalized && primaryErr) {
      throw primaryErr;
    }

    report.status = "success";
    report.lastSuccessfulFetch = new Date().toISOString();
    report.discoveredCount = normalized.discoveredCount;
    report.acceptedCount = normalized.items.length;
    report.duplicateInBatchCount = normalized.duplicateInBatchCount;
    report.rejectedCount = normalized.rejectedCount;
    return { items: normalized.items, report };
  } catch (err) {
    // Sanitize error message so no internal stack or secret is leaked
    report.status = "failed";
    report.error = `${feed.label}: ${String(err?.message || "Fetch failed").slice(0, 240)}`;
    report.startedAt = startedAt;
    return { items: [], report };
  }
}

/**
 * Fetches official Current Affairs drafts with controlled concurrency (max 2),
 * per-feed isolation, SSRF protection, and structured telemetry.
 */
export async function fetchOfficialCaDrafts({
  sources = ["rbi", "pib"],
  limitPerSource = 8,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_RESPONSE_BYTES,
  concurrency = MAX_CONCURRENCY,
  feedRegistry = FEEDS,
  fetchFn = fetch,
  lookupFn,
} = {}) {
  const validFeeds = sources.map((key) => feedRegistry[key]).filter(Boolean);
  const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || MAX_CONCURRENCY, MAX_CONCURRENCY));

  const results = [];
  const reports = [];
  const errors = [];

  for (let i = 0; i < validFeeds.length; i += safeConcurrency) {
    const batch = validFeeds.slice(i, i + safeConcurrency);
    const settled = await Promise.all(
      batch.map((feed) =>
        fetchSingleFeed(feed, { limitPerSource, timeoutMs, maxBytes, fetchFn, lookupFn }),
      ),
    );
    for (const outcome of settled) {
      results.push(...outcome.items);
      reports.push(outcome.report);
      if (outcome.report.error) {
        errors.push(outcome.report.error);
      }
    }
  }

  return { items: results, reports, errors };
}