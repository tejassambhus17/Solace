import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useTheme } from "./theme";
import { AppText, Icon } from "./ui";
import type { MomentEnvironment } from "./moments";
import { registerAmbientPlayback } from "./audio-focus";
const audioSources = {
  forest: require("../assets/ambient-forest.wav"),
  ocean: require("../assets/ambient-ocean.wav"),
  twilight: require("../assets/ambient-twilight.wav"),
};

export function AmbientSoundImpl({
  environment,
  running,
  enabled,
  onToggle,
}: {
  environment: MomentEnvironment;
  running: boolean;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const player = useAudioPlayer(audioSources[environment], {
    updateInterval: 500,
  });
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState("");
  const soundState = useRef({ running, enabled, onToggle });
  soundState.current = { running, enabled, onToggle };
  useEffect(
    () =>
      registerAmbientPlayback(() => {
        const state = soundState.current;
        if (!state.running || !state.enabled) return;
        try {
          player.pause();
        } catch {}
        state.onToggle();
      }),
    [player],
  );
  useEffect(() => {
    try {
      player.loop = true;
      player.volume = 0.22;
      if (running && enabled) player.play();
      else player.pause();
    } catch {
      setError("Sound couldn't start. Your practice can continue quietly.");
    }
    return () => {
      try {
        player.pause();
      } catch {}
    };
  }, [player, running, enabled, environment]);
  const label = enabled
    ? status.playing
      ? "Ambient sound playing"
      : status.isBuffering || !status.isLoaded
        ? "Loading ambient sound…"
        : "Ambient sound paused"
    : "Ambient sound off";
  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Ambient sound"
        accessibilityState={{ checked: enabled }}
        aria-checked={enabled}
        onPress={() => {
          setError("");
          onToggle();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          gap: 9,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon
          name={
            status.playing && enabled
              ? "volume-medium-outline"
              : "volume-mute-outline"
          }
          size={18}
          color={colors.muted}
        />
        <AppText variant="caption" color={colors.muted}>
          {label}
        </AppText>
      </Pressable>
      {!!(status.error || error) && (
        <AppText variant="caption" color={colors.danger}>
          {error ||
            "Sound couldn't load. Turn sound off and on to retry, or continue quietly."}
        </AppText>
      )}
    </View>
  );
}
