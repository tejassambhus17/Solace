import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  HabitAiIntent,
  HabitAiResult,
} from "../../server/src/habit-ai-contract";
import { useReducedMotion } from "../Companion";
import { goalLabel, scheduleLabel } from "../habits-ui";
import { spacing } from "../layout";
import { routes } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, IconButton, Input, Row } from "../ui";

const intentions: {
  intent: HabitAiIntent;
  label: string;
  placeholder: string;
}[] = [
  {
    intent: "suggest",
    label: "Find a habit",
    placeholder: "I’d like to read a little more.",
  },
  {
    intent: "routine",
    label: "Build a routine",
    placeholder: "I want a calmer morning routine.",
  },
  {
    intent: "simplify",
    label: "Make it easier",
    placeholder: "I want a version I can do on busy days.",
  },
  {
    intent: "adjust",
    label: "Change frequency",
    placeholder: "Could I try this twice a week?",
  },
  {
    intent: "restart",
    label: "Start again",
    placeholder: "I missed a few days and want a gentle restart.",
  },
  {
    intent: "reflect",
    label: "Reflect on progress",
    placeholder: "Help me notice what made the past week easier.",
  },
];

export function habitIntention(text: string): HabitAiIntent | undefined {
  if (!/\b(?:habits?|routines?|consistency|weekly goals?)\b/i.test(text))
    return;
  if (/\b(?:reflect|progress|looking back|noticed)\b/i.test(text))
    return "reflect";
  if (/\b(?:restart|missed|start again|fell behind)\b/i.test(text))
    return "restart";
  if (/\b(?:simplify|easier|smaller|too much)\b/i.test(text)) return "simplify";
  if (
    /\b(?:frequency|less often|more often|how often|change the schedule)\b/i.test(
      text,
    )
  )
    return "adjust";
  return /\broutines?\b/i.test(text) ? "routine" : "suggest";
}

export function HabitAssistant({
  initialPrompt,
  initialIntent,
  initialHabitId,
  onClose,
}: {
  initialPrompt: string;
  initialIntent: HabitAiIntent;
  initialHabitId?: string;
  onClose: () => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [intent, setIntent] = useState(initialIntent);
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, 1200));
  const [habitId, setHabitId] = useState(initialHabitId);
  const [habitSearch, setHabitSearch] = useState("");
  const [includeProgress, setIncludeProgress] = useState(false);
  const [result, setResult] = useState<HabitAiResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const revealResult = useRef(false);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );
  const existingHabitIntent = intent === "adjust" || intent === "simplify";
  const canUseProgress = app.user?.personalization === true;
  const editableHabits = existingHabitIntent
    ? app.data.habits.filter((habit) => habit.status !== "archived")
    : [];
  const visibleHabits = editableHabits
    .filter((habit) =>
      habit.name
        .toLocaleLowerCase()
        .includes(habitSearch.trim().toLocaleLowerCase()),
    )
    .slice(0, 12);

  const clearResult = () => {
    revealResult.current = false;
    setResult(undefined);
    setError("");
  };
  const close = () => {
    request.current?.abort();
    request.current = null;
    Keyboard.dismiss();
    onClose();
  };
  const generate = async () => {
    if (request.current || !prompt.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    Keyboard.dismiss();
    setBusy(true);
    clearResult();
    try {
      const response = await app.suggestHabit(
        {
          intent,
          prompt: prompt.trim(),
          habitId: existingHabitIntent ? habitId : undefined,
          includeProgress: canUseProgress && includeProgress,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        },
        controller.signal,
      );
      if (request.current === controller) {
        revealResult.current = true;
        setResult(response);
      }
    } catch (reason) {
      if (request.current === controller && !controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Solace couldn’t prepare a suggestion. Try again in a moment.",
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  };
  const review = () => {
    if (!result?.suggestion) return;
    if (
      result.habitId &&
      !app.data.habits.some(
        (habit) =>
          habit.id === result.habitId && habit.revision === result.revision,
      )
    ) {
      clearResult();
      setError(
        "This habit changed while the suggestion was open. Try again to use the latest goal.",
      );
      return;
    }
    close();
    if (result.habitId)
      app.navigate(routes.habitEdit, {
        id: result.habitId,
        suggestion: result.suggestion,
        suggestionRevision: result.revision,
      });
    else app.navigate(routes.habitCreate, { suggestion: result.suggestion });
  };
  const choice = (label: string, selected: boolean, choose: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: busy }}
      aria-pressed={selected}
      disabled={busy}
      onPress={choose}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.lavenderSurface : colors.surface2,
          borderColor: selected ? colors.lavenderText : colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <AppText
        variant="label"
        color={selected ? colors.lavenderText : colors.text}
      >
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Modal
      visible
      transparent
      animationType={
        reducedMotion ? "none" : Platform.OS === "web" ? "fade" : "slide"
      }
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.backdrop,
          { backgroundColor: colors.overlay, paddingTop: insets.top + 12 },
        ]}
      >
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            onContentSizeChange={() => {
              if (!revealResult.current) return;
              revealResult.current = false;
              scroll.current?.scrollToEnd({ animated: !reducedMotion });
            }}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.section) },
            ]}
          >
            <Row style={styles.header}>
              <AppText
                accessibilityRole="header"
                variant="heading"
                style={styles.heading}
              >
                Plan a habit with Solace
              </AppText>
              <IconButton
                label="Close habit assistant"
                name="close-outline"
                onPress={close}
              />
            </Row>
            <AppText color={colors.muted}>
              Start with an idea, then decide what feels right for you.
            </AppText>
            <View style={styles.choices}>
              {intentions.map((option) =>
                choice(option.label, intent === option.intent, () => {
                  setIntent(option.intent);
                  setHabitId(undefined);
                  clearResult();
                }),
              )}
            </View>
            {editableHabits.length > 0 && (
              <View style={styles.group}>
                <AppText variant="label">
                  Choose a saved habit, if you’d like
                </AppText>
                {editableHabits.length > 7 && (
                  <Input
                    accessibilityLabel="Search saved habits"
                    placeholder="Search saved habits"
                    value={habitSearch}
                    onChangeText={setHabitSearch}
                    editable={!busy}
                  />
                )}
                <View style={styles.choices}>
                  {choice("A new habit", !habitId, () => {
                    setHabitId(undefined);
                    clearResult();
                  })}
                  {visibleHabits.map((habit) => (
                    <React.Fragment key={habit.id}>
                      {choice(habit.name, habitId === habit.id, () => {
                        setHabitId(habit.id);
                        clearResult();
                      })}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.group}>
              <AppText variant="label">What would you like to work on?</AppText>
              <Input
                accessibilityLabel="Habit idea"
                placeholder={
                  intentions.find((item) => item.intent === intent)?.placeholder
                }
                multiline
                value={prompt}
                maxLength={1200}
                editable={!busy}
                onChangeText={(value) => {
                  setPrompt(value);
                  clearResult();
                }}
              />
            </View>
            {canUseProgress && (
              <Row style={styles.progress}>
                <AppText variant="label" style={styles.heading}>
                  Use my last seven days of habit progress
                </AppText>
                <Switch
                  accessibilityLabel="Use my last seven days of habit progress"
                  value={includeProgress}
                  disabled={busy}
                  onValueChange={(value) => {
                    setIncludeProgress(value);
                    clearResult();
                  }}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </Row>
            )}
            <AppText variant="caption" color={colors.muted}>
              When live AI is available, Solace shares this idea, the goal and
              frequency of any habit you select, and any progress you choose to
              include. You can review every suggested change before saving.
            </AppText>
            {error && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {error}
              </AppText>
            )}
            {result && (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.result,
                  {
                    backgroundColor: colors.lavenderSurface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Row style={styles.resultLabel}>
                  <Icon
                    name={result.support ? "heart-outline" : "leaf-outline"}
                    color={colors.lavenderText}
                    size={18}
                  />
                  <AppText variant="caption" color={colors.lavenderText}>
                    {result.support
                      ? "Support guidance"
                      : result.provider === "live"
                        ? "AI-assisted suggestion"
                        : "Built-in guidance"}
                  </AppText>
                </Row>
                {result.suggestion && (
                  <AppText variant="heading">{result.suggestion.name}</AppText>
                )}
                <AppText color={colors.muted}>{result.note}</AppText>
                {result.suggestion && (
                  <AppText variant="caption" color={colors.muted}>
                    {goalLabel(result.suggestion.goal)} ·{" "}
                    {scheduleLabel(result.suggestion.schedule)}
                  </AppText>
                )}
              </View>
            )}
            {result?.suggestion ? (
              <Button
                title={
                  result.habitId
                    ? "Review habit changes"
                    : "Review suggested habit"
                }
                icon="arrow-forward"
                onPress={review}
              />
            ) : result?.support ? (
              <Button
                title="Find human support"
                icon="heart-outline"
                onPress={() => {
                  close();
                  app.navigate(routes.support);
                }}
              />
            ) : (
              <Button
                title={result ? "Try another idea" : "Get a suggestion"}
                loading={busy}
                disabled={!prompt.trim()}
                onPress={() => void generate()}
              />
            )}
            <Button
              title={result ? "Not now" : "Cancel"}
              variant="ghost"
              onPress={close}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "93%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  content: { gap: spacing.row, padding: spacing.section },
  header: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.compact,
  },
  heading: { flex: 1 },
  group: { gap: spacing.compact },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  choice: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 16,
    maxWidth: "100%",
  },
  progress: { justifyContent: "space-between", gap: spacing.row },
  result: {
    padding: spacing.card,
    borderWidth: 1,
    borderRadius: 16,
    gap: spacing.compact,
  },
  resultLabel: { gap: spacing.compact },
});
