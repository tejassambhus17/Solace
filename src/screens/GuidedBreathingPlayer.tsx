import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SolaceMoment } from "../../server/src/moment-contract";
import { AmbientSound } from "../AmbientSound";
import { useReducedMotion } from "../Companion";
import { EnvironmentScene } from "../Environment";
import { useScreenGutter } from "../layout";
import {
  momentClockText,
  type momentBreathingPosition,
  type momentPosition,
  type MomentEnvironment,
} from "../moments";
import { artGradient, useTheme } from "../theme";
import { AppText, Button, coverImageStyle, Icon, Screen } from "../ui";

type Exit = { resume: boolean; dismiss: () => void; confirm: () => void };

export function GuidedBreathingPlayer({
  activity,
  position,
  rhythm,
  elapsedMs,
  environment,
  running,
  started,
  sound,
  toggleSound,
  notice,
  togglePlay,
  restart,
  leave,
  exit,
  children,
}: {
  activity: SolaceMoment;
  position: ReturnType<typeof momentPosition>;
  rhythm: ReturnType<typeof momentBreathingPosition>;
  elapsedMs: number;
  environment: MomentEnvironment;
  running: boolean;
  started: boolean;
  sound: boolean;
  toggleSound: () => void;
  notice: string;
  togglePlay: () => void;
  restart: () => void;
  leave: () => void;
  exit?: Exit;
  children: React.ReactNode;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const reduced = useReducedMotion();
  const { height, width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const stageHeight = Math.max(310, Math.min(550, height * 0.605));
  const ringSize = Math.min(350, width * 0.86, stageHeight * 0.85);
  const elapsed = Math.floor(elapsedMs / 1000);
  const scale = useRef(new Animated.Value(1)).current;
  const breathProgress = rhythm?.progress;
  useEffect(() => {
    if (reduced || !started) {
      scale.setValue(1);
      return;
    }
    if (breathProgress === undefined) return;
    const animation = Animated.timing(scale, {
      toValue: 0.96 + breathProgress * 0.12,
      duration: 245,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [breathProgress, reduced, scale, started]);

  const phase = running
    ? (rhythm?.phase ?? position.step.title)
    : started
      ? "Paused"
      : "Ready to begin";
  const seconds = running
    ? (rhythm?.remaining ?? position.stepRemaining)
    : undefined;
  const playLabel = running
    ? "Pause practice"
    : started
      ? "Resume practice"
      : "Begin practice";
  const stageInk = dark ? "#F7ECF4" : "#422C53";
  const stageMuted = dark ? "#E5D2EE" : "#5F4B70";
  return (
    <Screen
      edgeToEdgeTop
      heroStatusBar={dark ? "light" : "dark"}
      style={{ paddingHorizontal: 0, paddingTop: top + 9 }}
    >
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <PlayerControl
          label="Close breathing practice"
          icon="close"
          onPress={leave}
        />
        <AppText
          variant="label"
          accessibilityRole="header"
          style={styles.headerTitle}
        >
          Breathing Practice
        </AppText>
        <AmbientSound
          compact
          environment={environment}
          running={running}
          enabled={sound}
          onToggle={toggleSound}
        />
      </View>
      <View style={[styles.stage, { minHeight: stageHeight }]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              dark
                ? `linear-gradient(180deg, ${colors.bg} 0%, #2A2045 40%, #322649 55%, #49325A 72%, ${colors.bg} 100%)`
                : `linear-gradient(180deg, ${colors.bg} 0%, #EDDCF2 38%, #E5CFE9 55%, #E2C9E5 65%, ${colors.bg} 100%)`,
            ),
          ]}
        />
        <View pointerEvents="none" style={styles.landscape}>
          {environment === "twilight" ? (
            <Image
              accessible={false}
              source={require("../../assets/today-twilight-lotus.jpg")}
              style={coverImageStyle}
              resizeMode="cover"
              fadeDuration={0}
            />
          ) : (
            <EnvironmentScene
              environment={environment}
              active={running}
              style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
            />
          )}
          <View
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                dark
                  ? `linear-gradient(180deg, #322649 0%, #32264900 39%, #1814260A 68%, ${colors.bg} 100%)`
                  : `linear-gradient(180deg, #E5CFE9 0%, #E5CFE94D 32%, #E5CFE912 64%, ${colors.bg} 100%)`,
              ),
            ]}
          />
        </View>
        <View
          style={[
            styles.phaseWrap,
            { paddingBottom: Math.max(44, stageHeight * 0.16) },
          ]}
        >
          <Animated.Image
            pointerEvents="none"
            accessible={false}
            source={require("../../assets/guided-breath-rings.png")}
            resizeMode="contain"
            fadeDuration={0}
            style={{
              position: "absolute",
              width: ringSize,
              height: ringSize,
              transform: [{ scale }],
            }}
          />
          <View style={[styles.phaseCopy, { width: ringSize * 0.62 }]}>
            <AppText
              variant="heading"
              accessibilityLiveRegion="polite"
              color={stageInk}
              style={styles.phase}
            >
              {phase}
            </AppText>
            <AppText color={stageMuted} style={styles.seconds}>
              {seconds === undefined
                ? started
                  ? "Your time is kept"
                  : "At your own pace"
                : `${seconds} ${seconds === 1 ? "second" : "seconds"}`}
            </AppText>
          </View>
        </View>
      </View>
      <View style={[styles.transport, { paddingHorizontal: gutter }]}>
        <View style={styles.controls}>
          <PlayerControl
            label="Restart"
            icon="refresh-outline"
            disabled={!started}
            onPress={restart}
          />
          <PlayerControl
            label={playLabel}
            icon={running ? "pause" : "play"}
            primary
            onPress={togglePlay}
          />
          <PlayerControl label="Stop practice" icon="stop" onPress={leave} />
        </View>
        <AppText variant="caption" style={styles.centered}>
          {position.index + 1} of {activity.steps.length} · {activity.title}
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Moment progress"
          aria-valuemin={0}
          aria-valuemax={activity.durationSec}
          aria-valuenow={elapsed}
          aria-valuetext={`${elapsed} of ${activity.durationSec} seconds`}
          style={[styles.progress, { backgroundColor: colors.border }]}
        >
          <View
            style={{
              height: "100%",
              width: `${(elapsedMs / (activity.durationSec * 1000)) * 100}%`,
              backgroundColor: colors.lavender,
            }}
          />
        </View>
        <AppText variant="caption" color={colors.muted} style={styles.centered}>
          {momentClockText(elapsed)} / {momentClockText(activity.durationSec)}
        </AppText>
        {!!notice && (
          <AppText
            variant="caption"
            accessibilityLiveRegion="polite"
            style={styles.centered}
          >
            {notice}
          </AppText>
        )}
        <AppText
          variant="caption"
          color={colors.muted}
          style={[styles.centered, { marginTop: 6 }]}
        >
          {position.step.instruction}
        </AppText>
        {children}
      </View>
      <Modal
        visible={!!exit}
        transparent
        animationType="none"
        onRequestClose={exit?.dismiss}
      >
        {!!exit && (
          <View
            style={[
              styles.modal,
              { backgroundColor: colors.overlay, padding: gutter },
            ]}
          >
            <View
              style={[
                styles.exitCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText variant="heading" accessibilityRole="header">
                Leave this Moment?
              </AppText>
              <AppText color={colors.muted}>
                Your pause is stopped. Leaving won’t record this as a completed
                Moment.
              </AppText>
              <Button
                title={exit.resume ? "Keep going" : "Return to Moment"}
                onPress={exit.dismiss}
              />
              <Button
                title="Leave without saving"
                variant="ghost"
                onPress={exit.confirm}
              />
            </View>
          </View>
        )}
      </Modal>
    </Screen>
  );
}

function PlayerControl({
  label,
  icon,
  disabled,
  primary,
  onPress,
}: {
  label: string;
  icon: string;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        primary && styles.mainCircle,
        {
          backgroundColor: primary ? colors.lavenderSurface : colors.surface,
          borderColor: primary ? colors.lavender : colors.border,
        },
        (disabled || pressed) && { opacity: disabled ? 0.42 : 0.7 },
      ]}
    >
      <Icon
        name={icon}
        size={primary ? 24 : 19}
        color={primary ? colors.lavenderText : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, zIndex: 1 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, lineHeight: 23 },
  stage: { justifyContent: "center", overflow: "hidden" },
  landscape: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
    overflow: "hidden",
  },
  phaseWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseCopy: { alignItems: "center", paddingHorizontal: 4 },
  phase: {
    textAlign: "center",
    fontSize: 30,
    lineHeight: Platform.OS === "android" ? 37 : 34,
  },
  seconds: { textAlign: "center", fontVariant: ["tabular-nums"], marginTop: 1 },
  transport: { alignItems: "stretch", gap: 8, paddingTop: 2 },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    marginBottom: 5,
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  mainCircle: { width: 65, height: 65, borderRadius: 33 },
  centered: { textAlign: "center" },
  progress: {
    alignSelf: "center",
    width: "54%",
    maxWidth: 225,
    height: 3,
    overflow: "hidden",
    borderRadius: 2,
  },
  modal: { flex: 1, justifyContent: "center", alignItems: "center" },
  exitCard: {
    width: "100%",
    maxWidth: 390,
    padding: 18,
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
});
