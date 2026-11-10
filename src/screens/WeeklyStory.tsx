import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { WeeklyFacts } from "../../server/src/weekly-facts";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Icon, Row } from "../ui";
import type { StoryPeriod } from "../weekly-story";

export function WeeklyStoryOverview({
  facts,
  goal,
  period,
}: {
  facts: WeeklyFacts;
  period?: StoryPeriod;
  goal?: {
    title: string;
    description: string;
    period: string;
    paused: boolean;
  };
}) {
  const { colors, resolved } = useTheme();
  const light = resolved === "light";
  const { width, fontScale } = useWindowDimensions();
  const start = period ? Date.parse(`${period.start}T12:00:00Z`) : NaN;
  const week = Number.isFinite(start)
    ? Array.from(
        { length: 7 },
        (_, index) => new Date(start + index * 86_400_000),
      )
    : [];
  const wrapDays = width < 300 || fontScale > 1.45;
  const metrics = [
    { label: "Check-in days", value: facts.days.length, icon: "leaf-outline" },
    {
      label: "Completed Moments",
      value: facts.completedSessions,
      icon: "flower-outline",
    },
    { label: "Mindful minutes", value: facts.minutes, icon: "time-outline" },
    {
      label: "Saved reflections",
      value: facts.reflections,
      icon: "create-outline",
    },
  ];

  return (
    <View style={styles.overview}>
      <AppText variant="heading" accessibilityRole="header">
        Your week in moments
      </AppText>
      {!!week.length && (
        <View
          style={[
            styles.footprint,
            { borderColor: colors.border },
            light && [
              styles.lightFootprint,
              { backgroundColor: colors.surface },
            ],
          ]}
        >
          <AppText variant="label">Mood check-ins</AppText>
          <View style={[styles.week, wrapDays && styles.wrapDays]}>
            {week.map((date) => {
              const iso = date.toISOString().slice(0, 10);
              const checked = facts.days.includes(iso);
              return (
                <View
                  key={iso}
                  accessible
                  accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}, ${checked ? "check-in recorded" : "no check-in recorded"}`}
                  style={[
                    styles.weekDay,
                    wrapDays && styles.wrappedDay,
                    {
                      backgroundColor: checked
                        ? colors.sageSurface
                        : light
                          ? colors.surface2
                          : colors.surface,
                    },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={checked ? colors.sageText : colors.muted}
                  >
                    {date.toLocaleDateString(undefined, {
                      weekday: "narrow",
                      timeZone: "UTC",
                    })}
                  </AppText>
                  <AppText
                    variant="label"
                    color={checked ? colors.sageText : colors.text}
                  >
                    {date.getUTCDate()}
                  </AppText>
                  {checked && (
                    <Icon name="checkmark" size={12} color={colors.sageText} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
      <View style={[styles.ledger, { borderColor: colors.border }]}>
        {metrics.map(({ label, value, icon }, index) => (
          <Row
            key={label}
            style={[
              styles.metric,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              },
            ]}
          >
            <Icon name={icon} size={18} color={colors.lavenderText} />
            <AppText color={colors.muted} style={styles.metricLabel}>
              {label}
            </AppText>
            <AppText variant="label" style={styles.metricValue}>
              {value}
            </AppText>
          </Row>
        ))}
      </View>
      {facts.helpfulSessions > 0 && (
        <Row style={styles.note}>
          <Icon name="heart-outline" size={17} color={colors.peachText} />
          <AppText
            variant="caption"
            color={colors.muted}
            style={styles.metricLabel}
          >
            {facts.helpfulSessions === 1
              ? "You marked one Moment helpful or a little helpful."
              : `You marked ${facts.helpfulSessions} Moments helpful or a little helpful.`}
          </AppText>
        </Row>
      )}
      {goal && (
        <View style={[styles.goal, { backgroundColor: colors.sageSurface }]}>
          <AppText variant="caption" color={colors.sageText}>
            Current goal
          </AppText>
          <AppText variant="label">{goal.title}</AppText>
          <AppText variant="caption" color={colors.muted}>
            {goal.period} · {goal.description}
            {goal.paused ? " · Paused" : ""}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overview: { gap: spacing.row, marginBottom: spacing.section },
  footprint: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.compact,
    paddingBottom: spacing.row,
  },
  lightFootprint: {
    borderWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 14,
    padding: spacing.row,
  },
  week: { flexDirection: "row", gap: 4 },
  wrapDays: { flexWrap: "wrap" },
  weekDay: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    minHeight: 68,
    alignItems: "center",
    paddingVertical: 4,
  },
  wrappedDay: { flexBasis: "23%", flexGrow: 0 },
  ledger: { borderBottomWidth: StyleSheet.hairlineWidth },
  metric: { minHeight: 42, paddingVertical: 5, gap: spacing.row },
  metricLabel: { flex: 1, minWidth: 0 },
  metricValue: {
    minWidth: 30,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  note: { gap: spacing.compact },
  goal: { borderRadius: 12, padding: spacing.row, gap: 3 },
});
