import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
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
import {
  ambientStartupTimeoutMs,
  createAmbientMixerPlayback,
  type MixerPlayback,
} from "../ambient-mixer-playback";
import {
  interruptAmbientPlayback,
  registerAmbientPlayback,
} from "../audio-focus";
import { spacing } from "../layout";
import { EditorialSection, SceneIntro } from "../NestedDesign";
import { useGuardedBack, useTabResetGuard } from "../navigation-reset";
import { webRadioProps } from "../radio-keyboard";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Icon, IconButton, Row, Screen } from "../ui";

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
  toggle,
}: {
  label: string;
  value: number;
  change: (value: number) => void;
  icon: string;
  toggle?: () => void;
}) {
  const { colors } = useTheme();
  const ink = value > 0 ? colors.lavenderText : colors.muted;
  const width = useRef(0);
  function slide(event: GestureResponderEvent) {
    if (width.current)
      change(clamp((event.nativeEvent.locationX * 100) / width.current));
  }
  return (
    <View style={styles.volume}>
      <Row style={styles.levelTitle}>
        <View
          style={[
            styles.channelIcon,
            {
              backgroundColor:
                value > 0 ? colors.lavenderSurface : colors.surface2,
            },
          ]}
        >
          <Icon name={icon} size={18} color={ink} />
        </View>
        <AppText variant="label" style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="label" color={ink} style={styles.value}>
          {value}%
        </AppText>
        {toggle && (
          <IconButton
            name={value ? "volume-medium-outline" : "volume-mute-outline"}
            label={`${value ? "Mute" : "Unmute"} ${label}`}
            onPress={toggle}
          />
        )}
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
                accentColor: colors.lavenderText,
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
                  { width: `${value}%`, backgroundColor: colors.lavenderText },
                ]}
              />
              <View
                style={[
                  styles.thumb,
                  { left: `${value}%`, backgroundColor: colors.lavenderText },
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
  const goBack = useGuardedBack(app.back);
  const { colors, resolved } = useTheme();
  const stored = app.data.preferences.find(
    (item) => item.id === "ambient-mix",
  ) as AmbientMix | undefined;
  const [mix, setMix] = useState<AmbientMix>(() => stored || defaultMix);
  const savedMix = stored || defaultMix;
  useTabResetGuard(
    mix.masterVolume !== savedMix.masterVolume ||
      mix.timerMinutes !== savedMix.timerMinutes ||
      ambientTracks.some(
        (track) => mix.volumes[track] !== savedMix.volumes[track],
      ),
  );
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
  const [playback, setPlayback] = useState<MixerPlayback>({
    phase: "paused",
    failed: [],
  });
  const [preparing, setPreparing] = useState(false);
  const mixer = useMemo(
    () => createAmbientMixerPlayback(players, sources, setPlayback),
    [players],
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const request = useRef(0);
  const preparation = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const saveLock = useRef(false);
  const previousLevels = useRef<Partial<Record<AmbientTrack, number>>>({});

  const cancelPreparation = useCallback(() => {
    request.current += 1;
    clearTimeout(preparation.current);
    preparation.current = undefined;
  }, []);

  const pause = useCallback(
    (message = "", rewind = false) => {
      cancelPreparation();
      mixer.pause(rewind);
      setPreparing(false);
      setNotice(message);
    },
    [cancelPreparation, mixer],
  );

  useEffect(() => {
    const unregister = registerAmbientPlayback(() => {
      if (mixer.active || preparation.current) pause("Sound was paused.");
    });
    const background = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause();
    });
    const subscriptions = ambientTracks.map((track) =>
      players[track].addListener("playbackStatusUpdate", (status) =>
        mixer.receive(
          track,
          status,
          Platform.OS === "web" && players[track].playing,
        ),
      ),
    );
    return () => {
      unregister();
      background.remove();
      subscriptions.forEach((subscription) => subscription.remove());
      cancelPreparation();
      mixer.pause();
      setPreparing(false);
    };
  }, [cancelPreparation, mixer, pause, players]);

  useEffect(() => {
    if (mixer.active) mixer.update(mix);
  }, [mix, mixer]);

  useEffect(() => {
    if (playback.phase !== "playing" || !mix.timerMinutes) return;
    const timer = setTimeout(
      () => pause("Sleep timer ended.", true),
      mix.timerMinutes * 60000,
    );
    return () => clearTimeout(timer);
  }, [mix.timerMinutes, pause, playback.phase]);

  async function play() {
    if (mixer.active || preparation.current || !canPlay) return;
    interruptAmbientPlayback();
    mixer.pause();
    setError("");
    setNotice("");
    setPreparing(true);
    const attempt = ++request.current;
    preparation.current = setTimeout(() => {
      pause();
      setError("Sound took too long to start. Try again.");
    }, ambientStartupTimeoutMs);
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
      clearTimeout(preparation.current);
      preparation.current = undefined;
      setPreparing(false);
      mixer.update(currentMix.current);
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
  const phase = preparing ? "starting" : playback.phase;
  const unavailable = playback.failed
    .map((track) => trackDetails[track].label)
    .join(", ");
  const changeTrack = useMemo(
    () =>
      Object.fromEntries(
        ambientTracks.map((track) => [
          track,
          (value: number) => {
            const previous = currentMix.current.volumes[track];
            if (value > 0 || previous > 0)
              previousLevels.current[track] = value || previous;
            setMix((previous) =>
              previous.volumes[track] === value
                ? previous
                : {
                    ...previous,
                    volumes: { ...previous.volumes, [track]: value },
                  },
            );
          },
        ]),
      ) as Record<AmbientTrack, (value: number) => void>,
    [],
  );
  const toggleTrack = useMemo(
    () =>
      Object.fromEntries(
        ambientTracks.map((track) => [
          track,
          () =>
            changeTrack[track](
              currentMix.current.volumes[track]
                ? 0
                : (previousLevels.current[track] ?? 48),
            ),
        ]),
      ) as Record<AmbientTrack, () => void>,
    [changeTrack],
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
    <Screen variant="nested">
      <View style={styles.backRow}>
        <IconButton
          name="chevron-back"
          label="Go back"
          appearance="outlined"
          size={48}
          onPress={goBack}
        />
      </View>
      <SceneIntro
        title="Ambient sound mixer"
        description="Layer the sounds you want, then settle into the mix."
        image={
          resolved === "dark"
            ? require("../../assets/today-twilight-lotus.jpg")
            : require("../../assets/redesign-explore-feature-light.jpg")
        }
        meta={
          phase === "playing"
            ? "Mix playing"
            : phase === "starting"
              ? undefined
              : "Mix paused"
        }
      >
        <Row style={styles.transport}>
          <Button
            title={
              phase === "paused"
                ? "Play mix"
                : phase === "starting"
                  ? "Cancel starting mix"
                  : "Pause mix"
            }
            icon={phase === "paused" ? "play-outline" : "pause-outline"}
            disabled={phase === "paused" && !canPlay}
            onPress={() => (phase === "paused" ? void play() : pause())}
            style={styles.flex}
          />
          <IconButton
            label="Stop mix"
            name="stop-outline"
            appearance="outlined"
            size={48}
            onPress={() => pause("Mix stopped.", true)}
          />
        </Row>
        {phase === "starting" && (
          <AppText accessibilityLiveRegion="polite">Starting sound…</AppText>
        )}
        {unavailable && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {phase === "paused"
              ? `Couldn’t play ${unavailable}. Try playing again.`
              : `Couldn’t play ${unavailable}. Other sounds can continue. Pause and play to retry.`}
          </AppText>
        )}
        {error ? (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
        {notice ? (
          <AppText accessibilityLiveRegion="polite" color={colors.muted}>
            {notice}
          </AppText>
        ) : null}
      </SceneIntro>
      <EditorialSection
        title="Sound layers"
        description="Blend the sounds independently or mute a layer."
      />
      <View
        style={[
          styles.channelBank,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {ambientTracks.map((track, index) => (
          <View
            key={track}
            style={[
              styles.channel,
              index > 0 && styles.trackDivider,
              { borderColor: colors.border },
            ]}
          >
            <Volume
              {...trackDetails[track]}
              value={mix.volumes[track]}
              change={changeTrack[track]}
              toggle={toggleTrack[track]}
            />
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <EditorialSection title="Playback settings" />
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
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Sleep timer"
          style={styles.timerOptions}
        >
          {ambientTimers.map((timerMinutes) => {
            const selected = mix.timerMinutes === timerMinutes;
            const label = timerMinutes === 0 ? "Off" : `${timerMinutes} min`;
            return (
              <Pressable
                key={timerMinutes}
                accessibilityRole="radio"
                {...webRadioProps(selected)}
                accessibilityLabel={`Sleep timer ${label}`}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() =>
                  setMix((previous) =>
                    previous.timerMinutes === timerMinutes
                      ? previous
                      : { ...previous, timerMinutes },
                  )
                }
                style={({ pressed }) => [
                  styles.timer,
                  {
                    borderColor: selected ? colors.sageText : colors.border,
                    opacity: pressed ? 0.7 : 1,
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
        </View>
      </View>
      <View
        style={[
          styles.section,
          styles.favorites,
          { borderColor: colors.border },
        ]}
      >
        <EditorialSection
          title="Your favorite mix"
          description="Keep these levels and timer settings for next time."
        />
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
  backRow: { marginBottom: spacing.row, alignSelf: "flex-start" },
  transport: { gap: spacing.compact, marginTop: spacing.compact },
  section: { marginTop: spacing.section, gap: spacing.row },
  favorites: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.card,
  },
  channelBank: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  channel: { paddingHorizontal: spacing.row, paddingVertical: spacing.compact },
  channelIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trackDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  volume: { gap: 2 },
  flex: { flex: 1 },
  value: { fontVariant: ["tabular-nums"] },
  levelTitle: { paddingHorizontal: 4, gap: spacing.compact },
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
  timerOptions: {
    flexDirection: "row",
    gap: spacing.compact,
    flexWrap: "wrap",
  },
  timer: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
  },
});
