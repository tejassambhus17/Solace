import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform } from "react-native";
import type { momentBreathingPosition } from "./moments";

export function useBreathingMotion(
  cue: ReturnType<typeof momentBreathingPosition>,
  running: boolean,
  reducedMotion: boolean,
  restingProgress = 1 / 3,
) {
  const [motion] = useState(() => new Animated.Value(restingProgress));
  const latestCue = useRef(cue);
  latestCue.current = cue;
  const phaseEndsAt = cue?.phaseEndsAtMs;

  useEffect(() => {
    const sample = latestCue.current;
    if (reducedMotion || (!sample && !running)) {
      motion.setValue(restingProgress);
      return;
    }
    if (!sample) return;
    // The clock still updates the text each second. Start motion only when its
    // phase changes, or when playback needs to freeze or resume mid-phase.
    motion.setValue(sample.progress);
    if (!running || sample.progress === sample.targetProgress) return;
    const animation = Animated.timing(motion, {
      toValue: sample.targetProgress,
      duration: sample.remainingMs,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [motion, phaseEndsAt, reducedMotion, restingProgress, running]);

  return motion;
}
