import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  remainingGardenHabitDays,
  type GardenIntention,
  type GardenIntentionChoice,
} from "../../server/src/garden-contract";
import {
  habitDay,
  habitWeekStart,
  type Habit,
} from "../../server/src/habit-contract";
import { readWellnessGoals } from "../../server/src/wellness-goals";
import { useReducedMotion } from "../Companion";
import { localHabitZone } from "../habits-ui";
import { spacing } from "../layout";
import { webRadioProps } from "../radio-keyboard";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, BotanicalBackdrop, Button, Card, Icon, Row } from "../ui";
import { wellnessRecommendations } from "../wellness-recommendations";

const intentionCopy = {
  calming: {
    title: "Make time to settle",
    detail: "Complete two calming practices",
    icon: "leaf-outline",
    action: "Try a calming breath",
  },
  breathing: {
    title: "Come back to your breath",
    detail: "Complete three breathing practices",
    icon: "cloud-outline",
    action: "Open breathing practice",
  },
  sleep: {
    title: "Make room for rest",
    detail: "Complete two sleep wind-downs",
    icon: "moon-outline",
    action: "Open Sleep Wind Down",
  },
  journal: {
    title: "Write a few lines",
    detail: "Save two journal entries",
    icon: "pencil-outline",
    action: "Open My Journal",
  },
  habit: {
    title: "Tend an existing habit",
    detail: "Complete its remaining scheduled days",
    icon: "checkbox-outline",
    action: "Open this habit",
  },
} as const;

const practiceOptions: GardenIntentionChoice[] = [
  { kind: "calming" },
  { kind: "breathing" },
  { kind: "sleep" },
  { kind: "journal" },
];

function choiceKey(choice: GardenIntentionChoice) {
  return choice.kind === "habit" ? choice.habitId : choice.kind;
}

function choiceTitle(choice: GardenIntentionChoice, habits: readonly Habit[]) {
  return choice.kind === "habit"
    ? (habits.find(({ id }) => id === choice.habitId)?.name ??
        "Saved habit intention")
    : intentionCopy[choice.kind].title;
}

function countLabel(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function GardenIntentionCard({
  intention,
  nextMilestone,
  now,
}: {
  intention?: GardenIntention;
  nextMilestone: string;
  now: Date;
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<GardenIntentionChoice>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [habitLimit, setHabitLimit] = useState(8);
  const savingRef = useRef(false);
  const count = intention?.contributors.length ?? 0;
  const previous = useRef(count);
  const [growth] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const advanced = count > previous.current;
    previous.current = count;
    if (!advanced || reduced) return;
    growth.setValue(0.62);
    const animation = Animated.timing(growth, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [count, growth, reduced]);

  const zone = intention?.timeZone ?? localHabitZone();
  const weekStart = habitWeekStart(habitDay(zone, now));
  const habits = app.data.habits;
  const eligibleHabits = choosing
    ? habits.flatMap((habit) => {
        const days = remainingGardenHabitDays(
          habit,
          app.data.habitProgress,
          weekStart,
          now,
        );
        return days > 0 ? [{ habit, days }] : [];
      })
    : [];
  const goals = readWellnessGoals(app.user?.wellnessGoals);
  const suggested: GardenIntentionChoice = goals.includes("sleep")
    ? { kind: "sleep" }
    : goals.includes("feelings")
      ? { kind: "journal" }
      : goals.includes("habits") && eligibleHabits[0]
        ? { kind: "habit", habitId: eligibleHabits[0].habit.id }
        : goals.includes("focus")
          ? { kind: "breathing" }
          : { kind: "calming" };

  async function save() {
    if (!selected || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await app.saveGardenIntention(selected, zone);
      setChoosing(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t save your intention. Try again.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function startIntention(choice: GardenIntentionChoice) {
    if (choice.kind === "habit")
      app.navigate(routes.habitDetails, { id: choice.habitId });
    else if (choice.kind === "journal") app.navigate(routes.journal);
    else if (choice.kind === "sleep") {
      const { route, params } = wellnessRecommendations.sleep;
      app.navigate(route, params);
    } else app.navigate(routes.breathing, { durationSec: 60 });
  }

  const completed = !!intention && count >= intention.target;
  const activeHabit =
    intention?.kind === "habit"
      ? habits.find(
          ({ id, status }) => id === intention.habitId && status === "active",
        )
      : undefined;
  const accent = resolved === "dark" ? colors.lavender : colors.accent;

  return (
    <Card
      style={[
        styles.card,
        {
          backgroundColor:
            resolved === "dark" ? colors.lavenderSurface : colors.surface,
        },
      ]}
    >
      <BotanicalBackdrop
        style={
          resolved === "light" && (width < 360 || fontScale > 1.2)
            ? styles.compactLeaves
            : undefined
        }
      />
      <Row style={styles.headingRow}>
        <View style={styles.copy}>
          <AppText variant="heading" accessibilityRole="header">
            Your weekly intention
          </AppText>
          {intention && (
            <AppText variant="label">{choiceTitle(intention, habits)}</AppText>
          )}
          <AppText variant="caption" color={colors.muted}>
            {intention
              ? intentionCopy[intention.kind].detail
              : "Give your garden one small action to grow from."}
          </AppText>
        </View>
        <Icon
          name={intention ? intentionCopy[intention.kind].icon : "leaf-outline"}
          size={23}
          color={accent}
        />
      </Row>
      {intention && (
        <>
          <Row style={styles.progressRow}>
            <AppText variant="label" color={colors.lavenderText}>
              {completed ? "Intention reached" : "This week"}
            </AppText>
            <AppText variant="label" accessibilityLiveRegion="polite">
              {count} of {intention.target}
            </AppText>
          </Row>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Weekly intention progress"
            accessibilityValue={{ min: 0, max: intention.target, now: count }}
            style={[styles.track, { backgroundColor: colors.border }]}
          >
            <Animated.View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, (count / intention.target) * 100)}%`,
                  backgroundColor: accent,
                  opacity: growth,
                },
              ]}
            />
          </View>
        </>
      )}
      <AppText variant="caption" color={colors.muted}>
        {nextMilestone}
      </AppText>
      {!choosing &&
        intention &&
        !completed &&
        (intention.kind !== "habit" || activeHabit ? (
          <Button
            title={intentionCopy[intention.kind].action}
            onPress={() => startIntention(intention)}
            icon={intentionCopy[intention.kind].icon}
          />
        ) : (
          <AppText variant="caption" color={colors.muted}>
            This habit is currently unavailable. Your earned growth stays.
          </AppText>
        ))}
      {!choosing && (!intention || count === 0) && (
        <Button
          title={intention ? "Change intention" : "Choose an intention"}
          variant={intention ? "secondary" : "primary"}
          onPress={() => {
            setSelected(intention);
            setChoosing(true);
            setError("");
          }}
        />
      )}
      {choosing && (
        <View style={styles.options}>
          <AppText variant="caption" color={colors.muted}>
            Saved activities from this point forward can count toward your
            intention.
          </AppText>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Weekly intention choices"
            style={styles.options}
          >
            {[
              ...practiceOptions,
              ...eligibleHabits
                .slice(0, habitLimit)
                .map(({ habit }): GardenIntentionChoice => ({
                  kind: "habit",
                  habitId: habit.id,
                })),
            ].map((choice, index) => {
              const copy = intentionCopy[choice.kind];
              const key = choiceKey(choice);
              const checked =
                selected?.kind === choice.kind && choiceKey(selected) === key;
              const suggestedChoice =
                suggested.kind === choice.kind && choiceKey(suggested) === key;
              const detail =
                choice.kind === "habit"
                  ? countLabel(
                      eligibleHabits.find(
                        ({ habit }) => habit.id === choice.habitId,
                      )?.days ?? 0,
                      "scheduled day remaining",
                      "scheduled days remaining",
                    )
                  : copy.detail;
              return (
                <Pressable
                  key={`${choice.kind}-${key}`}
                  accessibilityRole="radio"
                  aria-checked={checked}
                  accessibilityState={{ checked, disabled: saving }}
                  disabled={saving}
                  onPress={() => setSelected(choice)}
                  {...webRadioProps(checked || (!selected && index === 0))}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: checked ? accent : colors.border,
                      backgroundColor: checked
                        ? colors.lavenderSurface
                        : colors.surface,
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <Icon
                    name={copy.icon}
                    size={18}
                    color={colors.lavenderText}
                  />
                  <View style={styles.copy}>
                    <AppText variant="label">
                      {choiceTitle(choice, habits)}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {detail}
                      {suggestedChoice ? " · Suggested" : ""}
                    </AppText>
                  </View>
                  {checked && (
                    <Icon name="checkmark-circle" size={19} color={accent} />
                  )}
                </Pressable>
              );
            })}
          </View>
          {eligibleHabits.length > habitLimit && (
            <Button
              title="Show more habits"
              variant="secondary"
              disabled={saving}
              onPress={() => setHabitLimit((limit) => limit + 8)}
            />
          )}
          {!!error && (
            <AppText
              accessibilityRole="alert"
              variant="caption"
              color={colors.danger}
            >
              {error}
            </AppText>
          )}
          <Button
            title={saving ? "Saving intention…" : "Save intention"}
            disabled={saving || !selected}
            onPress={() => void save()}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={saving}
            onPress={() => setChoosing(false)}
          />
        </View>
      )}
    </Card>
  );
}

const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function GardenGrowthDetails({
  intention,
  weekStart,
}: {
  intention?: GardenIntention;
  weekStart: string;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [visibleCount, setVisibleCount] = useState(12);
  const { habits, habitProgress, sessions, reflections } = app.data;
  const habitWeek = habitProgress.filter(
    (log) =>
      log.earned &&
      !log.gardenCreditFromSession &&
      habitWeekStart(log.day) === weekStart,
  );
  const entries = [
    ...habitWeek.flatMap((log) => {
      const habit = habits.find(({ id }) => id === log.habitId);
      return habit
        ? [
            {
              key: `habit-${log.id}`,
              title: habit.name,
              day: log.day,
              icon: "checkbox-outline",
            },
          ]
        : [];
    }),
    ...(intention?.contributors ?? []).flatMap((entry) => {
      if (entry.collection === "reflections") {
        return reflections.some(({ id }) => id === entry.recordId)
          ? [
              {
                key: `journal-${entry.recordId}`,
                title: "Journal entry",
                day: entry.day,
                icon: "pencil-outline",
              },
            ]
          : [];
      }
      if (entry.collection !== "sessions") return [];
      const record = sessions.find(({ id }) => id === entry.recordId);
      if (!record) return [];
      const seconds = record.durationSec ?? record.durationSeconds;
      const duration =
        typeof seconds === "number" && seconds > 0
          ? seconds < 60
            ? `${Math.round(seconds)} sec`
            : `${Math.floor(seconds / 60)} min`
          : "";
      const title =
        record.title || record.activity?.title || "Completed practice";
      return [
        {
          key: `practice-${entry.recordId}`,
          title: duration ? `${title} · ${duration}` : title,
          day: entry.day,
          icon: "leaf-outline",
        },
      ];
    }),
  ].sort((left, right) => right.day.localeCompare(left.day));
  return (
    <View style={styles.details}>
      <AppText variant="heading" accessibilityRole="header">
        Your growth this week
      </AppText>
      {entries.length ? (
        entries.slice(0, visibleCount).map((entry) => (
          <Row
            key={entry.key}
            style={[styles.entry, { borderColor: colors.border }]}
          >
            <Icon name={entry.icon} size={17} color={colors.lavenderText} />
            <View style={styles.copy}>
              <AppText variant="label">{entry.title}</AppText>
              <AppText variant="caption" color={colors.muted}>
                {dayLabel.format(new Date(`${entry.day}T12:00:00Z`))}
              </AppText>
            </View>
          </Row>
        ))
      ) : (
        <AppText color={colors.muted}>
          Your next saved contribution will appear here. Your garden keeps the
          growth you’ve already earned.
        </AppText>
      )}
      {entries.length > visibleCount && (
        <Button
          title="Show more contributions"
          variant="secondary"
          onPress={() => setVisibleCount((count) => count + 12)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compactLeaves: {
    width: 108,
    height: 92,
    right: -22,
    top: -20,
    opacity: 0.22,
  },
  card: {
    overflow: "hidden",
    gap: spacing.row,
    padding: spacing.card,
    borderRadius: 16,
  },
  headingRow: { alignItems: "flex-start" },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  progressRow: { justifyContent: "space-between" },
  track: { height: 7, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  options: { gap: spacing.compact },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    gap: spacing.compact,
    padding: spacing.row,
  },
  details: { gap: spacing.compact, paddingVertical: spacing.compact },
  entry: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 46,
    paddingVertical: spacing.compact,
  },
});
