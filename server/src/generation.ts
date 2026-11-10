import { setTimeout as wait } from "node:timers/promises";
import type OpenAI from "openai";
import {
  OPENAI_TIMEOUT_MS,
  OpenAIServiceError,
  openAIClient,
  openAIError,
  openAIRetryDelay,
  recordOpenAIUsage,
  type AIConfig,
} from "./openai-service.js";

export type { AIConfig } from "./openai-service.js";

export function provider(config: AIConfig): "live" | "offline" {
  return config.mode !== "offline" && config.apiKey ? "live" : "offline";
}

type GenerationControls = {
  signal?: AbortSignal;
  /** Re-check that the authorization and the selected context are still current. */
  canRetry?: () => boolean;
};

type Generation = GenerationControls & {
  instructions: string;
  input: string | { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  format?: { name: string; schema: Record<string, unknown> };
  stream?: boolean;
  tool?: OpenAI.Responses.FunctionTool;
};

function validateResponse(response: OpenAI.Responses.Response) {
  if (!response || typeof response !== "object")
    throw new OpenAIServiceError("AI_INVALID_RESPONSE");
  if (response.incomplete_details?.reason === "content_filter")
    throw new OpenAIServiceError("AI_REFUSED");
  if (response.status !== "completed")
    throw new OpenAIServiceError("AI_INCOMPLETE_RESPONSE");
  if (!Array.isArray(response.output) || response.error)
    throw new OpenAIServiceError("AI_INVALID_RESPONSE");
}

function readText(response: OpenAI.Responses.Response) {
  validateResponse(response);
  const parts: string[] = [];
  for (const output of response.output) {
    if (output?.type !== "message") continue;
    if (output.role !== "assistant" || !Array.isArray(output.content))
      throw new OpenAIServiceError("AI_INVALID_RESPONSE");
    if (output.status !== "completed")
      throw new OpenAIServiceError("AI_INCOMPLETE_RESPONSE");
    for (const content of output.content) {
      if (content?.type === "refusal")
        throw new OpenAIServiceError("AI_REFUSED");
      if (content?.type !== "output_text" || typeof content.text !== "string")
        throw new OpenAIServiceError("AI_INVALID_RESPONSE");
      parts.push(content.text);
    }
  }
  const text = parts.join("");
  if (!text.trim()) throw new OpenAIServiceError("AI_EMPTY_RESPONSE");
  if (text.length > 20_000) throw new OpenAIServiceError("AI_INVALID_RESPONSE");
  return text;
}

async function collectStream(
  client: OpenAI,
  params: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  signal: AbortSignal,
) {
  const stream = await client.responses.create(
    { ...params, stream: true },
    { signal },
  );
  let refused = false;
  for await (const event of stream) {
    if (
      event.type === "response.refusal.delta" ||
      event.type === "response.refusal.done"
    )
      refused = true;
    if (
      event.type === "response.completed" ||
      event.type === "response.incomplete" ||
      event.type === "response.failed"
    ) {
      // All deltas stay server-side. The caller validates the single final answer
      // before storing or returning anything to the authenticated client.
      return { response: event.response, refused };
    }
    if (event.type === "error") throw new OpenAIServiceError("AI_UNAVAILABLE");
  }
  throw new OpenAIServiceError("AI_INCOMPLETE_RESPONSE");
}

async function generateResponse(config: AIConfig, generation: Generation) {
  const client = openAIClient(config);
  const timeout = AbortSignal.timeout(OPENAI_TIMEOUT_MS);
  const signal = generation.signal
    ? AbortSignal.any([generation.signal, timeout])
    : timeout;
  const { instructions, input, maxTokens, format, stream, tool } = generation;
  const lowLatencyModel =
    /^gpt-(?:6\.1-terra|6-luna)(?:$|-\d{4}-\d{2}-\d{2}$)/.test(config.model);
  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: config.model,
    store: false,
    max_output_tokens: maxTokens,
    instructions,
    input,
    ...(lowLatencyModel && {
      reasoning: { effort: "none" },
      // Disable the implicit cache breakpoint. The request contains private
      // account context and intentionally does not add an explicit breakpoint.
      prompt_cache_options: { mode: "explicit" },
    }),
    ...(format && {
      text: { format: { type: "json_schema", strict: true, ...format } },
    }),
    ...(tool && {
      tools: [tool],
      tool_choice: "auto",
      parallel_tool_calls: false,
    }),
  };
  try {
    if (signal.aborted) throw new OpenAIServiceError("AI_UNAVAILABLE");
    if (stream) {
      const { response, refused } = await collectStream(client, params, signal);
      if (signal.aborted) throw new OpenAIServiceError("AI_UNAVAILABLE");
      if (!response) throw new OpenAIServiceError("AI_INVALID_RESPONSE");
      recordOpenAIUsage(config.model, format?.name, response);
      if (refused) throw new OpenAIServiceError("AI_REFUSED");
      return response;
    }
    let response: OpenAI.Responses.Response;
    try {
      response = await client.responses.create(params, { signal });
    } catch (error) {
      const delay = openAIRetryDelay(error);
      if (delay === null || signal.aborted || generation.canRetry?.() === false)
        throw error;
      await wait(delay, undefined, { signal });
      if (generation.canRetry?.() === false) throw error;
      response = await client.responses.create(params, { signal });
    }
    if (signal.aborted) throw new OpenAIServiceError("AI_UNAVAILABLE");
    if (!response) throw new OpenAIServiceError("AI_INVALID_RESPONSE");
    recordOpenAIUsage(config.model, format?.name, response);
    return response;
  } catch (error) {
    if (signal.aborted) throw new OpenAIServiceError("AI_UNAVAILABLE");
    throw openAIError(error);
  }
}

export async function generateText(config: AIConfig, generation: Generation) {
  return readText(await generateResponse(config, generation));
}

export async function generateToolTurn(
  config: AIConfig,
  generation: Generation & { tool: OpenAI.Responses.FunctionTool },
) {
  const response = await generateResponse(config, generation);
  validateResponse(response);
  const calls = response.output.filter((item) => item.type === "function_call");
  if (!calls.length) return { text: readText(response) };
  const [call] = calls;
  if (
    calls.length !== 1 ||
    call.name !== generation.tool.name ||
    (call.status !== undefined && call.status !== "completed") ||
    typeof call.call_id !== "string" ||
    !call.call_id ||
    typeof call.arguments !== "string" ||
    call.arguments.length > 2_000 ||
    response.output.some(
      (item) =>
        item.type === "message" &&
        item.content.some((part) => part.type === "refusal"),
    )
  )
    throw new OpenAIServiceError("AI_INVALID_RESPONSE");
  try {
    return { arguments: JSON.parse(call.arguments) as unknown };
  } catch {
    throw new OpenAIServiceError("AI_INVALID_RESPONSE");
  }
}

export async function structuredOutput(
  config: AIConfig,
  name: string,
  schema: Record<string, unknown>,
  instructions: string,
  input: unknown,
  options?: GenerationControls & { maxTokens?: number },
) {
  const text = await generateText(
    config.lightModel ? { ...config, model: config.lightModel } : config,
    {
      ...options,
      instructions,
      input: JSON.stringify(input),
      maxTokens: options?.maxTokens ?? 1800,
      format: { name, schema },
    },
  );
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OpenAIServiceError("AI_INVALID_RESPONSE");
  }
}
