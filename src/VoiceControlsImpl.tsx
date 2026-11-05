import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Speech from "expo-speech";
import { File } from "expo-file-system";
import { useApp } from "./store";
import { useTheme } from "./theme";
import { AppText, Icon, IconButton, Row, Button } from "./ui";
import { VoiceTurn, voiceContentType, type VoiceState } from "./voice-session";

export function VoiceControlsImpl({
  disabled,
  reply,
  onTranscript,
  onState,
  renderComposer,
  variant,
  autoReadKey,
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
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const talk = variant === "talk";
  const [state, setState] = useState<VoiceState>("idle");
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
  const latest = useRef({ app, onTranscript, onState, talk });
  latest.current = { app, onTranscript, onState, talk };
  const uri = useRef<string | null>(null);
  const requestingPermission = useRef(false);
  const mime = useRef(voiceContentType(Platform.OS));
  const turnRef = useRef<VoiceTurn | null>(null);
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
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
      if (recording.hasError) {
        void turnRef.current?.cancel(
          "Recording was interrupted. Please try again, or type your message.",
        );
      } else if (
        recording.isFinished &&
        turnRef.current?.state === "listening"
      ) {
        void turnRef.current.stop();
      }
    },
  );
  const status = useAudioRecorderState(recorder, 250);
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
      permission: async () => {
        requestingPermission.current = true;
        try {
          return (await AudioModule.requestRecordingPermissionsAsync()).granted;
        } finally {
          requestingPermission.current = false;
        }
      },
      start: async () => {
        ++speechVersion.current;
        clearSpeechWait();
        await Speech.stop().catch(() => {});
        if (mounted.current) {
          setSpeaking(false);
          setStartingSpeech(false);
        }
        await erase();
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          allowsBackgroundRecording: false,
          shouldPlayInBackground: false,
        });
        await recorder.prepareToRecordAsync();
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
          if (recorder.getStatus().isRecording) await recorder.stop();
        } catch {
          /* Already stopped/disposed. */
        }
        await erase();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      },
      transcribe: async (audio) =>
        (await latest.current.app.transcribeVoice(audio, mime.current)).text,
      transcript: (text) => {
        if (
          mounted.current &&
          (!latest.current.talk || !latest.current.onTranscript(text))
        )
          setReview(text);
      },
      changed: (next, failure) => {
        if (mounted.current) {
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
      // The iOS permission sheet can make the app inactive before recording starts.
      if (next === "inactive" && requestingPermission.current) return;
      if (turn.state !== "idle") {
        void turn.cancel(
          turn.state === "transcribing"
            ? "Transcription was interrupted when you left the app. Try recording again, or type your message."
            : "Recording was discarded when you left the app. Start again when you're ready.",
        );
      }
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
    if (state === "listening" && recorder.getStatus().durationMillis >= 59_000)
      void turn.stop();
    if (state === "listening" && status.mediaServicesDidReset) {
      void turn.cancel("Recording was interrupted. Please try again.");
    }
  }, [status.durationMillis, status.mediaServicesDidReset, state]);
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
      void startSpeech();
    } else {
      void Speech.stop().catch(() => {});
    }
  }, [reply, disabled, autoReadKey]);
  async function speak() {
    if (speaking || startingSpeech) {
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      await Speech.stop().catch(() => {});
      setSpeaking(false);
      return;
    }
    if (!reply || disabled || state !== "idle") return;
    await startSpeech();
  }
  async function startSpeech() {
    const version = ++speechVersion.current;
    setError("");
    setStartingSpeech(true);
    try {
      await Speech.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
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
  const playback = !!reply && (
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
            ? `Recording · ${Math.floor(status.durationMillis / 1000)}s / 60s`
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
          <AppText selectable>{review}</AppText>
          <AppText variant="caption" color={colors.muted}>
            Review this transcript before adding it to your message. Nothing has
            been sent to the conversation.
          </AppText>
          <Row>
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
