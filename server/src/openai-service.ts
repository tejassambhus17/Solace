import OpenAI from "openai";

export type AIConfig = {
  apiKey?: string;
  model: string;
  lightModel?: string;
  transcriptionModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
  baseUrl: string;
  mode: "auto" | "live" | "offline";
};

type OpenAIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_QUOTA_EXCEEDED"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE"
  | "AI_INCOMPLETE_RESPONSE"
  | "AI_REFUSED"
  | "AI_EMPTY_RESPONSE"
  | `AI_PROVIDER_${number}`;

export class OpenAIServiceError extends Error {
  constructor(code: OpenAIErrorCode) {
    super(code);
    this.name = "OpenAIServiceError";
  }
}

export const OPENAI_TIMEOUT_MS = 30_000;
const JSON_LIMIT = 256 * 1024;
const SSE_LIMIT = 1024 * 1024;

async function boundedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await globalThis.fetch(input, {
    ...init,
    redirect: "error",
  });
  if (!response.body) return response;
  const url = new URL(input instanceof Request ? input.url : input);
  // Voice owns the separate byte limit for the binary speech body.
  if (response.ok && url.pathname.endsWith("/audio/speech")) return response;
  const limit = response.headers
    .get("content-type")
    ?.startsWith("text/event-stream")
    ? SSE_LIMIT
    : JSON_LIMIT;
  let bytes = 0;
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > limit) {
          controller.error(new OpenAIServiceError("AI_INVALID_RESPONSE"));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
    { signal: init?.signal ?? undefined },
  );
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function openAIClient(config: AIConfig) {
  if (config.mode === "offline" || !config.apiKey)
    throw new OpenAIServiceError("AI_NOT_CONFIGURED");
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    maxRetries: 0,
    timeout: OPENAI_TIMEOUT_MS,
    logLevel: "off",
    fetch: boundedFetch,
  });
}

/** SDK errors can contain the request, credentials, and model-generated text. */
export function openAIError(error: unknown): OpenAIServiceError {
  if (error instanceof OpenAIServiceError) return error;
  if (
    error instanceof OpenAI.APIError &&
    (error.code === "insufficient_quota" ||
      error.code === "billing_hard_limit_reached")
  )
    return new OpenAIServiceError("AI_QUOTA_EXCEEDED");
  if (
    error instanceof OpenAI.APIError &&
    typeof error.status === "number" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
  )
    return new OpenAIServiceError(`AI_PROVIDER_${error.status}`);
  return new OpenAIServiceError(
    error instanceof SyntaxError ? "AI_INVALID_RESPONSE" : "AI_UNAVAILABLE",
  );
}

const MAX_RETRY_DELAY_MS = 1_500;

/** Retry an explicit rejection once; transport errors are ambiguous. */
export function openAIRetryDelay(error: unknown): number | null {
  if (
    !(error instanceof OpenAI.APIError) ||
    (error.status !== 429 && error.status !== 503) ||
    error.code === "insufficient_quota" ||
    error.code === "billing_hard_limit_reached"
  )
    return null;
  const shouldRetry = error.headers?.get("x-should-retry");
  const retryAfterMs = error.headers?.get("retry-after-ms");
  const retryAfter = error.headers?.get("retry-after");
  if (
    shouldRetry === "false" ||
    (error.status === 503 &&
      shouldRetry !== "true" &&
      !retryAfterMs &&
      !retryAfter)
  )
    return null;
  const delay = retryAfterMs
    ? Number(retryAfterMs)
    : retryAfter
      ? /^\d+(\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) * 1_000
        : Math.max(0, Date.parse(retryAfter) - Date.now())
      : 300;
  return Number.isFinite(delay) && delay >= 0 && delay <= MAX_RETRY_DELAY_MS
    ? delay
    : null;
}

type Workflow =
  "companion" | "moment" | "weekly" | "journal" | "habit" | "plan" | "text";
const workflows: Readonly<Partial<Record<string, Workflow>>> = {
  solace_chat_turn: "companion",
  solace_moment: "moment",
  solace_weekly_invitation: "weekly",
  journal_reflection: "journal",
  solace_habit_choice: "habit",
  solace_wellness_plan: "plan",
};
type Usage = {
  model: string;
  workflow: Workflow;
  calls: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
};
const usageTotals = new Map<string, Usage>();
// Standard, short-context rates in USD per million tokens. This estimate is
// unavailable for custom models or tiers. Billing records remain authoritative.
const rates: Readonly<
  Partial<Record<string, readonly [number, number, number]>>
> = {
  "gpt-6.1-terra": [1, 0.05, 5],
  "gpt-6-luna": [0.1, 0.01, 0.5],
};

function tokens(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 10_000_000
  );
}

export function recordOpenAIUsage(
  model: string,
  format: string | undefined,
  response: OpenAI.Responses.Response,
) {
  const usage = response.usage;
  const input = usage?.input_tokens;
  const output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const written = usage?.input_tokens_details?.cache_write_tokens ?? 0;
  if (
    !tokens(input) ||
    !tokens(output) ||
    !tokens(cached) ||
    cached > input ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(model)
  )
    return;

  const workflow =
    format && Object.hasOwn(workflows, format) ? workflows[format]! : "text";
  const key = `${workflow}:${model}`;
  const rate = Object.hasOwn(rates, model) ? rates[model] : undefined;
  const estimate =
    rate &&
    input <= 272_000 &&
    written === 0 &&
    (response.service_tier == null || response.service_tier === "default")
      ? ((input - cached) * rate[0] + cached * rate[1] + output * rate[2]) /
        1_000_000
      : null;
  const previous = usageTotals.get(key);
  usageTotals.set(key, {
    model,
    workflow,
    calls: (previous?.calls ?? 0) + 1,
    inputTokens: (previous?.inputTokens ?? 0) + input,
    cachedTokens: (previous?.cachedTokens ?? 0) + cached,
    outputTokens: (previous?.outputTokens ?? 0) + output,
    estimatedUsd:
      estimate === null || previous?.estimatedUsd === null
        ? null
        : (previous?.estimatedUsd ?? 0) + estimate,
  });
}

/** Process-local operator metrics. Contains no account, content, or request IDs. */
export function openAIUsageSnapshot(): readonly Usage[] {
  return [...usageTotals.values()].map((usage) => ({ ...usage }));
}
