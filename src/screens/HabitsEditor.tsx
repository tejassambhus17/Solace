import React, { useLayoutEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Switch, View } from "react-native";
import {
  habitCategories,
  habitColors,
  habitIcons,
  type Habit,
  type HabitDraft,
  type HabitGoal,
  type HabitSchedule,
} from "../../server/src/habit-contract";
import { useReducedMotion } from "../Companion";
import { spacing } from "../layout";
import {
  blankHabit,
  habitCategoryLabels,
  habitIconNames,
  habitWeekdays,
  HabitChoice,
  HabitIconBadge,
  reminderLabel,
  scheduleLabel,
} from "../habits-ui";
import { useTabResetGuard } from "../navigation-reset";
import { routes } from "../routes";
import { newChatRequestId, useApp } from "../store";
import { useTheme } from "../theme";
import { formatReminderTime, validReminderTime } from "../reminder-time";
import { switchColors } from "../switch-colors";
import {
  AppText,
  BotanicalBackdrop,
  Button,
  Card,
  Icon,
  Input,
  Row,
  Screen,
} from "../ui";

const goalOptions = [
  { type: "completion", label: "Once" },
  { type: "quantity", label: "Quantity" },
  { type: "duration", label: "Duration" },
] as const;
const scheduleOptions = [
  { type: "daily", label: "Every day" },
  { type: "weekdays", label: "Specific weekdays" },
  { type: "weekly", label: "Days per week" },
] as const;

const textFor = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function habitAsDraft({
  name,
  description,
  category,
  icon,
  color,
  goal,
  schedule,
  reminderTime,
  activity,
}: Habit): HabitDraft {
  return {
    name,
    description,
    category,
    icon,
    color,
    goal,
    schedule,
    reminderTime,
    activity,
  };
}

export function HabitFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.formSection, { borderColor: colors.border }]}>
      <View style={styles.sectionHeading}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {!!description && (
          <AppText variant="caption" color={colors.muted}>
            {description}
          </AppText>
        )}
      </View>
      {children}
    </View>
  );
}

export function ReminderFields({
  enabled,
  value,
  onToggle,
  onChange,
  disabled,
}: {
  enabled: boolean;
  value: string;
  onToggle: (enabled: boolean) => void;
  onChange: (time: string) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <AppText variant="label">Remind me</AppText>
          <AppText variant="caption" color={colors.muted}>
            Solace checks notification permission when you save an enabled
            reminder.
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Remind me"
          disabled={disabled}
          value={enabled}
          {...switchColors(colors, enabled)}
          onValueChange={onToggle}
        />
      </View>
      {enabled && (
        <>
          <AppText variant="label">Reminder time</AppText>
          <Input
            accessibilityLabel="Reminder time"
            placeholder="08:30"
            autoCorrect={false}
            maxLength={5}
            value={value}
            onChangeText={(value) => onChange(formatReminderTime(value))}
            keyboardType="number-pad"
            editable={!disabled}
          />
          <AppText variant="caption" color={colors.muted}>
            Use 24-hour time, such as 08:30 or 19:15.
          </AppText>
        </>
      )}
    </View>
  );
}

export function HabitsEditor({
  habit,
  suggestion,
  suggestionRevision,
  embedded = false,
}: {
  habit?: Habit;
  suggestion?: HabitDraft;
  suggestionRevision?: number;
  embedded?: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const staleSuggestion =
    !!habit &&
    typeof suggestionRevision === "number" &&
    suggestionRevision !== habit.revision;
  const acceptedSuggestion = staleSuggestion ? undefined : suggestion;
  const [original] = useState(() => (habit ? habitAsDraft(habit) : blankHabit));
  const [initial] = useState(() => acceptedSuggestion ?? original);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.category);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  const [goalType, setGoalType] = useState(initial.goal.type);
  const [target, setTarget] = useState(
    initial.goal.type === "completion" ? "1" : String(initial.goal.target),
  );
  const [unit, setUnit] = useState(
    initial.goal.type === "quantity" ? initial.goal.unit : "",
  );
  const [linked, setLinked] = useState(initial.activity === "breathing");
  const [scheduleType, setScheduleType] = useState(initial.schedule.type);
  const [days, setDays] = useState(
    initial.schedule.type === "weekdays" ? initial.schedule.days : [1, 3, 5],
  );
  const [weeklyTarget, setWeeklyTarget] = useState(
    initial.schedule.type === "weekly"
      ? String(initial.schedule.daysPerWeek)
      : "3",
  );
  const [reminder, setReminder] = useState(initial.reminderTime != null);
  const [reminderTime, setReminderTime] = useState(
    initial.reminderTime ?? "08:30",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reminderNotice, setReminderNotice] = useState("");
  const working = useRef(false);
  const didFinish = useRef(false);
  const mounted = useRef(true);
  const animation = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const [arrival] = useState(() => new Animated.Value(1));
  const [identity] = useState(newChatRequestId);
  const [expectedRevision] = useState(habit?.revision);
  const originalGoal = original.goal;
  const originalSchedule = original.schedule;
  useTabResetGuard(
    busy ||
      (!saved &&
        (name.trim() !== original.name ||
          description.trim() !== (original.description ?? "") ||
          category !== original.category ||
          icon !== original.icon ||
          color !== original.color ||
          goalType !== originalGoal.type ||
          (goalType !== "completion" &&
            originalGoal.type !== "completion" &&
            target !== String(originalGoal.target)) ||
          (goalType === "quantity" &&
            originalGoal.type === "quantity" &&
            unit.trim() !== originalGoal.unit) ||
          (goalType === "duration" &&
            linked !== (original.activity === "breathing")) ||
          scheduleType !== originalSchedule.type ||
          (scheduleType === "weekdays" &&
            originalSchedule.type === "weekdays" &&
            (days.length !== originalSchedule.days.length ||
              originalSchedule.days.some((day) => !days.includes(day)))) ||
          (scheduleType === "weekly" &&
            originalSchedule.type === "weekly" &&
            weeklyTarget !== String(originalSchedule.daysPerWeek)) ||
          (reminder ? reminderTime.trim() : null) !== original.reminderTime)),
    busy ? "saving" : "dirty",
  );

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      animation.current?.stop();
    };
  }, []);

  function finish() {
    if (didFinish.current) return;
    didFinish.current = true;
    if (habit || embedded) app.back();
    else {
      app.back();
      app.navigate(routes.habits);
    }
  }

  async function save() {
    if (working.current || saved) return;
    if (!name.trim()) {
      setError("Give your habit a name before saving.");
      return;
    }
    const amount = Number(target);
    if (
      goalType !== "completion" &&
      (!/^\d+$/.test(target.trim()) ||
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > (goalType === "duration" ? 720 : 1000))
    ) {
      setError(
        goalType === "duration"
          ? "Enter a duration from 1 to 720 minutes."
          : "Enter a quantity from 1 to 1000.",
      );
      return;
    }
    if (goalType === "quantity" && !unit.trim()) {
      setError("Add a unit for the quantity, such as glasses or pages.");
      return;
    }
    if (scheduleType === "weekdays" && !days.length) {
      setError("Choose at least one weekday.");
      return;
    }
    const daysPerWeek = Number(weeklyTarget);
    if (
      scheduleType === "weekly" &&
      (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
    ) {
      setError("Choose between 1 and 7 days per week.");
      return;
    }
    if (reminder && !validReminderTime(reminderTime)) {
      setError("Enter a reminder time in 24-hour format, such as 08:30.");
      return;
    }
    const goal: HabitGoal =
      goalType === "completion"
        ? { type: "completion" }
        : goalType === "duration"
          ? { type: "duration", target: amount }
          : { type: "quantity", target: amount, unit: unit.trim() };
    const schedule: HabitSchedule =
      scheduleType === "daily"
        ? { type: "daily" }
        : scheduleType === "weekdays"
          ? { type: "weekdays", days }
          : { type: "weekly", daysPerWeek };
    const draft: HabitDraft = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      icon,
      color,
      goal,
      schedule,
      reminderTime: reminder ? reminderTime.trim() : null,
      activity: linked && goalType === "duration" ? "breathing" : undefined,
    };
    working.current = true;
    setBusy(true);
    setError("");
    try {
      const result = habit
        ? await app.editHabit(habit.id, expectedRevision ?? habit.revision, {
            draft,
          })
        : await app.createHabit(draft, identity);
      setSaved(true);
      if (result.reminderNotice) {
        setReminderNotice(result.reminderNotice);
        return;
      }
      if (!mounted.current) return;
      if (reduceMotion) {
        finish();
        return;
      }
      arrival.setValue(0.82);
      animation.current = Animated.timing(arrival, {
        toValue: 1,
        duration: 235,
        useNativeDriver: Platform.OS !== "web",
        isInteraction: false,
      });
      animation.current.start(({ finished }) => {
        if (finished && mounted.current) finish();
      });
    } catch (cause) {
      setError(
        textFor(cause, "Your habit could not be saved. You can try again."),
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <Screen
        variant="nested"
        edgeToEdgeTop={embedded}
        title={embedded ? undefined : habit ? "Edit habit" : "Create habit"}
        back={embedded ? undefined : app.back}
      >
        <Animated.View style={{ opacity: arrival }}>
          <Card style={styles.saved}>
            <HabitIconBadge icon={icon} color={color} />
            <AppText variant="title" accessibilityRole="header">
              Habit saved
            </AppText>
            <AppText>{name.trim()} is in your habits.</AppText>
            {!!reminderNotice && (
              <AppText color={colors.muted}>{reminderNotice}</AppText>
            )}
            <Button
              title={habit ? "Back to habit" : "Back to your habits"}
              onPress={finish}
            />
          </Card>
        </Animated.View>
      </Screen>
    );
  }

  return (
    <Screen
      variant="nested"
      edgeToEdgeTop={embedded}
      title={embedded ? undefined : habit ? "Edit habit" : "Create habit"}
      back={embedded ? undefined : app.back}
    >
      <View style={styles.page}>
        <View
          style={[styles.editorCover, { backgroundColor: colors.sageSurface }]}
        >
          <BotanicalBackdrop style={styles.coverLeaves} />
          <HabitIconBadge icon={icon} color={color} size={44} />
          <AppText
            variant="display"
            accessibilityRole="header"
            style={styles.editorTitle}
          >
            {habit ? "Make it work for you" : "Start with something small"}
          </AppText>
          <AppText color={colors.muted}>
            {habit
              ? "Your earlier progress will stay in your history."
              : "Choose a step you can imagine taking on an ordinary day."}
          </AppText>
          {acceptedSuggestion && (
            <AppText variant="caption" color={colors.lavenderText}>
              This is an editable suggestion. It takes effect when you save.
            </AppText>
          )}
          {staleSuggestion && (
            <AppText variant="caption" color={colors.muted}>
              This habit changed after the suggestion. Your latest settings are
              shown.
            </AppText>
          )}
        </View>

        <HabitFormSection title="Your habit">
          <View style={styles.field}>
            <AppText variant="label">Habit name</AppText>
            <Input
              accessibilityLabel="Habit name"
              placeholder="Take a short walk"
              maxLength={80}
              value={name}
              onChangeText={setName}
              editable={!busy}
            />
          </View>
          <View style={styles.field}>
            <AppText variant="label">Description (optional)</AppText>
            <Input
              accessibilityLabel="Habit description"
              placeholder="What would make it easier to begin?"
              maxLength={280}
              multiline
              value={description}
              onChangeText={setDescription}
              editable={!busy}
            />
          </View>
          <AppText variant="label">Category</AppText>
          <View style={styles.choices}>
            {habitCategories.map((item) => (
              <HabitChoice
                key={item}
                label={habitCategoryLabels[item]}
                selected={category === item}
                onPress={() => setCategory(item)}
                disabled={busy}
              />
            ))}
          </View>
          <AppText variant="label">Icon</AppText>
          <View style={styles.choices}>
            {habitIcons.map((item) => (
              <HabitChoice
                key={item}
                label={habitIconNames[item].label}
                icon={habitIconNames[item].name}
                selected={icon === item}
                onPress={() => setIcon(item)}
                disabled={busy}
              />
            ))}
          </View>
          <AppText variant="label">Color</AppText>
          <View style={styles.choices}>
            {habitColors.map((item) => (
              <HabitChoice
                key={item}
                label={item[0].toUpperCase() + item.slice(1)}
                selected={color === item}
                onPress={() => setColor(item)}
                disabled={busy}
              />
            ))}
          </View>
        </HabitFormSection>

        <HabitFormSection
          title="Set a goal"
          description="Choose what counts as a completed day."
        >
          <View style={styles.choices}>
            {goalOptions.map((item) => (
              <HabitChoice
                key={item.type}
                label={item.label}
                selected={goalType === item.type}
                onPress={() => setGoalType(item.type)}
                disabled={busy}
              />
            ))}
          </View>
          {goalType !== "completion" && (
            <View style={styles.field}>
              <AppText variant="label">
                {goalType === "duration" ? "Minutes" : "Target quantity"}
              </AppText>
              <Input
                accessibilityLabel={
                  goalType === "duration" ? "Target minutes" : "Target quantity"
                }
                keyboardType="number-pad"
                maxLength={4}
                value={target}
                onChangeText={setTarget}
                editable={!busy}
              />
              {goalType === "quantity" && (
                <>
                  <AppText variant="label">Unit</AppText>
                  <Input
                    accessibilityLabel="Quantity unit"
                    placeholder="glasses, pages or steps"
                    maxLength={28}
                    value={unit}
                    onChangeText={setUnit}
                    editable={!busy}
                  />
                </>
              )}
              {goalType === "duration" && (
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <AppText variant="label">Count breathing Moments</AppText>
                    <AppText variant="caption" color={colors.muted}>
                      Apply a completed breathing session from this habit's
                      details.
                    </AppText>
                  </View>
                  <Switch
                    accessibilityLabel="Count breathing Moments"
                    value={linked}
                    onValueChange={setLinked}
                    disabled={busy}
                    {...switchColors(colors, linked)}
                  />
                </View>
              )}
            </View>
          )}
        </HabitFormSection>

        <HabitFormSection
          title="Choose your rhythm"
          description="Pick set days or leave room to choose your days each week."
        >
          <View style={styles.choices}>
            {scheduleOptions.map((item) => (
              <HabitChoice
                key={item.type}
                label={item.label}
                selected={scheduleType === item.type}
                onPress={() => setScheduleType(item.type)}
                disabled={busy}
              />
            ))}
          </View>
          {scheduleType === "weekdays" && (
            <View style={styles.choices}>
              {habitWeekdays.map(({ label, index }) => (
                <HabitChoice
                  key={index}
                  label={label}
                  selected={days.includes(index)}
                  onPress={() =>
                    setDays((previous) =>
                      previous.includes(index)
                        ? previous.filter((day) => day !== index)
                        : [...previous, index],
                    )
                  }
                  disabled={busy}
                />
              ))}
            </View>
          )}
          {scheduleType === "weekly" && (
            <View style={styles.field}>
              <AppText variant="label">Flexible days per week</AppText>
              <Input
                accessibilityLabel="Flexible days per week"
                keyboardType="number-pad"
                maxLength={1}
                value={weeklyTarget}
                onChangeText={setWeeklyTarget}
                editable={!busy}
              />
              <AppText variant="caption" color={colors.muted}>
                Choose any days that work for you. Progress is measured across
                the week.
              </AppText>
            </View>
          )}
        </HabitFormSection>

        <HabitFormSection
          title="Gentle reminder"
          description={
            scheduleType === "weekly"
              ? "A flexible goal can have a daily nudge without making every day required."
              : "Choose a local time on the days this habit is scheduled."
          }
        >
          <ReminderFields
            enabled={reminder}
            value={reminderTime}
            onToggle={setReminder}
            onChange={setReminderTime}
            disabled={busy}
          />
        </HabitFormSection>

        {!!error && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {error}
          </AppText>
        )}
        <Button
          title={habit ? "Save changes" : "Save habit"}
          icon="checkmark"
          loading={busy}
          onPress={save}
        />
      </View>
    </Screen>
  );
}

export function HabitReminderEditor({
  habit,
  embedded = false,
}: {
  habit: Habit;
  embedded?: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(habit.reminderTime != null);
  const [time, setTime] = useState(habit.reminderTime ?? "08:30");
  const [savedTime, setSavedTime] = useState(habit.reminderTime);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const guard = useRef(false);
  const reminderTime = enabled ? time.trim() : null;
  useTabResetGuard(
    pending || reminderTime !== savedTime,
    pending ? "saving" : "dirty",
  );

  async function run(retry = false) {
    if (guard.current) return;
    if (!retry && enabled && !validReminderTime(time)) {
      setError("Enter a time such as 08:30.");
      return;
    }
    guard.current = true;
    setPending(true);
    setNotice("");
    setError("");
    try {
      if (retry) {
        const result = await app.retryHabitReminder(habit);
        setNotice(result || "Reminder schedule checked on this device.");
      } else {
        const result = await app.editHabit(habit.id, habit.revision, {
          draft: {
            ...habitAsDraft(habit),
            reminderTime,
          },
        });
        setSavedTime(reminderTime);
        setNotice(
          result.reminderNotice ||
            (enabled ? "Reminder saved." : "Reminder turned off."),
        );
      }
    } catch (cause) {
      setError(textFor(cause, "The reminder could not be saved."));
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <Screen
      variant="nested"
      edgeToEdgeTop={embedded}
      title={embedded ? undefined : "Habit reminder"}
      back={embedded ? undefined : app.back}
    >
      <View style={styles.page}>
        <View
          style={[
            styles.editorCover,
            { backgroundColor: colors.lavenderSurface },
          ]}
        >
          <BotanicalBackdrop style={styles.coverLeaves} />
          <Row>
            <Icon
              name="notifications-outline"
              color={colors.lavenderText}
              size={25}
            />
            <AppText
              variant="label"
              color={colors.lavenderText}
              style={styles.grow}
            >
              {habit.name}
            </AppText>
          </Row>
          <AppText
            variant="display"
            accessibilityRole="header"
            style={styles.editorTitle}
          >
            {savedTime ? reminderLabel(savedTime) : "No reminder set"}
          </AppText>
          {savedTime && (
            <AppText variant="caption" color={colors.lavenderText}>
              Saved time ·{" "}
              {habit.schedule.type === "weekly"
                ? "Daily nudge for a flexible goal"
                : scheduleLabel(habit.schedule)}
            </AppText>
          )}
          <AppText color={colors.muted}>
            {habit.status === "active"
              ? "Choose a quiet nudge that works for your day."
              : "This habit has no active device reminder while it is paused or archived."}
          </AppText>
        </View>
        <HabitFormSection title="Delivery preferences">
          <ReminderFields
            enabled={enabled}
            value={time}
            onToggle={setEnabled}
            onChange={setTime}
            disabled={pending}
          />
        </HabitFormSection>
        {!!notice && (
          <AppText accessibilityLiveRegion="polite" color={colors.muted}>
            {notice}
          </AppText>
        )}
        {!!error && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {error}
          </AppText>
        )}
        <Button
          title="Save reminder"
          loading={pending}
          onPress={() => void run()}
        />
        {!!habit.reminderTime && habit.status === "active" && (
          <Button
            title="Retry device scheduling"
            variant="ghost"
            disabled={pending}
            onPress={() => void run(true)}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.card },
  formSection: {
    gap: spacing.row,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.card,
  },
  editorCover: {
    gap: spacing.compact,
    padding: spacing.card,
    borderRadius: 16,
    overflow: "hidden",
  },
  editorTitle: { fontSize: 35, lineHeight: 41, maxWidth: 260 },
  coverLeaves: { top: -36, right: -22, width: 164, height: 164, opacity: 0.32 },
  sectionHeading: { gap: 4 },
  grow: { flex: 1, minWidth: 0 },
  field: { gap: spacing.compact },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 12,
  },
  switchCopy: { flex: 1, gap: 4 },
  saved: { alignItems: "flex-start", gap: 14 },
});
