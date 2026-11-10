import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import type { RealtimeAudioLevels } from "../realtime-rtc";
import { artGradient, useTheme } from "../theme";

const twilight = require("../../assets/voice-companion-night.jpg");
const sunrise = require("../../assets/voice-companion-dawn.jpg");
const waveform = [2, 3, 4, 7, 11, 17, 25, 34, 25, 17, 11, 7, 4, 3, 2];
const nativeDriver = Platform.OS !== "web";
type Signal = keyof RealtimeAudioLevels;
const lotusArt = {
  dark: {
    still: twilight,
    plate: require("../../assets/voice-night-plate.jpg"),
    petals: require("../../assets/voice-night-lotus.png"),
  },
  light: {
    still: sunrise,
    plate: require("../../assets/voice-dawn-plate.jpg"),
    petals: require("../../assets/voice-dawn-lotus.png"),
  },
};
const motionProfile = {
  resting: { breath: 0, glow: 0, reaction: 0 },
  connecting: { breath: 0.041, glow: 0.58, reaction: 0 },
  reconnecting: { breath: 0.032, glow: 0.43, reaction: 0 },
  ready: { breath: 0.023, glow: 0.28, reaction: 0 },
  listening: { breath: 0.035, glow: 0.44, reaction: 0.8 },
  thinking: { breath: 0.019, glow: 0.31, reaction: 0 },
  speaking: { breath: 0.041, glow: 0.69, reaction: 1 },
  muted: { breath: 0.013, glow: 0.15, reaction: 0 },
} as const;
type LotusMotion = keyof typeof motionProfile;
type Frame = { width: number; height: number };
type LotusArt = {
  still: ImageSourcePropType;
  plate: ImageSourcePropType;
  petals: ImageSourcePropType;
};
const sceneWidth = 852;
const sceneHeight = 1846;

export function useVoiceLevel(
  signal: Signal | undefined,
  read: () => Promise<RealtimeAudioLevels>,
  paused: boolean,
) {
  const [level] = useState(() => new Animated.Value(0));
  const latest = React.useRef(read);
  latest.current = read;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    level.setValue(0);
    if (!signal || paused) return;
    let target = 0;
    const sample = async () => {
      const reading = await latest
        .current()
        .catch(() => ({}) as RealtimeAudioLevels);
      if (cancelled) return;
      const amplitude = reading[signal];
      const next =
        typeof amplitude === "number" && Number.isFinite(amplitude)
          ? Math.min(1, Math.sqrt(Math.max(0, amplitude)) * 2.3)
          : 0;
      if (target !== next) {
        target = next;
        Animated.timing(level, {
          toValue: next,
          duration: 130,
          useNativeDriver: nativeDriver,
          isInteraction: false,
        }).start();
      }
      timer = setTimeout(sample, 140);
    };
    void sample();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      level.stopAnimation();
    };
  }, [level, paused, signal]);
  return level;
}

export const VoiceMeter = React.memo(function VoiceMeter({
  level,
  color,
  compact,
  ready,
}: {
  level: Animated.Value;
  color: string;
  compact?: boolean;
  ready?: boolean;
}) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.meter, compact && styles.compactMeter]}
    >
      {waveform.map((height, index) => (
        <Animated.View
          key={index}
          style={{
            width: compact ? 2 : 2.5,
            height: compact ? height * 0.62 : height,
            borderRadius: 2,
            backgroundColor: color,
            opacity: level.interpolate({
              inputRange: [0, 1],
              outputRange: [ready ? 0.68 : 0.32, 1],
            }),
            transform: [
              {
                scaleY: level.interpolate({
                  inputRange: [0, 1],
                  // The connected quiet state holds a stationary silhouette.
                  outputRange: [
                    Math.min(1, Math.max(2 / height, ready ? 0.48 : 0)),
                    1,
                  ],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
});

export const VoiceBackdrop = React.memo(function VoiceBackdrop({
  motion,
  level,
  paused,
  signal,
}: {
  motion: LotusMotion;
  level: Animated.Value;
  paused: boolean;
  signal?: Signal;
}) {
  const { resolved } = useTheme();
  const [frame, setFrame] = useState({ width: 0, height: 0 });

  return (
    <View
      testID="voice-backdrop"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      onLayout={({
        nativeEvent: {
          layout: { width, height },
        },
      }) => {
        setFrame((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }}
      style={styles.backdrop}
    >
      {frame.width > 0 && frame.height > 0 ? (
        <LotusScene
          key={resolved}
          art={lotusArt[resolved]}
          motion={paused ? "resting" : motion}
          level={level}
          signal={paused ? undefined : signal}
          frame={frame}
          dark={resolved === "dark"}
          paused={paused}
        />
      ) : (
        <Image
          source={lotusArt[resolved].still}
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="cover"
          style={styles.artwork}
        />
      )}
      {resolved === "light" && (
        <View style={[StyleSheet.absoluteFill, styles.dawnChrome]} />
      )}
    </View>
  );
});

function sceneBox(frame: Frame, x: number, y: number, w: number, h: number) {
  const zoom = Math.max(frame.width / sceneWidth, frame.height / sceneHeight);
  return {
    left: frame.width / 2 + (x - sceneWidth / 2 - w / 2) * zoom,
    top: frame.height / 2 + (y - sceneHeight / 2 - h / 2) * zoom,
    width: w * zoom,
    height: h * zoom,
  };
}

function LotusScene({
  art,
  motion,
  level,
  signal,
  frame,
  dark,
  paused,
}: {
  art: LotusArt;
  motion: LotusMotion;
  level: Animated.Value;
  signal?: Signal;
  frame: Frame;
  dark: boolean;
  paused: boolean;
}) {
  const [plateReady, setPlateReady] = useState(false);
  const [petalsReady, setPetalsReady] = useState(false);
  const [drift] = useState(() => new Animated.Value(0.5));
  const [breath] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));
  const [reaction] = useState(() => new Animated.Value(0));
  const [ripple] = useState(() => new Animated.Value(0));
  const layersReady = plateReady && petalsReady;
  const active = layersReady && motion !== "resting" && !paused;
  const rippling =
    active &&
    (motion === "speaking" || (motion === "listening" && signal === "input"));

  useEffect(() => {
    if (!active) return;
    const cycle = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 5200,
        easing: (position) =>
          Easing.inOut(Easing.sin)(1 - Math.abs(2 * position - 1)),
        useNativeDriver: nativeDriver,
        isInteraction: false,
      }),
    );
    drift.setValue(0);
    cycle.start();
    return () => cycle.stop();
  }, [active, drift]);

  useEffect(() => {
    const profile = motionProfile[layersReady && !paused ? motion : "resting"];
    const transition = Animated.parallel(
      [
        [breath, profile.breath],
        [glow, profile.glow],
        [reaction, profile.reaction],
      ].map(([value, target]) =>
        Animated.timing(value as Animated.Value, {
          toValue: target as number,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: nativeDriver,
          isInteraction: false,
        }),
      ),
    );
    transition.start();
    return () => transition.stop();
  }, [breath, glow, layersReady, motion, paused, reaction]);

  useEffect(() => {
    ripple.setValue(0);
    if (!rippling) return;
    const spread = Animated.timing(ripple, {
      toValue: 1,
      duration: 2200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    spread.start();
    return () => spread.stop();
  }, [ripple, rippling]);

  const lighting = useMemo(() => {
    const audioEnergy = Animated.multiply(reaction, level);
    const ambientEnergy = Animated.add(0.32, Animated.multiply(drift, 0.38));
    return {
      petalScale: Animated.add(
        1,
        Animated.add(
          Animated.multiply(Animated.subtract(drift, 0.45), breath),
          Animated.multiply(audioEnergy, 0.013),
        ),
      ),
      glowOpacity: Animated.multiply(
        glow,
        Animated.add(ambientEnergy, Animated.multiply(audioEnergy, 0.28)),
      ),
      haloScale: Animated.add(
        1,
        Animated.multiply(
          glow,
          Animated.add(
            Animated.multiply(drift, 0.07),
            Animated.multiply(audioEnergy, 0.045),
          ),
        ),
      ),
      rippleOpacity: ripple.interpolate({
        inputRange: [0, 0.16, 0.62, 1],
        outputRange: [0, 0.4, 0.2, 0],
      }),
      rippleScale: ripple.interpolate({
        inputRange: [0, 1],
        outputRange: [0.8, 1.49],
      }),
    };
  }, [breath, drift, glow, level, reaction, ripple]);

  return (
    <>
      {(!layersReady || paused) && (
        <Image
          source={art.still}
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="cover"
          style={styles.artwork}
        />
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { opacity: layersReady && !paused ? 1 : 0 },
        ]}
      >
        <Image
          source={art.plate}
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="cover"
          onLoad={() => setPlateReady(true)}
          style={styles.artwork}
        />
        {!paused && (
          <>
            <Animated.View
              testID="voice-lotus-halo"
              style={[
                styles.light,
                sceneBox(frame, 414, 780, 628, 423),
                dark ? styles.nightHalo : styles.dawnHalo,
                {
                  opacity: lighting.glowOpacity,
                  transform: [{ scale: lighting.haloScale }],
                },
              ]}
            />
            <Animated.View
              testID="voice-lotus-glow"
              style={[
                styles.light,
                sceneBox(frame, 426, 932, 460, 228),
                styles.petalGlow,
                {
                  opacity: lighting.glowOpacity,
                  transform: [{ scale: lighting.haloScale }],
                },
              ]}
            />
            {rippling && (
              <Animated.View
                testID="voice-lotus-ripple"
                style={[
                  styles.light,
                  styles.ripple,
                  sceneBox(frame, 426, 1010, 444, 47),
                  {
                    borderColor: dark ? "#F9C6E4" : "#91518B",
                    opacity: lighting.rippleOpacity,
                    transform: [{ scale: lighting.rippleScale }],
                  },
                ]}
              />
            )}
          </>
        )}
        <Animated.Image
          testID="voice-lotus-petals"
          source={art.petals}
          accessible={false}
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="stretch"
          onLoad={() => setPetalsReady(true)}
          style={[
            styles.light,
            // Petal art includes a transparent bleed, registered to x=195, y=770.
            sceneBox(frame, 425, 890, 460, 240),
            {
              transformOrigin: "50% 88%",
              transform: [{ scale: lighting.petalScale }],
            },
          ]}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dawnChrome: {
    ...artGradient(
      "linear-gradient(180deg, #FAF8FCDE 0%, #FAF8FC00 23%, #FAF8FC00 72%, #FAF8FCDF 100%)",
    ),
  },
  meter: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  compactMeter: { height: 24, gap: 5 },
  backdrop: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  artwork: { width: "100%", height: "100%" },
  light: { position: "absolute" },
  petalGlow: artGradient(
    "radial-gradient(ellipse closest-side at center, #FFE4BCB0 0%, #FFD4BC60 45%, #EFADDE20 77%, #EFADDE00 100%)",
  ),
  nightHalo: artGradient(
    "radial-gradient(ellipse closest-side at center, #CDA2FF00 59%, #CDA2FF62 84%, #CDA2FF00 100%)",
  ),
  dawnHalo: artGradient(
    "radial-gradient(ellipse closest-side at center, #D59BE100 59%, #D59BE178 84%, #D59BE100 100%)",
  ),
  ripple: { borderRadius: "50%", borderWidth: StyleSheet.hairlineWidth },
});
