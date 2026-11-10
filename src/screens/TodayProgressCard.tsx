import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useReducedMotion } from "../Companion";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import {
  buildTodayProgress,
  type ProgressCount,
  type TodayPauseProgress,
} from "../today-progress";
import { AppText, Card, Icon } from "../ui";

function OverallRing({
  percentage,
  size,
  ink,
  track,
}: {
  percentage: number;
  size: number;
  ink: string;
  track: string;
}) {
  const { colors, resolved } = useTheme();
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(percentage));
  const previous = useRef(percentage);
  useEffect(() => {
    const changed = previous.current !== percentage;
    previous.current = percentage;
    if (!changed || reducedMotion) {
      progress.setValue(percentage);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: percentage,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [percentage, progress, reducedMotion]);

  const arc = { width: size, height: size, borderRadius: size / 2 };
  // Each clip shows at most a semicircle. Clamped rotation fills the right half
  // before starting the left, so updates can run on the native animation driver.
  const rightTurn = progress.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ["-45deg", "135deg", "135deg"],
    extrapolate: "clamp",
  });
  const leftTurn = progress.interpolate({
    inputRange: [0, 50, 100],
    outputRange: ["135deg", "135deg", "315deg"],
    extrapolate: "clamp",
  });
  const hideEmptyArc = resolved === "light" && percentage === 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Overall progress today"
      accessibilityValue={{ min: 0, max: 100, now: percentage }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      style={[
        styles.ring,
        arc,
        resolved === "light" && { backgroundColor: colors.lavenderSurface },
      ]}
    >
      <View aria-hidden style={[styles.arc, arc, { borderColor: track }]} />
      <View
        aria-hidden
        style={[
          styles.half,
          { width: size / 2, left: size / 2 },
          hideEmptyArc && styles.hiddenArc,
        ]}
      >
        <Animated.View
          style={[
            styles.arc,
            arc,
            {
              left: -size / 2,
              borderTopColor: ink,
              borderLeftColor: ink,
              transform: [{ rotate: rightTurn }],
            },
          ]}
        />
      </View>
      <View
        aria-hidden
        style={[
          styles.half,
          { width: size / 2 },
          hideEmptyArc && styles.hiddenArc,
        ]}
      >
        <Animated.View
          style={[
            styles.arc,
            arc,
            {
              borderTopColor: ink,
              borderLeftColor: ink,
              transform: [{ rotate: leftTurn }],
            },
          ]}
        />
      </View>
      <AppText
        variant="label"
        aria-hidden
        color={resolved === "light" ? ink : undefined}
        style={styles.ringValue}
      >
        {percentage}%
      </AppText>
      <AppText variant="caption" aria-hidden color={colors.muted}>
        Overall
      </AppText>
    </View>
  );
}

function ProgressRow({
  label,
  icon,
  count,
  empty,
  ink,
  track,
}: {
  label: string;
  icon: string;
  count: ProgressCount;
  empty: string;
  ink: string;
  track: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.progressRow}>
      <View style={styles.rowHeading}>
        <View style={styles.rowTitle}>
          <Icon name={icon} color={ink} size={16} />
          <AppText variant="label" style={styles.wrap}>
            {label}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.muted} style={styles.count}>
          {count.scheduled ? `${count.completed} of ${count.scheduled}` : empty}
        </AppText>
      </View>
      {count.scheduled > 0 && (
        <View aria-hidden style={[styles.track, { backgroundColor: track }]}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: ink,
                width: `${(count.completed / count.scheduled) * 100}%`,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

export function TodayProgressCard({
  routine,
  habits,
  onViewDetails,
  loading = false,
  error = false,
  compactLayout = false,
}: {
  routine: TodayPauseProgress;
  habits: ProgressCount;
  onViewDetails: () => void;
  loading?: boolean;
  error?: boolean;
  compactLayout?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const dark = resolved === "dark";
  const { dailyPause, percentage } = buildTodayProgress(routine, habits);
  const stack = width < 330 || fontScale > 1.35;
  const track = dark ? colors.lavender + "34" : colors.heroBorder;
  const pauseInk = dark ? colors.lavender : colors.accent;
  const habitInk = dark ? colors.sageText : colors.lavenderText;
  return (
    <Card
      style={[
        styles.card,
        compactLayout && styles.compactCard,
        {
          backgroundColor: dark ? colors.lavenderSurface : colors.surface,
          borderColor: dark ? colors.lavender + "42" : colors.heroBorder,
        },
      ]}
    >
      <View style={styles.header}>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.title}
        >
          Today’s Progress
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View today's progress details"
          onPress={onViewDetails}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <AppText
            variant="label"
            color={colors.lavenderText}
            style={styles.wrap}
          >
            View Details
          </AppText>
          <Icon name="chevron-forward" color={colors.lavenderText} size={15} />
        </Pressable>
      </View>
      <AppText variant="caption" color={colors.muted}>
        Your daily pause and habits at a glance.
      </AppText>
      {loading ? (
        <View style={styles.feedback}>
          <ActivityIndicator size="small" color={pauseInk} />
          <AppText accessibilityLiveRegion="polite" color={colors.muted}>
            Loading today’s progress…
          </AppText>
        </View>
      ) : error ? (
        <AppText
          accessibilityRole="alert"
          color={colors.danger}
          style={styles.feedbackText}
        >
          Today’s progress couldn’t be loaded.
        </AppText>
      ) : (
        <View
          style={[
            styles.body,
            compactLayout && styles.compactBody,
            stack && styles.stacked,
          ]}
        >
          <View
            style={[
              styles.metrics,
              stack ? styles.fullWidth : styles.fillWidth,
            ]}
          >
            <ProgressRow
              label="Daily Pause"
              icon="moon-outline"
              count={dailyPause}
              empty={routine.settings.enabled ? "No steps due" : "Off"}
              ink={pauseInk}
              track={track}
            />
            <ProgressRow
              label="Habits"
              icon="leaf-outline"
              count={habits}
              empty="None scheduled"
              ink={habitInk}
              track={track}
            />
            {percentage === null && (
              <AppText variant="caption" color={colors.muted}>
                No daily targets today. Take things at your own pace.
              </AppText>
            )}
          </View>
          {percentage !== null && (
            <OverallRing
              percentage={percentage}
              size={Math.max(
                76,
                Math.min(stack ? 176 : 108, Math.round(80 * fontScale)),
              )}
              ink={pauseInk}
              track={track}
            />
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.card },
  compactCard: { paddingVertical: spacing.row + 1 },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: spacing.compact,
  },
  title: { flexShrink: 1, minWidth: 0 },
  link: {
    minHeight: 44,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  pressed: { opacity: 0.68 },
  wrap: { flexShrink: 1, minWidth: 0 },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.card,
    marginTop: spacing.card,
  },
  compactBody: { marginTop: spacing.compact },
  stacked: { flexDirection: "column" },
  metrics: { minWidth: 0, gap: spacing.row },
  fillWidth: { flex: 1 },
  fullWidth: { alignSelf: "stretch" },
  progressRow: { gap: 5 },
  rowHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: spacing.compact,
  },
  rowTitle: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 5,
  },
  count: { flexShrink: 1, fontVariant: ["tabular-nums"] },
  track: { height: 5, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    marginTop: spacing.row,
  },
  feedbackText: { marginTop: spacing.row },
  ring: { flexShrink: 0, alignItems: "center", justifyContent: "center" },
  ringValue: { fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  arc: {
    position: "absolute",
    left: 0,
    top: 0,
    borderWidth: 5,
    borderColor: "transparent",
  },
  half: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  hiddenArc: { opacity: 0 },
});
