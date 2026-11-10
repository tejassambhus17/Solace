import { resolve } from "node:path";
import type { AIConfig } from "./ai.js";
import { readGoogleOAuthConfig } from "./google-auth.js";

/** Only enable proxy trust when the number of controlled upstream hops is known. */
export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^[0-3]$/.test(value)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 3.");
  }
  return Number(value);
}

function modelId(
  environment: Record<string, string | undefined>,
  name: string,
  defaultModel: string,
) {
  const model = environment[name]?.trim() || defaultModel;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(model))
    throw new Error(`${name} must be an OpenAI model ID.`);
  return model;
}

function durationSeconds(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = environment[name]?.trim() || String(fallback);
  const seconds = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(seconds) ||
    seconds < min ||
    seconds > max
  )
    throw new Error(
      `${name} must be an integer between ${min} and ${max} seconds.`,
    );
  return seconds;
}

/** Resolve configuration before opening the database or accepting requests. */
export function readServerConfig(
  environment: Record<string, string | undefined>,
  serverRoot: string,
) {
  const portText = environment.PORT ?? "3001";
  if (!/^\d{1,5}$/.test(portText) || Number(portText) > 65535)
    throw new Error("PORT must be an integer from 0 to 65535 (normally 3001).");
  const host = (environment.HOST ?? "0.0.0.0").trim();
  if (!host) throw new Error("HOST must not be empty.");
  const mode = environment.AI_MODE ?? "auto";
  if (!["auto", "live", "offline"].includes(mode))
    throw new Error("AI_MODE must be auto, live, or offline.");
  if ((environment.AI_PROVIDER?.trim() || "openai") !== "openai")
    throw new Error("AI_PROVIDER must be openai.");
  const apiKey = environment.OPENAI_API_KEY?.trim() || undefined;
  if (mode === "live" && !apiKey)
    throw new Error(
      "AI_MODE=live requires OPENAI_API_KEY in server/.env. Keep provider credentials on the server.",
    );
  const baseUrl =
    environment.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  if (!/^https:\/\/(?:[a-z]{2,3}\.)?api\.openai\.com\/v1\/?$/.test(baseUrl))
    throw new Error("OPENAI_BASE_URL must use the official OpenAI API.");
  const ttsVoice = environment.OPENAI_TTS_VOICE?.trim() || "marin";
  if (
    !/^(?:alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer|verse|marin|cedar)$/.test(
      ttsVoice,
    )
  )
    throw new Error("OPENAI_TTS_VOICE must be a supported built-in voice.");
  const usageLog = environment.OPENAI_USAGE_LOG?.trim() || "false";
  if (usageLog !== "true" && usageLog !== "false")
    throw new Error("OPENAI_USAGE_LOG must be true or false.");
  const database = environment.DATABASE_PATH ?? "./data/solace.sqlite";
  if (!database.trim()) throw new Error("DATABASE_PATH must not be empty.");
  const realtimeEnabled = environment.OPENAI_REALTIME_ENABLED?.trim() || "true";
  if (realtimeEnabled !== "true" && realtimeEnabled !== "false")
    throw new Error("OPENAI_REALTIME_ENABLED must be true or false.");
  const realtimeVoice = environment.OPENAI_REALTIME_VOICE?.trim() || "marin";
  if (
    !/^(?:alloy|ash|ballad|coral|echo|sage|shimmer|verse|marin|cedar)$/.test(
      realtimeVoice,
    )
  )
    throw new Error(
      "OPENAI_REALTIME_VOICE must be a supported Realtime voice.",
    );
  const realtime = {
    enabled: realtimeEnabled === "true",
    model: modelId(
      environment,
      "OPENAI_REALTIME_MODEL",
      "gpt-realtime-2.1-mini",
    ),
    voice: realtimeVoice,
    limits: {
      sessionSeconds: durationSeconds(
        environment,
        "REALTIME_SESSION_SECONDS",
        300,
        15,
        900,
      ),
      dailySeconds: durationSeconds(
        environment,
        "REALTIME_DAILY_SECONDS",
        900,
        15,
        86400,
      ),
      globalDailySeconds: durationSeconds(
        environment,
        "REALTIME_GLOBAL_DAILY_SECONDS",
        3600,
        15,
        86400,
      ),
    },
  };
  const ai: AIConfig = {
    mode: mode as AIConfig["mode"],
    apiKey,
    model: modelId(environment, "OPENAI_CHAT_MODEL", "gpt-6.1-terra"),
    lightModel: modelId(environment, "OPENAI_LIGHT_MODEL", "gpt-6-luna"),
    transcriptionModel: modelId(
      environment,
      "OPENAI_TRANSCRIPTION_MODEL",
      "gpt-transcribe",
    ),
    ttsModel: modelId(environment, "OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
    ttsVoice,
    baseUrl,
  };
  return {
    port: Number(portText),
    host,
    databasePath:
      database === ":memory:" ? database : resolve(serverRoot, database),
    trustProxyHops: parseTrustProxyHops(environment.TRUST_PROXY_HOPS),
    allowedOrigins: environment.ALLOWED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    ai,
    realtime,
    logOpenAIUsage: usageLog === "true",
    googleOAuth: readGoogleOAuthConfig(environment),
  };
}
