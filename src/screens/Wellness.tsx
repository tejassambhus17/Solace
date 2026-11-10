import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  hasWeeklyActivity,
  savedWeeklyStory,
} from "../../server/src/weekly-facts";
import { useApp, type WeeklyReflectionResult } from "../store";
import { useGuardedBack, useTabResetGuard } from "../navigation-reset";
import { spacing, useScreenGutter } from "../layout";
import { EditorialSection, SceneIntro } from "../NestedDesign";
import { webRadioProps } from "../radio-keyboard";
import { starterHabits } from "../habits-ui";
import { isRecordId, routes, savedReflectionRoute } from "../routes";
import { artGradient, useTheme } from "../theme";
import { useReducedMotion } from "../Companion";
import { journeyWeek } from "../journey-analytics";
import { journeyGoalProgress, selectJourneyGoal } from "../journey-goals";
import { reflectionPeriodLabel, weeklyStoryFacts } from "../weekly-story";
import {
  breathingPosition,
  newMomentSessionId,
  nextMomentTickDelay,
} from "../moments";
import { useBreathingMotion } from "../breathing-motion";
import { WeeklyStoryOverview } from "./WeeklyStory";
import { CheckinNextStep } from "./CheckinNextStep";
import { playHaptic } from "../haptics";
import { PracticeCompletion } from "./PracticeFollowUp";
import {
  emotionalRecheckLabel,
  practiceFollowUpId,
  practiceOrigins,
} from "../practice-follow-up";
import {
  Screen,
  Card,
  Button,
  coverImageStyle,
  IconButton,
  MoodPetal,
  moodPetals,
  BotanicalBackdrop,
  Artwork,
  NestedHeader,
  NestedState,
} from "../ui";
import {
  ASSESSMENTS,
  ASSESSMENT_OPTIONS,
  AssessmentId,
  assessmentSummary,
  localDay,
  recordDay,
  RESOURCE_GUIDES,
  todayAffirmation,
  type AssessmentDefinition,
  type ResourceGuide,
} from "../content";

const F = {
  body: "Inter_400Regular",
  strong: "Inter_600SemiBold",
  heading: "CormorantGaramond_600SemiBold",
};
type AnyRecord = Record<string, any>;
const errText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We could not save that. Please try again.";
const stamp = () => new Date().toISOString();
const monotonicNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function Copy({
  children,
  style,
  muted = false,
  ...props
}: TextProps & { muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        styles.copy,
        { color: muted ? colors.muted : colors.text },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
function Heading({
  children,
  small = false,
  style,
}: {
  children: React.ReactNode;
  small?: boolean;
  style?: any;
}) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.heading,
        {
          color: colors.text,
          fontSize: small ? 26 : 40,
          lineHeight: small ? 29 : 42,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
function Mark({
  name,
  color,
  size = 24,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name as any}
      size={size}
      color={color || colors.text}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
function ErrorNote({ error }: { error: string }) {
  const { colors } = useTheme();
  return error ? (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: colors.surface2 }]}
    >
      <Mark name="alert-circle-outline" color={colors.danger} />
      <Copy style={{ flex: 1, color: colors.danger }}>{error}</Copy>
    </View>
  ) : null;
}
function Hint({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surface }]}>
      <Mark name="information-circle-outline" size={20} />
      <Copy style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>{children}</Copy>
    </View>
  );
}
function Field({
  value,
  onChangeText,
  placeholder,
  minHeight = 100,
  label,
  editable = true,
  maxLength = 3000,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  minHeight?: number;
  label?: string;
  editable?: boolean;
  maxLength?: number;
  style?: React.ComponentProps<typeof TextInput>["style"];
}) {
  const { colors, resolved } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label || placeholder}
      value={value}
      editable={editable}
      onChangeText={onChangeText}
      multiline
      textAlignVertical="top"
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      selectionColor={resolved === "dark" ? colors.primary : colors.accent}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.field,
        {
          color: colors.text,
          backgroundColor:
            resolved === "dark" ? colors.surface2 : colors.surface,
          borderColor: focused
            ? resolved === "dark"
              ? colors.primary
              : colors.accent
            : colors.border,
          minHeight,
        },
        style,
      ]}
    />
  );
}
function Choice({
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
  const { colors, resolved } = useTheme();
  const selectionInk = resolved === "dark" ? colors.primary : colors.accent;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.surface2 : colors.surface,
          borderColor: selected ? selectionInk : colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Mark
        name={icon || (selected ? "radio-button-on" : "radio-button-off")}
        color={selected ? selectionInk : colors.muted}
        size={23}
      />
      <Copy style={{ flex: 1 }}>{label}</Copy>
    </Pressable>
  );
}
function Action({
  title,
  description,
  icon = "leaf-outline",
  onPress,
  tone = "sage",
  expanded,
  style,
}: {
  title: string;
  description: string;
  icon?: string;
  onPress: () => void;
  tone?: "lavender" | "peach" | "sage";
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed ? colors[`${tone}Surface`] : colors.surface,
          borderColor: pressed ? colors[`${tone}Text`] : colors.border,
        },
        expanded !== undefined && {
          backgroundColor: pressed ? colors[`${tone}Surface`] : "transparent",
          padding: 0,
          marginBottom: 0,
          borderWidth: 0,
        },
        style,
      ]}
    >
      <View
        style={[styles.iconBox, { backgroundColor: colors[`${tone}Surface`] }]}
      >
        <Mark name={icon} color={colors[`${tone}Text`]} size={22} />
      </View>
      <View style={styles.flexCopy}>
        <Heading small style={{ fontSize: 23, lineHeight: 25 }}>
          {title}
        </Heading>
        <Copy muted style={{ fontSize: 13, lineHeight: 19, marginTop: 3 }}>
          {description}
        </Copy>
      </View>
      <Mark
        name={
          expanded === undefined
            ? "chevron-forward"
            : expanded
              ? "chevron-up"
              : "chevron-down"
        }
        size={18}
        color={colors.muted}
      />
    </Pressable>
  );
}
function PageIntro({
  title,
  children,
  onBack,
}: {
  title: string;
  children?: string;
  onBack?: () => void;
}) {
  const app = useApp();
  const { resolved } = useTheme();
  return (
    <View>
      <BotanicalBackdrop
        style={{
          width: 155,
          height: 155,
          right: -97,
          top: -76,
          opacity: resolved === "dark" ? 0.1 : 0.23,
        }}
      />
      <NestedHeader
        title={title}
        subtitle={children}
        onBack={onBack ?? app.back}
      />
    </View>
  );
}

const wellnessArt = {
  guide: {
    light: require("../../assets/profile-mountains-light.jpg"),
    dark: require("../../assets/profile-mountains-dark.jpg"),
  },
  grounding: {
    light: require("../../assets/redesign-guided-light.jpg"),
    dark: require("../../assets/dark-stillness.png"),
  },
  sleep: {
    light: require("../../assets/guided-rest.jpg"),
    dark: require("../../assets/dark-night.png"),
  },
  checkin: {
    light: require("../../assets/redesign-explore-scene-light.jpg"),
    dark: require("../../assets/today-twilight-lotus.jpg"),
  },
  toolkit: {
    light: require("../../assets/redesign-explore-scene-light.jpg"),
    dark: require("../../assets/redesign-explore-scene-dark.jpg"),
  },
  reflection: {
    light: require("../../assets/journal-editor-window.jpg"),
    dark: require("../../assets/journal-editor-window.jpg"),
  },
  breathing: {
    light: require("../../assets/guided-breathe.jpg"),
    dark: require("../../assets/guided-breathe.jpg"),
  },
};

function ScenePage({
  title,
  description,
  kind,
  meta,
  onBack,
  children,
}: {
  title: string;
  description?: string;
  kind: keyof typeof wellnessArt;
  meta?: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  const app = useApp();
  const { resolved } = useTheme();
  const back = useGuardedBack(onBack ?? app.back);
  return (
    <>
      <View style={styles.sceneBack}>
        <IconButton
          name="chevron-back"
          label="Go back"
          size={48}
          appearance="outlined"
          onPress={back}
        />
      </View>
      <SceneIntro
        image={wellnessArt[kind][resolved]}
        title={title}
        description={description}
        meta={meta}
        tone={kind === "grounding" ? "sage" : "lavender"}
      >
        {children}
      </SceneIntro>
    </>
  );
}

function ArtShelfItem({
  title,
  detail,
  kind,
  label,
  onPress,
  trailing,
}: {
  title: string;
  detail: string;
  kind: keyof typeof wellnessArt;
  label?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  const { colors, resolved } = useTheme();
  return (
    <View
      style={[
        styles.shelfItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? title}
        accessibilityHint={detail}
        onPress={onPress}
        style={({ pressed }) => [
          styles.shelfMain,
          pressed && { backgroundColor: colors.lavenderSurface },
        ]}
      >
        <View style={styles.shelfThumb} pointerEvents="none">
          <Image
            source={wellnessArt[kind][resolved]}
            accessible={false}
            resizeMode="cover"
            fadeDuration={0}
            style={coverImageStyle}
          />
        </View>
        <View style={styles.shelfCopy}>
          <Heading small style={styles.shelfTitle}>
            {title}
          </Heading>
          <Copy muted style={styles.shelfDetail}>
            {detail}
          </Copy>
        </View>
        {!trailing && (
          <Mark name="arrow-forward" size={18} color={colors.lavenderText} />
        )}
      </Pressable>
      {trailing && <View style={styles.shelfTrailing}>{trailing}</View>}
    </View>
  );
}

function guideArt(id: string): keyof typeof wellnessArt {
  switch (id) {
    case "sleep":
      return "sleep";
    case "anxiety":
      return "grounding";
    case "low-mood":
      return "checkin";
    case "self-esteem":
      return "reflection";
    default:
      return "guide";
  }
}

type ToolkitKind = "resource" | "breathing" | "reflection" | "grounding";
function SaveToToolkit({
  kind,
  targetId,
  title,
}: {
  kind: ToolkitKind;
  targetId: string;
  title: string;
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const selectionInk = resolved === "dark" ? colors.primary : colors.accent;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const favorite = app.data.favorites.find(
    (item) => item.kind === kind && item.targetId === targetId,
  );
  async function toggle() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      if (favorite?.id) await app.remove("favorites", String(favorite.id));
      else
        await app.save("favorites", {
          kind,
          targetId,
          title,
          createdAt: stamp(),
        });
    } catch (e) {
      setError(errText(e));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <View style={{ marginBottom: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${favorite ? "Remove" : "Save"} ${title} ${favorite ? "from" : "to"} toolkit`}
        accessibilityState={{ disabled: pending, busy: pending }}
        aria-disabled={pending}
        aria-busy={pending}
        disabled={pending}
        onPress={toggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 8,
          minHeight: 44,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 22,
          borderWidth: 0.75,
          borderColor: favorite ? selectionInk : colors.border,
          backgroundColor:
            pressed || (favorite && resolved === "light")
              ? colors.surface2
              : colors.surface,
          opacity: pending ? 0.6 : 1,
        })}
      >
        <Mark name={favorite ? "bookmark" : "bookmark-outline"} size={17} />
        <Copy style={{ fontSize: 13, fontFamily: F.strong }}>
          {pending
            ? "Updating toolkit…"
            : favorite
              ? "Saved to toolkit"
              : "Save to toolkit"}
        </Copy>
      </Pressable>
      <ErrorNote error={error} />
    </View>
  );
}

function Toolkit() {
  const app = useApp();
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const removeLock = useRef(false);
  const favorites = [...app.data.favorites].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  function open(item: AnyRecord) {
    app.navigate(
      item.kind === "resource" ? "resource" : item.kind,
      item.kind === "resource" ? { id: item.targetId } : {},
    );
  }
  async function remove(id: string) {
    if (removeLock.current) return;
    removeLock.current = true;
    setRemoving(id);
    setError("");
    try {
      await app.remove("favorites", id);
    } catch (e) {
      setError(errText(e));
    } finally {
      removeLock.current = false;
      setRemoving(null);
    }
  }
  return (
    <Screen variant="nested">
      <ScenePage
        title="Your toolkit"
        kind="toolkit"
        description={
          favorites.length
            ? "A quiet place for the practices and guides you choose to keep close."
            : "Keep what helps. Tap the bookmark on a practice or guide to find it here again."
        }
        meta={
          favorites.length
            ? `${favorites.length} saved ${favorites.length === 1 ? "item" : "items"} · Private to your account`
            : "No saved practices yet"
        }
      />
      <ErrorNote error={error} />
      {!!favorites.length && (
        <View style={[styles.featureSection, styles.savedList]}>
          <EditorialSection title="Saved for later" />
          {favorites.map((item) => (
            <ArtShelfItem
              key={item.id}
              title={item.title}
              label={`Open ${item.title}`}
              kind={
                item.kind === "resource"
                  ? item.targetId === "sleep"
                    ? "sleep"
                    : "guide"
                  : item.kind === "grounding"
                    ? "grounding"
                    : item.kind === "breathing"
                      ? "breathing"
                      : "reflection"
              }
              detail={
                item.kind === "resource"
                  ? "Resource guide"
                  : item.kind === "breathing"
                    ? "A paced breathing practice"
                    : item.kind === "grounding"
                      ? "A five-senses practice"
                      : "A space to write"
              }
              onPress={() => open(item)}
              trailing={
                <IconButton
                  name={removing === item.id ? "hourglass-outline" : "bookmark"}
                  label={`Remove ${item.title} from toolkit`}
                  disabled={!!removing}
                  onPress={() => remove(String(item.id))}
                />
              }
            />
          ))}
        </View>
      )}
      <EditorialSection
        title="Make room for a pause"
        description="Try a practice now, then save it if you want to come back."
      />
      <ArtShelfItem
        title="Five-senses grounding"
        detail="Notice your surroundings, one sense at a time."
        kind="grounding"
        onPress={() => app.navigate("grounding")}
      />
      <ArtShelfItem
        title="A breathing moment"
        detail="One to three minutes, at your pace."
        kind="breathing"
        onPress={() => app.navigate("breathing")}
      />
      <ArtShelfItem
        title="A moment to reflect"
        detail="Notice what is on your mind."
        kind="reflection"
        onPress={() => app.navigate("reflection")}
      />
      <Button
        title="Explore resource guides"
        variant="secondary"
        onPress={() => app.navigate("resources")}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}

const GROUNDING_STEPS = [
  {
    count: 5,
    title: "Things you can see",
    icon: "eye-outline",
    prompt:
      "Let your eyes settle on five details around you. A shape, a colour, a small patch of light. There is no need to look far.",
    alternative:
      "If sight is not available or helpful, imagine five familiar details instead.",
  },
  {
    count: 4,
    title: "Things you can feel",
    icon: "hand-left-outline",
    prompt:
      "Notice four comfortable points of contact. Perhaps your feet on the floor, your hands together, or the texture of your sleeve.",
    alternative:
      "Choose only sensations that feel comfortable. You can leave any part out.",
  },
  {
    count: 3,
    title: "Things you can hear",
    icon: "ear-outline",
    prompt:
      "Notice three sounds, near or far. You do not need to name them perfectly. Give each a little space.",
    alternative:
      "If sound is not available or helpful, picture three familiar sounds, or stay with a comfortable texture.",
  },
  {
    count: 2,
    title: "Things you can smell",
    icon: "flower-outline",
    prompt:
      "Notice two scents, or remember two familiar scents you enjoy. Nothing needs to be found or changed.",
    alternative: "A remembered scent is enough. You can also skip this sense.",
  },
  {
    count: 1,
    title: "Thing you can taste",
    icon: "water-outline",
    prompt:
      "Notice one taste, or imagine a familiar taste. Let this be a small, unhurried moment.",
    alternative:
      "There is no need to eat or drink anything. Choose a comfortable memory, or skip.",
  },
];
function Grounding({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors } = useTheme();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [started, index]);
  const [tried, setTried] = useState<number[]>([]);
  const [ending, setEnding] = useState(false);
  const accumulated = useRef(0);
  const since = useRef<number | null>(null);
  const startedAt = useRef<string | undefined>(undefined);
  const finished = useRef(false);
  const stopClock = () => {
    if (since.current !== null)
      accumulated.current += Math.max(0, monotonicNow() - since.current) / 1000;
    since.current = null;
  };
  useEffect(() => {
    if (started && !ending && AppState.currentState === "active")
      since.current = monotonicNow();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stopClock();
      else if (
        started &&
        !ending &&
        !finished.current &&
        since.current === null
      )
        since.current = monotonicNow();
    });
    return () => {
      stopClock();
      listener.remove();
    };
  }, [started, ending]);
  function leave() {
    if (ending) setEnding(false);
    else if (started) {
      stopClock();
      setEnding(true);
    } else app.back();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => listener.remove();
  }, [started, ending]);
  function finish(nextTried: number[]) {
    if (finished.current) return;
    finished.current = true;
    stopClock();
    const completedAt = new Date();
    const completed = nextTried.length > 0;
    app.navigate("feedback", {
      session: {
        id: newMomentSessionId(),
        practiceId: "grounding",
        type: "grounding",
        title: "Five-senses grounding",
        durationSec: Math.min(
          1800,
          Math.max(0, Math.floor(accumulated.current)),
        ),
        completed,
        outcome: completed ? "completed" : "early-exit",
        steps: nextTried,
        source: params.source || "wellness",
        ...(params.conversationId || params.sourceConversationId
          ? {
              sourceConversationId:
                params.conversationId || params.sourceConversationId,
            }
          : {}),
        createdAt: completedAt.toISOString(),
        startedAt: startedAt.current,
        endedAt: completedAt.toISOString(),
        day: localDay(completedAt),
        ...practiceOrigins(params, app.data.checkins),
      },
    });
  }
  function next(skip: boolean) {
    const nextTried = skip
      ? tried.filter((n) => n !== index)
      : [...new Set([...tried, index])];
    setTried(nextTried);
    if (index === GROUNDING_STEPS.length - 1) finish(nextTried);
    else setIndex(index + 1);
  }
  const step = GROUNDING_STEPS[index];
  if (ending)
    return (
      <Screen variant="nested">
        <PageIntro title="Take your time" onBack={() => setEnding(false)}>
          Your practice is paused. You can continue, or leave without saving a
          completed activity.
        </PageIntro>
        <Button title="Keep going" onPress={() => setEnding(false)} />
        <Button
          title="Leave practice"
          variant="secondary"
          onPress={app.back}
          style={{ marginTop: 12 }}
        />
      </Screen>
    );
  return (
    <Screen variant="nested" scrollRef={scroll}>
      {started && <NestedHeader title="Five-senses grounding" onBack={leave} />}
      {!started ? (
        <>
          <ScenePage
            title="Five-senses grounding"
            kind="grounding"
            onBack={leave}
            description="Notice the space around you, one small detail at a time."
            meta="Self-paced · Five senses"
          />
          <EditorialSection title="Start with what’s around you" />
          <View
            style={[
              styles.senseRoute,
              {
                backgroundColor: colors.sageSurface,
                borderColor: colors.border,
              },
            ]}
          >
            {GROUNDING_STEPS.map(({ count, icon }) => (
              <View key={count} style={styles.senseNode} aria-hidden>
                <Mark name={icon} size={20} color={colors.sageText} />
                <Copy style={{ color: colors.sageText, fontFamily: F.strong }}>
                  {count}
                </Copy>
              </View>
            ))}
          </View>
          <Copy muted style={styles.draftCaption}>
            Choose what feels accessible. Imagine a familiar sensation, skip a
            sense, or stop at any point.
          </Copy>
          <Button
            title="Begin grounding"
            icon="play-outline"
            onPress={() => {
              startedAt.current ||= stamp();
              setStarted(true);
            }}
            style={{ marginTop: spacing.compact, marginBottom: spacing.row }}
          />
          <SaveToToolkit
            kind="grounding"
            targetId="grounding"
            title="Five-senses grounding"
          />
        </>
      ) : (
        <>
          <View
            style={[
              styles.senseStage,
              {
                backgroundColor: colors.sageSurface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.senseStageHeader}>
              <Mark name={step.icon} size={24} color={colors.sageText} />
              <Copy style={{ color: colors.sageText, fontFamily: F.strong }}>
                Step {index + 1} of {GROUNDING_STEPS.length}
              </Copy>
            </View>
            <View
              style={styles.groundingProgress}
              accessibilityRole="progressbar"
              accessibilityLabel="Grounding steps"
              accessibilityValue={{
                min: 0,
                max: GROUNDING_STEPS.length,
                now: index + 1,
              }}
            >
              {GROUNDING_STEPS.map((_, n) => (
                <View
                  key={n}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor:
                      n <= index ? colors.sageText : colors.border,
                  }}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 15,
                marginBottom: 18,
              }}
            >
              <Text
                accessible={false}
                style={{
                  fontFamily: F.heading,
                  fontSize: 58,
                  lineHeight: 66,
                  color: colors.sageText,
                }}
              >
                {step.count}
              </Text>
              <View style={{ flex: 1 }}>
                <Heading style={{ fontSize: 35, lineHeight: 37 }}>
                  {step.title}
                </Heading>
              </View>
            </View>
            <Copy
              accessibilityLiveRegion="polite"
              aria-live="polite"
              style={{ fontSize: 17, lineHeight: 27 }}
            >
              {step.prompt}
            </Copy>
            <Copy muted style={{ marginTop: 14 }}>
              {step.alternative}
            </Copy>
          </View>
          <Button
            title={index === 4 ? "Finish practice" : "Continue"}
            onPress={() => next(false)}
          />
          <Button
            title="Skip this sense"
            variant="ghost"
            onPress={() => next(true)}
            style={{ marginTop: 8 }}
          />
          {index > 0 && (
            <Button
              title="Previous sense"
              variant="secondary"
              onPress={() => setIndex(index - 1)}
              style={{ marginTop: 8 }}
            />
          )}
          <Button
            title="Pause practice"
            variant="ghost"
            onPress={leave}
            style={{ marginTop: 8 }}
          />
        </>
      )}
    </Screen>
  );
}

function Checkin() {
  const app = useApp();
  const { colors } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const gutter = useScreenGutter();
  const moodColumns =
    fontScale > 1.65 ? 2 : fontScale > 1.15 || width - 2 * gutter < 275 ? 3 : 5;
  const moodTileBasis =
    moodColumns === 5 ? "18%" : moodColumns === 3 ? "29%" : "44%";
  const tightMoodRow = moodColumns === 5 && width - 2 * gutter < 308;
  const draftKey = "checkin:new";
  const draft = app.editorDrafts[draftKey];
  const [mood, setMood] = useState(
    ["Okay", "Calm", "Low", "Stressed", "Great"].includes(app.params?.mood)
      ? app.params.mood
      : draft?.mood || "",
  );
  const [tags, setTags] = useState<string[]>(() => {
    try {
      return JSON.parse(draft?.tags || "[]");
    } catch {
      return [];
    }
  });
  const [note, setNote] = useState(draft?.note || "");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const savedId = app.params?.savedCheckinId;
  const savedCheckin = isRecordId(savedId)
    ? app.data.checkins.find((entry) => entry.id === savedId)
    : undefined;
  const awaitingSync =
    savedCheckin &&
    (savedCheckin.localOnly ||
      app.pendingWrites.some((entry) => entry.id === savedId));
  function writeDraft(nextMood = mood, nextTags = tags, nextNote = note) {
    if (saveLock.current) return;
    setMood(nextMood);
    setTags(nextTags);
    setNote(nextNote);
    app.setEditorDraft(draftKey, {
      mood: nextMood,
      tags: JSON.stringify(nextTags),
      note: nextNote,
    });
  }
  const tagChoices = more
    ? [
        "Rested",
        "Grateful",
        "Tense",
        "Focused",
        "Kind",
        "Work",
        "Studies",
        "Relationships",
        "Sleep",
        "Lonely",
      ]
    : ["Rested", "Grateful", "Tense", "Focused", "Kind"];
  async function save() {
    if (saveLock.current) return;
    if (!mood) {
      setError("Choose a mood before saving your check-in.");
      return;
    }
    saveLock.current = true;
    const submittedDraft = { mood, tags: JSON.stringify(tags), note };
    app.setEditorDraft(draftKey, submittedDraft);
    setSaving(true);
    setError("");
    try {
      const result = await app.save("checkins", {
        mood,
        tags,
        note: note.trim(),
        day: localDay(),
        createdAt: stamp(),
      });
      app.setEditorDraft(draftKey, null, submittedDraft);
      app.setParams({ savedCheckinId: result.id });
      if (!result.localOnly) void playHaptic("confirmation");
    } catch (e) {
      setError(errText(e));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  if (savedCheckin)
    return (
      <Screen variant="nested">
        <ScenePage
          kind="checkin"
          title={
            awaitingSync
              ? app.draftProtection === "device"
                ? "Kept on this device"
                : "Kept in this tab"
              : "Your check-in is saved"
          }
          description={
            awaitingSync
              ? app.draftProtection === "device"
                ? "Your check-in is saved securely on this device and waiting to sync to your account."
                : "Your check-in is waiting to sync. Keep this browser tab open; closing it will remove this unsynced writing."
              : "You made a little space for yourself. Choose a next step if it feels right."
          }
          meta={String(savedCheckin.mood ?? "")}
        />
        <CheckinNextStep key={savedCheckin.id} checkin={savedCheckin} />
        {awaitingSync && (
          <Button
            title="Manage unsynced writing"
            variant="ghost"
            onPress={() => app.navigate("account")}
            style={{ marginTop: 12 }}
          />
        )}
      </Screen>
    );
  return (
    <Screen variant="nested">
      <ScenePage
        kind="checkin"
        title="How are you feeling?"
        description="Take a quick moment to check in with yourself today."
      />
      <View
        style={[
          styles.moodPanel,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Heading small>Your mood today</Heading>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Your mood today"
          style={[styles.moodRow, tightMoodRow && styles.tightMoodRow]}
        >
          {moodPetals.map(({ mood: label, image }, index) => (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: mood === label }}
              aria-checked={mood === label}
              {...webRadioProps(mood === label || (!mood && index === 0))}
              disabled={saving}
              onPress={() => {
                writeDraft(label);
                setError("");
              }}
              style={({ pressed }) => [
                styles.moodChoice,
                {
                  flexBasis: moodTileBasis,
                  opacity: pressed ? 0.75 : 1,
                  backgroundColor:
                    mood === label ? colors.lavenderSurface : colors.bg,
                  borderColor: mood === label ? colors.lavender : colors.border,
                },
              ]}
            >
              <MoodPetal source={image} style={{ width: 35, height: 34 }} />
              <Copy
                style={{
                  fontSize: 11.5,
                  lineHeight: 17,
                  textAlign: "center",
                  color: mood === label ? colors.lavenderText : colors.text,
                }}
              >
                {label}
              </Copy>
            </Pressable>
          ))}
        </View>
      </View>
      <EditorialSection
        title="What shaped today?"
        description="Add a little context if you want to remember it later."
      />
      <View
        style={[
          styles.checkinWriting,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.sectionLabel}>
          <Mark name="pricetag-outline" size={17} color={colors.lavenderText} />
          <Copy>Add tags (optional)</Copy>
        </View>
        <View style={styles.chips}>
          {tagChoices.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tags.includes(tag) }}
              aria-checked={tags.includes(tag)}
              disabled={saving}
              onPress={() =>
                writeDraft(
                  mood,
                  tags.includes(tag)
                    ? tags.filter((v) => v !== tag)
                    : [...tags, tag],
                )
              }
              style={[
                styles.chip,
                {
                  backgroundColor: tags.includes(tag)
                    ? colors.lavenderSurface
                    : colors.surface,
                  borderColor: tags.includes(tag)
                    ? colors.lavender
                    : colors.border,
                },
              ]}
            >
              <Copy style={{ fontSize: 13 }}>{tag}</Copy>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: more }}
            onPress={() => setMore(!more)}
            style={[styles.chip, { borderColor: colors.border }]}
          >
            <Copy style={{ fontSize: 13 }}>
              {more ? "Fewer tags" : "+ More"}
            </Copy>
          </Pressable>
        </View>
        <View style={styles.sectionLabel}>
          <Mark name="pencil-outline" size={17} color={colors.lavenderText} />
          <Copy>Add a note (optional)</Copy>
        </View>
        <Field
          value={note}
          onChangeText={(value) => writeDraft(mood, tags, value)}
          editable={!saving}
          placeholder="What is on your mind today?"
          minHeight={88}
          style={styles.checkinField}
        />
      </View>
      <Copy muted style={styles.draftCaption}>
        {app.draftProtection === "device"
          ? "Drafts stay on this device. Save your check-in to add it to Journey."
          : "Drafts stay in this tab until it closes or reloads. Save to add this check-in to Journey."}
      </Copy>
      <ErrorNote error={app.offlineError || ""} />
      <ErrorNote error={error} />
      <Button
        title={saving ? "Saving…" : "Save check-in"}
        onPress={save}
        disabled={saving}
      />
    </Screen>
  );
}

function Assessments() {
  const app = useApp();
  return (
    <Screen variant="nested">
      <ScenePage
        kind="reflection"
        title="Check-ins"
        description="Make a little space for how life feels right now."
        meta="Three guided reflections"
      />
      <EditorialSection title="Choose a reflection" />
      {ASSESSMENTS.map((item) => {
        const previous = [...(app.data.assessments || [])]
          .filter((v: AnyRecord) => v.assessmentType === item.id)
          .sort((a: AnyRecord, b: AnyRecord) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          )[0];
        return (
          <View key={item.id}>
            <ArtShelfItem
              title={item.title}
              label={`Start ${item.title}`}
              detail={item.description}
              kind={
                item.id === "mood"
                  ? "checkin"
                  : item.id === "anxiety"
                    ? "grounding"
                    : "reflection"
              }
              onPress={() => app.navigate("assessment", { id: item.id })}
            />
            {previous && (
              <View style={styles.previousReflection}>
                <Copy muted style={styles.shelfDetail}>
                  Last reflection{" "}
                  {new Date(previous.createdAt).toLocaleDateString()}
                </Copy>
                <Button
                  title="View last reflection"
                  variant="ghost"
                  onPress={() =>
                    app.navigate("assessment-result", { id: previous.id })
                  }
                />
              </View>
            )}
          </View>
        );
      })}
      <Hint>
        These are personal reflections, not validated clinical assessments or
        diagnoses.
      </Hint>
    </Screen>
  );
}

function Assessment({ definition }: { definition: AssessmentDefinition }) {
  const app = useApp();
  const goBack = useGuardedBack(app.back);
  const { colors } = useTheme();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState<AnyRecord | null>(null);
  const saveLock = useRef(false);
  const visible = useRef(false);
  useTabResetGuard(answers.length > 0 && !savedResult);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [index]);
  useLayoutEffect(() => {
    visible.current = true;
    return () => {
      visible.current = false;
    };
  }, []);
  async function next() {
    if (saveLock.current) return;
    if (savedResult) {
      app.navigate("assessment-result", { result: savedResult });
      return;
    }
    if (answers[index] === undefined) {
      setError("Choose the answer that feels closest to your experience.");
      return;
    }
    if (index < definition.questions.length - 1) {
      setIndex(index + 1);
      setError("");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const summary = assessmentSummary(definition.id, answers);
      const saved = await app.save("assessments", {
        assessmentType: definition.id,
        title: definition.title,
        answers,
        score: summary.score,
        summary,
        createdAt: stamp(),
      });
      const result = saved || { assessmentType: definition.id, summary };
      setSavedResult(result);
      if (visible.current) app.navigate("assessment-result", { result });
    } catch (e) {
      setError(errText(e));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen variant="nested" scrollRef={scroll}>
      <NestedHeader title={definition.title} onBack={app.back} />
      <View
        style={[
          styles.questionPanel,
          {
            backgroundColor: colors.lavenderSurface,
            borderColor: colors.border,
          },
        ]}
      >
        <Copy
          style={{
            color: colors.lavenderText,
            fontFamily: F.strong,
            fontSize: 13,
          }}
        >
          Question {index + 1} of {definition.questions.length}
        </Copy>
        <View accessible={false} aria-hidden style={styles.progressRow}>
          {definition.questions.map((_, n) => (
            <View
              key={n}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 5,
                backgroundColor:
                  n <= index ? colors.lavenderText : colors.border,
              }}
            />
          ))}
        </View>
        <Heading
          style={{
            fontSize: 33,
            lineHeight: 36,
          }}
        >
          {definition.questions[index]}
        </Heading>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Choose an answer"
      >
        {ASSESSMENT_OPTIONS.map((label, value) => (
          <Choice
            key={label}
            label={label}
            selected={answers[index] === value}
            disabled={saving || !!savedResult}
            onPress={() => {
              const nextAnswers = [...answers];
              nextAnswers[index] = value;
              setAnswers(nextAnswers);
              setError("");
            }}
          />
        ))}
      </View>
      <ErrorNote error={error} />
      <View style={styles.twoButtons}>
        <View style={{ flex: 1 }}>
          <Button
            title="Back"
            icon="arrow-back"
            variant="secondary"
            disabled={saving}
            onPress={() =>
              index && !savedResult ? setIndex(index - 1) : goBack()
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={
              saving
                ? "Saving…"
                : savedResult
                  ? "View reflection"
                  : index === definition.questions.length - 1
                    ? "Finish"
                    : "Next"
            }
            icon="arrow-forward"
            onPress={next}
            disabled={saving}
          />
        </View>
      </View>
      <Copy muted style={{ fontSize: 12, marginTop: 16 }}>
        Answer in your own time. You can leave this reflection at any point.
      </Copy>
    </Screen>
  );
}

function AssessmentResult({ params }: { params: AnyRecord }) {
  const app = useApp();
  const result =
    params.result ||
    (app.data.assessments || []).find((v: AnyRecord) => v.id === params.id);
  const summary =
    result?.summary ||
    (result
      ? assessmentSummary(
          result.assessmentType as AssessmentId,
          result.answers || [],
        )
      : null);
  if (!summary) {
    return (
      <Screen variant="nested">
        <NestedHeader title="Your check-in" onBack={app.back} />
        <NestedState
          icon="clipboard-outline"
          title="Reflection unavailable"
          description="You can return to Reflective Check-ins to choose another reflection."
        >
          <Button
            title="View check-ins"
            onPress={() => app.navigate("assessments")}
          />
        </NestedState>
      </Screen>
    );
  }
  return (
    <Screen variant="nested">
      <ScenePage
        title={summary.title}
        description={summary.text}
        kind="reflection"
        meta="Your check-in"
      />
      <EditorialSection
        title="Suggested next steps"
        description="Choose one if it feels useful today."
      />
      <Action
        title="Take a reset moment"
        description="A short breathing practice, at your pace."
        onPress={() => app.navigate("breathing")}
      />
      <Action
        title="Notice what is needed"
        description="A gentle reflection to check in with yourself."
        icon="flower-outline"
        onPress={() => app.navigate("reflection")}
      />
      <Action
        title="Add a calming habit"
        description="A small, supportive practice for your routine."
        icon="calendar-outline"
        onPress={() =>
          app.navigate(routes.habitCreate, {
            suggestion: starterHabits.find(
              (habit) => habit.activity === "breathing",
            ),
          })
        }
      />
      <Hint>
        This is a reflection, not a diagnosis. You can find human support in
        Resources whenever you need it.
      </Hint>
      <Button
        title="Done"
        variant="secondary"
        onPress={() => app.navigate("assessments")}
      />
    </Screen>
  );
}

function Breathing({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const daylight = resolved === "light";
  const { width, height } = useWindowDimensions();
  const artSize = Math.min(180, width * 0.45, height * 0.24);
  const [duration, setDuration] = useState(
    Math.max(60, Math.min(180, Number(params.durationSec) || 60)),
  );
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [started]);
  const [autoPaused, setAutoPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const [ending, setEnding] = useState(false);
  const base = useRef(0);
  const before = useRef(0);
  const startedAt = useRef<string | undefined>(undefined);
  const active = useRef(false);
  const finished = useRef(false);
  const endSeconds = useRef(0);
  const resumeAfterEnd = useRef(false);
  const cue = breathingPosition(elapsed, { inhale: 4, hold: 0, exhale: 6 });
  const motion = useBreathingMotion(
    started
      ? { ...cue, phaseEndsAtMs: Math.round(elapsed * 1000 + cue.remainingMs) }
      : null,
    running,
    reducedMotion,
    0,
  );
  const scale = useMemo(
    () => motion.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }),
    [motion],
  );
  function finish(seconds: number, complete: boolean) {
    if (finished.current) return;
    finished.current = true;
    active.current = false;
    setRunning(false);
    const recordedSeconds = complete
      ? duration
      : Math.min(duration, Math.floor(seconds));
    const completedAt = new Date();
    app.navigate("feedback", {
      session: {
        id: newMomentSessionId(),
        practiceId: "breathing",
        type: "breathing",
        title:
          duration === 60 ? "One-minute breathing reset" : "A reset moment",
        durationSec: recordedSeconds,
        duration: recordedSeconds,
        plannedDurationSec: duration,
        completed: complete,
        outcome: complete ? "completed" : "early-exit",
        source: params.source || "wellness",
        ...(params.conversationId || params.sourceConversationId
          ? {
              sourceConversationId:
                params.conversationId || params.sourceConversationId,
            }
          : {}),
        createdAt: completedAt.toISOString(),
        startedAt: startedAt.current,
        endedAt: completedAt.toISOString(),
        day: localDay(completedAt),
        ...practiceOrigins(params, app.data.checkins),
      },
    });
  }
  function pause() {
    if (!active.current) return before.current;
    before.current = Math.min(
      duration,
      before.current + Math.max(0, monotonicNow() - base.current) / 1000,
    );
    active.current = false;
    setElapsed(before.current);
    setRunning(false);
    return before.current;
  }
  function resume() {
    if (finished.current) return;
    if (before.current >= duration) {
      finish(duration, true);
      return;
    }
    base.current = monotonicNow();
    startedAt.current ||= stamp();
    active.current = true;
    setRunning(true);
    setStarted(true);
    setAutoPaused(false);
  }
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      if (!active.current) return;
      const seconds =
        before.current + Math.max(0, monotonicNow() - base.current) / 1000;
      if (seconds >= duration) {
        finish(duration, true);
        return;
      }
      setElapsed(seconds);
      timer = setTimeout(tick, nextMomentTickDelay(seconds * 1000, duration));
    }
    const elapsedMs =
      before.current * 1000 + Math.max(0, monotonicNow() - base.current);
    timer = setTimeout(tick, nextMomentTickDelay(elapsedMs, duration));
    return () => clearTimeout(timer);
  }, [running, duration]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" && active.current) {
        pause();
        setAutoPaused(true);
      }
    });
    return () => listener.remove();
  }, [running, duration]);
  function toggle() {
    if (active.current) pause();
    else resume();
  }
  function end() {
    if (!started) {
      app.back();
      return;
    }
    resumeAfterEnd.current = active.current;
    endSeconds.current = pause();
    if (endSeconds.current >= duration) finish(duration, true);
    else setEnding(true);
  }
  function keepGoing() {
    setEnding(false);
    if (resumeAfterEnd.current) resume();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (ending) keepGoing();
      else end();
      return true;
    });
    return () => listener.remove();
  }, [started, ending, duration]);
  if (ending)
    return (
      <Screen variant="nested">
        <NestedHeader title="End this moment?" onBack={keepGoing} />
        <Card style={{ padding: 24 }}>
          <Copy style={{ marginBottom: spacing.card }}>
            Your moment is paused. You can save a reflection on the{" "}
            {clock(endSeconds.current)} you have taken, or continue when you are
            ready.
          </Copy>
          <Button
            title="End and reflect"
            onPress={() => finish(endSeconds.current, false)}
          />
          <View style={{ marginTop: 10 }}>
            <Button
              title="Keep going"
              variant="secondary"
              onPress={keepGoing}
            />
          </View>
        </Card>
      </Screen>
    );
  return (
    <Screen variant="nested" scrollRef={scroll}>
      <NestedHeader title="Solace Moment" onBack={end} />
      <View
        style={[
          styles.breathStage,
          {
            backgroundColor: daylight ? colors.surface : colors.lavenderSurface,
            borderColor: colors.border,
          },
        ]}
      >
        {daylight ? (
          <View
            pointerEvents="none"
            style={[styles.daylightBreathArt, { height: artSize + 43 }]}
          >
            <Image
              source={require("../../assets/redesign-explore-feature-light.jpg")}
              resizeMode="cover"
              resizeMethod="scale"
              fadeDuration={0}
              accessible={false}
              style={coverImageStyle}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                artGradient(
                  `linear-gradient(180deg, transparent 48%, ${colors.surface}3D 74%, ${colors.surface} 100%)`,
                ),
              ]}
            />
          </View>
        ) : (
          <BotanicalBackdrop
            style={{
              width: 210,
              height: 210,
              top: -50,
              right: -115,
              opacity: 0.2,
            }}
          />
        )}
        <View style={styles.momentArt} pointerEvents="none">
          <Animated.View
            style={{ transform: [{ scale: reducedMotion ? 1 : scale }] }}
          >
            <Artwork kind="petal" size={artSize} />
          </Animated.View>
        </View>
        <Heading style={styles.breathTitle}>
          {!started ? "A moment for you" : !running ? "Rest here" : cue.phase}
        </Heading>
        <Copy muted style={styles.breathContext}>
          {!started
            ? "A comfortable breath. Nothing to force."
            : running
              ? `${cue.remaining}s in this phase`
              : "Your practice is paused."}
        </Copy>
        <View style={styles.breathTime}>
          <Copy accessibilityLiveRegion="none" style={styles.breathClock}>
            {clock(elapsed)}
          </Copy>
          <Copy muted style={styles.breathTotal}>
            / {clock(duration)}
          </Copy>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Practice time"
          accessibilityValue={{
            min: 0,
            max: duration,
            now: Math.floor(elapsed),
          }}
          style={[styles.breathTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={{
              width: `${(elapsed / duration) * 100}%`,
              height: "100%",
              backgroundColor: colors.lavenderText,
            }}
          />
        </View>
      </View>
      {!started && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Practice duration"
          style={[styles.chips, styles.breathDurations]}
        >
          {[60, 120, 180].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: duration === value }}
              aria-checked={duration === value}
              {...webRadioProps(duration === value)}
              onPress={() => setDuration(value)}
              style={[
                styles.chip,
                {
                  flexGrow: 1,
                  backgroundColor:
                    duration === value
                      ? colors.lavenderSurface
                      : colors.surface,
                  borderColor:
                    duration === value ? colors.lavender : colors.border,
                },
              ]}
            >
              <Copy style={{ fontSize: 13 }}>{value / 60} min</Copy>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.twoButtons}>
        <View style={{ flex: 1 }}>
          <Button title="End" variant="secondary" onPress={end} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={running ? "Pause" : started ? "Resume" : "Begin"}
            onPress={toggle}
          />
        </View>
      </View>
      {!started && (
        <View style={styles.breathBookmark}>
          <SaveToToolkit
            kind="breathing"
            targetId="breathing"
            title="A breathing moment"
          />
        </View>
      )}
      {autoPaused && (
        <Copy
          muted
          style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}
        >
          Your moment paused while the app was away. Resume when you are ready.
        </Copy>
      )}
      <Copy
        muted
        style={{
          fontSize: 12,
          lineHeight: 18,
          textAlign: "center",
          marginTop: 24,
        }}
      >
        Keep breathing naturally. If a paced breath feels uncomfortable, stop
        and choose another activity.
      </Copy>
    </Screen>
  );
}

function Feedback({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { width, fontScale } = useWindowDimensions();
  const stackChoices = width < 350 || fontScale > 1.25;
  const { colors, resolved } = useTheme();
  const session = params.session;
  const completed = session?.completed === true;
  const draftKey = `feedback:${String(session?.id || session?.createdAt || "new")}`;
  const draft = app.editorDrafts[draftKey];
  const [feedback, setFeedback] = useState(draft?.feedback || "");
  const [note, setNote] = useState(draft?.note || "");
  const [remember, setRemember] = useState(draft?.remember === "true");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showExtraFeedback, setShowExtraFeedback] = useState(
    !!(draft?.feedback || draft?.note),
  );
  const [submitted, setSubmitted] = useState(draft?.submitted === "true");
  const savedSession = useRef<AnyRecord | null>(
    draft?.savedSessionId ? { id: draft.savedSessionId } : null,
  );
  const [completionSaved, setCompletionSaved] = useState(
    () =>
      completed &&
      !!session.id &&
      app.data.sessions.some((record) => record.id === session.id),
  );
  const [savingCompletion, setSavingCompletion] = useState(
    completed && !completionSaved,
  );
  const [completionError, setCompletionError] = useState("");
  const autoSaveAttempted = useRef(false);
  const saveLock = useRef(false);
  const awaitingCompletion = completed && !completionSaved;
  const waitingForSession =
    awaitingCompletion || (submitted && !savedSession.current);
  useTabResetGuard(
    !!session &&
      !saved &&
      (savingCompletion ||
        saving ||
        awaitingCompletion ||
        (!completed && !savedSession.current) ||
        !!(feedback || note || remember)),
    savingCompletion || saving ? "saving" : "dirty",
  );
  async function saveCompletion() {
    if (saveLock.current || !awaitingCompletion) return;
    saveLock.current = true;
    setSavingCompletion(true);
    setCompletionError("");
    try {
      // Practice completion belongs to Journey even when the optional
      // feedback is skipped. Retries use the same unmodified client ID.
      await app.save("sessions", session);
      setCompletionSaved(true);
      void playHaptic("confirmation");
    } catch (e) {
      setCompletionError(errText(e));
    } finally {
      saveLock.current = false;
      setSavingCompletion(false);
    }
  }
  const writeCompletion = useRef(saveCompletion);
  writeCompletion.current = saveCompletion;
  useEffect(() => {
    if (!awaitingCompletion || autoSaveAttempted.current) return;
    autoSaveAttempted.current = true;
    void writeCompletion.current();
  }, [awaitingCompletion]);

  function writeDraft(
    nextFeedback = feedback,
    nextNote = note,
    nextRemember = remember,
  ) {
    if (saveLock.current) return;
    setFeedback(nextFeedback);
    setNote(nextNote);
    setRemember(nextRemember);
    app.setEditorDraft(draftKey, {
      feedback: nextFeedback,
      note: nextNote,
      remember: String(nextRemember),
      savedSessionId: savedSession.current?.id || "",
      submitted: String(submitted),
    });
  }
  const preference =
    session?.type === "grounding"
      ? "Finds five-senses grounding helpful."
      : session?.type === "breathing"
        ? "Finds short breathing moments helpful."
        : null;
  async function save() {
    if (saveLock.current || !session || awaitingCompletion) return;
    saveLock.current = true;
    const submittedDraft = {
      feedback,
      note,
      remember: String(remember),
      savedSessionId: String(savedSession.current?.id || ""),
      submitted: "true",
    };
    app.setEditorDraft(draftKey, submittedDraft);
    setSubmitted(true);
    setSaving(true);
    setError("");
    try {
      const persisted: AnyRecord =
        completed && !feedback && !note.trim()
          ? session
          : await app.save("sessions", {
              ...(completed ? { id: session.id } : session),
              ...(savedSession.current?.id
                ? { id: savedSession.current.id }
                : {}),
              feedback: feedback || "skipped",
              note: note.trim(),
            });
      savedSession.current = persisted;
      const savedDraft = {
        ...submittedDraft,
        savedSessionId: String(persisted.id),
      };
      app.setEditorDraft(draftKey, savedDraft);
      if (remember && feedback === "Helped" && preference)
        await app.save("memories", {
          id: `memory-${persisted.id}`,
          text: preference,
          content: preference,
          sourceType: "session",
          sourceId: persisted.id,
          ...(session.sourceConversationId
            ? { sourceConversationId: session.sourceConversationId }
            : {}),
          approved: true,
          createdAt: session.createdAt,
        });
      app.setEditorDraft(draftKey, null, savedDraft);
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  if (!session)
    return (
      <Screen variant="nested">
        <PageIntro title="Take a moment first">
          A reflection on your activity will be here after a breathing moment.
        </PageIntro>
        <Button
          title="Start a moment"
          onPress={() => app.navigate("breathing")}
        />
      </Screen>
    );
  if (saved && !completionSaved)
    return (
      <Screen key="practice-saved" variant="nested">
        <ScenePage
          title="A little care, saved"
          kind="checkin"
          description="Your moment is in your Journey. You can return whenever you need."
        />
        {session.sourceConversationId && (
          <View style={{ marginBottom: 12 }}>
            <Button
              title="Continue conversation"
              onPress={() =>
                app.navigate("chat", { id: session.sourceConversationId })
              }
            />
          </View>
        )}
        <Button
          title="View my Journey"
          onPress={() => app.navigate("journey")}
        />
        <Button
          title="Back to Today"
          variant="secondary"
          style={{ marginTop: 12 }}
          onPress={() => app.navigate("today")}
        />
      </Screen>
    );
  return (
    <Screen variant="nested">
      {completionSaved ? (
        <NestedHeader title="Practice complete" onBack={app.back} />
      ) : (
        <ScenePage
          title="You took a moment"
          kind={session.type === "grounding" ? "grounding" : "breathing"}
          description="There is no right way to feel afterward."
          meta={`${session.title || "Solace Moment"} · ${clock(session.durationSec ?? session.duration ?? 0)}`}
        />
      )}
      {savingCompletion && <Hint>Saving your practice to Journey…</Hint>}
      {completionSaved && <PracticeCompletion session={session} />}
      {completionSaved && (!showExtraFeedback || saved) ? (
        <>
          <Button
            title="View my Journey"
            onPress={() => app.navigate(routes.journey)}
          />
          {!!session.sourceConversationId && (
            <Button
              title="Continue conversation"
              variant="secondary"
              style={{ marginTop: 8 }}
              onPress={() =>
                app.navigate(routes.companion, {
                  id: session.sourceConversationId,
                })
              }
            />
          )}
          {!saved && (
            <Button
              title="Add optional practice feedback"
              variant="ghost"
              onPress={() => setShowExtraFeedback(true)}
              style={{ marginTop: 8 }}
            />
          )}
        </>
      ) : (
        <>
          <View
            style={[
              styles.writingDesk,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <EditorialSection
              title="How did that feel?"
              description="Optional. Leave a note for yourself or keep going."
            />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="How did that feel?"
              style={[
                styles.feedbackOptions,
                stackChoices && styles.stackedChoices,
              ]}
            >
              {[
                { label: "Helped", icon: "leaf-outline" },
                { label: "A little", icon: "water-outline" },
                { label: "Not for me", icon: "close-outline" },
              ].map(({ label, icon }) => {
                const selected = feedback === label;
                const disabled = saving || waitingForSession;
                const ink = selected ? colors.lavenderText : colors.text;
                return (
                  <Pressable
                    key={label}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: selected, disabled }}
                    aria-checked={selected}
                    {...webRadioProps(
                      selected || (!feedback && label === "Helped"),
                    )}
                    disabled={disabled}
                    onPress={() => writeDraft(label)}
                    style={({ pressed }) => [
                      styles.feedbackOption,
                      stackChoices && styles.feedbackOptionStacked,
                      {
                        borderColor: selected
                          ? colors.lavenderText
                          : colors.border,
                        backgroundColor: selected
                          ? colors.lavenderSurface
                          : colors.surface,
                        opacity: disabled || pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Mark name={icon} color={ink} size={20} />
                    <Copy
                      style={{
                        textAlign: stackChoices ? "left" : "center",
                        fontSize: 13,
                        color: ink,
                        flexShrink: 1,
                      }}
                    >
                      {label}
                    </Copy>
                  </Pressable>
                );
              })}
            </View>
            <Field
              value={note}
              onChangeText={(value) => writeDraft(feedback, value)}
              editable={!saving && !waitingForSession}
              placeholder="Add a note (optional)…"
              minHeight={90}
              style={styles.checkinField}
            />
          </View>
          {feedback === "Helped" && !!preference && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              aria-checked={remember}
              disabled={saving || waitingForSession}
              onPress={() => writeDraft(feedback, note, !remember)}
              style={styles.checkRow}
            >
              <Mark
                name={remember ? "checkbox" : "square-outline"}
                color={resolved === "dark" ? colors.primary : colors.accent}
              />
              <Copy style={{ flex: 1, fontSize: 13 }}>
                {session.type === "grounding"
                  ? "Save a preference that five-senses grounding helps me."
                  : "Save a preference that short breathing moments help me."}
              </Copy>
            </Pressable>
          )}
          {remember &&
            feedback === "Helped" &&
            !!preference &&
            !app.user?.personalization && (
              <Hint>
                This saves the preference for you to manage. Personalization is
                currently off; enable it in Profile if you want Solace to use
                approved preferences and recent check-ins.
              </Hint>
            )}
          <ErrorNote error={error} />
          <ErrorNote error={completionError} />
          {awaitingCompletion && !!completionError && (
            <Hint>
              Your completed practice has not been saved yet. You can retry
              here.
            </Hint>
          )}
          {waitingForSession && !awaitingCompletion && !saving && (
            <Hint>
              Your feedback is still here. Retry to save the same practice.
            </Hint>
          )}
          <Button
            title={
              savingCompletion
                ? "Saving practice…"
                : saving
                  ? "Saving…"
                  : waitingForSession
                    ? "Retry saving practice"
                    : "Save and continue →"
            }
            onPress={awaitingCompletion ? saveCompletion : save}
            disabled={saving || savingCompletion}
          />
          <Copy muted style={{ fontSize: 12, marginTop: 10 }}>
            Feedback is optional. You can inspect or remove approved memories in
            Profile.
          </Copy>
        </>
      )}
    </Screen>
  );
}

function selectedReflectionWeek(day: unknown) {
  if (typeof day !== "string") return undefined;
  try {
    const { startDay, endDay } = journeyWeek(day);
    if (day === endDay) return { start: startDay, end: endDay };
  } catch {
    // Other routes can open the journal without a valid Journey week.
  }
}

function Reflection() {
  const app = useApp();
  const { colors } = useTheme();
  const editId = typeof app.params?.id === "string" ? app.params.id : undefined;
  const existing = editId
    ? app.data.reflections.find((entry) => entry.id === editId)
    : undefined;
  const week = editId ? undefined : selectedReflectionWeek(app.params?.weekEnd);
  const weekStart = week?.start;
  const weekEnd = week?.end;
  const weeklyContext = useMemo(() => {
    if (!weekStart || !weekEnd) return;
    const now = new Date();
    const facts = weeklyStoryFacts(
      app.data,
      { start: weekStart, end: weekEnd },
      now,
    );
    const goal = selectJourneyGoal(app.data.goals);
    const progress = goal
      ? journeyGoalProgress(goal, app.data, now)
      : undefined;
    return {
      facts,
      goal:
        goal && progress
          ? {
              title: goal.title,
              paused: !goal.active,
              period: progress.period,
              description: progress.description,
            }
          : undefined,
    };
  }, [app.data, weekStart, weekEnd]);
  const hasStoryActivity =
    weeklyContext && hasWeeklyActivity(weeklyContext.facts);
  const savedStory = week && savedWeeklyStory(app.data.reflections, week.end);
  const draftKey = editId
    ? `reflection:edit:${editId}`
    : week
      ? `reflection:weekly:${week.end}`
      : "reflection:new";
  const draft = app.editorDrafts[draftKey];
  const [text, setText] = useState(
    draft?.text ??
      String(existing?.text || existing?.content || existing?.note || ""),
  );
  const [need, setNeed] = useState(draft?.need ?? String(existing?.need || ""));
  const [expanded, setExpanded] = useState(!!need);
  const [showEditor, setShowEditor] = useState(
    !week || !hasStoryActivity || !!(draft?.text || draft?.need),
  );
  const [weeklyProvider, setWeeklyProvider] = useState(
    draft?.weeklyProvider === "live" || draft?.weeklyProvider === "offline"
      ? draft.weeklyProvider
      : undefined,
  );
  const [suggestion, setSuggestion] = useState<WeeklyReflectionResult | null>(
    null,
  );
  const [guidedPrompt, setGuidedPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const generation = useRef<AbortController | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const saveLock = useRef(false);
  const maxLength = editId ? 10000 : 3000;
  useEffect(() => () => generation.current?.abort(), []);
  function cancelSuggestion() {
    const pending = generation.current;
    generation.current = null;
    pending?.abort();
    setGenerating(false);
  }
  async function generateSuggestion() {
    if (!week || !hasStoryActivity || generation.current || saveLock.current)
      return;
    const pending = new AbortController();
    generation.current = pending;
    setGenerating(true);
    setGenerationError("");
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await app.weeklyReflection(week.end, {
        today: localDay(),
        timeZone,
        signal: pending.signal,
      });
      if (generation.current !== pending || pending.signal.aborted) return;
      if (
        result?.period?.start !== week.start ||
        result?.period?.end !== week.end ||
        (result.provider !== "live" && result.provider !== "offline") ||
        typeof result.hasActivity !== "boolean" ||
        typeof result.prompt !== "string" ||
        !result.prompt.trim() ||
        typeof result.reflection !== "string" ||
        !result.reflection.trim() ||
        result.reflection.length > maxLength
      )
        throw new Error(
          "The reflection draft could not be read. Please try again.",
        );
      setSuggestion(result);
    } catch (e) {
      if (generation.current === pending && !pending.signal.aborted)
        setGenerationError(errText(e));
    } finally {
      if (generation.current === pending) {
        generation.current = null;
        setGenerating(false);
      }
    }
  }
  function draftFields(
    nextText: string,
    nextNeed: string,
    provider = weeklyProvider,
  ) {
    return {
      text: nextText,
      need: nextNeed,
      ...(provider ? { weeklyProvider: provider } : {}),
    };
  }
  function writeDraft(
    nextText = text,
    nextNeed = need,
    provider = weeklyProvider,
  ) {
    if (saveLock.current) return;
    setText(nextText);
    setNeed(nextNeed);
    setWeeklyProvider(provider);
    app.setEditorDraft(draftKey, draftFields(nextText, nextNeed, provider));
  }
  function useSuggestion() {
    if (!suggestion) return;
    if (!suggestion.hasActivity) {
      setGuidedPrompt(suggestion.prompt);
    } else {
      const next = text.trim()
        ? `${text}\n\n${suggestion.reflection}`
        : suggestion.reflection;
      if (next.length > maxLength) {
        setGenerationError(
          "This suggestion is too long to add to your draft. You can keep writing below.",
        );
        setShowEditor(true);
        return;
      }
      writeDraft(
        next,
        need,
        weeklyProvider === "live" ? "live" : suggestion.provider,
      );
    }
    setSuggestion(null);
    setGenerationError("");
    setShowEditor(true);
  }
  async function save() {
    if (saveLock.current) return;
    if (!text.trim()) {
      setError("Write a little about what is on your mind, or skip for now.");
      return;
    }
    saveLock.current = true;
    const submittedDraft = draftFields(text, need);
    app.setEditorDraft(draftKey, submittedDraft);
    setSaving(true);
    setError("");
    try {
      const result = await app.save("reflections", {
        ...(editId ? { id: editId } : {}),
        text: text.trim(),
        need: need.trim(),
        ...(!editId && app.params?.conversationId
          ? { sourceConversationId: app.params.conversationId }
          : {}),
        ...(!editId ? { createdAt: stamp() } : {}),
        ...(!editId && week
          ? {
              day: localDay(),
              weeklyPeriod: week,
              ...(weeklyProvider ? { weeklyProvider } : {}),
            }
          : {}),
      });
      setSavedId(String(result.id));
      app.setEditorDraft(draftKey, null, submittedDraft);
      setSaved(true);
    } catch (e) {
      setError(errText(e));
      if (week && (e as { status?: number }).status === 409) {
        await app.refresh().catch(() => {});
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  if (saved)
    return (
      <Screen variant="nested">
        <ScenePage
          kind="reflection"
          title={editId ? "Reflection updated" : "A little space, for you"}
          description={
            app.pendingWrites.some((entry) => entry.id === savedId)
              ? app.draftProtection === "device"
                ? "Your reflection is saved securely on this device. It is waiting to sync to your account."
                : "Your reflection is kept in this browser tab and waiting to sync. Keep the tab open; closing it will remove this unsynced writing."
              : "Your reflection is saved privately in your Journey."
          }
        />
        {app.params?.conversationId && (
          <View style={{ marginBottom: 12 }}>
            <Button
              title="Continue conversation"
              onPress={() =>
                app.navigate("chat", { id: app.params.conversationId })
              }
            />
          </View>
        )}
        {editId ? (
          <Button title="Back to reflection" onPress={app.back} />
        ) : (
          <Button
            title="View my Journey"
            onPress={week ? app.back : () => app.navigate("journey")}
          />
        )}
        <Button
          title="Back to Today"
          variant="secondary"
          style={{ marginTop: 12 }}
          onPress={() => app.navigate("today")}
        />
        {app.pendingWrites.some((entry) => entry.id === savedId) && (
          <Button
            title="Manage unsynced writing"
            variant="ghost"
            onPress={() => app.navigate("account")}
            style={{ marginTop: 12 }}
          />
        )}
      </Screen>
    );
  return (
    <Screen variant="nested">
      <ScenePage
        kind="reflection"
        title={
          editId
            ? existing?.weeklyPeriod
              ? "Edit your weekly story"
              : "Edit your reflection"
            : week
              ? "Your weekly story"
              : "A moment to reflect"
        }
        description={
          week
            ? reflectionPeriodLabel(week)
            : "A quiet place to put what’s on your mind into words."
        }
      >
        {!week && !editId && (
          <SaveToToolkit
            kind="reflection"
            targetId="reflection"
            title="A moment to reflect"
          />
        )}
      </ScenePage>
      {editId && (!existing || existing.localOnly) && (
        <Hint>
          {existing
            ? "Sync this reflection before editing it."
            : "This reflection is no longer available."}
        </Hint>
      )}
      {weeklyContext && (
        <WeeklyStoryOverview
          facts={weeklyContext.facts}
          goal={weeklyContext.goal}
          period={week}
        />
      )}
      {week && hasStoryActivity && (
        <Card style={{ padding: 16, marginBottom: 18, gap: 10 }}>
          <Heading small>Make space to reflect</Heading>
          <Copy muted>
            Solace can suggest a question using your activity totals. Your
            journal text stays private from the AI provider.
          </Copy>
          {generating ? (
            <>
              <Copy accessibilityLiveRegion="polite">
                Preparing your reflection draft…
              </Copy>
              <Button
                title="Cancel generation"
                variant="secondary"
                onPress={cancelSuggestion}
              />
            </>
          ) : (
            <Button
              title={
                generationError
                  ? "Retry reflection draft"
                  : suggestion || weeklyProvider
                    ? "Regenerate reflection draft"
                    : "Create an AI-assisted draft"
              }
              onPress={generateSuggestion}
              disabled={saving}
            />
          )}
          {!showEditor && (
            <Button
              title="Write my own reflection"
              variant="secondary"
              onPress={() => {
                cancelSuggestion();
                setSuggestion(null);
                setGenerationError("");
                setShowEditor(true);
              }}
            />
          )}
          <ErrorNote error={generationError} />
          {suggestion && !generating && (
            <>
              <Heading small>
                {suggestion.provider === "live"
                  ? "AI-assisted draft"
                  : suggestion.hasActivity
                    ? "Recorded summary"
                    : "A guided prompt"}
              </Heading>
              <Copy selectable>
                {suggestion.hasActivity
                  ? suggestion.reflection
                  : suggestion.prompt}
              </Copy>
              <Copy muted style={{ fontSize: 12 }}>
                {suggestion.explanation}
              </Copy>
              <Button
                title={
                  suggestion.hasActivity
                    ? text.trim()
                      ? "Add to my draft"
                      : "Use this draft"
                    : "Write with this prompt"
                }
                onPress={useSuggestion}
                variant="secondary"
                disabled={saving}
              />
            </>
          )}
        </Card>
      )}
      {week && !hasStoryActivity && (
        <Hint>
          There is no saved activity for this week yet. What would you like to
          make a little room for?
        </Hint>
      )}
      {showEditor && (!editId || (existing && !existing.localOnly)) && (
        <View style={{ gap: spacing.row }}>
          {!!guidedPrompt && <Hint>{guidedPrompt}</Hint>}
          {!!app.params?.prompt && <Hint>{String(app.params.prompt)}</Hint>}
          <View
            style={[
              styles.writingDesk,
              {
                backgroundColor: colors.lavenderSurface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.writingLabel}>
              <Mark
                name="create-outline"
                size={20}
                color={colors.lavenderText}
              />
              <Heading small style={{ color: colors.lavenderText }}>
                What has been on your mind?
              </Heading>
            </View>
            <Field
              value={text}
              onChangeText={(value) => writeDraft(value, need)}
              editable={!saving}
              placeholder="Write your reflection here…"
              minHeight={186}
              maxLength={maxLength}
              style={[styles.writingField, { borderTopColor: colors.border }]}
            />
            <View style={styles.between}>
              <Copy muted style={styles.shelfDetail}>
                Private reflection
              </Copy>
              <Copy muted style={styles.shelfDetail}>
                {text.length} / {maxLength}
              </Copy>
            </View>
          </View>
          <View>
            <Action
              title="What might you need?"
              description="If it feels helpful, explore what you need more of right now. (Optional)"
              onPress={() => setExpanded(!expanded)}
              expanded={expanded}
            />
            {expanded && (
              <Field
                value={need}
                onChangeText={(value) => writeDraft(text, value)}
                editable={!saving}
                placeholder="Perhaps rest, reassurance, connection, or something else…"
                minHeight={100}
                maxLength={maxLength}
                style={{ marginVertical: 0 }}
              />
            )}
          </View>
          <Copy muted style={styles.shelfDetail}>
            {app.draftProtection === "device"
              ? "Drafts stay on this device. Save to add your reflection to Journey."
              : "Drafts stay in this tab until it closes or reloads. Save to add your reflection to Journey."}
          </Copy>
          <ErrorNote error={app.offlineError || ""} />
          <ErrorNote error={error} />
          {savedStory && (
            <Button
              title="Reopen saved weekly story"
              variant="secondary"
              onPress={() =>
                app.navigate("reflection-detail", { id: savedStory.id })
              }
            />
          )}
          <Button
            title={
              saving
                ? "Saving…"
                : week
                  ? "Save weekly story"
                  : "Save reflection"
            }
            onPress={save}
            disabled={saving || !!savedStory}
          />
          <Button
            title="Keep draft and leave"
            variant="ghost"
            onPress={app.back}
            disabled={saving}
          />
          {!!(text || need) && !discarding && (
            <Button
              title="Discard draft…"
              variant="ghost"
              disabled={saving}
              onPress={() => setDiscarding(true)}
            />
          )}
          {discarding && (
            <Card style={{ marginTop: 12 }}>
              <Heading small>Discard this draft?</Heading>
              <Copy style={{ marginTop: 7, marginBottom: 12 }}>
                This removes the writing you have not saved. You can keep
                writing instead.
              </Copy>
              <Button
                title="Keep writing"
                variant="secondary"
                onPress={() => setDiscarding(false)}
              />
              <Button
                title="Discard draft"
                variant="ghost"
                onPress={() => {
                  setText("");
                  setNeed("");
                  setWeeklyProvider(undefined);
                  app.setEditorDraft(draftKey, null);
                  setExpanded(false);
                  setDiscarding(false);
                  setError("");
                }}
              />
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}

function Reflections() {
  const app = useApp();
  const { colors } = useTheme();
  const records = [...(app.data.reflections || [])].sort(
    (a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  return (
    <Screen variant="nested">
      <ScenePage
        title="Your reflections"
        kind="reflection"
        description="Return to the thoughts you’ve made space for."
        meta={
          records.length
            ? `${records.length} saved ${records.length === 1 ? "reflection" : "reflections"}`
            : "No saved reflections yet"
        }
      >
        <Button
          title="Write a reflection"
          icon="create-outline"
          onPress={() => app.navigate("reflection")}
        />
      </ScenePage>
      {!!records.length && <EditorialSection title="Your saved writing" />}
      {!!records.length && (
        <View
          style={[
            styles.guideTrail,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {records.map((record: AnyRecord, index) => (
            <Action
              key={record.id}
              title={
                record.weeklyPeriod
                  ? `Weekly story · ${reflectionPeriodLabel(record.weeklyPeriod)}`
                  : new Date(record.createdAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                    })
              }
              description={`${record.localOnly ? "Waiting to sync · " : ""}${String(
                record.text ||
                  record.content ||
                  record.note ||
                  "A saved reflection",
              ).slice(0, 130)}`}
              icon="create-outline"
              style={[
                styles.archiveRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
              onPress={() =>
                app.navigate(savedReflectionRoute(record), { id: record.id })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ReflectionDetail({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const deleteLock = useRef(false);
  const record = (app.data.reflections || []).find(
    (v: AnyRecord) => v.id === params.id,
  );
  async function remove() {
    if (!record?.id || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setError("");
    try {
      await app.remove("reflections", record.id);
      app.back();
    } catch (e) {
      setError(errText(e));
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }
  return (
    <Screen variant="nested">
      <ScenePage
        kind="reflection"
        title={record?.weeklyPeriod ? "Your weekly story" : "Your reflection"}
        description={
          record?.weeklyPeriod
            ? reflectionPeriodLabel(record.weeklyPeriod)
            : record
              ? new Date(record.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "This reflection is no longer available."
        }
      />
      {!!record?.localOnly && (
        <Hint>
          {app.draftProtection === "device"
            ? "Saved on this device. Waiting to sync to your account."
            : "Kept in this browser tab only. Keep it open until this entry syncs."}
        </Hint>
      )}
      {record && (
        <>
          <View
            style={[
              styles.writingDesk,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Copy selectable style={styles.readerCopy}>
              {record.text || record.content || record.note}
            </Copy>
            {!!record.need && (
              <View style={{ marginTop: 24 }}>
                <Heading small>What I needed</Heading>
                <Copy selectable style={{ marginTop: 8 }}>
                  {record.need}
                </Copy>
              </View>
            )}
          </View>
          <View style={{ marginTop: 20 }}>
            {!record.localOnly && (
              <Button
                title="Edit reflection"
                icon="create-outline"
                onPress={() => app.navigate("reflection", { id: record.id })}
                disabled={deleting}
                style={{ marginBottom: 8 }}
              />
            )}
            <Button
              title={confirmDelete ? "Keep reflection" : "Delete reflection"}
              variant="secondary"
              onPress={() => setConfirmDelete(!confirmDelete)}
            />
          </View>
          {confirmDelete && (
            <Card style={{ padding: 18, marginTop: 14 }}>
              <Heading small>Delete this reflection?</Heading>
              <Copy style={{ marginTop: 8, marginBottom: 16 }}>
                {record.localOnly
                  ? "This permanently removes this unsynced reflection from this device."
                  : "This permanently removes this reflection from your account."}
              </Copy>
              <Button
                title={deleting ? "Deleting…" : "Delete reflection"}
                onPress={remove}
                disabled={deleting}
              />
            </Card>
          )}
        </>
      )}
      <ErrorNote error={error} />
    </Screen>
  );
}

function SessionDetail({ params }: { params: AnyRecord }) {
  const app = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const record = (app.data.sessions || []).find(
    (v: AnyRecord) => v.id === params.id,
  );
  const day = record && recordDay(record);
  const followUpId = practiceFollowUpId(record?.id);
  const followUp = followUpId
    ? app.data.checkins.find((entry) => entry.id === followUpId)
    : undefined;
  const emotionalRecheck = emotionalRecheckLabel(
    record?.emotionalRecheck?.response,
  );
  const guidedSource = ["Explore", "Today", "Journey"].find(
    (source) => source === record?.source,
  );
  async function remove() {
    if (!record?.id) return;
    setDeleting(true);
    setError("");
    try {
      await app.remove("sessions", record.id);
      app.back();
    } catch (e) {
      setError(errText(e));
    } finally {
      setDeleting(false);
    }
  }
  return (
    <Screen variant="nested">
      <ScenePage
        kind={
          record?.type === "grounding"
            ? "grounding"
            : record?.resourceId === "sleep"
              ? "sleep"
              : "breathing"
        }
        title={record?.title || "Your moment"}
        description={
          day
            ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : record
              ? "Saved practice"
              : "This moment is no longer available."
        }
        meta={
          record
            ? record.completed
              ? "A completed practice"
              : "Practice record"
            : undefined
        }
      />
      {record && (
        <>
          <Card style={{ padding: 20 }}>
            <Heading small>Your practice details</Heading>
            {record.kind === "generated" && record.activity && (
              <View style={{ gap: 12, marginTop: 14 }}>
                <Copy>
                  {clock(record.durationSec || 0)} of active time ·{" "}
                  {record.environment === "ocean"
                    ? "Ocean Calm"
                    : record.environment === "twilight"
                      ? "Twilight Sky"
                      : "Forest Sanctuary"}
                </Copy>
                <Copy>{record.activity.description}</Copy>
                <Hint>
                  {record.provider === "live"
                    ? "Created with AI for this saved Moment."
                    : guidedSource
                      ? `Guided practice from ${guidedSource}.`
                      : "Built-in Moment · Live AI was off."}
                </Hint>
                <Button
                  title="Try this Moment again"
                  variant="secondary"
                  onPress={() =>
                    app.navigate("moment-player", {
                      activity: record.activity,
                      provider: record.provider || "offline",
                      source: guidedSource?.toLowerCase(),
                      explanation: "A Moment you previously saved.",
                      usedMemoryIds: [],
                    })
                  }
                />
              </View>
            )}
            {record.type === "breathing" && record.kind !== "generated" && (
              <Copy style={{ marginTop: 12 }}>
                {clock(record.durationSec ?? record.duration ?? 0)} of{" "}
                {clock(
                  record.plannedDurationSec ??
                    record.durationSec ??
                    record.duration ??
                    0,
                )}
                {record.completed ? "" : " · Ended early"}
              </Copy>
            )}
            {record.type === "grounding" && record.kind !== "generated" && (
              <Copy style={{ marginTop: 12 }}>
                {record.steps?.length || 0} of 5 senses explored ·{" "}
                {clock(record.durationSec || 0)} active time
              </Copy>
            )}
            {record.type === "resource" && (
              <Copy style={{ marginTop: 12 }}>
                {record.steps?.length || 0} practices tried
                {record.completed
                  ? " · Guide completed"
                  : " · Partial progress"}
              </Copy>
            )}
            {emotionalRecheck ? (
              <View style={{ marginTop: 20 }}>
                <Heading small>How you felt afterward</Heading>
                <Copy>{emotionalRecheck}</Copy>
                <Hint>
                  {new Date(
                    record.emotionalRecheck.recordedAt,
                  ).toLocaleString()}
                </Hint>
              </View>
            ) : (
              followUp && (
                <View style={{ marginTop: 20 }}>
                  <Heading small>Mood after practice</Heading>
                  <Copy>{followUp.mood}</Copy>
                  <Hint>
                    {new Date(followUp.createdAt).toLocaleString()}
                    {followUp.localOnly ? " · Waiting to sync" : ""}
                  </Hint>
                </View>
              )
            )}
            {record.feedback && record.feedback !== "skipped" && (
              <View style={{ marginTop: 20 }}>
                <Heading small>How it felt</Heading>
                <Copy style={{ marginTop: 5 }}>{record.feedback}</Copy>
              </View>
            )}
            {!!record.note && (
              <View style={{ marginTop: 20 }}>
                <Heading small>Your note</Heading>
                <Copy selectable style={{ marginTop: 8 }}>
                  {record.note}
                </Copy>
              </View>
            )}
          </Card>
          {record.sourceConversationId && (
            <View style={{ marginTop: 16 }}>
              <Button
                title="Continue conversation"
                onPress={() =>
                  app.navigate("chat", { id: record.sourceConversationId })
                }
              />
            </View>
          )}
          <View style={{ marginTop: 20 }}>
            <Button
              title={confirmDelete ? "Keep this moment" : "Delete this moment"}
              variant="secondary"
              onPress={() => setConfirmDelete(!confirmDelete)}
            />
          </View>
          {confirmDelete && (
            <Card style={{ padding: 18, marginTop: 14 }}>
              <Heading small>Delete this moment?</Heading>
              <Copy style={{ marginTop: 8, marginBottom: 16 }}>
                This removes the activity record and any approved preferences
                linked to this moment.
              </Copy>
              <Button
                title={deleting ? "Deleting…" : "Delete moment"}
                onPress={remove}
                disabled={deleting}
              />
            </Card>
          )}
        </>
      )}
      <ErrorNote error={error} />
    </Screen>
  );
}

function Resources() {
  const app = useApp();
  return (
    <Screen variant="nested">
      <ScenePage
        kind="guide"
        title="Resources"
        description="Practical ways to make room for rest, care, and perspective."
        meta={`${RESOURCE_GUIDES.length} guides · At your pace`}
      />
      <View style={styles.featureSection}>
        <EditorialSection
          title="Wellness guides"
          description="Pick a guide that fits what you need today."
        />
        {RESOURCE_GUIDES.map((guide) => (
          <ArtShelfItem
            key={guide.id}
            title={guide.title}
            detail={guide.subtitle}
            kind={guideArt(guide.id)}
            onPress={() => app.navigate("resource", { id: guide.id })}
          />
        ))}
      </View>
      <View style={styles.featureSection}>
        <EditorialSection title="Quick access" />
        <Action
          title="Your saved toolkit"
          description={`${app.data.favorites.length} saved ${app.data.favorites.length === 1 ? "practice or guide" : "practices and guides"}`}
          icon="bookmark-outline"
          tone="lavender"
          onPress={() => app.navigate("toolkit")}
        />
        <Action
          title="Five-senses grounding"
          description="Notice this moment through your senses."
          icon="hand-left-outline"
          tone="peach"
          onPress={() => app.navigate("grounding")}
        />
      </View>
      <Action
        title="Need more support?"
        description="Find human support and trusted resources."
        icon="help-buoy-outline"
        tone="peach"
        onPress={() => app.navigate("support")}
      />
    </Screen>
  );
}

function Resource({ guide }: { guide: ResourceGuide }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const [day] = useState(localDay);
  const previous = [...(app.data.sessions || [])]
    .filter(
      (v: AnyRecord) =>
        v.type === "resource" && v.resourceId === guide.id && v.day === day,
    )
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    )[0];
  const [checked, setChecked] = useState<number[]>(previous?.steps || []);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const saveLock = useRef(false);
  const savedSteps = useRef(checked);
  useTabResetGuard(
    checked.length !== savedSteps.current.length ||
      checked.some((step) => !savedSteps.current.includes(step)),
  );
  async function save() {
    if (saveLock.current) return;
    if (!checked.length && !previous?.id) {
      setError("Mark a practice you tried before saving your progress.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      await app.save("sessions", {
        id: previous?.id ?? `resource-${guide.id}-${day}`,
        type: "resource",
        resourceId: guide.id,
        title: guide.title,
        steps: [...checked].sort((a, b) => a - b),
        completed: checked.length === guide.steps.length,
        day,
      });
      savedSteps.current = checked;
      setSaved(true);
    } catch (e) {
      if ((e as { status?: number }).status === 409) {
        try {
          await app.refresh();
          setError(
            "Progress was saved in another attempt. Review your choices and save again.",
          );
        } catch (refreshError) {
          setError(errText(refreshError));
        }
      } else {
        setError(errText(e));
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen variant="nested">
      <ScenePage
        kind={guideArt(guide.id)}
        title={guide.title}
        description={guide.description}
      >
        <View style={styles.between}>
          <Copy style={{ fontFamily: F.strong, color: colors.lavenderText }}>
            Your progress
          </Copy>
          <Copy style={{ fontSize: 12, color: colors.lavenderText }}>
            {checked.length} of {guide.steps.length} practices
          </Copy>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Practices tried"
          accessibilityValue={{
            min: 0,
            max: guide.steps.length,
            now: checked.length,
          }}
          style={[styles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={{
              width: `${(checked.length / guide.steps.length) * 100}%`,
              height: 9,
              borderRadius: 8,
              backgroundColor: colors.lavenderText,
            }}
          />
        </View>
        <SaveToToolkit
          kind="resource"
          targetId={guide.id}
          title={guide.title}
        />
      </ScenePage>
      {guide.id === "anxiety" && (
        <ArtShelfItem
          title="Try five-senses grounding"
          detail="Follow an optional practice, one sense at a time."
          kind="grounding"
          onPress={() => app.navigate("grounding", { source: guide.id })}
        />
      )}
      <EditorialSection
        title={
          guide.id === "sleep"
            ? "Your wind-down sequence"
            : "Take it one practice at a time"
        }
        description="Open a step to read it. Mark the practices you try."
      />
      <View
        style={[
          styles.guideTrail,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {guide.steps.map((step, index) => (
          <View
            key={step.title}
            style={[
              styles.guideChapter,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardTop}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Mark ${step.title} as tried`}
                disabled={saving}
                accessibilityState={{ checked: checked.includes(index) }}
                aria-checked={checked.includes(index)}
                onPress={() => {
                  setChecked(
                    checked.includes(index)
                      ? checked.filter((v) => v !== index)
                      : [...checked, index],
                  );
                  setSaved(false);
                }}
                style={styles.checkbox}
              >
                <Mark
                  name={checked.includes(index) ? "checkbox" : "square-outline"}
                  color={resolved === "dark" ? colors.primary : colors.accent}
                  size={27}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={step.title}
                accessibilityState={{ expanded: expanded === index }}
                aria-expanded={expanded === index}
                onPress={() => setExpanded(expanded === index ? null : index)}
                style={({ pressed }) => [
                  styles.guideStep,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.flexCopy}>
                  <Heading small style={{ fontSize: 25 }}>
                    {step.title}
                  </Heading>
                  <Copy muted style={styles.shelfDetail}>
                    Practice {index + 1}
                  </Copy>
                </View>
                <Mark
                  name={expanded === index ? "chevron-up" : "chevron-down"}
                  size={19}
                />
              </Pressable>
            </View>
            {expanded === index && (
              <View style={{ paddingTop: 12 }}>
                <Copy style={{ fontSize: 14, lineHeight: 22 }}>
                  {step.text}
                </Copy>
                {step.action && (
                  <View style={{ marginTop: 14 }}>
                    <Button
                      title={
                        step.action === "breathing"
                          ? "Start a moment"
                          : step.action === "reflection"
                            ? "Open reflection"
                            : "Check in"
                      }
                      variant="secondary"
                      onPress={() =>
                        app.navigate(step.action!, { source: guide.id })
                      }
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
      <Copy muted style={{ fontSize: 12, marginTop: 5, marginBottom: 12 }}>
        Mark the practices you actually tried. You can save partial progress.
      </Copy>
      <ErrorNote error={error} />
      {saved && <Hint>Your progress has been saved to your Journey.</Hint>}
      <Button
        title={saving ? "Saving…" : saved ? "Progress saved" : "Save progress"}
        onPress={save}
        disabled={saving || saved}
      />
      <View style={styles.twoButtons}>
        <View style={{ flex: 1 }}>
          <Button
            title="Talk with Solace"
            onPress={() =>
              app.navigate("chat", {
                context: `I have been exploring ${guide.title.toLowerCase()}.`,
              })
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Get support"
            variant="secondary"
            onPress={() => app.navigate("support")}
          />
        </View>
      </View>
    </Screen>
  );
}

function Affirmation() {
  const app = useApp();
  const { colors } = useTheme();
  const challengeOnly = app.route === "challenge";
  const text = todayAffirmation();
  const day = localDay();
  const favourite = (app.data.plans || []).find(
    (v: AnyRecord) => v.type === "affirmation" && v.text === text,
  );
  const previousChallenge = (app.data.plans || []).find(
    (v: AnyRecord) => v.type === "challenge" && v.day === day,
  );
  const [isSaved, setIsSaved] = useState(!!favourite);
  const [complete, setComplete] = useState(!!previousChallenge?.completed);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function saveAffirmation() {
    if (isSaved) return;
    setBusy("affirmation");
    setError("");
    try {
      await app.save("plans", {
        type: "affirmation",
        title: "Saved affirmation",
        text,
        day,
        createdAt: stamp(),
      });
      setIsSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  }
  async function markComplete() {
    setBusy("challenge");
    setError("");
    try {
      await app.save("plans", {
        ...(previousChallenge?.id ? { id: previousChallenge.id } : {}),
        type: "challenge",
        title: "Take a 3-minute reset",
        day,
        completed: !complete,
        createdAt: previousChallenge?.createdAt || stamp(),
        updatedAt: stamp(),
      });
      setComplete(!complete);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <Screen variant="nested">
      {challengeOnly && (
        <ScenePage
          title="Daily challenge"
          kind="breathing"
          description="Make a few minutes for yourself today."
          meta={complete ? "Completed today" : "3 minutes · At your pace"}
        />
      )}
      {!challengeOnly && (
        <ScenePage title="Today’s affirmation" kind="checkin">
          <Text
            style={[
              styles.affirmation,
              {
                color: colors.lavenderText,
              },
            ]}
          >
            {text}
          </Text>
          <View style={styles.affirmationAction}>
            <Button
              title={
                busy === "affirmation"
                  ? "Saving…"
                  : isSaved
                    ? "Affirmation saved"
                    : "Save affirmation"
              }
              onPress={saveAffirmation}
              disabled={!!busy || isSaved}
            />
          </View>
        </ScenePage>
      )}
      <Card
        style={{ padding: spacing.card, backgroundColor: colors.sageSurface }}
      >
        {!challengeOnly && (
          <View style={styles.cardTop}>
            <Mark name="leaf-outline" />
            <Copy style={{ fontFamily: F.strong, fontSize: 12 }}>
              A small daily challenge
            </Copy>
          </View>
        )}
        <Heading
          small
          style={{ marginTop: challengeOnly ? 0 : 15, fontSize: 30 }}
        >
          Take a 3-minute reset
        </Heading>
        <Copy style={{ marginTop: 8 }}>
          Step away from your tasks and give yourself a brief moment of care.
        </Copy>
        <View style={{ marginTop: 16 }}>
          <Button
            title="Start a 3-minute moment"
            onPress={() =>
              app.navigate("breathing", {
                durationSec: 180,
                source: "daily-challenge",
              })
            }
          />
        </View>
        <View style={{ marginTop: 10 }}>
          <Button
            title={
              busy === "challenge"
                ? "Saving…"
                : complete
                  ? "Completed today · undo"
                  : "I tried this — mark complete"
            }
            variant="secondary"
            onPress={markComplete}
            disabled={!!busy}
          />
        </View>
      </Card>
      <ErrorNote error={error} />
      <Copy muted style={{ marginTop: 15, fontSize: 12 }}>
        {challengeOnly
          ? "Completed challenges appear in your Journey."
          : "Your saved affirmations and completed challenges appear in your Journey."}
      </Copy>
      {!challengeOnly && (
        <View style={{ marginTop: 12 }}>
          <Button
            title="View saved affirmations"
            variant="secondary"
            onPress={() => app.navigate("saved-affirmations")}
          />
        </View>
      )}
    </Screen>
  );
}

function SavedAffirmations() {
  const app = useApp();
  const { colors } = useTheme();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState("");
  const records = (app.data.plans || []).filter(
    (v: AnyRecord) => v.type === "affirmation",
  );
  async function remove(id: string) {
    setRemoving(id);
    setError("");
    try {
      await app.remove("plans", id);
    } catch (e) {
      setError(errText(e));
    } finally {
      setRemoving("");
    }
  }
  return (
    <Screen variant="nested">
      <ScenePage
        title="Saved affirmations"
        kind="checkin"
        description={
          records.length
            ? "Words you’ve chosen to keep close."
            : "Save a thought from Today’s affirmation to return to it here."
        }
        meta={
          records.length
            ? `${records.length} saved`
            : "No saved affirmations yet"
        }
      />
      {records.length
        ? records.map((record: AnyRecord) => (
            <View
              key={record.id}
              style={[
                styles.writingDesk,
                styles.featureSection,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Mark
                name="bookmark-outline"
                size={19}
                color={colors.lavenderText}
              />
              <Heading small style={{ fontSize: 30, lineHeight: 35 }}>
                {record.text}
              </Heading>
              <View style={{ marginTop: 16 }}>
                <Button
                  title={
                    removing === record.id ? "Removing…" : "Remove from saved"
                  }
                  variant="ghost"
                  onPress={() => remove(record.id)}
                  disabled={!!removing}
                />
              </View>
            </View>
          ))
        : null}
      <ErrorNote error={error} />
      <Button
        title="Today’s affirmation"
        onPress={() => app.navigate("affirmation")}
      />
    </Screen>
  );
}

export default function WellnessScreen({ name }: { name: string }) {
  const app = useApp();
  const params = ((app as any).route?.params ||
    (app as any).params ||
    {}) as AnyRecord;
  if (name === "toolkit") return <Toolkit />;
  if (name === "grounding") return <Grounding params={params} />;
  if (name === "checkin") return <Checkin />;
  if (name === "assessments") return <Assessments />;
  if (name === "assessment") {
    const definition = ASSESSMENTS.find(({ id }) => id === params.id);
    return definition ? (
      <Assessment key={definition.id} definition={definition} />
    ) : (
      <MissingWellnessItem
        title="Check-in unavailable"
        description="This reflection is no longer available. Choose another check-in to continue."
        icon="clipboard-outline"
        action="View check-ins"
        destination="assessments"
      />
    );
  }
  if (name === "assessment-result") return <AssessmentResult params={params} />;
  if (name === "breathing" || name === "moment")
    return <Breathing params={params} />;
  if (name === "feedback") return <Feedback params={params} />;
  if (name === "reflection") return <Reflection />;
  if (name === "reflections") return <Reflections />;
  if (name === "reflection-detail") return <ReflectionDetail params={params} />;
  if (name === "session-detail") return <SessionDetail params={params} />;
  if (name === "resources") return <Resources />;
  if (name === "resource" || name === "sleep") {
    const guide = RESOURCE_GUIDES.find(
      ({ id }) => id === (name === "sleep" ? "sleep" : params.id),
    );
    return guide ? (
      <Resource key={guide.id} guide={guide} />
    ) : (
      <MissingWellnessItem
        title="Guide unavailable"
        description="This guide is no longer available. You can choose another guide from the library."
        icon="book-outline"
        action="Browse resources"
        destination="resources"
      />
    );
  }
  if (name === "affirmation" || name === "challenge") return <Affirmation />;
  if (name === "saved-affirmations") return <SavedAffirmations />;
  return <Resources />;
}

function MissingWellnessItem({
  title,
  description,
  icon,
  action,
  destination,
}: {
  title: string;
  description: string;
  icon: string;
  action: string;
  destination: "resources" | "assessments";
}) {
  const app = useApp();
  return (
    <Screen variant="nested">
      <NestedHeader
        title={destination === "resources" ? "Resources" : "Check-ins"}
        onBack={app.back}
      />
      <NestedState title={title} description={description} icon={icon}>
        <Button title={action} onPress={() => app.navigate(destination)} />
      </NestedState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { fontFamily: F.body, fontSize: 15, lineHeight: 23 },
  heading: { fontFamily: F.heading, letterSpacing: -0.6 },
  flexCopy: { flex: 1, minWidth: 0 },
  featureSection: { marginBottom: spacing.section },
  sceneBack: { alignSelf: "flex-start", marginBottom: spacing.row },
  savedList: { marginBottom: spacing.section },
  shelfItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.compact,
  },
  shelfMain: {
    flex: 1,
    minWidth: 0,
    minHeight: 94,
    flexDirection: "row",
    gap: spacing.row,
    alignItems: "center",
    padding: spacing.compact,
    paddingRight: spacing.row,
  },
  shelfThumb: {
    width: 70,
    minHeight: 70,
    alignSelf: "stretch",
    position: "relative",
    overflow: "hidden",
    borderRadius: 11,
  },
  shelfCopy: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 4 },
  shelfTitle: { fontSize: 25, lineHeight: 26 },
  shelfDetail: { fontSize: 13, lineHeight: 19 },
  shelfTrailing: { paddingRight: 4 },
  previousReflection: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.compact,
    marginBottom: spacing.row,
  },
  moodPanel: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.compact + 3,
    marginBottom: spacing.section,
  },
  checkinWriting: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.card,
    paddingBottom: spacing.row,
  },
  checkinField: { marginVertical: spacing.compact, borderRadius: 12 },
  draftCaption: { fontSize: 13, lineHeight: 20, marginVertical: spacing.row },
  questionPanel: {
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.card + 4,
    marginBottom: spacing.card,
    gap: spacing.row,
  },
  senseRoute: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: spacing.row,
  },
  senseNode: { flex: 1, alignItems: "center", gap: 3 },
  senseStage: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.card + 4,
    marginBottom: spacing.card,
  },
  senseStageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    marginBottom: spacing.row,
  },
  guideTrail: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: spacing.row,
  },
  guideChapter: { padding: spacing.row },
  writingDesk: {
    borderRadius: 22,
    borderWidth: 1,
    padding: spacing.card,
    gap: spacing.compact,
  },
  writingLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    flexWrap: "wrap",
  },
  writingField: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
  },
  readerCopy: { fontSize: 17, lineHeight: 29 },
  archiveRow: { borderWidth: 0, borderRadius: 0, marginBottom: 0 },
  groundingProgress: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.section,
  },
  guideStep: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  affirmationAction: { alignSelf: "flex-start", maxWidth: "100%" },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 14,
    borderRadius: 15,
    marginVertical: 12,
  },
  field: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    fontFamily: F.body,
    fontSize: 15,
    lineHeight: 24,
    marginVertical: 12,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 20,
    marginBottom: 12,
    minHeight: 64,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    padding: spacing.row,
    minHeight: 70,
    marginBottom: spacing.compact,
    borderWidth: 1,
    borderRadius: 18,
  },
  iconBox: {
    height: 42,
    width: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: spacing.row,
  },
  tightMoodRow: { marginHorizontal: -7, gap: 4 },
  moodChoice: {
    flexGrow: 1,
    minWidth: 44,
    minHeight: 68,
    paddingVertical: spacing.compact,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
  },
  sectionLabel: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginTop: 15,
  },
  twoButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  progressRow: { flexDirection: "row", gap: 5, marginTop: 14 },
  daylightBreathArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  momentArt: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.compact,
  },
  breathStage: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.row,
    overflow: "hidden",
  },
  breathTitle: {
    textAlign: "center",
    fontStyle: "italic",
    fontSize: 38,
    lineHeight: 43,
  },
  breathContext: { textAlign: "center", fontSize: 13, lineHeight: 20 },
  breathTime: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: spacing.row,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  breathClock: {
    fontSize: 26,
    lineHeight: 31,
    fontVariant: ["tabular-nums"],
    fontFamily: F.strong,
  },
  breathTotal: { fontSize: 14, fontVariant: ["tabular-nums"] },
  breathTrack: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginVertical: spacing.compact,
  },
  breathDurations: {
    justifyContent: "center",
    marginTop: spacing.row,
    marginBottom: 0,
  },
  breathBookmark: { marginTop: spacing.row, alignItems: "center" },
  stackedChoices: { flexDirection: "column", alignItems: "stretch" },
  feedbackOptions: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.compact,
    marginTop: spacing.row,
  },
  feedbackOption: {
    flex: 1,
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  feedbackOptionStacked: {
    flexDirection: "row",
    justifyContent: "flex-start",
    minHeight: 48,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 52,
    marginVertical: 8,
  },
  between: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    height: 9,
    borderRadius: 8,
    marginTop: 14,
    overflow: "hidden",
  },
  checkbox: {
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  affirmation: {
    fontFamily: F.heading,
    fontSize: 38,
    lineHeight: 43,
    fontStyle: "italic",
    letterSpacing: -0.4,
  },
});
