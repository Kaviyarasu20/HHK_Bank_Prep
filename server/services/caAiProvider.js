/**
 * Provider-agnostic AI client abstraction for HHK Current Affairs structuring.
 * - API keys are read strictly from environment variables and never logged or exposed.
 * - Supports disabling via CA_AI_ENABLED=false.
 * - Implements request timeout, bounded retry for 429/5xx, and token usage tracking.
 */

const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_RETRIES = 2;

export function getAiConfig(env = process.env) {
  const enabledRaw = String(env.CA_AI_ENABLED ?? "false").trim().toLowerCase();
  const enabled = enabledRaw === "true" || enabledRaw === "1";
  const provider = String(env.CA_AI_PROVIDER ?? "disabled").trim().toLowerCase();
  const model = String(
    env.CA_AI_MODEL ??
      (provider === "gemini"
        ? "gemini-2.0-flash"
        : provider === "openai"
          ? "gpt-4o-mini"
          : ""),
  ).trim();
  const apiKey = String(
    env.CA_AI_API_KEY ||
      (provider === "gemini" ? env.GEMINI_API_KEY : "") ||
      (provider === "openai" ? env.OPENAI_API_KEY : "") ||
      "",
  ).trim();
  const timeoutMs = Math.max(
    3_000,
    Math.min(60_000, Number(env.CA_AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  );
  const maxRetries = Math.max(0, Math.min(3, Number(env.CA_AI_MAX_RETRIES) || DEFAULT_MAX_RETRIES));

  return {
    enabled,
    provider,
    model,
    hasApiKey: Boolean(apiKey),
    timeoutMs,
    maxRetries,
    // Keep secret non-enumerable or internal; never serialize into API responses
    _apiKey: apiKey,
  };
}

async function callWithTimeout(fetchFn, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`AI provider request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function invokeGemini({ model, apiKey, systemPrompt, userPrompt, timeoutMs, fetchFn }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await callWithTimeout(
    fetchFn,
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const err = new Error(`AI provider returned HTTP ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = {
    promptTokens: data?.usageMetadata?.promptTokenCount ?? null,
    completionTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
    totalTokens: data?.usageMetadata?.totalTokenCount ?? null,
  };
  return { rawText, usage };
}

async function invokeOpenAi({ model, apiKey, systemPrompt, userPrompt, timeoutMs, fetchFn }) {
  const endpoint = "https://api.openai.com/v1/chat/completions";
  const res = await callWithTimeout(
    fetchFn,
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const err = new Error(`AI provider returned HTTP ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content || "";
  const usage = {
    promptTokens: data?.usage?.prompt_tokens ?? null,
    completionTokens: data?.usage?.completion_tokens ?? null,
    totalTokens: data?.usage?.total_tokens ?? null,
  };
  return { rawText, usage };
}

/**
 * Executes a structured JSON completion against the configured provider (or injected mock).
 * Never silently falls back to an unconfigured external provider.
 */
export async function executeAiCompletion({
  systemPrompt,
  userPrompt,
  env = process.env,
  fetchFn = fetch,
  providerFn = null,
}) {
  if (typeof providerFn === "function") {
    return providerFn({ systemPrompt, userPrompt });
  }

  const cfg = getAiConfig(env);
  if (!cfg.enabled || cfg.provider === "disabled") {
    throw Object.assign(
      new Error("AI processing is disabled. Configure CA_AI_ENABLED=true and an approved provider."),
      { status: 503 },
    );
  }
  if (!["gemini", "openai"].includes(cfg.provider)) {
    throw Object.assign(
      new Error(`Unsupported CA_AI_PROVIDER "${cfg.provider}". Expected "gemini" or "openai".`),
      { status: 503 },
    );
  }
  if (!cfg.hasApiKey || !cfg.model) {
    throw Object.assign(
      new Error(`AI provider "${cfg.provider}" is missing CA_AI_API_KEY or CA_AI_MODEL.`),
      { status: 503 },
    );
  }

  let lastErr;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
    try {
      const out =
        cfg.provider === "gemini"
          ? await invokeGemini({
              model: cfg.model,
              apiKey: cfg._apiKey,
              systemPrompt,
              userPrompt,
              timeoutMs: cfg.timeoutMs,
              fetchFn,
            })
          : await invokeOpenAi({
              model: cfg.model,
              apiKey: cfg._apiKey,
              systemPrompt,
              userPrompt,
              timeoutMs: cfg.timeoutMs,
              fetchFn,
            });
      return {
        provider: cfg.provider,
        model: cfg.model,
        rawText: out.rawText,
        usage: out.usage,
      };
    } catch (err) {
      lastErr = err;
      const retryable = err?.status === 429 || (err?.status >= 500 && err?.status < 600);
      if (!retryable || attempt >= cfg.maxRetries) break;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}
