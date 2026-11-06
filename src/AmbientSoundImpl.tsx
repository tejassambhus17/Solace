import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useAudioPlayer, type AudioStatus } from "expo-audio";
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
  compact = false,
}: {
  environment: MomentEnvironment;
  running: boolean;
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const player = useAudioPlayer(null);
  const attached = useRef<MomentEnvironment | null>(null);
  const [status, setStatus] = useState("loading");
  const lastStatus = useRef(status);
  const [error, setError] = useState("");
  const soundState = useRef({ running, enabled, onToggle });
  soundState.current = { running, enabled, onToggle };
  useEffect(() => {
    function receive(sample: AudioStatus) {
      const next = sample.error
        ? "error"
        : sample.playing
          ? "playing"
          : sample.isBuffering || !sample.isLoaded
            ? "loading"
            : "paused";
      if (next !== lastStatus.current) {
        lastStatus.current = next;
        setStatus(next);
      }
    }
    receive(player.currentStatus);
    const subscription = player.addListener("playbackStatusUpdate", receive);
    return () => subscription.remove();
  }, [player]);
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
    if (!running || !enabled) return;
    try {
      if (attached.current !== environment || lastStatus.current === "error") {
        player.replace(audioSources[environment]);
        attached.current = environment;
        player.loop = true;
        player.volume = 0.22;
      }
      player.play();
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
    ? status === "playing"
      ? "Ambient sound playing"
      : running && status === "loading"
        ? "Loading ambient sound…"
        : "Ambient sound paused"
    : "Ambient sound off";
  return (
    <View
      style={
        compact
          ? { minWidth: 44, alignItems: "flex-end", zIndex: 1 }
          : undefined
      }
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Ambient sound"
        accessibilityHint={compact ? label : undefined}
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
          ...(compact && {
            width: 44,
            minHeight: 44,
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
          }),
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon
          name={
            enabled && (compact || status === "playing")
              ? "volume-medium-outline"
              : "volume-mute-outline"
          }
          size={18}
          color={colors.muted}
        />
        {!compact && (
          <AppText variant="caption" color={colors.muted}>
            {label}
          </AppText>
        )}
      </Pressable>
      {enabled && (status === "error" || !!error) && (
        <AppText
          variant="caption"
          color={colors.danger}
          accessibilityRole="alert"
          style={
            compact
              ? {
                  position: "absolute",
                  top: 48,
                  right: 0,
                  width: 200,
                  padding: 10,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                }
              : undefined
          }
        >
          {error ||
            "Sound couldn't load. Turn sound off and on to retry, or continue quietly."}
        </AppText>
      )}
    </View>
  );
}
