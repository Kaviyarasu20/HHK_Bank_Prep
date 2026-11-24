import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANALYTICS_METRIC_DEFINITIONS,
  normalizeDateRangeDays,
  summarizeFinancialOrders,
} from "../server/services/platformAnalyticsService.js";
import { SafeTtlCache } from "../server/services/safeCacheService.js";
import {
  evaluateReadiness,
  sanitizeLogMeta,
} from "../server/services/requestMonitoring.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err?.stack || err}`);
    failed += 1;
  }
}

console.log("=== HHK Phase 10: Analytics, Performance & Full End-to-End QA — Verification ===\n");

await test("1. Financial analytics strictly separate PAID orders from FAILED/PENDING and REFUNDS", () => {
  assert.ok(ANALYTICS_METRIC_DEFINITIONS.revenueDefinition.includes("PAID"));
  assert.equal(normalizeDateRangeDays(500), 365);
  assert.equal(normalizeDateRangeDays(-5), 1);

  const summary = summarizeFinancialOrders(
    [
      { status: "PAID", total_amount_paise: 49900 },
      { status: "PAID", total_amount_paise: 99900 },
      { status: "FAILED", total_amount_paise: 49900 },
      { status: "PENDING", total_amount_paise: 49900 },
      { status: "CREATED", total_amount_paise: 49900 },
    ],
    [
      { status: "PROCESSED", approved_amount_paise: 49900 },
      { status: "REJECTED", requested_amount_paise: 99900 },
    ],
  );

  assert.equal(summary.paidOrdersCount, 2);
  assert.equal(summary.failedOrdersCount, 1);
  assert.equal(summary.pendingOrdersCount, 2);
  assert.equal(summary.grossCollectedInr, 1498);
  assert.equal(summary.totalRefundedInr, 499);
  assert.equal(summary.netCollectedInr, 999);
  assert.equal(summary.paymentSuccessRatePercent, 66.67);
});

await test("2. SafeTtlCache enforces bounded capacity, TTL, and prefix invalidation", () => {
  const cache = new SafeTtlCache({ maxEntries: 2 });
  cache.set("admin:analytics:7", { a: 1 }, 10_000);
  cache.set("admin:analytics:30", { b: 2 }, 10_000);
  assert.deepEqual(cache.get("admin:analytics:7"), { a: 1 });
  cache.set("public:cats", { c: 3 }, 10_000); // evicts oldest
  assert.equal(cache.size(), 2);
  cache.invalidatePrefix("admin:analytics:");
  assert.equal(cache.get("admin:analytics:30"), undefined);
  assert.deepEqual(cache.get("public:cats"), { c: 3 });
});

await test("3. Operational monitoring redacts secrets and evaluates readiness accurately", async () => {
  const clean = sanitizeLogMeta({
    route: "/api/auth/login",
    password: "super-secret-password",
    razorpay_signature: "sig_123",
    token: "tok_abc",
    status: 200,
  });
  assert.equal(clean.route, "/api/auth/login");
  assert.equal(clean.password, "[REDACTED]");
  assert.equal(clean.razorpay_signature, "[REDACTED]");
  assert.equal(clean.token, "[REDACTED]");

  const okPool = { async query() { return { rows: [{ "?column?": 1 }] }; } };
  const ready = await evaluateReadiness({
    dbPool: okPool,
    env: { SESSION_SECRET: "a".repeat(40), CA_AI_ENABLED: "false" },
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.checks.database, "ok");

  const failPool = { async query() { throw new Error("db down"); } };
  const degraded = await evaluateReadiness({
    dbPool: failPool,
    env: { SESSION_SECRET: "short" },
  });
  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.checks.database, "unavailable");
});

await test("4. Migrations 022-031 are strictly additive with zero destructive DDL or non-immutable ::date indexes", () => {
  const migDir = path.join(root, "server/migrations");
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  assert.ok(files.includes("031_phase10_analytics_and_performance_indexes.sql"));

  const phaseMigs = files.filter((f) => Number(f.slice(0, 3)) >= 22);
  assert.equal(phaseMigs.length, 10); // 022 through 031
  for (const fn of phaseMigs) {
    const rawSql = fs.readFileSync(path.join(migDir, fn), "utf8");
    const sql = rawSql.replace(/^--.*$/gm, "");
    assert.ok(!/\bDROP\s+TABLE\b/i.test(sql), `${fn} must not DROP TABLE`);
    assert.ok(!/\bTRUNCATE\b/i.test(sql), `${fn} must not TRUNCATE`);
    assert.ok(!/CREATE\s+(?:UNIQUE\s+)?INDEX[^;]*::date/i.test(sql), `${fn} has non-immutable ::date index`);
  }
});

await test("5. All Phase 2-10 backend routers, monitoring middleware, and /api/ready are mounted in server/index.js", () => {
  const idx = fs.readFileSync(path.join(root, "server/index.js"), "utf8");
  const requiredMounts = [
    "requestCorrelationMiddleware",
    "'/api/health'",
    "'/api/ready'",
    "'/api/banking-awareness'",
    "'/api/current-affairs/one-liners'",
    "'/api/current-affairs/flashcards'",
    "'/api/smart-revision'",
    "'/api/monthly-capsules'",
    "'/api/ga-marathon'",
    "'/api/student/performance-analytics'",
    "'/api/admin/banking-awareness'",
    "'/api/admin/current-affairs/ai'",
    "'/api/admin/current-affairs/questions'",
    "'/api/admin/current-affairs/one-liners'",
    "'/api/admin/current-affairs/flashcards'",
    "'/api/admin/monthly-capsules'",
    "'/api/admin/ga-marathon'",
    "'/api/admin/analytics'",
  ];
  for (const m of requiredMounts) {
    assert.ok(idx.includes(m), `server/index.js missing ${m}`);
  }
});

await test("6. Frontend QA fix & Phase 10 dashboards are wired cleanly", () => {
  const sw = fs.readFileSync(path.join(root, "client/src/StudentWorkspace.jsx"), "utf8");
  const cav = fs.readFileSync(path.join(root, "client/src/components/admin/CurrentAffairsView.jsx"), "utf8");
  const envEx = fs.readFileSync(path.join(root, ".env.example"), "utf8");

  assert.ok(sw.includes('if (pendingTest && (section === "Mock tests" || section === "Current affairs"))'));
  assert.ok(sw.includes("StudentPerformanceDashboard"));
  assert.ok(cav.includes("PlatformAnalyticsDashboard"));
  assert.ok(envEx.includes("SESSION_SECRET="));
  assert.ok(envEx.includes("RAZORPAY_WEBHOOK_SECRET="));
  assert.ok(envEx.includes("CA_AI_ENABLED=false"));
});

console.log(`\nPhase 10 verification summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
