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
import { Screen, Card, Button, Petal } from "../ui";
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack || app.back}
          style={styles.back}
        >
          <Mark name="arrow-back" />
        </Pressable>
      ) : (
        <Petal size={38} />
      )}
      <Text style={[styles.brand, { color: colors.text }]}>{title}</Text>
      <View style={{ width: 40 }} />
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  minHeight?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      accessibilityLabel={label || placeholder}
      value={value}
      onChangeText={onChangeText}
      multiline
      textAlignVertical="top"
      maxLength={3000}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      style={[
        styles.field,
        {
          color: colors.text,
          backgroundColor: colors.surface,
          borderColor: colors.border,
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
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.surface2 : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.7 : 1,
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
    <View style={{ marginBottom: 22 }}>
      <Heading>{title}</Heading>
      {children && <Copy style={{ marginTop: 10 }}>{children}</Copy>}
    </View>
  );
}

function Checkin() {
  const app = useApp();
  const { colors } = useTheme();
  const [mood, setMood] = useState(
    ["Okay", "Calm", "Low", "Stressed", "Great"].includes(app.params?.mood)
      ? app.params.mood
      : "",
  );
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const choices = ["Okay", "Calm", "Low", "Stressed", "Great"];
  const tones = [
    colors.peach,
    colors.accent,
    colors.lavender,
    "#D99554",
    "#9AA46B",
  ];
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
    if (!mood) {
      setError("Choose a mood before saving your check-in.");
      return;
    }
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
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
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
          {choices.map((label, i) => (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: mood === label }}
              onPress={() => {
                setMood(label);
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
              <View style={[styles.moodDot, { backgroundColor: tones[i] }]} />
              <Copy style={{ fontSize: 11, lineHeight: 16 }}>{label}</Copy>
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
            onPress={() =>
              setTags(
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
        onChangeText={setNote}
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
                title="Start →"
                onPress={() => app.navigate("assessment", { id: item.id })}
              />
              <Copy muted style={{ fontSize: 11, flex: 1 }}>
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
            title="← Back"
            variant="secondary"
            onPress={() => (index ? setIndex(index - 1) : app.back())}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={saving ? "Saving…" : index === 3 ? "Finish →" : "Next →"}
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
      setElapsed(Math.min(duration, seconds));
      if (seconds >= duration) finish(duration, true);
    }, 100);
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
          <Petal size={150} />
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
      <Copy style={{ textAlign: "center", marginTop: 3 }} muted>
        A comfortable breath. Nothing to force.
      </Copy>
      {!started && (
        <View
          style={[styles.chips, { justifyContent: "center", marginTop: 20 }]}
        >
          {[60, 120, 180].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: duration === value }}
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
          <Petal size={270} />
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
        style={{ textAlign: "center", marginTop: 22, fontSize: 18 }}
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
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");
  const [remember, setRemember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedSession = useRef<AnyRecord | null>(null);
  const session = params.session || {
    type: "breathing",
    title: "A reset moment",
    durationSec: 0,
    completed: false,
    createdAt: stamp(),
  };
  async function save() {
    setSaving(true);
    setError("");
    try {
      savedSession.current = await app.save("sessions", {
        ...session,
        ...(savedSession.current?.id ? { id: savedSession.current.id } : {}),
        feedback: feedback || "skipped",
        note: note.trim(),
      });
      if (remember && feedback === "Helped")
        await app.save("memories", {
          text: "Finds short breathing moments helpful.",
          content: "Finds short breathing moments helpful.",
          sourceType: "session",
          sourceId: savedSession.current?.id,
          ...(session.sourceConversationId
            ? { sourceConversationId: session.sourceConversationId }
            : {}),
          approved: true,
          createdAt: stamp(),
        });
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
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
        <Petal size={170} />
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
              onPress={() => setFeedback(item.label)}
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
        onChangeText={setNote}
        placeholder="Add a note (optional)…"
        minHeight={90}
      />
      {feedback === "Helped" && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          onPress={() => setRemember(!remember)}
          style={styles.checkRow}
        >
          <Mark
            name={remember ? "checkbox" : "square-outline"}
            color={colors.primary}
          />
          <Copy style={{ flex: 1, fontSize: 13 }}>
            Save a preference that short breathing moments help me.
          </Copy>
        </Pressable>
      )}
      {remember && feedback === "Helped" && !app.user?.personalization && (
        <Hint>
          This saves the preference for you to manage. Personalization is
          currently off; enable it in Profile if you want Solace to use approved
          preferences and recent check-ins.
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
  const [text, setText] = useState("");
  const [need, setNeed] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!text.trim()) {
      setError("Write a little about what is on your mind, or skip for now.");
      return;
    }
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
      setSaved(true);
    } catch (e) {
      setError(errText(e));
    } finally {
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
      <Card style={{ padding: 16 }}>
        <Heading small>What has been on your mind?</Heading>
        <Field
          value={text}
          onChangeText={setText}
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
          onChangeText={setNeed}
          placeholder="Perhaps rest, reassurance, connection, or something else…"
          minHeight={100}
        />
      )}
      <ErrorNote error={error} />
      <Button
        title={saving ? "Saving…" : "Save reflection"}
        onPress={save}
        disabled={saving}
      />
      <Button title="Skip for now" variant="secondary" onPress={app.back} />
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
    if (!checked.length) {
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
              accessibilityState={{ checked: checked.includes(index) }}
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
              onPress={() => setExpanded(expanded === index ? null : index)}
              style={{ flex: 1 }}
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
              accessibilityState={{ checked: !!task.completed }}
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
                title="Open practice →"
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
                  ? "✓ Completed today — undo"
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
    marginBottom: 25,
    minHeight: 48,
  },
  back: {
    width: 42,
    minHeight: 44,
    alignItems: "flex-start",
    justifyContent: "center",
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
    borderRadius: 18,
    padding: 16,
    fontFamily: F.body,
    fontSize: 14,
    lineHeight: 22,
    marginVertical: 12,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 11,
    minHeight: 64,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 16,
    marginBottom: 11,
  },
  iconBox: {
    height: 45,
    width: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  moodRow: { flexDirection: "row", gap: 5, marginTop: 16 },
  moodChoice: {
    flex: 1,
    minHeight: 72,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.3,
    borderRadius: 16,
  },
  moodDot: { width: 28, height: 28, borderRadius: 14 },
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
    minHeight: 42,
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
    minHeight: 290,
    marginTop: 18,
    marginBottom: 6,
  },
  feedbackOption: {
    flex: 1,
    minHeight: 88,
    borderWidth: 1.5,
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
    minHeight: 44,
    minWidth: 36,
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
