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
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as Speech from "expo-speech";
import { File } from "expo-file-system";
import { interruptAmbientPlayback } from "./audio-focus";
import { useApp } from "./store";
import { useTheme } from "./theme";
import { AppText, Icon, IconButton, Row, Button } from "./ui";
import {
  VoiceTurn,
  voiceContentType,
  voiceMeterLevel,
  type VoiceState,
} from "./voice-session";

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
  renderComposer,
  variant,
  autoReadKey,
  muted = false,
  onMeter,
}: {
  disabled: boolean;
  reply: string;
  onTranscript: (text: string) => boolean;
  onState: (state: "idle" | "listening" | "thinking" | "speaking") => void;
  renderComposer?: (
    microphone: React.ReactNode,
    playback: React.ReactNode,
  ) => React.ReactNode;
  variant?: "talk";
  autoReadKey?: string;
  muted?: boolean;
  onMeter?: (level: number | null) => void;
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { height } = useWindowDimensions();
  const talk = variant === "talk";
  const [state, setState] = useState<VoiceState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [startingSpeech, setStartingSpeech] = useState(false);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoRead = useRef<string | undefined>(undefined);
  function clearSpeechWait() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = null;
  }
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<
    "checking" | "available" | "unconfigured" | "unreachable"
  >("checking");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [review, setReview] = useState("");
  const mounted = useRef(true);
  const speechVersion = useRef(0);
  const latest = useRef({ app, onTranscript, onState, onMeter, talk });
  latest.current = { app, onTranscript, onState, onMeter, talk };
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
        await Speech.stop().catch(() => {});
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
        if (
          mounted.current &&
          (!latest.current.talk || !latest.current.onTranscript(text))
        )
          setReview(text);
      },
      changed: (next, failure) => {
        if (mounted.current) {
          if (next === "listening") setRecordingSeconds(0);
          setState(next);
          setError(failure);
        }
      },
    });
  const turn = turnRef.current;
  async function check() {
    setAvailability("checking");
    try {
      const result = await latest.current.app.capabilities();
      if (mounted.current)
        setAvailability(
          result.voiceTranscription === true ? "available" : "unconfigured",
        );
    } catch {
      if (mounted.current) setAvailability("unreachable");
    }
  }
  useEffect(() => {
    mounted.current = true;
    void check();
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") return;
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      void Speech.stop().catch(() => {});
      setSpeaking(false);
      void turn.leaveForeground();
    });
    return () => {
      mounted.current = false;
      ++speechVersion.current;
      clearSpeechWait();
      turn.dispose();
      void Speech.stop().catch(() => {});
      listener.remove();
      latest.current.onState("idle");
    };
  }, []);
  useEffect(() => {
    latest.current.onState(
      state === "listening"
        ? "listening"
        : ["preparing", "transcribing", "cancelling"].includes(state)
          ? "thinking"
          : speaking
            ? "speaking"
            : "idle",
    );
  }, [state, speaking]);
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
        else setRecordingSeconds(Math.floor(status.durationMillis / 1000));
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
      reply &&
      !disabled &&
      state === "idle" &&
      AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
    ) {
      lastAutoRead.current = autoReadKey;
      if (!muted) void startSpeech();
    } else {
      void Speech.stop().catch(() => {});
    }
  }, [reply, disabled, autoReadKey, muted]);
  async function speak() {
    if (speaking || startingSpeech) {
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      await Speech.stop().catch(() => {});
      setSpeaking(false);
      return;
    }
    if (!reply || disabled || muted || state !== "idle") return;
    await startSpeech();
  }
  async function startSpeech() {
    const version = ++speechVersion.current;
    setError("");
    setStartingSpeech(true);
    try {
      await Speech.stop();
      if (!mounted.current || speechVersion.current !== version) return;
      interruptAmbientPlayback();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: false,
      });
      if (!mounted.current || speechVersion.current !== version) return;
      clearSpeechWait();
      speechTimer.current = setTimeout(() => {
        if (!mounted.current || speechVersion.current !== version) return;
        ++speechVersion.current;
        void Speech.stop().catch(() => {});
        setStartingSpeech(false);
        setSpeaking(false);
        setError(
          "Audio couldn't start on this device. You can read the reply above or try again.",
        );
      }, 8000);
      const limit =
        Number.isFinite(Speech.maxSpeechInputLength) &&
        Speech.maxSpeechInputLength > 0
          ? Math.min(4000, Speech.maxSpeechInputLength)
          : 4000;
      Speech.speak(reply.slice(0, limit), {
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
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
          }
        },
        onStopped: () => {
          if (mounted.current && version === speechVersion.current) {
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
          }
        },
        onError: () => {
          if (mounted.current && version === speechVersion.current) {
            clearSpeechWait();
            setStartingSpeech(false);
            setSpeaking(false);
            setError(
              "Audio playback couldn't start. You can read the reply above.",
            );
          }
        },
      });
    } catch {
      if (mounted.current && version === speechVersion.current) {
        clearSpeechWait();
        setStartingSpeech(false);
        setSpeaking(false);
        setError(
          "Audio playback isn't available. You can read the reply above.",
        );
      }
    }
  }
  const listening = state === "listening";
  const preparing = state === "preparing";
  const transcribing = state === "transcribing";
  const cancelling = state === "cancelling";
  const voiceBusy = preparing || transcribing || cancelling;
  const microphoneDisabled =
    disabled || !!review || voiceBusy || (talk && availability !== "available");
  const size = talk ? 70 : 46;
  const microphone = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        listening
          ? "Stop recording and transcribe"
          : talk
            ? "Start speaking"
            : "Record a voice message"
      }
      accessibilityState={{ disabled: microphoneDisabled, busy: voiceBusy }}
      disabled={microphoneDisabled}
      onPress={() => {
        if (listening) void turn.stop();
        else if (availability === "available") {
          Keyboard.dismiss();
          setShowUnavailable(false);
          void turn.start();
        } else setShowUnavailable(true);
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: talk
          ? listening
            ? colors.border
            : colors.primary
          : resolved === "dark"
            ? "#655348"
            : "#FFFFFF",
        backgroundColor: listening
          ? colors.peachSurface
          : talk
            ? colors.primary
            : resolved === "dark"
              ? "#25201DF5"
              : "#FFF8EFF5",
        boxShadow: talk ? undefined : "0 5px 14px #271C1314",
        opacity: microphoneDisabled ? 0.55 : pressed ? 0.72 : 1,
      })}
    >
      <Icon
        name={listening ? "stop" : "mic-outline"}
        size={talk ? 27 : 21}
        color={
          listening ? colors.danger : talk ? colors.primaryText : colors.text
        }
      />
    </Pressable>
  );
  const playback = !!reply && !muted && (
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
          <AppText variant="label">Your voice, in words</AppText>
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
