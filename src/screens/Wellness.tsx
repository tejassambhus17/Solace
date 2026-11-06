import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  hasWeeklyActivity,
  savedWeeklyStory,
} from "../../server/src/weekly-facts";
import { useApp, type WeeklyReflectionResult } from "../store";
import { useTheme } from "../theme";
import { useReducedMotion } from "../Companion";
import { journeyWeek } from "../journey-analytics";
import { journeyGoalProgress, selectJourneyGoal } from "../journey-goals";
import { reflectionPeriodLabel, weeklyStoryFacts } from "../weekly-story";
import { newMomentSessionId } from "../moments";
import { WeeklyStoryOverview } from "./WeeklyStory";
import {
  Screen,
  Card,
  Button,
  Petal,
  IconButton,
  MoodPetal,
  moodPetals,
  BotanicalBackdrop,
  Artwork,
} from "../ui";
import {
  ASSESSMENTS,
  ASSESSMENT_OPTIONS,
  AssessmentId,
  assessmentSummary,
  DEFAULT_PLAN,
  localDay,
  recordDay,
  RESOURCE_GUIDES,
  todayAffirmation,
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
function Header({
  back = true,
  title = "Solace",
  onBack,
}: {
  back?: boolean;
  title?: string;
  onBack?: () => void;
}) {
  const app = useApp();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton
          name="arrow-back"
          label="Go back"
          onPress={onBack || app.back}
          size={48}
        />
      ) : (
        <Petal size={38} />
      )}
      <Text style={[styles.brand, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 48 }} />
    </View>
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  minHeight?: number;
  label?: string;
  editable?: boolean;
  maxLength?: number;
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
      selectionColor={colors.primary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.field,
        {
          color: colors.text,
          backgroundColor:
            resolved === "dark" ? colors.surface2 : colors.surface,
          borderColor: focused ? colors.primary : colors.border,
          minHeight,
        },
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
  const { colors } = useTheme();
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
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Mark
        name={icon || (selected ? "radio-button-on" : "radio-button-off")}
        color={selected ? colors.primary : colors.muted}
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
}: {
  title: string;
  description: string;
  icon?: string;
  onPress: () => void;
  tone?: "lavender" | "peach" | "sage";
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          borderBottomWidth: 0.75,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <View
        style={[styles.iconBox, { backgroundColor: colors[`${tone}Surface`] }]}
      >
        <Mark name={icon} color={colors[`${tone}Text`]} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Heading small style={{ fontSize: 23, lineHeight: 25 }}>
          {title}
        </Heading>
        <Copy style={{ fontSize: 13, lineHeight: 19, marginTop: 3 }}>
          {description}
        </Copy>
      </View>
      <Mark name="chevron-forward" size={20} />
    </Pressable>
  );
}
function PageIntro({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const { resolved } = useTheme();
  return (
    <View style={{ marginBottom: 28 }}>
      <BotanicalBackdrop
        style={{
          width: 190,
          height: 190,
          right: -105,
          top: -92,
          opacity: resolved === "dark" ? 0.1 : 0.23,
        }}
      />
      <Heading style={{ maxWidth: "92%" }}>{title}</Heading>
      {children && (
        <Copy muted style={{ marginTop: 12 }}>
          {children}
        </Copy>
      )}
    </View>
  );
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
  const { colors } = useTheme();
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
          borderColor: favorite ? colors.primary : colors.border,
          backgroundColor: pressed ? colors.surface2 : colors.surface,
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
  const { colors } = useTheme();
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
    <Screen>
      <Header />
      <PageIntro title="Your toolkit">
        The practices you choose to keep close. Saved privately to your account.
      </PageIntro>
      <ErrorNote error={error} />
      {!favorites.length ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: 20,
            marginBottom: 28,
          }}
        >
          <Artwork
            kind="stillness"
            style={{
              width: "100%",
              height: 148,
              borderRadius: 20,
              marginBottom: 8,
            }}
          />
          <Heading small style={{ marginTop: 18, textAlign: "center" }}>
            A little support, collected
          </Heading>
          <Copy
            muted
            style={{ textAlign: "center", marginTop: 10, maxWidth: 285 }}
          >
            Save a practice or guide when it feels useful. It will be here
            whenever you want to return.
          </Copy>
        </View>
      ) : (
        <View style={{ marginBottom: 28 }}>
          {favorites.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderBottomWidth: 0.75,
                borderBottomColor: colors.border,
                paddingVertical: 17,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                onPress={() => open(item)}
                style={{ flex: 1, minHeight: 52, justifyContent: "center" }}
              >
                <Heading small style={{ fontSize: 26, lineHeight: 29 }}>
                  {item.title}
                </Heading>
                <Copy muted style={{ fontSize: 13, marginTop: 5 }}>
                  {item.kind === "resource"
                    ? "Resource guide"
                    : item.kind === "breathing"
                      ? "A paced breathing practice"
                      : item.kind === "grounding"
                        ? "A five-senses practice"
                        : "A space to write"}
                </Copy>
              </Pressable>
              <IconButton
                name={removing === item.id ? "hourglass-outline" : "bookmark"}
                label={`Remove ${item.title} from toolkit`}
                disabled={!!removing}
                onPress={() => remove(String(item.id))}
              />
            </View>
          ))}
        </View>
      )}
      <Heading small style={{ marginBottom: 14 }}>
        Make room for a pause
      </Heading>
      <Action
        title="Five-senses grounding"
        description="A gentle practice to notice your surroundings."
        icon="hand-left-outline"
        tone="peach"
        onPress={() => app.navigate("grounding")}
      />
      <Action
        title="A breathing moment"
        description="One to three minutes, at your pace."
        icon="leaf-outline"
        onPress={() => app.navigate("breathing")}
      />
      <Action
        title="A moment to reflect"
        description="Notice what is on your mind."
        icon="create-outline"
        tone="lavender"
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
  const [tried, setTried] = useState<number[]>([]);
  const [ending, setEnding] = useState(false);
  const accumulated = useRef(0);
  const since = useRef<number | null>(null);
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
    app.navigate("feedback", {
      session: {
        id: newMomentSessionId(),
        type: "grounding",
        title: "Five-senses grounding",
        durationSec: Math.min(
          1800,
          Math.max(0, Math.floor(accumulated.current)),
        ),
        completed: nextTried.length > 0,
        steps: nextTried,
        source: params.source || "wellness",
        ...(params.conversationId || params.sourceConversationId
          ? {
              sourceConversationId:
                params.conversationId || params.sourceConversationId,
            }
          : {}),
        createdAt: completedAt.toISOString(),
        day: localDay(completedAt),
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
      <Screen>
        <Header title="Grounding" onBack={() => setEnding(false)} />
        <PageIntro title="Take your time">
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
    <Screen>
      <Header title="Grounding" onBack={leave} />
      {!started ? (
        <>
          <PageIntro title="Come back to here">
            A five-senses practice to notice the space around you, one small
            detail at a time.
          </PageIntro>
          <View
            style={{
              alignItems: "center",
              paddingVertical: 22,
              marginBottom: 24,
            }}
          >
            <Artwork
              kind="stillness"
              style={{ width: "100%", height: 174, borderRadius: 22 }}
            />
          </View>
          <SaveToToolkit
            kind="grounding"
            targetId="grounding"
            title="Five-senses grounding"
          />
          <Hint>
            Use only what feels accessible and comfortable. You can imagine a
            familiar sensation, skip a sense, or stop at any point.
          </Hint>
          <Button
            title="Begin grounding"
            onPress={() => setStarted(true)}
            style={{ marginTop: 20 }}
          />
        </>
      ) : (
        <>
          <Copy muted style={{ marginBottom: 16 }}>
            Step {index + 1} of {GROUNDING_STEPS.length}
          </Copy>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 28 }}>
            {GROUNDING_STEPS.map((_, n) => (
              <View
                key={n}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: n <= index ? colors.primary : colors.border,
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
                fontSize: 88,
                lineHeight: 92,
                color: colors.peachText,
              }}
            >
              {step.count}
            </Text>
            <View style={{ flex: 1 }}>
              <Mark name={step.icon} size={25} color={colors.peachText} />
              <Heading style={{ fontSize: 35, lineHeight: 37, marginTop: 9 }}>
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
          <Copy muted style={{ marginTop: 18, marginBottom: 32 }}>
            {step.alternative}
          </Copy>
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
        </>
      )}
    </Screen>
  );
}

function Checkin() {
  const app = useApp();
  const { colors, resolved } = useTheme();
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
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const saveLock = useRef(false);
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
      setSavedId(String(result.id));
      app.setEditorDraft(draftKey, null, submittedDraft);
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  if (saved)
    return (
      <Screen>
        <Header />
        <PageIntro
          title={
            app.pendingWrites.some((entry) => entry.id === savedId)
              ? app.draftProtection === "device"
                ? "Kept on this device"
                : "Kept in this tab"
              : "Your check-in is saved"
          }
        >
          {app.pendingWrites.some((entry) => entry.id === savedId)
            ? app.draftProtection === "device"
              ? "Your check-in is saved securely on this device and waiting to sync to your account."
              : "Your check-in is waiting to sync. Keep this browser tab open; closing it will remove this unsynced writing."
            : "Thank you for making a little space for yourself. Your next small step is ready on Today."}
        </PageIntro>
        <Artwork
          kind="petal"
          size={170}
          style={{ alignSelf: "center", marginBottom: 26 }}
        />
        <Button
          title="See my next step"
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
    <Screen>
      <Header />
      <PageIntro title={"How are you\nfeeling?"}>
        Take a quick moment to check in with yourself today.
      </PageIntro>
      <Card
        style={{
          padding: 16,
          backgroundColor:
            resolved === "dark" ? colors.surface : colors.peachSurface,
          borderColor:
            resolved === "dark" ? colors.border : colors.peachSurface,
        }}
      >
        <Heading small style={{ color: colors.peachText }}>
          Your mood today
        </Heading>
        <View accessibilityRole="radiogroup" style={styles.moodRow}>
          {moodPetals.map(({ mood: label, image }) => (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: mood === label }}
              aria-checked={mood === label}
              disabled={saving}
              onPress={() => {
                writeDraft(label);
                setError("");
              }}
              style={[
                styles.moodChoice,
                {
                  backgroundColor:
                    mood === label
                      ? resolved === "dark"
                        ? colors.peachSurface
                        : colors.primary
                      : colors.surface,
                  borderColor:
                    mood === label
                      ? resolved === "dark"
                        ? colors.peachText
                        : colors.primary
                      : colors.border,
                },
              ]}
            >
              <MoodPetal source={image} style={{ width: 35, height: 34 }} />
              <Copy
                style={{
                  fontSize: 12,
                  lineHeight: 17,
                  color:
                    mood === label
                      ? resolved === "dark"
                        ? colors.peachText
                        : colors.primaryText
                      : colors.text,
                }}
              >
                {label}
              </Copy>
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={styles.sectionLabel}>
        <Mark name="pricetag-outline" size={20} />
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
                  ? colors.surface2
                  : colors.surface,
                borderColor: tags.includes(tag)
                  ? colors.primary
                  : colors.border,
              },
            ]}
          >
            <Copy style={{ fontSize: 13 }}>{tag}</Copy>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setMore(!more)}
          style={[styles.chip, { borderColor: colors.border }]}
        >
          <Copy style={{ fontSize: 13 }}>{more ? "Fewer tags" : "+ More"}</Copy>
        </Pressable>
      </View>
      <View style={styles.sectionLabel}>
        <Mark name="pencil-outline" size={20} />
        <Copy>Add a note (optional)</Copy>
      </View>
      <Field
        value={note}
        onChangeText={(value) => writeDraft(mood, tags, value)}
        editable={!saving}
        placeholder="What is on your mind today?"
        minHeight={88}
      />
      <Copy muted style={{ fontSize: 12, lineHeight: 19, marginBottom: 14 }}>
        {app.draftProtection === "device"
          ? "Draft protection saves shortly after typing stops and when you leave the app. Keep this screen open if a storage error appears. Save to add it to your Journey."
          : "Your draft stays in this tab while you move around. Save before leaving; unsynced writing is lost if you close or reload this tab."}
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
  const { colors, resolved } = useTheme();
  return (
    <Screen>
      <Header />
      <PageIntro title="Check-ins">
        Gentle, supportive reflections to help you notice feelings and patterns.
      </PageIntro>
      {ASSESSMENTS.map((item, index) => {
        const tone = (["peach", "lavender", "sage"] as const)[index % 3];
        const previous = [...(app.data.assessments || [])]
          .filter((v: AnyRecord) => v.assessmentType === item.id)
          .sort((a: AnyRecord, b: AnyRecord) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          )[0];
        return (
          <Card
            key={item.id}
            style={{
              padding: 18,
              marginBottom: 12,
              backgroundColor:
                resolved === "dark" ? colors.surface : colors[`${tone}Surface`],
              borderColor:
                resolved === "dark" ? colors.border : colors[`${tone}Surface`],
            }}
          >
            <View style={styles.cardTop}>
              <Mark name={item.icon} color={colors[`${tone}Text`]} />
              <View style={{ flex: 1 }}>
                <Heading small style={{ color: colors[`${tone}Text`] }}>
                  {item.title}
                </Heading>
                <Copy
                  style={{
                    fontSize: 13,
                    lineHeight: 19,
                    marginTop: 5,
                    color: colors[`${tone}Text`],
                  }}
                >
                  {item.description}
                </Copy>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Button
                title="Start"
                icon="arrow-forward"
                onPress={() => app.navigate("assessment", { id: item.id })}
              />
              <Copy
                style={{
                  fontSize: 13,
                  lineHeight: 19,
                  flex: 1,
                  color: colors[`${tone}Text`],
                }}
              >
                {previous
                  ? `Last reflection: ${new Date(previous.createdAt).toLocaleDateString()}`
                  : "Your first reflection"}
              </Copy>
            </View>
            {previous && (
              <View style={{ marginTop: 8 }}>
                <Button
                  title="View last reflection"
                  variant="ghost"
                  onPress={() =>
                    app.navigate("assessment-result", { id: previous.id })
                  }
                />
              </View>
            )}
          </Card>
        );
      })}
      <Hint>
        These are personal reflections, not validated clinical assessments or
        diagnoses.
      </Hint>
    </Screen>
  );
}

function Assessment({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors } = useTheme();
  const definition =
    ASSESSMENTS.find((v) => v.id === params.id) || ASSESSMENTS[0];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const activeAssessment = useRef<string | null>(definition.id);
  activeAssessment.current = definition.id;
  useEffect(() => {
    activeAssessment.current = definition.id;
    setIndex(0);
    setAnswers([]);
    setError("");
    setSaving(false);
    return () => {
      activeAssessment.current = null;
    };
  }, [definition.id]);
  async function next() {
    if (saveLock.current) return;
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
      if (activeAssessment.current === definition.id)
        app.navigate("assessment-result", {
          result: saved || { assessmentType: definition.id, summary },
        });
    } catch (e) {
      if (activeAssessment.current === definition.id) setError(errText(e));
    } finally {
      saveLock.current = false;
      if (activeAssessment.current === definition.id) setSaving(false);
    }
  }
  return (
    <Screen>
      <Header />
      <Copy style={{ marginTop: 8 }}>
        Question {index + 1} of {definition.questions.length}
      </Copy>
      <View
        accessibilityLabel={`Question ${index + 1} of ${definition.questions.length}`}
        style={styles.progressRow}
      >
        {definition.questions.map((_, n) => (
          <View
            key={n}
            style={{
              height: 7,
              flex: 1,
              borderRadius: 5,
              backgroundColor: n <= index ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
      <Heading
        style={{
          fontSize: 35,
          lineHeight: 39,
          marginTop: 32,
          marginBottom: 28,
        }}
      >
        {definition.questions[index]}
      </Heading>
      <View accessibilityRole="radiogroup">
        {ASSESSMENT_OPTIONS.map((label, value) => (
          <Choice
            key={label}
            label={label}
            selected={answers[index] === value}
            disabled={saving}
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
            onPress={() => (index ? setIndex(index - 1) : app.back())}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={
              saving
                ? "Saving…"
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
  return (
    <Screen>
      <Header />
      <PageIntro title="Your check-in">
        {summary?.text ||
          "Complete a reflection to see your personal next steps here."}
      </PageIntro>
      {summary && (
        <Copy style={{ marginBottom: 20, fontFamily: F.strong }}>
          {summary.title}
        </Copy>
      )}
      <Heading small style={{ marginBottom: 14 }}>
        Suggested next steps
      </Heading>
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
        onPress={() => app.navigate("plan")}
      />
      <Hint>
        This is a reflection, not a diagnosis. You can find human support in
        Resources whenever you need it.
      </Hint>
      <View style={styles.twoButtons}>
        <View style={{ flex: 1 }}>
          <Button
            title="Try a moment"
            variant="secondary"
            onPress={() => app.navigate("breathing")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Done" onPress={() => app.navigate("assessments")} />
        </View>
      </View>
    </Screen>
  );
}

function Breathing({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors } = useTheme();
  const [duration, setDuration] = useState(
    Math.max(60, Math.min(180, Number(params.durationSec) || 60)),
  );
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const [ending, setEnding] = useState(false);
  const base = useRef(0);
  const before = useRef(0);
  const active = useRef(false);
  const finished = useRef(false);
  const endSeconds = useRef(0);
  const resumeAfterEnd = useRef(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const phase = elapsed % 10 < 4 ? "Breathe in" : "Breathe out";
  const phaseRemaining =
    elapsed % 10 < 4 ? 4 - (elapsed % 10) : 10 - (elapsed % 10);
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
        type: "breathing",
        title: "A reset moment",
        durationSec: recordedSeconds,
        duration: recordedSeconds,
        plannedDurationSec: duration,
        completed: complete,
        source: params.source || "wellness",
        ...(params.conversationId || params.sourceConversationId
          ? {
              sourceConversationId:
                params.conversationId || params.sourceConversationId,
            }
          : {}),
        createdAt: completedAt.toISOString(),
        day: localDay(completedAt),
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
    active.current = true;
    setRunning(true);
    setStarted(true);
    setAutoPaused(false);
  }
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!active.current) return;
      const seconds =
        before.current + Math.max(0, monotonicNow() - base.current) / 1000;
      // The visible timer changes once a second; keep fractional clock time in
      // refs so the native petal animation stays smooth without rerendering the
      // entire activity ten times a second.
      setElapsed(Math.min(duration, Math.floor(seconds)));
      if (seconds >= duration) finish(duration, true);
    }, 250);
    return () => clearInterval(timer);
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
  useEffect(() => {
    if (!running || reducedMotion) {
      scale.stopAnimation();
      if (reducedMotion) scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: phase === "Breathe in" ? 1.12 : 0.85,
      duration: Math.max(100, phaseRemaining * 1000),
      useNativeDriver: Platform.OS !== "web",
    }).start();
    return () => scale.stopAnimation();
  }, [phase, running, reducedMotion]);
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
      <Screen>
        <Header title="Solace Moment" onBack={keepGoing} />
        <View style={{ alignItems: "center", marginVertical: 28 }}>
          <Artwork kind="petal" size={150} />
        </View>
        <Card style={{ padding: 24 }}>
          <Heading small>End this moment?</Heading>
          <Copy style={{ marginTop: 12, marginBottom: 20 }}>
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
    <Screen>
      <Header title="Solace Moment" onBack={end} />
      <BotanicalBackdrop
        style={{ top: 25, right: -155, width: 290, height: 290, opacity: 0.18 }}
      />
      <BotanicalBackdrop
        variant="footer"
        style={{ bottom: -110, right: -100, opacity: 0.18 }}
      />
      <Copy style={{ textAlign: "center", marginTop: 3 }} muted>
        A comfortable breath. Nothing to force.
      </Copy>
      {!started && (
        <View style={{ alignItems: "center", marginTop: 12 }}>
          <SaveToToolkit
            kind="breathing"
            targetId="breathing"
            title="A breathing moment"
          />
        </View>
      )}
      {!started && (
        <View
          style={[styles.chips, { justifyContent: "center", marginTop: 6 }]}
        >
          {[60, 120, 180].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: duration === value }}
              aria-checked={duration === value}
              onPress={() => setDuration(value)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    duration === value ? colors.surface2 : colors.surface,
                  borderColor:
                    duration === value ? colors.primary : colors.border,
                },
              ]}
            >
              <Copy style={{ fontSize: 13 }}>{value / 60} min</Copy>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.momentArt}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Artwork kind="petal" size={270} />
        </Animated.View>
      </View>
      <Heading
        style={{
          textAlign: "center",
          fontStyle: "italic",
          fontSize: 47,
          lineHeight: 52,
        }}
      >
        {!started ? "A moment for you" : !running ? "Rest here" : phase}
      </Heading>
      {started && (
        <Copy
          accessibilityLiveRegion="none"
          aria-hidden={!running}
          style={{
            textAlign: "center",
            marginTop: 7,
            opacity: running ? 1 : 0,
          }}
        >
          {Math.ceil(phaseRemaining)}s
        </Copy>
      )}
      <Copy
        accessibilityLiveRegion="none"
        style={{
          textAlign: "center",
          marginTop: 22,
          fontSize: 18,
          fontVariant: ["tabular-nums"],
          letterSpacing: 1,
        }}
      >
        {clock(elapsed)} / {clock(duration)}
      </Copy>
      <View style={[styles.twoButtons, { marginTop: 30 }]}>
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
  const { colors } = useTheme();
  const session = params.session;
  const draftKey = `feedback:${String(session?.id || session?.createdAt || "new")}`;
  const draft = app.editorDrafts[draftKey];
  const [feedback, setFeedback] = useState(draft?.feedback || "");
  const [note, setNote] = useState(draft?.note || "");
  const [remember, setRemember] = useState(draft?.remember === "true");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(draft?.submitted === "true");
  const savedSession = useRef<AnyRecord | null>(
    draft?.savedSessionId ? { id: draft.savedSessionId } : null,
  );
  const saveLock = useRef(false);
  const waitingForSession = submitted && !savedSession.current;
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
    if (saveLock.current || !session) return;
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
      savedSession.current = await app.save("sessions", {
        ...session,
        ...(savedSession.current?.id ? { id: savedSession.current.id } : {}),
        feedback: feedback || "skipped",
        note: note.trim(),
      });
      const savedDraft = {
        ...submittedDraft,
        savedSessionId: String(savedSession.current.id),
      };
      app.setEditorDraft(draftKey, savedDraft);
      if (remember && feedback === "Helped" && preference)
        await app.save("memories", {
          id: `memory-${savedSession.current.id}`,
          text: preference,
          content: preference,
          sourceType: "session",
          sourceId: savedSession.current?.id,
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
      <Screen>
        <Header />
        <PageIntro title="Take a moment first">
          A reflection on your activity will be here after a breathing moment.
        </PageIntro>
        <Button
          title="Start a moment"
          onPress={() => app.navigate("breathing")}
        />
      </Screen>
    );
  if (saved)
    return (
      <Screen key="practice-saved">
        <Header />
        <PageIntro title="A little care, saved">
          Your moment is in your Journey. You can return whenever you need.
        </PageIntro>
        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <Artwork kind="petal" size={170} />
        </View>
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
    <Screen>
      <Header />
      <PageIntro title={"You took\na moment"}>
        Thank you for making space for yourself. There is no right way to feel
        afterward.
      </PageIntro>
      <Card style={{ padding: 17 }}>
        <Heading small>How did that feel?</Heading>
        <View style={[styles.twoButtons, { marginTop: 16 }]}>
          {[
            { label: "Helped", icon: "leaf-outline" },
            { label: "A little", icon: "water-outline" },
            { label: "Not for me", icon: "close-outline" },
          ].map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="radio"
              accessibilityState={{
                checked: feedback === item.label,
                disabled: saving || waitingForSession,
              }}
              aria-checked={feedback === item.label}
              disabled={saving || waitingForSession}
              onPress={() => writeDraft(item.label)}
              style={[
                styles.feedbackOption,
                {
                  borderColor:
                    feedback === item.label ? colors.primary : colors.border,
                  backgroundColor:
                    feedback === item.label ? colors.surface2 : colors.surface,
                },
              ]}
            >
              <Mark name={item.icon} />
              <Copy style={{ textAlign: "center", fontSize: 12 }}>
                {item.label}
              </Copy>
            </Pressable>
          ))}
        </View>
      </Card>
      <Field
        value={note}
        onChangeText={(value) => writeDraft(feedback, value)}
        editable={!saving && !waitingForSession}
        placeholder="Add a note (optional)…"
        minHeight={90}
      />
      {feedback === "Helped" && !!preference && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          aria-checked={remember}
          disabled={saving}
          onPress={() => writeDraft(feedback, note, !remember)}
          style={styles.checkRow}
        >
          <Mark
            name={remember ? "checkbox" : "square-outline"}
            color={colors.primary}
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
      {waitingForSession && !saving && (
        <Hint>
          Your feedback is still here. Retry to save the same practice.
        </Hint>
      )}
      <Button
        title={
          saving
            ? "Saving…"
            : waitingForSession
              ? "Retry saving practice"
              : "Save and continue →"
        }
        onPress={save}
        disabled={saving}
      />
      <Copy muted style={{ fontSize: 12, marginTop: 10 }}>
        Feedback is optional. You can inspect or remove approved memories in
        Profile.
      </Copy>
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
  const { colors, resolved } = useTheme();
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
      <Screen>
        <Header />
        <PageIntro
          title={editId ? "Reflection updated" : "A little space, for you"}
        >
          {app.pendingWrites.some((entry) => entry.id === savedId)
            ? app.draftProtection === "device"
              ? "Your reflection is saved securely on this device. It is waiting to sync to your account."
              : "Your reflection is kept in this browser tab and waiting to sync. Keep the tab open; closing it will remove this unsynced writing."
            : "Your reflection is saved privately in your Journey."}
        </PageIntro>
        <Artwork
          kind="stillness"
          style={{
            width: "100%",
            height: 170,
            borderRadius: 22,
            marginBottom: 24,
          }}
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
    <Screen>
      <Header />
      <PageIntro
        title={
          editId
            ? existing?.weeklyPeriod
              ? "Edit your weekly story"
              : "Edit your reflection"
            : week
              ? "Your weekly story"
              : "A moment\nto reflect"
        }
      >
        {week
          ? reflectionPeriodLabel(week)
          : "A guided journal to notice, process, and make space for what is on your mind."}
      </PageIntro>
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
        <>
          {!!guidedPrompt && <Hint>{guidedPrompt}</Hint>}
          {!!app.params?.prompt && <Hint>{String(app.params.prompt)}</Hint>}
          {!week && !editId && (
            <SaveToToolkit
              kind="reflection"
              targetId="reflection"
              title="A moment to reflect"
            />
          )}
          <Card
            style={{
              padding: 16,
              backgroundColor:
                resolved === "dark" ? colors.surface : colors.lavenderSurface,
              borderColor:
                resolved === "dark" ? colors.border : colors.lavenderSurface,
            }}
          >
            <Heading small style={{ color: colors.lavenderText }}>
              What has been on your mind?
            </Heading>
            <Field
              value={text}
              onChangeText={(value) => writeDraft(value, need)}
              editable={!saving}
              placeholder="Write your reflection here…"
              minHeight={180}
              maxLength={maxLength}
            />
          </Card>
          <Action
            title="What might you need?"
            description="If it feels helpful, explore what you need more of right now. (Optional)"
            onPress={() => setExpanded(!expanded)}
          />
          {expanded && (
            <Field
              value={need}
              onChangeText={(value) => writeDraft(text, value)}
              editable={!saving}
              placeholder="Perhaps rest, reassurance, connection, or something else…"
              minHeight={100}
              maxLength={maxLength}
            />
          )}
          <Copy muted style={{ fontSize: 12, marginTop: 14, marginBottom: 14 }}>
            {app.draftProtection === "device"
              ? "Draft protection saves shortly after typing stops and when you leave the app. Keep this screen open if a storage error appears. Save to add it to your Journey."
              : "Your draft stays in this tab while you move around. Save before leaving; unsynced writing is lost if you close or reload this tab."}
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
            style={{ marginTop: 10 }}
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
        </>
      )}
    </Screen>
  );
}

function Reflections() {
  const app = useApp();
  const records = [...(app.data.reflections || [])].sort(
    (a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  return (
    <Screen>
      <Header />
      <PageIntro title="Your reflections">
        A private place to return to the thoughts you have made space for.
      </PageIntro>
      <Button
        title="Write a reflection"
        onPress={() => app.navigate("reflection")}
      />
      <View style={{ marginTop: 20 }}>
        {records.length ? (
          records.map((record: AnyRecord) => (
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
              onPress={() =>
                app.navigate("reflection-detail", { id: record.id })
              }
            />
          ))
        ) : (
          <Hint>
            Your saved reflections will appear here. Start whenever you are
            ready.
          </Hint>
        )}
      </View>
    </Screen>
  );
}

function ReflectionDetail({ params }: { params: AnyRecord }) {
  const app = useApp();
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
    <Screen>
      <Header />
      <PageIntro
        title={record?.weeklyPeriod ? "Your weekly story" : "Your reflection"}
      >
        {record?.weeklyPeriod
          ? reflectionPeriodLabel(record.weeklyPeriod)
          : record
            ? new Date(record.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "This reflection is no longer available."}
      </PageIntro>
      {!!record?.localOnly && (
        <Hint>
          {app.draftProtection === "device"
            ? "Saved on this device. Waiting to sync to your account."
            : "Kept in this browser tab only. Keep it open until this entry syncs."}
        </Hint>
      )}
      {record && (
        <>
          <Card style={{ padding: 20 }}>
            <Copy selectable>
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
          </Card>
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
    <Screen>
      <Header />
      <PageIntro title={record?.title || "Your moment"}>
        {day
          ? new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : record
            ? "Saved practice"
            : "This moment is no longer available."}
      </PageIntro>
      {record && (
        <>
          <Card style={{ padding: 20 }}>
            <Heading small>
              {record.completed
                ? "A completed practice"
                : "The time you made for yourself"}
            </Heading>
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
                    : record.source === "Explore" || record.source === "Today"
                      ? `Guided practice from ${record.source}.`
                      : "Built-in Moment · Live AI was off."}
                </Hint>
                <Button
                  title="Try this Moment again"
                  variant="secondary"
                  onPress={() =>
                    app.navigate("moment-player", {
                      activity: record.activity,
                      provider: record.provider || "offline",
                      source:
                        record.source === "Explore" || record.source === "Today"
                          ? record.source.toLowerCase()
                          : undefined,
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
    <Screen>
      <Header />
      <PageIntro title="Resources">
        A curated library of practices, tools, and gentle guidance for everyday
        wellbeing.
      </PageIntro>
      <Artwork
        kind="stillness"
        style={{
          width: "100%",
          height: 144,
          borderRadius: 22,
          marginBottom: 24,
        }}
      />
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
      {RESOURCE_GUIDES.map((guide) => (
        <Action
          key={guide.id}
          title={guide.title}
          description={guide.subtitle}
          icon={guide.icon}
          tone={
            guide.id === "sleep" || guide.id === "self-esteem"
              ? "lavender"
              : guide.id === "anxiety" || guide.id === "low-mood"
                ? "peach"
                : "sage"
          }
          onPress={() => app.navigate("resource", { id: guide.id })}
        />
      ))}
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

function Resource({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const guide =
    RESOURCE_GUIDES.find((v) => v.id === params.id) || RESOURCE_GUIDES[0];
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
  useEffect(() => {
    setChecked(previous?.steps || []);
    setExpanded(0);
    setSaved(false);
    setError("");
  }, [guide.id]);
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
    <Screen>
      <Header />
      <PageIntro title={guide.title}>{guide.description}</PageIntro>
      <SaveToToolkit kind="resource" targetId={guide.id} title={guide.title} />
      <Artwork
        kind={guide.id === "sleep" ? "night" : "stillness"}
        style={{
          width: "100%",
          height: 144,
          borderRadius: 22,
          marginBottom: 22,
        }}
      />
      {guide.id === "anxiety" && (
        <Action
          title="Try five-senses grounding"
          description="Follow an optional practice, one sense at a time."
          icon="hand-left-outline"
          onPress={() => app.navigate("grounding", { source: guide.id })}
        />
      )}
      <Card
        style={{
          padding: 16,
          marginBottom: 16,
          backgroundColor:
            resolved === "dark" ? colors.surface : colors.sageSurface,
          borderColor: resolved === "dark" ? colors.border : colors.sageSurface,
        }}
      >
        <View style={styles.between}>
          <Copy style={{ fontFamily: F.strong, color: colors.sageText }}>
            Your progress
          </Copy>
          <Copy style={{ fontSize: 12, color: colors.sageText }}>
            {checked.length} of {guide.steps.length} practices
          </Copy>
        </View>
        <View
          style={[styles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={{
              width: `${(checked.length / guide.steps.length) * 100}%`,
              height: 9,
              borderRadius: 8,
              backgroundColor: colors.sageText,
            }}
          />
        </View>
      </Card>
      {guide.steps.map((step, index) => (
        <Card key={step.title} style={{ padding: 15, marginBottom: 10 }}>
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
                color={colors.primary}
                size={27}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: expanded === index }}
              aria-expanded={expanded === index}
              onPress={() => setExpanded(expanded === index ? null : index)}
              style={{ flex: 1, minHeight: 48, justifyContent: "center" }}
            >
              <Heading small style={{ fontSize: 25 }}>
                {step.title}
              </Heading>
              {expanded !== index && (
                <Copy muted style={{ fontSize: 12, marginTop: 3 }}>
                  Tap to read the practice
                </Copy>
              )}
            </Pressable>
            <Mark
              name={expanded === index ? "chevron-up" : "chevron-down"}
              size={19}
            />
          </View>
          {expanded === index && (
            <View style={{ paddingTop: 12 }}>
              <Copy style={{ fontSize: 14, lineHeight: 22 }}>{step.text}</Copy>
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
        </Card>
      ))}
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

function Plan() {
  const app = useApp();
  const { colors } = useTheme();
  const existing = [...(app.data.plans || [])]
    .filter((v: AnyRecord) => v.type === "wellness")
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.updatedAt || b.createdAt).localeCompare(
        String(a.updatedAt || a.createdAt),
      ),
    )[0];
  const [tasks, setTasks] = useState<AnyRecord[]>(
    existing?.tasks || DEFAULT_PLAN.map((v) => ({ ...v, completed: false })),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedPlan = useRef<AnyRecord | null>(existing || null);
  async function save(nextTasks = tasks) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      savedPlan.current = await app.save("plans", {
        ...(savedPlan.current?.id ? { id: savedPlan.current.id } : {}),
        type: "wellness",
        title: "Your next 3 days",
        tasks: nextTasks,
        createdAt: savedPlan.current?.createdAt || stamp(),
        updatedAt: stamp(),
        completed: nextTasks.every((v) => v.completed),
      });
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setError(errText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <Header />
      <PageIntro title={"Your wellness\nplan"}>
        A simple, supportive plan for the next three days. Make it your own.
      </PageIntro>
      <View style={[styles.between, { marginBottom: 12 }]}>
        <Heading small>Your next 3 days</Heading>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => setEditing(!editing)}
          style={[
            styles.chip,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <Copy style={{ fontSize: 12 }}>
            {editing ? "Close editor" : "Edit plan"}
          </Copy>
        </Pressable>
      </View>
      {tasks.map((task, index) => (
        <Card key={index} style={{ padding: 16, marginBottom: 12 }}>
          <View style={styles.cardTop}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Day ${index + 1}: ${task.title}`}
              disabled={saving}
              accessibilityState={{ checked: !!task.completed }}
              aria-checked={!!task.completed}
              onPress={() => {
                setTasks(
                  tasks.map((v, n) =>
                    n === index ? { ...v, completed: !v.completed } : v,
                  ),
                );
                setSaved(false);
              }}
              style={styles.checkbox}
            >
              <Mark
                name={task.completed ? "checkmark-circle" : "ellipse-outline"}
                color={colors.primary}
                size={29}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Copy style={{ fontSize: 12, marginBottom: 3 }}>
                Day {index + 1}
              </Copy>
              {editing ? (
                <TextInput
                  accessibilityLabel={`Day ${index + 1} activity`}
                  value={task.title}
                  editable={!saving}
                  maxLength={90}
                  onChangeText={(title) => {
                    setTasks(
                      tasks.map((v, n) => (n === index ? { ...v, title } : v)),
                    );
                    setSaved(false);
                  }}
                  style={[
                    styles.field,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.surface2,
                      minHeight: 50,
                      marginVertical: 5,
                    },
                  ]}
                />
              ) : (
                <Heading small style={{ fontSize: 26 }}>
                  {task.title}
                </Heading>
              )}
              <Copy style={{ fontSize: 13, lineHeight: 20, marginTop: 3 }}>
                {task.description}
              </Copy>
            </View>
          </View>
          {!editing && (
            <View style={{ marginTop: 13 }}>
              <Button
                title="Open practice"
                icon="arrow-forward"
                variant="secondary"
                onPress={() => app.navigate(task.action || "reflection")}
              />
            </View>
          )}
        </Card>
      ))}
      <ErrorNote error={error} />
      {saved && (
        <Hint>Your plan is saved. Progress appears in your Journey.</Hint>
      )}
      <Button
        title={saving ? "Saving…" : saved ? "Plan saved" : "Save plan"}
        onPress={() => {
          if (tasks.some((v) => !v.title.trim())) {
            setError("Give each day a short activity title.");
            return;
          }
          save();
        }}
        disabled={saving || saved}
      />
    </Screen>
  );
}

function Affirmation() {
  const app = useApp();
  const { colors, resolved } = useTheme();
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
    <Screen>
      <Header />
      <PageIntro
        title={challengeOnly ? "Daily challenge" : "Today’s\naffirmation"}
      />
      {!challengeOnly && (
        <Card
          style={{
            padding: 24,
            marginBottom: 20,
            minHeight: 230,
            backgroundColor:
              resolved === "dark" ? colors.surface : colors.lavenderSurface,
            borderColor:
              resolved === "dark" ? colors.border : colors.lavenderSurface,
          }}
        >
          <Text
            style={[
              styles.affirmation,
              {
                color: resolved === "dark" ? colors.text : colors.lavenderText,
              },
            ]}
          >
            {text}
          </Text>
          <View style={{ marginTop: 25 }}>
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
        </Card>
      )}
      <Card style={{ padding: 20 }}>
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
    <Screen>
      <Header />
      <PageIntro title={"Words to\nreturn to"}>
        Your saved affirmations, whenever you need a gentle reminder.
      </PageIntro>
      {records.length ? (
        records.map((record: AnyRecord) => (
          <Card key={record.id} style={{ padding: 20, marginBottom: 14 }}>
            <Heading small style={{ fontSize: 30, lineHeight: 35 }}>
              {record.text}
            </Heading>
            <View style={{ marginTop: 16 }}>
              <Button
                title={
                  removing === record.id ? "Removing…" : "Remove from saved"
                }
                variant="secondary"
                onPress={() => remove(record.id)}
                disabled={!!removing}
              />
            </View>
          </Card>
        ))
      ) : (
        <Hint>
          No saved affirmations yet. Save a thought from Today’s affirmation to
          return to it here.
        </Hint>
      )}
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
  if (name === "assessment") return <Assessment params={params} />;
  if (name === "assessment-result") return <AssessmentResult params={params} />;
  if (name === "breathing" || name === "moment")
    return <Breathing params={params} />;
  if (name === "feedback") return <Feedback params={params} />;
  if (name === "reflection") return <Reflection />;
  if (name === "reflections") return <Reflections />;
  if (name === "reflection-detail") return <ReflectionDetail params={params} />;
  if (name === "session-detail") return <SessionDetail params={params} />;
  if (name === "resources") return <Resources />;
  if (name === "resource" || name === "sleep")
    return (
      <Resource
        params={name === "sleep" ? { ...params, id: "sleep" } : params}
      />
    );
  if (name === "plan") return <Plan />;
  if (name === "affirmation" || name === "challenge") return <Affirmation />;
  if (name === "saved-affirmations") return <SavedAffirmations />;
  return <Resources />;
}

const styles = StyleSheet.create({
  copy: { fontFamily: F.body, fontSize: 15, lineHeight: 23 },
  heading: { fontFamily: F.heading, letterSpacing: -0.6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    minHeight: 48,
  },
  brand: { fontFamily: F.heading, fontSize: 29, letterSpacing: -0.6 },
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
    gap: 13,
    paddingVertical: 18,
    minHeight: 86,
    marginBottom: 3,
  },
  iconBox: {
    height: 46,
    width: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  moodRow: { flexDirection: "row", gap: 5, marginTop: 16 },
  moodChoice: {
    flex: 1,
    minHeight: 84,
    paddingVertical: 12,
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
  momentArt: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 270,
    marginTop: 18,
    marginBottom: 6,
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
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    minHeight: 52,
    marginVertical: 8,
  },
  between: {
    flexDirection: "row",
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
