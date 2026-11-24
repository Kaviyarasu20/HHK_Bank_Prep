import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  attachFreshness,
  computeFreshness,
  getCachedPublished,
  invalidateBankingCache,
  setCachedPublished,
  VERIFICATION_INTERVAL_DAYS,
} from "../server/services/bankingFreshness.js";

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

console.log("=== HHK Phase 4: Banking Awareness Reference Hub — Automated Verification ===\n");

await test("1. Migration 025 creates/extends all 7 Banking Reference tables with zero fabricated RBI rates or leaders", () => {
  const sql = fs.readFileSync(
    path.join(projectRoot, "server/migrations/025_banking_awareness_reference_hub.sql"),
    "utf8",
  );
  for (const tbl of [
    "banking_policy_rates",
    "banking_limits",
    "banking_institutions",
    "banking_regulatory_bodies",
    "banking_leaders",
    "banking_static_gk",
    "banking_terminology",
  ]) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Missing table: ${tbl}`);
  }
  assert.ok(sql.includes("uq_bpr_code_effective_active"), "Missing unique partial index on active RBI rates");
  assert.ok(sql.includes("uq_bt_lower_term"), "Missing unique index on banking terminology");
  assert.ok(!/INSERT INTO banking_policy_rates/i.test(sql), "Must never seed fabricated RBI rates");
  assert.ok(!/INSERT INTO banking_leaders/i.test(sql), "Must never seed fabricated banking leaders");
  assert.ok(!/INSERT INTO banking_limits/i.test(sql), "Must never seed fabricated banking limits");
  assert.ok(/INSERT INTO banking_terminology/i.test(sql), "Timeless banking terminology definitions should be seeded");
  assert.ok(sql.includes("ON CONFLICT (lower(term)) DO NOTHING"), "Terminology seed must be idempotent");
});

await test("2. Freshness engine classifies recently_verified, verification_due, outdated, historical, and pending_verification", () => {
  const now = new Date("2026-11-24T00:00:00Z");

  const recent = computeFreshness(
    { status: "published", verified_at: "2026-11-10T00:00:00Z" },
    "rates",
    { now },
  );
  assert.equal(recent.state, "recently_verified");

  const due = computeFreshness(
    { status: "published", verified_at: "2026-09-10T00:00:00Z" },
    "rates",
    { now },
  );
  assert.equal(due.state, "verification_due");

  const outdated = computeFreshness(
    { status: "published", verified_at: "2026-05-01T00:00:00Z" },
    "rates",
    { now },
  );
  assert.equal(outdated.state, "outdated");

  const expiredLimit = computeFreshness(
    { status: "published", verified_at: "2026-11-20T00:00:00Z", effective_until: "2026-10-01" },
    "limits",
    { now },
  );
  assert.equal(expiredLimit.state, "outdated");

  const histLeader = computeFreshness(
    { status: "published", verified_at: "2026-11-20T00:00:00Z", end_date: "2025-12-31" },
    "leaders",
    { now },
  );
  assert.equal(histLeader.state, "historical");

  const pending = computeFreshness({ status: "published", verified_at: null }, "rates", { now });
  assert.equal(pending.state, "pending_verification");

  assert.ok(VERIFICATION_INTERVAL_DAYS.rates < VERIFICATION_INTERVAL_DAYS.static_gk);
  const attached = attachFreshness({ id: "1", status: "archived" }, "rates", now);
  assert.equal(attached.freshness.state, "historical");
});

await test("3. Safe published-only cache stores values and invalidates cleanly on admin mutations", () => {
  invalidateBankingCache();
  assert.equal(getCachedPublished("student:overview"), null);
  setCachedPublished("student:overview", { ok: true }, 10_000);
  assert.deepEqual(getCachedPublished("student:overview"), { ok: true });
  invalidateBankingCache();
  assert.equal(getCachedPublished("student:overview"), null);
});

await test("4. Student & Admin Banking Awareness routers are mounted in server/index.js with strict role & published guards", () => {
  const indexJs = fs.readFileSync(path.join(projectRoot, "server/index.js"), "utf8");
  assert.ok(indexJs.includes("bankingAwarenessStudentRouter"), "server/index.js must mount bankingAwarenessStudentRouter");
  assert.ok(indexJs.includes("bankingAwarenessAdminRouter"), "server/index.js must mount bankingAwarenessAdminRouter");

  const stu = fs.readFileSync(path.join(projectRoot, "server/routes/bankingAwarenessStudent.js"), "utf8");
  for (const snippet of [
    "requireAuth",
    '"/overview"',
    '"/rates"',
    '"/rates/history/:rateCode"',
    '"/limits"',
    '"/institutions"',
    '"/regulatory-bodies"',
    '"/leaders"',
    '"/static-gk"',
    '"/terminology"',
    "status = 'published'",
    "isValidUuid",
  ]) {
    assert.ok(stu.includes(snippet), `bankingAwarenessStudent.js missing: ${snippet}`);
  }

  const adm = fs.readFileSync(path.join(projectRoot, "server/routes/bankingAwarenessAdmin.js"), "utf8");
  for (const snippet of [
    "requireAdmin",
    '"/stats"',
    '"/alerts"',
    '"/:entity/:id/status"',
    "pending_review",
    "invalidateBankingCache()",
    "Official RBI source URL is required",
    "already exists for",
    "audit(",
    "safeUrlSchema",
  ]) {
    assert.ok(adm.includes(snippet), `bankingAwarenessAdmin.js missing: ${snippet}`);
  }
});

await test("5. Frontend BankingAwarenessDashboard & CurrentAffairsReferenceAdmin exist and are integrated cleanly", () => {
  const stuDash = fs.readFileSync(
    path.join(projectRoot, "client/src/components/student/BankingAwarenessDashboard.jsx"),
    "utf8",
  );
  for (const section of ["Overview", "RBI Rates", "Banking Limits", "Institutions", "Regulatory Bodies", "Banking Leaders", "Static GK", "Terminology A–Z"]) {
    assert.ok(stuDash.includes(section), `BankingAwarenessDashboard missing section: ${section}`);
  }
  assert.ok(stuDash.includes("getSafeExternalUrl"), "Student dashboard must guard external URLs");

  const admRef = fs.readFileSync(
    path.join(projectRoot, "client/src/components/admin/CurrentAffairsReferenceAdmin.jsx"),
    "utf8",
  );
  assert.ok(admRef.includes("adminBankingApi"), "Admin reference manager must use centralized adminBankingApi");
  assert.ok(admRef.includes("Approve &amp; Publish"), "Admin reference manager must expose approval workflow");

  const stuCa = fs.readFileSync(path.join(projectRoot, "client/src/components/student/StudentCurrentAffairs.jsx"), "utf8");
  assert.ok(stuCa.includes("BankingAwarenessDashboard"), "StudentCurrentAffairs must integrate BankingAwarenessDashboard");

  const admCa = fs.readFileSync(path.join(projectRoot, "client/src/components/admin/CurrentAffairsView.jsx"), "utf8");
  assert.ok(admCa.includes("CurrentAffairsReferenceAdmin"), "CurrentAffairsView must integrate CurrentAffairsReferenceAdmin");
});

console.log(`\n=== PHASE 4 SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
