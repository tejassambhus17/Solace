import { toFile } from "openai";
import type { AIConfig } from "./generation.js";
import { openAIClient, openAIError } from "./openai-service.js";

export const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const SPEECH_MAX_BYTES = 2 * 1024 * 1024;
const SPEECH_MAX_CHARS = 4000;

export const audioTypes: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

export function voiceAvailable(config: AIConfig) {
  return config.mode !== "offline" && !!config.apiKey;
}

function voiceSignal(cancellation?: AbortSignal) {
  const timeout = AbortSignal.timeout(30000);
  return cancellation ? AbortSignal.any([cancellation, timeout]) : timeout;
}

function voiceProviderError(error: unknown) {
  const safe = openAIError(error);
  if (safe.message === "AI_QUOTA_EXCEEDED")
    return new Error("VOICE_QUOTA_EXCEEDED");
  return new Error(
    safe.message === "AI_PROVIDER_429"
      ? "VOICE_RATE_LIMITED"
      : "VOICE_UNAVAILABLE",
  );
}

/** Audio remains in this request's memory only. Nothing is saved to disk or records. */
export async function transcribeAudio(
  config: AIConfig,
  bytes: Buffer,
  mimeType: string,
  cancellation?: AbortSignal,
) {
  if (!voiceAvailable(config)) throw new Error("VOICE_NOT_CONFIGURED");
  const type = mimeType.split(";")[0].trim().toLowerCase();
  if (!audioTypes[type] || bytes.length < 32 || bytes.length > AUDIO_MAX_BYTES)
    throw new Error("VOICE_INVALID_AUDIO");
  const signal = voiceSignal(cancellation);
  let text: unknown;
  try {
    const file = await toFile(
      Uint8Array.from(bytes),
      `solace-voice.${audioTypes[type]}`,
      { type },
    );
    signal.throwIfAborted();
    const transcript = await openAIClient(config).audio.transcriptions.create(
      {
        file,
        model: config.transcriptionModel || "gpt-transcribe",
        response_format: "json",
      },
      { signal },
    );
    text = transcript?.text;
  } catch (error) {
    throw voiceProviderError(error);
  }
  if (typeof text !== "string" || !text.trim() || text.length > 4000)
    throw new Error("VOICE_INVALID_RESPONSE");
  return { text: text.trim(), provider: "live" as const };
}

/** Accepts only a reply resolved from the user's saved conversation by the API. */
export async function synthesizeReply(
  config: AIConfig,
  reply: string,
  cancellation?: AbortSignal,
) {
  if (!voiceAvailable(config)) throw new Error("VOICE_NOT_CONFIGURED");
  if (!reply.trim() || reply.length > SPEECH_MAX_CHARS)
    throw new Error("VOICE_INVALID_RESPONSE");
  const signal = voiceSignal(cancellation);
  let response: Response;
  try {
    response = await openAIClient(config).audio.speech.create(
      {
        model: config.ttsModel || "gpt-4o-mini-tts",
        voice: config.ttsVoice || "marin",
        input: reply,
        response_format: "mp3",
      },
      { signal },
    );
  } catch (error) {
    throw voiceProviderError(error);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const reader = response.body?.getReader();
  if (
    !reader ||
    (contentType !== "audio/mpeg" && contentType !== "audio/mp3") ||
    Number(response.headers.get("content-length")) > SPEECH_MAX_BYTES
  ) {
    void reader?.cancel().catch(() => {});
    throw new Error("VOICE_INVALID_RESPONSE");
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > SPEECH_MAX_BYTES) throw new Error("VOICE_INVALID_RESPONSE");
      parts.push(value);
    }
  } catch {
    throw new Error("VOICE_INVALID_RESPONSE");
  } finally {
    void reader.cancel().catch(() => {});
  }
  if (!size) throw new Error("VOICE_INVALID_RESPONSE");
  return Buffer.concat(parts, size);
}
