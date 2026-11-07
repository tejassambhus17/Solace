import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Image,
  Modal,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useReducedMotion } from "./Companion";
import {
  journeyAnalytics,
  nextMilestoneCelebration,
} from "./journey-analytics";
import { spacing } from "./layout";
import { useApp } from "./store";
import { useTheme } from "./theme";
import { AppText, Button, coverImageStyle, Icon } from "./ui";

type Milestone = ReturnType<typeof journeyAnalytics>["milestones"][number];

export function MilestoneArt({
  id,
  icon,
  earned,
  size = 128,
}: {
  id: string;
  icon: string;
  earned: boolean;
  size?: number;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const rose = id === "three-day-streak" || id === "five-pauses";
  const sunrise = id === "weekly-reflection" || id === "seven-checkins";
  const mountain = id === "seven-day-streak";
  const lotus = id === "first-moment";
  const image =
    lotus || rose
      ? dark
        ? require("../assets/dark-petal.png")
        : require("../assets/petal.png")
      : mountain
        ? dark
          ? require("../assets/profile-mountains-dark.jpg")
          : require("../assets/profile-mountains-light.jpg")
        : sunrise
          ? dark
            ? require("../assets/today-twilight-lotus.jpg")
            : require("../assets/redesign-today-scene-light.jpg")
          : require("../assets/botanical.png");
  const background = rose
    ? colors.peachSurface
    : sunrise
      ? colors.lavenderSurface
      : colors.sageSurface;
  return (
    <View
      accessible={false}
      aria-hidden
      style={[
        styles.art,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: earned ? background : colors.surface2,
        },
      ]}
    >
      {earned && (
        <Image
          accessible={false}
          source={image}
          resizeMode={lotus || rose ? "contain" : "cover"}
          style={[coverImageStyle, { opacity: lotus || rose ? 1 : 0.68 }]}
        />
      )}
      {(!earned || (!lotus && !rose)) && (
        <View
          style={[
            styles.artSymbol,
            {
              backgroundColor: colors.surface,
              width: size * 0.48,
              height: size * 0.48,
              borderRadius: size * 0.24,
            },
          ]}
        >
          <Icon
            name={earned ? icon : "lock-closed-outline"}
            size={Math.round(size * 0.27)}
            color={earned ? colors.primary : colors.muted}
          />
        </View>
      )}
    </View>
  );
}

function Celebration({
  milestone,
  onClose,
}: {
  milestone: Milestone;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(
    () => !AppState.currentState || AppState.currentState === "active",
  );
  const [reveal] = useState(() => new Animated.Value(1));
  const revealed = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (revealed.current || reduced || !foreground) {
      revealed.current = true;
      reveal.setValue(1);
      return;
    }
    revealed.current = true;
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [foreground, reduced, reveal]);
  return (
    <Modal transparent visible onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Animated.View
            style={{
              opacity: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0.45, 1],
              }),
              transform: [
                {
                  scale: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.92, 1],
                  }),
                },
              ],
            }}
          >
            <MilestoneArt {...milestone} />
          </Animated.View>
          <AppText
            variant="title"
            accessibilityRole="header"
            style={styles.center}
          >
            {milestone.title}
          </AppText>
          <AppText color={colors.muted} style={styles.center}>
            {milestone.description}
          </AppText>
          {milestone.earnedDay && (
            <AppText variant="caption" color={colors.muted}>
              Earned{" "}
              {new Date(`${milestone.earnedDay}T12:00:00`).toLocaleDateString(
                undefined,
                { dateStyle: "long" },
              )}
            </AppText>
          )}
          <Button title="Continue" onPress={onClose} style={styles.continue} />
        </View>
      </View>
    </Modal>
  );
}

export function MilestoneCelebration({ allowed }: { allowed: boolean }) {
  const { data, user } = useApp();
  const key = `solace.milestone-celebrations.${user?.id}`;
  const { checkins, sessions, reflections } = data;
  const milestones = useMemo(
    () => journeyAnalytics({ checkins, sessions, reflections }).milestones,
    [checkins, sessions, reflections],
  );
  const initialMilestones = useRef(milestones);
  const live = useRef(true);
  const saving = useRef(false);
  const [seen, setSeen] = useState<string[] | null>(null);
  const [current, setCurrent] = useState<Milestone | null>(null);
  const streaks =
    data.preferences.find(({ id }) => id === "wellness")?.streaksEnabled ===
    true;

  useEffect(() => {
    live.current = true;
    let currentAccount = true;
    void (async () => {
      const raw = await AsyncStorage.getItem(key);
      if (!currentAccount) return;
      let stored: unknown = null;
      if (raw !== null) {
        try {
          stored = JSON.parse(raw);
        } catch {}
      }
      const savedIds =
        Array.isArray(stored) &&
        stored.every((value): value is string => typeof value === "string")
          ? stored
          : null;
      const baseline =
        savedIds ??
        initialMilestones.current
          .filter(({ earned }) => earned)
          .map(({ id }) => id);
      if (!savedIds) await AsyncStorage.setItem(key, JSON.stringify(baseline));
      if (currentAccount) setSeen(baseline);
    })().catch(() => {});
    return () => {
      currentAccount = false;
      live.current = false;
    };
  }, [key]);

  useEffect(() => {
    if (!allowed || !seen || current || saving.current) return;
    const item = nextMilestoneCelebration(milestones, seen, streaks);
    if (!item) return;
    const next = [...seen, item.id];
    saving.current = true;
    void AsyncStorage.setItem(key, JSON.stringify(next))
      .then(() => {
        if (!live.current) return;
        setSeen(next);
        setCurrent(item);
      })
      .catch(() => {})
      .finally(() => {
        saving.current = false;
      });
  }, [allowed, current, key, milestones, seen, streaks]);

  return allowed && current ? (
    <Celebration
      key={current.id}
      milestone={current}
      onClose={() => setCurrent(null)}
    />
  ) : null;
}

const styles = StyleSheet.create({
  art: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  artSymbol: { alignItems: "center", justifyContent: "center" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.section,
  },
  panel: {
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    padding: spacing.section,
    gap: spacing.row,
    borderRadius: 26,
    borderWidth: 1,
  },
  center: { textAlign: "center" },
  continue: { alignSelf: "stretch", marginTop: spacing.compact },
});
