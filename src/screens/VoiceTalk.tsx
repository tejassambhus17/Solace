import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { VoiceWaveform } from "../ChatComposer";
import { useReducedMotion } from "../Companion";
import { spacing, useScreenGutter } from "../layout";
import { routes } from "../routes";
import { beginVoiceTiming, markVoiceTiming } from "../realtime-timing";
import { readVoiceSessionState } from "../realtime-voice-state";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import { AppText, Button, Card, Icon } from "../ui";
import { useRealtimeVoice } from "../useRealtimeVoice";
import {
  CompanionActionDialog,
  useCompanionActions,
} from "./CompanionAppActions";
import { useVoiceLevel, VoiceBackdrop, VoiceMeter } from "./VoiceTalkArtwork";

const voiceDisclosure =
  "Live voice sends microphone audio to OpenAI and uses an AI-generated voice. Solace saves available transcripts in your conversation.";

export function VoiceTalkScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { height, fontScale, width } = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const reduced = useReducedMotion();
  const usableHeight = height - safe.top - safe.bottom;
  const compact = width < 360 || usableHeight < 680 || fontScale > 1.25;
  const initialId =
    typeof app.params.id === "string" ? app.params.id : undefined;
  const voice = useRealtimeVoice(app, initialId);
  const { state, muted, error } = voice;
  const autoStart = useRef(app.params.autoStart === true);
  const transport =
    voice.transport === "idle" && autoStart.current
      ? "connecting"
      : voice.transport;
  const layoutMarked = useRef(false);
  const leaving = useRef(false);
  const leave = useRef(() => {});
  const actions = useCompanionActions(app, {
    beforeNavigation: () => leave.current(),
    onResult: async (actionId, result) => {
      if (!state || leaving.current || transport !== "ready") return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        await app.reportVoiceActionResult(
          state.id,
          actionId,
          result,
          controller.signal,
        );
      } catch {
        // The on-screen result still reflects the completed operation.
      } finally {
        clearTimeout(timeout);
      }
    },
    verifyConfirmation: async (id) => {
      if (!state || leaving.current || transport !== "ready")
        throw new Error(
          "The voice session ended. Ask again in chat to confirm the action.",
        );
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const latest = readVoiceSessionState(
          await app.voiceSessionStatus(state.id, undefined, controller.signal),
          state.id,
          state.revision,
        );
        if (
          leaving.current ||
          latest.phase !== "listening" ||
          latest.userSpeaking ||
          (latest.pendingActionId ?? latest.appAction?.id) !== id
        )
          throw new Error(
            "That voice action is no longer pending. Ask Solace again when you’re ready.",
          );
      } finally {
        clearTimeout(timeout);
      }
    },
  });
  const actionEvents = useRef(actions);
  actionEvents.current = actions;
  const conversationId = useRef(voice.conversationId);
  conversationId.current = voice.conversationId;
  const lastOfferedAction = useRef<string | undefined>(undefined);
  const start = useRef(voice.start);
  const clearEntryIntent = useRef(() => app.setParams({ autoStart: false }));
  const [options, setOptions] = useState(false);
  const [foreground, setForeground] = useState(
    () => AppState.currentState == null || AppState.currentState === "active",
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) =>
      setForeground(next === "active"),
    );
    const current = AppState.currentState;
    setForeground(current == null || current === "active");
    return () => subscription.remove();
  }, []);
  const active =
    transport === "connecting" ||
    transport === "ready" ||
    transport === "reconnecting";
  const connected = transport === "ready";
  const appAction = state?.appAction;
  const pendingActionId = state?.pendingActionId;
  useEffect(() => {
    const { receive, cancelPending } = actionEvents.current;
    const offered = lastOfferedAction.current;
    if (
      !connected ||
      !foreground ||
      state?.userSpeaking ||
      state?.phase !== "listening" ||
      !appAction ||
      leaving.current
    ) {
      if (offered && (!connected || !foreground || offered !== pendingActionId))
        cancelPending(offered);
      return;
    }
    if (offered && offered !== appAction.id && offered !== pendingActionId)
      cancelPending(offered);
    lastOfferedAction.current = pendingActionId ?? appAction.id;
    receive(appAction, conversationId.current());
  }, [
    appAction,
    connected,
    foreground,
    pendingActionId,
    state?.phase,
    state?.userSpeaking,
  ]);
  const phase =
    state?.phase === "support"
      ? "support"
      : !connected
        ? transport
        : state?.phase === "speaking" || state?.phase === "thinking"
          ? state.phase
          : muted
            ? "muted"
            : state?.userSpeaking || voice.mediaAcknowledged
              ? "listening"
              : "ready";
  const connectionError = phase === "failed" || phase === "disconnected";
  const copy = {
    idle: ["Ready to talk", "I’m here whenever you’re ready."],
    connecting: ["Connecting…", "Connecting to Solace…"],
    ready: ["Connected", "You can start speaking whenever you’re ready."],
    listening: ["Listening…", "I’m here, go ahead…"],
    thinking: ["Thinking…", "Taking a moment to respond…"],
    speaking: ["Speaking…", "Solace is speaking. You can jump in anytime."],
    muted: ["Muted", "Unmute when you’re ready to talk."],
    reconnecting: ["Reconnecting…", "Finding our connection…"],
    disconnected: [
      "Connection lost",
      error ?? "Try again or continue in chat.",
    ],
    failed: ["Couldn’t connect", error ?? "Try again or continue in chat."],
    support: ["Support right now", "Take a moment to read this guidance."],
  }[phase];
  const motion =
    phase === "idle" || connectionError || phase === "support"
      ? "resting"
      : connected && muted
        ? "muted"
        : phase;
  const signal = connected
    ? phase === "speaking"
      ? "output"
      : phase === "listening" && state?.userSpeaking && !muted
        ? "input"
        : undefined
    : undefined;
  const motionPaused = reduced || !foreground || options;
  const level = useVoiceLevel(signal, voice.readAudioLevels, motionPaused);
  const accent = resolved === "dark" ? colors.lavender : colors.lavenderText;
  const liveStatus =
    phase === "reconnecting"
      ? "Reconnecting"
      : connected && voice.connectedAt && phase !== "connecting"
        ? "Live"
        : active
          ? "Connecting"
          : phase === "idle"
            ? "Ready"
            : "Offline";

  leave.current = () => {
    if (leaving.current) return;
    leaving.current = true;
    const current = voice.conversationId();
    // The local peer closes immediately. Finish refreshes history in the
    // background when the server confirms any last turn.
    void voice.finish();
    if (current && current !== initialId) {
      const draft = app.chatDrafts.new;
      if (draft && !app.chatDrafts[current]) {
        app.setChatDraft(current, draft);
        app.setChatDraft("new", "", draft);
      }
      app.navigate(routes.companion, {
        id: current,
        originCheckinId: app.params.originCheckinId,
      });
    } else if (app.canGoBack) app.back();
    else app.navigate(routes.companion, { id: current });
  };
  useEffect(() => {
    leaving.current = false;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      leave.current();
      return true;
    });
    const auto = autoStart.current
      ? setTimeout(() => {
          autoStart.current = false;
          clearEntryIntent.current();
          void start.current();
        }, 0)
      : undefined;
    return () => {
      back.remove();
      clearTimeout(auto);
    };
  }, []);

  return (
    <View
      onLayout={() => {
        if (layoutMarked.current) return;
        layoutMarked.current = true;
        markVoiceTiming("layout");
      }}
      style={[
        styles.frame,
        { backgroundColor: resolved === "dark" ? "#161125" : colors.bg },
      ]}
    >
      <VoiceBackdrop
        motion={motion}
        level={level}
        signal={signal}
        paused={motionPaused}
      />
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={styles.frame}
      >
        <View
          style={[
            styles.header,
            { paddingHorizontal: Math.max(8, gutter - 11) },
          ]}
        >
          <VoiceControl
            icon="arrow-back"
            accessibilityLabel="Back to Companion"
            onPress={() => leave.current()}
            size={34}
          />
          <View style={styles.headerTitle}>
            <VoiceWaveform color={accent} size={22} />
            <AppText
              variant="body"
              accessibilityRole="header"
              style={styles.headerText}
            >
              Voice Companion
            </AppText>
          </View>
          <VoiceControl
            icon="ellipsis-horizontal"
            accessibilityLabel="Voice options"
            onPress={() => setOptions(true)}
            size={34}
          />
        </View>
        <ScrollView
          style={styles.frame}
          contentContainerStyle={[
            styles.body,
            { paddingTop: compact ? 8 : 25, paddingBottom: compact ? 16 : 36 },
          ]}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.identity, { paddingHorizontal: gutter }]}>
            <AppText
              variant="title"
              accessibilityRole="header"
              style={styles.solace}
            >
              Solace
            </AppText>
            <AppText
              variant="body"
              color={colors.muted}
              accessibilityLiveRegion="polite"
              style={styles.center}
            >
              {copy[0]}
            </AppText>
            <View style={{ marginTop: compact ? 4 : 9 }}>
              <VoiceMeter
                level={level}
                color={accent}
                compact={compact}
                ready={connected && !muted}
              />
            </View>
          </View>

          <View
            testID="voice-scene"
            pointerEvents="none"
            style={[
              styles.sceneSpace,
              {
                minHeight: Math.max(
                  96,
                  Math.min(width * 0.55, usableHeight * 0.25),
                ),
              },
            ]}
          />

          <View
            style={[
              styles.lower,
              {
                paddingHorizontal: width >= 370 ? Math.max(gutter, 32) : gutter,
              },
            ]}
          >
            <AppText
              variant="heading"
              color={connectionError ? colors.danger : colors.text}
              style={[
                styles.guidance,
                compact && styles.compactGuidance,
                connectionError && {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                },
              ]}
              accessibilityRole={connectionError ? "alert" : undefined}
            >
              {copy[1]}
            </AppText>
            {phase === "support" && !!state?.support && (
              <Card style={{ gap: spacing.row, marginTop: spacing.compact }}>
                <AppText accessibilityRole="alert" selectable>
                  {state.support}
                </AppText>
                <Button
                  title="Find human support"
                  variant="secondary"
                  icon="heart-outline"
                  onPress={() => app.navigate("support")}
                />
              </Card>
            )}

            <View
              testID="voice-session-controls"
              style={[styles.controls, { marginTop: compact ? 14 : 36 }]}
            >
              <View
                style={[styles.controlSlot, { paddingTop: compact ? 8 : 15 }]}
              >
                <VoiceControl
                  icon={
                    voice.speakerphone === undefined
                      ? "volume-high-outline"
                      : voice.speakerphone
                        ? "volume-high-outline"
                        : "volume-low-outline"
                  }
                  label={
                    voice.speakerphone === undefined
                      ? "System audio"
                      : "Speaker"
                  }
                  accessibilityLabel={
                    voice.speakerphone ? "Prefer earpiece" : "Prefer speaker"
                  }
                  accessibilityHint="Changes the built-in speaker preference. The system can use connected headphones."
                  selected={voice.speakerphone}
                  onPress={
                    voice.speakerphone === undefined
                      ? undefined
                      : () => void voice.toggleSpeakerphone()
                  }
                  disabled={!connected || voice.speakerBusy}
                  size={compact ? 48 : 50}
                />
              </View>
              <View style={styles.controlSlot}>
                <VoiceControl
                  icon={
                    active
                      ? "call"
                      : phase === "support"
                        ? "chatbubble-outline"
                        : error
                          ? "refresh"
                          : "play"
                  }
                  label={
                    active
                      ? "End"
                      : phase === "support"
                        ? "Chat"
                        : error
                          ? "Retry"
                          : "Start"
                  }
                  accessibilityLabel={
                    active
                      ? "End voice session"
                      : phase === "support"
                        ? "Continue in chat"
                        : error
                          ? "Retry live voice"
                          : "Start live voice"
                  }
                  onPress={
                    active || phase === "support"
                      ? () => leave.current()
                      : () => {
                          beginVoiceTiming();
                          void voice.start();
                        }
                  }
                  disabled={!active && voice.ending}
                  size={compact ? 64 : 80}
                  primary
                />
              </View>
              <View
                style={[styles.controlSlot, { paddingTop: compact ? 8 : 15 }]}
              >
                <VoiceControl
                  icon={muted ? "mic-off" : "mic-off-outline"}
                  label={muted ? "Unmute" : "Mute"}
                  accessibilityLabel={
                    muted ? "Unmute microphone" : "Mute microphone"
                  }
                  onPress={voice.toggleMute}
                  selected={muted}
                  disabled={!connected}
                  size={compact ? 48 : 50}
                />
              </View>
            </View>
            {!!voice.speakerError && (
              <AppText
                variant="caption"
                accessibilityRole="alert"
                color={colors.danger}
                style={[styles.center, styles.footerCopy]}
              >
                {voice.speakerError}
              </AppText>
            )}
            <VoiceLiveStatus
              level={level}
              label={liveStatus}
              startedAt={voice.connectedAt}
              compact={compact}
              ready={connected && !muted}
            />
            {phase === "connecting" || phase === "idle" ? (
              <AppText
                variant="caption"
                color={colors.muted}
                style={styles.disclosure}
              >
                {voiceDisclosure}
              </AppText>
            ) : connectionError ? (
              <View style={styles.footerCopy}>
                <Button
                  title="Continue in Chat"
                  icon="chatbubble-outline"
                  onPress={() => leave.current()}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={options}
        transparent
        animationType={reduced ? "none" : "fade"}
        onRequestClose={() => setOptions(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.overlay },
            ]}
            onPress={() => setOptions(false)}
            accessibilityLabel="Close voice options"
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.options,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ScrollView bounces={false}>
              <AppText variant="heading" accessibilityRole="header">
                Voice & privacy
              </AppText>
              <AppText color={colors.muted} style={{ marginTop: spacing.row }}>
                {voiceDisclosure}
              </AppText>
              <View style={{ marginTop: spacing.card, gap: spacing.compact }}>
                <Button
                  title="Continue in chat"
                  onPress={() => {
                    setOptions(false);
                    leave.current();
                  }}
                />
                <Button
                  title="Close"
                  variant="secondary"
                  onPress={() => setOptions(false)}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CompanionActionDialog actions={actions} />
    </View>
  );
}

function VoiceControl({
  icon,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  size,
  primary,
  selected,
  disabled,
}: {
  icon: string;
  label?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  size: number;
  primary?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const circle = [
    styles.controlCircle,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: primary ? 0 : 1,
      borderColor: dark ? "#9A7BA153" : colors.lavender,
      backgroundColor: primary
        ? "#EABBD5"
        : selected
          ? colors.lavenderSurface
          : dark
            ? "#2C233C99"
            : "#FBF7FDE8",
    },
    primary && styles.endGlow,
    primary &&
      artGradient(
        dark
          ? "linear-gradient(150deg, #F9D9ED 0%, #D69ACB 47%, #FFD4B8 96%)"
          : "linear-gradient(150deg, #F3E5F9 0%, #CDB3E0 53%, #ECD5DE 100%)",
      ),
  ];
  const controlFace = (
    <View style={circle}>
      {primary && (
        <View
          pointerEvents="none"
          style={[
            styles.endFace,
            { borderRadius: size / 2 - 2 },
            artGradient(
              dark
                ? "linear-gradient(145deg, #723B61 0%, #42244F 53%, #A04C60 100%)"
                : "linear-gradient(145deg, #714C82 0%, #4B315F 55%, #825367 100%)",
            ),
          ]}
        />
      )}
      <View style={icon === "call" ? styles.endGlyph : undefined}>
        <Icon
          name={icon}
          size={primary ? 28 : size < 40 ? 17 : 20}
          color={primary ? "#FFF1F7" : onPress ? colors.text : colors.muted}
        />
      </View>
    </View>
  );
  const caption = label ? (
    <AppText
      variant="caption"
      color={colors.muted}
      style={styles.center}
      accessible={!onPress}
    >
      {label}
    </AppText>
  ) : null;
  if (!onPress)
    return (
      <View
        accessible
        accessibilityLabel="System audio routing"
        style={styles.control}
      >
        {controlFace}
        {caption}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        { opacity: disabled ? 0.46 : pressed ? 0.72 : 1 },
      ]}
    >
      {controlFace}
      {caption}
    </Pressable>
  );
}

function VoiceLiveStatus({
  level,
  label,
  startedAt,
  compact,
  ready,
}: {
  level: Animated.Value;
  label: string;
  startedAt?: number;
  compact: boolean;
  ready: boolean;
}) {
  const { colors, resolved } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (startedAt === undefined) return;
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  const stamp =
    startedAt === undefined
      ? "--:--"
      : [Math.floor(elapsed / 60), elapsed % 60]
          .map((value) => String(value).padStart(2, "0"))
          .join(":");
  const accent = resolved === "dark" ? colors.lavender : colors.lavenderText;
  return (
    <View
      testID="voice-live-status"
      accessible
      accessibilityLabel={`Live voice status, ${label}${startedAt === undefined ? "" : `, ${elapsed} seconds elapsed`}`}
      style={[
        styles.live,
        {
          marginTop: compact ? 16 : 32,
          borderColor: resolved === "dark" ? "#9C739D68" : colors.lavender,
          backgroundColor: resolved === "dark" ? "#30213D99" : "#FBF7FDD9",
        },
      ]}
    >
      <View style={styles.liveLabel}>
        <View
          style={[
            styles.dot,
            { backgroundColor: label === "Live" ? accent : colors.muted },
          ]}
        />
        <AppText
          variant="caption"
          color={colors.muted}
          style={{ flexShrink: 1 }}
        >
          {label}
        </AppText>
      </View>
      <VoiceMeter level={level} color={accent} compact ready={ready} />
      <AppText variant="caption" color={colors.muted} style={styles.elapsed}>
        {stamp}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerText: {
    textAlign: "center",
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  body: { flexGrow: 1 },
  identity: { alignItems: "center", gap: 3 },
  solace: { textAlign: "center", fontStyle: "italic", fontSize: 34 },
  center: { textAlign: "center" },
  sceneSpace: { flexGrow: 1 },
  lower: { alignItems: "center", paddingTop: 2 },
  guidance: {
    textAlign: "center",
    fontStyle: "italic",
    fontSize: 19,
    lineHeight: 29,
    maxWidth: 410,
  },
  compactGuidance: { lineHeight: 25 },
  controls: {
    width: "100%",
    maxWidth: 318,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  controlSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  control: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexShrink: 0,
    maxWidth: "100%",
    minWidth: 48,
    minHeight: 48,
  },
  controlCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  endGlow: { boxShadow: "0px 3px 17px #B8548C59" },
  endFace: {
    position: "absolute",
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    backgroundColor: "#67415E",
  },
  endGlyph: { transform: [{ rotate: "135deg" }] },
  live: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 460,
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
  },
  liveLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  elapsed: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  footerCopy: { marginTop: 10 },
  disclosure: { textAlign: "center", maxWidth: 380, marginTop: 10 },
  overlay: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  options: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "85%",
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
});
