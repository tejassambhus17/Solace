import React, { useCallback, useMemo, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { SolaceMoment } from "../../server/src/moment-contract";
import { AmbientSound } from "../AmbientSound";
import { EnvironmentScene } from "../Environment";
import { spacing, useScreenGutter } from "../layout";
import {
  momentClockText,
  type momentBreathingPosition,
  type momentPosition,
  type MomentEnvironment,
} from "../moments";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  Button,
  coverImageStyle,
  Icon,
  useNavigationInset,
} from "../ui";
import { GuidedEnvironmentSelector } from "./MomentEnvironmentPicker";

type Exit = { resume: boolean; dismiss: () => void; confirm: () => void };

const RING_ART = require("../../assets/guided-breath-rings.png");
const TWILIGHT_ART = require("../../assets/today-twilight-lotus.jpg");
const DAYLIGHT_ART = require("../../assets/redesign-explore-scene-light.jpg");

export function GuidedBreathingPlayer({
  activity,
  position,
  rhythm,
  breathingMotion,
  elapsedMs,
  environment,
  soundEnvironment,
  running,
  started,
  sound,
  toggleSound,
  notice,
  togglePlay,
  restart,
  leave,
  exit,
  onEnvironmentChange,
}: {
  activity: SolaceMoment;
  position: ReturnType<typeof momentPosition>;
  rhythm: ReturnType<typeof momentBreathingPosition>;
  breathingMotion: Animated.Value;
  elapsedMs: number;
  environment: MomentEnvironment;
  soundEnvironment: MomentEnvironment;
  running: boolean;
  started: boolean;
  sound: boolean;
  toggleSound: () => void;
  notice: string;
  togglePlay: () => void;
  restart: () => void;
  leave: () => void;
  exit?: Exit;
  onEnvironmentChange: (environment: MomentEnvironment) => void;
}) {
  const { colors } = useTheme();
  const { fontScale, height, width } = useWindowDimensions();
  const { bottom, left, right, top } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const extraBottom = Math.max(0, useNavigationInset() - bottom);
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const measureViewport = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      const next = {
        height: Math.round(layout.height),
        width: Math.round(layout.width),
      };
      setViewport((current) =>
        current.height === next.height && current.width === next.width
          ? current
          : next,
      );
    },
    [],
  );
  const usableHeight =
    viewport.height || Math.max(0, height - top - bottom - 48);
  const usableWidth = viewport.width || Math.max(0, width - left - right);
  const compact = usableHeight < 560;
  const artworkSpace = Math.min(64, Math.max(0, usableHeight - 640) * 0.32);
  const ringSize = Math.round(
    Math.min(258, usableWidth * 0.61, Math.max(92, usableHeight * 0.39)),
  );
  // Very large text uses its own space beneath the ring instead of covering it.
  const phaseInsideRing = fontScale <= 1.25 && ringSize >= 138;
  const elapsed = Math.floor(elapsedMs / 1000);
  const cueSeconds = rhythm?.remaining ?? position.stepRemaining;
  const phase = running
    ? (rhythm?.phase ?? "Follow along")
    : started
      ? "Paused"
      : "Ready to begin";
  const secondsText = `${cueSeconds} ${cueSeconds === 1 ? "second" : "seconds"}`;
  const phaseDetail = running
    ? secondsText
    : !started
      ? `${activity.durationSec / 60} min · Timed`
      : rhythm
        ? `${rhythm.phase} · ${cueSeconds}s`
        : `${cueSeconds}s in this step`;
  const phaseDetailLabel =
    started && !running
      ? `${rhythm ? `${rhythm.phase}, ` : ""}${secondsText} remaining`
      : undefined;
  const playLabel = running
    ? "Pause practice"
    : started
      ? "Resume practice"
      : "Begin practice";
  const progressText = `${elapsed} of ${activity.durationSec} seconds`;
  const scale = useMemo(
    () =>
      breathingMotion.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1.08],
      }),
    [breathingMotion],
  );
  const phaseCopy = (
    <View
      style={[
        styles.phaseCopy,
        phaseInsideRing && { maxWidth: ringSize * 0.6 },
      ]}
    >
      <AppText
        variant="heading"
        accessibilityLiveRegion="polite"
        style={[styles.phase, compact && styles.compactPhase]}
      >
        {phase}
      </AppText>
      <AppText
        variant="caption"
        color={colors.muted}
        accessibilityLabel={phaseDetailLabel}
        style={styles.timeText}
      >
        {phaseDetail}
      </AppText>
    </View>
  );

  return (
    <View style={[styles.frame, { backgroundColor: colors.bg }]}>
      <PracticeBackdrop environment={environment} running={running} />
      <SafeAreaView style={styles.frame}>
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <PlayerControl
            label="Close breathing practice"
            icon="close"
            onPress={leave}
          />
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {activity.title}
          </AppText>
          <View style={styles.sound}>
            <AmbientSound
              compact
              environment={soundEnvironment}
              running={running}
              enabled={sound}
              onToggle={toggleSound}
            />
          </View>
        </View>
        <ScrollView
          onLayout={measureViewport}
          bounces={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          style={styles.frame}
          contentContainerStyle={[
            styles.scroller,
            {
              paddingHorizontal: gutter,
              paddingTop: compact ? spacing.compact : spacing.row,
              paddingBottom:
                extraBottom +
                (compact
                  ? spacing.compact
                  : Math.min(64, usableHeight * 0.085) + artworkSpace),
            },
          ]}
        >
          <View
            style={[
              styles.practice,
              { gap: compact ? spacing.compact : spacing.row },
            ]}
          >
            <View style={styles.stage}>
              <View
                style={[
                  styles.ringPlate,
                  { minHeight: Math.ceil(ringSize * 1.1) },
                ]}
              >
                <Animated.Image
                  pointerEvents="none"
                  accessible={false}
                  source={RING_ART}
                  resizeMode="contain"
                  fadeDuration={0}
                  testID="guided-breathing-ring"
                  style={[
                    styles.ring,
                    {
                      width: ringSize,
                      height: ringSize,
                      transform: [{ scale }],
                    },
                  ]}
                />
                {phaseInsideRing && phaseCopy}
              </View>
              {!phaseInsideRing && phaseCopy}
            </View>
            <View style={styles.timer}>
              <View style={styles.timerLabels}>
                <AppText variant="label" color={colors.lavenderText}>
                  Step {position.index + 1} of {activity.steps.length}
                </AppText>
                <AppText variant="caption" style={styles.timeText}>
                  {momentClockText(elapsed)} /{" "}
                  {momentClockText(activity.durationSec)}
                </AppText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Moment progress"
                accessibilityValue={{
                  min: 0,
                  max: activity.durationSec,
                  now: elapsed,
                  text: progressText,
                }}
                aria-valuemin={0}
                aria-valuemax={activity.durationSec}
                aria-valuenow={elapsed}
                aria-valuetext={progressText}
                style={styles.progress}
              >
                {activity.steps.map((step, index) => (
                  <View
                    aria-hidden
                    key={index}
                    style={[
                      styles.progressSegment,
                      {
                        flex: step.durationSec,
                        backgroundColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${index < position.index ? 100 : index > position.index ? 0 : Math.max(0, (1 - position.stepRemaining / step.durationSec) * 100)}%`,
                        backgroundColor: colors.lavenderText,
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
            <View
              style={[
                styles.guidance,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.guidanceCopy}>
                <AppText variant="heading">{position.step.title}</AppText>
                <AppText color={colors.muted}>
                  {position.step.instruction}
                </AppText>
                {!!notice && (
                  <AppText
                    color={colors.lavenderText}
                    variant="caption"
                    accessibilityLiveRegion="polite"
                  >
                    {notice}
                  </AppText>
                )}
              </View>
            </View>
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
              <PlayerControl
                label="Stop practice"
                icon="stop"
                onPress={leave}
              />
            </View>
            <GuidedEnvironmentSelector
              value={environment}
              soundEnvironment={soundEnvironment}
              onChange={onEnvironmentChange}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={!!exit}
        transparent
        animationType="none"
        onRequestClose={exit?.dismiss}
      >
        {!!exit && (
          <ScrollView
            style={{ backgroundColor: colors.overlay }}
            contentContainerStyle={[
              styles.modal,
              {
                paddingHorizontal: Math.max(gutter, left, right),
                paddingTop: Math.max(gutter, top),
                paddingBottom: Math.max(gutter, bottom),
              },
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
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const PracticeBackdrop = React.memo(function PracticeBackdrop({
  environment,
  running,
}: {
  environment: MomentEnvironment;
  running: boolean;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          artGradient(
            dark
              ? `linear-gradient(180deg, ${colors.bg} 0%, #2A2045 35%, #322649 65%, ${colors.bg} 100%)`
              : `linear-gradient(180deg, ${colors.bg} 0%, #F1E8F7 34%, #ECE1F2 66%, ${colors.bg} 100%)`,
          ),
        ]}
      />
      {environment === "twilight" ? (
        <View style={[styles.landscape, !dark && styles.daylightLandscape]}>
          <Image
            accessible={false}
            source={dark ? TWILIGHT_ART : DAYLIGHT_ART}
            style={coverImageStyle}
            resizeMode={dark ? "contain" : "cover"}
            resizeMethod={dark ? undefined : "scale"}
            fadeDuration={0}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                dark
                  ? "linear-gradient(180deg, #302445 0%, #3024451A 43%, #16112044 100%)"
                  : "linear-gradient(180deg, #ECE1F2 0%, #ECE1F2D9 13%, #ECE1F226 42%, transparent 68%)",
              ),
            ]}
          />
        </View>
      ) : (
        <>
          <View style={StyleSheet.absoluteFill}>
            <EnvironmentScene
              environment={environment}
              active={running}
              style={styles.scene}
            />
          </View>
          <View
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                `linear-gradient(180deg, ${colors.bg}CC 0%, ${colors.bg}86 48%, ${colors.bg}AF 100%)`,
              ),
            ]}
          />
        </>
      )}
    </View>
  );
});

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
  const { colors, resolved } = useTheme();
  const light = resolved === "light";
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
          backgroundColor: primary
            ? light
              ? colors.primary
              : colors.lavenderSurface
            : colors.surface,
          borderColor: primary
            ? light
              ? colors.accent
              : colors.lavender
            : colors.border,
        },
        (disabled || pressed) && { opacity: disabled ? 0.42 : 0.7 },
      ]}
    >
      <Icon
        name={icon}
        size={primary ? 24 : 19}
        color={primary && !light ? colors.lavenderText : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: spacing.compact,
    zIndex: 1,
  },
  headerTitle: { flex: 1, textAlign: "center" },
  sound: { width: 48, alignItems: "center" },
  scroller: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  practice: { width: "100%", maxWidth: 370 },
  landscape: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    aspectRatio: 1100 / 591,
  },
  daylightLandscape: { aspectRatio: 1040 / 518 },
  scene: { flex: 1, minHeight: 0, borderRadius: 0 },
  stage: { gap: spacing.compact, alignItems: "center" },
  ringPlate: { width: "100%", justifyContent: "center", alignItems: "center" },
  ring: { position: "absolute" },
  phaseCopy: { alignItems: "center" },
  phase: {
    textAlign: "center",
    fontSize: 25,
    lineHeight: Platform.OS === "android" ? 31 : 28,
  },
  compactPhase: {
    fontSize: 22,
    lineHeight: Platform.OS === "android" ? 28 : 25,
  },
  guidance: { borderWidth: 1, borderRadius: 16, padding: spacing.row },
  guidanceCopy: { gap: 3 },
  timeText: { textAlign: "center", fontVariant: ["tabular-nums"] },
  timer: { gap: spacing.compact, paddingHorizontal: spacing.compact },
  timerLabels: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.compact,
  },
  progress: {
    width: "100%",
    height: 5,
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    height: "100%",
    overflow: "hidden",
    borderRadius: 3,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.card,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  mainCircle: { width: 58, height: 58, borderRadius: 29 },
  modal: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  exitCard: {
    width: "100%",
    maxWidth: 390,
    padding: 18,
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
});
