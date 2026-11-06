import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  I18nManager,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  edgeBackComplete,
  edgeBackIntent,
  edgeBackStart,
} from "./navigation-motion";

export function NavigationDetail({
  children,
  reducedMotion,
  stationary,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
  stationary: boolean;
}) {
  const rtl = I18nManager.isRTL;
  const [arrival] = useState(() => new Animated.Value(1));
  const ready = useRef(false);
  useLayoutEffect(() => {
    const firstArrival = !ready.current;
    ready.current = true;
    if (!firstArrival || reducedMotion || stationary) {
      arrival.setValue(1);
      return;
    }
    arrival.setValue(0);
    const animation = Animated.timing(arrival, {
      toValue: 1,
      duration: 155,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [arrival, reducedMotion, stationary]);
  const motion = useMemo(
    () => ({
      opacity: arrival.interpolate({
        inputRange: [0, 1],
        outputRange: [0.91, 1],
      }),
      transform: [
        {
          translateX: arrival.interpolate({
            inputRange: [0, 1],
            outputRange: [rtl ? -8 : 8, 0],
          }),
        },
      ],
    }),
    [arrival, rtl],
  );
  return (
    <View style={styles.clip}>
      <Animated.View
        style={[styles.content, !stationary && !reducedMotion && motion]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export function useIosEdgeBack(onBack?: () => void) {
  const back = useRef(onBack);
  back.current = onBack;
  return useMemo(() => {
    if (Platform.OS !== "ios") return undefined;
    const rtl = I18nManager.isRTL;
    let start: {
      x: number;
      y: number;
      width: number;
      back: () => void;
    } | null = null;
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: ({ nativeEvent }) => {
        const { width } = Dimensions.get("window");
        start =
          back.current &&
          nativeEvent.touches.length === 1 &&
          edgeBackStart(nativeEvent.pageX, width, rtl)
            ? {
                x: nativeEvent.pageX,
                y: nativeEvent.pageY,
                width,
                back: back.current,
              }
            : null;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (
        { nativeEvent },
        { numberActiveTouches },
      ) => {
        if (!start || !back.current) return false;
        const dx = nativeEvent.pageX - start.x;
        const dy = nativeEvent.pageY - start.y;
        if (numberActiveTouches === 1 && edgeBackIntent(dx, dy, rtl))
          return true;
        if (numberActiveTouches !== 1 || Math.abs(dy) >= 10) start = null;
        return false;
      },
      onPanResponderMove: (_event, { numberActiveTouches }) => {
        if (numberActiveTouches !== 1) start = null;
      },
      onPanResponderRelease: ({ nativeEvent }) => {
        const origin = start;
        start = null;
        if (
          origin &&
          back.current &&
          edgeBackComplete(
            nativeEvent.pageX - origin.x,
            nativeEvent.pageY - origin.y,
            origin.width,
            rtl,
          )
        )
          origin.back();
      },
      onPanResponderReject: () => {
        start = null;
      },
      onPanResponderTerminate: () => {
        start = null;
      },
    }).panHandlers;
  }, []);
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: "hidden" },
  content: { flex: 1 },
});
