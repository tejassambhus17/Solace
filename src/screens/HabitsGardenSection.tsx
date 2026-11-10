import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { currentGardenIntention } from "../../server/src/garden-contract";
import {
  habitGardenStages,
  habitInsights,
  habitWeekStart,
  type Habit,
} from "../../server/src/habit-contract";
import {
  GardenScene,
  gardenLabels,
  habitToday,
  useHabitClock,
} from "../habits-ui";
import { spacing } from "../layout";
import { EditorialSection } from "../NestedDesign";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, BotanicalBackdrop, Button, Card, Icon, Row } from "../ui";
import {
  GardenGrowthDetails,
  GardenIntentionCard,
} from "./GardenIntentionCard";

const stageIcons = [
  "ellipse-outline",
  "leaf-outline",
  "git-branch-outline",
  "flower-outline",
  "flower",
] as const;
const noHabits: Habit[] = [];
const earnedStages = habitGardenStages.filter(({ minimum }) => minimum > 0);

export function HabitsGardenSection({
  onBackToToday,
  active,
}: {
  onBackToToday: () => void;
  active: boolean;
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const peachInk = dark ? colors.peach : colors.peachText;
  const milestoneInk = dark ? colors.lavender : colors.accent;
  const stageInk = dark ? colors.sageText : colors.accent;
  const { width, fontScale } = useWindowDimensions();
  const [showGrowth, setShowGrowth] = useState(false);
  const habits = app.data.habits;
  const intentions = app.data.gardenIntentions ?? [];
  const now = useHabitClock(
    active ? habits : noHabits,
    active ? intentions[0]?.timeZone : undefined,
  );
  const today = habitToday(undefined, now);
  const weekStart = habitWeekStart(today);
  const intention = currentGardenIntention(intentions, now);
  const weekly = useMemo(
    () =>
      habitInsights(
        active ? habits : noHabits,
        active ? app.data.habitProgress : [],
        weekStart,
        today,
        today,
        now,
      ),
    [active, habits, app.data.habitProgress, weekStart, today, now],
  );
  const garden = app.data.habitGarden[0];
  const stage = garden?.stage ?? "seed";
  const earned = garden?.earnedTotal ?? 0;
  const milestones = earnedStages.filter(
    ({ minimum }) => earned >= minimum,
  ).length;
  const total = earnedStages.length;
  const progress = Math.round((milestones * 100) / total);
  const next = habitGardenStages.find(({ minimum }) => minimum > earned);
  const nextMilestone = next
    ? `${next.minimum - earned} more ${next.minimum - earned === 1 ? "contribution" : "contributions"} to ${gardenLabels[next.stage].toLowerCase()}.`
    : "Your garden has reached its final stage.";
  const fixedSchedule = habits.some((habit) =>
    habit.revisions.some(
      ({ status, schedule }) =>
        status === "active" && schedule.type !== "weekly",
    ),
  );
  const stack = width < 340 || fontScale >= 1.45;
  const stats = [
    {
      icon: "calendar-outline",
      value: `${weekly.daysWithCompletion}/7`,
      label: "Days this week",
    },
    {
      icon: "flame-outline",
      value: fixedSchedule ? String(weekly.currentStreak) : "—",
      label: "Day streak",
    },
    {
      icon: "leaf-outline",
      value: String(habits.filter(({ status }) => status === "active").length),
      label: "Habits active",
    },
  ];

  return (
    <View style={styles.page}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View this week’s Garden growth"
        accessibilityState={{ expanded: showGrowth }}
        onPress={() => setShowGrowth((value) => !value)}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <GardenScene stage={stage} />
        </View>
      </Pressable>
      <View
        style={[
          styles.stageCaption,
          { backgroundColor: dark ? colors.sageSurface : colors.surface2 },
        ]}
      >
        <Row style={styles.progressRow}>
          <Icon name="leaf-outline" color={stageInk} size={24} />
          <View style={styles.copy}>
            <AppText variant="heading" accessibilityRole="header">
              {gardenLabels[stage]}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {milestones} of {total} milestones
            </AppText>
          </View>
          <View style={[styles.pill, { backgroundColor: colors.surface }]}>
            <AppText variant="label" color={stageInk}>
              {progress}%
            </AppText>
          </View>
        </Row>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Garden milestones"
          accessibilityValue={{ min: 0, max: total, now: milestones }}
          style={styles.segments}
        >
          {earnedStages.map((item, index) => (
            <View
              key={item.stage}
              aria-hidden
              style={[
                styles.segment,
                {
                  backgroundColor:
                    index < milestones ? milestoneInk : colors.border,
                },
              ]}
            />
          ))}
        </View>
        <Button
          title={
            showGrowth ? "Hide this week’s growth" : "See this week’s growth"
          }
          variant="secondary"
          icon="leaf-outline"
          onPress={() => setShowGrowth((value) => !value)}
        />
      </View>
      {showGrowth && (
        <GardenGrowthDetails
          intention={intention}
          weekStart={intention?.weekStart ?? weekStart}
        />
      )}
      <GardenIntentionCard
        intention={intention}
        nextMilestone={nextMilestone}
        now={now}
      />
      <View style={styles.stageList}>
        <EditorialSection title="The stages of growth" />
        {habitGardenStages.map((item, index) => {
          const current = item.stage === stage;
          const reached = earned >= item.minimum;
          const ink = current
            ? peachInk
            : reached
              ? colors.lavenderText
              : colors.muted;
          return (
            <View
              key={item.stage}
              accessible
              accessibilityLabel={`${gardenLabels[item.stage]}, ${current ? "current stage" : reached ? "reached" : `${item.minimum} contributions required`}`}
              style={[styles.timelineItem, { borderColor: colors.border }]}
            >
              <View
                aria-hidden
                style={[
                  styles.stageMarker,
                  {
                    borderColor: ink,
                    backgroundColor: reached
                      ? colors.lavenderSurface
                      : colors.surface,
                  },
                ]}
              >
                <Icon name={stageIcons[index]} color={ink} size={19} />
              </View>
              <View style={styles.copy}>
                <AppText
                  variant="label"
                  color={current ? colors.text : colors.muted}
                >
                  {gardenLabels[item.stage]}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {item.minimum === 0
                    ? "Starting stage"
                    : `${item.minimum} ${item.minimum === 1 ? "contribution" : "contributions"}`}
                </AppText>
              </View>
              {current && (
                <AppText variant="caption" color={colors.sageText}>
                  Current
                </AppText>
              )}
            </View>
          );
        })}
      </View>
      <Card style={[styles.card, styles.howCard]}>
        <BotanicalBackdrop />
        <Row style={styles.howRow}>
          <Icon name="sparkles-outline" color={peachInk} size={22} />
          <View style={styles.copy}>
            <AppText variant="heading">How it works</AppText>
            <AppText color={colors.muted} variant="caption">
              Completed habit days and saved activities that match your weekly
              intention grow your garden. Earned growth stays through pauses and
              missed days.
            </AppText>
          </View>
        </Row>
      </Card>
      <View
        style={[
          styles.stats,
          stack && styles.stackedStats,
          { borderColor: colors.border },
        ]}
      >
        {stats.map(({ icon, label, value }, index) => (
          <View
            key={label}
            style={[
              styles.stat,
              stack && styles.stackedStat,
              !stack &&
                index > 0 && { borderLeftWidth: 1, borderColor: colors.border },
            ]}
          >
            <Icon name={icon} color={peachInk} size={22} />
            <AppText variant="heading" color={colors.lavenderText}>
              {value}
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={styles.centered}
            >
              {label}
            </AppText>
          </View>
        ))}
      </View>
      <Button
        title="Back to Habits"
        icon="arrow-back-outline"
        onPress={onBackToToday}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.row },
  card: { padding: spacing.row, borderRadius: 18, gap: spacing.compact },
  stageCaption: { borderRadius: 16, padding: spacing.card, gap: spacing.row },
  stageList: { marginTop: spacing.compact },
  progressRow: { alignItems: "flex-start" },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  segments: { flexDirection: "row", gap: 4 },
  segment: { height: 9, borderRadius: 8, flex: 1 },
  timelineItem: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    paddingVertical: spacing.compact,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stageMarker: {
    height: 36,
    width: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { textAlign: "center" },
  howCard: { overflow: "hidden" },
  howRow: { alignItems: "flex-start" },
  stats: {
    flexDirection: "row",
    gap: 0,
    paddingVertical: spacing.row,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  stackedStats: { flexDirection: "column", gap: spacing.row },
  stackedStat: {
    flexDirection: "row",
    gap: spacing.compact,
    justifyContent: "center",
  },
});
