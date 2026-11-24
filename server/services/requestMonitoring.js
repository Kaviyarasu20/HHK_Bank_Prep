import crypto from "node:crypto";

/**
 * Operational Monitoring, Request Correlation & Readiness Middleware.
 * - Attaches a safe `X-Request-Id` correlation header to every request/response.
 * - Emits structured JSON access logs for API calls (method, route, status, durationMs, requestId).
 * - Never logs passwords, session cookies, API secrets, or payment credentials.
 * - Evaluates `/api/ready` readiness without leaking internal secrets or hostnames.
 */

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "razorpay_signature",
  "api_key",
]);

export function sanitizeLogMeta(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const low = k.toLowerCase();
    if (REDACTED_KEYS.has(low) || low.includes("secret") || low.includes("password") || low.includes("token")) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function requestCorrelationMiddleware(req, res, next) {
  const incoming = req.headers["x-request-id"];
  const reqId =
    typeof incoming === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();

  req.requestId = reqId;
  res.setHeader("X-Request-Id", reqId);

  const startMs = Date.now();
  res.on("finish", () => {
    if (!req.originalUrl?.startsWith("/api/")) return;
    const durationMs = Date.now() - startMs;
    const logLine = {
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      ts: new Date().toISOString(),
      requestId: reqId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs,
    };
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(logLine));
    }
  });
  next();
}

export async function evaluateReadiness({ dbPool, env = process.env } = {}) {
  const checks = {
    database: "unknown",
    sessionSecretConfigured: Boolean(env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 32),
    aiEnabled: String(env.CA_AI_ENABLED || "false").toLowerCase() === "true",
    paymentGatewayConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  };

  try {
    await dbPool.query("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "unavailable";
  }

  const ready = checks.database === "ok" && checks.sessionSecretConfigured;
  return {
    status: ready ? "ready" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };
}
