import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { createRealtimePeer, realtimePeerAvailable } from "./realtime-rtc";
import { markVoiceTiming } from "./realtime-timing";
import {
  readVoiceSessionState,
  readVoiceStatus,
  realtimeShouldEndOnAppState,
  voiceEndedMessage,
  type VoiceSessionState,
} from "./realtime-voice-state";
import { isRecordId } from "./routes";
import type { useApp } from "./store";

type Peer = Awaited<ReturnType<typeof createRealtimePeer>>;
type Transport =
  "idle" | "connecting" | "ready" | "reconnecting" | "failed" | "disconnected";
type Api = Pick<
  ReturnType<typeof useApp>,
  "startVoiceSession" | "voiceSessionStatus" | "endVoiceSession" | "refresh"
>;
type Attempt = {
  controller: AbortController;
  api: Api;
  peer?: Peer;
  id?: string;
  conversationId?: string;
  muted: boolean;
  requestingPermission: boolean;
  connectedAt?: number;
  mediaReady: boolean;
  serverReady: boolean;
  releaseMediaWait?: () => void;
  listeningObserved?: boolean;
  outputObserved?: boolean;
  speakerChanging?: boolean;
  timeout?: ReturnType<typeof setTimeout>;
};

function failureMessage(error: unknown) {
  const detail = error as { code?: string; name?: string; message?: string };
  if (
    detail?.name === "NotAllowedError" ||
    detail?.name === "PermissionDeniedError" ||
    detail?.code === "MICROPHONE_DENIED" ||
    /permission|denied|microphone access/i.test(detail?.message || "")
  )
    return "Allow microphone access in device settings, or continue in chat.";
  if (detail?.code?.startsWith("REALTIME_") && detail.message)
    return detail.message;
  if (detail?.code === "CONVERSATION_LIMIT" || detail?.code === "CHAT_BUSY")
    return detail.message || "Open chat to continue.";
  return "Live voice couldn’t connect. Try again or continue in chat.";
}

export function useRealtimeVoice(api: Api, initialConversation?: string) {
  const latestApi = useRef(api);
  latestApi.current = api;
  const attempt = useRef<Attempt | null>(null);
  const negotiating = useRef<Attempt | null>(null);
  const stopping = useRef<Promise<string | undefined> | null>(null);
  const conversation = useRef(initialConversation);
  const [transport, setTransport] = useState<Transport>("idle");
  const [state, setState] = useState<VoiceSessionState>();
  const [mediaAcknowledged, setMediaAcknowledged] = useState(false);
  const [error, setError] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [ending, setEnding] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number>();
  const [speakerphone, setSpeakerphone] = useState<boolean>();
  const [speakerBusy, setSpeakerBusy] = useState(false);
  const [speakerError, setSpeakerError] = useState<string>();
  const mounted = useRef(true);
  const functions = useRef({ finish });
  functions.current.finish = finish;

  function finish(
    message?: string,
    preserveStatus = false,
    terminal: "failed" | "disconnected" = "failed",
  ) {
    const active = attempt.current;
    if (!active)
      return stopping.current ?? Promise.resolve(conversation.current);
    attempt.current = null;
    clearTimeout(active.timeout);
    active.peer?.close();
    active.controller.abort();
    active.releaseMediaWait?.();
    if (mounted.current) {
      setTransport(message ? terminal : "idle");
      setMuted(false);
      setMediaAcknowledged(false);
      setConnectedAt(undefined);
      setSpeakerphone(undefined);
      setSpeakerBusy(false);
      setSpeakerError(undefined);
      if (!preserveStatus) setState(undefined);
      if (message) setError(message);
    }
    const id = active.id;
    if (!id) {
      if (mounted.current && negotiating.current === active) setEnding(true);
      return Promise.resolve(conversation.current);
    }
    if (mounted.current) setEnding(true);
    const stop = (async () => {
      try {
        const ended = readVoiceSessionState(
          await active.api.endVoiceSession(id),
          id,
        );
        if (ended.conversationId) conversation.current = ended.conversationId;
      } catch {
        // The server also expires the lease when heartbeats stop.
      }
      void active.api.refresh().catch(() => {});
      return conversation.current;
    })();
    stopping.current = stop;
    void stop.then(() => {
      stopping.current = null;
      if (mounted.current) setEnding(false);
    });
    return stop;
  }

  function updateReadiness(active: Attempt) {
    if (!active.mediaReady || !active.serverReady) return;
    clearTimeout(active.timeout);
    if (active.connectedAt === undefined) {
      markVoiceTiming("ready");
      active.connectedAt = Date.now();
      setConnectedAt(active.connectedAt);
      if (active.peer?.setSpeakerphone) setSpeakerphone(true);
    }
    setTransport("ready");
  }

  function observe(active: Attempt, next: VoiceSessionState) {
    if (attempt.current !== active) return false;
    if (next.conversationId) conversation.current = next.conversationId;
    setState((previous) =>
      previous?.id === next.id && previous.revision === next.revision
        ? previous
        : next,
    );
    if (next.phase === "support") {
      void finish(undefined, true);
      return false;
    }
    if (next.phase === "disconnected") {
      void finish(voiceEndedMessage(next.reason), false, "disconnected");
      return false;
    }
    active.serverReady = next.phase !== "connecting";
    updateReadiness(active);
    return true;
  }

  async function start() {
    if (attempt.current || negotiating.current || stopping.current) return;
    setError(undefined);
    setState(undefined);
    setMediaAcknowledged(false);
    if (!realtimePeerAvailable()) {
      setTransport("failed");
      setError(
        "Live voice needs a supported browser or the native Solace app.",
      );
      return;
    }
    const active: Attempt = {
      api: latestApi.current,
      controller: new AbortController(),
      conversationId: conversation.current,
      muted: false,
      requestingPermission: false,
      mediaReady: false,
      serverReady: false,
    };
    attempt.current = active;
    setTransport("connecting");
    setMuted(false);
    markVoiceTiming("attempt");
    const { signal } = active.controller;
    const fail = (message: string, terminal?: "disconnected") => {
      if (attempt.current === active) void finish(message, false, terminal);
    };
    const waitForMedia = new Promise<void>((resolve) => {
      active.releaseMediaWait = resolve;
    });
    const armStartupTimeout = () => {
      active.timeout = setTimeout(
        () =>
          fail(
            "Voice took too long to connect. Try again or continue in chat.",
          ),
        24000,
      );
    };
    armStartupTimeout();
    try {
      active.peer = await createRealtimePeer({
        signal,
        onStage: markVoiceTiming,
        onPermissionPrompt(pending) {
          active.requestingPermission = pending;
          clearTimeout(active.timeout);
          if (!pending && !signal.aborted) armStartupTimeout();
        },
        onState(next) {
          if (attempt.current !== active) return;
          if (next === "connected") {
            active.mediaReady = true;
            if (!active.connectedAt) markVoiceTiming("media-ready");
            active.releaseMediaWait?.();
            updateReadiness(active);
          } else if (next === "disconnected") {
            active.mediaReady = false;
            if (active.connectedAt === undefined) return;
            clearTimeout(active.timeout);
            setTransport("reconnecting");
            active.timeout = setTimeout(
              () =>
                fail(
                  "The voice connection was lost. Try again or continue in chat.",
                  "disconnected",
                ),
              5000,
            );
          } else if (next === "failed") {
            fail(
              "The voice connection was lost. Try again or continue in chat.",
              "disconnected",
            );
          }
        },
      });
      markVoiceTiming("offer");
      if (signal.aborted) {
        active.peer.close();
        return;
      }
      negotiating.current = active;
      let connection: Awaited<ReturnType<Api["startVoiceSession"]>>;
      try {
        connection = await active.api.startVoiceSession(
          active.peer.offer,
          active.conversationId,
          signal,
        );
        if (!isRecordId(connection?.id))
          throw new Error("Solace returned an unexpected voice response.");
        active.id = connection.id;
        if (signal.aborted) {
          try {
            const initialState = readVoiceSessionState(
              connection.state,
              connection.id,
            );
            conversation.current =
              initialState.conversationId ?? conversation.current;
          } catch {
            // A known session ID can still be ended if its state was malformed.
          }
          try {
            const ended = readVoiceSessionState(
              await active.api.endVoiceSession(connection.id),
              connection.id,
            );
            conversation.current = ended.conversationId ?? conversation.current;
          } catch {
            // Without a confirmed End result, preserve the last valid route.
          }
          void active.api.refresh().catch(() => {});
          return;
        }
      } finally {
        negotiating.current = null;
        if (mounted.current && !stopping.current) setEnding(false);
      }
      markVoiceTiming("answer");
      const initialState = readVoiceSessionState(
        connection.state,
        connection.id,
      );
      if (!observe(active, initialState)) return;
      await active.peer.acceptAnswer(connection.answer);
      markVoiceTiming("remote-description");
      await waitForMedia;
      if (signal.aborted) return;
      let revision = initialState.revision;
      let firstStatus = connection.mediaReadySignal === true;
      if (!firstStatus) setMediaAcknowledged(true);
      while (!signal.aborted) {
        const sendReadiness = firstStatus && active.mediaReady;
        const next = await readVoiceStatus(
          () =>
            active.api.voiceSessionStatus(
              connection.id,
              sendReadiness ? undefined : revision,
              signal,
              sendReadiness && active.mediaReady ? true : undefined,
            ),
          signal,
        );
        const state = readVoiceSessionState(next, connection.id, revision);
        if (!observe(active, state)) return;
        if (sendReadiness && active.mediaReady) {
          firstStatus = false;
          setMediaAcknowledged(true);
        }
        if (
          active.mediaReady &&
          state.phase === "listening" &&
          !active.listeningObserved
        ) {
          active.listeningObserved = true;
          markVoiceTiming("listening");
        }
        revision = state.revision;
      }
    } catch (cause) {
      if (!signal.aborted) fail(failureMessage(cause));
    }
  }

  useEffect(() => {
    mounted.current = true;
    if (!attempt.current) {
      setTransport("idle");
      setMuted(false);
      setEnding(!!stopping.current);
      setConnectedAt(undefined);
      setSpeakerphone(undefined);
      setSpeakerBusy(false);
      setSpeakerError(undefined);
    }
    const subscription = AppState.addEventListener("change", (next) => {
      const active = attempt.current;
      if (
        active &&
        realtimeShouldEndOnAppState(next, active.requestingPermission)
      )
        void functions.current.finish(
          "Live voice ended when Solace left the foreground. Tap Retry to start again.",
          false,
          "disconnected",
        );
    });
    return () => {
      mounted.current = false;
      subscription?.remove();
      if (attempt.current) void functions.current.finish();
    };
  }, []);

  return {
    transport,
    state,
    mediaAcknowledged,
    muted,
    ending,
    connectedAt,
    speakerphone,
    speakerBusy,
    speakerError,
    error,
    start,
    finish,
    conversationId: () => conversation.current,
    async readAudioLevels() {
      const active = attempt.current;
      if (!active?.peer) return {};
      const levels = await active.peer.readAudioLevels();
      if (attempt.current !== active) return {};
      if (!active.outputObserved && (levels.output ?? 0) > 0.002) {
        active.outputObserved = true;
        markVoiceTiming("first-output");
      }
      return levels;
    },
    async toggleSpeakerphone() {
      const active = attempt.current;
      if (
        !active?.peer?.setSpeakerphone ||
        active.speakerChanging ||
        speakerphone === undefined
      )
        return;
      active.speakerChanging = true;
      setSpeakerBusy(true);
      setSpeakerError(undefined);
      try {
        const next = !speakerphone;
        const applied = await active.peer.setSpeakerphone(next);
        if (attempt.current !== active) return;
        if (applied) setSpeakerphone(next);
        else setSpeakerError("Couldn’t change the speaker preference.");
      } catch {
        if (attempt.current === active)
          setSpeakerError("Couldn’t change the speaker preference.");
      } finally {
        if (attempt.current === active) {
          active.speakerChanging = false;
          setSpeakerBusy(false);
        }
      }
    },
    toggleMute() {
      const active = attempt.current;
      if (!active?.peer) return;
      const next = !active.muted;
      try {
        active.peer.setMuted(next);
        if (attempt.current !== active) return;
        active.muted = next;
        setMuted(next);
      } catch {
        // Close capture if we cannot guarantee the requested mic state.
        void finish(
          "Live voice ended because the microphone couldn’t be changed.",
        );
      }
    },
  };
}
