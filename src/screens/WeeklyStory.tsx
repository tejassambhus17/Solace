import React from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import type { WeeklyFacts } from "../../server/src/weekly-facts";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Card, coverImageStyle } from "../ui";

const landscape = {
  light: require("../../assets/redesign-reset-light.jpg"),
  dark: require("../../assets/today-twilight-lotus.jpg"),
};

export function WeeklyStoryOverview({
  facts,
  goal,
}: {
  facts: WeeklyFacts;
  goal?: {
    title: string;
    description: string;
    period: string;
    paused: boolean;
  };
}) {
  const { colors, resolved } = useTheme();
  const { fontScale } = useWindowDimensions();
  const metrics = [
    { label: "Check-in days", value: facts.days.length },
    { label: "Completed Moments", value: facts.completedSessions },
    { label: "Mindful minutes", value: facts.minutes },
    { label: "Saved reflections", value: facts.reflections },
  ];

  return (
    <Card style={[styles.overview, { borderColor: colors.heroBorder }]}>
      <View style={[styles.landscape, { backgroundColor: colors.heroSurface }]}>
        <Image
          source={landscape[resolved]}
          style={coverImageStyle}
          resizeMode="cover"
          accessible={false}
          fadeDuration={0}
        />
      </View>
      <View style={styles.content}>
        <AppText variant="heading" accessibilityRole="header">
          Your week in moments
        </AppText>
        <View style={styles.metrics}>
          {metrics.map(({ label, value }) => (
            <View
              key={label}
              style={[
                styles.metric,
                { flexBasis: fontScale > 1.3 ? "100%" : "44%" },
              ]}
            >
              <AppText variant="label" color={colors.primary}>
                {value}
              </AppText>
              <AppText variant="caption" color={colors.muted}>
                {label}
              </AppText>
            </View>
          ))}
        </View>
        {facts.helpfulSessions > 0 && (
          <AppText variant="caption" color={colors.muted}>
            {facts.helpfulSessions === 1
              ? "You marked one Moment helpful or a little helpful."
              : `You marked ${facts.helpfulSessions} Moments helpful or a little helpful.`}
          </AppText>
        )}
        {goal && (
          <View style={[styles.goal, { borderTopColor: colors.border }]}>
            <AppText variant="caption" color={colors.muted}>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  overview: { padding: 0, overflow: "hidden", marginBottom: spacing.section },
  landscape: { height: 108, overflow: "hidden" },
  content: { padding: spacing.card, gap: spacing.row },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.row },
  metric: { flexGrow: 1, gap: 2 },
  goal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.row,
    gap: 3,
  },
});
