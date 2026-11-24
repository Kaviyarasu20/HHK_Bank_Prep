import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_SOURCE_URL_LENGTH = 500;

export function isValidUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/**
 * Validates and normalizes an external article source URL.
 * - Accepts only http: and https: schemes.
 * - Rejects javascript:, data:, file:, ftp:, mailto:, credentials-in-URL, and malformed URLs.
 * - Strips fragment hashes and tracking parameters (utm_*, fbclid, gclid).
 */
export function validateAndNormalizeSourceUrl(rawUrl, { allowEmpty = true } = {}) {
  if (rawUrl === null || rawUrl === undefined) {
    return allowEmpty ? { ok: true, url: "" } : { ok: false, error: "Source URL is required." };
  }
  const trimmed = String(rawUrl).trim();
  if (!trimmed) {
    return allowEmpty ? { ok: true, url: "" } : { ok: false, error: "Source URL is required." };
  }
  if (trimmed.length > MAX_SOURCE_URL_LENGTH) {
    return {
      ok: false,
      error: `Source URL must be at most ${MAX_SOURCE_URL_LENGTH} characters.`,
    };
  }
  // Reject control characters or whitespace inside URLs
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) {
    return { ok: false, error: "Source URL contains invalid characters." };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Source URL must be a valid HTTP or HTTPS URL." };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    return { ok: false, error: "Source URL must use http:// or https://." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Source URL must not contain embedded credentials." };
  }
  if (!parsed.hostname || parsed.hostname.length > 253) {
    return { ok: false, error: "Source URL has an invalid hostname." };
  }

  // Normalize host casing, remove default ports, strip fragment and common tracking params
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (protocol === "http:" && parsed.port === "80") ||
    (protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }
  parsed.hash = "";

  const trackingKeys = [];
  for (const key of parsed.searchParams.keys()) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) {
      trackingKeys.push(key);
    }
  }
  for (const key of trackingKeys) {
    parsed.searchParams.delete(key);
  }

  // Remove trailing slash on non-root path for consistent deduplication
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  const normalized = parsed.toString();
  if (normalized.length > MAX_SOURCE_URL_LENGTH) {
    return {
      ok: false,
      error: `Normalized source URL exceeds ${MAX_SOURCE_URL_LENGTH} characters.`,
    };
  }
  return { ok: true, url: normalized };
}

/**
 * Checks whether an IPv4 address is loopback, private, link-local, CGNAT, multicast, or reserved.
 */
export function isPrivateOrReservedIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // Multicast & reserved (224.0.0.0+)
  return false;
}

/**
 * Checks whether an IPv6 address is loopback, unspecified, unique-local (fc00::/7),
 * link-local (fe80::/10), multicast (ff00::/8), documentation, or IPv4-mapped private.
 */
export function isPrivateOrReservedIpv6(ip) {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith("::ffff:")) {
    const rest = normalized.slice(7);
    if (net.isIPv4(rest)) return isPrivateOrReservedIpv4(rest);
    const hexParts = rest.split(":");
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
        const ipv4 = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
        return isPrivateOrReservedIpv4(ipv4);
      }
    }
    return true;
  }

  const firstHextet = normalized.split(":")[0];
  if (!firstHextet) return true;
  const val = parseInt(firstHextet, 16);
  if (Number.isNaN(val)) return true;

  if ((val & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((val & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((val & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (normalized.startsWith("2001:db8:")) return true; // documentation
  if (normalized.startsWith("100::")) return true; // discard-only
  return false;
}

export function isPrivateOrReservedIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  // Bare IPv6 bracketed hostname in URL.hostname may include [] in some environments
  const stripped = host.replace(/^\[|\]$/g, "");
  if (net.isIP(stripped)) {
    return isPrivateOrReservedIp(stripped);
  }
  return false;
}

export function isHostInAllowlist(hostname, allowedDomains = []) {
  if (!allowedDomains.length) return true;
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return allowedDomains.some((domain) => {
    const d = domain.toLowerCase().replace(/\.$/, "");
    return host === d || host.endsWith(`.${d}`);
  });
}

/**
 * Full SSRF validation for an outbound RSS feed or redirect URL:
 * 1. HTTP/HTTPS protocol check
 * 2. Domain allowlist check (if provided)
 * 3. Blocked hostname / literal private IP check
 * 4. DNS resolution check (all returned A/AAAA records must be public)
 */
export async function validateOutboundFeedUrl(
  rawUrl,
  { allowedDomains = [], lookupFn = dns.lookup } = {},
) {
  const normalizedResult = validateAndNormalizeSourceUrl(rawUrl, { allowEmpty: false });
  if (!normalizedResult.ok) {
    return { ok: false, error: normalizedResult.error };
  }

  const parsed = new URL(normalizedResult.url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (isBlockedHostname(hostname)) {
    return { ok: false, error: `Blocked internal or private host: ${hostname}` };
  }

  if (allowedDomains.length && !isHostInAllowlist(hostname, allowedDomains)) {
    return { ok: false, error: `Host "${hostname}" is not in the approved RSS domain allowlist.` };
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, error: `Blocked private IP address: ${hostname}` };
    }
    return { ok: true, url: normalizedResult.url, resolvedIps: [hostname] };
  }

  let records;
  try {
    records = await lookupFn(hostname, { all: true, verbatim: true });
  } catch {
    return { ok: false, error: `DNS resolution failed for host "${hostname}".` };
  }

  if (!Array.isArray(records) || !records.length) {
    return { ok: false, error: `No DNS records found for host "${hostname}".` };
  }

  const resolvedIps = [];
  for (const rec of records) {
    if (!rec?.address || isPrivateOrReservedIp(rec.address)) {
      return {
        ok: false,
        error: `Host "${hostname}" resolved to a private or reserved IP address.`,
      };
    }
    resolvedIps.push(rec.address);
  }

  return { ok: true, url: normalizedResult.url, resolvedIps };
}

/**
 * Computes a deterministic SHA-256 content hash for Current Affairs deduplication.
 * Uses normalized title + body snippet so minor whitespace/punctuation changes still match.
 */
export function computeArticleContentHash({ title = "", body = "" }) {
  const normTitle = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normBody = String(body)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  return crypto.createHash("sha256").update(`${normTitle}|${normBody}`).digest("hex");
}
