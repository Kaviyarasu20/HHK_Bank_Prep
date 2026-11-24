import crypto from "node:crypto";
import { pool } from "../db.js";
import {
  fetchGatewayOrderPayments,
  fetchGatewayPayment,
  sanitizeGatewayPayload,
} from "./razorpay.js";

export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "PROCESSING",
  "SUCCESSFUL",
  "FAILED",
  "CANCELLED",
  "REFUND_INITIATED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

/**
 * Pure integer-paise pricing calculation (never uses floating-point arithmetic for financial totals).
 */
export function calculateOrderPricing(baseAmountPaise, settings = {}) {
  const base = Math.max(0, Math.trunc(Number(baseAmountPaise) || 0));
  const taxEnabled = Boolean(settings.tax_enabled);
  const taxRateBps = Math.max(0, Math.trunc(Number(settings.tax_rate_bps) || 0));
  const taxAmountPaise = taxEnabled ? Math.round((base * taxRateBps) / 10_000) : 0;
  return {
    baseAmountPaise: base,
    taxAmountPaise,
    totalAmountPaise: base + taxAmountPaise,
  };
}

export function getEffectivePlanPricePaise(plan, now = new Date()) {
  if (
    plan.promo_price_paise !== null &&
    plan.promo_price_paise !== undefined &&
    (!plan.promo_valid_until || new Date(plan.promo_valid_until) > now)
  ) {
    return Math.trunc(Number(plan.promo_price_paise));
  }
  return Math.trunc(Number(plan.price_paise));
}

export function generateOrderNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `HHK-ORD-${stamp}-${rand}`;
}

export function generateTransactionCode() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `HHK-TXN-${stamp}-${rand}`;
}

export function generateReceiptNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `HHK-RCPT-${stamp}-${rand}`;
}

export async function getPaymentSettings(db = pool) {
  const res = await db.query("SELECT * FROM payment_settings WHERE id = 1");
  if (res.rowCount) return res.rows[0];
  const inserted = await db.query(
    "INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 1 RETURNING *",
  );
  return inserted.rows[0];
}

export async function writePaymentAudit(db, { actorId, action, entityType, entityId, details = {}, ip = null }) {
  await db.query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId ?? null, action, entityType, entityId ?? null, JSON.stringify(details), ip ?? null],
  );
}

/**
 * Idempotently grants subscription or individual mock test entitlement for a verified order.
 * Safe to invoke from both synchronous verification and asynchronous webhooks.
 */
export async function grantEntitlementForOrder(client, order) {
  if (order.item_type === "SUBSCRIPTION") {
    const planRes = await client.query(
      "SELECT id, duration_days FROM subscription_plans WHERE id = $1",
      [order.plan_id],
    );
    if (!planRes.rowCount) {
      throw Object.assign(new Error("Associated subscription plan no longer exists."), {
        status: 404,
      });
    }
    const durationDays = Number(planRes.rows[0].duration_days);
    const existingActive = await client.query(
      `SELECT expires_at FROM student_subscriptions
       WHERE student_id = $1 AND plan_id = $2 AND status = 'ACTIVE' AND expires_at > now()
       ORDER BY expires_at DESC LIMIT 1`,
      [order.student_id, order.plan_id],
    );
    const baseStart = existingActive.rowCount
      ? new Date(existingActive.rows[0].expires_at)
      : new Date();
    const expiresAt = new Date(baseStart.getTime() + durationDays * 86_400_000);

    await client.query(
      `INSERT INTO student_subscriptions (student_id, plan_id, order_id, status, starts_at, expires_at)
       VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
       ON CONFLICT (order_id) DO NOTHING`,
      [order.student_id, order.plan_id, order.id, new Date(), expiresAt],
    );
    return { type: "SUBSCRIPTION", expiresAt };
  }

  if (order.item_type === "MOCK_TEST") {
    const testRes = await client.query(
      "SELECT id, access_duration_days FROM mock_tests WHERE id = $1",
      [order.mock_test_id],
    );
    const durationDays = testRes.rows[0]?.access_duration_days ?? null;
    const expiresAt = durationDays
      ? new Date(Date.now() + Number(durationDays) * 86_400_000)
      : null;

    await client.query(
      `INSERT INTO student_test_entitlements (student_id, mock_test_id, source, order_id, status, granted_at, expires_at)
       VALUES ($1, $2, 'PURCHASE', $3, 'ACTIVE', now(), $4)
       ON CONFLICT (order_id) DO NOTHING`,
      [order.student_id, order.mock_test_id, order.id, expiresAt],
    );
    return { type: "MOCK_TEST", expiresAt };
  }

  return null;
}

/**
 * Atomically marks an order & transaction SUCCESSFUL and grants entitlements inside a DB transaction.
 * Locks the order row FOR UPDATE to prevent race conditions between checkout verification and webhooks.
 */
export async function finalizeVerifiedPayment({
  orderId,
  gatewayOrderId,
  gatewayPaymentId,
  paymentMethod = null,
  gatewayPayload = {},
  signatureVerified = true,
  source = "checkout_verify",
  actorId = null,
  ip = null,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const orderRes = await client.query(
      orderId
        ? "SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE"
        : "SELECT * FROM payment_orders WHERE gateway_order_id = $1 FOR UPDATE",
      [orderId || gatewayOrderId],
    );
    if (!orderRes.rowCount) {
      await client.query("ROLLBACK");
      return { found: false };
    }
    const order = orderRes.rows[0];

    // Already completed? Idempotently return existing transaction
    if (["SUCCESSFUL", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status)) {
      const existingTx = await client.query(
        "SELECT * FROM payment_transactions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
        [order.id],
      );
      await grantEntitlementForOrder(client, order);
      await client.query("COMMIT");
      return { found: true, alreadyCompleted: true, order, transaction: existingTx.rows[0] ?? null };
    }

    const safePayload = sanitizeGatewayPayload(gatewayPayload);
    const receiptNumber = generateReceiptNumber();
    const txCode = generateTransactionCode();

    const txRes = await client.query(
      `INSERT INTO payment_transactions (
         transaction_code, order_id, student_id, gateway, gateway_order_id,
         gateway_payment_id, gateway_signature_verified, payment_method,
         amount_paise, currency, status, receipt_number, gateway_payload, verified_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SUCCESSFUL',$11,$12,now())
       ON CONFLICT (gateway_payment_id) DO UPDATE SET
         gateway_signature_verified = payment_transactions.gateway_signature_verified OR EXCLUDED.gateway_signature_verified,
         payment_method = COALESCE(EXCLUDED.payment_method, payment_transactions.payment_method),
         status = 'SUCCESSFUL',
         gateway_payload = EXCLUDED.gateway_payload,
         verified_at = COALESCE(payment_transactions.verified_at, now()),
         updated_at = now()
       RETURNING *`,
      [
        txCode,
        order.id,
        order.student_id,
        order.gateway,
        order.gateway_order_id,
        gatewayPaymentId,
        signatureVerified,
        paymentMethod || safePayload.method || null,
        order.total_amount_paise,
        order.currency,
        receiptNumber,
        JSON.stringify(safePayload),
      ],
    );

    const updatedOrder = (
      await client.query(
        `UPDATE payment_orders
         SET status = 'SUCCESSFUL', completed_at = COALESCE(completed_at, now()), updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [order.id],
      )
    ).rows[0];

    const entitlement = await grantEntitlementForOrder(client, updatedOrder);

    await writePaymentAudit(client, {
      actorId: actorId ?? order.student_id,
      action: "payment.verified",
      entityType: "payment_order",
      entityId: order.id,
      details: {
        source,
        orderNumber: order.order_number,
        gatewayPaymentId,
        amountPaise: order.total_amount_paise,
        itemType: order.item_type,
      },
      ip,
    });

    await client.query("COMMIT");
    return {
      found: true,
      alreadyCompleted: false,
      order: updatedOrder,
      transaction: txRes.rows[0],
      entitlement,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reconciles a pending/uncertain order directly with Razorpay before permitting a retry or marking failed.
 */
export async function reconcileOrderWithGateway({ orderId, studentId = null, ip = null }) {
  const orderRes = await pool.query(
    studentId
      ? "SELECT * FROM payment_orders WHERE id = $1 AND student_id = $2"
      : "SELECT * FROM payment_orders WHERE id = $1",
    studentId ? [orderId, studentId] : [orderId],
  );
  if (!orderRes.rowCount) {
    throw Object.assign(new Error("Payment order not found."), { status: 404 });
  }
  const order = orderRes.rows[0];
  if (["SUCCESSFUL", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status)) {
    return { reconciled: true, status: order.status, order };
  }
  if (!order.gateway_order_id) {
    return { reconciled: false, status: order.status, order };
  }

  const gatewayPayments = await fetchGatewayOrderPayments(order.gateway_order_id);
  const items = Array.isArray(gatewayPayments?.items) ? gatewayPayments.items : [];

  const captured = items.find((p) => p.status === "captured");
  if (captured) {
    const finalized = await finalizeVerifiedPayment({
      orderId: order.id,
      gatewayOrderId: order.gateway_order_id,
      gatewayPaymentId: captured.id,
      paymentMethod: captured.method || null,
      gatewayPayload: captured,
      signatureVerified: true,
      source: "gateway_reconciliation",
      actorId: studentId ?? order.student_id,
      ip,
    });
    return {
      reconciled: true,
      status: "SUCCESSFUL",
      order: finalized.order,
      transaction: finalized.transaction,
    };
  }

  const authorizedOrPending = items.find((p) => p.status === "authorized" || p.status === "created");
  if (authorizedOrPending) {
    await pool.query(
      "UPDATE payment_orders SET status = 'PROCESSING', updated_at = now() WHERE id = $1",
      [order.id],
    );
    return { reconciled: true, status: "PROCESSING", order: { ...order, status: "PROCESSING" } };
  }

  const failed = items.find((p) => p.status === "failed");
  if (failed) {
    await recordFailedAttempt({
      order,
      gatewayPaymentId: failed.id,
      errorCode: failed.error_code,
      errorDescription: failed.error_description || failed.error_reason || "Payment failed at gateway.",
      gatewayPayload: failed,
      ip,
    });
    return { reconciled: true, status: "FAILED", order: { ...order, status: "FAILED" } };
  }

  return { reconciled: true, status: order.status, order };
}

export async function recordFailedAttempt({
  order,
  gatewayPaymentId = null,
  status = "FAILED",
  errorCode = null,
  errorDescription = "Payment did not complete.",
  gatewayPayload = {},
  ip = null,
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE",
      [order.id],
    );
    if (!locked.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }
    const current = locked.rows[0];
    // Never downgrade a successful order!
    if (["SUCCESSFUL", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current.status)) {
      await client.query("COMMIT");
      return current;
    }

    const safePayload = sanitizeGatewayPayload(gatewayPayload);
    const nextStatus = status === "CANCELLED" ? "CANCELLED" : "FAILED";
    await client.query(
      `UPDATE payment_orders
       SET status = $2, failure_reason = $3, updated_at = now()
       WHERE id = $1`,
      [current.id, nextStatus, errorDescription],
    );

    if (gatewayPaymentId) {
      await client.query(
        `INSERT INTO payment_transactions (
           transaction_code, order_id, student_id, gateway, gateway_order_id,
           gateway_payment_id, payment_method, amount_paise, currency,
           status, error_code, error_description, gateway_payload
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (gateway_payment_id) DO UPDATE SET
           status = EXCLUDED.status,
           error_code = EXCLUDED.error_code,
           error_description = EXCLUDED.error_description,
           gateway_payload = EXCLUDED.gateway_payload,
           updated_at = now()`,
        [
          generateTransactionCode(),
          current.id,
          current.student_id,
          current.gateway,
          current.gateway_order_id,
          gatewayPaymentId,
          safePayload.method || null,
          current.total_amount_paise,
          current.currency,
          nextStatus,
          errorCode,
          errorDescription,
          JSON.stringify(safePayload),
        ],
      );
    } else {
      await client.query(
        `INSERT INTO payment_transactions (
           transaction_code, order_id, student_id, gateway, gateway_order_id,
           amount_paise, currency, status, error_code, error_description, gateway_payload
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          generateTransactionCode(),
          current.id,
          current.student_id,
          current.gateway,
          current.gateway_order_id,
          current.total_amount_paise,
          current.currency,
          nextStatus,
          errorCode,
          errorDescription,
          JSON.stringify(safePayload),
        ],
      );
    }

    await writePaymentAudit(client, {
      actorId: current.student_id,
      action: nextStatus === "CANCELLED" ? "payment.cancelled" : "payment.failed",
      entityType: "payment_order",
      entityId: current.id,
      details: {
        orderNumber: current.order_number,
        gatewayPaymentId,
        errorCode,
        errorDescription,
      },
      ip,
    });

    await client.query("COMMIT");
    return { ...current, status: nextStatus, failure_reason: errorDescription };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPaymentDirectlyWithGateway(gatewayPaymentId) {
  return fetchGatewayPayment(gatewayPaymentId);
}
