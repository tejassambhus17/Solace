import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  Screen,
  Card,
  Button,
  Petal,
  IconButton,
  MoodStone,
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
    <Ionicons name={name as any} size={size} color={color || colors.text} />
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  minHeight?: number;
  label?: string;
  editable?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={label || placeholder}
      value={value}
      editable={editable}
      onChangeText={onChangeText}
      multiline
      textAlignVertical="top"
      maxLength={3000}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      selectionColor={colors.primary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.field,
        {
          color: colors.text,
          backgroundColor: colors.surface,
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
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
}: {
  title: string;
  description: string;
  icon?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={styles.action}>
      <View style={[styles.iconBox, { backgroundColor: colors.surface2 }]}>
        <Mark name={icon} />
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
    </Card>
  );
}
function PageIntro({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      <BotanicalBackdrop
        style={{
          width: 190,
          height: 190,
          right: -105,
          top: -92,
          opacity: 0.23,
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
  const since = useRef(0);
  const finished = useRef(false);
  const startedAt = useRef(stamp());
  const stopClock = () => {
    if (since.current)
      accumulated.current += (Date.now() - since.current) / 1000;
    since.current = 0;
  };
  useEffect(() => {
    if (started && !ending && AppState.currentState === "active")
      since.current = Date.now();
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") stopClock();
      else if (started && !ending && !finished.current)
        since.current = Date.now();
    });
    return () => {
      stopClock();
      listener.remove();
    };
  }, [started, ending]);
  function leave() {
    if (started) {
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
  }, [started]);
  function finish(nextTried: number[]) {
    if (finished.current) return;
    finished.current = true;
    stopClock();
    app.navigate("feedback", {
      session: {
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
        createdAt: startedAt.current,
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
            onPress={() => {
              startedAt.current = stamp();
              setStarted(true);
              since.current = Date.now();
            }}
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
                color: colors.primary,
              }}
            >
              {step.count}
            </Text>
            <View style={{ flex: 1 }}>
              <Mark name={step.icon} size={25} color={colors.primary} />
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
  const { colors } = useTheme();
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
  const choices = ["Okay", "Calm", "Low", "Stressed", "Great"];
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
      await app.save("checkins", {
        mood,
        tags,
        note: note.trim(),
        day: localDay(),
        createdAt: stamp(),
      });
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
        <PageIntro title="Your check-in is saved">
          Thank you for making a little space for yourself. What would feel
          helpful now?
        </PageIntro>
        <Action
          title="Talk with Solace"
          description="Make room for what is on your mind."
          icon="chatbubble-outline"
          onPress={() =>
            app.navigate("chat", {
              context: `I am feeling ${mood.toLowerCase()} today.${note ? ` ${note}` : ""}`,
            })
          }
        />
        <Action
          title="Take a reset moment"
          description="One minute, at a comfortable pace."
          onPress={() => app.navigate("breathing")}
        />
        <Button title="Back to Today" onPress={() => app.navigate("today")} />
      </Screen>
    );
  return (
    <Screen>
      <Header />
      <PageIntro title={"How are you\nfeeling?"}>
        Take a quick moment to check in with yourself today.
      </PageIntro>
      <Card style={{ padding: 16 }}>
        <Heading small>Your mood today</Heading>
        <View accessibilityRole="radiogroup" style={styles.moodRow}>
          {choices.map((label) => (
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
                    mood === label ? colors.surface2 : colors.surface,
                  borderColor: mood === label ? colors.primary : colors.border,
                },
              ]}
            >
              <MoodStone mood={label} size={31} />
              <Copy style={{ fontSize: 12, lineHeight: 17 }}>{label}</Copy>
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
    <Screen>
      <Header />
      <PageIntro title="Check-ins">
        Gentle, supportive reflections to help you notice feelings and patterns.
      </PageIntro>
      {ASSESSMENTS.map((item) => {
        const previous = [...(app.data.assessments || [])]
          .filter((v: AnyRecord) => v.assessmentType === item.id)
          .sort((a: AnyRecord, b: AnyRecord) =>
            String(b.createdAt).localeCompare(String(a.createdAt)),
          )[0];
        return (
          <Card key={item.id} style={{ padding: 18, marginBottom: 12 }}>
            <View style={styles.cardTop}>
              <Mark name={item.icon} />
              <View style={{ flex: 1 }}>
                <Heading small>{item.title}</Heading>
                <Copy style={{ fontSize: 13, lineHeight: 19, marginTop: 5 }}>
                  {item.description}
                </Copy>
              </View>
              <Petal size={48} />
            </View>
            <View style={styles.cardFooter}>
              <Button
                title="Start"
                icon="arrow-forward"
                onPress={() => app.navigate("assessment", { id: item.id })}
              />
              <Copy muted style={{ fontSize: 13, lineHeight: 19, flex: 1 }}>
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
  useEffect(() => {
    setIndex(0);
    setAnswers([]);
    setError("");
  }, [definition.id]);
  async function next() {
    if (answers[index] === undefined) {
      setError("Choose the answer that feels closest to your experience.");
      return;
    }
    if (index < definition.questions.length - 1) {
      setIndex(index + 1);
      setError("");
      return;
    }
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
      app.navigate("assessment-result", {
        result: saved || { assessmentType: definition.id, summary },
      });
    } catch (e) {
      setError(errText(e));
    } finally {
      setSaving(false);
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
  const [reducedMotion, setReducedMotion] = useState(false);
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
    app.navigate("feedback", {
      session: {
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
        createdAt: stamp(),
      },
    });
  }
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducedMotion)
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => listener.remove();
  }, []);
  function pause() {
    if (!active.current) return before.current;
    before.current = Math.min(
      duration,
      before.current + (Date.now() - base.current) / 1000,
    );
    active.current = false;
    setElapsed(before.current);
    setRunning(false);
    return before.current;
  }
  function resume() {
    if (finished.current) return;
    base.current = Date.now();
    active.current = true;
    setRunning(true);
    setStarted(true);
    setAutoPaused(false);
  }
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      if (!active.current) return;
      const seconds = before.current + (Date.now() - base.current) / 1000;
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
      useNativeDriver: true,
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
    setEnding(true);
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
      {running && (
        <Copy
          accessibilityLiveRegion="none"
          style={{ textAlign: "center", marginTop: 7 }}
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
      {autoPaused && (
        <Copy
          muted
          style={{ textAlign: "center", marginTop: 12, fontSize: 12 }}
        >
          Your moment paused while the app was away. Resume when you are ready.
        </Copy>
      )}
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
  const draftKey = `feedback:${String(params.session?.createdAt || "new")}`;
  const draft = app.editorDrafts[draftKey];
  const [feedback, setFeedback] = useState(draft?.feedback || "");
  const [note, setNote] = useState(draft?.note || "");
  const [remember, setRemember] = useState(draft?.remember === "true");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedSession = useRef<AnyRecord | null>(
    draft?.savedSessionId ? { id: draft.savedSessionId } : null,
  );
  const saveLock = useRef(false);
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
    });
  }
  const session = params.session || {
    type: "breathing",
    title: "A reset moment",
    durationSec: 0,
    completed: false,
    createdAt: stamp(),
  };
  const preference =
    session.type === "grounding"
      ? "Finds five-senses grounding helpful."
      : session.type === "breathing"
        ? "Finds short breathing moments helpful."
        : null;
  async function save() {
    if (saveLock.current) return;
    saveLock.current = true;
    const submittedDraft = {
      feedback,
      note,
      remember: String(remember),
      savedSessionId: String(savedSession.current?.id || ""),
    };
    app.setEditorDraft(draftKey, submittedDraft);
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
          text: preference,
          content: preference,
          sourceType: "session",
          sourceId: savedSession.current?.id,
          ...(session.sourceConversationId
            ? { sourceConversationId: session.sourceConversationId }
            : {}),
          approved: true,
          createdAt: stamp(),
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
  if (!params.session)
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
      <Screen>
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
              accessibilityState={{ checked: feedback === item.label }}
              aria-checked={feedback === item.label}
              disabled={saving}
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
        editable={!saving}
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
      <Button
        title={saving ? "Saving…" : "Save and continue →"}
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

function Reflection() {
  const app = useApp();
  const draftKey = "reflection:new";
  const draft = app.editorDrafts[draftKey];
  const [text, setText] = useState(draft?.text || "");
  const [need, setNeed] = useState(draft?.need || "");
  const [expanded, setExpanded] = useState(!!draft?.need);
  const [discarding, setDiscarding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const saveLock = useRef(false);
  function writeDraft(nextText = text, nextNeed = need) {
    if (saveLock.current) return;
    setText(nextText);
    setNeed(nextNeed);
    app.setEditorDraft(draftKey, { text: nextText, need: nextNeed });
  }
  async function save() {
    if (saveLock.current) return;
    if (!text.trim()) {
      setError("Write a little about what is on your mind, or skip for now.");
      return;
    }
    saveLock.current = true;
    const submittedDraft = { text, need };
    app.setEditorDraft(draftKey, submittedDraft);
    setSaving(true);
    setError("");
    try {
      await app.save("reflections", {
        text: text.trim(),
        need: need.trim(),
        ...(app.params?.conversationId
          ? { sourceConversationId: app.params.conversationId }
          : {}),
        createdAt: stamp(),
      });
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
        <PageIntro title="A little space, for you">
          Your reflection is saved privately in your Journey.
        </PageIntro>
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
      <PageIntro title={"A moment\nto reflect"}>
        A guided journal to notice, process, and make space for what is on your
        mind.
      </PageIntro>
      {!!app.params?.prompt && <Hint>{String(app.params.prompt)}</Hint>}
      <SaveToToolkit
        kind="reflection"
        targetId="reflection"
        title="A moment to reflect"
      />
      <Card style={{ padding: 16 }}>
        <Heading small>What has been on your mind?</Heading>
        <Field
          value={text}
          onChangeText={(value) => writeDraft(value, need)}
          editable={!saving}
          placeholder="Write your reflection here…"
          minHeight={180}
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
        />
      )}
      <Copy muted style={{ fontSize: 12, marginTop: 14, marginBottom: 14 }}>
        Your draft is kept while you move around the app. Save it to keep it in
        your Journey.
      </Copy>
      <ErrorNote error={error} />
      <Button
        title={saving ? "Saving…" : "Save reflection"}
        onPress={save}
        disabled={saving}
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
            This removes the writing you have not saved. You can keep writing
            instead.
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
              app.setEditorDraft(draftKey, null);
              setExpanded(false);
              setDiscarding(false);
              setError("");
            }}
          />
        </Card>
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
              title={new Date(record.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })}
              description={String(
                record.text ||
                  record.content ||
                  record.note ||
                  "A saved reflection",
              ).slice(0, 130)}
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
  const record = (app.data.reflections || []).find(
    (v: AnyRecord) => v.id === params.id,
  );
  async function remove() {
    if (!record?.id) return;
    setDeleting(true);
    setError("");
    try {
      await app.remove("reflections", record.id);
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
      <PageIntro title="Your reflection">
        {record
          ? new Date(record.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "This reflection is no longer available."}
      </PageIntro>
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
                This permanently removes this reflection from your account.
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
        {record
          ? new Date(record.createdAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
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
            {record.type === "breathing" && (
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
            {record.type === "grounding" && (
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
        onPress={() => app.navigate("toolkit")}
      />
      <Action
        title="Five-senses grounding"
        description="Notice this moment through your senses."
        icon="hand-left-outline"
        onPress={() => app.navigate("grounding")}
      />
      {RESOURCE_GUIDES.map((guide) => (
        <Action
          key={guide.id}
          title={guide.title}
          description={guide.subtitle}
          icon={guide.icon}
          onPress={() => app.navigate("resource", { id: guide.id })}
        />
      ))}
      <Action
        title="Need more support?"
        description="Find human support and trusted resources."
        icon="help-buoy-outline"
        onPress={() => app.navigate("support")}
      />
    </Screen>
  );
}

function Resource({ params }: { params: AnyRecord }) {
  const app = useApp();
  const { colors } = useTheme();
  const guide =
    RESOURCE_GUIDES.find((v) => v.id === params.id) || RESOURCE_GUIDES[0];
  const previous = [...(app.data.sessions || [])]
    .filter(
      (v: AnyRecord) =>
        v.type === "resource" &&
        v.resourceId === guide.id &&
        v.day === localDay(),
    )
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    )[0];
  const [checked, setChecked] = useState<number[]>(previous?.steps || []);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setChecked(previous?.steps || []);
    setExpanded(0);
    setSaved(false);
    setError("");
  }, [guide.id]);
  async function save() {
    if (saving) return;
    if (!checked.length && !previous?.id) {
      setError("Mark a practice you tried before saving your progress.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await app.save("sessions", {
        ...(previous?.id ? { id: previous.id } : {}),
        type: "resource",
        resourceId: guide.id,
        title: guide.title,
        steps: checked,
        completed: checked.length === guide.steps.length,
        day: localDay(),
        createdAt: previous?.createdAt || stamp(),
        updatedAt: stamp(),
      });
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
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
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <View style={styles.between}>
          <Copy style={{ fontFamily: F.strong }}>Your progress</Copy>
          <Copy style={{ fontSize: 12 }}>
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
              backgroundColor: colors.primary,
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
  const { colors } = useTheme();
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
      <PageIntro title={"Today’s\naffirmation"} />
      <Card
        style={{
          padding: 24,
          marginBottom: 20,
          minHeight: 230,
          backgroundColor: colors.surface2,
        }}
      >
        <Text style={[styles.affirmation, { color: colors.text }]}>{text}</Text>
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
      <Card style={{ padding: 20 }}>
        <View style={styles.cardTop}>
          <Mark name="leaf-outline" />
          <Copy style={{ fontFamily: F.strong, fontSize: 12 }}>
            A small daily challenge
          </Copy>
        </View>
        <Heading small style={{ marginTop: 15, fontSize: 30 }}>
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
        Your saved affirmations and completed challenges appear in your Journey.
      </Copy>
      <View style={{ marginTop: 12 }}>
        <Button
          title="View saved affirmations"
          variant="secondary"
          onPress={() => app.navigate("saved-affirmations")}
        />
      </View>
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
    padding: 18,
    marginBottom: 12,
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
