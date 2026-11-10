import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  emotionalRecheckLabels,
  emotionalRecheckResponses,
} from "../../server/src/practice-recheck";
import { spacing } from "../layout";
import { momentClockText } from "../moments";
import { EditorialSection, SceneIntro } from "../NestedDesign";
import { practiceInsights } from "../practice-insights";
import { routes } from "../routes";
import { useApp, type Item } from "../store";
import { getTechnique, isTechniqueId } from "../techniques";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  Card,
  Icon,
  NestedState,
  Screen,
  coverImageStyle,
} from "../ui";

const artwork = {
  light: require("../../assets/redesign-explore-reflect.jpg"),
  dark: require("../../assets/voice-companion-night.jpg"),
};

const previewArtwork = {
  light: require("../../assets/voice-companion-dawn.jpg"),
  dark: artwork.dark,
};

export function WhatHelpedCard({ now }: { now: Date }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.25;
  const compact = width < 360;
  const dark = resolved === "dark";
  const surface = dark ? "#211A2E" : colors.surface2;
  const { enough, counts, ratedCount } = useMemo(
    () => practiceInsights(app.data, now),
    [app.data.sessions, app.data.checkins, now],
  );
  const description = enough
    ? `You reported feeling more settled in ${counts["more-settled"]} of ${ratedCount} recent rechecks.`
    : "Review your practices and optional rechecks.";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What helped me, view details"
      accessibilityHint={description}
      onPress={() => app.navigate(routes.practiceInsights)}
      style={({ pressed }) => [
        styles.preview,
        Platform.OS === "android" && styles.androidPreview,
        {
          backgroundColor: surface,
          borderColor: dark ? "#59476D" : colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.previewArtwork, largeText && styles.quietArtwork]}
      >
        <Image
          source={previewArtwork[resolved]}
          style={coverImageStyle}
          resizeMode="cover"
          resizeMethod="resize"
          accessible={false}
          fadeDuration={0}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          artGradient(
            `linear-gradient(90deg, ${surface} 0%, ${surface} 46%, ${surface}F7 62%, ${surface}8F 77%, ${surface}12 100%)`,
          ),
        ]}
      />
      <View
        style={[
          styles.previewCopy,
          compact && styles.compactPreviewCopy,
          largeText && styles.fullPreviewCopy,
        ]}
      >
        <View style={styles.previewHeading}>
          <Icon name="leaf-outline" size={17} color={colors.lavenderText} />
          <AppText variant="heading" style={styles.previewTitle}>
            What helped me
          </AppText>
        </View>
        <AppText variant="caption" color={colors.text}>
          {description}
        </AppText>
        <View style={[styles.link, { backgroundColor: colors.lavenderAction }]}>
          <AppText variant="label" color={colors.lavenderActionText}>
            View details
          </AppText>
          <Icon
            name="arrow-forward"
            size={15}
            color={colors.lavenderActionText}
          />
        </View>
      </View>
    </Pressable>
  );
}

function availablePractice(record: Item) {
  if (record.activity?.id && record.kind === "generated") {
    const technique = getTechnique(record.practiceId);
    if (technique && technique.activity.id === record.activity.id)
      return {
        route: routes.momentPlayer,
        params: { techniqueId: technique.id, source: "journey" },
      };
    return {
      route: routes.momentPlayer,
      params: {
        activity: record.activity,
        provider: record.provider === "live" ? "live" : "offline",
        source: "journey",
      },
    };
  }
  if (record.type === "breathing")
    return {
      route: routes.breathing,
      params: {
        durationSec: record.plannedDurationSec ?? record.durationSec ?? 180,
      },
    };
  if (isTechniqueId(record.practiceId))
    return { route: routes.technique, params: { id: record.practiceId } };
  if (record.type === "grounding") return { route: "grounding", params: {} };
  if (record.type === "reflection") return { route: "reflection", params: {} };
}

const shortDate = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function PracticeInsightsScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const result = useMemo(
    () => practiceInsights(app.data),
    [app.data.sessions, app.data.checkins],
  );
  const responseColors = [
    colors.lavenderText,
    colors.sageText,
    colors.peachText,
  ];
  return (
    <Screen title="What helped me" variant="nested" back={app.back}>
      <View style={styles.page}>
        <SceneIntro
          image={artwork[resolved]}
          title={
            result.enough
              ? "Notice what follows"
              : "Your story is still unfolding"
          }
          description={result.observation}
        />
        {result.enough && (
          <Card style={styles.summary}>
            <EditorialSection
              title="Your rechecks"
              description={`Your responses after ${result.ratedCount} recent practices.`}
            />
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={styles.distribution}
            >
              {emotionalRecheckResponses.map(
                (response, index) =>
                  result.counts[response] > 0 && (
                    <View
                      key={response}
                      style={{
                        flex: result.counts[response],
                        backgroundColor: responseColors[index],
                      }}
                    />
                  ),
              )}
            </View>
            {emotionalRecheckResponses.map((response, index) => (
              <View key={response} style={styles.countRow}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: responseColors[index] },
                  ]}
                />
                <AppText variant="label" style={styles.flex}>
                  {emotionalRecheckLabels[response]}
                </AppText>
                <AppText variant="label" color={colors.lavenderText}>
                  {result.counts[response]}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" color={colors.muted}>
              These are your own observations. A practice can feel different
              from one day to the next.
            </AppText>
          </Card>
        )}
        <EditorialSection
          title="Recent practices"
          description="Up to 30 completed practices. Skipped responses remain optional."
        />
        {result.records.length === 0 && (
          <NestedState
            icon="leaf-outline"
            title="Room for a first practice"
            description="Completed practices will appear here."
          />
        )}
        {result.records.map(({ record, title, seconds, response, origin }) => {
          const date = new Date(record.endedAt ?? record.createdAt);
          const practice = availablePractice(record);
          return (
            <Card key={record.id} style={styles.entry}>
              <AppText variant="heading">{title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {Number.isNaN(date.valueOf())
                  ? ""
                  : `${shortDate.format(date)} · `}
                {momentClockText(seconds)} active
              </AppText>
              {origin?.mood && (
                <AppText variant="caption" color={colors.muted}>
                  Starting check-in · {origin.mood}
                </AppText>
              )}
              <AppText variant="label" color={colors.lavenderText}>
                {response
                  ? emotionalRecheckLabels[response]
                  : "No recheck recorded"}
              </AppText>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View session for ${title}`}
                  onPress={() =>
                    app.navigate(routes.sessionDetail, { id: record.id })
                  }
                  style={styles.action}
                >
                  <AppText variant="label" color={colors.lavenderText}>
                    View session
                  </AppText>
                </Pressable>
                {practice && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open practice for ${title}`}
                    onPress={() =>
                      app.navigate(practice.route, practice.params)
                    }
                    style={styles.action}
                  >
                    <AppText variant="label" color={colors.lavenderText}>
                      Open practice
                    </AppText>
                    <Icon
                      name="arrow-forward"
                      size={15}
                      color={colors.lavenderText}
                    />
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 148,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.card,
    justifyContent: "center",
  },
  androidPreview: { minHeight: 128, padding: spacing.row },
  previewArtwork: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "54%",
  },
  quietArtwork: { opacity: 0.18 },
  previewCopy: { width: "72%", gap: 4 },
  compactPreviewCopy: { width: "78%" },
  fullPreviewCopy: { width: "100%" },
  previewHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
  },
  previewTitle: { flex: 1, minWidth: 0, fontSize: 22, lineHeight: 26 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.compact,
    minHeight: 44,
    paddingHorizontal: spacing.row,
    paddingVertical: 4,
    borderRadius: 24,
    marginTop: 4,
  },
  page: { gap: spacing.section },
  summary: { gap: spacing.row },
  distribution: {
    flexDirection: "row",
    height: 9,
    gap: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  legendDot: { height: 8, width: 8, borderRadius: 4 },
  countRow: { flexDirection: "row", alignItems: "center", gap: spacing.row },
  flex: { flex: 1 },
  entry: { gap: spacing.compact },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.row },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
});
