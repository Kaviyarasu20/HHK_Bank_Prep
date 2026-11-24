import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  sanitizeGatewayPayload,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../server/services/razorpay.js";
import { evaluateTestAccess } from "../server/services/testAccess.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log("\n=== HHK Payment System & Access Control Verification Suite ===\n");

// 1. Razorpay Cryptographic Signature Verification
await runTest("Razorpay checkout signature verification accepts valid HMAC-SHA256", () => {
  const secret = "test_secret_key_hhk_123456";
  const orderId = "order_HHKTest001";
  const paymentId = "pay_HHKTest001";
  const sig = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: sig, secretOverride: secret }), true);
});

await runTest("Razorpay checkout signature verification rejects tampered paymentId or signature", () => {
  const secret = "test_secret_key_hhk_123456";
  const orderId = "order_HHKTest001";
  const paymentId = "pay_HHKTest001";
  const sig = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  assert.equal(verifyCheckoutSignature({ orderId, paymentId: "pay_TAMPERED", signature: sig, secretOverride: secret }), false);
  assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: "deadbeef", secretOverride: secret }), false);
  assert.equal(verifyCheckoutSignature({ orderId, paymentId, signature: sig, secretOverride: "" }), false);
});

await runTest("Razorpay webhook signature verification validates raw body and rejects tampering", () => {
  const secret = "whsec_hhk_test_987654";
  const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", amount: 4900 } } } }));
  const validSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(verifyWebhookSignature({ rawBody, signature: validSig, secretOverride: secret }), true);

  const tamperedBody = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", amount: 100 } } } }));
  assert.equal(verifyWebhookSignature({ rawBody: tamperedBody, signature: validSig, secretOverride: secret }), false);
});

await runTest("Gateway payload sanitizer strips card numbers, CVV, UPI PIN, and auth credentials", () => {
  const sanitized = sanitizeGatewayPayload({
    id: "pay_123",
    amount: 4900,
    currency: "INR",
    status: "captured",
    method: "upi",
    card: { number: "4111111111111111", cvv: "123" },
    upi_pin: "1234",
    vpa: "student@upi",
    token: "secret_token",
  });
  assert.equal(sanitized.id, "pay_123");
  assert.equal(sanitized.method, "upi");
  assert.equal("card" in sanitized, false);
  assert.equal("upi_pin" in sanitized, false);
  assert.equal("token" in sanitized, false);
});

// 2. Centralized Test Access Control Engine (all 7 outcomes)
function makeMockDb({ testRow, entitlements = [], subscriptions = [], plans = [] }) {
  return {
    async query(sql) {
      if (sql.includes("FROM mock_tests t")) {
        return { rowCount: testRow ? 1 : 0, rows: testRow ? [testRow] : [] };
      }
      if (sql.includes("FROM student_test_entitlements")) {
        return { rowCount: entitlements.length, rows: entitlements };
      }
      if (sql.includes("FROM student_subscriptions")) {
        return { rowCount: subscriptions.length, rows: subscriptions };
      }
      if (sql.includes("FROM subscription_plans")) {
        return { rowCount: plans.length, rows: plans };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

await runTest("Access Control: unauthenticated visitor returns LOGIN_REQUIRED (401)", async () => {
  const res = await evaluateTestAccess({ db: makeMockDb({}), userId: null, testId: "t1" });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "LOGIN_REQUIRED");
  assert.equal(res.httpStatus, 401);
});

await runTest("Access Control: unpublished/hidden test returns TEST_NOT_AVAILABLE (404)", async () => {
  const db = makeMockDb({
    testRow: { id: "t1", status: "draft", is_visible: true, test_type: "EXAM_WISE", exam_status: "published" },
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t1" });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "TEST_NOT_AVAILABLE");
  assert.equal(res.httpStatus, 404);
});

await runTest("Access Control: logged-in student gets FREE_ACCESS_GRANTED on FREE test", async () => {
  const db = makeMockDb({
    testRow: {
      id: "t1", status: "published", is_visible: true, test_type: "EXAM_WISE",
      exam_status: "published", access_type: "FREE", price_paise: 0,
    },
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t1" });
  assert.equal(res.allowed, true);
  assert.equal(res.code, "FREE_ACCESS_GRANTED");
});

await runTest("Access Control: unpaid PAID test returns PURCHASE_REQUIRED (403) with price and plans", async () => {
  const db = makeMockDb({
    testRow: {
      id: "t2", name: "IBPS PO Mock 02", status: "published", is_visible: true, test_type: "EXAM_WISE",
      exam_status: "published", access_type: "PAID", price_paise: 4900, currency: "INR", is_purchasable: true,
    },
    plans: [{ id: "p1", name: "Standard 90 Days", price_paise: 49900 }],
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t2" });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "PURCHASE_REQUIRED");
  assert.equal(res.httpStatus, 403);
  assert.equal(res.test.price_paise, 4900);
  assert.equal(res.eligiblePlans.length, 1);
});

await runTest("Access Control: purchased PAID test returns PURCHASE_ACCESS_GRANTED (200)", async () => {
  const db = makeMockDb({
    testRow: {
      id: "t2", status: "published", is_visible: true, test_type: "EXAM_WISE",
      exam_status: "published", access_type: "PAID", price_paise: 4900,
    },
    entitlements: [{ id: "e1", source: "PURCHASE", status: "ACTIVE", expires_at: null }],
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t2" });
  assert.equal(res.allowed, true);
  assert.equal(res.code, "PURCHASE_ACCESS_GRANTED");
});

await runTest("Access Control: active subscription covering test returns SUBSCRIPTION_ACCESS_GRANTED (200)", async () => {
  const future = new Date(Date.now() + 86_400_000 * 30).toISOString();
  const db = makeMockDb({
    testRow: {
      id: "t2", status: "published", is_visible: true, test_type: "EXAM_WISE",
      exam_status: "published", access_type: "PAID", price_paise: 4900,
    },
    subscriptions: [{ id: "s1", plan_name: "Pro 90", status: "ACTIVE", expires_at: future, access_scope: "ALL_TESTS", includes_test: false }],
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t2" });
  assert.equal(res.allowed, true);
  assert.equal(res.code, "SUBSCRIPTION_ACCESS_GRANTED");
});

await runTest("Access Control: expired subscription returns ACCESS_EXPIRED (403)", async () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const db = makeMockDb({
    testRow: {
      id: "t2", status: "published", is_visible: true, test_type: "EXAM_WISE",
      exam_status: "published", access_type: "PAID", price_paise: 4900,
    },
    subscriptions: [{ id: "s1", plan_name: "Basic 30", status: "ACTIVE", expires_at: past, access_scope: "ALL_TESTS", includes_test: false }],
  });
  const res = await evaluateTestAccess({ db, userId: "u1", userRole: "student", testId: "t2" });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "ACCESS_EXPIRED");
  assert.equal(res.httpStatus, 403);
});

// 3. Security Static Checks
await runTest("Security: Frontend source contains zero references to RAZORPAY_KEY_SECRET or RAZORPAY_WEBHOOK_SECRET", () => {
  const clientSrc = path.join(rootDir, "client", "src");
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(js|jsx|ts|tsx|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        assert.equal(content.includes("RAZORPAY_KEY_SECRET"), false, `Secret leaked in ${full}`);
        assert.equal(content.includes("RAZORPAY_WEBHOOK_SECRET"), false, `Webhook secret leaked in ${full}`);
      }
    }
  }
  scan(clientSrc);
});

await runTest("Database Migration 017: additive-only (no DROP TABLE or destructive DELETE statements)", () => {
  const sql = fs.readFileSync(
    path.join(rootDir, "server", "migrations", "017_payments_subscriptions_and_access.sql"),
    "utf8",
  );
  assert.equal(/\bDROP\s+TABLE\b/i.test(sql), false, "Migration 017 must not drop tables");
  assert.equal(/\bTRUNCATE\b/i.test(sql), false, "Migration 017 must not truncate tables");
  assert.equal(/\bDELETE\s+FROM\b/i.test(sql), false, "Migration 017 must not delete existing rows");
  assert.equal(sql.includes("INTEGER"), true, "Monetary amounts must use integer paise");
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
