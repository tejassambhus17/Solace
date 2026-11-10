import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Speech from "expo-speech";
import { File, Paths } from "expo-file-system";
import { interruptAmbientPlayback } from "./audio-focus";
import { ChatComposerControl } from "./ChatComposer";
import { useApp } from "./store";
import { useTheme } from "./theme";
import { AppText, Icon, IconButton, Row, Button } from "./ui";
import {
  VoiceTurn,
  voiceContentType,
  voiceMeterLevel,
  type VoiceState,
} from "./voice-session";

export type VoiceControlStage =
  VoiceState | "review" | "starting-playback" | "speaking";

type SpokenReply = {
  text: string;
  id?: string;
  conversationId?: string;
  provider?: "live" | "offline";
  sensitive?: boolean;
};

async function temporarySpeech(audio: ArrayBuffer) {
  if (Platform.OS === "web") {
    const uri = URL.createObjectURL(new Blob([audio], { type: "audio/mpeg" }));
    return { uri, remove: () => URL.revokeObjectURL(uri) };
  }
  const file = new File(
    Paths.cache,
    `solace-reply-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
  );
  const remove = () => {
    try {
      if (file.exists) file.delete();
    } catch {
      /* The private OS cache can evict a failed cleanup. */
    }
  };
  try {
    await file.write(audio);
    return { uri: file.uri, remove };
  } catch (error) {
    remove();
    throw error;
  }
}

async function recordingPermission() {
  const { granted } = await AudioModule.requestRecordingPermissionsAsync();
  if (!granted || Platform.OS === "web" || AppState.currentState === "active")
    return granted;
  // Android can deliver the permission result before the activity resumes.
  return new Promise<true | "away">((resolve) => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") finish(true);
    });
    const timeout = setTimeout(() => finish("away"), 1200);
    function finish(result: true | "away") {
      clearTimeout(timeout);
      listener.remove();
      resolve(result);
    }
  });
}

export function VoiceControlsImpl({
  disabled,
  reply,
  onTranscript,
  onState,
  onStage,
  renderComposer,
  variant,
  autoReadKey,
  muted = false,
  onMeter,
}: {
  disabled: boolean;
  reply?: SpokenReply;
  onTranscript: (text: string) => boolean;
  onState?: (state: "idle" | "listening" | "thinking" | "speaking") => void;
  onStage?: (stage: VoiceControlStage) => void;
  renderComposer?: (
    microphone: React.ReactNode,
    playback: React.ReactNode,
    details?: React.ReactNode,
  ) => React.ReactNode;
  variant?: "talk";
  autoReadKey?: string;
  muted?: boolean;
  onMeter?: (level: number | null) => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const talk = variant === "talk";
  const {
    text: replyText,
    id: replyId,
    conversationId,
    provider,
    sensitive,
  } = reply ?? {};
  const liveSpeech =
    provider === "live" && !!conversationId && !!replyId && !sensitive;
  const builtInSpeech = provider === "offline" && !!replyText;
  const [state, setState] = useState<VoiceState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const displayedSeconds = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [startingSpeech, setStartingSpeech] = useState(false);
  const ownsSpeech = useRef(false);
  const speechRequest = useRef<AbortController | null>(null);
  const disposePlayback = useRef<(() => void) | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoRead = useRef<string | undefined>(undefined);
  function clearSpeechWait() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = null;
  }
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<
    "unknown" | "checking" | "available" | "unconfigured" | "unreachable"
  >(talk ? "checking" : "unknown");
  const capabilityVersion = useRef(0);
  const checking = useRef(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [review, setReview] = useState("");
  const mounted = useRef(true);
  const speechVersion = useRef(0);
  const latest = useRef({
    app,
    onTranscript,
    onState,
    onStage,
    onMeter,
    talk,
    disabled,
  });
  latest.current = {
    app,
    onTranscript,
    onState,
    onStage,
    onMeter,
    talk,
    disabled,
  };
  const uri = useRef<string | null>(null);
  const mime = useRef(voiceContentType(Platform.OS));
  const turnRef = useRef<VoiceTurn | null>(null);
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: talk,
      web: {
        ...RecordingPresets.HIGH_QUALITY.web,
        mimeType:
          Platform.OS === "web" &&
          typeof MediaRecorder !== "undefined" &&
          typeof MediaRecorder.isTypeSupported === "function" &&
          MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4",
      },
    },
    (recording) => {
      if (!mounted.current) return;
      void turnRef.current?.recorderEvent(recording);
    },
  );
  async function erase() {
    let value = uri.current;
    uri.current = null;
    try {
      value ||= recorder.uri;
    } catch {
      // The native recorder may already have been released on unmount.
    }
    if (!value) return;
    if (Platform.OS === "web") URL.revokeObjectURL(value);
    else {
      try {
        const file = new File(value);
        if (file.exists) file.delete();
      } catch {
        /* OS cache eviction remains available if cleanup fails. */
      }
    }
  }
  if (!turnRef.current)
    turnRef.current = new VoiceTurn({
      permission: recordingPermission,
      start: async () => {
        ++speechVersion.current;
        clearSpeechWait();
        await stopOwnedSpeech();
        if (mounted.current) {
          setSpeaking(false);
          setStartingSpeech(false);
        }
        await erase();
        if (!mounted.current || turnRef.current?.state !== "preparing") return;
        interruptAmbientPlayback();
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          interruptionMode: "doNotMix",
          allowsBackgroundRecording: false,
          shouldPlayInBackground: false,
        });
        if (!mounted.current || turnRef.current?.state !== "preparing") return;
        await recorder.prepareToRecordAsync();
        if (Platform.OS !== "web" && AppState.currentState !== "active")
          throw new Error("Solace is in the background.");
        // Expo's web recorder releases its microphone tracks on the stop event.
        // If cancellation arrived during preparation, VoiceTurn immediately
        // stops and discards this recording after start settles.
        if (
          Platform.OS === "web" ||
          (mounted.current && turnRef.current?.state === "preparing")
        )
          recorder.record({ forDuration: 60 });
      },
      stop: async () => {
        if (recorder.getStatus().isRecording) await recorder.stop();
        uri.current = recorder.uri;
        await setAudioModeAsync({ allowsRecording: false });
        if (!uri.current)
          throw new Error(
            "There is no recording to transcribe. Please try again.",
          );
        try {
          if (Platform.OS === "web") {
            const blob = await (await fetch(uri.current)).blob();
            mime.current = blob.type.split(";")[0] || "audio/webm";
            return await blob.arrayBuffer();
          }
          const file = new File(uri.current);
          if (file.size > 8 * 1024 * 1024)
            throw new Error(
              "That recording is too large. Try a shorter message.",
            );
          return await file.arrayBuffer();
        } finally {
          await erase();
        }
      },
      cancel: async () => {
        try {
          // The OS can pause a recorder before the app receives an interruption.
          // On web, canRecord also covers an already-ended MediaRecorder.
          if (
            recorder.isRecording ||
            (Platform.OS !== "web" && recorder.getStatus().canRecord)
          )
            await recorder.stop();
        } catch {
          /* Already stopped/disposed. */
        }
        await erase();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      },
      transcribe: async (audio, signal) =>
        (await latest.current.app.transcribeVoice(audio, mime.current, signal))
          .text,
      transcript: (text) => {
        if (mounted.current && !latest.current.onTranscript(text))
          setReview(text);
      },
      changed: (next, failure) => {
        if (mounted.current) {
          if (next === "listening") {
            displayedSeconds.current = 0;
            setRecordingSeconds(0);
          }
          setState(next);
          setError(failure);
        }
      },
    });
  const turn = turnRef.current;
  async function check() {
    if (checking.current) return;
    checking.current = true;
    const version = ++capabilityVersion.current;
    setAvailability("checking");
    try {
      const result = await latest.current.app.capabilities();
      if (!mounted.current || capabilityVersion.current !== version) return;
      const available = result.voiceTranscription === true;
      setAvailability(available ? "available" : "unconfigured");
      return available;
    } catch {
      if (!mounted.current || capabilityVersion.current !== version) return;
      setAvailability("unreachable");
      return false;
    } finally {
      if (capabilityVersion.current === version) checking.current = false;
    }
  }
  function stopOwnedSpeech() {
    speechRequest.current?.abort();
    speechRequest.current = null;
    disposePlayback.current?.();
    disposePlayback.current = null;
    if (!ownsSpeech.current) return;
    ownsSpeech.current = false;
    return Speech.stop().catch(() => {});
  }
  useEffect(() => {
    mounted.current = true;
    setState(turn.state);
    setStartingSpeech(false);
    setSpeaking(false);
    setShowUnavailable(false);
    setReview("");
    setError("");
    if (talk) void check();
    else
      setAvailability((previous) =>
        previous === "checking" ? "unknown" : previous,
      );
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") return;
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      void stopOwnedSpeech();
      setSpeaking(false);
      void turn.leaveForeground();
    });
    return () => {
      mounted.current = false;
      ++capabilityVersion.current;
      checking.current = false;
      ++speechVersion.current;
      clearSpeechWait();
      // Activity disconnects effects when Chat is hidden and reconnects them
      // with the same recorder on return. Cancel the turn without disposing it.
      if (turn.state !== "idle" || turn.canRetry) void turn.cancel();
      void stopOwnedSpeech();
      listener.remove();
      latest.current.onMeter?.(null);
      latest.current.onState?.("idle");
      latest.current.onStage?.("idle");
    };
  }, []);
  useEffect(() => {
    latest.current.onState?.(
      state === "listening"
        ? "listening"
        : state !== "idle"
          ? "thinking"
          : speaking
            ? "speaking"
            : "idle",
    );
    latest.current.onStage?.(
      state !== "idle"
        ? state
        : review
          ? "review"
          : speaking
            ? "speaking"
            : startingSpeech
              ? "starting-playback"
              : "idle",
    );
  }, [state, review, speaking, startingSpeech]);
  useEffect(() => {
    if (state !== "listening") {
      latest.current.onMeter?.(null);
      return;
    }
    let wasInactive = false;
    const timer = setInterval(
      () => {
        if (turn.state !== "listening") return;
        const status = recorder.getStatus();
        const inactive = !recorder.isRecording;
        // Give the recorder's normal completion event time to arrive. A track
        // revocation can stop the device without delivering that event.
        if (status.mediaServicesDidReset || (inactive && wasInactive)) {
          void turn.recorderEvent({ hasError: true });
          return;
        }
        wasInactive = inactive;
        if (!inactive && talk)
          latest.current.onMeter?.(voiceMeterLevel(status.metering));
        if (!inactive && status.durationMillis >= 59_000) void turn.stop();
        else {
          const seconds = Math.floor(status.durationMillis / 1000);
          if (seconds !== displayedSeconds.current) {
            displayedSeconds.current = seconds;
            setRecordingSeconds(seconds);
          }
        }
      },
      talk ? 120 : 250,
    );
    return () => clearInterval(timer);
  }, [recorder, state, talk, turn]);
  useEffect(() => {
    ++speechVersion.current;
    clearSpeechWait();
    setStartingSpeech(false);
    setSpeaking(false);
    if (
      autoReadKey &&
      autoReadKey !== lastAutoRead.current &&
      builtInSpeech &&
      !disabled &&
      state === "idle" &&
      AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
    ) {
      lastAutoRead.current = autoReadKey;
      if (!muted) void startSpeech();
    } else {
      void stopOwnedSpeech();
    }
  }, [
    replyText,
    replyId,
    conversationId,
    builtInSpeech,
    liveSpeech,
    disabled,
    autoReadKey,
    muted,
  ]);
  async function speak() {
    if (speaking || startingSpeech) {
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      await stopOwnedSpeech();
      setSpeaking(false);
      return;
    }
    if (
      (!liveSpeech && !builtInSpeech) ||
      disabled ||
      muted ||
      state !== "idle"
    )
      return;
    await startSpeech();
  }
  async function startSpeech() {
    const version = ++speechVersion.current;
    const current = () => mounted.current && speechVersion.current === version;
    const finish = (failure?: string) => {
      if (!current()) return;
      ++speechVersion.current;
      clearSpeechWait();
      void stopOwnedSpeech();
      setStartingSpeech(false);
      setSpeaking(false);
      if (failure) setError(failure);
    };
    const started = () => {
      if (!current()) return;
      clearSpeechWait();
      setStartingSpeech(false);
      setSpeaking(true);
    };
    const playbackFailure =
      "Audio playback couldn't start. You can read the reply or try again.";
    setError("");
    setStartingSpeech(true);
    try {
      await stopOwnedSpeech();
      if (!current()) return;
      interruptAmbientPlayback();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
      });
      if (!current()) return;
      if (liveSpeech && conversationId && replyId) {
        const request = new AbortController();
        speechRequest.current = request;
        const audio = await latest.current.app.speakVoiceReply(
          conversationId,
          replyId,
          request.signal,
        );
        if (!current()) return;
        speechRequest.current = null;
        const source = await temporarySpeech(audio);
        if (!current()) {
          source.remove();
          return;
        }
        let player: ReturnType<typeof createAudioPlayer> | undefined;
        let listener: { remove: () => void } | undefined;
        disposePlayback.current = () => {
          try {
            listener?.remove();
          } catch {
            /* A disposed player has no active subscription. */
          }
          try {
            player?.remove();
          } catch {
            /* The OS can dispose an interrupted player before cleanup. */
          } finally {
            source.remove();
          }
        };
        player = createAudioPlayer(source.uri, {
          updateInterval: 200,
          allowsExternalPlayback: false,
        });
        let hasPlayed = false;
        listener = player.addListener("playbackStatusUpdate", (status) => {
          if (!current()) return;
          if (status.didJustFinish) finish();
          else if (
            status.error ||
            status.mediaServicesDidReset ||
            status.playbackState === "failed"
          )
            finish(playbackFailure);
          // Web emits a play event before decoding, then a loaded-data event
          // that still reports paused at position zero. Wait for progress.
          else if (
            status.playing &&
            !hasPlayed &&
            (Platform.OS !== "web" || status.currentTime > 0)
          ) {
            hasPlayed = true;
            started();
          } else if (hasPlayed && !status.playing && !status.isBuffering)
            finish();
        });
        speechTimer.current = setTimeout(() => finish(playbackFailure), 8000);
        player.play();
        return;
      }
      if (!builtInSpeech || !replyText) return finish();
      speechTimer.current = setTimeout(() => finish(playbackFailure), 8000);
      const limit =
        Number.isFinite(Speech.maxSpeechInputLength) &&
        Speech.maxSpeechInputLength > 0
          ? Math.min(4000, Speech.maxSpeechInputLength)
          : 4000;
      ownsSpeech.current = true;
      Speech.speak(replyText.slice(0, limit), {
        rate: 0.9,
        onStart: () => {
          if (mounted.current && version === speechVersion.current) {
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(true);
          }
        },
        onDone: () => {
          if (mounted.current && version === speechVersion.current) {
            ownsSpeech.current = false;
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
          }
        },
        onStopped: () => {
          if (mounted.current && version === speechVersion.current) {
            ownsSpeech.current = false;
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
          }
        },
        onError: () => {
          if (mounted.current && version === speechVersion.current) {
            ownsSpeech.current = false;
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
            setError(
              "Audio playback couldn't start. You can read the reply instead.",
            );
          }
        },
      });
    } catch (error) {
      const failure = error as { code?: string; status?: number };
      finish(
        failure?.code === "AI_QUOTA_EXCEEDED"
          ? "Spoken replies have reached their current quota. You can read the reply instead."
          : failure?.status === 429
            ? "Voice is busy right now. Try again in a moment or read the reply."
            : playbackFailure,
      );
    }
  }
  const listening = state === "listening";
  const preparing = state === "preparing";
  const transcribing = state === "transcribing";
  const cancelling = state === "cancelling";
  const voiceBusy = preparing || transcribing || cancelling;
  const microphoneDisabled =
    disabled ||
    !!review ||
    voiceBusy ||
    availability === "checking" ||
    (talk && availability !== "available");
  async function record() {
    const available =
      availability === "unknown" ? await check() : availability === "available";
    if (!mounted.current || available === undefined || latest.current.disabled)
      return;
    if (!available) {
      setShowUnavailable(true);
      return;
    }
    if (
      AppState.currentState === "background" ||
      AppState.currentState === "inactive"
    )
      return;
    Keyboard.dismiss();
    setShowUnavailable(false);
    void turn.start();
  }
  const microphoneLabel = listening
    ? "Stop recording and transcribe"
    : talk
      ? "Start speaking"
      : "Record a voice message";
  const microphoneBusy = voiceBusy || availability === "checking";
  const onMicrophone = () => {
    if (listening) void turn.stop();
    else void record();
  };
  const microphone = talk ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={microphoneLabel}
      accessibilityState={{
        disabled: microphoneDisabled,
        busy: microphoneBusy,
      }}
      disabled={microphoneDisabled}
      onPress={onMicrophone}
      style={({ pressed }) => ({
        width: 70,
        height: 70,
        borderRadius: 35,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: listening ? colors.border : colors.primary,
        backgroundColor: listening ? colors.peachSurface : colors.primary,
        opacity: microphoneDisabled ? 0.55 : pressed ? 0.72 : 1,
      })}
    >
      <Icon
        name={listening ? "stop" : "mic-outline"}
        size={27}
        color={listening ? colors.danger : colors.primaryText}
      />
    </Pressable>
  ) : (
    <ChatComposerControl
      icon={listening ? "stop" : "mic-outline"}
      label={microphoneLabel}
      tone={listening ? "recording" : "quiet"}
      onPress={onMicrophone}
      disabled={microphoneDisabled}
      busy={microphoneBusy}
    />
  );
  const playback = (liveSpeech || builtInSpeech) && !muted && (
    <IconButton
      name={
        speaking || startingSpeech
          ? "stop-circle-outline"
          : "volume-medium-outline"
      }
      label={
        speaking
          ? "Stop reading reply"
          : startingSpeech
            ? "Cancel audio playback"
            : liveSpeech
              ? "Read reply aloud with an AI-generated voice"
              : "Read reply aloud"
      }
      disabled={(disabled && !speaking && !startingSpeech) || state !== "idle"}
      onPress={() => void speak()}
    />
  );
  const unavailable = (showUnavailable || talk) && availability !== "available";
  const availabilityText =
    availability === "checking"
      ? "Checking voice availability…"
      : availability === "unreachable"
        ? "Couldn’t check voice availability. Try again or type your message."
        : "Voice recording needs a connected transcription service. You can still type or listen to replies.";
  const details = (
    <>
      {talk && liveSpeech && !muted && (
        <AppText
          variant="caption"
          color={colors.muted}
          style={{ paddingBottom: 6 }}
        >
          Spoken replies use an AI-generated voice.
        </AppText>
      )}
      {(listening || voiceBusy) && (
        <AppText
          variant="caption"
          color={colors.muted}
          accessibilityLiveRegion={listening ? undefined : "polite"}
          style={{ paddingBottom: 6 }}
        >
          {listening
            ? `Recording · ${recordingSeconds}s / 60s`
            : transcribing
              ? "Transcribing…"
              : preparing
                ? "Starting microphone…"
                : "Discarding…"}
        </AppText>
      )}
      {listening && (
        <View style={{ paddingBottom: 8, gap: 6 }}>
          <AppText variant="caption" color={colors.muted}>
            Audio goes to transcription when you stop or reach one minute. You
            can review the words before sending.
          </AppText>
          <Button
            title="Discard recording"
            variant="ghost"
            onPress={() => {
              void turn.cancel();
            }}
          />
        </View>
      )}
      {!!review && (
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <AppText variant="label">Review transcript</AppText>
          {talk ? (
            <AppText selectable>{review}</AppText>
          ) : (
            <ScrollView
              accessibilityLabel="Voice transcript"
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: Math.min(112, height * 0.2) }}
            >
              <AppText selectable>{review}</AppText>
            </ScrollView>
          )}
          <AppText variant="caption" color={colors.muted}>
            Review this transcript before adding it to your message. Nothing has
            been sent to the conversation.
          </AppText>
          <Row style={{ flexWrap: "wrap" }}>
            <Button
              title="Use transcript"
              variant="secondary"
              onPress={() => {
                if (latest.current.onTranscript(review)) setReview("");
              }}
            />
            <Button
              title="Discard"
              variant="ghost"
              onPress={() => setReview("")}
            />
          </Row>
        </View>
      )}
      {(!!error || unavailable) && (
        <View style={{ gap: 6, paddingBottom: 8 }}>
          <AppText
            variant="caption"
            accessibilityRole="alert"
            color={colors.muted}
          >
            {error || availabilityText}
          </AppText>
          {turn.canRetry ? (
            <Button
              title="Retry transcription"
              variant="secondary"
              onPress={() => {
                void turn.retry();
              }}
            />
          ) : (
            unavailable &&
            availability !== "checking" && (
              <Button
                title="Check voice again"
                variant="secondary"
                onPress={() => {
                  void check();
                }}
              />
            )
          )}
        </View>
      )}
    </>
  );
  const showDetails =
    listening || voiceBusy || !!review || !!error || unavailable;
  if (renderComposer && !talk)
    return renderComposer(
      microphone,
      playback,
      showDetails ? details : undefined,
    );

  return (
    <View>
      {renderComposer ? (
        <>
          {details}
          {renderComposer(microphone, playback)}
        </>
      ) : (
        <>
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              {microphone}
              <AppText variant="caption" color={colors.muted}>
                Voice message
              </AppText>
            </Row>
            {playback}
          </Row>
          {details}
        </>
      )}
    </View>
  );
}
