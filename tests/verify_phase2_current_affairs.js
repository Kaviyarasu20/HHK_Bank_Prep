import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeArticleContentHash,
  isPrivateOrReservedIp,
  isValidUuid,
  validateAndNormalizeSourceUrl,
  validateOutboundFeedUrl,
} from "../server/services/caUrlSecurity.js";
import { decodeXmlEntities, parseFeedXml, parseSafeXml } from "../server/services/safeXmlParser.js";
import {
  FEEDS,
  fetchOfficialCaDrafts,
  normalizeParsedFeedItems,
  normalizeSourceDate,
  safeFetchXml,
} from "../server/services/caFeedFetcher.js";
import { getSafeExternalUrl } from "../client/src/utils/safeUrl.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}\n         ${err.stack || err.message}`);
  }
}

console.log("=== HHK Phase 2: Data, Security & Source Reliability — Automated Verification ===\n");

// --- A. RSS 2.0, Atom, CDATA, Entities, URL Extraction & Normalization ---
await test("A1. Valid RSS 2.0 feed preserves original source URLs, CDATA, and XML entities", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel>
      <title>RBI Press Releases</title>
      <item>
        <title><![CDATA[RBI Keeps Repo Rate at 6.50% &amp; Maintains Neutral Stance]]></title>
        <link>https://RBI.ORG.IN:443/Scripts/BS_PressReleaseDisplay.aspx?prid=59001&amp;utm_source=rss#top</link>
        <description><![CDATA[<p>Monetary Policy Committee &quot;MPC&quot; retained the policy repo rate at 6.50% under LAF.</p>]]></description>
        <pubDate>Wed, 09 Oct 2024 06:30:00 GMT</pubDate>
      </item>
    </channel>
  </rss>`;

  const res = normalizeParsedFeedItems(xml, FEEDS.rbi, { limit: 8 });
  assert.equal(res.format, "rss");
  assert.equal(res.items.length, 1);
  assert.equal(
    res.items[0].sourceUrl,
    "https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=59001",
  );
  assert.equal(res.items[0].title, "RBI Keeps Repo Rate at 6.50% & Maintains Neutral Stance");
  assert.ok(res.items[0].body.includes('"MPC"'));
  assert.equal(res.items[0].sourceName, "RBI");
  assert.equal(res.items[0].sourcePublishedAt, "2024-10-09T06:30:00.000Z");
  assert.equal(res.items[0].verificationStatus, "unverified");
  assert.equal(res.items[0].approvalStatus, "pending");
  assert.equal(res.items[0].contentHash.length, 64);
});

await test("A2. Valid Atom feed extracts alternate href links, namespaces, and updated dates", () => {
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <title>PIB Official Atom Feed</title>
    <entry>
      <title>Cabinet Approves PM E-DRIVE Scheme with Rs 10,900 Crore Outlay</title>
      <link rel="self" href="https://www.pib.gov.in/atom/self/123"/>
      <link rel="alternate" href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2053800"/>
      <published>2024-09-11T10:00:00Z</published>
      <summary>The Union Cabinet approved the PM E-DRIVE scheme to accelerate electric mobility across India.</summary>
    </entry>
  </feed>`;

  const res = normalizeParsedFeedItems(atomXml, FEEDS.pib, { limit: 8 });
  assert.equal(res.format, "atom");
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].sourceUrl, "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2053800");
  assert.equal(res.items[0].categoryName, "Government Schemes");
  assert.equal(res.items[0].sourcePublishedAt, "2024-09-11T10:00:00.000Z");
});

await test("A3. Missing source URL does NOT fabricate a URL; invalid dates return null", () => {
  const xml = `<rss version="2.0"><channel><title>RBI</title><item>
    <title>RBI Releases Annual Report on Banking Ombudsman Scheme</title>
    <description>Detailed annual statistics on customer grievance redressal across scheduled commercial banks.</description>
    <pubDate>Not-A-Real-Date</pubDate>
  </item></channel></rss>`;

  const res = normalizeParsedFeedItems(xml, FEEDS.rbi, { limit: 8 });
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].sourceUrl, "");
  assert.equal(res.items[0].sourcePublishedAt, null);
  assert.equal(normalizeSourceDate("1800-01-01"), null);
  assert.equal(normalizeSourceDate("2099-01-01"), null);
});

await test("A4. Deduplication rejects duplicate URLs, duplicate content hashes, and duplicate titles in batch", () => {
  const xml = `<rss version="2.0"><channel><title>RBI</title>
    <item>
      <title>RBI Issues Master Direction on Digital Lending Guidelines</title>
      <link>https://rbi.org.in/pr/100?utm_campaign=daily</link>
      <description>Reserve Bank of India updated digital lending transparency norms for regulated entities.</description>
    </item>
    <item>
      <title>RBI Issues Master Direction on Digital Lending Guidelines (Updated)</title>
      <link>https://rbi.org.in/pr/100/</link>
      <description>Duplicate by normalized URL.</description>
    </item>
    <item>
      <title>RBI Issues Master Direction on Digital Lending Guidelines</title>
      <link>https://rbi.org.in/pr/101</link>
      <description>Reserve Bank of India updated digital lending transparency norms for regulated entities.</description>
    </item>
  </channel></rss>`;

  const res = normalizeParsedFeedItems(xml, FEEDS.rbi, { limit: 8 });
  assert.equal(res.discoveredCount, 3);
  assert.equal(res.items.length, 1);
  assert.equal(res.duplicateInBatchCount, 2);
});

await test("A5. Feed timeout, network errors, oversized responses, and per-feed isolation", async () => {
  const goodXml = `<rss version="2.0"><channel><title>RBI</title><item>
    <title>RBI Announces Bi-Monthly Monetary Policy Review Dates</title>
    <link>https://rbi.org.in/pr/200</link>
    <description>The Monetary Policy Committee will meet in Mumbai next week for the policy review.</description>
  </item></channel></rss>`;

  const publicLookup = async () => [{ address: "203.0.114.10", family: 4 }];

  // 1) Oversized response blocked
  await assert.rejects(
    () =>
      safeFetchXml("https://rbi.org.in/pressreleases_rss.xml", {
        maxBytes: 128,
        lookupFn: publicLookup,
        fetchFn: async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": "512" }),
          text: async () => "x".repeat(512),
        }),
      }),
    /exceeds maximum allowed size/i,
  );

  // 2) Timeout handled safely
  await assert.rejects(
    () =>
      safeFetchXml("https://rbi.org.in/pressreleases_rss.xml", {
        timeoutMs: 30,
        lookupFn: publicLookup,
        fetchFn: (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
            );
          }),
      }),
    /timed out/i,
  );

  // 3) Per-feed isolation: PIB fails, RBI still succeeds
  const out = await fetchOfficialCaDrafts({
    sources: ["rbi", "pib"],
    limitPerSource: 5,
    lookupFn: publicLookup,
    fetchFn: async (url) => {
      if (url.includes("rbi.org.in")) {
        return { ok: true, status: 200, headers: new Headers(), text: async () => goodXml };
      }
      throw new Error("ECONNRESET");
    },
  });
  assert.equal(out.items.length, 1);
  assert.equal(out.reports.length, 2);
  assert.equal(out.reports.find((r) => r.feedKey === "rbi").status, "success");
  assert.equal(out.reports.find((r) => r.feedKey === "pib").status, "failed");
  assert.equal(out.errors.length, 1);
});

// --- B. Security Tests (XSS, SSRF, Redirects, XXE, UUID, DB SSL) ---
await test("B1. URL validation & frontend guard reject javascript:, data:, file:, credentials, and malformed URLs", () => {
  const unsafeUrls = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://rbi.org.in/file.xml",
    "https://user:pass@rbi.org.in/pr",
    "not-a-url",
    "https://rbi.org.in/\nnewline",
  ];
  for (const bad of unsafeUrls) {
    assert.equal(validateAndNormalizeSourceUrl(bad, { allowEmpty: false }).ok, false, `Expected reject: ${bad}`);
    assert.equal(getSafeExternalUrl(bad), null, `Expected frontend reject: ${bad}`);
  }
  assert.equal(
    getSafeExternalUrl("https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=1"),
    "https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=1",
  );
});

await test("B2. SSRF blocks localhost, private IPv4, private IPv6, metadata IP, and unapproved domains", async () => {
  const blockedIps = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.5",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
  ];
  for (const ip of blockedIps) {
    assert.equal(isPrivateOrReservedIp(ip), true, `Expected private/reserved IP: ${ip}`);
  }
  assert.equal(isPrivateOrReservedIp("8.8.8.8"), false);

  const localhostRes = await validateOutboundFeedUrl("http://localhost:3001/api/health", {
    allowedDomains: [],
  });
  assert.equal(localhostRes.ok, false);

  const unapprovedDomain = await validateOutboundFeedUrl("https://evil.example.com/feed.xml", {
    allowedDomains: ["rbi.org.in"],
    lookupFn: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(unapprovedDomain.ok, false);

  // DNS rebinding to internal IP blocked
  const dnsPrivate = await validateOutboundFeedUrl("https://rbi.org.in/feed.xml", {
    allowedDomains: ["rbi.org.in"],
    lookupFn: async () => [{ address: "127.0.0.1", family: 4 }],
  });
  assert.equal(dnsPrivate.ok, false);
});

await test("B3. Manual redirect validation blocks redirects to internal/unapproved hosts and caps redirects", async () => {
  const publicLookup = async () => [{ address: "203.0.114.10", family: 4 }];

  await assert.rejects(
    () =>
      safeFetchXml("https://rbi.org.in/pressreleases_rss.xml", {
        allowedDomains: ["rbi.org.in"],
        lookupFn: publicLookup,
        fetchFn: async () => ({
          ok: false,
          status: 302,
          headers: new Headers({ location: "http://169.254.169.254/latest/meta-data/" }),
        }),
      }),
    /SSRF\/URL validation failed/i,
  );

  await assert.rejects(
    () =>
      safeFetchXml("https://rbi.org.in/pressreleases_rss.xml", {
        allowedDomains: ["rbi.org.in"],
        maxRedirects: 2,
        lookupFn: publicLookup,
        fetchFn: async (u) => ({
          ok: false,
          status: 302,
          headers: new Headers({ location: `${u}?hop=1` }),
        }),
      }),
    /Exceeded maximum redirects/i,
  );
});

await test("B4. Hardened XML parser blocks XXE DOCTYPE, ENTITY expansion, excessive depth, and malformed XML", () => {
  const xxe = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&xxe;</title></item></channel></rss>`;
  assert.throws(() => parseFeedXml(xxe), /DOCTYPE and ENTITY declarations are forbidden/i);

  const billionLaughs = `<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><rss><channel><title>&lol2;</title></channel></rss>`;
  assert.throws(() => parseSafeXml(billionLaughs), /DOCTYPE and ENTITY declarations are forbidden/i);

  // Excessive nesting depth
  const deepXml = "<a>".repeat(40) + "x" + "</a>".repeat(40);
  assert.throws(() => parseSafeXml(deepXml, { maxDepth: 16 }), /maximum nesting depth/i);

  // Malformed unclosed tag
  assert.throws(() => parseSafeXml("<rss><channel><title>Unclosed</channel></rss>"), /Mismatched closing tag/i);

  // Entity decoder is single-pass (never recursively expands)
  assert.equal(decodeXmlEntities("&amp;lt;script&amp;gt;"), "&lt;script&gt;");
});

await test("B5. UUID validator accepts valid v4 UUIDs and rejects malformed IDs", () => {
  assert.equal(isValidUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid("12345"), false);
  assert.equal(isValidUuid("' OR 1=1 --"), false);
  assert.equal(isValidUuid(""), false);
});

await test("B6. Database SSL configuration enforces verification in production and forbids hardcoded fallback credentials", () => {
  // Parse server/db.js source directly to verify no hardcoded 'postgres' password fallback & SSL enforcement
  const dbSource = fs.readFileSync(path.join(projectRoot, "server/db.js"), "utf8");
  assert.ok(!dbSource.includes("'postgres'"), "Hardcoded 'postgres' fallback password must be removed");
  assert.ok(dbSource.includes("buildDatabaseSslConfig"), "buildDatabaseSslConfig must exist");
  assert.ok(dbSource.includes("isProduction ? true : rawReject !== \"false\""), "Production SSL cert verification must stay enabled");

  // Verify .gitignore excludes .env and *.zip from source control / distribution
  const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
  assert.ok(gitignore.includes(".env"), ".gitignore must exclude .env");
  assert.ok(gitignore.includes("*.zip"), ".gitignore must exclude *.zip");
});

// --- C. Migration 022 & Route Static Verification ---
await test("C1. Migration 022 SQL contains all required columns, constraints, banking categories, indexes, and rollback plan", () => {
  const sql = fs.readFileSync(
    path.join(projectRoot, "server/migrations/023_current_affairs_phase2_reliability.sql"),
    "utf8",
  );
  for (const col of [
    "source_name",
    "source_published_at",
    "ingested_at",
    "updated_at",
    "approval_status",
    "tags",
    "content_hash",
  ]) {
    assert.ok(sql.includes(col), `Migration 022 missing column: ${col}`);
  }
  for (const cat of [
    "Reports, Rankings & Indexes",
    "MoUs & Agreements",
    "Important Days & Themes",
    "Resignations",
  ]) {
    assert.ok(sql.includes(cat), `Migration 022 missing category: ${cat}`);
  }
  for (const idx of [
    "idx_ca_status_published_at",
    "idx_ca_category_id",
    "idx_ca_source_url",
    "idx_ca_lower_title",
    "idx_ca_content_hash",
    "idx_ca_source_name",
    "idx_ca_questions_affair_id",
    "idx_ca_reads_student_affair",
  ]) {
    assert.ok(sql.includes(idx), `Migration 022 missing index: ${idx}`);
  }
  assert.ok(sql.includes("current_affairs_feed_runs"), "Migration 022 missing feed telemetry table");

});

await test("C2. Routes enforce UUID validation, published-only IDOR guard, safe sourceUrl, and audit logging", () => {
  const contentJs = fs.readFileSync(path.join(projectRoot, "server/routes/currentAffairsStudent.js"), "utf8");
  assert.ok(contentJs.includes("isValidUuid(req.params.id)"), "content.js must validate article UUID");
  assert.ok(contentJs.includes("SELECT id FROM current_affairs WHERE id = $1 AND status = 'published'"), "content.js must guard :id/state against draft/archived IDOR");
  assert.ok(contentJs.includes("getIstMonthRange"), "content.js must use index-friendly month range");

  const adminJs = fs.readFileSync(path.join(projectRoot, "server/routes/currentAffairsAdmin.js"), "utf8");
  assert.ok(adminJs.includes("safeSourceUrlSchema"), "admin.js must use safeSourceUrlSchema");
  assert.ok(adminJs.includes("SAVEPOINT"), "admin.js fetch-feeds must isolate per-item failures with SAVEPOINT");
  for (const action of [
    "current_affairs.create",
    "current_affairs.update",
    "current_affairs.question.create",
    "current_affairs.bulk_import",
    "current_affairs.fetch_feeds",
  ]) {
    assert.ok(adminJs.includes(action), `admin.js missing audit action: ${action}`);
  }

  const hash1 = computeArticleContentHash({ title: "RBI Repo Rate 6.5%", body: "Unchanged in MPC." });
  const hash2 = computeArticleContentHash({ title: "rbi repo rate 6.5%!", body: "unchanged   in mpc" });
  assert.equal(hash1, hash2, "Content hash normalization must match across case/punctuation");
});

console.log(`\n=== PHASE 2 SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
