import React, { useEffect, useMemo, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { pickDailyRoutine } from "../routine";
import { recordDay, todayAffirmation } from "../content";
import {
  AppText,
  BrandMark,
  Button,
  Icon,
  MoodStone,
  PauseArtwork,
  Row,
  Screen,
} from "../ui";

function useToday() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}

const pauseCopy = {
  breathing: {
    title: "A little\nbreathing room.",
    detail: "Find a slower rhythm, one breath at a time.",
  },
  grounding: {
    title: "Come back\nto this moment.",
    detail: "A gentle five-senses practice to notice the here and now.",
  },
  reflection: {
    title: "Make room\nfor a thought.",
    detail: "A quiet place for what’s on your mind.",
  },
  resource: {
    title: "A softer\nlanding tonight.",
    detail: "Explore a few small ways to wind down.",
  },
};

export function TodayScreen() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const now = useToday();
  const day = recordDay({ createdAt: now.toISOString() });
  const [showReason, setShowReason] = useState(false);
  const routine = useMemo(
    () => pickDailyRoutine(app.data, app.user, now),
    [app.data, app.user, day],
  );
  const latest = useMemo(
    () =>
      [...app.data.checkins]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .find((item) => recordDay(item) === day),
    [app.data.checkins, day],
  );
  const recent = useMemo(
    () =>
      [...app.data.conversations].sort((a, b) =>
        String(b.updatedAt || b.createdAt).localeCompare(
          String(a.updatedAt || a.createdAt),
        ),
      )[0],
    [app.data.conversations],
  );
  const first = String(app.user?.name || "there")
    .trim()
    .split(/\s+/)[0];
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const next = routine.nextStep;
  const copy = !next
    ? {
        title: "A little space,\nwell spent.",
        detail: "Your pause is complete. Stay a little, if you’d like.",
      }
    : next.id === "checkin"
      ? {
          title: "Begin with\nyou.",
          detail: "Check in, take a moment, and let a thought settle.",
        }
      : next.id === "reflection"
        ? {
            title: "Let a thought\nsettle.",
            detail:
              "Notice how you feel, and what you’d like to carry with you.",
          }
        : pauseCopy[routine.suggestion.activity];
  const cta = !next
    ? "Take a moment"
    : next.id === "checkin"
      ? "Start check-in"
      : next.id === "reflection"
        ? "Start writing"
        : routine.suggestion.activity === "resource"
          ? "Read guide"
          : routine.suggestion.activity === "reflection"
            ? "Start writing"
            : routine.suggestion.activity === "grounding"
              ? "Try grounding"
              : "Breathe";
  useEffect(
    () => setShowReason(false),
    [day, routine.suggestion.activity, next?.id],
  );
  return (
    <Screen style={{ paddingTop: 14 }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <BrandMark size={30} />
        <AppText variant="caption" color={colors.muted}>
          {now.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </AppText>
      </Row>
      <AppText
        variant="display"
        accessibilityRole="header"
        style={{ fontSize: 37, lineHeight: 40 }}
      >
        {greeting},{"\n"}
        {first}.
      </AppText>
      <AppText
        color={colors.muted}
        style={{ marginTop: 7, marginBottom: 23, fontSize: 14 }}
      >
        A little space to come back to yourself.
      </AppText>
      {!!app.pendingWrites.length && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage unsynced writing"
          onPress={() => app.navigate("account")}
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
            padding: 14,
            marginBottom: 22,
            backgroundColor: colors.peachSurface,
            borderRadius: 18,
            minHeight: 52,
          }}
        >
          <Icon name="cloud-upload-outline" color={colors.peachText} />
          <AppText
            variant="caption"
            color={colors.peachText}
            style={{ flex: 1 }}
          >
            {app.pendingWrites.length}{" "}
            {app.pendingWrites.length === 1
              ? "entry waiting"
              : "entries waiting"}{" "}
            to sync.{" "}
            {app.draftProtection === "device"
              ? "Kept on this device."
              : "Keep this preview open."}
          </AppText>
          <Icon name="chevron-forward" color={colors.peachText} size={16} />
        </Pressable>
      )}
      <AppText
        variant="heading"
        accessibilityRole="header"
        style={{ fontSize: 25, lineHeight: 29, marginBottom: 11 }}
      >
        How are you feeling?
      </AppText>
      <View
        style={{
          padding: 5,
          borderRadius: 23,
          backgroundColor: colors.surface,
          borderWidth: resolved === "dark" ? 1 : 0,
          borderColor: colors.border,
        }}
      >
        <Row style={{ gap: 2 }}>
          {["Okay", "Calm", "Low", "Stressed", "Great"].map((mood) => {
            const selected = latest?.mood === mood;
            return (
              <Pressable
                key={mood}
                accessibilityRole="button"
                accessibilityLabel={`Check in: ${mood}${selected ? ". Your last saved mood today" : ""}`}
                onPress={() => app.navigate("checkin", { mood })}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 75,
                  gap: 5,
                  paddingVertical: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  backgroundColor: selected
                    ? colors.peachSurface
                    : pressed
                      ? colors.surface2
                      : "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MoodStone mood={mood} size={31} />
                <AppText
                  variant="caption"
                  color={selected ? colors.peachText : colors.muted}
                  style={{ fontSize: 11 }}
                >
                  {mood}
                </AppText>
                {selected && (
                  <View
                    style={{
                      position: "absolute",
                      top: 7,
                      right: 7,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.peachText,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </Row>
      </View>
      <AppText
        variant="caption"
        color={colors.muted}
        style={{ fontSize: 11, marginTop: 8, marginBottom: 23 }}
      >
        {latest
          ? `Today: ${latest.mood}. It’s okay if that changes.`
          : "Whatever you’re feeling, there’s room for it here."}
      </AppText>
      <Row
        style={{ justifyContent: "space-between", marginBottom: 12, gap: 8 }}
      >
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ fontSize: 28 }}
        >
          Your daily pause
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore Solace Moments"
          onPress={() => app.navigate("moments")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Row style={{ gap: 4 }}>
            <AppText variant="caption" color={colors.muted}>
              Moments
            </AppText>
            <Icon name="arrow-forward" color={colors.muted} size={14} />
          </Row>
        </Pressable>
      </Row>
      <View
        style={{
          backgroundColor: colors.heroSurface,
          borderRadius: 27,
          overflow: "hidden",
          borderWidth: resolved === "dark" ? 1 : 0,
          borderColor: colors.heroBorder,
          ...(resolved === "light"
            ? { boxShadow: "0 9px 25px rgba(76,48,28,0.08)" }
            : {}),
        }}
      >
        <View
          style={{
            minHeight: 264,
            padding: 22,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <PauseArtwork />
          <View style={{ width: "60%", alignItems: "flex-start" }}>
            <AppText
              variant="title"
              style={{ fontSize: 34, lineHeight: 35, letterSpacing: -0.6 }}
            >
              {copy.title}
            </AppText>
            <AppText
              color={colors.heroMuted}
              style={{
                fontSize: 14,
                lineHeight: 21,
                marginTop: 10,
                marginBottom: 16,
              }}
            >
              {copy.detail}
            </AppText>
            <Button
              title={cta}
              icon={
                next?.id === "practice" || !next
                  ? "play-outline"
                  : "arrow-forward"
              }
              onPress={() =>
                next
                  ? app.navigate(next.route, next.params)
                  : app.navigate("breathing", { durationSec: 180 })
              }
              style={{
                minHeight: 46,
                paddingHorizontal: 17,
                alignSelf: "flex-start",
              }}
            />
            {next?.id === "practice" && (
              <AppText
                variant="caption"
                color={colors.heroMuted}
                style={{ marginTop: 8, fontSize: 10.5 }}
              >
                {routine.suggestion.duration} · curated practice
              </AppText>
            )}
          </View>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Your daily pause"
          accessibilityValue={{
            min: 0,
            max: 3,
            now: routine.completedCount,
            text: `${routine.completedCount} of 3 steps recorded today`,
          }}
          aria-valuemin={0}
          aria-valuemax={3}
          aria-valuenow={routine.completedCount}
          aria-valuetext={`${routine.completedCount} of 3 steps recorded today`}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 15,
            backgroundColor: colors.surface,
          }}
        >
          <Row style={{ gap: 0, alignItems: "flex-start" }}>
            {routine.steps.map((step, index) => (
              <View
                key={step.id}
                style={{ flex: 1, alignItems: "center", gap: 6 }}
              >
                {index < 2 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 11,
                      left: "60%",
                      right: "-40%",
                      height: 1,
                      backgroundColor: colors.border,
                    }}
                  />
                )}
                <View
                  style={{
                    width: 23,
                    height: 23,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: step.complete
                      ? colors.primary
                      : colors.surface,
                    borderWidth: step.complete ? 0 : 1,
                    borderColor:
                      step.id === next?.id ? colors.accent : colors.border,
                  }}
                >
                  {step.complete ? (
                    <Icon
                      name="checkmark"
                      size={13}
                      color={colors.primaryText}
                    />
                  ) : (
                    <AppText
                      variant="caption"
                      color={step.id === next?.id ? colors.text : colors.muted}
                      style={{ fontSize: 10, lineHeight: 15 }}
                    >
                      {index + 1}
                    </AppText>
                  )}
                </View>
                <AppText
                  variant="caption"
                  color={
                    step.complete || step.id === next?.id
                      ? colors.text
                      : colors.muted
                  }
                  style={{ fontSize: 10.5, textAlign: "center" }}
                >
                  {step.title}
                </AppText>
              </View>
            ))}
          </Row>
        </View>
      </View>
      {next?.id === "practice" && (
        <View style={{ marginTop: 3 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Why this pause?"
            accessibilityState={{ expanded: showReason }}
            onPress={() => setShowReason((value) => !value)}
            style={{
              minHeight: 44,
              justifyContent: "center",
              alignSelf: "flex-start",
            }}
          >
            <Row style={{ gap: 6 }}>
              <Icon
                name="information-circle-outline"
                size={15}
                color={colors.muted}
              />
              <AppText variant="caption" color={colors.muted}>
                Why this pause?
              </AppText>
              <Icon
                name={showReason ? "chevron-up" : "chevron-down"}
                size={13}
                color={colors.muted}
              />
            </Row>
          </Pressable>
          {showReason && (
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginBottom: 9, lineHeight: 21 }}
            >
              {routine.suggestion.reason}
            </AppText>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          recent
            ? `Continue your conversation: ${recent.title || "Solace"}`
            : "Talk with Solace"
        }
        onPress={() => app.navigate("chat", recent ? { id: recent.id } : {})}
        style={({ pressed }) => ({
          paddingVertical: 24,
          marginTop: 1,
          minHeight: 80,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Row style={{ gap: 13 }}>
          <View
            style={{
              width: 43,
              height: 43,
              borderRadius: 16,
              backgroundColor: colors.sageSurface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="chatbubble-ellipses-outline" color={colors.sageText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="label">A little space to talk</AppText>
            <AppText variant="caption" color={colors.muted} numberOfLines={1}>
              {recent
                ? `Continue: ${recent.title || "your conversation"}`
                : "Start wherever you are."}
            </AppText>
          </View>
          <Icon name="arrow-forward" size={19} color={colors.muted} />
        </Row>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open today’s affirmation"
        onPress={() => app.navigate("affirmation")}
        style={({ pressed }) => ({
          paddingTop: 22,
          paddingBottom: 5,
          borderTopWidth: 0.75,
          borderTopColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Row style={{ alignItems: "flex-start", gap: 16 }}>
          <Icon name="flower-outline" color={colors.accent} size={25} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" style={{ fontSize: 27, lineHeight: 32 }}>
              {todayAffirmation(now)}
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ fontSize: 11, marginTop: 11 }}
            >
              A kind thought for today
            </AppText>
          </View>
        </Row>
      </Pressable>
    </Screen>
  );
}

export { ExploreScreen } from "./Explore";
