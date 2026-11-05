import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, Switch, View } from "react-native";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  Icon,
  Input,
  MoodStone,
  Row,
  Screen,
  SectionTitle,
} from "../ui";
import { Companion } from "../Companion";
import { localDay, recordDay } from "../content";
import { weeklyReview } from "../insights";
import {
  adjacentCalendarDay,
  calendarMonth,
  entriesOnDay,
  goalProgress,
  journeySummary,
  type DayEntry,
} from "../progress";

const formatDay = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const sectionStyle = { paddingTop: 25, marginTop: 23, borderTopWidth: 0.75 };
type JourneySection = "goal" | "reflection" | "streaks";

function HistoryEntry({ entry }: { entry: DayEntry }) {
  const app = useApp();
  const { colors } = useTheme();
  const { record, collection } = entry;
  const title =
    collection === "checkins"
      ? `${record.mood || "Saved"} check-in`
      : collection === "sessions"
        ? record.title || record.activity?.title || "A moment for you"
        : collection === "reflections"
          ? "A saved reflection"
          : record.title || "A reflective check-in";
  const icon =
    collection === "checkins"
      ? "sunny-outline"
      : collection === "sessions"
        ? "leaf-outline"
        : collection === "reflections"
          ? "create-outline"
          : "clipboard-outline";
  const detail =
    collection === "sessions"
      ? `${record.completed === true ? "Completed" : "Ended early"}${record.feedback ? ` · ${record.feedback === "skipped" ? "No helpfulness rating" : record.feedback}` : ""}`
      : collection === "checkins"
        ? record.note || "Your own check-in, in your own words."
        : collection === "reflections"
          ? record.text ||
            record.content ||
            record.note ||
            "Open your reflection"
          : "A self-reported reflection, not a diagnosis.";
  const subtitle = record.localOnly ? `Waiting to sync. ${detail}` : detail;
  const open =
    collection === "sessions"
      ? () => app.navigate("session-detail", { id: record.id })
      : collection === "reflections"
        ? () => app.navigate("reflection-detail", { id: record.id })
        : collection === "assessments"
          ? () =>
              app.navigate("assessment-result", {
                id: record.id,
                type: record.assessmentType || record.type,
              })
          : undefined;
  return (
    <Pressable
      accessibilityRole={open ? "button" : undefined}
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={!open}
      onPress={open}
      style={({ pressed }) => ({
        paddingVertical: 14,
        borderBottomWidth: 0.75,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Row style={{ alignItems: "flex-start" }}>
        <View style={{ width: 34, paddingTop: 2 }}>
          <Icon name={icon} size={21} color={colors.muted} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption" color={colors.muted} numberOfLines={3}>
            {subtitle}
          </AppText>
        </View>
        {open && <Icon name="chevron-forward" size={17} color={colors.muted} />}
      </Row>
    </Pressable>
  );
}

export function JourneyScreen() {
  const app = useApp();
  const { colors } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [browsedDay, setBrowsedDay] = useState<string | null>(null);
  const today = localDay(now);
  const selectedDay = browsedDay && browsedDay < today ? browsedDay : today;
  const monthKey = selectedDay.slice(0, 7);
  const month = useMemo(() => new Date(`${monthKey}-01T12:00:00`), [monthKey]);
  const previousDay = adjacentCalendarDay(selectedDay, -1, now);
  const nextDay = adjacentCalendarDay(selectedDay, 1, now);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("Make a little time for myself");
  const [goalMinutes, setGoalMinutes] = useState("15");
  const [busy, setBusy] = useState<JourneySection | null>(null);
  const [status, setStatus] = useState<{
    section: JourneySection;
    message: string;
    error?: boolean;
  } | null>(null);
  const [reflection, setReflection] = useState<{
    provider: string;
    reflection: string;
    explanation: string;
    period: { start: string; end: string };
  } | null>(null);
  const lock = useRef(false);
  const account = useRef(app.user?.id);
  account.current = app.user?.id;
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    setReflection(null);
    setBusy(null);
    setStatus(null);
    setCelebration(null);
    setEditingGoal(false);
  }, [app.user?.id]);
  const summary = useMemo(() => journeySummary(app.data, now), [app.data, now]);
  const week = useMemo(
    () => weeklyReview(summary.records, now),
    [summary.records, now],
  );
  const calendar = useMemo(
    () => calendarMonth(month.getFullYear(), month.getMonth(), app.data, now),
    [month, app.data, now],
  );
  const entries = useMemo(
    () => entriesOnDay(app.data, selectedDay, now),
    [app.data, selectedDay, now],
  );
  const preferences = app.data.preferences?.find(
    (item) => item.id === "wellness",
  );
  const goal =
    app.data.goals?.find((item) => item.active !== false) ||
    app.data.goals?.[0];
  const goalValue = goalProgress(
    goal?.targetMinutesPerWeek,
    summary.weeklySeconds,
  );
  const selectedMood = summary.records.checkins.find(
    (item) => recordDay(item) === selectedDay,
  )?.mood;

  function showStatus(section: JourneySection) {
    return status?.section === section ? (
      <AppText
        accessibilityLiveRegion="polite"
        color={status.error ? colors.danger : colors.muted}
        style={{ marginTop: 10 }}
      >
        {status.message}
      </AppText>
    ) : null;
  }
  function selectDay(day: string) {
    setBrowsedDay(day === today ? null : day);
    setShowAllEntries(false);
  }
  async function perform(section: JourneySection, work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(section);
    setStatus(null);
    const owner = account.current;
    try {
      await work();
    } catch (e) {
      if (owner === account.current)
        setStatus({
          section,
          error: true,
          message:
            e instanceof Error
              ? e.message
              : "Something went wrong. Please try again.",
        });
    } finally {
      lock.current = false;
      if (owner === account.current) setBusy(null);
    }
  }
  function editGoal() {
    setGoalTitle(goal?.title || "Make a little time for myself");
    setGoalMinutes(String(goal?.targetMinutesPerWeek || 15));
    setEditingGoal(true);
    setStatus(null);
  }
  async function saveGoal() {
    const target = Number(goalMinutes);
    if (
      !goalTitle.trim() ||
      !/^\d{1,3}$/.test(goalMinutes) ||
      target < 5 ||
      target > 210
    ) {
      setStatus({
        section: "goal",
        error: true,
        message: "Give your goal a name and choose 5–210 minutes for the week.",
      });
      return;
    }
    const owner = account.current;
    await perform("goal", async () => {
      await app.save("goals", {
        ...(goal || { id: "personal-weekly-goal" }),
        title: goalTitle.trim(),
        targetMinutesPerWeek: target,
        active: goal?.active !== false,
      });
      if (owner === account.current) {
        setEditingGoal(false);
        setStatus({ section: "goal", message: "Your goal is saved." });
      }
    });
  }
  async function setStreaks(value: boolean) {
    await perform("streaks", async () => {
      await app.save("preferences", {
        environment: "forest",
        ambientEnabled: false,
        ...preferences,
        id: "wellness",
        streaksEnabled: value,
      });
    });
  }
  async function createReflection() {
    const owner = account.current;
    await perform("reflection", async () => {
      const result = await app.weeklyReflection(localDay(now));
      if (owner === account.current) setReflection(result);
    });
  }

  return (
    <Screen>
      <AppText variant="title">Your journey</AppText>
      <AppText color={colors.muted} style={{ marginTop: 8, marginBottom: 20 }}>
        The moments you’ve made for yourself.
      </AppText>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 0.75,
          borderColor: colors.border,
          padding: 12,
        }}
      >
        <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: !previousDay }}
            disabled={!previousDay}
            onPress={() => previousDay && selectDay(previousDay)}
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
              opacity: previousDay ? 1 : 0.25,
            }}
          >
            <Icon name="chevron-back" />
          </Pressable>
          <AppText variant="heading" style={{ fontSize: 25 }}>
            {month.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: !nextDay }}
            disabled={!nextDay}
            onPress={() => nextDay && selectDay(nextDay)}
            style={{
              minWidth: 44,
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
              opacity: nextDay ? 1 : 0.25,
            }}
          >
            <Icon name="chevron-forward" />
          </Pressable>
        </Row>
        <Row style={{ gap: 0, marginBottom: 3 }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <View
              key={index}
              style={{ width: `${100 / 7}%`, alignItems: "center" }}
            >
              <AppText variant="caption" color={colors.muted}>
                {day}
              </AppText>
            </View>
          ))}
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendar.map((day, index) => (
            <View
              key={day?.key || `empty-${index}`}
              style={{ width: `${100 / 7}%`, padding: 1 }}
            >
              {day ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDay(day.key)}. ${day.count ? `${day.count} saved ${day.count === 1 ? "entry" : "entries"}${day.mood ? `. Mood: ${day.mood}` : ""}` : "No saved entries"}`}
                  accessibilityState={{
                    selected: day.key === selectedDay,
                    disabled: day.future,
                  }}
                  disabled={day.future}
                  onPress={() => selectDay(day.key)}
                  style={({ pressed }) => ({
                    minHeight: 46,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    backgroundColor:
                      day.key === selectedDay
                        ? colors.primary
                        : day.count
                          ? colors.surface2
                          : "transparent",
                    opacity: day.future ? 0.28 : pressed ? 0.65 : 1,
                  })}
                >
                  <AppText
                    variant={day.key === selectedDay ? "label" : "caption"}
                    color={
                      day.key === selectedDay ? colors.primaryText : colors.text
                    }
                  >
                    {day.day}
                  </AppText>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: day.count
                        ? day.key === selectedDay
                          ? colors.primaryText
                          : colors.primary
                        : "transparent",
                    }}
                  />
                </Pressable>
              ) : (
                <View style={{ height: 46 }} />
              )}
            </View>
          ))}
        </View>
        <Row style={{ justifyContent: "space-between", minHeight: 44 }}>
          <AppText variant="caption" color={colors.muted}>
            Dots mark saved entries.
          </AppText>
          {selectedDay !== today && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to today in the calendar"
              onPress={() => selectDay(today)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <AppText variant="label" color={colors.primary}>
                Today
              </AppText>
            </Pressable>
          )}
        </Row>
      </View>

      <View style={{ marginTop: 24 }}>
        <Row
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="heading">
              {selectedDay === today ? "Today, so far" : formatDay(selectedDay)}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
              {entries.some((entry) => entry.record.localOnly)
                ? " · some waiting to sync"
                : " saved"}
            </AppText>
          </View>
          {selectedMood && <MoodStone mood={String(selectedMood)} size={32} />}
        </Row>
        {entries.length ? (
          <>
            {(showAllEntries ? entries : entries.slice(0, 5)).map((entry) => (
              <HistoryEntry key={entry.key} entry={entry} />
            ))}
            {entries.length > 5 && (
              <Button
                title={
                  showAllEntries
                    ? "Show fewer entries"
                    : `Show all ${entries.length} entries`
                }
                variant="ghost"
                onPress={() => setShowAllEntries(!showAllEntries)}
              />
            )}
          </>
        ) : (
          <View style={{ paddingVertical: 18 }}>
            <AppText color={colors.muted}>
              {selectedDay === today
                ? "A blank space can be a beginning. Check in or take a small pause when you want to."
                : "Nothing was saved on this day. There is no catching up to do."}
            </AppText>
            {selectedDay === today && (
              <Button
                title="Take a Moment"
                variant="secondary"
                icon="leaf-outline"
                onPress={() => app.navigate("moments")}
                style={{ marginTop: 16 }}
              />
            )}
          </View>
        )}
      </View>

      <View style={[sectionStyle, { borderColor: colors.border }]}>
        <SectionTitle
          title="Your week, gently"
          subtitle={`${dateLabel(`${week.startDay}T12:00:00`)} – ${dateLabel(`${week.endDay}T12:00:00`)}`}
        />
        <AppText style={{ lineHeight: 25 }}>
          {week.daysCheckedIn} {week.daysCheckedIn === 1 ? "day" : "days"}{" "}
          checked in · {week.completedMoments} completed{" "}
          {week.completedMoments === 1 ? "moment" : "moments"} ·{" "}
          {summary.weeklyMinutes}{" "}
          {summary.weeklyMinutes === 1 ? "minute" : "minutes"} in completed
          practices
        </AppText>
        <Row style={{ flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          {week.moods
            .filter((item) => item.count > 0)
            .map((item) => (
              <Row key={item.mood} style={{ gap: 5 }}>
                <MoodStone mood={item.mood} size={20} />
                <AppText variant="caption">
                  {item.mood} · {item.count}
                </AppText>
              </Row>
            ))}
        </Row>
        <AppText
          variant="caption"
          color={colors.muted}
          style={{ marginTop: 13 }}
        >
          {week.supportiveMoments
            ? `You marked ${week.supportiveMoments} completed ${week.supportiveMoments === 1 ? "moment" : "moments"} as helpful or a little helpful.`
            : "Helpfulness comes from your optional feedback. No mood or health outcome is inferred."}
        </AppText>
        <Button
          title={
            reflection
              ? "Refresh weekly reflection"
              : "Create weekly reflection"
          }
          icon="sparkles-outline"
          variant="secondary"
          loading={busy === "reflection"}
          disabled={!!busy}
          onPress={createReflection}
          style={{ marginTop: 18 }}
        />
        {showStatus("reflection")}
        {reflection && (
          <View
            accessibilityLiveRegion="polite"
            style={{ marginTop: 20, gap: 9 }}
          >
            <AppText variant="label">
              {reflection.provider === "live"
                ? "AI-assisted reflection"
                : "Recorded summary · Live AI is off"}
            </AppText>
            <AppText>{reflection.reflection}</AppText>
            <AppText variant="caption" color={colors.muted}>
              {reflection.explanation}
            </AppText>
            <AppText variant="caption" color={colors.muted}>
              Based on saved entries from {formatDay(reflection.period.start)}{" "}
              to {formatDay(reflection.period.end)} when created. This is a
              wellness reflection, not a clinical assessment.
            </AppText>
          </View>
        )}
        <Button
          title="Write your own reflection"
          variant="ghost"
          icon="create-outline"
          onPress={() =>
            app.navigate("reflection", { prompt: week.suggestedPrompt })
          }
          style={{ marginTop: 7 }}
        />
      </View>

      <View style={[sectionStyle, { borderColor: colors.border }]}>
        <SectionTitle
          title="A goal, on your terms"
          subtitle="An invitation you can change. Never a requirement."
        />
        {goal && !editingGoal && (
          <View style={{ gap: 10 }}>
            <AppText variant="label">{goal.title}</AppText>
            <AppText color={colors.muted}>
              {summary.weeklyMinutes} of {goalValue.target} minutes in completed
              practices in the last seven days.
            </AppText>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Weekly personal goal"
              aria-valuemin={0}
              aria-valuemax={goalValue.target * 60}
              aria-valuenow={Math.min(
                summary.weeklySeconds,
                goalValue.target * 60,
              )}
              aria-valuetext={`${summary.weeklyMinutes} of ${goalValue.target} minutes`}
              accessibilityValue={{
                min: 0,
                max: goalValue.target * 60,
                now: Math.min(summary.weeklySeconds, goalValue.target * 60),
                text: `${summary.weeklyMinutes} of ${goalValue.target} minutes`,
              }}
              style={{
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: 5,
                  backgroundColor: colors.primary,
                  width: `${goalValue.fraction * 100}%`,
                }}
              />
            </View>
            {goal.active === false && (
              <AppText variant="caption" color={colors.muted}>
                This goal is paused. Return whenever it feels useful.
              </AppText>
            )}
            {goalValue.reached && (
              <AppText variant="caption" color={colors.sageText}>
                You made the time you chose. Anything more is optional.
              </AppText>
            )}
            <Row style={{ flexWrap: "wrap" }}>
              <Button
                title="Change goal"
                variant="ghost"
                disabled={!!busy}
                onPress={editGoal}
              />
              <Button
                title={goal.active === false ? "Resume goal" : "Pause goal"}
                variant="ghost"
                disabled={!!busy}
                onPress={() =>
                  perform("goal", async () => {
                    await app.save("goals", {
                      ...goal,
                      active: goal.active === false,
                    });
                  })
                }
              />
            </Row>
          </View>
        )}
        {!goal && !editingGoal && (
          <Button
            title="Set a personal goal"
            variant="secondary"
            icon="add"
            onPress={editGoal}
          />
        )}
        {editingGoal && (
          <View style={{ gap: 12 }}>
            <AppText variant="label">
              What would you like to make room for?
            </AppText>
            <Input
              accessibilityLabel="Personal goal name"
              value={goalTitle}
              onChangeText={setGoalTitle}
              maxLength={120}
              editable={!busy}
            />
            <AppText variant="label">Minutes over seven days</AppText>
            <Input
              accessibilityLabel="Weekly goal minutes"
              value={goalMinutes}
              onChangeText={setGoalMinutes}
              keyboardType="number-pad"
              maxLength={3}
              editable={!busy}
            />
            <Row style={{ flexWrap: "wrap" }}>
              {[5, 15, 30, 60].map((minutes) => (
                <Pressable
                  key={minutes}
                  accessibilityRole="button"
                  accessibilityLabel={`${minutes} minute goal`}
                  accessibilityState={{
                    selected: Number(goalMinutes) === minutes,
                    disabled: !!busy,
                  }}
                  disabled={!!busy}
                  onPress={() => setGoalMinutes(String(minutes))}
                  style={{
                    minWidth: 52,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 22,
                    backgroundColor:
                      Number(goalMinutes) === minutes
                        ? colors.primary
                        : colors.surface2,
                  }}
                >
                  <AppText
                    color={
                      Number(goalMinutes) === minutes
                        ? colors.primaryText
                        : colors.text
                    }
                  >
                    {minutes}
                  </AppText>
                </Pressable>
              ))}
            </Row>
            <Row>
              <Button
                title="Save goal"
                loading={busy === "goal"}
                disabled={!!busy}
                onPress={saveGoal}
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={!!busy}
                onPress={() => {
                  setEditingGoal(false);
                  setStatus(null);
                }}
              />
            </Row>
          </View>
        )}
        {showStatus("goal")}
      </View>

      <View style={[sectionStyle, { borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showMilestones }}
          onPress={() => {
            setShowMilestones(!showMilestones);
            setCelebration(null);
          }}
          style={{ minHeight: 48 }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">Little milestones</AppText>
              <AppText variant="caption" color={colors.muted}>
                A record of what you have actually saved.
              </AppText>
            </View>
            <Icon name={showMilestones ? "chevron-up" : "chevron-down"} />
          </Row>
        </Pressable>
        {showMilestones && (
          <View style={{ marginTop: 20 }}>
            <Row style={{ justifyContent: "space-between", marginBottom: 18 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">Show check-in streaks</AppText>
                <AppText variant="caption" color={colors.muted}>
                  Optional. Quiet days never erase your history.
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Show check-in streaks"
                value={preferences?.streaksEnabled === true}
                disabled={!!busy}
                onValueChange={setStreaks}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={
                  preferences?.streaksEnabled
                    ? colors.primaryText
                    : colors.muted
                }
              />
            </Row>
            {showStatus("streaks")}
            {preferences?.streaksEnabled === true && (
              <AppText color={colors.muted} style={{ marginBottom: 13 }}>
                {summary.streak
                  ? `${summary.streak} consecutive check-in ${summary.streak === 1 ? "day" : "days"}, including today or yesterday.`
                  : "Whenever you return, a new rhythm can begin."}
              </AppText>
            )}
            {summary.milestones.map((milestone) => (
              <View key={milestone.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${milestone.title}. ${milestone.earned ? "Earned" : `${Math.min(milestone.value, milestone.target)} of ${milestone.target}`}. ${milestone.description}`}
                  disabled={!milestone.earned}
                  onPress={() =>
                    setCelebration(
                      celebration === milestone.id ? null : milestone.id,
                    )
                  }
                  style={{
                    paddingVertical: 16,
                    borderBottomWidth: 0.75,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Row>
                    <Icon
                      name={
                        milestone.earned
                          ? "checkmark-circle-outline"
                          : milestone.icon
                      }
                      color={milestone.earned ? colors.primary : colors.muted}
                      size={25}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label">{milestone.title}</AppText>
                      <AppText variant="caption" color={colors.muted}>
                        {milestone.description}
                      </AppText>
                    </View>
                    <AppText variant="caption" color={colors.muted}>
                      {milestone.earned
                        ? "Earned"
                        : `${Math.min(milestone.value, milestone.target)}/${milestone.target}`}
                    </AppText>
                  </Row>
                </Pressable>
                {celebration === milestone.id && milestone.earned && (
                  <Row style={{ paddingVertical: 14, alignItems: "center" }}>
                    <Companion state="happy" size={70} />
                    <AppText style={{ flex: 1 }}>
                      A little space you made for yourself. Your saved activity
                      earned this milestone.
                    </AppText>
                  </Row>
                )}
              </View>
            ))}
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 17 }}
            >
              {summary.completedCount} completed{" "}
              {summary.completedCount === 1 ? "moment" : "moments"} ·{" "}
              {summary.minutes} recorded{" "}
              {summary.minutes === 1 ? "minute" : "minutes"} ·{" "}
              {summary.reflectionCount} saved{" "}
              {summary.reflectionCount === 1 ? "reflection" : "reflections"}.
              These describe participation, never wellbeing.
            </AppText>
          </View>
        )}
      </View>

      <View style={[sectionStyle, { borderColor: colors.border }]}>
        <SectionTitle title="Keep exploring your story" />
        {[
          {
            title: "Reflections",
            subtitle: `${summary.reflectionCount} saved ${summary.reflectionCount === 1 ? "reflection" : "reflections"}`,
            icon: "create-outline",
            route: "reflections",
          },
          {
            title: "Saved affirmations",
            subtitle: "Kind words you chose to keep",
            icon: "heart-outline",
            route: "saved-affirmations",
          },
          {
            title: "Reflective check-ins",
            subtitle: `${app.data.assessments.length} saved assessments · never a diagnosis`,
            icon: "clipboard-outline",
            route: "assessments",
          },
        ].map((link) => (
          <Pressable
            key={link.route}
            accessibilityRole="button"
            onPress={() => app.navigate(link.route)}
            style={{
              paddingVertical: 17,
              borderBottomWidth: 0.75,
              borderBottomColor: colors.border,
            }}
          >
            <Row>
              <Icon name={link.icon} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{link.title}</AppText>
                <AppText variant="caption" color={colors.muted}>
                  {link.subtitle}
                </AppText>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Row>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
