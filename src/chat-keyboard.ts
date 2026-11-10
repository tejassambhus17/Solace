import { useEffect, useState } from "react";
import { Animated, Easing, Keyboard, Platform } from "react-native";
import type { KeyboardEvent, KeyboardMetrics } from "react-native";

export function chatKeyboardLift(
  windowHeight: number,
  railInset: number,
  { screenY, height }: KeyboardMetrics,
) {
  // Undocked keyboards should not lift the composer away from the bottom.
  if (screenY + height < windowHeight - 1) return 0;
  return Math.max(0, Math.min(height, windowHeight - screenY) - railInset);
}

function keyboardEasing(easing: KeyboardEvent["easing"]) {
  switch (easing) {
    case "linear":
      return Easing.linear;
    case "easeIn":
      return Easing.in(Easing.ease);
    case "easeOut":
      return Easing.out(Easing.ease);
    case "easeInEaseOut":
      return Easing.inOut(Easing.ease);
    default:
      return Easing.bezier(0.25, 0.1, 0.25, 1);
  }
}

export function useChatKeyboard(
  windowHeight: number,
  railInset: number,
  reducedMotion: boolean,
) {
  const [translateY] = useState(() => new Animated.Value(0));
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let target = 0;
    const move = (next: number, event?: KeyboardEvent) => {
      const changed = next !== target;
      const position = next === 0 ? 0 : -next;
      target = next;
      setLift(next);
      if (event?.duration && !reducedMotion) {
        if (changed)
          Animated.timing(translateY, {
            toValue: position,
            duration: event.duration,
            easing: keyboardEasing(event.easing),
            useNativeDriver: true,
            isInteraction: false,
          }).start();
      } else {
        translateY.setValue(position);
      }
    };
    const current = Keyboard.metrics();
    move(current ? chatKeyboardLift(windowHeight, railInset, current) : 0);

    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      if ("isEventFromThisApp" in event && !event.isEventFromThisApp) return;
      move(
        chatKeyboardLift(windowHeight, railInset, event.endCoordinates),
        event,
      );
    });
    const willHide = Keyboard.addListener("keyboardWillHide", (event) =>
      move(0, event),
    );
    const didHide = Keyboard.addListener("keyboardDidHide", () => {
      if (target === 0) move(0);
    });
    return () => {
      change.remove();
      willHide.remove();
      didHide.remove();
      translateY.stopAnimation();
    };
  }, [railInset, reducedMotion, translateY, windowHeight]);

  return { translateY, lift };
}
