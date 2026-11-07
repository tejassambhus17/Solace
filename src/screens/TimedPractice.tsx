import React, { useRef } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  getTimedPractice,
  isTimedPracticeDuration,
  isTimedPracticeFocus,
  timedPracticeDurations,
  timedPracticeFocuses,
} from "../../server/src/timed-practice-contract";
import { spacing, useScreenGutter } from "../layout";
import { momentClockText } from "../moments";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Icon, Screen, coverImageStyle } from "../ui";
import { ExploreFeatureHeader } from "./ExploreFeatureHeader";

const focusOptions = {
  calm: {
    label: "Calm",
    hint: "Slow down and relax",
    icon: "flower-outline",
    artwork: require("../../assets/redesign-explore-breathe.jpg"),
  },
  focus: {
    label: "Focus",
    hint: "Clear your mind",
    icon: "locate-outline",
    artwork: require("../../assets/redesign-explore-ground.jpg"),
  },
  sleep: {
    label: "Sleep",
    hint: "Prepare for rest",
    icon: "moon-outline",
    artwork: require("../../assets/redesign-explore-sleep.jpg"),
  },
  energy: {
    label: "Energy",
    hint: "Feel more refreshed",
    icon: "flash-outline",
    artwork: require("../../assets/today-explore-guided.jpg"),
  },
} as const;

function PracticeSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionIntro}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} color={colors.sageText} size={21} />
        </View>
        <View style={styles.copy}>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="caption" color={colors.muted}>
            {subtitle}
          </AppText>
        </View>
      </View>
      {children}
    </View>
  );
}

export function TimedPracticeScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const availableWidth = Math.min(width, 480) - gutter * 2;
  const focus = isTimedPracticeFocus(app.params.focus)
    ? app.params.focus
    : "calm";
  const minutes = isTimedPracticeDuration(app.params.minutes)
    ? app.params.minutes
    : 5;
  const activity = getTimedPractice(focus, minutes);
  const chosenFocus = focusOptions[focus];
  const fourFocuses = availableWidth >= 340 && fontScale <= 1.12;
  const fourDurations = availableWidth >= 296 && fontScale <= 1.2;
  const inlinePreview =
    availableWidth >= 336 && fontScale <= 1.12 && minutes === 5;
  const focusRows = fourFocuses
    ? [timedPracticeFocuses]
    : [timedPracticeFocuses.slice(0, 2), timedPracticeFocuses.slice(2)];
  const durationRows = fourDurations
    ? [timedPracticeDurations]
    : [timedPracticeDurations.slice(0, 2), timedPracticeDurations.slice(2)];
  const dark = resolved === "dark";
  const selectedFill = dark ? colors.lavenderSurface : colors.primary;
  const selectedInk = dark ? colors.lavenderText : colors.primaryText;
  const selectedBorder = dark ? colors.lavender : colors.primary;
  const startLock = useRef(false);

  function start() {
    if (startLock.current) return;
    startLock.current = true;
    app.navigate(routes.momentPlayer, {
      activity,
      provider: "offline",
      source: "explore",
      timedPractice: true,
    });
  }

  const artwork = (
    <View
      pointerEvents="none"
      style={[
        styles.thumbnail,
        inlinePreview && styles.inlineThumbnail,
        { backgroundColor: colors.sageSurface },
      ]}
    >
      <Icon name={chosenFocus.icon} color={colors.sageText} size={24} />
      <Image
        source={chosenFocus.artwork}
        style={coverImageStyle}
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
  const summary = (
    <View style={styles.copy}>
      <AppText variant="heading" style={styles.previewTitle}>
        {activity.title}
      </AppText>
      <AppText variant="label" color={colors.sageText}>
        {minutes} minutes · {chosenFocus.label}
      </AppText>
      <AppText variant="caption" color={colors.muted}>
        {activity.description}
      </AppText>
    </View>
  );
  const timeline = (
    <View style={styles.timeline}>
      {activity.steps.map((step, index) => (
        <View
          key={step.title}
          style={styles.step}
          testID={`timed-practice-step-${index}`}
        >
          <View style={styles.marker} pointerEvents="none" aria-hidden>
            {index < activity.steps.length - 1 && (
              <View style={[styles.stem, { backgroundColor: colors.border }]} />
            )}
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.sageText,
                  borderColor: colors.sageSurface,
                },
              ]}
            />
          </View>
          <AppText variant="caption" style={styles.stepTitle}>
            {step.title}
          </AppText>
          <AppText variant="caption" style={styles.stepTime}>
            {momentClockText(step.durationSec)}
          </AppText>
        </View>
      ))}
    </View>
  );

  return (
    <Screen edgeToEdgeTop style={styles.screen}>
      <ExploreFeatureHeader
        title="Build a Timed Practice"
        subtitle="Create a focused, guided session that fits your time and need."
        onBack={app.back}
      />
      <View style={[styles.content, { paddingHorizontal: gutter }]}>
        <PracticeSection
          title="Choose your focus"
          subtitle="What do you need most right now?"
          icon="leaf-outline"
        >
          <View
            style={styles.grid}
            accessibilityRole="radiogroup"
            accessibilityLabel="Practice focus"
          >
            {focusRows.map((row) => (
              <View style={styles.row} key={row[0]}>
                {row.map((value) => {
                  const option = focusOptions[value];
                  const selected = value === focus;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityHint={option.hint}
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => app.setParams({ focus: value })}
                      style={({ pressed }) => [
                        styles.focusOption,
                        fourFocuses && styles.smallFocusOption,
                        {
                          backgroundColor: selected
                            ? selectedFill
                            : colors.surface,
                          borderColor: selected
                            ? selectedBorder
                            : colors.border,
                          opacity: pressed ? 0.78 : 1,
                        },
                      ]}
                    >
                      {selected && (
                        <View
                          style={[
                            styles.check,
                            { backgroundColor: selectedInk },
                          ]}
                        >
                          <Icon
                            name="checkmark"
                            color={selectedFill}
                            size={12}
                          />
                        </View>
                      )}
                      <Icon
                        name={option.icon}
                        size={25}
                        color={selected ? selectedInk : colors.sageText}
                      />
                      <AppText
                        variant="label"
                        color={selected ? selectedInk : colors.text}
                        style={styles.centered}
                      >
                        {option.label}
                      </AppText>
                      <AppText
                        variant="caption"
                        color={selected ? selectedInk : colors.muted}
                        style={styles.centered}
                      >
                        {option.hint}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </PracticeSection>

        <PracticeSection
          title="Set duration"
          subtitle="How much time do you have?"
          icon="time-outline"
        >
          <View
            style={styles.grid}
            accessibilityRole="radiogroup"
            accessibilityLabel="Practice duration"
          >
            {durationRows.map((row) => (
              <View style={styles.row} key={row[0]}>
                {row.map((value) => {
                  const selected = value === minutes;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={`${value} min`}
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => app.setParams({ minutes: value })}
                      style={({ pressed }) => [
                        styles.durationOption,
                        {
                          backgroundColor: selected
                            ? selectedFill
                            : colors.surface,
                          borderColor: selected
                            ? selectedBorder
                            : colors.border,
                          opacity: pressed ? 0.78 : 1,
                        },
                      ]}
                    >
                      <AppText
                        variant="label"
                        color={selected ? selectedInk : colors.text}
                        style={styles.centered}
                      >
                        {value} min
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </PracticeSection>

        <PracticeSection
          title="Session preview"
          subtitle="Here’s how your practice will flow."
          icon="layers-outline"
        >
          <View
            testID="timed-practice-preview"
            style={[
              styles.preview,
              inlinePreview && styles.inlinePreview,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {inlinePreview ? (
              <>
                {artwork}
                <View style={styles.previewCopy}>
                  {summary}
                  {timeline}
                </View>
              </>
            ) : (
              <>
                <View style={styles.previewIntro}>
                  {artwork}
                  {summary}
                </View>
                {timeline}
              </>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start Practice"
            onPress={start}
            style={({ pressed }) => [
              styles.start,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Icon name="play" size={16} color={colors.primaryText} />
            <AppText
              variant="label"
              color={colors.primaryText}
              style={styles.startText}
            >
              Start Practice
            </AppText>
          </Pressable>
        </PracticeSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  content: { gap: spacing.section },
  section: { gap: spacing.row },
  sectionIntro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.compact,
  },
  sectionIcon: { paddingTop: 5 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  grid: { gap: spacing.compact },
  row: { flexDirection: "row", alignItems: "stretch", gap: spacing.compact },
  focusOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 104,
    paddingHorizontal: spacing.compact,
    paddingTop: spacing.card,
    paddingBottom: spacing.row,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  smallFocusOption: { minHeight: 120, paddingHorizontal: 5 },
  centered: { textAlign: "center" },
  check: {
    position: "absolute",
    top: 6,
    right: 6,
    height: 16,
    width: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  durationOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 4,
    paddingVertical: spacing.compact,
    borderWidth: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.row,
    gap: spacing.row,
  },
  inlinePreview: { flexDirection: "row" },
  previewIntro: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  previewCopy: { flex: 1, minWidth: 0, gap: spacing.compact },
  previewTitle: { fontSize: 23, lineHeight: 28 },
  thumbnail: {
    width: 66,
    height: 78,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineThumbnail: {
    width: 86,
    height: "auto",
    minHeight: 116,
    alignSelf: "stretch",
  },
  timeline: { alignSelf: "stretch" },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.compact,
    minHeight: 28,
  },
  marker: { width: 14, alignSelf: "stretch", alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  stem: { position: "absolute", width: 1, top: 12, bottom: -6 },
  stepTitle: { flex: 1, minWidth: 0, paddingBottom: 4 },
  stepTime: { fontVariant: ["tabular-nums"], flexShrink: 0 },
  start: {
    flexDirection: "row",
    gap: spacing.compact,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.row,
    minHeight: 52,
    borderRadius: 28,
  },
  startText: {
    textAlign: "center",
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
  },
});
