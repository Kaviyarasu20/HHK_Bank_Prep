import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth, validate } from "../middleware.js";
import { sanitizeText } from "../schemas.js";
import { evaluateTestAccess } from "../services/testAccess.js";
import {
  createGatewayOrder,
  getRazorpayConfig,
  sanitizeGatewayPayload,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../services/razorpay.js";
import {
  calculateOrderPricing,
  finalizeVerifiedPayment,
  generateOrderNumber,
  generateTransactionCode,
  getEffectivePlanPricePaise,
  getPaymentSettings,
  reconcileOrderWithGateway,
  recordFailedAttempt,
  verifyPaymentDirectlyWithGateway,
  writePaymentAudit,
} from "../services/paymentService.js";

export const paymentRouter = Router();

const paymentActionLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const createOrderSchema = z
  .object({
    itemType: z.enum(["MOCK_TEST", "SUBSCRIPTION"]),
    mockTestId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    acceptedPolicies: z.boolean().refine((v) => v === true, {
      message: "You must accept the Terms, Privacy Policy, and Refund Policy before checkout.",
    }),
  })
  .superRefine((val, ctx) => {
    if (val.itemType === "MOCK_TEST" && !val.mockTestId) {
      ctx.addIssue({ code: "custom", path: ["mockTestId"], message: "Select a mock test to purchase." });
    }
    if (val.itemType === "SUBSCRIPTION" && !val.planId) {
      ctx.addIssue({ code: "custom", path: ["planId"], message: "Select a subscription plan to purchase." });
    }
  });

const verifyPaymentSchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().trim().min(6).max(120),
  razorpayPaymentId: z.string().trim().min(6).max(120),
  razorpaySignature: z.string().trim().min(16).max(256),
});

const refundRequestSchema = z.object({
  transactionId: z.string().uuid(),
  requestedAmountPaise: z.number().int().positive().optional(),
  reasonCategory: z.enum([
    "DUPLICATE_PAYMENT",
    "FAILED_DEDUCTION",
    "TECHNICAL_ISSUE",
    "WRONG_PURCHASE",
    "OTHER",
  ]),
  reasonDetails: z.string().trim().min(5).max(2000).transform(sanitizeText),
});

/**
 * Centralized Test Access Check Endpoint.
 * Accessible with or without session — returns LOGIN_REQUIRED for visitors.
 */
paymentRouter.get("/tests/:testId/access", async (req, res) => {
  const userId = req.session?.userId ?? null;
  let userRole = req.session?.role ?? null;
  if (userId && !userRole) {
    const u = await pool.query("SELECT role, is_active FROM users WHERE id = $1", [userId]);
    if (!u.rowCount || !u.rows[0].is_active) {
      return res.status(401).json({
        allowed: false,
        code: "LOGIN_REQUIRED",
        message: "Please log in to your HHK account to start this mock test.",
      });
    }
    userRole = u.rows[0].role;
  }

  const access = await evaluateTestAccess({
    db: pool,
    userId,
    userRole,
    testId: req.params.testId,
  });
  res.status(access.allowed ? 200 : access.httpStatus).json({ access });
});

/**
 * Razorpay Webhook Endpoint (server-to-server, verified via HMAC-SHA256 on raw body).
 * Idempotent: duplicate event_id notifications are safely ignored.
 */
paymentRouter.post("/payments/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const eventId =
    req.headers["x-razorpay-event-id"] ||
    `${req.body?.event || "unknown"}:${req.body?.created_at || Date.now()}:${req.body?.payload?.payment?.entity?.id || req.body?.payload?.refund?.entity?.id || "na"}`;
  const eventType = req.body?.event || "unknown";
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body ?? {}));

  const valid = verifyWebhookSignature({ rawBody, signature });
  if (!valid) {
    await pool
      .query(
        `INSERT INTO payment_webhook_events (gateway, event_id, event_type, signature_valid, processed, processing_error, payload)
         VALUES ('razorpay', $1, $2, FALSE, FALSE, 'Invalid webhook signature', $3)
         ON CONFLICT (event_id) DO NOTHING`,
        [String(eventId), String(eventType), JSON.stringify({ event: eventType })],
      )
      .catch(() => {});
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  // Record event idempotently
  const inserted = await pool.query(
    `INSERT INTO payment_webhook_events (gateway, event_id, event_type, signature_valid, processed, payload)
     VALUES ('razorpay', $1, $2, TRUE, FALSE, $3)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      String(eventId),
      String(eventType),
      JSON.stringify({
        event: eventType,
        payment: sanitizeGatewayPayload(req.body?.payload?.payment?.entity),
        refund: req.body?.payload?.refund?.entity
          ? {
              id: req.body.payload.refund.entity.id,
              payment_id: req.body.payload.refund.entity.payment_id,
              amount: req.body.payload.refund.entity.amount,
              status: req.body.payload.refund.entity.status,
            }
          : null,
      }),
    ],
  );

  if (!inserted.rowCount) {
    // Already received and processed (idempotent replay)
    return res.status(200).json({ status: "duplicate_ignored" });
  }

  const webhookRowId = inserted.rows[0].id;
  try {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      const orderEntity = req.body?.payload?.order?.entity;
      const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const gatewayPaymentId = paymentEntity?.id;
      if (gatewayOrderId && gatewayPaymentId) {
        await finalizeVerifiedPayment({
          gatewayOrderId,
          gatewayPaymentId,
          paymentMethod: paymentEntity?.method || null,
          gatewayPayload: paymentEntity || {},
          signatureVerified: true,
          source: `webhook:${eventType}`,
          ip: req.ip,
        });
      }
    } else if (eventType === "payment.failed") {
      const paymentEntity = req.body?.payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        const orderRes = await pool.query(
          "SELECT * FROM payment_orders WHERE gateway_order_id = $1",
          [paymentEntity.order_id],
        );
        if (orderRes.rowCount) {
          await recordFailedAttempt({
            order: orderRes.rows[0],
            gatewayPaymentId: paymentEntity.id,
            status: "FAILED",
            errorCode: paymentEntity.error_code,
            errorDescription:
              paymentEntity.error_description || paymentEntity.error_reason || "Payment failed.",
            gatewayPayload: paymentEntity,
            ip: req.ip,
          });
        }
      }
    } else if (eventType === "refund.processed" || eventType === "refund.failed") {
      const refundEntity = req.body?.payload?.refund?.entity;
      if (refundEntity?.id) {
        await syncRefundFromWebhook(refundEntity, eventType, req.ip);
      }
    }

    await pool.query(
      "UPDATE payment_webhook_events SET processed = TRUE, processed_at = now() WHERE id = $1",
      [webhookRowId],
    );
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    await pool.query(
      "UPDATE payment_webhook_events SET processing_error = $2 WHERE id = $1",
      [webhookRowId, error.message],
    );
    return res.status(500).json({ error: "Webhook processing failed." });
  }
});

async function syncRefundFromWebhook(refundEntity, eventType, ip) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const reqRes = await client.query(
      "SELECT * FROM refund_requests WHERE gateway_refund_id = $1 FOR UPDATE",
      [refundEntity.id],
    );
    if (!reqRes.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    const refundReq = reqRes.rows[0];
    const txRes = await client.query(
      "SELECT * FROM payment_transactions WHERE id = $1 FOR UPDATE",
      [refundReq.transaction_id],
    );
    const tx = txRes.rows[0];

    if (eventType === "refund.processed" || refundEntity.status === "processed") {
      if (refundReq.status !== "REFUNDED") {
        const refundAmt = Math.trunc(Number(refundEntity.amount || refundReq.requested_amount_paise));
        const newTotalRefunded = Math.min(tx.amount_paise, Number(tx.refunded_amount_paise) + refundAmt);
        const nextTxStatus = newTotalRefunded >= tx.amount_paise ? "REFUNDED" : "PARTIALLY_REFUNDED";

        await client.query(
          `UPDATE refund_requests
           SET status = 'REFUNDED', gateway_refund_status = 'processed', refunded_at = now(), updated_at = now()
           WHERE id = $1`,
          [refundReq.id],
        );
        await client.query(
          `UPDATE payment_transactions
           SET refunded_amount_paise = $2, status = $3, updated_at = now()
           WHERE id = $1`,
          [tx.id, newTotalRefunded, nextTxStatus],
        );
        await client.query(
          `UPDATE payment_orders SET status = $2, updated_at = now() WHERE id = $1`,
          [tx.order_id, nextTxStatus],
        );
        // If fully refunded, revoke entitlement/subscription tied to that order
        if (nextTxStatus === "REFUNDED") {
          await client.query(
            "UPDATE student_subscriptions SET status = 'REVOKED', cancelled_at = now() WHERE order_id = $1",
            [tx.order_id],
          );
          await client.query(
            "UPDATE student_test_entitlements SET status = 'REVOKED' WHERE order_id = $1",
            [tx.order_id],
          );
        }
        await writePaymentAudit(client, {
          actorId: null,
          action: "refund.confirmed_by_gateway",
          entityType: "refund_request",
          entityId: refundReq.id,
          details: { gatewayRefundId: refundEntity.id, amountPaise: refundAmt, nextTxStatus },
          ip,
        });
      }
    } else if (eventType === "refund.failed" || refundEntity.status === "failed") {
      await client.query(
        `UPDATE refund_requests
         SET status = 'FAILED', gateway_refund_status = 'failed', updated_at = now()
         WHERE id = $1`,
        [refundReq.id],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Create a server-side Razorpay payment order.
 * Strictly retrieves pricing from PostgreSQL — never trusts frontend amounts.
 * Prevents duplicate orders via idempotency key and active entitlement/pending order checks.
 */
paymentRouter.post("/payments/orders", requireAuth, paymentActionLimiter, async (req, res) => {
  const input = validate(createOrderSchema, req.body);
  const studentId = req.session.userId;
  const settings = await getPaymentSettings();

  if (!settings.gateway_enabled) {
    return res.status(503).json({ error: "Online payments are temporarily disabled by the administrator." });
  }

  const rp = getRazorpayConfig();
  if (!rp.isConfigured) {
    return res.status(503).json({
      error: "Payment gateway is not yet configured. Please contact HHK support.",
    });
  }

  // Idempotency replay check
  if (input.idempotencyKey) {
    const existing = await pool.query(
      "SELECT * FROM payment_orders WHERE idempotency_key = $1 AND student_id = $2",
      [input.idempotencyKey, studentId],
    );
    if (existing.rowCount) {
      const order = existing.rows[0];
      if (["CREATED", "PENDING", "PROCESSING"].includes(order.status) && order.gateway_order_id) {
        return res.status(200).json({
          order,
          checkout: {
            keyId: rp.keyId,
            razorpayOrderId: order.gateway_order_id,
            amountPaise: order.total_amount_paise,
            currency: order.currency,
            name: settings.business_name,
            description: order.item_title,
          },
          idempotentReplay: true,
        });
      }
    }
  }

  let itemTitle = "";
  let baseAmountPaise = 0;
  let currency = settings.currency || "INR";

  if (input.itemType === "MOCK_TEST") {
    if (!settings.allow_individual_test_purchase) {
      return res.status(403).json({ error: "Individual mock test purchases are currently disabled." });
    }
    const access = await evaluateTestAccess({
      db: pool,
      userId: studentId,
      userRole: req.session.role,
      testId: input.mockTestId,
    });
    if (access.allowed) {
      return res.status(409).json({
        error: "You already have active access to this mock test. No additional payment is required.",
        code: access.code,
      });
    }
    if (access.code === "TEST_NOT_AVAILABLE") {
      return res.status(404).json({ error: access.message });
    }
    const testRes = await pool.query(
      "SELECT id, name, access_type, price_paise, currency, is_purchasable FROM mock_tests WHERE id = $1",
      [input.mockTestId],
    );
    const test = testRes.rows[0];
    if (!test.is_purchasable || test.access_type === "SUBSCRIPTION") {
      return res.status(400).json({
        error: "This mock test is available through a subscription plan rather than individual purchase.",
      });
    }
    if (Number(test.price_paise) <= 0) {
      return res.status(400).json({ error: "This mock test does not have a valid purchase price configured." });
    }
    itemTitle = test.name;
    baseAmountPaise = Math.trunc(Number(test.price_paise));
    currency = test.currency || currency;
  } else {
    if (!settings.allow_subscription_purchase) {
      return res.status(403).json({ error: "Subscription purchases are currently disabled." });
    }
    const planRes = await pool.query(
      "SELECT * FROM subscription_plans WHERE id = $1 AND is_active = TRUE",
      [input.planId],
    );
    if (!planRes.rowCount) {
      return res.status(404).json({ error: "Selected subscription plan is not available." });
    }
    const plan = planRes.rows[0];
    baseAmountPaise = getEffectivePlanPricePaise(plan);
    if (baseAmountPaise <= 0) {
      return res.status(400).json({ error: "Selected subscription plan does not have a valid price." });
    }
    itemTitle = `${plan.name} (${plan.duration_days} days)`;
    currency = plan.currency || currency;
  }

  // Reconcile any recent PENDING/PROCESSING order for the same item before creating a new charge
  const recentPending = await pool.query(
    `SELECT id FROM payment_orders
     WHERE student_id = $1
       AND item_type = $2
       AND COALESCE(mock_test_id::text, '') = COALESCE($3::text, '')
       AND COALESCE(plan_id::text, '') = COALESCE($4::text, '')
       AND status IN ('PENDING', 'PROCESSING')
       AND created_at > now() - interval '30 minutes'
     ORDER BY created_at DESC LIMIT 1`,
    [studentId, input.itemType, input.mockTestId ?? null, input.planId ?? null],
  );
  if (recentPending.rowCount) {
    try {
      const reconciled = await reconcileOrderWithGateway({
        orderId: recentPending.rows[0].id,
        studentId,
        ip: req.ip,
      });
      if (reconciled.status === "SUCCESSFUL") {
        return res.status(409).json({
          error: "Your previous payment for this item succeeded and access has been activated!",
          code: "ALREADY_PAID_RECONCILED",
          order: reconciled.order,
        });
      }
      if (reconciled.status === "PROCESSING") {
        return res.status(409).json({
          error: "A payment for this item is currently processing at the bank. Please wait a moment and check Payment History before retrying.",
          code: "PAYMENT_IN_PROGRESS",
          order: reconciled.order,
        });
      }
    } catch {
      // If gateway reconciliation fails transiently, continue safely
    }
  }

  const pricing = calculateOrderPricing(baseAmountPaise, settings);
  const orderNumber = generateOrderNumber();

  // Record policy acceptance audit
  await pool.query(
    `INSERT INTO policy_acceptances (user_id, policy_type, policy_version, context, ip_address, user_agent)
     VALUES ($1, 'CHECKOUT_BUNDLE', $2, 'checkout', $3, $4)`,
    [studentId, settings.policy_version || "1.0", req.ip ?? null, req.headers["user-agent"] ?? null],
  );

  // Create Razorpay order server-side
  const gatewayOrder = await createGatewayOrder({
    amountPaise: pricing.totalAmountPaise,
    currency,
    receipt: orderNumber,
    notes: {
      order_number: orderNumber,
      student_id: studentId,
      item_type: input.itemType,
      item_id: input.mockTestId || input.planId,
    },
  });

  const savedOrder = (
    await pool.query(
      `INSERT INTO payment_orders (
         order_number, idempotency_key, student_id, item_type, mock_test_id, plan_id,
         item_title, base_amount_paise, tax_amount_paise, total_amount_paise,
         currency, gateway, gateway_order_id, status
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'razorpay',$12,'PENDING')
       RETURNING *`,
      [
        orderNumber,
        input.idempotencyKey ?? null,
        studentId,
        input.itemType,
        input.mockTestId ?? null,
        input.planId ?? null,
        itemTitle,
        pricing.baseAmountPaise,
        pricing.taxAmountPaise,
        pricing.totalAmountPaise,
        currency,
        gatewayOrder.id,
      ],
    )
  ).rows[0];

  await writePaymentAudit(pool, {
    actorId: studentId,
    action: "payment.order_created",
    entityType: "payment_order",
    entityId: savedOrder.id,
    details: {
      orderNumber,
      gatewayOrderId: gatewayOrder.id,
      itemType: input.itemType,
      totalAmountPaise: pricing.totalAmountPaise,
    },
    ip: req.ip,
  });

  const studentRes = await pool.query("SELECT full_name, email, mobile FROM users WHERE id = $1", [
    studentId,
  ]);

  res.status(201).json({
    order: savedOrder,
    checkout: {
      keyId: rp.keyId,
      razorpayOrderId: gatewayOrder.id,
      amountPaise: pricing.totalAmountPaise,
      currency,
      name: settings.business_name,
      description: itemTitle,
      prefill: {
        name: studentRes.rows[0]?.full_name || "",
        email: studentRes.rows[0]?.email || "",
        contact: studentRes.rows[0]?.mobile || "",
      },
    },
  });
});

/**
 * Verify Razorpay Checkout signature server-side, cross-check with Razorpay API,
 * and grant entitlements atomically.
 */
paymentRouter.post("/payments/verify", requireAuth, paymentActionLimiter, async (req, res) => {
  const input = validate(verifyPaymentSchema, req.body);
  const studentId = req.session.userId;

  const orderRes = await pool.query(
    "SELECT * FROM payment_orders WHERE id = $1 AND student_id = $2",
    [input.orderId, studentId],
  );
  if (!orderRes.rowCount) {
    return res.status(404).json({ error: "Payment order not found." });
  }
  const order = orderRes.rows[0];
  if (order.gateway_order_id !== input.razorpayOrderId) {
    return res.status(400).json({ error: "Payment order mismatch." });
  }

  const signatureValid = verifyCheckoutSignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!signatureValid) {
    await recordFailedAttempt({
      order,
      gatewayPaymentId: input.razorpayPaymentId,
      status: "FAILED",
      errorCode: "INVALID_SIGNATURE",
      errorDescription: "Payment signature verification failed.",
      ip: req.ip,
    });
    return res.status(400).json({
      error: "Payment signature could not be verified. Access was not activated.",
    });
  }

  // Verify transaction status directly with Razorpay when possible
  let gatewayPayment = null;
  try {
    gatewayPayment = await verifyPaymentDirectlyWithGateway(input.razorpayPaymentId);
    if (
      gatewayPayment.order_id !== input.razorpayOrderId ||
      Number(gatewayPayment.amount) !== Number(order.total_amount_paise)
    ) {
      return res.status(400).json({
        error: "Verified gateway payment details do not match this order.",
      });
    }
    if (!["captured", "authorized"].includes(gatewayPayment.status)) {
      await recordFailedAttempt({
        order,
        gatewayPaymentId: input.razorpayPaymentId,
        status: "FAILED",
        errorCode: gatewayPayment.error_code || "NOT_CAPTURED",
        errorDescription: gatewayPayment.error_description || `Gateway status: ${gatewayPayment.status}`,
        gatewayPayload: gatewayPayment,
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Payment was not captured by the payment gateway.",
      });
    }
  } catch (err) {
    // If gateway status fetch fails transiently after valid cryptographic signature, proceed with signature verification
    if (err.status === 400) throw err;
  }

  const finalized = await finalizeVerifiedPayment({
    orderId: order.id,
    gatewayOrderId: input.razorpayOrderId,
    gatewayPaymentId: input.razorpayPaymentId,
    paymentMethod: gatewayPayment?.method || null,
    gatewayPayload: gatewayPayment || { id: input.razorpayPaymentId, order_id: input.razorpayOrderId },
    signatureVerified: true,
    source: "checkout_verify",
    actorId: studentId,
    ip: req.ip,
  });

  res.json({
    verified: true,
    order: finalized.order,
    transaction: finalized.transaction,
    message: "Payment verified successfully! Your access is now active.",
  });
});

/**
 * Handle frontend-reported cancellation or failure safely (reconciles with gateway first!).
 */
paymentRouter.post("/payments/orders/:orderId/status", requireAuth, paymentActionLimiter, async (req, res) => {
  const input = validate(
    z.object({
      action: z.enum(["cancelled", "failed"]),
      reason: z.string().trim().max(500).optional().default(""),
      gatewayPaymentId: z.string().trim().max(120).optional(),
    }),
    req.body,
  );
  const orderRes = await pool.query(
    "SELECT * FROM payment_orders WHERE id = $1 AND student_id = $2",
    [req.params.orderId, req.session.userId],
  );
  if (!orderRes.rowCount) {
    return res.status(404).json({ error: "Payment order not found." });
  }
  const order = orderRes.rows[0];

  // Always reconcile uncertain orders with gateway before marking failed/cancelled
  try {
    const reconciled = await reconcileOrderWithGateway({
      orderId: order.id,
      studentId: req.session.userId,
      ip: req.ip,
    });
    if (reconciled.status === "SUCCESSFUL") {
      return res.json({
        status: "SUCCESSFUL",
        order: reconciled.order,
        message: "Good news! Your payment succeeded at the gateway and your access is active.",
      });
    }
  } catch {
    // Proceed to record local failed/cancelled status
  }

  const updated = await recordFailedAttempt({
    order,
    gatewayPaymentId: input.gatewayPaymentId || null,
    status: input.action === "cancelled" ? "CANCELLED" : "FAILED",
    errorDescription:
      input.reason || (input.action === "cancelled" ? "Checkout was cancelled by student." : "Payment failed."),
    ip: req.ip,
  });

  res.json({
    status: updated?.status || (input.action === "cancelled" ? "CANCELLED" : "FAILED"),
    order: updated,
    message:
      input.action === "cancelled"
        ? "Checkout was cancelled. No charge was confirmed."
        : "Payment attempt failed. You can safely start a new payment attempt.",
  });
});

/**
 * Explicit student reconciliation check for a pending/uncertain order.
 */
paymentRouter.post("/payments/orders/:orderId/reconcile", requireAuth, paymentActionLimiter, async (req, res) => {
  const result = await reconcileOrderWithGateway({
    orderId: req.params.orderId,
    studentId: req.session.userId,
    ip: req.ip,
  });
  res.json(result);
});

/**
 * Student Payment History (strictly scoped to req.session.userId, paginated & filterable).
 */
paymentRouter.get("/payments/history", requireAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(5, Number(req.query.limit || 15)));
  const offset = (page - 1) * limit;
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;

  const [rows, countRes] = await Promise.all([
    pool.query(
      `SELECT
         po.id AS order_id, po.order_number, po.item_type, po.item_title,
         po.base_amount_paise, po.tax_amount_paise, po.total_amount_paise, po.currency,
         po.status AS order_status, po.failure_reason, po.created_at AS order_date,
         pt.id AS transaction_id, pt.transaction_code, pt.gateway_payment_id,
         pt.payment_method, pt.status AS transaction_status, pt.refunded_amount_paise,
         pt.receipt_number, pt.verified_at,
         (SELECT rr.status FROM refund_requests rr WHERE rr.transaction_id = pt.id ORDER BY rr.created_at DESC LIMIT 1) AS refund_status
       FROM payment_orders po
       LEFT JOIN LATERAL (
         SELECT * FROM payment_transactions
         WHERE order_id = po.id
         ORDER BY created_at DESC LIMIT 1
       ) pt ON TRUE
       WHERE po.student_id = $1
         AND ($2::text IS NULL OR COALESCE(pt.status, po.status) = $2)
       ORDER BY po.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.session.userId, status, limit, offset],
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM payment_orders po
       WHERE po.student_id = $1
         AND ($2::text IS NULL OR po.status = $2)`,
      [req.session.userId, status],
    ),
  ]);

  res.json({
    transactions: rows.rows,
    pagination: {
      page,
      limit,
      total: countRes.rows[0]?.total ?? 0,
      totalPages: Math.max(1, Math.ceil((countRes.rows[0]?.total ?? 0) / limit)),
    },
  });
});

/**
 * Student Purchases & Active Subscription Overview.
 */
paymentRouter.get("/payments/purchases", requireAuth, async (req, res) => {
  const [entitlements, subscriptions] = await Promise.all([
    pool.query(
      `SELECT
         ste.id, ste.mock_test_id, ste.source, ste.status, ste.granted_at, ste.expires_at,
         mt.name AS test_name, mt.test_type, mt.set_label,
         po.order_number, po.total_amount_paise, po.currency, po.status AS payment_status,
         pt.transaction_code
       FROM student_test_entitlements ste
       JOIN mock_tests mt ON mt.id = ste.mock_test_id
       LEFT JOIN payment_orders po ON po.id = ste.order_id
       LEFT JOIN payment_transactions pt ON pt.order_id = po.id AND pt.status IN ('SUCCESSFUL','PARTIALLY_REFUNDED','REFUNDED')
       WHERE ste.student_id = $1
       ORDER BY ste.granted_at DESC`,
      [req.session.userId],
    ),
    pool.query(
      `SELECT
         ss.id, ss.plan_id, ss.status, ss.starts_at, ss.expires_at, ss.cancelled_at,
         sp.name AS plan_name, sp.description AS plan_description, sp.duration_days,
         sp.access_scope, sp.features,
         po.order_number, po.total_amount_paise, po.currency, pt.transaction_code
       FROM student_subscriptions ss
       JOIN subscription_plans sp ON sp.id = ss.plan_id
       LEFT JOIN payment_orders po ON po.id = ss.order_id
       LEFT JOIN payment_transactions pt ON pt.order_id = po.id AND pt.status IN ('SUCCESSFUL','PARTIALLY_REFUNDED','REFUNDED')
       WHERE ss.student_id = $1
       ORDER BY ss.expires_at DESC`,
      [req.session.userId],
    ),
  ]);

  res.json({
    entitlements: entitlements.rows,
    subscriptions: subscriptions.rows,
  });
});

/**
 * Student Receipt / Invoice Data (strictly own transaction only).
 */
paymentRouter.get("/payments/transactions/:transactionId/receipt", requireAuth, async (req, res) => {
  const txRes = await pool.query(
    `SELECT
       pt.id, pt.transaction_code, pt.receipt_number, pt.gateway_order_id, pt.gateway_payment_id,
       pt.payment_method, pt.amount_paise, pt.refunded_amount_paise, pt.currency, pt.status,
       pt.verified_at, pt.created_at,
       po.order_number, po.item_type, po.item_title, po.base_amount_paise, po.tax_amount_paise, po.total_amount_paise,
       u.full_name, u.email, u.mobile
     FROM payment_transactions pt
     JOIN payment_orders po ON po.id = pt.order_id
     JOIN users u ON u.id = pt.student_id
     WHERE pt.id = $1 AND pt.student_id = $2`,
    [req.params.transactionId, req.session.userId],
  );
  if (!txRes.rowCount) {
    return res.status(404).json({ error: "Receipt not found." });
  }
  const settings = await getPaymentSettings();
  res.json({
    receipt: {
      ...txRes.rows[0],
      businessName: settings.business_name,
      businessAddress: settings.business_address,
      supportEmail: settings.support_email || process.env.SUPPORT_EMAIL || "",
      taxLabel: settings.tax_label,
    },
  });
});

/**
 * Student Refund Requests (submit & list own requests).
 */
paymentRouter.get("/payments/refunds", requireAuth, async (req, res) => {
  const rows = await pool.query(
    `SELECT
       rr.id, rr.transaction_id, rr.order_id, rr.requested_amount_paise,
       rr.reason_category, rr.reason_details, rr.status, rr.rejection_reason,
       rr.gateway_refund_id, rr.gateway_refund_status, rr.refunded_at,
       rr.created_at, rr.updated_at,
       po.order_number, po.item_title, pt.transaction_code, pt.amount_paise, pt.currency
     FROM refund_requests rr
     JOIN payment_orders po ON po.id = rr.order_id
     JOIN payment_transactions pt ON pt.id = rr.transaction_id
     WHERE rr.student_id = $1
     ORDER BY rr.created_at DESC`,
    [req.session.userId],
  );
  res.json({ refunds: rows.rows });
});

paymentRouter.post("/payments/refunds", requireAuth, paymentActionLimiter, async (req, res) => {
  const input = validate(refundRequestSchema, req.body);
  const studentId = req.session.userId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txRes = await client.query(
      "SELECT * FROM payment_transactions WHERE id = $1 AND student_id = $2 FOR UPDATE",
      [input.transactionId, studentId],
    );
    if (!txRes.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found." });
    }
    const tx = txRes.rows[0];
    if (!["SUCCESSFUL", "PARTIALLY_REFUNDED"].includes(tx.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only successful transactions are eligible for a refund request." });
    }

    const openReq = await client.query(
      `SELECT id FROM refund_requests
       WHERE transaction_id = $1 AND status IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REFUND_INITIATED')`,
      [tx.id],
    );
    if (openReq.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An active refund request already exists for this transaction." });
    }

    const remainingPaise = Number(tx.amount_paise) - Number(tx.refunded_amount_paise);
    const requestedPaise = input.requestedAmountPaise ?? remainingPaise;
    if (requestedPaise <= 0 || requestedPaise > remainingPaise) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Requested refund amount exceeds the remaining eligible captured amount.",
      });
    }

    const created = (
      await client.query(
        `INSERT INTO refund_requests (
           transaction_id, order_id, student_id, requested_amount_paise,
           reason_category, reason_details, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'REQUESTED')
         RETURNING *`,
        [tx.id, tx.order_id, studentId, requestedPaise, input.reasonCategory, input.reasonDetails],
      )
    ).rows[0];

    await writePaymentAudit(client, {
      actorId: studentId,
      action: "refund.requested",
      entityType: "refund_request",
      entityId: created.id,
      details: {
        transactionCode: tx.transaction_code,
        requestedAmountPaise: requestedPaise,
        reasonCategory: input.reasonCategory,
      },
      ip: req.ip,
    });

    await client.query("COMMIT");
    res.status(201).json({
      refund: created,
      message: "Refund request submitted. You can track its progress in Payment History.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});
