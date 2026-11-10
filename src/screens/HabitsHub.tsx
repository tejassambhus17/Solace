import React, { Activity, useContext, useLayoutEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../Companion";
import { playHaptic } from "../haptics";
import { spacing, useScreenGutter } from "../layout";
import { TabRail } from "../Navigation";
import type { TabSelectionIntent } from "../navigation-motion";
import { TabResetGuardContext, useGuardedBack } from "../navigation-reset";
import {
  habitSection,
  habitSections,
  isRecordId,
  routes,
  type HabitSection,
} from "../routes";
import { useApp } from "../store";
import { artGradient, useTheme } from "../theme";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  IconButton,
  NestedHeader,
  useNavigationInset,
} from "../ui";
import { HabitsGardenSection } from "./HabitsGardenSection";
import { HabitsInsightsSection } from "./HabitsInsights";
import { HabitsManagementSection } from "./HabitsManagementSection";
import { HabitsTodaySection } from "./HabitsTodaySection";

const destinations = [
  { name: "today", title: "Today", icon: "sunny-outline", active: "sunny" },
  {
    name: "my-habits",
    title: "My Habits",
    icon: "list-outline",
    active: "list",
  },
  {
    name: "insights",
    title: "Insights",
    icon: "bar-chart-outline",
    active: "bar-chart",
  },
  { name: "garden", title: "Garden", icon: "leaf-outline", active: "leaf" },
];
const heading = {
  today: {
    title: "Your Habits",
    subtitle: "Small steps today, a calmer tomorrow.",
  },
  "my-habits": {
    title: "My Habits",
    subtitle: "Your current habits and progress.",
  },
  insights: {
    title: "Habit Insights",
    subtitle: "Your habit journey, in focus.",
  },
  garden: {
    title: "Growing Garden",
    subtitle: "Small, saved actions bring your garden to life.",
  },
};
const drillDownTitle: Record<string, string> = {
  [routes.habitCreate]: "Create habit",
  [routes.habitEdit]: "Edit habit",
  [routes.habitDetails]: "Habit details",
  [routes.habitReminders]: "Habit reminders",
};
const heroDark = require("../../assets/habits-sunset-header.jpg");
const heroLight = require("../../assets/profile-mountains-light.jpg");

function HabitHubHeader({
  section,
  detailTitle,
  firstHabit,
  onBack,
  onCreate,
}: {
  section: HabitSection;
  detailTitle?: string;
  firstHabit: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const { top } = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const back = useGuardedBack(onBack);
  const compact = height < 620 || fontScale >= 1.4;
  const dark = resolved === "dark";
  const { title, subtitle } = heading[section];
  const landscape = section === "today" || section === "insights";
  const canCreate = section === "today" || section === "my-habits";
  const firstToday = firstHabit && section === "today";
  if (detailTitle)
    return (
      <NestedHeader
        title={detailTitle}
        onBack={onBack}
        style={[
          styles.detailHeader,
          { paddingTop: top + 4, paddingHorizontal: gutter },
        ]}
      />
    );
  return (
    <View
      style={[
        styles.header,
        { paddingTop: top + 4, paddingHorizontal: gutter },
      ]}
    >
      {landscape && (
        <>
          <Image
            accessible={false}
            source={dark ? heroDark : heroLight}
            resizeMode="cover"
            fadeDuration={0}
            style={[
              styles.headerArt,
              dark ? styles.nightHeaderArt : styles.dayHeaderArt,
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                dark
                  ? `linear-gradient(90deg, ${colors.bg} 15%, ${colors.bg}DB 36%, ${colors.bg}00 100%)`
                  : `linear-gradient(90deg, ${colors.bg} 24%, ${colors.bg}ED 43%, ${colors.bg}50 70%, ${colors.bg}00 95%)`,
              ),
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              artGradient(
                `linear-gradient(0deg, ${colors.bg} 0%, ${colors.bg}00 ${dark ? 62 : 46}%)`,
              ),
            ]}
          />
        </>
      )}
      {!landscape && (
        <BotanicalBackdrop
          style={[
            styles.headerLeaves,
            !dark &&
              section === "garden" &&
              (width < 360 || fontScale > 1.2) &&
              styles.compactGardenLeaves,
          ]}
        />
      )}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.back,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <IconButton name="chevron-back" label="Go back" onPress={back} />
        </View>
        {compact && (
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.detailHeading}
          >
            {title}
          </AppText>
        )}
        {canCreate && !firstToday && (
          <Button
            title="Create Habit"
            icon="add"
            variant="secondary"
            onPress={onCreate}
            style={styles.headerCreate}
          />
        )}
      </View>
      <View style={styles.headingCopy}>
        {!compact && (
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
        )}
        <AppText variant="caption" color={colors.muted}>
          {subtitle}
        </AppText>
      </View>
      {firstToday && (
        <Button title="Create Your First Habit" icon="add" onPress={onCreate} />
      )}
    </View>
  );
}

export function HabitsHub({ drillDown }: { drillDown?: React.ReactNode }) {
  const app = useApp();
  const { colors } = useTheme();
  const { left, right, bottom } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  const reducedMotion = useReducedMotion();
  const bottomClearance = Math.max(bottom, useNavigationInset());
  const params = app.habitHub?.params ?? app.params;
  const section = habitSection(params.section);
  const insightsRequest = React.useRef(0);
  const [visited, setVisited] = useState<readonly HabitSection[]>([section]);
  useLayoutEffect(() => {
    setVisited((previous) =>
      previous.includes(section) ? previous : [...previous, section],
    );
  }, [section]);
  const guard = useContext(TabResetGuardContext);

  function select(
    destination: HabitSection,
    extra: Record<string, unknown> = {},
    haptic = false,
  ) {
    if (!drillDown && destination === section && !Object.keys(extra).length)
      return;
    const open = () => {
      if (haptic) void playHaptic("selection");
      app.navigate(routes.habits, { ...extra, section: destination });
    };
    if (drillDown && guard) guard.leave(open, "back");
    else open();
  }

  function selectByGesture(name: string, intent: TabSelectionIntent) {
    select(habitSection(name), {}, intent === "switch");
  }

  const startDay = params.insightsStartDay;
  const endDay = params.insightsEndDay;
  const requestedRange =
    typeof startDay === "string" && typeof endDay === "string"
      ? { startDay, endDay }
      : undefined;
  const requestedPeriod =
    params.insightsPeriod === "week" || params.insightsPeriod === "month"
      ? params.insightsPeriod
      : undefined;
  const habitId = isRecordId(params.insightsHabitId)
    ? params.insightsHabitId
    : undefined;
  return (
    <View
      style={[
        styles.hub,
        { backgroundColor: colors.bg, paddingLeft: left, paddingRight: right },
      ]}
    >
      <HabitHubHeader
        section={section}
        detailTitle={drillDown ? drillDownTitle[app.route] : undefined}
        firstHabit={!app.data.habits.length}
        onBack={app.back}
        onCreate={() => app.navigate(routes.habitCreate)}
      />
      <View style={[styles.rail, { marginHorizontal: gutter }]}>
        <TabRail
          destinations={destinations}
          activeTab={section}
          route={`${app.route}:${section}`}
          onSelect={selectByGesture}
          reducedMotion={reducedMotion}
          twilight
          waitForSelection={!!drillDown}
          activeLabelColor={colors.lavenderText}
          accessibilityLabel="Habits sections"
        />
      </View>
      {habitSections.map((name) => {
        const visible = name === section && !drillDown;
        if (!visited.includes(name) && name !== section) return null;
        return (
          <Activity key={name} mode={visible ? "visible" : "hidden"}>
            <ScrollView
              style={styles.hub}
              contentContainerStyle={{
                paddingHorizontal: gutter,
                paddingTop: spacing.row,
                paddingBottom: bottomClearance + spacing.bottom,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {name === "today" && (
                <HabitsTodaySection
                  onOpenGarden={() => select("garden")}
                  onOpenInsights={() =>
                    select("insights", {
                      insightsPeriod: "week",
                      insightsStartDay: undefined,
                      insightsEndDay: undefined,
                      insightsHabitId: undefined,
                      insightsRequest: ++insightsRequest.current,
                    })
                  }
                />
              )}
              {name === "my-habits" && (
                <HabitsManagementSection onOpenToday={() => select("today")} />
              )}
              {name === "insights" && (
                <HabitsInsightsSection
                  active={visible}
                  habitId={habitId}
                  requestedRange={requestedRange}
                  requestedPeriod={requestedPeriod}
                  viewRequest={
                    typeof params.insightsRequest === "number"
                      ? params.insightsRequest
                      : undefined
                  }
                  onOpenHabit={(id, day) =>
                    app.navigate(routes.habitDetails, { id, day })
                  }
                  onGoToday={() => select("today")}
                />
              )}
              {name === "garden" && (
                <HabitsGardenSection
                  active={visible}
                  onBackToToday={() => select("today")}
                />
              )}
            </ScrollView>
          </Activity>
        );
      })}
      {drillDown}
    </View>
  );
}

const styles = StyleSheet.create({
  hub: { flex: 1 },
  header: {
    overflow: "hidden",
    gap: spacing.compact,
    paddingBottom: spacing.compact,
    alignItems: "flex-start",
  },
  headerArt: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  nightHeaderArt: { width: "125%", height: undefined, aspectRatio: 3 },
  dayHeaderArt: { width: "100%" },
  headerLeaves: { width: 145, height: 145, right: -10, top: 0, opacity: 0.4 },
  compactGardenLeaves: { width: 106, height: 100, top: -28, opacity: 0.32 },
  headerRow: {
    flexDirection: "row",
    gap: spacing.compact,
    alignItems: "center",
    alignSelf: "stretch",
    flexWrap: "wrap",
  },
  headerCreate: {
    minHeight: 48,
    marginStart: "auto",
    paddingHorizontal: spacing.row,
  },
  detailHeader: { marginBottom: spacing.compact },
  headingCopy: { gap: 3, alignSelf: "stretch" },
  back: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth },
  detailHeading: { flexShrink: 1 },
  rail: { paddingBottom: spacing.compact },
});
