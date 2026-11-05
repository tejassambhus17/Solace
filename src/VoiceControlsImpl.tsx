import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
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
import { AppText, IconButton, Row, Button } from "./ui";
import { VoiceTurn, voiceContentType, type VoiceState } from "./voice-session";

export function VoiceControlsImpl({
  disabled,
  reply,
  onTranscript,
  onState,
}: {
  disabled: boolean;
  reply: string;
  onTranscript: (text: string) => boolean;
  onState: (state: "idle" | "listening" | "thinking" | "speaking") => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [state, setState] = useState<VoiceState>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [startingSpeech, setStartingSpeech] = useState(false);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearSpeechWait() {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    speechTimer.current = null;
  }
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [review, setReview] = useState("");
  const mounted = useRef(true);
  const speechVersion = useRef(0);
  const latest = useRef({ app, onTranscript, onState });
  latest.current = { app, onTranscript, onState };
  const uri = useRef<string | null>(null);
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
        void turnRef.current?.cancel();
        setError(
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
    const value = uri.current || recorder.uri;
    uri.current = null;
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
      permission: async () =>
        (await AudioModule.requestRecordingPermissionsAsync()).granted,
      start: async () => {
        ++speechVersion.current;
        await Speech.stop();
        if (mounted.current) setSpeaking(false);
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
        if (mounted.current) setReview(text);
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
    setAvailable(null);
    try {
      const result = await latest.current.app.capabilities();
      if (mounted.current) setAvailable(result.voiceTranscription);
    } catch {
      if (mounted.current) setAvailable(false);
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
      void Speech.stop();
      setSpeaking(false);
      if (turn.state !== "idle") {
        void turn.cancel();
        setError(
          "Recording paused when you left the app. Start again when you're ready.",
        );
      }
    });
    return () => {
      mounted.current = false;
      ++speechVersion.current;
      clearSpeechWait();
      turn.dispose();
      void Speech.stop();
      listener.remove();
      latest.current.onState("idle");
    };
  }, []);
  useEffect(() => {
    latest.current.onState(
      status.isRecording
        ? "listening"
        : ["preparing", "transcribing", "cancelling"].includes(state)
          ? "thinking"
          : speaking
            ? "speaking"
            : "idle",
    );
  }, [status.isRecording, state, speaking]);
  useEffect(() => {
    if (state === "listening" && recorder.getStatus().durationMillis >= 59_000)
      void turn.stop();
    if (state === "listening" && status.mediaServicesDidReset) {
      void turn.cancel();
      setError("Recording was interrupted. Please try again.");
    }
  }, [status.durationMillis, status.mediaServicesDidReset, state]);
  useEffect(() => {
    ++speechVersion.current;
    clearSpeechWait();
    setStartingSpeech(false);
    void Speech.stop();
    setSpeaking(false);
  }, [reply, disabled]);
  async function speak() {
    if (speaking || startingSpeech) {
      ++speechVersion.current;
      clearSpeechWait();
      setStartingSpeech(false);
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!reply || disabled || state !== "idle") return;
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
        void Speech.stop();
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
  return (
    <View>
      <Row style={{ justifyContent: "space-between", gap: 8 }}>
        <Row style={{ gap: 2 }}>
          <IconButton
            name={state === "listening" ? "stop-circle" : "mic-outline"}
            label={
              state === "listening"
                ? "Stop recording and transcribe"
                : "Record a voice message"
            }
            disabled={
              disabled ||
              !!review ||
              state === "preparing" ||
              state === "transcribing" ||
              state === "cancelling"
            }
            onPress={() => {
              if (state === "listening") void turn.stop();
              else if (available) {
                setShowUnavailable(false);
                void turn.start();
              } else setShowUnavailable(true);
            }}
          />
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ fontSize: 11 }}
            accessibilityLiveRegion="polite"
          >
            {state === "listening"
              ? `Listening · ${Math.floor(status.durationMillis / 1000)}s / 60s`
              : state === "transcribing"
                ? "Transcribing…"
                : state === "preparing"
                  ? "Starting microphone…"
                  : "Review before sending"}
          </AppText>
        </Row>
        {!!reply && (
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
            disabled={
              (disabled && !speaking && !startingSpeech) || state !== "idle"
            }
            onPress={() => {
              void speak();
            }}
          />
        )}
      </Row>
      {state === "listening" && (
        <View style={{ paddingBottom: 8, gap: 6 }}>
          <AppText variant="caption" color={colors.muted}>
            Stopping sends this recording for transcription. You review the
            words before sending a chat message.
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
      {(!!error || showUnavailable) && (
        <View style={{ gap: 6, paddingBottom: 8 }}>
          <AppText
            variant="caption"
            accessibilityRole="alert"
            color={colors.muted}
          >
            {error ||
              (available === null
                ? "Checking voice availability. You can type while you wait."
                : "Voice input isn't available right now. You can still type or listen to replies.")}
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
            showUnavailable && (
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
    </View>
  );
}
