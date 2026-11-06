import { readGeminiText, readProviderText } from "./provider-response.js";

export type AIConfig = {
  // OpenAI settings also serve the existing transcription endpoint.
  apiKey?: string;
  model: string;
  transcriptionModel?: string;
  baseUrl: string;
  mode: "auto" | "live" | "offline";
  gemini?: { apiKey: string; model: string };
  openAIFallback?: boolean;
};

export function provider(config: AIConfig): "live" | "offline" {
  return config.mode !== "offline" && (config.gemini?.apiKey || config.apiKey)
    ? "live"
    : "offline";
}

type GenerationControls = {
  signal?: AbortSignal;
  canFallback?: () => boolean;
};

type Generation = GenerationControls & {
  instructions: string;
  input: string | { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  format?: { name: string; schema: Record<string, unknown> };
};

async function request(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  readText: typeof readProviderText,
) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal,
      redirect: "error",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("AI_UNAVAILABLE");
  }
  try {
    return await readText(response);
  } catch (error) {
    if (
      signal.aborted &&
      error instanceof Error &&
      error.message === "AI_INVALID_RESPONSE"
    )
      throw new Error("AI_UNAVAILABLE");
    throw error;
  }
}

function generateWithGemini(
  gemini: NonNullable<AIConfig["gemini"]>,
  generation: Generation,
  signal: AbortSignal,
) {
  const { instructions, input, maxTokens, format } = generation;
  const turns =
    typeof input === "string" ? [{ role: "user", content: input }] : input;
  // A bounded or reset conversation can start in the middle of an exchange.
  // Gemini chat history starts with a user turn.
  const contents = turns
    .slice(turns.findIndex((turn) => turn.role === "user"))
    .map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    }));
  return request(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gemini.model)}:generateContent`,
    { "x-goog-api-key": gemini.apiKey },
    {
      store: false,
      systemInstruction: { parts: [{ text: instructions }] },
      contents,
      safetySettings: [
        "HARASSMENT",
        "HATE_SPEECH",
        "SEXUALLY_EXPLICIT",
        "DANGEROUS_CONTENT",
      ].map((category) => ({
        category: `HARM_CATEGORY_${category}`,
        threshold: "BLOCK_ONLY_HIGH",
      })),
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(format && {
          responseMimeType: "application/json",
          responseJsonSchema: format.schema,
        }),
      },
    },
    signal,
    readGeminiText,
  );
}

export async function generateText(config: AIConfig, generation: Generation) {
  if (provider(config) !== "live") throw new Error("AI_NOT_CONFIGURED");
  const timeout = AbortSignal.timeout(30000);
  const signal = generation.signal
    ? AbortSignal.any([generation.signal, timeout])
    : timeout;
  signal.throwIfAborted();

  if (config.gemini) {
    const canFailOver = config.openAIFallback && config.apiKey;
    const primarySignal = canFailOver
      ? AbortSignal.any([signal, AbortSignal.timeout(18000)])
      : signal;
    try {
      return await generateWithGemini(config.gemini, generation, primarySignal);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Refusals and invalid responses never trigger a second disclosure.
      if (
        !canFailOver ||
        signal.aborted ||
        !/^(?:AI_UNAVAILABLE|AI_PROVIDER_(?:408|429|5\d\d))$/.test(message) ||
        generation.canFallback?.() === false
      )
        throw error;
    }
  }

  const { instructions, input, maxTokens, format } = generation;
  return request(
    `${config.baseUrl.replace(/\/$/, "")}/responses`,
    { Authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      store: false,
      max_output_tokens: maxTokens,
      instructions,
      input,
      ...(format && {
        text: { format: { type: "json_schema", strict: true, ...format } },
      }),
    },
    signal,
    readProviderText,
  );
}

export async function structuredOutput(
  config: AIConfig,
  name: string,
  schema: Record<string, unknown>,
  instructions: string,
  input: unknown,
  options?: GenerationControls & { maxTokens?: number },
) {
  const text = await generateText(config, {
    ...options,
    instructions,
    input: JSON.stringify(input),
    maxTokens: options?.maxTokens ?? 1800,
    format: { name, schema },
  });
  if (!text || text.length > 20000) throw new Error("AI_INVALID_RESPONSE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("AI_INVALID_RESPONSE");
  }
}
