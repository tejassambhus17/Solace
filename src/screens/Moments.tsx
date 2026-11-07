import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { isRecordId, routes } from "../routes";
import { getTechnique, type Technique } from "../techniques";
import { AppText, Button, Card, Icon, Row, Screen } from "../ui";
import { Companion, useReducedMotion } from "../Companion";
import { ENVIRONMENTS, EnvironmentScene } from "../Environment";
import { localDay } from "../content";
import {
  elapsedMomentMs,
  emptyClock,
  isPlayableMoment,
  momentBreathingPosition,
  momentClockText,
  momentPosition,
  newMomentSessionId,
  nextMomentTickDelay,
  pauseMoment,
  resumeMoment,
  type GeneratedMoment,
  type MomentEnvironment,
} from "../moments";
import type { SolaceMoment } from "../../server/src/moment-contract";
import { RecommendationExplanation } from "./RecommendationExplanation";
import { GuidedBreathingPlayer } from "./GuidedBreathingPlayer";
import { useBreathingMotion } from "../breathing-motion";

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
            onPress={() => setWhy(true)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <AppText variant="caption">Why Solace suggested this</AppText>
          </Pressable>
          {why && (
            <RecommendationExplanation
              open
              title={result.activity.title}
              basis={result.explanationBasis ?? "general"}
              reason={result.explanation}
              onClose={() => setWhy(false)}
              onManage={() => {
                setWhy(false);
                app.navigate("memory");
              }}
            />
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
  const technique = getTechnique(app.params.techniqueId);
  const activity =
    app.params.techniqueId === undefined
      ? app.params.activity
      : technique?.activity;
  const playable = isPlayableMoment(activity);
  const guidedSource =
    app.params.source === "explore"
      ? "Explore"
      : app.params.source === "today"
        ? "Today"
        : app.params.source === "chat"
          ? "Solace chat"
          : app.params.source === "journal"
            ? "My Journal"
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
        {app.params.techniqueId === undefined ? (
          <Button
            title="Find a Moment"
            onPress={() => app.navigate("moments")}
          />
        ) : (
          <Button
            title="Browse techniques"
            onPress={() => app.navigate(routes.techniques)}
          />
        )}
      </Screen>
    );
  return (
    <PlayableMoment
      key={activity.id}
      activity={activity}
      technique={technique}
      conversationId={
        isRecordId(app.params.conversationId)
          ? app.params.conversationId
          : undefined
      }
      provider={
        !technique && app.params.provider === "live" ? "live" : "offline"
      }
      guidedSource={guidedSource}
      returnToBuilder={app.params.timedPractice === true}
    />
  );
}

function PlayableMoment({
  activity,
  technique,
  conversationId,
  provider,
  guidedSource,
  returnToBuilder,
}: {
  activity: SolaceMoment;
  technique?: Technique;
  conversationId?: string;
  provider: "live" | "offline";
  guidedSource?: "Explore" | "Today" | "Solace chat" | "My Journal";
  returnToBuilder: boolean;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const guidedBreathing = !!technique && activity.type === "breathing";
  const [environment, setEnvironment] = useState<MomentEnvironment>(
    guidedBreathing ? "twilight" : activity.environment,
  );
  const [sound, setSound] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [manualStep, setManualStep] = useState(0);
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
  const finishedAt = useRef<{ createdAt: string; day: string } | null>(null);
  const saveLock = useRef(false);
  const saveSnapshot = useRef<Item | null>(null);
  const [sessionId] = useState(newMomentSessionId);
  const selfPaced = technique?.selfPaced ?? false;
  const elapsedLimit = selfPaced ? 7200 : activity.durationSec;
  const timedPosition = momentPosition(activity, elapsedMs);
  const position = selfPaced
    ? {
        ...timedPosition,
        index: manualStep,
        step: activity.steps[manualStep],
        complete: finished,
      }
    : timedPosition;
  const atLastStep = position.index === activity.steps.length - 1;
  const progressMax = selfPaced ? activity.steps.length : activity.durationSec;
  const progressNow = selfPaced
    ? started
      ? manualStep + 1
      : 0
    : Math.floor(elapsedMs / 1000);
  const progressText = `${progressNow} of ${progressMax} ${selfPaced ? "steps" : "seconds"}`;
  const reflectionPractice = !!technique && activity.type === "reflection";
  const completedSeconds = Math.floor(elapsedMs / 1000);
  const rhythm =
    started && !finished
      ? momentBreathingPosition(
          activity,
          position,
          elapsedMs,
          provider === "offline",
        )
      : null;
  const breathingMotion = useBreathingMotion(rhythm, running, reducedMotion);
  const pause = useCallback(
    (message = "", completePractice = false) => {
      clock.current = pauseMoment(clock.current, now(), elapsedLimit);
      setElapsedMs(clock.current.elapsedMs);
      setRunning(false);
      if (message) setNotice(message);
      if (
        completePractice ||
        (!selfPaced && clock.current.elapsedMs >= activity.durationSec * 1000)
      ) {
        if (reflectionPractice) Keyboard.dismiss();
        const completedAt = new Date();
        finishedAt.current ||= {
          createdAt: completedAt.toISOString(),
          day: localDay(completedAt),
        };
        setFinished(true);
      }
    },
    [activity.durationSec, elapsedLimit, reflectionPractice, selfPaced],
  );
  function resume() {
    if (finishedAt.current) return;
    setExitConfirmation(false);
    setNotice("");
    clock.current = resumeMoment(clock.current, now());
    setStarted(true);
    setRunning(true);
  }
  function restart() {
    if (finishedAt.current) return;
    clock.current = emptyClock();
    setStarted(false);
    setRunning(false);
    setElapsedMs(0);
    setManualStep(0);
    setNotice("Ready to start again.");
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
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      if (clock.current.runningSince === null) return;
      const elapsed = elapsedMomentMs(clock.current, now(), elapsedLimit);
      setElapsedMs(elapsed);
      if (elapsed >= elapsedLimit * 1000) {
        if (!selfPaced) pause();
        return;
      }
      timer = setTimeout(tick, nextMomentTickDelay(elapsed, elapsedLimit));
    }
    timer = setTimeout(
      tick,
      nextMomentTickDelay(
        elapsedMomentMs(clock.current, now(), elapsedLimit),
        elapsedLimit,
      ),
    );
    return () => clearTimeout(timer);
  }, [running, elapsedLimit, pause, selfPaced]);
  useEffect(() => {
    if (savedSession) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [savedSession]);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener("change", (state) => {
      if (state !== "active" && clock.current.runningSince !== null)
        pause("Paused while you were away. Continue whenever you're ready.");
    });
    return () => subscription.remove();
  }, [pause]);
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => {
    const hardwareBack = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        leaveRef.current();
        return true;
      },
    );
    return () => hardwareBack.remove();
  }, []);
  async function save() {
    if (saveLock.current || !finishedAt.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    saveSnapshot.current ||= {
      id: sessionId,
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity: { ...activity, environment },
      environment,
      provider,
      durationSec: completedSeconds,
      plannedDurationSec: activity.durationSec,
      completed: true,
      feedback: feedback || "skipped",
      note: note.trim(),
      source: guidedSource ?? "Solace Moments",
      ...(conversationId ? { sourceConversationId: conversationId } : {}),
      ...finishedAt.current,
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
  if (guidedBreathing && !finished)
    return (
      <GuidedBreathingPlayer
        activity={activity}
        position={position}
        rhythm={rhythm}
        breathingMotion={breathingMotion}
        elapsedMs={elapsedMs}
        environment={environment}
        running={running}
        started={started}
        sound={sound}
        toggleSound={() => setSound(!sound)}
        notice={notice}
        togglePlay={() => (running ? pause() : resume())}
        restart={restart}
        leave={leave}
        exit={
          exitConfirmation
            ? {
                resume: resumeAfterExit.current,
                dismiss: dismissExit,
                confirm: app.back,
              }
            : undefined
        }
      >
        <EnvironmentOptions value={environment} onChange={setEnvironment}>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 8 }}
          >
            {ENVIRONMENTS.find((item) => item.id === environment)?.sound}
          </AppText>
        </EnvironmentOptions>
      </GuidedBreathingPlayer>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen
        title={
          finished
            ? "A moment for you"
            : technique
              ? "Guided practice"
              : "Solace Moment"
        }
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
        {technique && savedSession && (
          <TechniqueSaveStatus
            activeSeconds={savedSession.durationSec ?? completedSeconds}
            saved
          />
        )}
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
            state={finished ? "happy" : rhythm ? "breathing" : "idle"}
            animate={running || finished || (!technique && !started)}
            breathing={activity.breathing}
            breathingMotion={breathingMotion}
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
                  {momentClockText(elapsedMs / 1000)}
                  {selfPaced
                    ? " active"
                    : ` / ${momentClockText(activity.durationSec)}`}
                </AppText>
              </Row>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Moment progress"
                aria-valuemin={0}
                aria-valuemax={progressMax}
                aria-valuenow={progressNow}
                aria-valuetext={progressText}
                accessibilityValue={{
                  min: 0,
                  max: progressMax,
                  now: progressNow,
                  text: progressText,
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
                    width: `${Math.min(100, 100 * (selfPaced ? progressNow / progressMax : elapsedMs / (activity.durationSec * 1000)))}%`,
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
                {reflectionPractice && started && (
                  <MomentNote
                    note={note}
                    onChange={setNote}
                    label="Optional reflection response"
                    canDiscard
                  />
                )}
              </View>
            )}
            {selfPaced && started && !exitConfirmation && (
              <View style={{ gap: 8, marginTop: 17 }}>
                <Button
                  title={atLastStep ? "Finish practice" : "Next step"}
                  disabled={!running}
                  variant="secondary"
                  onPress={() => {
                    if (clock.current.runningSince === null) return;
                    if (atLastStep) pause("", true);
                    else
                      setManualStep((step) =>
                        Math.min(step + 1, activity.steps.length - 1),
                      );
                  }}
                />
                {manualStep > 0 && (
                  <Button
                    title="Previous step"
                    disabled={!running}
                    variant="ghost"
                    onPress={() =>
                      setManualStep((step) => Math.max(0, step - 1))
                    }
                  />
                )}
              </View>
            )}
            <EnvironmentOptions value={environment} onChange={setEnvironment}>
              <AppText
                variant="caption"
                color={colors.muted}
                style={{ marginTop: 8 }}
              >
                {ENVIRONMENTS.find((item) => item.id === environment)?.sound}
              </AppText>
            </EnvironmentOptions>
            {!!technique && started && !exitConfirmation && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <Button
                  title="Restart"
                  icon="refresh-outline"
                  variant="ghost"
                  onPress={restart}
                />
                <Button
                  title="Stop practice"
                  icon="stop-outline"
                  variant="ghost"
                  onPress={leave}
                />
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
            <MomentNote
              note={note}
              onChange={setNote}
              label={
                reflectionPractice
                  ? "Optional reflection response"
                  : "Optional note about your Moment"
              }
              readOnly={saving || !!saveSnapshot.current}
              canDiscard={reflectionPractice}
            />
            {!!technique && (
              <View style={{ marginTop: 18 }}>
                <TechniqueSaveStatus
                  activeSeconds={completedSeconds}
                  saving={saving}
                  hasError={!!error}
                />
              </View>
            )}
            <Button
              title={
                saving && technique
                  ? "Saving to Journey…"
                  : error
                    ? "Retry saving Moment"
                    : "Save Moment to Journey"
              }
              onPress={save}
              loading={saving}
              style={{ marginTop: technique ? 0 : 18 }}
            />
            {!!error && (
              <Notice error>
                {technique
                  ? "Your active time and feedback are still here. Try again to confirm the same entry."
                  : `${error} Your completed Moment and feedback are still here. Retry saves the same entry.`}
              </Notice>
            )}
          </View>
        )}
        {savedSession && (
          <View style={{ marginTop: 23 }}>
            <Row style={{ justifyContent: "center", marginBottom: 19 }}>
              <Icon
                name={technique ? "leaf-outline" : "checkmark-circle"}
                color={colors.sageText}
              />
              <AppText variant="caption">
                {!technique &&
                  `${momentClockText(savedSession.durationSec ?? completedSeconds)} recorded · `}
                {ENVIRONMENTS.find((item) => item.id === environment)?.short}
              </AppText>
            </Row>
            {!!conversationId && (
              <Button
                title="Continue your conversation"
                variant="secondary"
                onPress={() =>
                  app.navigate(routes.companion, { id: conversationId })
                }
                style={{ marginBottom: 12 }}
              />
            )}
            <Button
              title="See your Journey"
              onPress={() => app.navigate(routes.journey)}
            />
            {reflectionPractice && (
              <Button
                title="Write in My Journal"
                variant="secondary"
                onPress={() => {
                  app.back();
                  app.navigate(routes.journalEditor, {
                    prompt: activity.reflectionPrompts[0],
                  });
                }}
                style={{ marginTop: 12 }}
              />
            )}
            {saveSnapshot.current?.feedback === "Helped" && (
              <Button
                title="Remember what helped"
                variant="secondary"
                onPress={() =>
                  app.navigate(routes.memory, {
                    suggestedPreference: `I find ${activity.type} Moments helpful.`,
                    sourceType: "session",
                    sourceId: savedSession.id,
                  })
                }
                style={{ marginTop: 12 }}
              />
            )}
            <Button
              title={
                returnToBuilder ? "Return to Timed Practice" : "Return to Today"
              }
              variant="ghost"
              onPress={
                returnToBuilder ? app.back : () => app.navigate(routes.today)
              }
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
                ? technique
                  ? "Pause practice"
                  : "Pause Moment"
                : started
                  ? technique
                    ? "Resume practice"
                    : "Continue Moment"
                  : technique
                    ? "Begin practice"
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

function TechniqueSaveStatus({
  activeSeconds,
  saved = false,
  saving = false,
  hasError = false,
}: {
  activeSeconds: number;
  saved?: boolean;
  saving?: boolean;
  hasError?: boolean;
}) {
  const { colors } = useTheme();
  const status = saved
    ? "Recorded in Journey"
    : saving
      ? "Saving to Journey…"
      : hasError
        ? "Journey save unconfirmed"
        : "Ready to save to Journey";
  return (
    <Card style={{ marginBottom: saved ? 18 : 8, gap: 4 }}>
      <AppText
        variant="label"
        accessibilityLiveRegion="polite"
        color={saved ? colors.sageText : hasError ? colors.danger : colors.text}
      >
        {status}
      </AppText>
      <AppText
        variant="caption"
        color={colors.muted}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {momentClockText(activeSeconds)} active time
      </AppText>
    </Card>
  );
}

function MomentNote({
  note,
  onChange,
  label,
  readOnly = false,
  canDiscard = false,
}: {
  note: string;
  onChange: (value: string) => void;
  label: string;
  readOnly?: boolean;
  canDiscard?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <>
      <TextInput
        accessibilityLabel={label}
        placeholder="Anything you'd like to keep from this moment?"
        placeholderTextColor={colors.muted}
        value={note}
        onChangeText={onChange}
        editable={!readOnly}
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
      {canDiscard && !readOnly && !!note && (
        <Button
          title="Discard response"
          variant="ghost"
          onPress={() => onChange("")}
        />
      )}
    </>
  );
}
