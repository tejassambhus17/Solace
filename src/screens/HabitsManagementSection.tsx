import React, { useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addHabitDays,
  habitInsights,
  habitRevisionOn,
  habitWeekStart,
  isHabitScheduled,
  type Habit,
} from "../../server/src/habit-contract";
import { useReducedMotion } from "../Companion";
import {
  goalLabel,
  HabitIconBadge,
  HabitMeter,
  habitToday,
  occurrenceLabel,
  scheduleLabel,
  starterHabits,
  useHabitClock,
} from "../habits-ui";
import { spacing } from "../layout";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon } from "../ui";
import {
  HabitLogAction,
  useHabitLog,
  useHabitOccurrences,
} from "./HabitsSectionPieces";

type Filter = "all" | "active" | "completed" | "archived";
type Occurrence = ReturnType<typeof useHabitOccurrences>["all"][number];
type Action = "active" | "paused" | "archived" | "delete";
type Confirmation = Extract<Action, "archived" | "delete">;
const pageSize = 12;
const statusOrder = { active: 0, paused: 1, archived: 2 };
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed today" },
  { id: "archived", label: "Archived" },
];
const emptyCopy: Record<Filter, string> = {
  all: "Create a habit or choose a starter to begin.",
  active:
    "Your active habits will appear here. You can resume a paused habit from All.",
  completed: "Habits you complete today will appear here.",
  archived:
    "Archived habits will appear here. You can restore them when you’re ready.",
};

function ManagedHabit({
  occurrence,
  now,
  onMenu,
  onRestore,
  working,
  managing,
}: {
  occurrence: Occurrence;
  now: Date;
  onMenu: () => void;
  onRestore: () => void;
  working: boolean;
  managing: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const { habit, day, log, logs } = occurrence;
  const { write, pending, error } = useHabitLog(occurrence);
  const weekStart = habitWeekStart(day);
  const weekEnd = addHabitDays(weekStart, 6);
  const summary = useMemo(
    () => habitInsights([habit], logs, weekStart, weekEnd, day, now),
    [habit, logs, weekStart, weekEnd, day, now],
  );
  const schedule = habitRevisionOn(habit, day)?.schedule ?? habit.schedule;
  const due = isHabitScheduled(habit, day);
  const canLog = habit.status === "active" && due;
  const status =
    habit.status === "paused"
      ? "Paused"
      : habit.status === "archived"
        ? "Archived"
        : log?.complete
          ? "Completed today"
          : !due
            ? "Not due today"
            : habit.goal.type !== "completion"
              ? occurrenceLabel(habit, day, log)
              : "";
  const stats = [
    schedule.type === "weekly"
      ? [`${summary.completedActions}`, "Completed this week"]
      : [
          `${summary.currentStreak} ${summary.currentStreak === 1 ? "day" : "days"}`,
          "Streak",
        ],
    [
      summary.scheduled ? `${summary.completed}/${summary.scheduled}` : "—",
      "This week’s goals",
    ],
  ];

  return (
    <View style={[styles.habit, { borderColor: colors.border }]}>
      <View style={styles.habitHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${habit.name}`}
          accessibilityHint={status || undefined}
          onPress={() => app.navigate(routes.habitDetails, { id: habit.id })}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <HabitIconBadge icon={habit.icon} color={habit.color} size={45} />
          <View style={styles.fill}>
            <AppText variant="heading" style={styles.habitTitle}>
              {habit.name}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {habit.schedule.type === "daily"
                ? "Daily"
                : scheduleLabel(habit.schedule)}{" "}
              · {goalLabel(habit.goal)}
            </AppText>
            {!!status && (
              <AppText
                variant="caption"
                color={
                  log?.complete && habit.status === "active"
                    ? colors.sageText
                    : colors.muted
                }
              >
                {status}
              </AppText>
            )}
          </View>
        </Pressable>
        <View style={styles.rowActions}>
          {canLog && (
            <HabitLogAction
              occurrence={occurrence}
              disabled={pending}
              onLog={write}
            />
          )}
          {habit.status !== "active" && (
            <Button
              title={habit.status === "paused" ? "Resume" : "Restore"}
              variant="secondary"
              onPress={onRestore}
              loading={working}
              disabled={managing}
              style={styles.restoreButton}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${habit.name}`}
            accessibilityHint="Opens habit actions"
            accessibilityState={{ disabled: managing }}
            disabled={managing}
            onPress={onMenu}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="ellipsis-horizontal" size={22} />
          </Pressable>
        </View>
      </View>
      <View style={styles.stats}>
        {stats.map(([value, label]) => (
          <View key={label} style={styles.stat}>
            <AppText variant="caption" color={colors.muted}>
              {label}
            </AppText>
            <AppText
              variant="label"
              color={colors.lavenderText}
              style={styles.statValue}
            >
              {value}
            </AppText>
          </View>
        ))}
      </View>
      {summary.scheduled > 0 && (
        <HabitMeter
          value={summary.completed}
          total={summary.scheduled}
          label={`${habit.name} weekly progress`}
        />
      )}
      {!!error && (
        <AppText
          variant="caption"
          color={colors.danger}
          accessibilityRole="alert"
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

function HabitActions({
  habit,
  confirmation,
  pending,
  error,
  onClose,
  onConfirm,
  onManage,
  onNavigate,
}: {
  habit: Habit;
  confirmation: Confirmation | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (action: Confirmation | null) => void;
  onManage: (action: Action) => void;
  onNavigate: (route: string) => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const { top, bottom } = useSafeAreaInsets();
  const active = habit.status === "active";
  const archived = habit.status === "archived";
  const items = [
    ...(!archived
      ? [
          {
            label: "Edit habit",
            icon: "create-outline",
            run: () => onNavigate(routes.habitEdit),
          },
          {
            label: "Habit reminder",
            icon: "notifications-outline",
            run: () => onNavigate(routes.habitReminders),
          },
        ]
      : []),
    {
      label: active
        ? "Pause habit"
        : archived
          ? "Restore habit"
          : "Resume habit",
      icon: active
        ? "pause-outline"
        : archived
          ? "refresh-outline"
          : "play-outline",
      run: () => onManage(active ? "paused" : "active"),
    },
    ...(!archived
      ? [
          {
            label: "Archive habit",
            icon: "archive-outline",
            run: () => onConfirm("archived"),
          },
        ]
      : []),
    {
      label: "Delete habit",
      icon: "trash-outline",
      run: () => onConfirm("delete"),
      danger: true,
    },
  ];
  return (
    <Modal
      visible
      transparent
      onRequestClose={onClose}
      animationType={reducedMotion ? "none" : "fade"}
    >
      <View
        style={[
          styles.modal,
          {
            paddingTop: top + spacing.card,
            paddingBottom: bottom + spacing.card,
          },
        ]}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.menu,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.menuContent}
          >
            <View style={styles.habitHeader}>
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.fill}
              >
                {confirmation === "delete"
                  ? "Delete this habit?"
                  : confirmation
                    ? "Archive this habit?"
                    : habit.name}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close habit actions"
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                onPress={onClose}
                style={styles.iconButton}
              >
                <Icon name="close-outline" size={22} />
              </Pressable>
            </View>
            {confirmation ? (
              <>
                <AppText variant="label">{habit.name}</AppText>
                <AppText color={colors.muted}>
                  {confirmation === "delete"
                    ? "This permanently removes the habit and its recorded history. Earned garden growth stays."
                    : "Its future schedule and reminders will stop. Its recorded progress stays."}
                </AppText>
                <Button
                  title={
                    confirmation === "delete"
                      ? "Confirm deletion"
                      : "Confirm archive"
                  }
                  loading={pending}
                  onPress={() => onManage(confirmation)}
                />
                <Button
                  title="Cancel"
                  variant="ghost"
                  disabled={pending}
                  onPress={() => onConfirm(null)}
                />
              </>
            ) : (
              items.map(({ label, icon, run, danger }) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ disabled: pending }}
                  disabled={pending}
                  onPress={run}
                  style={({ pressed }) => [
                    styles.menuAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={icon}
                    color={danger ? colors.danger : colors.lavenderText}
                  />
                  <AppText
                    variant="label"
                    style={styles.fill}
                    color={danger ? colors.danger : colors.text}
                  >
                    {label}
                  </AppText>
                </Pressable>
              ))
            )}
            {!!error && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {error}
              </AppText>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function HabitsManagementSection({
  onOpenToday,
}: { onOpenToday?: () => void } = {}) {
  const app = useApp();
  const { colors } = useTheme();
  const { habits, habitProgress } = app.data;
  const now = useHabitClock(habits);
  const { all, fixed, completed } = useHabitOccurrences(
    habits,
    habitProgress,
    now,
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(pageSize);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showStarters, setShowStarters] = useState(false);
  const writing = useRef(false);
  const menuHabit = habits.find(({ id }) => id === menuId);
  const activeCount = all.filter(
    ({ habit }) => habit.status === "active",
  ).length;
  const completedCount = all.filter(({ log }) => log?.complete).length;
  const archivedCount = all.filter(
    ({ habit }) => habit.status === "archived",
  ).length;
  const counts = {
    all: all.length,
    active: activeCount,
    completed: completedCount,
    archived: archivedCount,
  };
  const visible = useMemo(
    () =>
      all
        .filter(
          ({ habit, log }) =>
            filter === "all" ||
            (filter === "completed"
              ? !!log?.complete
              : habit.status === filter),
        )
        .sort(
          (a, b) => statusOrder[a.habit.status] - statusOrder[b.habit.status],
        ),
    [all, filter],
  );

  function closeMenu() {
    if (writing.current) return;
    setMenuId(null);
    setConfirmation(null);
    setError("");
  }

  async function manage(habit: Habit, action: Action) {
    if (writing.current) return;
    writing.current = true;
    setPendingId(habit.id);
    setError("");
    setNotice("");
    try {
      const result =
        action === "delete"
          ? await app.deleteHabit(habit.id)
          : await app.editHabit(habit.id, habit.revision, { status: action });
      const savedNotice =
        action === "delete"
          ? "Habit deleted."
          : action === "archived"
            ? "Habit archived. Its history is still here."
            : action === "paused"
              ? "Habit paused. Its history is still here."
              : habit.status === "archived"
                ? "Habit restored."
                : "Habit resumed.";
      setNotice(result.reminderNotice ?? savedNotice);
      setConfirmation(null);
      setMenuId(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your changes could not be saved.",
      );
    } finally {
      writing.current = false;
      setPendingId(null);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.filters}>
        {filters.map(({ id, label }) => {
          const selected = id === filter;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${counts[id]} habits`}
              accessibilityState={{ selected }}
              aria-pressed={selected}
              onPress={() => {
                setFilter(id);
                setLimit(pageSize);
              }}
              style={({ pressed }) => [
                styles.filter,
                {
                  backgroundColor: selected
                    ? colors.tabActiveSurface
                    : "transparent",
                  borderColor: selected ? colors.lavender : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <AppText
                variant="caption"
                color={selected ? colors.tabActiveText : colors.text}
                style={styles.filterLabel}
              >
                {label} {counts[id]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {!!notice && (
        <AppText
          variant="caption"
          accessibilityLiveRegion="polite"
          color={colors.sageText}
        >
          {notice}
        </AppText>
      )}
      {!menuHabit && !!error && (
        <AppText
          variant="caption"
          accessibilityRole="alert"
          color={colors.danger}
        >
          {error}
        </AppText>
      )}
      {!visible.length && (
        <Card style={styles.empty}>
          <Icon
            name={filter === "archived" ? "archive-outline" : "leaf-outline"}
            color={colors.sageText}
          />
          <AppText variant="heading">
            {filter === "all"
              ? "A little room to grow"
              : `No ${filter === "completed" ? "habits completed today" : `${filter} habits`}`}
          </AppText>
          <AppText color={colors.muted}>{emptyCopy[filter]}</AppText>
        </Card>
      )}
      <View style={styles.list}>
        {visible.slice(0, limit).map((occurrence) => (
          <ManagedHabit
            key={`${occurrence.habit.id}:${occurrence.day}`}
            occurrence={occurrence}
            now={now}
            working={pendingId === occurrence.habit.id}
            managing={pendingId !== null}
            onRestore={() => void manage(occurrence.habit, "active")}
            onMenu={() => {
              setNotice("");
              setError("");
              setConfirmation(null);
              setMenuId(occurrence.habit.id);
            }}
          />
        ))}
      </View>
      {visible.length > limit && (
        <Button
          title="Show more habits"
          variant="ghost"
          onPress={() => setLimit(limit + pageSize)}
        />
      )}
      {!!fixed.length && (
        <Card
          onPress={onOpenToday}
          accessibilityLabel="View today's progress"
          style={[styles.summary, { backgroundColor: colors.sageSurface }]}
        >
          <Icon name="leaf-outline" color={colors.sageText} size={25} />
          <View style={styles.fill}>
            <AppText variant="heading">Keep going</AppText>
            <AppText variant="caption" color={colors.muted}>
              {completed} of {fixed.length} scheduled habits completed today.
            </AppText>
          </View>
          {!!onOpenToday && (
            <Icon name="chevron-forward" color={colors.sageText} size={19} />
          )}
        </Card>
      )}
      <Button
        title={showStarters ? "Hide starter ideas" : "Browse starter ideas"}
        icon={showStarters ? "chevron-up" : "leaf-outline"}
        variant="ghost"
        onPress={() => setShowStarters(!showStarters)}
      />
      {showStarters && (
        <View style={styles.list}>
          {starterHabits.map((suggestion) => (
            <Card
              key={suggestion.name}
              onPress={() => app.navigate(routes.habitCreate, { suggestion })}
              accessibilityLabel={`Use starter ${suggestion.name}`}
              style={styles.summary}
            >
              <HabitIconBadge icon={suggestion.icon} color={suggestion.color} />
              <View style={styles.fill}>
                <AppText variant="label">{suggestion.name}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {goalLabel(suggestion.goal)} ·{" "}
                  {scheduleLabel(suggestion.schedule)}
                </AppText>
              </View>
              <Icon name="add-circle-outline" color={colors.lavenderText} />
            </Card>
          ))}
        </View>
      )}
      {menuHabit && (
        <HabitActions
          habit={menuHabit}
          confirmation={confirmation}
          error={error}
          pending={pendingId === menuHabit.id}
          onClose={closeMenu}
          onConfirm={(action) => {
            setConfirmation(action);
            setError("");
          }}
          onManage={(action) => void manage(menuHabit, action)}
          onNavigate={(route) => {
            closeMenu();
            app.navigate(route, { id: menuHabit.id });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.card },
  list: { gap: spacing.row },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  filter: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 48,
    flexBasis: "44%",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.row,
    paddingVertical: 5,
  },
  filterLabel: { flexShrink: 1, textAlign: "center" },
  empty: { gap: spacing.compact },
  habit: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.card,
    gap: spacing.row,
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    flexWrap: "wrap",
  },
  identity: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 154,
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.row,
  },
  habitTitle: { fontSize: 28, lineHeight: 33 },
  fill: { flex: 1, minWidth: 0 },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: "auto",
  },
  iconButton: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreButton: { minHeight: 44, paddingHorizontal: spacing.row },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.row,
  },
  stat: { flexGrow: 1, flexShrink: 1, flexBasis: 60, gap: 2 },
  statValue: { fontVariant: ["tabular-nums"] },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    borderRadius: 20,
    padding: spacing.row,
  },
  modal: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.card,
  },
  menu: {
    width: "100%",
    maxWidth: 410,
    maxHeight: "100%",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  menuContent: { gap: spacing.compact, padding: spacing.card },
  menuAction: {
    minHeight: 48,
    padding: spacing.compact,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  pressed: { opacity: 0.72 },
});
