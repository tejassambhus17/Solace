import { isRecordId } from "./routes";
import {
  readAppAction,
  type AppAction,
} from "../server/src/companion-app-action";

export type VoiceSessionState = {
  id: string;
  phase:
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "support"
    | "disconnected";
  revision: number;
  userSpeaking: boolean;
  expiresAt: number;
  reason?: string;
  support?: string;
  conversationId?: string;
  appAction?: AppAction;
  pendingActionId?: string;
};

export type VoiceActionResult = { ok: boolean; message: string };

export type VoiceConnection = {
  id: string;
  answer: string;
  state: VoiceSessionState;
  mediaReadySignal?: true;
};

const phases = new Set([
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "support",
  "disconnected",
]);

export function readVoiceSessionState(
  value: unknown,
  id: string,
  minimumRevision = 0,
): VoiceSessionState {
  const state = value as Partial<VoiceSessionState> | undefined;
  if (
    !state ||
    state.id !== id ||
    typeof state.revision !== "number" ||
    !Number.isSafeInteger(state.revision) ||
    state.revision < minimumRevision ||
    !state.phase ||
    !phases.has(state.phase) ||
    typeof state.userSpeaking !== "boolean" ||
    !Number.isFinite(state.expiresAt) ||
    (state.conversationId !== undefined && !isRecordId(state.conversationId)) ||
    (state.pendingActionId !== undefined &&
      !isRecordId(state.pendingActionId)) ||
    (state.reason !== undefined && typeof state.reason !== "string") ||
    (state.support !== undefined && typeof state.support !== "string")
  )
    throw new Error("Solace returned an unexpected voice response.");
  if (state.appAction === undefined) return state as VoiceSessionState;
  return {
    ...(state as VoiceSessionState),
    appAction: readAppAction(state.appAction),
  };
}

export async function readVoiceStatus(
  read: () => Promise<VoiceSessionState>,
  signal: AbortSignal,
) {
  try {
    return await read();
  } catch (cause) {
    const error = cause as { connection?: boolean; status?: number } | null;
    if (
      signal.aborted ||
      (!error?.connection && ![408, 502, 503, 504].includes(error?.status ?? 0))
    )
      throw cause;

    // The server owns the lease deadline. Give a brief transport interruption
    // one chance to clear without opening a second session.
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, 600);
      signal.addEventListener("abort", done, { once: true });
    });
    if (signal.aborted) throw cause;
    return read();
  }
}

export function realtimeShouldEndOnAppState(
  state: string,
  requestingPermission: boolean,
) {
  // System permission can pause the host activity before capture starts.
  return (
    !requestingPermission && (state === "background" || state === "inactive")
  );
}

export function voiceEndedMessage(reason?: string) {
  switch (reason) {
    case "expired":
      return "This voice session reached its time limit.";
    case "authorization_changed":
      return "Your account or conversation changed. Open chat to continue.";
    case "ended":
      return "Your voice session ended.";
    default:
      return "Voice was disconnected. Try again or continue in chat.";
  }
}
