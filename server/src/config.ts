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
  const apiKey = environment.OPENAI_API_KEY?.trim() || undefined;
  const geminiKey = environment.GEMINI_API_KEY?.trim() || undefined;
  const geminiModel =
    environment.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
  if (geminiKey && !/^gemini-[a-z0-9][a-z0-9.-]{0,78}$/.test(geminiModel))
    throw new Error("GEMINI_MODEL must be a Gemini model ID.");
  const fallback = environment.OPENAI_FALLBACK_ENABLED?.trim() || "false";
  if (fallback !== "true" && fallback !== "false")
    throw new Error("OPENAI_FALLBACK_ENABLED must be true or false.");
  if (mode === "live" && !apiKey && !geminiKey)
    throw new Error(
      "AI_MODE=live requires GEMINI_API_KEY or OPENAI_API_KEY in server/.env. Keep provider credentials on the server.",
    );
  const database = environment.DATABASE_PATH ?? "./data/solace.sqlite";
  if (!database.trim()) throw new Error("DATABASE_PATH must not be empty.");
  const ai: AIConfig = {
    mode: mode as AIConfig["mode"],
    gemini: geminiKey ? { apiKey: geminiKey, model: geminiModel } : undefined,
    openAIFallback: fallback === "true",
    apiKey,
    model: environment.OPENAI_MODEL ?? "gpt-4.1-mini",
    transcriptionModel:
      environment.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-transcribe",
    baseUrl: environment.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
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
    googleOAuth: readGoogleOAuthConfig(environment),
  };
}
