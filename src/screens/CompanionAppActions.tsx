import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  readAppAction,
  type AppAction,
} from "../../server/src/companion-app-action";
import {
  habitCompletion,
  habitCompletionSummary,
  habitFromAction,
  habitScheduleFromAction,
  actionScheduleLabel,
  companionPractice,
  journeyActionSummary,
  matchingCompanionHabits,
  normalizeActionName,
  openCompanionDestination,
  reminderFromAction,
} from "../companion-actions";
import { goalLabel, scheduleLabel } from "../habits-ui";
import { spacing } from "../layout";
import { reminderClockLabel } from "../reminder-time";
import { isRecordId, routes } from "../routes";
import { isMatchingReminder, saveReminder } from "../save-reminder";
import type { AppState } from "../store";
import { useTheme } from "../theme";
import { techniqueArtwork } from "../technique-artwork";
import { AppText, Button, Card } from "../ui";
import { SolaceRecommendationCard } from "./SolaceRecommendationCard";

type Prompt = {
  actionId?: string;
  conversationId?: string;
  title: string;
  description: string;
  error?: string;
  practice?: { durationSec: number; artwork: keyof typeof techniqueArtwork };
  choices?: { label: string; confirm: () => Promise<string | void> }[];
};

function actionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Solace couldn’t confirm the result. Please check and try again.";
}

function signedIn(app: AppState) {
  return (
    !!app.user?.id &&
    !!app.token &&
    !app.sessionExpired &&
    !app.appLocked &&
    !app.privacyCovered
  );
}

export function useCompanionActions(
  app: AppState,
  options?: {
    beforeNavigation?: () => void;
    verifyConfirmation?: (actionId: string) => Promise<void>;
    onResult?: (
      actionId: string,
      result: { ok: boolean; message: string },
    ) => void | Promise<void>;
  },
) {
  const { saveMode } = useTheme();
  const latestApp = useRef(app);
  latestApp.current = app;
  const active = useRef(false);
  const executing = useRef(false);
  const handled = useRef(new Set<string>());
  const [prompt, setPrompt] = useState<Prompt>();
  const [busy, setBusy] = useState(false);
  const pending = useRef<Prompt | undefined>(undefined);

  function show(next?: Prompt) {
    pending.current = next;
    setPrompt(next);
  }
  useEffect(() => {
    active.current = true;
    show();
    setBusy(executing.current);
    return () => {
      active.current = false;
      pending.current = undefined;
    };
  }, [app.user?.id]);

  function cancelPending(actionId?: string) {
    if (executing.current || !pending.current?.choices) return false;
    if (actionId && pending.current.actionId !== actionId) return false;
    show();
    return true;
  }

  function report(actionId: string | undefined, ok: boolean, message: string) {
    if (!actionId || !options?.onResult) return;
    void Promise.resolve()
      .then(() => options.onResult!(actionId, { ok, message }))
      .catch(() => {});
  }

  async function execute(
    work: () => Promise<string | void>,
    proposed?: Prompt,
    actionId = proposed?.actionId,
  ) {
    if (executing.current) return;
    const owner = latestApp.current.user?.id;
    if (!active.current || !signedIn(latestApp.current)) return;
    executing.current = true;
    if (proposed) setBusy(true);
    let verified = false;
    try {
      if (proposed?.actionId) {
        await options?.verifyConfirmation?.(proposed.actionId);
        if (pending.current !== proposed)
          throw new Error("This action is no longer pending.");
        verified = true;
      }
      const description = await work();
      if (active.current && latestApp.current.user?.id === owner) {
        if (description === undefined) show();
        else {
          show({ title: "Solace action", description });
          report(actionId, true, description);
        }
      }
    } catch (error) {
      if (active.current && latestApp.current.user?.id === owner) {
        show(
          verified && !options?.verifyConfirmation && proposed
            ? { ...proposed, error: actionError(error) }
            : {
                title: "Couldn’t complete the action",
                description: actionError(error),
              },
        );
        report(actionId, false, actionError(error));
      }
    } finally {
      executing.current = false;
      if (proposed && active.current) setBusy(false);
    }
  }

  function receive(value: unknown, conversationId?: string) {
    const action = readAppAction(value);
    const current = latestApp.current;
    if (
      !action ||
      !active.current ||
      !signedIn(current) ||
      handled.current.has(action.id)
    )
      return;
    handled.current.add(action.id);
    if (action.kind === "cancel") {
      cancelPending();
      return;
    }
    if (executing.current) return;
    if (action.kind === "confirm") {
      const proposal = pending.current;
      if (
        proposal?.actionId === action.targetId &&
        proposal.conversationId === conversationId
      ) {
        if (proposal.choices?.length === 1)
          void execute(proposal.choices[0].confirm, proposal);
        else if (proposal.choices?.length)
          show({
            ...proposal,
            error: "Choose the exact item before confirming.",
          });
      } else {
        show({
          title: "No action saved",
          description:
            "This proposal is no longer open. Ask again to review it.",
        });
      }
      return;
    }
    const owner = current.user!.id!;
    const authorized = () => {
      const account = latestApp.current;
      if (!active.current || !signedIn(account) || account.user?.id !== owner)
        throw new Error("Your session changed. Open Companion and try again.");
      return account;
    };
    const propose = (details: Omit<Prompt, "actionId" | "conversationId">) =>
      show({ ...details, actionId: action.id, conversationId });
    const outcome = (title: string, description: string, ok = true) => {
      show({ title, description });
      report(action.id, ok, description);
    };

    switch (action.kind) {
      case "practice-start": {
        const activity = companionPractice(action);
        if (!activity) {
          outcome(
            "Practice couldn’t be opened",
            "This practice is unavailable right now.",
            false,
          );
          break;
        }
        const artwork = {
          breathing: "breathe",
          grounding: "ground",
          "wind-down": "sleep",
          focus: "ground",
        } as const;
        propose({
          title: activity.title,
          description: activity.description,
          practice: {
            durationSec: activity.durationSec,
            artwork: artwork[action.practice],
          },
          choices: [
            {
              label: "Start practice",
              confirm: async () => {
                const account = authorized();
                Keyboard.dismiss();
                options?.beforeNavigation?.();
                openCompanionDestination(account, action, conversationId);
              },
            },
          ],
        });
        break;
      }
      case "navigate":
      case "progress":
      case "journal-search":
        Keyboard.dismiss();
        show();
        options?.beforeNavigation?.();
        openCompanionDestination(current, action, conversationId);
        break;
      case "theme":
        void execute(
          async () => {
            authorized();
            await saveMode(action.mode);
            return action.mode === "system"
              ? "Solace now follows your device appearance."
              : `Switched to ${action.mode} mode.`;
          },
          undefined,
          action.id,
        );
        break;
      case "habit-progress": {
        const count = habitCompletionSummary(current.data, action.period);
        outcome(
          "Habit progress",
          `You recorded ${count} habit ${count === 1 ? "completion" : "completions"} this ${action.period}.`,
        );
        break;
      }
      case "journey-summary":
        outcome("Your Journey", journeyActionSummary(current.data, action));
        break;
      case "habit-list": {
        const count = current.data.habits.filter(
          (habit) => habit.status === "active",
        ).length;
        outcome(
          "Your Habits",
          count
            ? `You have ${count} active ${count === 1 ? "habit" : "habits"}. Open My Habits for the full list.`
            : "There are no active habits in My Habits.",
        );
        break;
      }
      case "habit-open": {
        const matches = matchingCompanionHabits(
          current.data,
          action.name,
          true,
        );
        if (matches.length !== 1) {
          outcome(
            "Habit couldn’t be opened",
            matches.length
              ? "Multiple habits have that name. Open My Habits to choose one."
              : "I couldn’t find a habit with that exact name.",
            false,
          );
          break;
        }
        Keyboard.dismiss();
        show();
        options?.beforeNavigation?.();
        current.navigate(routes.explore);
        current.navigate(routes.habitLibrary);
        current.navigate(routes.habitDetails, { id: matches[0].id });
        break;
      }
      case "habit-create": {
        const draft = habitFromAction(action);
        const reminder = draft.reminderTime
          ? ` · Reminder at ${reminderClockLabel({ hour: Number(draft.reminderTime.slice(0, 2)), minute: Number(draft.reminderTime.slice(3)) })}`
          : " · No reminder";
        propose({
          title: "Create habit?",
          description: `${draft.name} · ${actionScheduleLabel(action.schedule, action.days)} · ${goalLabel(draft.goal)}${reminder}`,
          choices: [
            {
              label: "Create habit",
              confirm: async () => {
                const result = await authorized().createHabit(
                  draft,
                  `companion-${action.id}`,
                );
                return [
                  `“${result.habit.name}” was saved to My Habits.`,
                  result.reminderNotice,
                ]
                  .filter(Boolean)
                  .join(" ");
              },
            },
          ],
        });
        break;
      }
      case "habit-update":
      case "habit-archive": {
        const matches = matchingCompanionHabits(
          current.data,
          action.name,
          true,
        );
        const archive = action.kind === "habit-archive";
        if (matches.length !== 1) {
          outcome(
            "No habit updated",
            matches.length
              ? "Multiple habits have that name. Open My Habits to choose one."
              : "I couldn’t find a habit with that exact name.",
            false,
          );
          break;
        }
        const habit = matches[0];
        const schedule =
          !archive && action.schedule
            ? habitScheduleFromAction(action.schedule, action.days)
            : habit.schedule;
        const name = !archive ? (action.newName ?? habit.name) : habit.name;
        propose({
          title: archive ? "Archive habit?" : "Update habit?",
          description: archive
            ? `Archive “${habit.name}”? Its recorded progress will stay in your history.`
            : `“${habit.name}” → “${name}” · ${scheduleLabel(schedule)}`,
          choices: [
            {
              label: archive ? "Archive habit" : "Save habit",
              confirm: async () => {
                const account = authorized();
                const result = await account.editHabit(
                  habit.id,
                  habit.revision,
                  archive
                    ? { status: "archived" }
                    : {
                        draft: {
                          name,
                          schedule,
                          description: habit.description,
                          category: habit.category,
                          color: habit.color,
                          icon: habit.icon,
                          goal: habit.goal,
                          reminderTime: habit.reminderTime,
                          activity: habit.activity,
                        },
                      },
                );
                return [
                  `“${result.habit.name}” was ${archive ? "archived" : "updated"}.`,
                  result.reminderNotice,
                ]
                  .filter(Boolean)
                  .join(" ");
              },
            },
          ],
        });
        break;
      }
      case "habit-complete":
      case "habit-undo": {
        const undo = action.kind === "habit-undo";
        const habits = matchingCompanionHabits(current.data, action.name);
        const now = new Date();
        const eligible = habits.flatMap((habit) => {
          try {
            return [
              {
                habit,
                occurrence: habitCompletion(current.data, habit.id, now),
              },
            ];
          } catch {
            return [];
          }
        });
        if (!eligible.length) {
          outcome(
            "No habit updated",
            habits.length
              ? "This habit isn’t available to log today."
              : "I couldn’t find an active habit with that exact name. Check My Habits and try again.",
            false,
          );
          break;
        }
        propose({
          title: undo
            ? "Undo today’s habit completion?"
            : "Log habit completion?",
          description:
            eligible.length === 1
              ? undo
                ? `Reset today’s progress for “${eligible[0].habit.name}” to zero?`
                : `Mark “${eligible[0].habit.name}” complete for today (${goalLabel(eligible[0].occurrence.goal)})?`
              : "More than one active habit has that name. Choose the habit to update today.",
          choices: eligible.map(({ habit, occurrence }, index) => ({
            label:
              eligible.length === 1
                ? undo
                  ? "Undo completion"
                  : "Mark complete"
                : `${index + 1}. ${habit.name} · ${scheduleLabel(habit.schedule)} · ${goalLabel(occurrence.goal)}`,
            confirm: async () => {
              const account = authorized();
              const latest = habitCompletion(account.data, habit.id);
              if (
                latest.write.day !== occurrence.write.day ||
                latest.write.amount !== occurrence.write.amount ||
                goalLabel(latest.goal) !== goalLabel(occurrence.goal)
              )
                throw new Error(
                  "The habit’s day or target changed. Ask again to review the new completion.",
                );
              if (!undo && latest.complete)
                return `“${latest.name}” is already complete for today.`;
              if (undo && !latest.complete)
                return `“${latest.name}” has no completion to undo today.`;
              const saved = await account.setHabitProgress(
                habit.id,
                undo ? { ...latest.write, amount: 0 } : latest.write,
              );
              if (undo ? saved.complete || saved.amount !== 0 : !saved.complete)
                throw new Error(
                  "Solace couldn’t confirm completion. Check the habit before trying again.",
                );
              return undo
                ? `Today’s completion for “${latest.name}” was undone.`
                : `“${latest.name}” was marked complete for today.`;
            },
          })),
        });
        break;
      }
      case "reminder-create": {
        const record = reminderFromAction(action);
        propose({
          title: "Schedule reminder?",
          description: `${record.title} · ${reminderClockLabel(record)} · ${actionScheduleLabel(action.repeat, action.days)} · Local time`,
          choices: [
            {
              label: "Save reminder",
              confirm: async () => {
                const account = authorized();
                if (
                  account.data.reminders.some((saved) =>
                    isMatchingReminder(saved, record),
                  )
                )
                  return "This reminder is already saved. Check Gentle Reminders for its delivery status.";
                const result = await saveReminder({
                  owner,
                  id: `companion-${action.id}`,
                  record,
                  save: (value) => account.save("reminders", value),
                });
                return result.message;
              },
            },
          ],
        });
        break;
      }
      case "reminder-disable": {
        const matches = current.data.reminders.filter(
          (reminder) =>
            reminder.enabled === true &&
            typeof reminder.title === "string" &&
            normalizeActionName(reminder.title) ===
              normalizeActionName(action.title),
        );
        if (matches.length !== 1) {
          outcome(
            "No reminder updated",
            matches.length
              ? "Multiple reminders have that name. Open Gentle Reminders to choose one."
              : "I couldn’t find an enabled reminder with that exact name.",
            false,
          );
          break;
        }
        const saved = matches[0];
        const id = saved.id;
        if (!isRecordId(id)) {
          outcome(
            "No reminder updated",
            "This reminder couldn’t be identified. Open Gentle Reminders to review it.",
            false,
          );
          break;
        }
        propose({
          title: "Turn off reminder?",
          description: `${saved.title} · ${reminderClockLabel({ hour: saved.hour, minute: saved.minute })}`,
          choices: [
            {
              label: "Turn off reminder",
              confirm: async () => {
                const account = authorized();
                const latest = account.data.reminders.find(
                  (item) => item.id === saved.id,
                );
                if (latest !== saved)
                  throw new Error(
                    "This reminder changed. Ask again to review it.",
                  );
                const result = await saveReminder({
                  owner,
                  id,
                  editing: true,
                  record: {
                    type: saved.type,
                    title: saved.title,
                    hour: saved.hour,
                    minute: saved.minute,
                    days: saved.days,
                    enabled: false,
                  },
                  save: (value) => account.save("reminders", value),
                });
                return result.message;
              },
            },
          ],
        });
        break;
      }
    }
  }

  function confirm(index: number) {
    // A new voice turn can replace a proposal while a button is pressed.
    const proposed = prompt;
    if (pending.current !== proposed) return;
    const choice = proposed?.choices?.[index];
    if (proposed?.actionId && choice) void execute(choice.confirm, proposed);
  }

  return {
    receive,
    cancelPending,
    prompt,
    busy,
    confirm,
    close: () => {
      if (!executing.current) show();
    },
  };
}

type ActionProps = { actions: ReturnType<typeof useCompanionActions> };

export function CompanionActionCard({ actions }: ActionProps) {
  const { colors, resolved } = useTheme();
  const { prompt, busy, confirm, close } = actions;
  if (!prompt) return null;
  if (prompt.practice)
    return (
      <SolaceRecommendationCard
        title={prompt.title}
        description={prompt.description}
        durationSec={prompt.practice.durationSec}
        artwork={techniqueArtwork[prompt.practice.artwork]}
        error={prompt.error}
        startLabel={busy ? "Opening…" : "Start practice"}
        disabled={busy}
        onStart={() => confirm(0)}
        onDismiss={close}
      />
    );
  return (
    <Card
      style={
        resolved === "dark"
          ? styles.content
          : [
              styles.content,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.lavender,
              },
            ]
      }
    >
      <AppText variant="heading" accessibilityRole="header">
        {prompt.title}
      </AppText>
      <AppText color={colors.muted} accessibilityLiveRegion="polite">
        {prompt.description}
      </AppText>
      {!!prompt.error && (
        <AppText color={colors.danger} accessibilityRole="alert">
          {prompt.error}
        </AppText>
      )}
      {prompt.choices?.map(({ label }, index) => (
        <Button
          key={index}
          title={busy ? "Saving…" : label}
          disabled={busy}
          onPress={() => confirm(index)}
        />
      ))}
      <Button
        title={prompt.choices ? "Cancel" : "Done"}
        variant="secondary"
        disabled={busy}
        onPress={close}
      />
    </Card>
  );
}

export function CompanionActionDialog({ actions }: ActionProps) {
  const { colors } = useTheme();
  if (!actions.prompt) return null;
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={actions.close}
    >
      <SafeAreaView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessible={false}
          onPress={actions.close}
        />
        <ScrollView style={styles.dialog} keyboardShouldPersistTaps="handled">
          <CompanionActionCard actions={actions} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: spacing.card },
  dialog: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    flexGrow: 0,
    alignSelf: "center",
  },
  content: { gap: spacing.row },
});
