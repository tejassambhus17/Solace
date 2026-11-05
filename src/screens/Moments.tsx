import React, { useEffect, useRef, useState } from "react";
import {
  AppState as NativeAppState,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { AmbientSound } from "../AmbientSound";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type Item } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon, Row, Screen } from "../ui";
import { Companion, useReducedMotion } from "../Companion";
import { ENVIRONMENTS, EnvironmentScene } from "../Environment";
import { localDay } from "../content";
import {
  breathingPosition,
  elapsedMomentMs,
  emptyClock,
  isPlayableMoment,
  momentClockText,
  momentPosition,
  pauseMoment,
  resumeMoment,
  type GeneratedMoment,
  type MomentEnvironment,
} from "../moments";
import type { SolaceMoment } from "../../server/src/moment-contract";

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We couldn't complete that. Please try again.";
const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={{ paddingVertical: 12, marginVertical: 7 }}
    >
      <AppText variant="caption" color={error ? colors.danger : colors.muted}>
        {children}
      </AppText>
    </View>
  );
}

function EnvironmentPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: MomentEnvironment;
  onChange: (environment: MomentEnvironment) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 9 }}>
      {ENVIRONMENTS.map((environment) => (
        <Pressable
          key={environment.id}
          accessibilityRole="radio"
          accessibilityLabel={environment.title}
          accessibilityState={{
            selected: value === environment.id,
            checked: value === environment.id,
            disabled,
          }}
          aria-checked={value === environment.id}
          disabled={disabled}
          onPress={() => onChange(environment.id)}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 0,
            opacity: pressed ? 0.75 : disabled ? 0.55 : 1,
          })}
        >
          <EnvironmentScene
            environment={environment.id}
            style={{ minHeight: 65, height: 65, borderRadius: 14 }}
          />
          <Row
            style={{
              gap: 4,
              marginTop: 8,
              justifyContent: "center",
              minHeight: 24,
            }}
          >
            {value === environment.id && (
              <Icon name="checkmark-circle" size={14} color={colors.primary} />
            )}
            <AppText
              variant="caption"
              style={{ fontSize: 12 }}
              color={value === environment.id ? colors.text : colors.muted}
            >
              {environment.short}
            </AppText>
          </Row>
        </Pressable>
      ))}
    </View>
  );
}

function EnvironmentOptions({
  value,
  onChange,
  disabled = false,
  children,
}: {
  value: MomentEnvironment;
  onChange: (environment: MomentEnvironment) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const environment = ENVIRONMENTS.find((item) => item.id === value)!;
  return (
    <View
      style={{
        marginTop: 18,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 58, justifyContent: "center" }}
      >
        <Row>
          <Icon name="leaf-outline" size={19} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color={colors.muted}>
              Space for this Moment
            </AppText>
            <AppText variant="label">{environment.title}</AppText>
          </View>
          <Icon
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Row>
      </Pressable>
      {open && (
        <View style={{ paddingTop: 8, paddingBottom: 4 }}>
          <EnvironmentPicker
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
          {children}
        </View>
      )}
    </View>
  );
}

export function MomentsScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const preference = app.data.preferences?.find(
    (item) => item.id === "wellness",
  );
  const [environment, setEnvironment] = useState<MomentEnvironment>(
    ["forest", "ocean", "twilight"].includes(preference?.environment)
      ? preference!.environment
      : "forest",
  );
  const [feeling, setFeeling] = useState(
    String(
      app.params?.feeling || app.editorDrafts["moment-builder"]?.feeling || "",
    ),
  );
  const [result, setResult] = useState<GeneratedMoment | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [why, setWhy] = useState(false);
  const generation = useRef(0);
  const generationLock = useRef(false);
  const preferenceLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);
  useEffect(() => {
    if (
      result?.usedMemoryIds.length &&
      (!app.user?.personalization ||
        result.usedMemoryIds.some(
          (id) =>
            !app.data.memories.some(
              (memory) => memory.id === id && memory.approved !== false,
            ),
        ))
    ) {
      setResult(null);
      setNotice(
        "Your personalization changed. Create a new Moment using your current preferences.",
      );
    }
  }, [app.user?.personalization, app.data.memories, result]);
  function writeFeeling(value: string) {
    if (generationLock.current) return;
    setFeeling(value);
    setResult(null);
    setError("");
    setNotice("");
    setWhy(false);
    app.setEditorDraft("moment-builder", { feeling: value });
  }
  async function generate() {
    if (generationLock.current || !feeling.trim()) return;
    generationLock.current = true;
    const version = ++generation.current;
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setWhy(false);
    setError("");
    setNotice("");
    try {
      const response: GeneratedMoment = await app.generateMoment(
        feeling.trim(),
        environment,
      );
      if (!mounted.current || version !== generation.current) return;
      if (!response?.support && !isPlayableMoment(response?.activity))
        throw new Error(
          "This Moment couldn't be prepared safely. Your words are kept—please try again.",
        );
      setResult(response);
    } catch (error) {
      if (mounted.current && version === generation.current)
        setError(errorText(error));
    } finally {
      generationLock.current = false;
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }
  async function saveEnvironment() {
    if (preferenceLock.current) return;
    preferenceLock.current = true;
    setSavingPreference(true);
    setPreferenceStatus(null);
    try {
      await app.save("preferences", {
        ambientEnabled: false,
        streaksEnabled: false,
        ...preference,
        id: "wellness",
        environment,
      });
      if (mounted.current)
        setPreferenceStatus({ message: "Your preferred space is saved." });
    } catch (error) {
      if (mounted.current)
        setPreferenceStatus({ message: errorText(error), error: true });
    } finally {
      preferenceLock.current = false;
      if (mounted.current) setSavingPreference(false);
    }
  }
  function scrollToResult(event: LayoutChangeEvent) {
    scroll.current?.scrollTo({
      y: Math.max(0, event.nativeEvent.layout.y - 20),
      animated: !reducedMotion,
    });
  }
  return (
    <Screen title="Solace Moments" back={app.back} scrollRef={scroll}>
      <Row style={{ alignItems: "center", marginBottom: 18, gap: 0 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">A moment,{"\n"}made for you.</AppText>
          <AppText color={colors.muted} style={{ marginTop: 12 }}>
            Start with how things feel. Find a little room to breathe, notice or
            reflect.
          </AppText>
        </View>
        <Companion state={loading ? "thinking" : "idle"} size={98} />
      </Row>
      <AppText variant="label" style={{ marginTop: 10, marginBottom: 9 }}>
        What would feel supportive?
      </AppText>
      <TextInput
        accessibilityLabel="How are you feeling for your Moment?"
        placeholder="A busy mind, a long day, or simply a little pause…"
        placeholderTextColor={colors.muted}
        value={feeling}
        onChangeText={writeFeeling}
        multiline
        maxLength={2000}
        editable={!loading}
        style={{
          backgroundColor: colors.surface,
          color: colors.text,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 17,
          minHeight: 112,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          lineHeight: 23,
          textAlignVertical: "top",
        }}
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 11,
        }}
      >
        {[
          { label: "Overwhelmed", text: "Feeling overwhelmed" },
          { label: "Distracted", text: "A little distracted" },
          { label: "Tired", text: "Ready to rest" },
        ].map(({ label, text }) => (
          <Pressable
            key={text}
            accessibilityRole="button"
            disabled={loading}
            onPress={() => writeFeeling(text)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              minHeight: 48,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 24,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText variant="caption">{label}</AppText>
          </Pressable>
        ))}
      </View>
      <EnvironmentOptions
        value={environment}
        onChange={(value) => {
          setEnvironment(value);
          setPreferenceStatus(null);
        }}
        disabled={loading || savingPreference}
      >
        <Button
          title={
            preference?.environment === environment
              ? "Preferred space saved"
              : "Remember this space"
          }
          disabled={loading || preference?.environment === environment}
          loading={savingPreference}
          variant="ghost"
          onPress={saveEnvironment}
          style={{ marginTop: 4 }}
        />
        {preferenceStatus && (
          <Notice error={preferenceStatus.error}>
            {preferenceStatus.message}
          </Notice>
        )}
      </EnvironmentOptions>
      <Button
        title={loading ? "Preparing your Moment…" : "Create my Moment"}
        onPress={generate}
        loading={loading}
        disabled={!feeling.trim()}
        icon="sparkles-outline"
        style={{ marginTop: 12 }}
      />
      <AppText variant="caption" color={colors.muted} style={{ marginTop: 10 }}>
        This uses what you share here. Approved preferences are used only with
        personalization on.
      </AppText>
      {!!error && <Notice error>{error}</Notice>}
      {!!notice && <Notice>{notice}</Notice>}
      {result?.support && (
        <View onLayout={scrollToResult} style={{ marginTop: 18 }}>
          <Card>
            <AppText variant="heading">A person can help right now.</AppText>
            <AppText style={{ marginVertical: 13 }}>{result.message}</AppText>
            <Button
              title="Find human support"
              onPress={() => app.navigate("support")}
            />
          </Card>
        </View>
      )}
      {result?.activity && !result.support && (
        <View
          key={result.activity.id}
          onLayout={scrollToResult}
          style={{
            marginTop: 27,
            paddingTop: 24,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <AppText variant="heading">{result.activity.title}</AppText>
          <AppText color={colors.muted} style={{ marginTop: 8 }}>
            {result.activity.description}
          </AppText>
          <Row style={{ marginTop: 16 }}>
            <Icon name="time-outline" size={17} />
            <AppText variant="caption">
              {Math.round((result.activity.durationSec / 60) * 10) / 10} min ·{" "}
              {ENVIRONMENTS.find((item) => item.id === environment)?.title}
            </AppText>
          </Row>
          <Button
            title="Begin this Moment"
            icon="play-outline"
            onPress={() =>
              app.navigate("moment-player", {
                ...result,
                conversationId: app.params?.conversationId,
                activity: { ...result.activity!, environment },
              })
            }
            style={{ marginTop: 17 }}
          />
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 12 }}
          >
            {result.provider === "live"
              ? "AI-created guidance · validated before playback"
              : "Built-in Moment · Live AI is off"}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: why }}
            aria-expanded={why}
            onPress={() => setWhy(!why)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <AppText variant="caption">
              {why ? "Hide suggestion details" : "Why this Moment?"}
            </AppText>
          </Pressable>
          {why && (
            <AppText variant="caption" color={colors.muted}>
              {result.explanation}
            </AppText>
          )}
        </View>
      )}
      <View
        style={{
          marginTop: 27,
          paddingTop: 21,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }}
      >
        <Button
          title="Browse practices and your toolkit"
          variant="ghost"
          icon="compass-outline"
          onPress={() => app.navigate("explore")}
        />
      </View>
    </Screen>
  );
}

export function MomentPlayerScreen() {
  const app = useApp();
  const activity = app.params?.activity;
  const playable = isPlayableMoment(activity);
  const guidedSource =
    app.params.source === "explore"
      ? "Explore"
      : app.params.source === "today"
        ? "Today"
        : undefined;
  useEffect(() => {
    if (playable) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        app.back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [playable, app.back]);
  if (!playable)
    return (
      <Screen title="Solace Moment" back={app.back}>
        <AppText variant="title">Let's make a new Moment.</AppText>
        <Notice>
          This activity couldn't be opened. Your saved Journey is unchanged.
        </Notice>
        <Button title="Find a Moment" onPress={() => app.navigate("moments")} />
      </Screen>
    );
  return (
    <PlayableMoment
      key={activity.id}
      activity={activity}
      provider={app.params.provider === "live" ? "live" : "offline"}
      guidedSource={guidedSource}
    />
  );
}

function PlayableMoment({
  activity,
  provider,
  guidedSource,
}: {
  activity: SolaceMoment;
  provider: "live" | "offline";
  guidedSource?: "Explore" | "Today";
}) {
  const app = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [environment, setEnvironment] = useState<MomentEnvironment>(
    activity.environment,
  );
  const [sound, setSound] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finished, setFinished] = useState(false);
  const [exitConfirmation, setExitConfirmation] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSession, setSavedSession] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clock = useRef(emptyClock());
  const resumeAfterExit = useRef(false);
  const finishedAt = useRef<string | null>(null);
  const saveLock = useRef(false);
  const saveSnapshot = useRef<Item | null>(null);
  const sessionId = useRef(
    `moment-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
  );
  const complete = elapsedMs >= activity.durationSec * 1000;
  const position = momentPosition(activity, elapsedMs);
  const rhythm = activity.breathing
    ? breathingPosition(elapsedMs / 1000, activity.breathing)
    : null;
  function pause(message = "") {
    clock.current = pauseMoment(clock.current, now(), activity.durationSec);
    setElapsedMs(clock.current.elapsedMs);
    setRunning(false);
    if (message) setNotice(message);
    if (clock.current.elapsedMs >= activity.durationSec * 1000) {
      finishedAt.current ||= new Date().toISOString();
      setFinished(true);
    }
  }
  function resume() {
    if (finished || complete) return;
    setExitConfirmation(false);
    setNotice("");
    clock.current = resumeMoment(clock.current, now());
    setStarted(true);
    setRunning(true);
  }
  function dismissExit() {
    setExitConfirmation(false);
    if (resumeAfterExit.current && !finished) resume();
    resumeAfterExit.current = false;
  }
  function leave() {
    if (saveLock.current) return;
    if (exitConfirmation) {
      dismissExit();
      return;
    }
    if (!started || savedSession) {
      app.back();
      return;
    }
    resumeAfterExit.current = clock.current.runningSince !== null;
    pause();
    setExitConfirmation(true);
  }
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const elapsed = elapsedMomentMs(
        clock.current,
        now(),
        activity.durationSec,
      );
      setElapsedMs(elapsed);
      if (elapsed >= activity.durationSec * 1000) pause();
    }, 250);
    return () => clearInterval(timer);
  }, [running, activity.durationSec]);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      if (state !== "active" && clock.current.runningSince !== null)
        pause("Paused while you were away. Continue whenever you're ready.");
    });
    const hardwareBack = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        leave();
        return true;
      },
    );
    return () => {
      subscription.remove();
      hardwareBack.remove();
    };
  }, [started, finished, savedSession, exitConfirmation]);
  async function save() {
    if (saveLock.current || !complete) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    const completedAt = finishedAt.current || new Date().toISOString();
    saveSnapshot.current ||= {
      id: sessionId.current,
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity: { ...activity, environment },
      environment,
      provider,
      durationSec: Math.floor(elapsedMs / 1000),
      plannedDurationSec: activity.durationSec,
      completed: true,
      feedback: feedback || "skipped",
      note: note.trim(),
      source: guidedSource ?? "Solace Moments",
      ...(app.params?.conversationId
        ? { sourceConversationId: app.params.conversationId }
        : {}),
      createdAt: completedAt,
      day: localDay(new Date(completedAt)),
    };
    try {
      const saved = await app.save("sessions", saveSnapshot.current);
      setSavedSession(saved);
    } catch (error) {
      setError(errorText(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        title={finished ? "A moment for you" : "Solace Moment"}
        back={leave}
        scrollRef={scroll}
      >
        <AppText variant="title">
          {finished
            ? savedSession
              ? "A little care, saved."
              : "You made room for you."
            : activity.title}
        </AppText>
        <AppText
          color={colors.muted}
          style={{ marginTop: 10, marginBottom: 21 }}
        >
          {finished
            ? savedSession
              ? "Your completed Moment is in Journey. There is no next task to earn."
              : "Your Moment is complete. Save it to your Journey, with feedback if you'd like."
            : activity.description}
        </AppText>
        <EnvironmentScene
          environment={environment}
          active={running}
          style={{
            minHeight: 200,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Companion
            state={
              finished
                ? "happy"
                : running && activity.type === "breathing"
                  ? "breathing"
                  : "idle"
            }
            breathing={activity.breathing}
            breathingProgress={running && rhythm ? rhythm.progress : undefined}
            phase={
              running && rhythm
                ? `${rhythm.phase}, ${rhythm.remaining}`
                : undefined
            }
            size={158}
          />
        </EnvironmentScene>
        {!finished && (
          <>
            <View style={{ marginVertical: 18 }}>
              <Row style={{ justifyContent: "space-between" }}>
                <AppText variant="caption" color={colors.muted}>
                  {started
                    ? running
                      ? "Taking a little space"
                      : "Paused · your time is kept"
                    : `${activity.steps.length} guided steps`}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {momentClockText(elapsedMs / 1000)} /{" "}
                  {momentClockText(activity.durationSec)}
                </AppText>
              </Row>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Moment progress"
                aria-valuemin={0}
                aria-valuemax={activity.durationSec}
                aria-valuenow={Math.floor(elapsedMs / 1000)}
                aria-valuetext={`${Math.floor(elapsedMs / 1000)} of ${activity.durationSec} seconds`}
                accessibilityValue={{
                  min: 0,
                  max: activity.durationSec,
                  now: Math.floor(elapsedMs / 1000),
                  text: `${Math.floor(elapsedMs / 1000)} of ${activity.durationSec} seconds`,
                }}
                style={{
                  height: 3,
                  backgroundColor: colors.border,
                  marginTop: 11,
                  overflow: "hidden",
                  borderRadius: 2,
                }}
              >
                <View
                  style={{
                    width: `${Math.min(100, (elapsedMs / (activity.durationSec * 1000)) * 100)}%`,
                    height: "100%",
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
            </View>
            <AppText variant="heading" accessibilityLiveRegion="polite">
              {rhythm && running ? rhythm.phase : position.step.title}
            </AppText>
            <AppText style={{ marginTop: 9 }}>
              {position.step.instruction}
            </AppText>
            {rhythm && running && (
              <AppText
                variant="title"
                style={{
                  textAlign: "center",
                  marginTop: 9,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {rhythm.remaining}
              </AppText>
            )}
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 10 }}
            >
              Step {position.index + 1} of {activity.steps.length}
              {activity.type === "breathing"
                ? " · Breathe naturally whenever you prefer."
                : " · Take only what feels comfortable."}
            </AppText>
            <EnvironmentOptions value={environment} onChange={setEnvironment}>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ marginTop: 8 }}
              >
                {ENVIRONMENTS.find((item) => item.id === environment)?.sound}
              </AppText>
            </EnvironmentOptions>
            {!!activity.reflectionPrompts.length && (
              <View style={{ marginTop: 24 }}>
                <AppText variant="label">A thought to sit with</AppText>
                {activity.reflectionPrompts.map((prompt) => (
                  <AppText
                    key={prompt}
                    color={colors.muted}
                    style={{ marginTop: 9 }}
                  >
                    {prompt}
                  </AppText>
                ))}
              </View>
            )}
          </>
        )}
        {finished && !savedSession && (
          <View style={{ marginTop: 23 }}>
            <AppText variant="heading">How was this pause?</AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 5 }}
            >
              Optional. Your experience doesn't need to be a particular way.
            </AppText>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 15,
              }}
            >
              {["Helped", "A little", "Not for me"].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={value}
                  accessibilityState={{
                    checked: feedback === value,
                    disabled: saving || !!saveSnapshot.current,
                  }}
                  aria-checked={feedback === value}
                  disabled={saving || !!saveSnapshot.current}
                  onPress={() => setFeedback(feedback === value ? "" : value)}
                  style={{
                    minHeight: 48,
                    paddingHorizontal: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 25,
                    backgroundColor:
                      feedback === value ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor:
                      feedback === value ? colors.primary : colors.border,
                  }}
                >
                  <AppText
                    variant="caption"
                    color={
                      feedback === value ? colors.primaryText : colors.text
                    }
                  >
                    {value}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Optional note about your Moment"
              placeholder="Anything you'd like to keep from this moment?"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              editable={!saving && !saveSnapshot.current}
              multiline
              maxLength={2000}
              style={{
                marginTop: 17,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 18,
                backgroundColor: colors.surface,
                padding: 15,
                minHeight: 100,
                color: colors.text,
                fontFamily: "Inter_400Regular",
                fontSize: 15,
                lineHeight: 22,
                textAlignVertical: "top",
              }}
            />
            <Button
              title={error ? "Retry saving Moment" : "Save Moment to Journey"}
              onPress={save}
              loading={saving}
              style={{ marginTop: 18 }}
            />
            {!!error && (
              <Notice error>
                {error} Your completed Moment and feedback are still here. Retry
                saves the same entry.
              </Notice>
            )}
          </View>
        )}
        {savedSession && (
          <View style={{ marginTop: 23 }}>
            <Row style={{ justifyContent: "center", marginBottom: 19 }}>
              <Icon name="checkmark-circle" color={colors.sageText} />
              <AppText variant="caption">
                {momentClockText(activity.durationSec)} recorded ·{" "}
                {ENVIRONMENTS.find((item) => item.id === environment)?.short}
              </AppText>
            </Row>
            {!!app.params?.conversationId && (
              <Button
                title="Continue your conversation"
                variant="secondary"
                onPress={() =>
                  app.navigate("chat", { id: app.params.conversationId })
                }
                style={{ marginBottom: 12 }}
              />
            )}
            <Button
              title="See your Journey"
              onPress={() => app.setTab("journey")}
            />
            {saveSnapshot.current?.feedback === "Helped" && (
              <Button
                title="Remember what helped"
                variant="secondary"
                onPress={() =>
                  app.navigate("memory", {
                    suggestedPreference: `I find ${activity.type} Moments helpful.`,
                    sourceType: "session",
                    sourceId: savedSession.id,
                  })
                }
                style={{ marginTop: 12 }}
              />
            )}
            <Button
              title="Return to Today"
              variant="ghost"
              onPress={() => app.setTab("today")}
              style={{ marginTop: 8 }}
            />
          </View>
        )}
        {!!notice && !finished && <Notice>{notice}</Notice>}
        {exitConfirmation && (
          <View
            onLayout={(event) =>
              scroll.current?.scrollTo({
                y: Math.max(0, event.nativeEvent.layout.y - 20),
                animated: !reducedMotion,
              })
            }
            style={{
              marginTop: 20,
              paddingTop: 18,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            <AppText variant="heading">Leave this Moment?</AppText>
            <AppText
              color={colors.muted}
              style={{ marginTop: 8, marginBottom: 15 }}
            >
              {finished
                ? "This completed Moment hasn't been saved. Leave it here, or go back and save it."
                : "Your pause is stopped. Leaving won't record this as a completed Moment."}
            </AppText>
            <Button
              title={
                finished
                  ? "Keep my Moment"
                  : resumeAfterExit.current
                    ? "Keep going"
                    : "Return to Moment"
              }
              onPress={dismissExit}
            />
            <Button
              title="Leave without saving"
              variant="ghost"
              onPress={app.back}
              style={{ marginTop: 8 }}
            />
          </View>
        )}
        {!finished && (
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 24 }}
          >
            {provider === "live"
              ? "AI-created wellness guidance. You remain in control."
              : guidedSource
                ? `Guided practice from ${guidedSource}.`
                : "Built-in guided Moment · Live AI is off."}{" "}
            This is an optional wellness activity, not medical care.
          </AppText>
        )}
      </Screen>
      {!finished && !exitConfirmation && (
        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 10),
            backgroundColor: colors.bg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          <Button
            title={
              running
                ? "Pause Moment"
                : started
                  ? "Continue Moment"
                  : "Begin Moment"
            }
            icon={running ? "pause-outline" : "play-outline"}
            onPress={() => (running ? pause() : resume())}
          />
          <AmbientSound
            environment={environment}
            running={running}
            enabled={sound}
            onToggle={() => setSound(!sound)}
          />
        </View>
      )}
    </View>
  );
}
