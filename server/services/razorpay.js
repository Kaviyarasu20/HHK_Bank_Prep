import crypto from "node:crypto";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

/**
 * Reads Razorpay credentials strictly from backend environment variables.
 * NEVER returns keySecret or webhookSecret to any public or admin API response.
 */
export function getRazorpayConfig() {
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  const isConfigured = Boolean(keyId && keySecret);
  const detectedMode = keyId.startsWith("rzp_live_") ? "live" : "test";
  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    hasWebhookSecret: Boolean(webhookSecret),
    detectedMode,
  };
}

function getAuthHeader() {
  const { keyId, keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) {
    throw Object.assign(
      new Error("Payment gateway credentials are not configured on the server."),
      { status: 503, code: "GATEWAY_NOT_CONFIGURED" },
    );
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
}

async function razorpayRequest(endpoint, { method = "GET", body = null } = {}) {
  const headers = {
    Authorization: getAuthHeader(),
    "Content-Type": "application/json",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${RAZORPAY_API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const msg =
        data?.error?.description ||
        data?.error?.reason ||
        `Razorpay API request failed (${response.status}).`;
      throw Object.assign(new Error(msg), {
        status: response.status >= 500 ? 502 : 400,
        code: data?.error?.code || "GATEWAY_ERROR",
        gatewayError: data?.error || null,
      });
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw Object.assign(
        new Error("Payment gateway timed out. Please verify payment status before retrying."),
        { status: 504, code: "GATEWAY_TIMEOUT" },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createGatewayOrder({ amountPaise, currency = "INR", receipt, notes = {} }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw Object.assign(new Error("Order amount must be a positive integer in paise."), {
      status: 400,
    });
  }
  return razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount: amountPaise,
      currency,
      receipt: String(receipt).slice(0, 40),
      payment_capture: 1,
      notes,
    },
  });
}

export async function fetchGatewayPayment(paymentId) {
  if (!paymentId) {
    throw Object.assign(new Error("Gateway payment ID is required."), { status: 400 });
  }
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function fetchGatewayOrderPayments(gatewayOrderId) {
  if (!gatewayOrderId) {
    throw Object.assign(new Error("Gateway order ID is required."), { status: 400 });
  }
  return razorpayRequest(`/orders/${encodeURIComponent(gatewayOrderId)}/payments`);
}

export async function initiateGatewayRefund({ paymentId, amountPaise, notes = {}, receipt = "" }) {
  if (!paymentId) {
    throw Object.assign(new Error("Gateway payment ID is required to initiate a refund."), {
      status: 400,
    });
  }
  const payload = { notes };
  if (Number.isInteger(amountPaise) && amountPaise > 0) {
    payload.amount = amountPaise;
  }
  if (receipt) {
    payload.receipt = String(receipt).slice(0, 40);
  }
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchGatewayRefund(paymentId, refundId) {
  if (!paymentId || !refundId) {
    throw Object.assign(new Error("Gateway payment ID and refund ID are required."), {
      status: 400,
    });
  }
  return razorpayRequest(
    `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`,
  );
}

/**
 * Timing-safe HMAC-SHA256 verification for Razorpay Checkout payment signatures.
 */
export function verifyCheckoutSignature({ orderId, paymentId, signature, secretOverride }) {
  const secret = secretOverride ?? getRazorpayConfig().keySecret;
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return timingSafeHexCompare(expected, String(signature));
}

/**
 * Timing-safe HMAC-SHA256 verification for Razorpay Webhook signatures.
 */
export function verifyWebhookSignature({ rawBody, signature, secretOverride }) {
  const secret = secretOverride ?? getRazorpayConfig().webhookSecret;
  if (!secret || !rawBody || !signature) return false;
  const payloadBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody), "utf8");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadBuffer)
    .digest("hex");
  return timingSafeHexCompare(expected, String(signature));
}

export function timingSafeHexCompare(expectedHex, providedHex) {
  if (typeof expectedHex !== "string" || typeof providedHex !== "string") return false;
  const a = Buffer.from(expectedHex.trim().toLowerCase(), "utf8");
  const b = Buffer.from(providedHex.trim().toLowerCase(), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Strips sensitive payment instrument fields so no card/CVV/UPI PIN/auth tokens are ever stored.
 */
export function sanitizeGatewayPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const safe = {
    id: payload.id ?? null,
    entity: payload.entity ?? null,
    amount: payload.amount ?? null,
    currency: payload.currency ?? null,
    status: payload.status ?? null,
    order_id: payload.order_id ?? null,
    method: payload.method ?? null,
    captured: payload.captured ?? null,
    bank: payload.bank ?? null,
    wallet: payload.wallet ?? null,
    error_code: payload.error_code ?? null,
    error_description: payload.error_description ?? null,
    error_reason: payload.error_reason ?? null,
    created_at: payload.created_at ?? null,
  };
  return safe;
}
