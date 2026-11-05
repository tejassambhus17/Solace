import { type AIConfig, provider } from "./ai.js";
import { readProviderJson } from "./provider-response.js";

export const AUDIO_MAX_BYTES = 8 * 1024 * 1024;
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
  return provider(config) === "live" && !!config.apiKey;
}
/** Audio remains in this request's memory only. Nothing is saved to disk or records. */
export async function transcribeAudio(
  config: AIConfig,
  bytes: Buffer,
  mimeType: string,
) {
  if (!voiceAvailable(config)) throw new Error("VOICE_NOT_CONFIGURED");
  const type = mimeType.split(";")[0].trim().toLowerCase();
  if (!audioTypes[type] || bytes.length < 32 || bytes.length > AUDIO_MAX_BYTES)
    throw new Error("VOICE_INVALID_AUDIO");
  const body = new FormData();
  // Copy into an ordinary ArrayBuffer for Node's Blob implementation.
  body.append(
    "file",
    new Blob([Uint8Array.from(bytes)], { type }),
    `solace-voice.${audioTypes[type]}`,
  );
  body.append("model", config.transcriptionModel || "gpt-transcribe");
  let response: Response;
  try {
    response = await fetch(
      `${config.baseUrl.replace(/\/$/, "")}/audio/transcriptions`,
      {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body,
      },
    );
  } catch {
    throw new Error("VOICE_UNAVAILABLE");
  }
  let result: Awaited<ReturnType<typeof readProviderJson>>;
  try {
    result = await readProviderJson(response);
  } catch {
    throw new Error("VOICE_INVALID_RESPONSE");
  }
  if (
    typeof result?.text !== "string" ||
    !result.text.trim() ||
    result.text.length > 4000
  )
    throw new Error("VOICE_INVALID_RESPONSE");
  return { text: result.text.trim(), provider: "live" as const };
}
