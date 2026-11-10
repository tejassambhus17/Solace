import type OpenAI from "openai";
import { setTimeout as delay } from "node:timers/promises";
import { openAIClient, openAIError, type AIConfig } from "./openai-service.js";

export type RealtimeProviderEvent = { type: string; [key: string]: unknown };

export type RealtimeSideband = {
  send(event: RealtimeProviderEvent): boolean;
  close(): void;
};

type SidebandCallbacks = {
  onEvent(event: RealtimeProviderEvent): void;
  onClose(): void;
  onError(): void;
};

export type RealtimeProvider = {
  create(
    offer: string,
    options: { instructions: string; signal?: AbortSignal },
  ): Promise<{ answer: string; callId: string }>;
  connect(
    callId: string,
    callbacks: SidebandCallbacks,
    signal?: AbortSignal,
  ): Promise<RealtimeSideband>;
  hangup(callId: string): Promise<void>;
};

export type RealtimeProviderOptions = {
  model?: string;
  voice?: string;
  transcriptionModel?: string;
  createResponse?: boolean;
};

export class RealtimeProviderError extends Error {
  constructor(
    readonly code:
      | "REALTIME_INVALID_OFFER"
      | "REALTIME_NOT_CONFIGURED"
      | "REALTIME_RATE_LIMITED"
      | "REALTIME_UNAVAILABLE",
  ) {
    super(code);
    this.name = "RealtimeProviderError";
  }
}

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1-mini";
export const DEFAULT_REALTIME_VOICE = "marin";
export const DEFAULT_REALTIME_TRANSCRIPTION_MODEL = "gpt-transcribe";
const CREATE_TIMEOUT_MS = 12_000;
const SIDEBAND_TIMEOUT_MS = 8_000;
const HANGUP_TIMEOUT_MS = 3_000;
const SDP_LIMIT = 64 * 1024;
const EVENT_LIMIT = 256 * 1024;
const CALL_ID = /^rtc_[A-Za-z0-9_-]{1,128}$/;
const EVENT_TYPE = /^[a-z][a-z0-9_.]{0,100}$/;

function audioOnlySdp(sdp: unknown): sdp is string {
  if (
    typeof sdp !== "string" ||
    Buffer.byteLength(sdp) > SDP_LIMIT ||
    !/^v=0(?:\r\n|\n)/.test(sdp) ||
    sdp.includes("\0")
  )
    return false;
  const sections = sdp
    .split(/\r\n|\n|\r/)
    .filter((line) => /^\s*m=/i.test(line));
  // Without an SCTP media section, only the trusted sideband can issue Realtime
  // commands. The device negotiates one audio stream and cannot create responses.
  return (
    sections.length === 1 &&
    /^m=audio \d+(?:\/\d+)? (?:UDP\/TLS\/|TCP\/TLS\/)?RTP\/SAVPF(?: \d+)+$/.test(
      sections[0],
    )
  );
}

function callIdFromLocation(location: string | null, base: URL) {
  if (!location) return undefined;
  try {
    const url = new URL(location, base.origin);
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    const match = /^\/v1\/realtime\/calls\/([^/]+)$/.exec(url.pathname);
    return match && CALL_ID.test(match[1]) ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function signalWithin(timeoutMs: number, parent?: AbortSignal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([timeout, parent]) : timeout;
}

function openSideband(
  url: URL,
  apiKey: string,
  callbacks: SidebandCallbacks,
  signal: AbortSignal,
) {
  return new Promise<RealtimeSideband>((resolve, reject) => {
    if (signal.aborted) {
      reject(new RealtimeProviderError("REALTIME_UNAVAILABLE"));
      return;
    }
    let socket: WebSocket;
    try {
      // Node supports Undici's WebSocketInit. The DOM overload in this project
      // does not expose header options. Send credentials only as a header.
      const NodeWebSocket = globalThis.WebSocket as unknown as {
        new (url: URL, options: { headers: Record<string, string> }): WebSocket;
      };
      socket = new NodeWebSocket(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      reject(new RealtimeProviderError("REALTIME_UNAVAILABLE"));
      return;
    }

    let connected = false;
    let ended = false;
    function finish(reason: "manual" | "close" | "error") {
      if (ended) return;
      ended = true;
      signal.removeEventListener("abort", onAbort);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("message", onMessage);
      try {
        socket.close();
      } catch {
        // The socket may already be closed.
      }
      if (!connected) reject(new RealtimeProviderError("REALTIME_UNAVAILABLE"));
      else if (reason === "close") callbacks.onClose();
      else if (reason === "error") callbacks.onError();
    }
    function onAbort() {
      finish("manual");
    }
    function onClose() {
      finish("close");
    }
    function onError() {
      finish("error");
    }
    function onMessage({ data }: MessageEvent<unknown>) {
      try {
        if (typeof data !== "string" || Buffer.byteLength(data) > EVENT_LIMIT)
          throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
        const event: RealtimeProviderEvent = JSON.parse(data);
        if (
          !event ||
          typeof event !== "object" ||
          !Object.hasOwn(event, "type") ||
          typeof event.type !== "string" ||
          !EVENT_TYPE.test(event.type)
        )
          throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
        // Audio stays on WebRTC. Only control events and transcripts go to the
        // server's conversation handler.
        if (event.type !== "response.output_audio.delta")
          callbacks.onEvent(event);
      } catch {
        finish("error");
      }
    }
    function onOpen() {
      if (signal.aborted) {
        finish("manual");
        return;
      }
      connected = true;
      signal.removeEventListener("abort", onAbort);
      resolve({
        send(event) {
          if (ended || socket.readyState !== WebSocket.OPEN) return false;
          try {
            const data = JSON.stringify(event);
            if (socket.bufferedAmount + Buffer.byteLength(data) > EVENT_LIMIT)
              return false;
            socket.send(data);
            return true;
          } catch {
            return false;
          }
        },
        close: () => finish("manual"),
      });
    }
    socket.addEventListener("open", onOpen, { once: true });
    socket.addEventListener("error", onError, { once: true });
    socket.addEventListener("close", onClose, { once: true });
    socket.addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

export function createOpenAIRealtimeProvider(
  config: AIConfig,
  options: RealtimeProviderOptions = {},
): RealtimeProvider {
  const apiKey = config.apiKey;
  if (
    !apiKey ||
    config.mode === "offline" ||
    !/^https:\/\/(?:[a-z]{2,3}\.)?api\.openai\.com\/v1\/?$/.test(config.baseUrl)
  )
    throw new RealtimeProviderError("REALTIME_NOT_CONFIGURED");
  const base = new URL(config.baseUrl);
  const client = openAIClient(config);
  const model = options.model ?? DEFAULT_REALTIME_MODEL;
  const voice = options.voice ?? DEFAULT_REALTIME_VOICE;
  const transcriptionModel =
    options.transcriptionModel ?? DEFAULT_REALTIME_TRANSCRIPTION_MODEL;

  async function hangup(callId: string) {
    if (!CALL_ID.test(callId))
      throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
    try {
      await client.realtime.calls.hangup(callId, {
        signal: signalWithin(HANGUP_TIMEOUT_MS),
      });
    } catch (error) {
      const safe = openAIError(error).message;
      if (safe !== "AI_PROVIDER_404" && safe !== "AI_PROVIDER_410")
        throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
    }
  }

  return {
    async create(offer, { instructions, signal }) {
      if (!audioOnlySdp(offer))
        throw new RealtimeProviderError("REALTIME_INVALID_OFFER");
      const requestSignal = signalWithin(CREATE_TIMEOUT_MS, signal);
      const session: OpenAI.Realtime.RealtimeSessionCreateRequest = {
        type: "realtime",
        model,
        instructions,
        output_modalities: ["audio"],
        max_output_tokens: 512,
        tracing: null,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: { model: transcriptionModel },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "auto",
              create_response: options.createResponse ?? false,
              interrupt_response: true,
            },
          },
          output: { voice },
        },
      };
      let callId: string | undefined;
      try {
        const response = await client.realtime.calls.create(
          { sdp: offer, session },
          { signal: requestSignal },
        );
        callId = callIdFromLocation(response.headers.get("location"), base);
        if (!callId) {
          void response.body?.cancel().catch(() => undefined);
          throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
        }
        const answer = await response.text();
        if (requestSignal.aborted || !audioOnlySdp(answer))
          throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
        return { answer, callId };
      } catch (error) {
        if (callId) await hangup(callId).catch(() => undefined);
        throw new RealtimeProviderError(
          openAIError(error).message === "AI_PROVIDER_429"
            ? "REALTIME_RATE_LIMITED"
            : "REALTIME_UNAVAILABLE",
        );
      }
    },
    async connect(callId, callbacks, signal) {
      if (!CALL_ID.test(callId))
        throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
      const url = new URL("/v1/realtime", base);
      url.protocol = "wss:";
      url.searchParams.set("call_id", callId);
      const deadline = signalWithin(SIDEBAND_TIMEOUT_MS, signal);
      try {
        return await openSideband(url, apiKey, callbacks, deadline);
      } catch (error) {
        if (deadline.aborted) throw error;
        // An early transport failure can be retried on the same call without
        // negotiating a second provider session or extending setup's deadline.
        try {
          await delay(250, undefined, { signal: deadline });
        } catch {
          throw new RealtimeProviderError("REALTIME_UNAVAILABLE");
        }
        return openSideband(url, apiKey, callbacks, deadline);
      }
    },
    hangup,
  };
}
