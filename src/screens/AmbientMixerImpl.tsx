import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import {
  ambientTimers,
  ambientTracks,
  type AmbientMix,
  type AmbientTrack,
} from "../../server/src/ambient-contract";
import { registerAmbientPlayback } from "../audio-focus";
import { spacing } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  Card,
  coverImageStyle,
  Icon,
  IconButton,
  Row,
  Screen,
} from "../ui";

const sources = {
  rain: require("../../assets/ambient-rain.wav"),
  ocean: require("../../assets/ambient-ocean.wav"),
  forest: require("../../assets/ambient-forest.wav"),
  wind: require("../../assets/ambient-wind.wav"),
};
const trackDetails: Record<AmbientTrack, { label: string; icon: string }> = {
  rain: { label: "Rain", icon: "rainy-outline" },
  ocean: { label: "Ocean waves", icon: "water-outline" },
  forest: { label: "Forest ambience", icon: "leaf-outline" },
  wind: { label: "Soft wind", icon: "cloud-outline" },
};
const defaultMix: AmbientMix = {
  volumes: { rain: 48, ocean: 0, forest: 0, wind: 0 },
  masterVolume: 55,
  timerMinutes: 0,
};
const playerOptions = { updateInterval: 1000 };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const Volume = React.memo(function Volume({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: number;
  change: (value: number) => void;
  icon: string;
}) {
  const { colors } = useTheme();
  const width = useRef(0);
  function slide(event: GestureResponderEvent) {
    if (width.current)
      change(clamp((event.nativeEvent.locationX * 100) / width.current));
  }
  return (
    <View style={styles.volume}>
      <Row style={styles.levelTitle}>
        <Icon name={icon} size={18} color={colors.primary} />
        <AppText variant="label" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="caption" color={colors.muted} style={styles.value}>
          {value}%
        </AppText>
      </Row>
      <Row style={styles.sliderRow}>
        <IconButton
          name="remove"
          label={`Decrease ${label}`}
          disabled={value === 0}
          onPress={() => change(clamp(value - 10))}
        />
        {Platform.OS === "web" ? (
          <View style={styles.sliderTarget}>
            {React.createElement("input", {
              type: "range",
              min: 0,
              max: 100,
              value,
              "aria-label": label,
              "aria-valuenow": value,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                change(clamp(Number(event.target.value))),
              style: {
                width: "100%",
                height: 44,
                margin: 0,
                accentColor: colors.primary,
                cursor: "pointer",
                backgroundColor: "transparent",
              },
            })}
          </View>
        ) : (
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: 0, max: 100, now: value }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            accessibilityActions={[
              { name: "increment" },
              { name: "decrement" },
            ]}
            onAccessibilityAction={(event) =>
              change(
                clamp(
                  value +
                    (event.nativeEvent.actionName === "increment" ? 10 : -10),
                ),
              )
            }
            onLayout={(event) => {
              width.current = event.nativeEvent.layout.width;
            }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={slide}
            onResponderMove={slide}
            style={styles.sliderTarget}
          >
            <View
              pointerEvents="none"
              style={[styles.track, { backgroundColor: colors.border }]}
            >
              <View
                style={[
                  styles.trackFill,
                  { width: `${value}%`, backgroundColor: colors.primary },
                ]}
              />
              <View
                style={[
                  styles.thumb,
                  { left: `${value}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
          </View>
        )}
        <IconButton
          name="add"
          label={`Increase ${label}`}
          disabled={value === 100}
          onPress={() => change(clamp(value + 10))}
        />
      </Row>
    </View>
  );
});

export function AmbientMixerImpl() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const stored = app.data.preferences.find(
    (item) => item.id === "ambient-mix",
  ) as AmbientMix | undefined;
  const [mix, setMix] = useState<AmbientMix>(() => stored || defaultMix);
  const currentMix = useRef(mix);
  currentMix.current = mix;
  const rain = useAudioPlayer(null, playerOptions);
  const ocean = useAudioPlayer(null, playerOptions);
  const forest = useAudioPlayer(null, playerOptions);
  const wind = useAudioPlayer(null, playerOptions);
  const players = useMemo(
    () => ({ rain, ocean, forest, wind }),
    [rain, ocean, forest, wind],
  );
  const [playback, setPlayback] = useState<"paused" | "starting" | "playing">(
    "paused",
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = useRef(false);
  const request = useRef(0);
  const saveLock = useRef(false);
  const attached = useRef(new Set<AmbientTrack>());
  const requested = useRef(new Set<AmbientTrack>());
  const levels = useRef(new Map<AmbientTrack, number>());
  const heard = useRef(new Set<AmbientTrack>());
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPlayers = useCallback(() => {
    ++request.current;
    active.current = false;
    heard.current.clear();
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    playbackTimer.current = null;
    for (const track of requested.current) {
      try {
        players[track].pause();
      } catch {}
    }
    requested.current.clear();
  }, [players]);

  const pause = useCallback(
    (message = "") => {
      stopPlayers();
      setPlayback("paused");
      setNotice(message);
    },
    [stopPlayers],
  );

  useEffect(() => {
    const unregister = registerAmbientPlayback(() => {
      if (active.current || playbackTimer.current) pause("Paused for voice.");
    });
    const background = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause();
    });
    const subscriptions = ambientTracks.map((track) =>
      players[track].addListener("playbackStatusUpdate", (status) => {
        if (!active.current || !currentMix.current.volumes[track]) return;
        if (status.mediaServicesDidReset) {
          attached.current.delete(track);
          pause("Sound was interrupted. Play again when you’re ready.");
        } else if (status.error) {
          attached.current.delete(track);
          pause();
          setError("A sound couldn’t play. Try starting the mix again.");
        } else if (status.playing) {
          const started = heard.current.size > 0;
          heard.current.add(track);
          if (playbackTimer.current) clearTimeout(playbackTimer.current);
          playbackTimer.current = null;
          if (!started) setPlayback("playing");
        } else if (heard.current.has(track) && !status.isBuffering) {
          pause("Sound was interrupted. Play again when you’re ready.");
        }
      }),
    );
    return () => {
      unregister();
      background.remove();
      subscriptions.forEach((subscription) => subscription.remove());
      stopPlayers();
    };
  }, [pause, players, stopPlayers]);

  const applyLevels = useCallback(
    (settings: AmbientMix) => {
      for (const track of ambientTracks) {
        const player = players[track];
        if (settings.volumes[track]) {
          if (!attached.current.has(track)) {
            player.replace(sources[track]);
            player.loop = true;
            levels.current.delete(track);
            attached.current.add(track);
          }
          // Leave headroom when all four independent loops are enabled.
          const level =
            (settings.volumes[track] * settings.masterVolume * 0.32) / 10000;
          if (levels.current.get(track) !== level) {
            player.volume = level;
            levels.current.set(track, level);
          }
          if (!requested.current.has(track)) {
            requested.current.add(track);
            player.play();
          }
        } else if (requested.current.delete(track)) {
          heard.current.delete(track);
          player.pause();
        }
      }
    },
    [players],
  );

  useEffect(() => {
    if (!active.current) return;
    if (!Object.values(mix.volumes).some(Boolean)) {
      pause();
      return;
    }
    try {
      applyLevels(mix);
    } catch {
      pause();
      setError("The mix couldn’t be adjusted. Try playing again.");
    }
  }, [applyLevels, mix, pause]);

  useEffect(() => {
    if (playback !== "playing" || !mix.timerMinutes) return;
    const timer = setTimeout(
      () => pause("Sleep timer ended."),
      mix.timerMinutes * 60000,
    );
    return () => clearTimeout(timer);
  }, [mix.timerMinutes, pause, playback]);

  async function play() {
    setError("");
    setNotice("");
    setPlayback("starting");
    const attempt = ++request.current;
    playbackTimer.current = setTimeout(() => {
      pause();
      setError("Sound took too long to start. Try again.");
    }, 6500);
    try {
      if (Platform.OS !== "web") {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "doNotMix",
        });
      }
      if (attempt !== request.current) return;
      if (AppState.currentState && AppState.currentState !== "active") {
        pause();
        return;
      }
      active.current = true;
      applyLevels(currentMix.current);
    } catch {
      if (attempt !== request.current) return;
      pause();
      setError("The mix couldn’t start. Try again.");
    }
  }

  async function saveFavorite() {
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await app.save("preferences", {
        ...currentMix.current,
        id: "ambient-mix",
      });
      setNotice("Favorite mix saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn’t save this mix. Try again.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const canPlay =
    Object.values(mix.volumes).some(Boolean) && mix.masterVolume > 0;
  const changeTrack = useMemo(
    () =>
      Object.fromEntries(
        ambientTracks.map((track) => [
          track,
          (value: number) =>
            setMix((previous) =>
              previous.volumes[track] === value
                ? previous
                : {
                    ...previous,
                    volumes: { ...previous.volumes, [track]: value },
                  },
            ),
        ]),
      ) as Record<AmbientTrack, (value: number) => void>,
    [],
  );
  const changeMaster = useCallback(
    (masterVolume: number) =>
      setMix((previous) =>
        previous.masterVolume === masterVolume
          ? previous
          : { ...previous, masterVolume },
      ),
    [],
  );
  return (
    <Screen title="Ambient sound mixer" back={app.back}>
      <View style={[styles.scene, { backgroundColor: colors.heroSurface }]}>
        <Image
          accessible={false}
          source={
            resolved === "dark"
              ? require("../../assets/today-twilight-lotus.jpg")
              : require("../../assets/redesign-today-scene-light.jpg")
          }
          resizeMode="cover"
          style={coverImageStyle}
        />
      </View>
      <AppText color={colors.muted} style={styles.intro}>
        Layer the sounds you want, then settle into the mix.
      </AppText>
      <Button
        title={
          playback === "paused"
            ? "Play mix"
            : playback === "starting"
              ? "Cancel starting mix"
              : "Pause mix"
        }
        icon={playback === "paused" ? "play-outline" : "pause-outline"}
        disabled={playback === "paused" && !canPlay}
        onPress={() => (playback === "paused" ? void play() : pause())}
      />
      {playback === "starting" && (
        <AppText accessibilityLiveRegion="polite" style={styles.status}>
          Starting sound…
        </AppText>
      )}
      {error ? (
        <AppText
          accessibilityRole="alert"
          color={colors.danger}
          style={styles.status}
        >
          {error}
        </AppText>
      ) : null}
      {notice ? (
        <AppText
          accessibilityLiveRegion="polite"
          color={colors.muted}
          style={styles.status}
        >
          {notice}
        </AppText>
      ) : null}
      <Card style={styles.section}>
        {ambientTracks.map((track) => (
          <Volume
            key={track}
            {...trackDetails[track]}
            value={mix.volumes[track]}
            change={changeTrack[track]}
          />
        ))}
      </Card>
      <Card style={styles.section}>
        <Volume
          label="Master volume"
          icon="volume-medium-outline"
          value={mix.masterVolume}
          change={changeMaster}
        />
        <AppText variant="label">Sleep timer</AppText>
        <AppText variant="caption" color={colors.muted}>
          Sound pauses when you leave the mixer or the timer ends.
        </AppText>
        <Row style={styles.timerOptions}>
          {ambientTimers.map((timerMinutes) => {
            const selected = mix.timerMinutes === timerMinutes;
            const label = timerMinutes === 0 ? "Off" : `${timerMinutes} min`;
            return (
              <Pressable
                key={timerMinutes}
                accessibilityRole="radio"
                accessibilityLabel={`Sleep timer ${label}`}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() =>
                  setMix((previous) => ({ ...previous, timerMinutes }))
                }
                style={[
                  styles.timer,
                  {
                    borderColor: colors.border,
                    backgroundColor: selected
                      ? colors.sageSurface
                      : colors.surface,
                  },
                ]}
              >
                <AppText
                  variant="caption"
                  color={selected ? colors.sageText : colors.text}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </Row>
      </Card>
      <View style={styles.section}>
        <Button
          title="Save favorite mix"
          variant="secondary"
          icon="bookmark-outline"
          loading={saving}
          onPress={() => void saveFavorite()}
        />
        {stored && (
          <Button
            title="Restore favorite mix"
            variant="ghost"
            onPress={() => {
              setMix(stored);
              setNotice("Favorite mix restored.");
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scene: { aspectRatio: 2.45, borderRadius: 22, overflow: "hidden" },
  intro: { marginVertical: spacing.card },
  status: { marginTop: spacing.compact },
  section: { marginTop: spacing.card, gap: spacing.row },
  volume: { gap: 2 },
  flex: { flex: 1 },
  value: { fontVariant: ["tabular-nums"] },
  levelTitle: { paddingHorizontal: 4 },
  sliderRow: { gap: 10 },
  sliderTarget: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    marginHorizontal: 6,
  },
  track: { height: 4, borderRadius: 2 },
  trackFill: { height: 4, borderRadius: 2 },
  thumb: {
    position: "absolute",
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },
  timerOptions: { gap: spacing.compact, flexWrap: "wrap" },
  timer: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
});
