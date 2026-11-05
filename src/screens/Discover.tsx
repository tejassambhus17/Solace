import React, { useEffect, useMemo, useState } from "react";
import { AppState, Image, Pressable, View } from "react-native";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { pickDailyRoutine } from "../routine";
import { recordDay } from "../content";
import {
  AppText,
  BrandMark,
  Button,
  Icon,
  MoodPetal,
  moodPetals,
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
    title: "Take a\nmoment",
    detail: "A short, calming reset to find a little more ease.",
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
    <Screen
      style={{ paddingTop: 14, paddingHorizontal: 20, overflow: "hidden" }}
    >
      <View style={{ paddingHorizontal: 8, paddingBottom: 24 }}>
        <Image
          source={require("../../assets/botanical.png")}
          accessible={false}
          accessibilityIgnoresInvertColors
          pointerEvents="none"
          resizeMode="contain"
          resizeMethod="resize"
          fadeDuration={0}
          style={{
            position: "absolute",
            top: -32,
            right: -102,
            width: 272,
            height: 221,
            opacity: resolved === "dark" ? 0.25 : 0.68,
            transform: [{ rotate: "24deg" }],
          }}
        />
        <BrandMark size={39} />
        <AppText
          variant="display"
          accessibilityRole="header"
          style={{ fontSize: 42, lineHeight: 43, marginTop: 35 }}
        >
          {greeting}, {first}.
        </AppText>
        <AppText
          color={colors.muted}
          style={{ maxWidth: 252, marginTop: 9, fontSize: 16, lineHeight: 22 }}
        >
          A quieter, kinder space for your mind.
        </AppText>
      </View>
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
      <View
        style={{
          paddingHorizontal: 13,
          paddingTop: 12,
          paddingBottom: 9,
          borderRadius: 28,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: resolved === "dark" ? colors.border : colors.primaryText,
        }}
      >
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{
            fontSize: 29,
            lineHeight: 32,
            marginLeft: 3,
            marginBottom: 8,
          }}
        >
          How are you feeling?
        </AppText>
        <Row style={{ gap: 0 }}>
          {moodPetals.map(({ mood, image }) => {
            const selected = latest?.mood === mood;
            return (
              <Pressable
                key={mood}
                accessibilityRole="button"
                accessibilityLabel={`Check in: ${mood}${selected ? ". Your last saved mood today" : ""}`}
                onPress={() => app.navigate("checkin", { mood })}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: 69,
                  gap: 3,
                  paddingVertical: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <MoodPetal
                  source={image}
                  style={{ width: "90%", height: 43, maxWidth: 49 }}
                />
                <Row
                  style={{
                    gap: 2,
                    borderRadius: 14,
                    minHeight: 24,
                    maxWidth: "100%",
                    paddingHorizontal: selected ? 4 : 0,
                    backgroundColor: selected
                      ? colors.lavenderSurface
                      : "transparent",
                  }}
                >
                  <AppText
                    variant={selected ? "label" : "caption"}
                    color={selected ? colors.lavenderText : colors.text}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={{ fontSize: 11.5, lineHeight: 18, flexShrink: 1 }}
                  >
                    {mood}
                  </AppText>
                  {selected && (
                    <Icon
                      name="checkmark"
                      color={colors.lavenderText}
                      size={11}
                    />
                  )}
                </Row>
              </Pressable>
            );
          })}
        </Row>
      </View>
      <Row
        style={{
          justifyContent: "space-between",
          marginTop: 9,
          marginBottom: 4,
          paddingHorizontal: 4,
          gap: 8,
        }}
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
          borderRadius: 28,
          overflow: "hidden",
          borderWidth: 1,
          borderColor:
            resolved === "dark" ? colors.heroBorder : colors.primaryText,
        }}
      >
        <View
          style={{
            minHeight: 220,
            paddingHorizontal: 23,
            paddingVertical: 18,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          {resolved === "dark" ? (
            <PauseArtwork />
          ) : (
            <Image
              source={require("../../assets/today-pause-light.jpg")}
              accessible={false}
              accessibilityIgnoresInvertColors
              pointerEvents="none"
              resizeMode="cover"
              resizeMethod="resize"
              fadeDuration={0}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            />
          )}
          <View style={{ width: "66%", alignItems: "flex-start" }}>
            <AppText
              variant="title"
              style={{ fontSize: 38, lineHeight: 37, letterSpacing: -0.8 }}
            >
              {copy.title}
            </AppText>
            <AppText
              color={resolved === "dark" ? colors.heroMuted : colors.text}
              style={{
                fontSize: 15,
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
                minHeight: 44,
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
            paddingVertical: 11,
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
    </Screen>
  );
}

export { ExploreScreen } from "./Explore";
