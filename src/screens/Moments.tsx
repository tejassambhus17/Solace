import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AppState as NativeAppState,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { AmbientSound } from "../AmbientSound";
import { playHaptic } from "../haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type Item } from "../store";
import { PracticeCompletion } from "./PracticeFollowUp";
import { practiceOrigins } from "../practice-follow-up";
import { SceneIntro } from "../NestedDesign";
import { useTheme } from "../theme";
import { isRecordId, routes } from "../routes";
import { getTechnique, type Technique } from "../techniques";
import {
  AppText,
  Button,
  Card,
  Icon,
  IconButton,
  Input,
  NestedState,
  Row,
  Screen,
} from "../ui";
import { Companion, useReducedMotion } from "../Companion";
import { spacing } from "../layout";
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
import {
  planTaskActivity,
  type WellnessPlan,
} from "../../server/src/wellness-plans";
import { RecommendationExplanation } from "./RecommendationExplanation";
import { GuidedBreathingPlayer } from "./GuidedBreathingPlayer";
import { EnvironmentPicker } from "./MomentEnvironmentPicker";
import { useBreathingMotion } from "../breathing-motion";

const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "We couldn't complete that. Please try again.";
const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
const momentArtwork = {
  light: require("../../assets/redesign-explore-scene-light.jpg"),
  dark: require("../../assets/today-twilight-lotus.jpg"),
};

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

function EnvironmentOptions({
  value,
  onChange,
  disabled = false,
  stacked = false,
  children,
}: {
  value: MomentEnvironment;
  onChange: (environment: MomentEnvironment) => void;
  disabled?: boolean;
  stacked?: boolean;
  children?: React.ReactNode;
}) {
  const { colors, resolved } = useTheme();
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
          <Icon
            name="leaf-outline"
            size={19}
            color={resolved === "dark" ? colors.primary : colors.accent}
          />
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
            stacked={stacked}
          />
          {children}
        </View>
      )}
    </View>
  );
}

export function MomentsScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const preference = app.data.preferences?.find(
    (item) => item.id === "wellness",
  );
  const [environment, setEnvironment] = useState<MomentEnvironment>(
    ENVIRONMENTS.find(({ id }) => id === preference?.environment)?.id ??
      "forest",
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
  useLayoutEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
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
      if (version !== generation.current) return;
      if (!response?.support && !isPlayableMoment(response?.activity))
        throw new Error(
          "This Moment couldn't be prepared safely. Your words are kept—please try again.",
        );
      setResult(response);
    } catch (error) {
      if (version === generation.current) setError(errorText(error));
    } finally {
      generationLock.current = false;
      setLoading(false);
    }
  }
  async function saveEnvironment() {
    if (preferenceLock.current) return;
    preferenceLock.current = true;
    setSavingPreference(true);
    setPreferenceStatus(null);
    try {
      await app.save("preferences", {
        id: "wellness",
        environment,
      });
      setPreferenceStatus({ message: "Your preferred space is saved." });
    } catch (error) {
      setPreferenceStatus({ message: errorText(error), error: true });
    } finally {
      preferenceLock.current = false;
      setSavingPreference(false);
    }
  }
  function scrollToResult(event: LayoutChangeEvent) {
    scroll.current?.scrollTo({
      y: Math.max(0, event.nativeEvent.layout.y - 20),
      animated: !reducedMotion,
    });
  }
  return (
    <Screen variant="nested" scrollRef={scroll}>
      <View style={momentStyles.backRow}>
        <IconButton
          name="chevron-back"
          label="Go back"
          appearance="outlined"
          size={48}
          onPress={app.back}
        />
      </View>
      <SceneIntro
        image={momentArtwork[resolved]}
        title="Solace Moments"
        description="Start with how things feel. Find a little room to breathe, notice or reflect."
      />
      <View
        style={[
          momentStyles.prompt,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Row style={momentStyles.promptHeader}>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={momentStyles.flex}
          >
            What would feel supportive?
          </AppText>
          <Companion
            state={loading ? "thinking" : "idle"}
            animate={loading}
            size={46}
          />
        </Row>
        <Input
          accessibilityLabel="How are you feeling for your Moment?"
          placeholder="A busy mind, a long day, or simply a little pause…"
          value={feeling}
          onChangeText={writeFeeling}
          multiline
          maxLength={2000}
          editable={!loading}
        />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.compact,
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
      </View>
      <EnvironmentOptions
        value={environment}
        onChange={(value) => {
          setEnvironment(value);
          setPreferenceStatus(null);
        }}
        disabled={loading || savingPreference}
        stacked={width < 344 || fontScale >= 1.4}
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
          style={[
            momentStyles.preview,
            {
              backgroundColor: colors.lavenderSurface,
              borderColor: colors.border,
            },
          ]}
        >
          <AppText variant="title" accessibilityRole="header">
            {result.activity.title}
          </AppText>
          <AppText color={colors.muted}>{result.activity.description}</AppText>
          <Row style={momentStyles.previewMeta}>
            <Icon name="time-outline" size={17} color={colors.lavenderText} />
            <AppText
              variant="label"
              color={colors.lavenderText}
              style={momentStyles.flex}
            >
              {Math.round((result.activity.durationSec / 60) * 10) / 10} min ·{" "}
              {ENVIRONMENTS.find((item) => item.id === environment)?.title}
            </AppText>
          </Row>
          <View style={momentStyles.previewSteps}>
            {result.activity.steps.map((step, index) => (
              <View
                key={index}
                style={[
                  momentStyles.previewStep,
                  { borderColor: colors.border },
                ]}
              >
                <AppText variant="caption" color={colors.lavenderText}>
                  {index + 1}
                </AppText>
                <AppText style={momentStyles.flex}>{step.title}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {momentClockText(step.durationSec)}
                </AppText>
              </View>
            ))}
          </View>
          <Button
            title="Begin this Moment"
            icon="play-outline"
            onPress={() =>
              app.navigate("moment-player", {
                ...result,
                conversationId: app.params?.conversationId,
                activity: { ...result.activity!, environment },
                useChosenEnvironment: true,
              })
            }
          />
          <AppText variant="caption" color={colors.muted}>
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
  const { planId, planTaskId } = app.params;
  const fromPlan = planId !== undefined || planTaskId !== undefined;
  const plan =
    fromPlan && isRecordId(planId) && isRecordId(planTaskId)
      ? (app.data.plans.find(
          (item) =>
            item.id === planId && item.type === "wellness" && item.startedAt,
        ) as WellnessPlan | undefined)
      : undefined;
  const task = plan?.tasks?.find((item) => item.id === planTaskId);
  const technique = fromPlan ? undefined : getTechnique(app.params.techniqueId);
  const activity = fromPlan
    ? task && planTaskActivity(task)
    : app.params.techniqueId === undefined
      ? app.params.activity
      : technique?.activity;
  const playable = isPlayableMoment(activity);
  const guidedSource = fromPlan
    ? "Wellness plan"
    : app.params.source === "explore"
      ? "Explore"
      : app.params.source === "today"
        ? "Today"
        : app.params.source === "chat"
          ? "Solace chat"
          : app.params.source === "journal"
            ? "My Journal"
            : app.params.source === "journey"
              ? "Journey"
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
      <Screen variant="nested" title="Solace Moment" back={app.back}>
        <NestedState
          title="Let's make a new Moment."
          description="This activity couldn't be opened. Your saved Journey is unchanged."
          icon="flower-outline"
        >
          {fromPlan ? (
            <Button title="Back to plan" onPress={app.back} />
          ) : app.params.techniqueId === undefined ? (
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
        </NestedState>
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
      startOnArrival={
        app.params.startOnArrival === true &&
        (app.params.source === "chat" ||
          (app.params.source === "today" &&
            isRecordId(app.params.originCheckinId)))
      }
      originCheckinId={app.params.originCheckinId}
      originActionId={app.params.originActionId}
      useChosenEnvironment={app.params.useChosenEnvironment === true}
      planStep={
        plan?.id && task ? { planId: plan.id, planTaskId: task.id } : undefined
      }
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
  startOnArrival,
  originCheckinId,
  originActionId,
  useChosenEnvironment,
  planStep,
}: {
  activity: SolaceMoment;
  technique?: Technique;
  conversationId?: string;
  provider: "live" | "offline";
  guidedSource?:
    | "Explore"
    | "Today"
    | "Solace chat"
    | "My Journal"
    | "Wellness plan"
    | "Journey";
  returnToBuilder: boolean;
  startOnArrival: boolean;
  originCheckinId?: unknown;
  originActionId?: unknown;
  useChosenEnvironment: boolean;
  planStep?: { planId: string; planTaskId: string };
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const guidedBreathing = !!technique && activity.type === "breathing";
  const preference = app.data.preferences.find(({ id }) => id === "wellness");
  const [environmentOverride, setEnvironment] = useState<MomentEnvironment>();
  const [preferredSound] = useState(() =>
    useChosenEnvironment
      ? undefined
      : ENVIRONMENTS.find(({ id }) => id === preference?.environment)?.id,
  );
  const environment =
    environmentOverride ??
    (guidedBreathing ? "twilight" : activity.environment);
  const soundEnvironment = environmentOverride ?? preferredSound ?? environment;
  const [sound, setSound] = useState(preference?.ambientEnabled === true);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [manualStep, setManualStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [exitConfirmation, setExitConfirmation] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [note, setNote] = useState("");
  const [showExtraFeedback, setShowExtraFeedback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSession, setSavedSession] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const clock = useRef(emptyClock());
  const resumeAfterExit = useRef(false);
  const finishedAt = useRef<{ createdAt: string; day: string } | null>(null);
  const startedAt = useRef<string | undefined>(undefined);
  const saveLock = useRef(false);
  const autoSaveAttempted = useRef(false);
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
    startedAt.current ||= new Date().toISOString();
    clock.current = resumeMoment(clock.current, now());
    setStarted(true);
    setRunning(true);
  }
  const arrivalConsumed = useRef(false);
  useEffect(() => {
    if (!startOnArrival || arrivalConsumed.current) return;
    arrivalConsumed.current = true;
    if (
      !NativeAppState.currentState ||
      NativeAppState.currentState === "active"
    )
      resume();
  }, [startOnArrival]);
  function restart() {
    if (finishedAt.current) return;
    clock.current = emptyClock();
    startedAt.current = undefined;
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
    const hasUnsubmittedFeedback =
      savedSession &&
      showExtraFeedback &&
      ((feedback !== "" && feedback !== savedSession.feedback) ||
        note.trim() !== (savedSession.note ?? ""));
    if (!started || (savedSession && !hasUnsubmittedFeedback)) {
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
  const pauseOnHide = useRef(pause);
  pauseOnHide.current = pause;
  useLayoutEffect(
    () => () => {
      // A notification or tab switch can hide the retained player without an
      // AppState event. Freeze the active clock as soon as Activity hides it.
      if (clock.current.runningSince !== null)
        pauseOnHide.current(
          "Paused while you were away. Continue whenever you're ready.",
        );
    },
    [],
  );
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
      practiceId: technique?.id ?? activity.id,
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity: { ...activity, environment },
      environment,
      provider,
      durationSec: completedSeconds,
      plannedDurationSec: activity.durationSec,
      completed: true,
      outcome: "completed",
      feedback: "skipped",
      source: guidedSource ?? "Solace Moments",
      ...(conversationId ? { sourceConversationId: conversationId } : {}),
      ...practiceOrigins(
        { originCheckinId, originActionId },
        app.data.checkins,
      ),
      ...planStep,
      ...finishedAt.current,
      startedAt: startedAt.current,
      endedAt: finishedAt.current.createdAt,
    };
    try {
      const saved = await app.save("sessions", saveSnapshot.current);
      setSavedSession(saved);
      if (note.trim()) setShowExtraFeedback(true);
      void playHaptic("confirmation");
    } catch (error) {
      setError(errorText(error));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const saveCompletion = useRef(save);
  saveCompletion.current = save;
  useEffect(() => {
    if (!finished || autoSaveAttempted.current) return;
    autoSaveAttempted.current = true;
    void saveCompletion.current();
  }, [finished]);
  async function saveExtraFeedback() {
    if (saveLock.current || !savedSession?.id) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await app.save("sessions", {
        id: savedSession.id,
        feedback: feedback || "skipped",
        note: note.trim(),
      });
      setSavedSession(updated);
      setShowExtraFeedback(false);
    } catch (cause) {
      setError(errorText(cause));
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
        soundEnvironment={soundEnvironment}
        onEnvironmentChange={setEnvironment}
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
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen variant="nested" scrollRef={scroll}>
        <View style={momentStyles.backRow}>
          <IconButton
            name="chevron-back"
            label="Go back"
            appearance="outlined"
            size={48}
            onPress={leave}
          />
        </View>
        {finished ? (
          !savedSession && (
            <SceneIntro
              image={momentArtwork[resolved]}
              title="You made room for you."
              description="Your Moment is complete. We’re saving it to your Journey."
              meta={`${momentClockText(completedSeconds)} active time`}
            />
          )
        ) : (
          <View
            style={[
              momentStyles.playerScene,
              {
                backgroundColor:
                  resolved === "dark" ? colors.lavenderSurface : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <EnvironmentScene
              environment={environment}
              active={running}
              style={momentStyles.environment}
              scenic
            >
              <Companion
                state={rhythm ? "breathing" : "idle"}
                animate={running || (!technique && !started)}
                breathing={activity.breathing}
                breathingMotion={breathingMotion}
                phase={
                  running && rhythm
                    ? `${rhythm.phase}, ${rhythm.remaining}`
                    : undefined
                }
                size={130}
              />
            </EnvironmentScene>
            <View style={momentStyles.playerTitle}>
              <AppText variant="title" accessibilityRole="header">
                {activity.title}
              </AppText>
              <AppText color={colors.muted}>{activity.description}</AppText>
            </View>
          </View>
        )}
        {!finished && (
          <>
            <View style={momentStyles.progress}>
              <Row style={momentStyles.progressLabels}>
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
                    backgroundColor: colors.lavenderText,
                  }}
                />
              </View>
            </View>
            <View
              style={[
                momentStyles.instruction,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText variant="caption" color={colors.lavenderText}>
                Step {position.index + 1} of {activity.steps.length}
              </AppText>
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
                {activity.type === "breathing"
                  ? "Breathe naturally whenever you prefer."
                  : "Take only what feels comfortable."}
              </AppText>
            </View>
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
                {
                  ENVIRONMENTS.find((item) => item.id === soundEnvironment)
                    ?.sound
                }
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
          <View style={{ marginTop: 20 }}>
            <TechniqueSaveStatus
              activeSeconds={completedSeconds}
              saving={saving}
              hasError={!!error}
            />
            {!!error && (
              <>
                <Notice error>
                  Your active time is still here. Retry to save the same Moment.
                </Notice>
                <Button title="Retry saving Moment" onPress={save} />
              </>
            )}
          </View>
        )}
        {savedSession && (
          <View style={{ marginTop: 16 }}>
            <PracticeCompletion session={savedSession} />
          </View>
        )}
        {savedSession && showExtraFeedback && (
          <View style={{ marginTop: 23 }}>
            <AppText variant="heading">Optional practice feedback</AppText>
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
                    disabled: saving,
                  }}
                  aria-checked={feedback === value}
                  disabled={saving}
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
              readOnly={saving}
              canDiscard={reflectionPractice}
            />
            <Button
              title={error ? "Retry feedback" : "Save feedback"}
              onPress={saveExtraFeedback}
              loading={saving}
              style={{ marginTop: 18 }}
            />
            {!!error && (
              <Notice error>
                Your feedback is still here. Try again to confirm it.
              </Notice>
            )}
          </View>
        )}
        {savedSession && (
          <View style={{ marginTop: 10 }}>
            {!!conversationId && (
              <Button
                title="Continue your conversation"
                variant="secondary"
                onPress={() =>
                  isRecordId(originActionId)
                    ? app.back()
                    : app.navigate(routes.companion, { id: conversationId })
                }
                style={{ marginBottom: 12 }}
              />
            )}
            <Button
              title="See your Journey"
              onPress={() => app.navigate(routes.journey)}
              style={{ marginTop: 12 }}
            />
            {!showExtraFeedback && (
              <Button
                title="Add optional practice feedback"
                variant="ghost"
                onPress={() => setShowExtraFeedback(true)}
              />
            )}
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
            {savedSession.feedback === "Helped" && (
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
                planStep
                  ? "Return to plan"
                  : returnToBuilder
                    ? "Return to Timed Practice"
                    : "Return to Today"
              }
              variant="ghost"
              onPress={
                planStep || returnToBuilder
                  ? app.back
                  : () => app.navigate(routes.today)
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
                ? savedSession
                  ? "Your completed Moment is in Journey. Any unsaved feedback stays here if you keep going."
                  : "This completed Moment hasn't been saved. Leave it here, or go back and save it."
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
              : planStep
                ? "A guided practice from your wellness plan."
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
            environment={soundEnvironment}
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

const momentStyles = StyleSheet.create({
  backRow: { alignSelf: "flex-start", marginBottom: spacing.row },
  flex: { flex: 1, minWidth: 0 },
  prompt: {
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.row,
    gap: spacing.row,
  },
  promptHeader: { justifyContent: "space-between" },
  preview: {
    marginTop: spacing.section,
    padding: spacing.card,
    gap: spacing.row,
    borderWidth: 1,
    borderRadius: 20,
  },
  previewMeta: { paddingTop: 4 },
  previewSteps: { marginBottom: spacing.compact },
  previewStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
    paddingVertical: spacing.compact,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playerScene: { borderWidth: 1, borderRadius: 22, overflow: "hidden" },
  environment: {
    minHeight: 148,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playerTitle: { padding: spacing.card, gap: 5 },
  progress: { marginVertical: spacing.card },
  progressLabels: { justifyContent: "space-between", flexWrap: "wrap" },
  instruction: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.card,
    gap: spacing.compact,
  },
});
