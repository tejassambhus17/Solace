import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  addHabitDays,
  habitDay,
  habitGardenStages,
  habitRevisionOn,
  habitTarget,
  habitWeekStart,
  type Habit,
  type HabitCategory,
  type HabitColor,
  type HabitDraft,
  type HabitGarden,
  type HabitGoal,
  type HabitIcon,
  type HabitProgress,
  type HabitSchedule,
} from "../server/src/habit-contract";
import { useReducedMotion } from "./Companion";
import { useTheme } from "./theme";
import { AppText, Icon, coverImageStyle } from "./ui";

export const habitCategoryLabels: Record<HabitCategory, string> = {
  mindfulness: "Mindfulness",
  movement: "Movement",
  hydration: "Hydration",
  sleep: "Sleep",
  reading: "Reading",
  journaling: "Journaling",
  "self-care": "Self-care",
  "personal-growth": "Personal growth",
};

export const habitIconNames: Record<
  HabitIcon,
  { name: string; label: string }
> = {
  leaf: { name: "leaf-outline", label: "Leaf" },
  walk: { name: "walk-outline", label: "Walk" },
  water: { name: "water-outline", label: "Water" },
  moon: { name: "moon-outline", label: "Moon" },
  book: { name: "book-outline", label: "Book" },
  journal: { name: "create-outline", label: "Journal" },
  heart: { name: "heart-outline", label: "Heart" },
  sparkles: { name: "sparkles-outline", label: "Sparkles" },
};

export const habitWeekdays = [
  { label: "Mon", index: 1 },
  { label: "Tue", index: 2 },
  { label: "Wed", index: 3 },
  { label: "Thu", index: 4 },
  { label: "Fri", index: 5 },
  { label: "Sat", index: 6 },
  { label: "Sun", index: 0 },
] as const;

export const blankHabit: HabitDraft = {
  name: "",
  category: "mindfulness",
  icon: "leaf",
  color: "sage",
  goal: { type: "completion" },
  schedule: { type: "daily" },
  reminderTime: null,
};

export const starterHabits: readonly HabitDraft[] = [
  {
    ...blankHabit,
    name: "Drink water",
    description: "Keep a glass nearby and take a sip when you pause.",
    category: "hydration",
    icon: "water",
    color: "lavender",
    goal: { type: "quantity", target: 3, unit: "glasses" },
  },
  {
    ...blankHabit,
    name: "Take a short walk",
    description: "Step outside or take a gentle walk indoors.",
    category: "movement",
    icon: "walk",
    goal: { type: "duration", target: 5 },
    schedule: { type: "weekly", daysPerWeek: 3 },
  },
  {
    ...blankHabit,
    name: "Journal for five minutes",
    description: "Make a little space for what is on your mind.",
    category: "journaling",
    icon: "journal",
    color: "peach",
    goal: { type: "duration", target: 5 },
  },
  {
    ...blankHabit,
    name: "Read for ten minutes",
    description: "Open a book and enjoy a few pages.",
    category: "reading",
    icon: "book",
    color: "lavender",
    goal: { type: "duration", target: 10 },
  },
  {
    ...blankHabit,
    name: "Practice mindful breathing",
    description: "Take a quiet moment to follow your breath.",
    goal: { type: "duration", target: 5 },
    activity: "breathing",
  },
  {
    ...blankHabit,
    name: "Stretch",
    description: "Take a gentle stretch break that feels comfortable.",
    category: "movement",
    icon: "walk",
    color: "peach",
  },
  {
    ...blankHabit,
    name: "Prepare for bedtime",
    description: "Give yourself a small cue to start winding down.",
    category: "sleep",
    icon: "moon",
    color: "lavender",
  },
  {
    ...blankHabit,
    name: "Spend time outdoors",
    description: "Pause outside and notice something around you.",
    category: "self-care",
    icon: "heart",
    goal: { type: "duration", target: 5 },
    schedule: { type: "weekly", daysPerWeek: 2 },
  },
];

export function localHabitZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function habitToday(habit?: Habit, now?: Date) {
  return habitDay(habit?.timeZone || localHabitZone(), now);
}

const noHabits: readonly Habit[] = [];

export function useHabitClock(habits: readonly Habit[] | Habit = noHabits) {
  const [now, setNow] = useState(() => new Date());
  const zones = useMemo(() => {
    const records = "timeZone" in habits ? [habits] : habits;
    return [...new Set(records.map(({ timeZone }) => timeZone))];
  }, [habits]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== "active" && AppState.currentState != null)
        return;
      const instant = new Date();
      const activeZones = [localHabitZone(), ...zones];
      setNow((previous) =>
        activeZones.some(
          (zone) => habitDay(zone, previous) !== habitDay(zone, instant),
        )
          ? instant
          : previous,
      );
    }, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [zones]);
  return now;
}

export function progressFor(
  progress: readonly HabitProgress[],
  id: string,
  day: string,
) {
  return progress.find((item) => item.habitId === id && item.day === day);
}

export function goalLabel(goal: HabitGoal) {
  if (goal.type === "completion") return "Complete once";
  if (goal.type === "duration")
    return `${goal.target} ${goal.target === 1 ? "minute" : "minutes"}`;
  return `${goal.target} ${goal.unit}`;
}

export function scheduleLabel(schedule: HabitSchedule) {
  if (schedule.type === "daily") return "Every day";
  if (schedule.type === "weekly")
    return `${schedule.daysPerWeek} ${schedule.daysPerWeek === 1 ? "day" : "days"} per week · flexible`;
  return habitWeekdays
    .filter(({ index }) => schedule.days.includes(index))
    .map(({ label }) => label)
    .join(", ");
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
export function displayHabitDay(
  day: string,
  options: Intl.DateTimeFormatOptions,
) {
  const key = JSON.stringify(options);
  let formatter = dayFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(undefined, {
      ...options,
      timeZone: "UTC",
    });
    dayFormats.set(key, formatter);
  }
  return formatter.format(new Date(`${day}T12:00:00Z`));
}

export function reminderLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

export function HabitIconBadge({
  icon,
  color,
  size = 44,
}: {
  icon: HabitIcon;
  color: HabitColor;
  size?: number;
}) {
  const { colors } = useTheme();
  const tone =
    color === "peach"
      ? [colors.peachSurface, colors.peachText]
      : color === "lavender"
        ? [colors.lavenderSurface, colors.lavenderText]
        : [colors.sageSurface, colors.sageText];
  return (
    <View
      aria-hidden
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.38),
          backgroundColor: tone[0],
        },
      ]}
    >
      <Icon
        name={habitIconNames[icon].name}
        color={tone[1]}
        size={Math.round(size * 0.47)}
      />
    </View>
  );
}

export function HabitMeter({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const { colors } = useTheme();
  const percent =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((value / total) * 100)))
      : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={[styles.meter, { backgroundColor: colors.border }]}
    >
      <View
        style={{
          width: `${percent}%`,
          height: "100%",
          backgroundColor: colors.primary,
          borderRadius: 8,
        }}
      />
    </View>
  );
}

export function HabitLink({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <Icon name={icon} color={colors.lavenderText} />
      <View style={styles.linkCopy}>
        <AppText variant="label">{title}</AppText>
        {!!detail && (
          <AppText variant="caption" color={colors.muted}>
            {detail}
          </AppText>
        )}
      </View>
      <Icon name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>
  );
}

export function HabitChoice({
  label,
  selected,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = selected ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {!!icon && <Icon name={icon} color={foreground} size={17} />}
      <AppText variant="caption" color={foreground} style={styles.choiceText}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function HabitWeekStrip({
  today,
  progress,
}: {
  today: string;
  progress: readonly HabitProgress[];
}) {
  const { colors } = useTheme();
  const start = habitWeekStart(today);
  const completions = new Set(
    progress.filter(({ complete }) => complete).map(({ day }) => day),
  );
  return (
    <View style={styles.week}>
      {Array.from({ length: 7 }, (_, index) => {
        const day = addHabitDays(start, index);
        const complete = completions.has(day);
        const current = today === day;
        return (
          <View
            key={day}
            accessible
            accessibilityLabel={`${displayHabitDay(day, { weekday: "long", day: "numeric", month: "long" })}${current ? ", today" : ""}${complete ? ", a habit completed" : ""}`}
            style={styles.weekCell}
          >
            <AppText variant="caption" color={colors.muted} aria-hidden>
              {displayHabitDay(day, { weekday: "narrow" })}
            </AppText>
            <View
              style={[
                styles.dayDot,
                {
                  backgroundColor: complete
                    ? colors.sageSurface
                    : colors.surface,
                  borderColor: current ? colors.primary : colors.border,
                },
              ]}
              aria-hidden
            >
              {complete ? (
                <Icon name="checkmark" color={colors.sageText} size={15} />
              ) : (
                <AppText variant="caption" color={colors.muted}>
                  {Number(day.slice(-2))}
                </AppText>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export const gardenLabels: Record<HabitGarden["stage"], string> = {
  seed: "Seed",
  sprout: "Sprout",
  growing: "Growing plant",
  blooming: "Blooming flower",
  flourishing: "Flourishing garden",
};

const landscapes = {
  dark: require("../assets/profile-mountains-dark.jpg"),
  light: require("../assets/profile-mountains-light.jpg"),
};
const foliage = require("../assets/botanical-compact.png");
const bloom = require("../assets/redesign-lotus.png");

export function GardenScene({
  stage,
  compact = false,
}: {
  stage: HabitGarden["stage"];
  compact?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const reduced = useReducedMotion();
  const last = useRef(stage);
  const [arrival] = useState(() => new Animated.Value(1));
  const index = habitGardenStages.findIndex((item) => item.stage === stage);
  useEffect(() => {
    if (last.current === stage) return;
    last.current = stage;
    if (reduced) {
      arrival.setValue(1);
      return;
    }
    arrival.setValue(0);
    const animation = Animated.timing(arrival, {
      toValue: 1,
      duration: 280,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [stage, reduced, arrival]);
  const shift = arrival.interpolate({
    inputRange: [0, 1],
    outputRange: [7, 0],
  });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${gardenLabels[stage]} in a botanical landscape`}
      style={[
        styles.gardenScene,
        { minHeight: compact ? 124 : 208, backgroundColor: colors.heroSurface },
      ]}
    >
      <Image
        accessible={false}
        source={landscapes[resolved]}
        resizeMode="cover"
        fadeDuration={0}
        style={coverImageStyle}
      />
      <View
        pointerEvents="none"
        aria-hidden
        style={[
          styles.gardenPlot,
          { backgroundColor: colors.overlay, width: compact ? 110 : 144 },
        ]}
      />
      <Animated.View
        aria-hidden
        style={[
          styles.gardenPlant,
          { transform: [{ translateY: shift }], opacity: arrival },
        ]}
      >
        {index === 0 ? (
          <View
            style={[
              styles.seed,
              { backgroundColor: colors.peach, borderColor: colors.peachText },
            ]}
          />
        ) : (
          <>
            <Image
              accessible={false}
              source={foliage}
              resizeMode="contain"
              fadeDuration={0}
              style={[
                styles.sprout,
                {
                  width: compact
                    ? index === 1
                      ? 61
                      : 104
                    : index === 1
                      ? 86
                      : 150,
                  height: compact ? 72 : 112,
                },
              ]}
            />
            {index >= 3 && (
              <Image
                accessible={false}
                source={bloom}
                resizeMode="contain"
                fadeDuration={0}
                style={[
                  styles.bloom,
                  { width: compact ? 62 : 86, height: compact ? 48 : 67 },
                ]}
              />
            )}
            {index === 4 && (
              <>
                <Image
                  accessible={false}
                  source={bloom}
                  resizeMode="contain"
                  fadeDuration={0}
                  style={[styles.sideBloom, { left: 0 }]}
                />
                <Image
                  accessible={false}
                  source={bloom}
                  resizeMode="contain"
                  fadeDuration={0}
                  style={[styles.sideBloom, { right: 0 }]}
                />
              </>
            )}
          </>
        )}
      </Animated.View>
    </View>
  );
}

export function occurrenceLabel(
  habit: Habit,
  day: string,
  progress?: HabitProgress,
) {
  const goal = habitRevisionOn(habit, day)?.goal ?? habit.goal;
  const target = progress?.target ?? habitTarget(goal);
  const unit =
    goal.type === "duration"
      ? "min"
      : goal.type === "quantity"
        ? goal.unit
        : "";
  if (goal.type === "completion")
    return progress?.complete ? "Completed" : "Ready to begin";
  return `${progress?.amount ?? 0} of ${target}${unit ? ` ${unit}` : ""}`;
}

const styles = StyleSheet.create({
  badge: { justifyContent: "center", alignItems: "center", flexShrink: 0 },
  meter: { width: "100%", height: 7, borderRadius: 8, overflow: "hidden" },
  link: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  linkCopy: { flex: 1, gap: 3 },
  choice: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: "100%",
  },
  choiceText: { flexShrink: 1, textAlign: "center" },
  week: { flexDirection: "row", justifyContent: "space-between", gap: 2 },
  weekCell: { flex: 1, alignItems: "center", gap: 7, minWidth: 0 },
  dayDot: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  gardenScene: {
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 18,
  },
  gardenPlant: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 143,
    minHeight: 62,
    marginBottom: 11,
  },
  gardenPlot: {
    position: "absolute",
    bottom: 8,
    height: 17,
    borderRadius: 25,
  },
  seed: {
    width: 16,
    height: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    transform: [{ rotate: "-28deg" }],
    marginBottom: 4,
  },
  sprout: { transform: [{ rotate: "50deg" }], marginBottom: -7 },
  bloom: { position: "absolute", bottom: 18 },
  sideBloom: { position: "absolute", bottom: 5, width: 44, height: 36 },
});
