import React, { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import type { WellnessGoal } from "../../server/src/wellness-goals";
import { useReducedMotion } from "../Companion";
import { playHaptic } from "../haptics";
import { spacing, useScreenGutter } from "../layout";
import { useGuardedBack, useTabResetGuard } from "../navigation-reset";
import { useTheme } from "../theme";
import { AppText, Button, Icon, IconButton } from "../ui";
import { OnboardingLayout } from "./OnboardingLayout";

type GoalOption = {
  id: WellnessGoal;
  title: string;
  description: string;
  light: ImageSourcePropType;
  dark?: ImageSourcePropType;
};

const exploreGoal: GoalOption = {
  id: "explore",
  title: "Just explore",
  description: "See what Solace has to offer at your own pace.",
  light: require("../../assets/today-quick-breathe.jpg"),
};

const goals: readonly GoalOption[] = [
  {
    id: "calm",
    title: "Feel calmer",
    description: "Make room to breathe and feel grounded.",
    light: require("../../assets/voice-companion-dawn.jpg"),
    dark: require("../../assets/voice-companion-night.jpg"),
  },
  {
    id: "sleep",
    title: "Sleep better",
    description: "Build a gentler wind-down routine.",
    light: require("../../assets/goals-sleep.jpg"),
  },
  {
    id: "feelings",
    title: "Understand my feelings",
    description: "Notice what you feel and what you need.",
    light: require("../../assets/goals-feelings.jpg"),
  },
  {
    id: "habits",
    title: "Build healthy habits",
    description: "Make one small, steady change at a time.",
    light: require("../../assets/habits-garden-sprout.jpg"),
  },
  {
    id: "focus",
    title: "Improve my focus",
    description: "Find a little clarity in a busy day.",
    light: require("../../assets/today-quick-focus.jpg"),
  },
  exploreGoal,
];

function selectedIds(selection: ReadonlySet<WellnessGoal>) {
  return goals.filter(({ id }) => selection.has(id)).map(({ id }) => id);
}

function goalImage(goal: GoalOption, dark: boolean) {
  return dark ? (goal.dark ?? goal.light) : goal.light;
}

function GoalIntro({ title, children }: { title: string; children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.intro}>
      <AppText
        accessibilityRole="header"
        variant="display"
        style={styles.title}
      >
        {title}
      </AppText>
      <AppText color={colors.muted} style={styles.introCopy}>
        {children}
      </AppText>
    </View>
  );
}

function GoalCard({
  goal,
  checked,
  disabled,
  reduceMotion,
  compact,
  onPress,
}: {
  goal: GoalOption;
  checked: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const [focus, setFocus] = useState(false);
  const [selection] = useState(() => new Animated.Value(checked ? 1 : 0));
  const selectionInk = dark ? colors.primary : colors.accent;
  useEffect(() => {
    if (reduceMotion) {
      selection.setValue(checked ? 1 : 0);
      return;
    }
    const animation = Animated.timing(selection, {
      toValue: checked ? 1 : 0,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [checked, reduceMotion, selection]);

  return (
    <Pressable
      testID={`wellness-goal-${goal.id}`}
      accessibilityRole="checkbox"
      accessibilityLabel={goal.title}
      accessibilityHint={goal.description}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      disabled={disabled}
      onPress={onPress}
      onKeyDown={
        Platform.OS === "web"
          ? (nativeEvent) => {
              // RN Web maps Space to Pressable's onPress for button roles only.
              const event =
                nativeEvent as unknown as KeyboardEvent<HTMLElement>;
              if (
                event.key !== " " ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
              )
                return;
              event.preventDefault();
              if (!event.repeat && !disabled) onPress();
            }
          : undefined
      }
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={({ pressed }) => [
        styles.goalCard,
        compact && styles.compactCard,
        {
          backgroundColor: checked
            ? colors.lavenderSurface
            : dark
              ? colors.surface
              : colors.bg,
          borderColor: focus || checked ? selectionInk : colors.border,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <Image
        source={goalImage(goal, dark)}
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
        resizeMode="cover"
        style={[
          styles.goalArt,
          compact && styles.compactArt,
          { backgroundColor: colors.heroSurface },
        ]}
      />
      <View style={styles.goalCopy}>
        <AppText variant="heading" style={styles.goalTitle}>
          {goal.title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {goal.description}
        </AppText>
      </View>
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.checkbox,
          { borderColor: checked ? selectionInk : colors.muted },
        ]}
      >
        <Animated.View
          style={[
            styles.checkboxMark,
            { backgroundColor: selectionInk, opacity: selection },
          ]}
        >
          <Icon
            name="checkmark"
            color={dark ? colors.primaryText : colors.surface}
            size={17}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

export function WellnessGoalsScreen({
  mode,
  initialGoals,
  onSave,
  onBack,
  onSelectionChange,
}: {
  mode: "onboarding" | "edit";
  initialGoals: readonly WellnessGoal[];
  onSave: (goals: WellnessGoal[]) => Promise<void>;
  onBack?: () => void;
  onSelectionChange?: (goals: WellnessGoal[]) => void;
}) {
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.25;
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<ReadonlySet<WellnessGoal>>(
    () => new Set(initialGoals),
  );
  const selectionRef = useRef(selected);
  const [saved, setSaved] = useState<ReadonlySet<WellnessGoal>>(
    () => new Set(initialGoals),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const savingRef = useRef(false);
  const leavingRef = useRef(false);
  const editing = mode === "edit";
  const changed =
    selected.size !== saved.size || [...selected].some((id) => !saved.has(id));
  const disabled = editing ? !changed : selected.size === 0;
  const goBack = useGuardedBack(onBack);
  useTabResetGuard(saving, "saving");

  async function save(skip = false) {
    if (savingRef.current || leavingRef.current || (skip ? editing : disabled))
      return;
    savingRef.current = true;
    setMessage(undefined);
    setSaving(true);
    const submitted = skip ? [] : selectedIds(selectionRef.current);
    try {
      await onSave(submitted);
      setSaved(new Set(submitted));
      if (editing) setMessage({ text: "Goals saved.", error: false });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error && error.message
            ? error.message
            : "Couldn’t save your goals. Please try again.",
        error: true,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function toggle(id: WellnessGoal) {
    if (savingRef.current || leavingRef.current) return;
    void playHaptic("selection");
    setMessage(undefined);
    const next = new Set(selectionRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectionRef.current = next;
    setSelected(next);
    onSelectionChange?.(selectedIds(next));
  }

  return (
    <OnboardingLayout
      testID={editing ? "wellness-goals-editor" : "wellness-goals-onboarding"}
      leading={
        editing &&
        onBack && (
          <IconButton
            name="chevron-back"
            label="Go back"
            disabled={saving}
            onPress={() => {
              if (savingRef.current || leavingRef.current) return;
              leavingRef.current = true;
              goBack();
            }}
          />
        )
      }
      trailing={
        !editing && (
          <Button
            title="Skip for now"
            variant="ghost"
            disabled={saving}
            onPress={() => void save(true)}
            style={styles.skip}
          />
        )
      }
      footer={
        <>
          {message && (
            <AppText
              accessibilityRole={message.error ? "alert" : undefined}
              accessibilityLiveRegion="polite"
              variant="caption"
              color={message.error ? colors.danger : colors.text}
            >
              {message.text}
            </AppText>
          )}
          <Button
            title={editing ? "Save goals" : "Continue"}
            icon={editing ? undefined : "arrow-forward"}
            disabled={disabled && !saving}
            loading={saving}
            onPress={() => void save()}
          />
        </>
      }
    >
      <GoalIntro
        title={editing ? "Your Wellness Goals" : "What brings you here?"}
      >
        {editing
          ? "Choose what you’d like to make time for right now."
          : "Choose any goals that feel right. We’ll use them to shape your suggestions."}
      </GoalIntro>
      <View style={styles.goalList}>
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            checked={selected.has(goal.id)}
            disabled={saving}
            reduceMotion={reduceMotion}
            compact={compact}
            onPress={() => toggle(goal.id)}
          />
        ))}
      </View>
      {!editing && (
        <AppText variant="caption" color={colors.muted} style={styles.note}>
          You can always change your goals later in Profile.
        </AppText>
      )}
    </OnboardingLayout>
  );
}

export function WellnessGoalsWelcome({
  recommendation,
  onStart,
  onDone,
}: {
  recommendation: {
    title: string;
    description: string;
    actionLabel: string;
    goal: WellnessGoal;
  };
  onStart: () => void;
  onDone: () => void;
}) {
  const { colors, resolved } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = useScreenGutter();
  const opening = useRef(false);
  const option =
    goals.find(({ id }) => id === recommendation.goal) ?? exploreGoal;
  function open(action: () => void) {
    if (opening.current) return;
    opening.current = true;
    action();
  }
  return (
    <OnboardingLayout
      testID="wellness-goals-welcome"
      footer={
        <>
          <Button
            title={recommendation.actionLabel}
            icon="arrow-forward"
            onPress={() => open(onStart)}
          />
          <Button
            title="Continue to Today"
            variant="ghost"
            onPress={() => open(onDone)}
          />
        </>
      }
    >
      <GoalIntro title="Your space, your pace.">
        Here’s one small step to get started.
      </GoalIntro>
      <View
        style={[
          styles.recommendation,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Image
          source={goalImage(option, resolved === "dark")}
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="cover"
          style={[
            styles.welcomeImage,
            {
              height: Math.min(
                210,
                Math.round((Math.min(width, 480) - 2 * gutter) / 1.8),
              ),
            },
          ]}
        />
        <View style={styles.recommendationCopy}>
          <AppText accessibilityRole="header" variant="heading">
            {recommendation.title}
          </AppText>
          <AppText color={colors.muted}>{recommendation.description}</AppText>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  skip: { minHeight: 48, paddingHorizontal: 8 },
  intro: { gap: 7, marginTop: spacing.row, marginBottom: spacing.section },
  title: {
    fontSize: 40,
    lineHeight: Platform.OS === "android" ? 48 : 44,
    letterSpacing: -0.75,
  },
  introCopy: { maxWidth: 360 },
  goalList: { gap: spacing.row },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    minHeight: 106,
    padding: spacing.row,
    borderWidth: 1,
    borderRadius: 16,
  },
  compactCard: { padding: 10, gap: 10 },
  goalArt: { width: 84, height: 80, borderRadius: 11 },
  compactArt: { width: 64, height: 70 },
  goalCopy: { flex: 1, minWidth: 0, gap: 4 },
  goalTitle: {
    fontSize: 23,
    lineHeight: Platform.OS === "android" ? 28 : 25,
    letterSpacing: -0.25,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  checkboxMark: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { marginTop: spacing.card },
  recommendation: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  welcomeImage: { width: "100%" },
  recommendationCopy: { gap: 5, padding: spacing.card },
});
