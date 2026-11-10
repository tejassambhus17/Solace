import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import {
  buildWellnessTasks,
  getGuidedProgram,
  guidedPrograms,
  isWellnessTaskComplete,
  planFocuses,
  planMinutes,
  planTaskActivity,
  wellnessPlanProgress,
  type PlanFocus,
  type PlanMinutes,
  type PlanTask,
  type WellnessPlan,
} from "../../server/src/wellness-plans";
import type { PlanPreview } from "../../server/src/wellness-plan-ai";
import { spacing, useScreenGutter } from "../layout";
import { useGuardedBack, useTabResetGuard } from "../navigation-reset";
import { SceneIntro } from "../NestedDesign";
import { routes } from "../routes";
import { newChatRequestId, useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, IconButton, Input, Screen } from "../ui";

type Program = (typeof guidedPrograms)[number];

const choices = {
  calm: {
    goal: "Feel calmer",
    activity: "Breathing",
    icon: "leaf-outline",
    artwork: require("../../assets/redesign-explore-breathe.jpg"),
  },
  focus: {
    goal: "Find focus",
    activity: "Grounding",
    icon: "locate-outline",
    artwork: require("../../assets/redesign-explore-ground.jpg"),
  },
  sleep: {
    goal: "Wind down",
    activity: "Rest and relaxation",
    icon: "moon-outline",
    artwork: require("../../assets/redesign-explore-sleep.jpg"),
  },
  energy: {
    goal: "Feel energized",
    activity: "Gentle movement",
    icon: "sunny-outline",
    artwork: require("../../assets/today-explore-guided.jpg"),
  },
} as const;

const daylightPlanArt = {
  calm: require("../../assets/redesign-explore-feature-light.jpg"),
  focus: require("../../assets/guided-ground.jpg"),
  sleep: require("../../assets/guided-rest.jpg"),
  energy: require("../../assets/redesign-guided-light.jpg"),
} as const;

const defaultPreferences = [...planFocuses];
const legacyActions = new Set([
  "breathing",
  "reflection",
  "grounding",
  "checkin",
]);

function newestPlan(plans: WellnessPlan[]) {
  return plans.reduce<WellnessPlan | undefined>((latest, plan) => {
    if (!latest) return plan;
    const updated = plan.updatedAt ?? plan.createdAt ?? "";
    return updated > (latest.updatedAt ?? latest.createdAt ?? "")
      ? plan
      : latest;
  }, undefined);
}

function programCommitment(tasks: PlanTask[]) {
  const durations = tasks.map((task) => task.minutes ?? 5);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  return `${tasks.length} days · ${min === max ? min : `${min}–${max}`} min a day`;
}

function PlanPage({
  title,
  subtitle,
  image,
  meta,
  children,
  scrollRef,
}: {
  title: string;
  subtitle: string;
  image?: ImageSourcePropType;
  meta?: string;
  children: React.ReactNode;
  scrollRef?: React.Ref<React.ComponentRef<typeof ScrollView>>;
}) {
  const app = useApp();
  const goBack = useGuardedBack(app.back);
  const { colors } = useTheme();
  const gutter = useScreenGutter();
  return (
    <Screen variant="nested" scrollRef={scrollRef} style={styles.screen}>
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.arrival}>
          <IconButton
            name="chevron-back"
            label="Back"
            appearance="outlined"
            size={48}
            onPress={goBack}
          />
          {image ? (
            <SceneIntro
              image={image}
              title={title}
              description={subtitle}
              meta={meta}
              style={styles.planScene}
            />
          ) : (
            <>
              <AppText variant="display" accessibilityRole="header">
                {title}
              </AppText>
              <AppText color={colors.muted}>{subtitle}</AppText>
            </>
          )}
        </View>
        {children}
      </View>
    </Screen>
  );
}

function PlanChoice({
  label,
  icon,
  selected,
  multiple = false,
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  multiple?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, resolved } = useTheme();
  const light = resolved === "light";
  const selectionInk = light ? colors.accent : colors.sageText;
  const ink = selected ? selectionInk : colors.text;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={multiple ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected
            ? light
              ? colors.lavenderSurface
              : colors.sageSurface
            : colors.surface,
          borderColor: selected ? selectionInk : colors.border,
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {!!icon && <Icon name={icon} color={ink} size={17} />}
      <AppText variant="label" color={ink} style={styles.choiceLabel}>
        {label}
      </AppText>
      {selected && <Icon name="checkmark" color={ink} size={16} />}
    </Pressable>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.formSection}>
      <View>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {description}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function SaveError({ error }: { error: string }) {
  const { colors } = useTheme();
  return error ? (
    <AppText accessibilityRole="alert" color={colors.danger}>
      {error}
    </AppText>
  ) : null;
}

function PlanProgress({ plan }: { plan: WellnessPlan }) {
  const app = useApp();
  const { colors } = useTheme();
  const { completed, total, done } = wellnessPlanProgress(
    plan,
    app.data.sessions,
  );
  return (
    <View
      style={[
        styles.progress,
        { backgroundColor: colors.lavenderSurface, borderColor: colors.border },
      ]}
    >
      <AppText variant="heading" accessibilityRole="header">
        {done
          ? plan.programId
            ? "Program complete"
            : "Plan complete"
          : "Your progress"}
      </AppText>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Completed practices"
        accessibilityValue={{ min: 0, max: total || 1, now: completed }}
        style={styles.progressRail}
      >
        {plan.tasks.map((task, index) => (
          <View
            aria-hidden
            key={task.id ?? index}
            style={[
              styles.progressSegment,
              {
                backgroundColor: isWellnessTaskComplete(
                  plan,
                  task,
                  app.data.sessions,
                )
                  ? colors.lavenderText
                  : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <AppText variant="caption" color={colors.muted}>
        {completed} of {total} practices complete
      </AppText>
    </View>
  );
}

function PlanTimeline({
  plan,
  preview = false,
  onSwap,
  renderLegacyAction,
  renderTitle,
}: {
  plan: WellnessPlan;
  preview?: boolean;
  onSwap?: (index: number, focus: PlanFocus) => void;
  renderLegacyAction?: (task: PlanTask, index: number) => React.ReactNode;
  renderTitle?: (task: PlanTask, index: number) => React.ReactNode;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const [swapping, setSwapping] = useState<number | null>(null);
  const next = plan.tasks.findIndex(
    (task) => !isWellnessTaskComplete(plan, task, app.data.sessions),
  );
  return (
    <View style={styles.formSection}>
      <AppText variant="heading" accessibilityRole="header">
        {preview ? "Your three-day preview" : "Included practices"}
      </AppText>
      <View style={styles.timeline}>
        {plan.tasks.map((task, index) => {
          const completed = isWellnessTaskComplete(
            plan,
            task,
            app.data.sessions,
          );
          const current = !preview && !!plan.startedAt && next === index;
          return (
            <View key={task.id || index} style={styles.dayRow}>
              <View style={styles.dayRail} aria-hidden>
                {index < plan.tasks.length - 1 && (
                  <View
                    style={[styles.dayStem, { backgroundColor: colors.border }]}
                  />
                )}
                <View
                  style={[
                    styles.dayBadge,
                    {
                      backgroundColor:
                        completed || current
                          ? colors.sageSurface
                          : colors.surface2,
                    },
                  ]}
                >
                  {completed ? (
                    <Icon name="checkmark" color={colors.sageText} size={20} />
                  ) : (
                    <AppText
                      variant="label"
                      color={current ? colors.sageText : colors.text}
                    >
                      {index + 1}
                    </AppText>
                  )}
                </View>
              </View>
              <View
                style={[
                  styles.day,
                  {
                    backgroundColor: current
                      ? colors.lavenderSurface
                      : colors.surface,
                    borderColor: current ? colors.lavenderText : colors.border,
                  },
                ]}
              >
                <View style={styles.flexCopy}>
                  <AppText
                    variant="caption"
                    color={
                      completed || current ? colors.sageText : colors.muted
                    }
                  >
                    {`Day ${index + 1}${task.minutes ? ` · ${task.minutes} min` : ""}${completed ? " · Complete" : current ? " · Up next" : ""}`}
                  </AppText>
                  {renderTitle?.(task, index) ?? (
                    <AppText variant="heading">{task.title}</AppText>
                  )}
                  {!!task.description && (
                    <AppText variant="caption" color={colors.muted}>
                      {task.description}
                    </AppText>
                  )}
                </View>
                {renderLegacyAction?.(task, index)}
                {onSwap && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change day ${index + 1} activity`}
                      accessibilityState={{ expanded: swapping === index }}
                      onPress={() =>
                        setSwapping(swapping === index ? null : index)
                      }
                      style={styles.changeDay}
                    >
                      <AppText variant="label" color={colors.sageText}>
                        Change activity
                      </AppText>
                      <Icon
                        name={
                          swapping === index ? "chevron-up" : "chevron-down"
                        }
                        size={17}
                        color={colors.sageText}
                      />
                    </Pressable>
                    {swapping === index && (
                      <View
                        accessibilityRole="radiogroup"
                        style={styles.choices}
                      >
                        {planFocuses.map((focus) => (
                          <PlanChoice
                            key={focus}
                            label={choices[focus].activity}
                            icon={choices[focus].icon}
                            selected={focus === task.focus}
                            onPress={() => {
                              onSwap(index, focus);
                              setSwapping(null);
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PlanExecution({
  plan,
  starting,
  error,
  onStart,
  children,
}: {
  plan: WellnessPlan;
  starting: boolean;
  error: string;
  onStart: () => void;
  children?: React.ReactNode;
}) {
  const app = useApp();
  const { colors } = useTheme();
  const next = plan.tasks.find(
    (task) => !isWellnessTaskComplete(plan, task, app.data.sessions),
  );
  const activity = next && planTaskActivity(next);
  const started = !!plan.startedAt;
  const noun = plan.programId ? "program" : "plan";
  return (
    <>
      {started ? (
        <>
          <PlanProgress plan={plan} />
          {next && activity && plan.id ? (
            <Button
              title={`Resume ${noun}`}
              icon="play"
              onPress={() =>
                app.navigate(routes.momentPlayer, {
                  planId: plan.id,
                  planTaskId: next.id,
                })
              }
            />
          ) : !next ? (
            <Button
              title="View in Journey"
              icon="arrow-forward"
              onPress={() => app.navigate(routes.journey)}
            />
          ) : (
            <SaveError error="This practice is unavailable." />
          )}
          <PlanTimeline plan={plan} />
        </>
      ) : (
        <>
          <PlanTimeline plan={plan} />
          <AppText variant="caption" color={colors.muted}>
            Follow the practices in order, at your own pace. Save each finished
            practice to update your progress.
          </AppText>
          <SaveError error={error} />
          <Button
            title={`Start ${noun}`}
            icon="play"
            loading={starting}
            onPress={onStart}
          />
        </>
      )}
      {children}
    </>
  );
}

function ProgramLibrary({ plans }: { plans: WellnessPlan[] }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  return (
    <PlanPage
      title="Guided Programs"
      subtitle="Follow a ready-made sequence of short practices over a few days."
    >
      <View style={styles.library}>
        {guidedPrograms.map((program) => {
          const saved = plans.find((plan) => plan.programId === program.id);
          const tasks = saved?.tasks ?? program.tasks;
          const progress = saved
            ? wellnessPlanProgress(saved, app.data.sessions)
            : undefined;
          const focus = tasks[0]?.focus ?? "calm";
          const light = resolved === "light";
          return (
            <Pressable
              key={program.id}
              accessibilityRole="button"
              accessibilityLabel={program.title}
              accessibilityHint={
                progress
                  ? `${progress.completed} of ${progress.total} practices complete`
                  : programCommitment(tasks)
              }
              onPress={() =>
                app.navigate(routes.guidedProgram, { id: program.id })
              }
              style={({ pressed }) => [
                styles.program,
                {
                  backgroundColor: pressed ? colors.surface2 : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Image
                source={light ? daylightPlanArt[focus] : choices[focus].artwork}
                style={styles.thumb}
                resizeMode="cover"
                resizeMethod={light ? "scale" : "resize"}
                accessible={false}
                fadeDuration={0}
              />
              <View style={styles.programBody}>
                <View style={styles.programTitle}>
                  <AppText variant="heading" style={styles.flexCopy}>
                    {program.title}
                  </AppText>
                  <Icon
                    name="arrow-forward"
                    size={19}
                    color={colors.lavenderText}
                  />
                </View>
                <AppText variant="caption" color={colors.muted}>
                  {programCommitment(tasks)}
                </AppText>
                <AppText variant="caption" color={colors.muted}>
                  {program.description}
                </AppText>
                {!!progress && (
                  <AppText variant="caption" color={colors.sageText}>
                    {progress.done
                      ? "Complete"
                      : `${progress.completed} of ${progress.total} complete`}
                  </AppText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </PlanPage>
  );
}

function ProgramDetail({
  program,
  saved,
}: {
  program: Program;
  saved?: WellnessPlan;
}) {
  const app = useApp();
  const { resolved } = useTheme();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<string | null>(null);
  const pending = useRef(false);
  const preview: WellnessPlan = {
    type: "wellness",
    programId: program.id,
    title: program.title,
    tasks: program.tasks,
  };
  async function start() {
    if (pending.current || saved?.startedAt) return;
    pending.current = true;
    setStarting(true);
    setError("");
    const startedAt = (request.current ??= new Date().toISOString());
    try {
      await app.save("plans", {
        ...preview,
        id: `program-${program.id}`,
        startedAt,
        createdAt: startedAt,
        updatedAt: startedAt,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t start this program. Try again.",
      );
    } finally {
      pending.current = false;
      setStarting(false);
    }
  }
  const plan = saved ?? preview;
  const focus = plan.tasks[0]?.focus ?? "calm";
  return (
    <PlanPage
      title={program.title}
      subtitle={program.description}
      image={
        resolved === "light" ? daylightPlanArt[focus] : choices[focus].artwork
      }
      meta={programCommitment(plan.tasks)}
    >
      <PlanExecution
        plan={plan}
        starting={starting}
        error={error}
        onStart={() => void start()}
      />
    </PlanPage>
  );
}

function LegacyPlan({
  plan,
  onNewPlan,
}: {
  plan: WellnessPlan;
  onNewPlan: () => void;
}) {
  const app = useApp();
  const [editing, setEditing] = useState<PlanTask[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useTabResetGuard(
    !!editing &&
      editing.some((task, index) => task.title !== plan.tasks[index].title),
  );

  async function save(tasks: PlanTask[]) {
    if (pending.current) return;
    if (tasks.some((task) => !task.title.trim())) {
      setError("Give each practice a title.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await app.save("plans", {
        ...plan,
        tasks,
        updatedAt: new Date().toISOString(),
        completed: tasks.every((task) => !!task.completed),
      });
      setEditing(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t save your changes. Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <PlanProgress plan={plan} />
      <PlanTimeline
        plan={editing ? { ...plan, tasks: editing } : plan}
        renderTitle={
          editing
            ? (task, index) => (
                <Input
                  accessibilityLabel={`Day ${index + 1} activity title`}
                  value={task.title}
                  maxLength={90}
                  editable={!saving}
                  onChangeText={(title) =>
                    setEditing(
                      editing.map((value, i) =>
                        i === index ? { ...value, title } : value,
                      ),
                    )
                  }
                />
              )
            : undefined
        }
        renderLegacyAction={
          !editing
            ? (task, index) => {
                const action = task.action ?? "reflection";
                return (
                  <View style={styles.legacyActions}>
                    {!task.completed && legacyActions.has(action) && (
                      <Button
                        title="Open practice"
                        variant="secondary"
                        disabled={saving}
                        onPress={() => app.navigate(action)}
                      />
                    )}
                    <Button
                      title={
                        task.completed ? "Mark incomplete" : "Mark complete"
                      }
                      variant="ghost"
                      disabled={saving}
                      onPress={() =>
                        void save(
                          plan.tasks.map((value, i) =>
                            i === index
                              ? { ...value, completed: !task.completed }
                              : value,
                          ),
                        )
                      }
                    />
                  </View>
                );
              }
            : undefined
        }
      />
      <SaveError error={error} />
      {editing ? (
        <>
          <Button
            title="Save changes"
            loading={saving}
            onPress={() => void save(editing)}
          />
          <Button
            title="Cancel editing"
            variant="ghost"
            disabled={saving}
            onPress={() => {
              setEditing(null);
              setError("");
            }}
          />
        </>
      ) : (
        <>
          <Button
            title="Create a new plan"
            disabled={saving}
            onPress={onNewPlan}
          />
          <Button
            title="Edit saved plan"
            variant="ghost"
            disabled={saving}
            onPress={() => setEditing(plan.tasks)}
          />
        </>
      )}
    </>
  );
}

function PersonalPlan({
  initial,
  plans,
}: {
  initial?: WellnessPlan;
  plans: WellnessPlan[];
}) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [planId, setPlanId] = useState(initial?.id);
  const saved = plans.find((plan) => plan.id === planId);
  const [view, setView] = useState<"form" | "preview" | "saved">(
    initial ? "saved" : "form",
  );
  const [goal, setGoal] = useState<PlanFocus>(initial?.goal ?? "calm");
  const [preferences, setPreferences] = useState(
    initial?.preferredFocuses ?? defaultPreferences,
  );
  const [minutes, setMinutes] = useState<PlanMinutes>(
    initial?.dailyMinutes ?? 5,
  );
  const [draft, setDraft] = useState<WellnessPlan>();
  const [previewProvider, setPreviewProvider] =
    useState<PlanPreview["provider"]>("offline");
  const [generating, setGenerating] = useState(false);
  const previewRequest = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingSaved, setEditingSaved] = useState(false);
  const pending = useRef(false);
  const nextId = useRef<string | null>(null);
  const startRequest = useRef<{ id: string | undefined; date: string } | null>(
    null,
  );
  const baseline = editingSaved ? saved : undefined;
  const baselinePreferences = baseline?.preferredFocuses ?? defaultPreferences;
  useEffect(() => () => previewRequest.current?.abort(), []);
  useTabResetGuard(
    generating ||
      view === "preview" ||
      (view === "form" &&
        (goal !== (baseline?.goal ?? "calm") ||
          minutes !== (baseline?.dailyMinutes ?? 5) ||
          preferences.length !== baselinePreferences.length ||
          preferences.some((focus) => !baselinePreferences.includes(focus)))),
  );

  function moveTo(next: "form" | "preview" | "saved") {
    setError("");
    setView(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function configure(keepSaved: boolean) {
    setDraft(undefined);
    setEditingSaved(keepSaved);
    if (!keepSaved) nextId.current = null;
    setGoal((keepSaved && saved?.goal) || "calm");
    setPreferences(
      (keepSaved && saved?.preferredFocuses) || defaultPreferences,
    );
    setMinutes((keepSaved && saved?.dailyMinutes) || 5);
    moveTo("form");
  }

  function openPreview(preview: PlanPreview) {
    const now = new Date().toISOString();
    const id =
      baseline?.id ?? (nextId.current ??= `plan-${newChatRequestId()}`);
    setDraft({
      id,
      type: "wellness",
      title: "Your three-day wellness plan",
      goal,
      preferredFocuses: preferences,
      dailyMinutes: minutes,
      tasks: preview.tasks,
      createdAt: baseline?.createdAt ?? now,
      updatedAt: now,
    });
    setPreviewProvider(preview.provider);
    moveTo("preview");
  }

  async function generate() {
    if (previewRequest.current || !preferences.length) return;
    const request = new AbortController();
    previewRequest.current = request;
    setGenerating(true);
    setError("");
    try {
      const preview = await app.generatePlanPreview(
        { goal, preferredFocuses: preferences, dailyMinutes: minutes },
        request.signal,
      );
      if (!request.signal.aborted) openPreview(preview);
    } catch (failure) {
      if (!request.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Couldn’t prepare your plan. Try again.",
        );
    } finally {
      previewRequest.current = null;
      if (!request.signal.aborted) setGenerating(false);
    }
  }

  async function persist(plan: WellnessPlan, start = false) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      if (start && startRequest.current?.id !== plan.id) {
        startRequest.current = { id: plan.id, date: new Date().toISOString() };
      }
      const startedAt = startRequest.current?.date;
      const record = await app.save(
        "plans",
        start ? { ...plan, startedAt, updatedAt: startedAt } : plan,
      );
      setPlanId(record.id);
      setDraft(undefined);
      setEditingSaved(false);
      moveTo("saved");
      app.setParams({ id: record.id });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t save your plan. Try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const legacy = !!saved && !saved.dailyMinutes;
  const subtitle =
    view === "saved" && saved
      ? legacy
        ? "Reopen the plan and progress you already saved."
        : `${saved.dailyMinutes} minutes a day for three days, at your own pace.`
      : view === "preview"
        ? "Review the sequence and change any activity before saving."
        : "Choose what would help and how much time you can make over the next three days.";
  const artFocus = view === "saved" ? (saved?.goal ?? "calm") : goal;
  return (
    <PlanPage
      title="Your Wellness Plan"
      subtitle={subtitle}
      scrollRef={scroll}
      image={
        resolved === "light"
          ? view === "form"
            ? daylightPlanArt.energy
            : daylightPlanArt[artFocus]
          : view === "form"
            ? undefined
            : choices[artFocus].artwork
      }
    >
      {view === "form" && (
        <>
          <FormSection
            title="Your goal"
            description="What would you like to make space for?"
          >
            <View accessibilityRole="radiogroup" style={styles.choices}>
              {planFocuses.map((focus) => (
                <PlanChoice
                  key={focus}
                  label={choices[focus].goal}
                  icon={choices[focus].icon}
                  selected={focus === goal}
                  disabled={generating}
                  onPress={() => setGoal(focus)}
                />
              ))}
            </View>
          </FormSection>
          <FormSection
            title="Activities you like"
            description="Keep the practice types you’d like to include."
          >
            <View accessibilityRole="group" style={styles.choices}>
              {planFocuses.map((focus) => (
                <PlanChoice
                  key={focus}
                  label={choices[focus].activity}
                  icon={choices[focus].icon}
                  multiple
                  selected={preferences.includes(focus)}
                  disabled={generating}
                  onPress={() =>
                    setPreferences((selected) =>
                      selected.includes(focus)
                        ? selected.filter((value) => value !== focus)
                        : [...selected, focus],
                    )
                  }
                />
              ))}
            </View>
          </FormSection>
          <FormSection
            title="Time each day"
            description="Pick an amount that feels manageable."
          >
            <View accessibilityRole="radiogroup" style={styles.choices}>
              {planMinutes.map((value) => (
                <PlanChoice
                  key={value}
                  label={`${value} min`}
                  selected={minutes === value}
                  disabled={generating}
                  onPress={() => setMinutes(value)}
                />
              ))}
            </View>
          </FormSection>
          <Button
            title="Generate my plan"
            icon="arrow-forward"
            disabled={!preferences.length}
            loading={generating}
            onPress={() => void generate()}
          />
          <SaveError error={error} />
          {!!error && !!preferences.length && (
            <Button
              title="Preview a built-in plan"
              variant="secondary"
              onPress={() =>
                openPreview({
                  provider: "offline",
                  tasks: buildWellnessTasks(goal, preferences, minutes),
                })
              }
            />
          )}
          {!!saved && (
            <Button
              title="Back to saved plan"
              variant="ghost"
              disabled={generating}
              onPress={() => moveTo("saved")}
            />
          )}
        </>
      )}
      {view === "preview" && draft && (
        <>
          <AppText
            variant="label"
            color={colors.sageText}
          >{`${choices[goal].goal} · ${minutes} min a day · ${previewProvider === "live" ? "AI-assisted" : "Built-in"}`}</AppText>
          <PlanTimeline
            plan={draft}
            preview
            onSwap={
              saving
                ? undefined
                : (index, focus) => {
                    const replacement = buildWellnessTasks(
                      focus,
                      [focus],
                      minutes,
                    )[0];
                    setDraft({
                      ...draft,
                      tasks: draft.tasks.map((task, i) =>
                        i === index ? { ...replacement, id: task.id } : task,
                      ),
                    });
                  }
            }
          />
          <SaveError error={error} />
          <Button
            title="Save plan"
            loading={saving}
            onPress={() => void persist(draft)}
          />
          <Button
            title="Change preferences"
            variant="ghost"
            disabled={saving}
            onPress={() => moveTo("form")}
          />
        </>
      )}
      {view === "saved" &&
        saved &&
        (legacy ? (
          <LegacyPlan
            key={saved.id}
            plan={saved}
            onNewPlan={() => configure(false)}
          />
        ) : (
          <PlanExecution
            plan={saved}
            starting={saving}
            error={error}
            onStart={() => void persist(saved, true)}
          >
            {saved.startedAt ? (
              <Button
                title="Create a new plan"
                variant="ghost"
                onPress={() => configure(false)}
              />
            ) : (
              <Button
                title="Edit plan"
                variant="ghost"
                disabled={saving}
                onPress={() => configure(true)}
              />
            )}
          </PlanExecution>
        ))}
      {view === "saved" && !saved && (
        <Button title="Create a new plan" onPress={() => configure(false)} />
      )}
    </PlanPage>
  );
}

export function WellnessPlansScreen({ name }: { name: string }) {
  const app = useApp();
  const plans = app.data.plans.filter(
    (plan): plan is typeof plan & WellnessPlan =>
      plan.type === "wellness" && Array.isArray(plan.tasks),
  );
  if (name === routes.guidedPrograms) return <ProgramLibrary plans={plans} />;
  if (name === routes.guidedProgram) {
    const program = getGuidedProgram(app.params.id);
    return program ? (
      <ProgramDetail
        key={program.id}
        program={program}
        saved={plans.find((plan) => plan.programId === program.id)}
      />
    ) : (
      <PlanPage
        title="Program unavailable"
        subtitle="Choose a program from the library to continue."
      >
        <Button
          title="Browse programs"
          onPress={() => app.navigate(routes.guidedPrograms)}
        />
      </PlanPage>
    );
  }
  const personalPlans = plans.filter((plan) => !plan.programId);
  const initial = app.params.id
    ? personalPlans.find((plan) => plan.id === app.params.id)
    : newestPlan(personalPlans);
  return (
    <PersonalPlan
      key={app.params.id ?? "personal"}
      initial={initial}
      plans={personalPlans}
    />
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: spacing.row },
  body: { gap: spacing.section },
  arrival: { gap: spacing.row },
  planScene: { marginBottom: 0 },
  formSection: { gap: spacing.row },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.compact },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.row,
    paddingVertical: spacing.compact,
    minHeight: 48,
    maxWidth: "100%",
    borderRadius: 16,
    borderWidth: 1,
  },
  choiceLabel: { flexShrink: 1 },
  progress: {
    gap: spacing.compact,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.card,
  },
  progressRail: { height: 6, flexDirection: "row", gap: 4 },
  progressSegment: { flex: 1, borderRadius: 4 },
  timeline: { gap: spacing.row },
  day: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.row,
    gap: spacing.compact,
  },
  dayRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.row },
  dayRail: { width: 38, alignItems: "center" },
  dayStem: { position: "absolute", width: 1, top: 22, bottom: -spacing.row },
  dayBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  flexCopy: { flex: 1, minWidth: 0, gap: 3 },
  changeDay: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.compact,
  },
  library: { gap: spacing.row },
  program: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: 106 },
  programBody: { padding: spacing.card, gap: 4 },
  programTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  legacyActions: { gap: spacing.compact },
});
