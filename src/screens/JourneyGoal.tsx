import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import {
  goalMetrics,
  goalPeriods,
  goalTargetBounds,
  validGoalTarget,
  type GoalMetric,
  type GoalPeriod,
} from "../../server/src/goal-contract";
import { localDay, recordDay } from "../content";
import {
  journeyGoalLabels,
  journeyGoalProgress,
  selectJourneyGoal,
} from "../journey-goals";
import { useTabResetGuard } from "../navigation-reset";
import { EditorialSection } from "../NestedDesign";
import { activeSeconds, type DayEntry } from "../progress";
import { webRadioProps } from "../radio-keyboard";
import { useApp } from "../store";
import { savedReflectionRoute } from "../routes";
import { useTheme } from "../theme";
import { spacing } from "../layout";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  Card,
  Icon,
  Input,
  NestedState,
  Row,
  Screen,
} from "../ui";

const defaultTitle = "Make a little time for myself";
const defaultTargets: Record<GoalMetric, number> = {
  "checkin-days": 3,
  moments: 3,
  "mindful-minutes": 15,
  reflections: 2,
};
const periodOptions: Record<GoalPeriod, string> = {
  week: "Week",
  month: "Month",
  all: "All time",
};

function hasStatus(cause: unknown, status: number) {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "status" in cause &&
    cause.status === status
  );
}

function GoalOption({
  title,
  selected,
  disabled,
  onPress,
  equal = false,
}: {
  title: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  equal?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      {...webRadioProps(selected)}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        equal && styles.equalOption,
        {
          backgroundColor: selected ? colors.lavenderSurface : colors.surface,
          borderColor: selected ? colors.lavenderText : colors.border,
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
    >
      <AppText
        variant="caption"
        color={selected ? colors.lavenderText : colors.text}
        style={styles.optionLabel}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

function GoalActivity({ entry }: { entry: DayEntry }) {
  const app = useApp();
  const { colors } = useTheme();
  const { collection, record } = entry;
  const day = recordDay(record);
  const date = day
    ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "";
  const title =
    collection === "sessions"
      ? record.title || record.activity?.title || "Completed Moment"
      : collection === "reflections"
        ? record.title || "Saved reflection"
        : `${record.mood || "Saved"} check-in`;
  const seconds = collection === "sessions" ? activeSeconds(record) : 0;
  const detail = seconds
    ? `${date} · ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")} active`
    : date;
  const destination =
    collection === "sessions" && record.id
      ? { route: "session-detail", params: { id: record.id } }
      : collection === "reflections" && record.id
        ? { route: savedReflectionRoute(record), params: { id: record.id } }
        : collection === "checkins" && day
          ? { route: "journey-activity", params: { day, filter: "checkins" } }
          : undefined;
  const content = (
    <Row style={{ minHeight: 50, paddingVertical: 7 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" color={colors.muted}>
          {detail}
        </AppText>
      </View>
      {destination && (
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      )}
    </Row>
  );
  return destination ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => app.navigate(destination.route, destination.params)}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function JourneyGoalScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const goal = useMemo(
    () => selectJourneyGoal(app.data.goals),
    [app.data.goals],
  );
  const [today, setToday] = useState(() => localDay());
  const [editing, setEditing] = useState(!goal);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [title, setTitle] = useState(goal?.title ?? defaultTitle);
  const [metric, setMetric] = useState<GoalMetric>(
    goal?.metric ?? "mindful-minutes",
  );
  const [period, setPeriod] = useState<GoalPeriod>(goal?.period ?? "week");
  const [target, setTarget] = useState(String(goal?.target ?? 15));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const progress = useMemo(
    () => (goal ? journeyGoalProgress(goal, app.data) : undefined),
    [goal, app.data, today],
  );
  const limits = goalTargetBounds(metric, period);
  useTabResetGuard(
    editing &&
      (title.trim() !== (goal?.title ?? defaultTitle) ||
        metric !== (goal?.metric ?? "mindful-minutes") ||
        period !== (goal?.period ?? "week") ||
        target !== String(goal?.target ?? 15)),
  );

  useEffect(() => {
    const refresh = () => setToday(localDay());
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  function startEditing() {
    setTitle(goal?.title ?? defaultTitle);
    setMetric(goal?.metric ?? "mindful-minutes");
    setPeriod(goal?.period ?? "week");
    setTarget(String(goal?.target ?? 15));
    setError("");
    setNotice("");
    setConfirmRemove(false);
    setEditing(true);
  }

  function changeOptions(nextMetric: GoalMetric, nextPeriod: GoalPeriod) {
    setMetric(nextMetric);
    setPeriod(nextPeriod);
    if (!validGoalTarget(nextMetric, nextPeriod, Number(target)))
      setTarget(String(defaultTargets[nextMetric]));
  }

  async function run(operation: () => Promise<void>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await operation();
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update your goal. Try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function saveGoal() {
    const value = Number(target);
    if (!title.trim()) {
      setError("Give your goal a name.");
      return;
    }
    if (!/^\d+$/.test(target) || !validGoalTarget(metric, period, value)) {
      setError(`Choose a whole number from ${limits.min} to ${limits.max}.`);
      return;
    }
    void run(async () => {
      try {
        await app.save("goals", {
          id: goal?.id ?? "personal-weekly-goal",
          title: title.trim(),
          metric,
          period,
          target: value,
          active: goal?.active ?? true,
        });
      } catch (cause) {
        if (!hasStatus(cause, 409) && !hasStatus(cause, 404)) throw cause;
        await app.refresh();
        throw new Error(
          "Your saved goal changed. Review this form and save again when you’re ready.",
        );
      }
      setVisibleCount(8);
      setEditing(false);
    }, "Your goal is saved.");
  }

  return (
    <Screen variant="nested" title="Your goal" back={app.back}>
      {editing ? (
        <View style={styles.editor}>
          <View
            style={[styles.goalLead, { backgroundColor: colors.sageSurface }]}
          >
            <BotanicalBackdrop style={styles.goalLeaves} />
            <Icon name="flag-outline" size={27} color={colors.sageText} />
            <AppText
              variant="display"
              accessibilityRole="header"
              style={styles.goalHeadline}
            >
              {goal ? "Edit your goal" : "Set a personal goal"}
            </AppText>
            <AppText color={colors.muted} style={styles.leadCopy}>
              Choose a small practice and a pace that fits your life.
            </AppText>
          </View>
          <View style={styles.form}>
            <View style={styles.field}>
              <AppText variant="label">Name</AppText>
              <Input
                accessibilityLabel="Personal goal name"
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                editable={!busy}
              />
            </View>
            <View style={styles.field}>
              <AppText variant="label">What would you like to track?</AppText>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Goal metric"
                style={styles.options}
              >
                {goalMetrics.map((option) => (
                  <GoalOption
                    key={option}
                    title={journeyGoalLabels[option]}
                    selected={metric === option}
                    disabled={busy}
                    onPress={() => changeOptions(option, period)}
                  />
                ))}
              </View>
            </View>
            <View
              style={[
                styles.field,
                styles.formRule,
                { borderColor: colors.border },
              ]}
            >
              <AppText variant="label">Period</AppText>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Goal period"
                style={styles.options}
              >
                {goalPeriods.map((option) => (
                  <GoalOption
                    key={option}
                    title={periodOptions[option]}
                    selected={period === option}
                    disabled={busy}
                    onPress={() => changeOptions(metric, option)}
                    equal
                  />
                ))}
              </View>
              <AppText variant="caption" color={colors.muted}>
                Week and month goals follow your local calendar.
              </AppText>
            </View>
            <View
              style={[
                styles.field,
                styles.formRule,
                { borderColor: colors.border },
              ]}
            >
              <AppText variant="label">Target</AppText>
              <Input
                accessibilityLabel="Goal target"
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
                maxLength={String(limits.max).length}
                editable={!busy}
              />
              <AppText variant="caption" color={colors.muted}>
                {limits.min}–{limits.max}{" "}
                {journeyGoalLabels[metric].toLowerCase()}
              </AppText>
            </View>
          </View>
          {!!error && (
            <AppText accessibilityRole="alert" color={colors.danger}>
              {error}
            </AppText>
          )}
          <Button title="Save goal" loading={busy} onPress={saveGoal} />
          <Button
            title="Cancel"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setError("");
              setEditing(false);
            }}
          />
        </View>
      ) : goal && progress ? (
        <>
          <View
            style={[
              styles.goalLead,
              { backgroundColor: colors.lavenderSurface },
            ]}
          >
            <BotanicalBackdrop style={styles.goalLeaves} />
            <Row>
              <Icon name="flag-outline" color={colors.lavenderText} size={18} />
              <AppText
                variant="caption"
                color={colors.lavenderText}
                style={{ flex: 1 }}
              >
                {progress.period}
              </AppText>
            </Row>
            <AppText
              variant="display"
              accessibilityRole="header"
              style={styles.goalHeadline}
            >
              {goal.title}
            </AppText>
            {goal.active ? (
              <>
                <Row style={styles.goalProgressLabel}>
                  <AppText color={colors.muted} style={styles.goalProgressCopy}>
                    {progress.description}
                  </AppText>
                  <AppText
                    variant="label"
                    color={colors.lavenderText}
                    style={styles.progressNumber}
                  >
                    {progress.percentage}%
                  </AppText>
                </Row>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Personal goal progress"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: progress.percentage,
                    text: progress.description,
                  }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percentage}
                  aria-valuetext={progress.description}
                  style={{
                    height: 9,
                    overflow: "hidden",
                    borderRadius: 5,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      width: `${progress.fraction * 100}%`,
                      height: "100%",
                      borderRadius: 5,
                      backgroundColor: colors.lavenderText,
                    }}
                  />
                </View>
                {progress.reached && (
                  <AppText variant="caption" color={colors.sageText}>
                    You reached your target for this period.
                  </AppText>
                )}
              </>
            ) : (
              <AppText color={colors.muted}>
                This goal is paused. Resume whenever you want to see progress
                for the current period.
              </AppText>
            )}
          </View>
          <View style={styles.manageGoal}>
            <EditorialSection title="Manage goal" />
            {!!notice && (
              <AppText accessibilityLiveRegion="polite" color={colors.sageText}>
                {notice}
              </AppText>
            )}
            {!!error && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {error}
              </AppText>
            )}
            <Button
              title="Edit goal"
              variant="secondary"
              disabled={busy}
              onPress={startEditing}
            />
            <Button
              title={goal.active ? "Pause goal" : "Resume goal"}
              variant="ghost"
              disabled={busy}
              onPress={() =>
                void run(
                  async () => {
                    await app.save("goals", {
                      id: goal.id,
                      active: !goal.active,
                    });
                  },
                  goal.active
                    ? "Your goal is paused."
                    : "Your goal has resumed.",
                )
              }
            />
            {confirmRemove ? (
              <>
                <AppText color={colors.muted}>
                  Remove this goal? Your saved activities stay in Journey.
                </AppText>
                <Button
                  title="Confirm removal"
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    void run(async () => {
                      try {
                        await app.remove("goals", goal.id);
                      } catch (cause) {
                        if (!hasStatus(cause, 404)) throw cause;
                        await app.refresh();
                      }
                      setConfirmRemove(false);
                    }, "Your goal was removed.")
                  }
                />
                <Button
                  title="Keep goal"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setConfirmRemove(false)}
                />
              </>
            ) : (
              <Button
                title="Remove goal"
                variant="ghost"
                disabled={busy}
                onPress={() => setConfirmRemove(true)}
              />
            )}
          </View>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ marginTop: 21, marginBottom: 6 }}
          >
            Related activity
          </AppText>
          {progress.activities.length ? (
            <Card>
              {progress.activities.slice(0, visibleCount).map((entry) => (
                <GoalActivity key={entry.key} entry={entry} />
              ))}
              {progress.activities.length > visibleCount && (
                <Button
                  title="Show more activity"
                  variant="ghost"
                  onPress={() => setVisibleCount((count) => count + 8)}
                />
              )}
            </Card>
          ) : (
            <NestedState
              title="Room to begin"
              icon="leaf-outline"
              description={`Saved ${progress.unit} will appear here when you have activity for this period.`}
            />
          )}
        </>
      ) : (
        <NestedState
          title="Make space for a small goal"
          description="A personal goal can help you find a rhythm you want to return to."
          icon="flag-outline"
        >
          {!!notice && (
            <AppText accessibilityLiveRegion="polite" color={colors.sageText}>
              {notice}
            </AppText>
          )}
          <Button
            title="Set a personal goal"
            disabled={busy}
            onPress={startEditing}
          />
        </NestedState>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.row },
  goalLead: {
    borderRadius: 18,
    overflow: "hidden",
    padding: spacing.card,
    gap: spacing.compact,
  },
  goalHeadline: { fontSize: 37, lineHeight: 44 },
  goalLeaves: { top: -50, right: -30, width: 200, height: 200, opacity: 0.3 },
  leadCopy: { maxWidth: 265 },
  form: { gap: spacing.card, paddingTop: spacing.compact },
  formRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.row,
  },
  field: { gap: spacing.compact },
  goalProgressLabel: { alignItems: "flex-start", flexWrap: "wrap" },
  goalProgressCopy: { flex: 1, minWidth: 130 },
  progressNumber: { fontVariant: ["tabular-nums"] },
  manageGoal: { gap: spacing.compact, marginTop: spacing.section },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
  },
  option: {
    minHeight: 48,
    maxWidth: "100%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing.row,
    paddingVertical: 5,
    justifyContent: "center",
  },
  equalOption: { flexGrow: 1, flexBasis: "28%" },
  optionLabel: { textAlign: "center" },
});
