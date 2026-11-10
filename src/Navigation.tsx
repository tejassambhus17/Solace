import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  I18nManager,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { lightGlass, useTheme } from "./theme";
import { AppText, Icon } from "./ui";
import {
  clampTabCenter,
  dragIntent,
  measuredTabStops,
  nearestTab,
  type TabFrame,
  type TabSelectionIntent,
  type TabStop,
} from "./navigation-motion";

const destinations = [
  { name: "today", title: "Today", icon: "home-outline", active: "home" },
  { name: "chat", title: "Solace", icon: "leaf-outline", active: "leaf" },
  {
    name: "explore",
    title: "Explore",
    icon: "compass-outline",
    active: "compass",
  },
  {
    name: "journey",
    title: "Journey",
    icon: "trending-up-outline",
    active: "trending-up",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    active: "person",
  },
];
const rowPadding = 5;
const spotlightSize = 36;
const android = Platform.OS === "android";
const useNativeDriver = Platform.OS !== "web";
const verticalReleaseSlop = 20;
type TabDestinationItem = (typeof destinations)[number];

const TabDestination = React.memo(function TabDestination({
  destination,
  selected,
  ink,
  labelInk,
  compactLabel,
  reducedMotion,
  onMeasure,
  onPressStart,
  onSelect,
}: {
  destination: TabDestinationItem;
  selected: boolean;
  ink: string;
  labelInk: string;
  compactLabel: boolean;
  reducedMotion: boolean;
  onMeasure: (name: string, frame: TabFrame) => void;
  onPressStart: () => void;
  onSelect: (name: string, nonPointer?: boolean) => void;
}) {
  const [iconOpacity] = useState(() => new Animated.Value(1));
  const wasSelected = useRef(selected);
  const webTouch = useRef<{ x: number; y: number } | null>(null);
  const webTouchClickUntil = useRef(0);
  useLayoutEffect(() => {
    const animate = selected && !wasSelected.current && !reducedMotion;
    wasSelected.current = selected;
    iconOpacity.setValue(animate ? 0.76 : 1);
    if (!animate) return;
    const animation = Animated.timing(iconOpacity, {
      toValue: 1,
      duration: 100,
      useNativeDriver,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [iconOpacity, reducedMotion, selected]);
  return (
    <Pressable
      onPressIn={onPressStart}
      onTouchStart={
        Platform.OS === "web"
          ? ({ nativeEvent }) => {
              const touch = nativeEvent.touches[0];
              webTouchClickUntil.current = 0;
              webTouch.current =
                nativeEvent.touches.length === 1
                  ? { x: touch.pageX, y: touch.pageY }
                  : null;
              onPressStart();
            }
          : undefined
      }
      onTouchCancel={
        Platform.OS === "web"
          ? () => {
              webTouch.current = null;
            }
          : undefined
      }
      onTouchEnd={
        Platform.OS === "web"
          ? (event) => {
              const start = webTouch.current;
              webTouch.current = null;
              const touch = event.nativeEvent.changedTouches[0];
              // Chrome can omit the synthetic click immediately after a drag.
              if (
                start &&
                touch &&
                Math.hypot(touch.pageX - start.x, touch.pageY - start.y) < 8
              ) {
                event.preventDefault();
                // The same touch may still produce a click after the tab changes.
                webTouchClickUntil.current = Date.now() + 250;
                onSelect(destination.name);
              }
            }
          : undefined
      }
      onPress={({ nativeEvent }) => {
        const nonPointer =
          Platform.OS === "web" &&
          (nativeEvent == null ||
            ("detail" in nativeEvent && nativeEvent.detail === 0));
        if (!nonPointer && Date.now() < webTouchClickUntil.current) return;
        onSelect(destination.name, nonPointer);
      }}
      onLayout={({ nativeEvent }) =>
        onMeasure(destination.name, nativeEvent.layout)
      }
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={destination.title}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.iconFrame, { opacity: iconOpacity }]}>
        <Icon
          name={selected ? destination.active : destination.icon}
          size={22}
          color={ink}
        />
      </Animated.View>
      <AppText
        variant="caption"
        color={labelInk}
        style={styles.label}
        {...(android && {
          numberOfLines: 1,
          adjustsFontSizeToFit: true,
          minimumFontScale: 0.75,
          // Android can clip the final glyph before its one-line fit takes effect.
          maxFontSizeMultiplier: compactLabel ? 1.15 : undefined,
        })}
      >
        {destination.title}
      </AppText>
    </Pressable>
  );
});

export const TabBar = React.memo(function TabBar({
  activeTab,
  route,
  hidden = false,
  reducedMotion,
  onSelect,
  onHeight,
}: {
  activeTab: string;
  route: string;
  hidden?: boolean;
  reducedMotion: boolean;
  onSelect: (name: string, intent: TabSelectionIntent) => void;
  onHeight: (height: number) => void;
}) {
  const { resolved } = useTheme();
  const { bottom, left = 0, right = 0 } = useSafeAreaInsets();
  const twilight =
    resolved === "dark" && (route === "today" || route === "explore");
  const bottomInset = Math.max(bottom, 10);
  const radius = android ? 28 : 36;
  return (
    <View
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      onLayout={(event) => onHeight(Math.ceil(event.nativeEvent.layout.height))}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingLeft: 14 + left,
        paddingRight: 14 + right,
        paddingTop: 8,
        paddingBottom: bottomInset,
        opacity: hidden ? 0 : 1,
      }}
    >
      <View
        style={{
          borderRadius: radius,
          boxShadow:
            resolved === "dark"
              ? "0 6px 24px rgba(0,0,0,0.5)"
              : "0 6px 24px rgba(48,30,20,0.12)",
        }}
      >
        <TabRail
          destinations={destinations}
          activeTab={activeTab}
          route={route}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          twilight={twilight}
        />
      </View>
    </View>
  );
});

export const TabRail = React.memo(function TabRail({
  destinations,
  activeTab,
  route,
  reducedMotion,
  onSelect,
  twilight = false,
  accessibilityLabel,
  activeLabelColor,
  waitForSelection = false,
}: {
  destinations: readonly TabDestinationItem[];
  activeTab: string;
  route: string;
  reducedMotion: boolean;
  onSelect: (name: string, intent: TabSelectionIntent) => void;
  twilight?: boolean;
  accessibilityLabel?: string;
  activeLabelColor?: string;
  waitForSelection?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const destinationNames = useMemo(
    () => destinations.map(({ name }) => name),
    [destinations],
  );
  const [rowWidth, setRowWidth] = useState(0);
  const [frames, setFrames] = useState(() => new Map<string, TabFrame>());
  const row = useRef<React.ComponentRef<typeof View>>(null);
  const rowBounds = useRef<{ x: number; y: number; height: number } | null>(
    null,
  );
  const refreshRowBounds = useCallback(() => {
    row.current?.measure((_x, _y, width, height, x, y) => {
      if (width > 0 && height > 0) rowBounds.current = { x, y, height };
    });
  }, []);
  const measureRow = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0) {
        setRowWidth(width);
        refreshRowBounds();
      }
    },
    [refreshRowBounds],
  );
  const measureTab = useCallback((name: string, { x, width }: TabFrame) => {
    setFrames((previous) => {
      const old = previous.get(name);
      if (old?.x === x && old.width === width) return previous;
      return new Map(previous).set(name, { x, width });
    });
  }, []);
  const stops = useMemo(
    () => measuredTabStops(destinationNames, frames, rowWidth, spotlightSize),
    [destinationNames, frames, rowWidth],
  );
  const [spotlightX] = useState(() => new Animated.Value(0));
  const gestureState = useRef({
    activeTab,
    onSelect,
    reducedMotion,
    stops,
    waitForSelection,
  });
  gestureState.current = {
    activeTab,
    onSelect,
    reducedMotion,
    stops,
    waitForSelection,
  };
  const laidOutStops = useRef<readonly TabStop[] | null>(null);
  const previousRoute = useRef(route);
  const goal = useRef<number | null>(null);
  const drag = useRef<"horizontal" | "vertical" | null>(null);
  const suppressPressUntil = useRef(0);
  const clearPressSuppression = useCallback(() => {
    if (!drag.current) suppressPressUntil.current = 0;
  }, []);
  const settle = useCallback(
    (name: string, immediate = false) => {
      const state = gestureState.current;
      const target = state.stops.find((stop) => stop.name === name)?.center;
      if (target === undefined || (goal.current === target && !immediate))
        return;
      goal.current = target;
      if (immediate || state.reducedMotion) {
        spotlightX.setValue(target - spotlightSize / 2);
      } else {
        Animated.timing(spotlightX, {
          toValue: target - spotlightSize / 2,
          duration: 145,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
          isInteraction: false,
        }).start();
      }
    },
    [spotlightX],
  );
  useLayoutEffect(() => {
    const geometryChanged = laidOutStops.current !== stops;
    const navigationChanged = previousRoute.current !== route;
    laidOutStops.current = stops;
    previousRoute.current = route;
    if (geometryChanged || navigationChanged) drag.current = null;
    if (!drag.current) settle(activeTab, geometryChanged || reducedMotion);
  }, [activeTab, reducedMotion, route, settle, stops]);
  useLayoutEffect(
    () => () => {
      drag.current = null;
      laidOutStops.current = null;
      spotlightX.stopAnimation();
    },
    [spotlightX],
  );
  const selectByPress = useCallback(
    (name: string, nonPointer = false) => {
      if (
        drag.current ||
        (!nonPointer && Date.now() < suppressPressUntil.current)
      )
        return;
      const { activeTab, onSelect, waitForSelection } = gestureState.current;
      if (name === activeTab) onSelect(name, "reselect");
      else {
        if (!waitForSelection) settle(name);
        onSelect(name, "switch");
      }
    },
    [settle],
  );
  const railGesture = useMemo(() => {
    const update = (pageX: number) => {
      const bounds = rowBounds.current;
      const { stops } = gestureState.current;
      if (drag.current !== "horizontal" || !bounds || !stops.length) return;
      goal.current = null;
      spotlightX.setValue(
        clampTabCenter(pageX - bounds.x, stops) - spotlightSize / 2,
      );
    };
    const finish = (destination?: string) => {
      if (!drag.current) return;
      drag.current = null;
      if (Platform.OS === "web") suppressPressUntil.current = Date.now() + 100;
      const { activeTab, onSelect, waitForSelection } = gestureState.current;
      settle(waitForSelection ? activeTab : (destination ?? activeTab));
      if (destination && destination !== activeTab)
        onSelect(destination, "switch");
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: (event) => {
        if (event.nativeEvent.touches.length === 1) {
          suppressPressUntil.current = 0;
          refreshRowBounds();
        }
        return false;
      },
      onMoveShouldSetPanResponderCapture: (
        _event,
        { dx, dy, numberActiveTouches },
      ) => {
        if (!gestureState.current.stops.length || !rowBounds.current)
          return false;
        const intent = dragIntent(dx, dy);
        if (intent === "pending" && numberActiveTouches === 1) return false;
        drag.current =
          numberActiveTouches === 1 && intent === "horizontal"
            ? "horizontal"
            : "vertical";
        return true;
      },
      onPanResponderGrant: ({ nativeEvent }) => update(nativeEvent.pageX),
      onPanResponderMove: ({ nativeEvent }, { numberActiveTouches }) => {
        if (numberActiveTouches === 1) update(nativeEvent.pageX);
        else if (drag.current === "horizontal") {
          drag.current = "vertical";
          settle(gestureState.current.activeTab);
        }
      },
      onPanResponderRelease: ({ nativeEvent }) => {
        const bounds = rowBounds.current;
        const { activeTab, stops } = gestureState.current;
        if (
          drag.current === "horizontal" &&
          bounds &&
          stops.length &&
          nativeEvent.pageY >= bounds.y - verticalReleaseSlop &&
          nativeEvent.pageY <= bounds.y + bounds.height + verticalReleaseSlop
        ) {
          finish(
            nearestTab(nativeEvent.pageX - bounds.x, stops, activeTab).name,
          );
        } else finish();
      },
      onPanResponderReject: () => finish(),
      onPanResponderTerminate: () => finish(),
    });
  }, [refreshRowBounds, settle, spotlightX]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        drag.current = null;
        settle(gestureState.current.activeTab, true);
      }
    });
    return () => subscription.remove();
  }, [settle]);
  // Start opaque until the OS accessibility preference has been read.
  const [reduceTransparency, setReduceTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduceTransparency(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const glass =
    Platform.OS === "ios" &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const light = resolved === "light";
  const inactiveInk = light ? lightGlass.ink : colors.muted;
  const compactLabels =
    android && destinations.length === 5 && rowWidth > 0 && rowWidth < 320;
  const items = (
    <View
      ref={row}
      collapsable={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={measureRow}
      {...railGesture.panHandlers}
      style={styles.items}
    >
      {stops.length > 0 && (
        <Animated.View
          testID="tab-spotlight"
          pointerEvents="none"
          accessible={false}
          style={[
            styles.spotlight,
            {
              backgroundColor: colors.tabActiveSurface,
              transform: [{ translateX: spotlightX }],
            },
          ]}
        />
      )}
      {destinations.map((destination) => {
        const selected = activeTab === destination.name;
        return (
          <TabDestination
            key={destination.name}
            destination={destination}
            selected={selected}
            ink={selected ? colors.tabActiveText : inactiveInk}
            labelInk={
              selected
                ? (activeLabelColor ?? colors.tabActiveText)
                : inactiveInk
            }
            compactLabel={compactLabels}
            reducedMotion={reducedMotion}
            onMeasure={measureTab}
            onPressStart={clearPressSuppression}
            onSelect={selectByPress}
          />
        );
      })}
    </View>
  );
  const radius = android ? 28 : 36;
  const shape = { borderRadius: radius, overflow: "hidden" as const };
  const edge = light && {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lightGlass.edge,
  };
  const lightVeil = light && (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: lightGlass.veil }]}
    />
  );
  return glass ? (
    <GlassView
      glassEffectStyle="regular"
      colorScheme={resolved}
      tintColor={light ? lightGlass.tint : undefined}
      style={light ? [shape, edge] : shape}
    >
      {lightVeil}
      {items}
    </GlassView>
  ) : Platform.OS === "ios" && !reduceTransparency ? (
    <BlurView
      intensity={light ? 68 : 85}
      tint={
        resolved === "dark"
          ? "systemChromeMaterialDark"
          : "systemChromeMaterialLight"
      }
      style={[
        shape,
        {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: light ? lightGlass.edge : colors.border,
        },
      ]}
    >
      {lightVeil}
      {items}
    </BlurView>
  ) : (
    <View
      style={[
        shape,
        {
          backgroundColor:
            light && Platform.OS !== "ios"
              ? lightGlass.fallback
              : twilight && resolved === "dark"
                ? "#211D2B"
                : colors.surface,
          borderWidth: 1,
          borderColor: light
            ? lightGlass.edge
            : twilight && resolved === "dark"
              ? "#3E344B"
              : colors.border,
        },
      ]}
    >
      {items}
    </View>
  );
});

const styles = StyleSheet.create({
  items: {
    flexDirection: "row",
    padding: rowPadding,
    alignItems: "stretch",
    ...(Platform.OS === "web" ? { touchAction: "pan-y" } : {}),
  },
  spotlight: {
    position: "absolute",
    ...(I18nManager.isRTL ? { end: 0 } : { start: 0 }),
    top: rowPadding,
    width: spotlightSize,
    height: spotlightSize,
    borderRadius: spotlightSize / 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    paddingBottom: 3,
    backgroundColor: "transparent",
  },
  pressed: { opacity: 0.65 },
  label: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    alignSelf: android ? "stretch" : undefined,
    paddingHorizontal: android ? 1 : undefined,
  },
  iconFrame: {
    width: spotlightSize,
    height: spotlightSize,
    alignItems: "center",
    justifyContent: "center",
  },
});
