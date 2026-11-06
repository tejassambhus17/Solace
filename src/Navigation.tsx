import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { useReducedMotion } from "./Companion";
import { useTheme } from "./theme";
import { AppText, Icon } from "./ui";

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

const TabDestination = React.memo(function TabDestination({
  destination,
  selected,
  ink,
  rippleColor,
  onSelect,
}: {
  destination: (typeof destinations)[number];
  selected: boolean;
  ink: string;
  rippleColor: string;
  onSelect: (name: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(destination.name)}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={destination.title}
      android_ripple={android ? { color: rippleColor } : undefined}
      style={({ pressed }) => [
        styles.tab,
        !android && pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconFrame}>
        <Icon
          name={selected ? destination.active : destination.icon}
          size={22}
          color={ink}
        />
      </View>
      <AppText
        variant="caption"
        color={ink}
        style={styles.label}
      >
        {destination.title}
      </AppText>
    </Pressable>
  );
});

export const TabBar = React.memo(function TabBar({
  activeTab,
  route,
  onSelect,
  onHeight,
}: {
  activeTab: string;
  route: string;
  onSelect: (name: string) => void;
  onHeight: (height: number) => void;
}) {
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const onToday = route === "today";
  const onExplore = route === "explore";
  const twilight = resolved === "dark" && onToday;
  const twilightExplore = resolved === "dark" && onExplore;
  const bottomInset = Math.max(insets.bottom, 10);
  const reducedMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);
  const [spotlightX] = useState(() => new Animated.Value(0));
  const measuredWidth = useRef(0);
  const lastTarget = useRef<number | undefined>(undefined);
  const selectedIndex = destinations.findIndex(
    ({ name }) => name === activeTab,
  );
  useLayoutEffect(() => {
    if (!rowWidth || selectedIndex < 0) return;
    const index = I18nManager.isRTL
      ? destinations.length - 1 - selectedIndex
      : selectedIndex;
    const tabWidth = (rowWidth - rowPadding * 2) / destinations.length;
    const center = rowPadding + (index + 0.5) * tabWidth;
    const target = center - spotlightSize / 2;
    const snap =
      reducedMotion ||
      measuredWidth.current !== rowWidth ||
      lastTarget.current === target;
    measuredWidth.current = rowWidth;
    lastTarget.current = target;
    if (snap) {
      spotlightX.setValue(target);
      return;
    }
    const motion = Animated.timing(spotlightX, {
      toValue: target,
      duration: 145,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    motion.start();
    return () => motion.stop();
  }, [reducedMotion, rowWidth, selectedIndex, spotlightX]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && lastTarget.current !== undefined)
        spotlightX.setValue(lastTarget.current);
    });
    return () => subscription.remove();
  }, [spotlightX]);
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
  const items = (
    <View
      accessibilityRole="tablist"
      onLayout={({ nativeEvent }) => {
        const width = nativeEvent.layout.width;
        if (width > 0) setRowWidth(width);
      }}
      style={styles.items}
    >
      {rowWidth > 0 && (
        <Animated.View
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
            ink={selected ? colors.tabActiveText : colors.muted}
            rippleColor={resolved === "dark" ? "#FFFFFF24" : "#49326120"}
            onSelect={onSelect}
          />
        );
      })}
    </View>
  );
  const radius = android ? 28 : 36;
  const shape = { borderRadius: radius, overflow: "hidden" as const };
  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => onHeight(Math.ceil(event.nativeEvent.layout.height))}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: bottomInset,
      }}
    >
      {onToday && (
        <View
          pointerEvents="none"
          style={[
            styles.bottomSafeArea,
            {
              height: bottomInset + 16,
              backgroundColor: twilight ? "#14111D" : colors.bg,
            },
          ]}
        />
      )}
      <View
        style={{
          borderRadius: radius,
          boxShadow:
            resolved === "dark"
              ? "0 6px 24px rgba(0,0,0,0.5)"
              : "0 6px 24px rgba(48,30,20,0.12)",
        }}
      >
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme={resolved}
            style={shape}
          >
            {items}
          </GlassView>
        ) : Platform.OS === "ios" && !reduceTransparency ? (
          <BlurView
            intensity={85}
            tint={
              resolved === "dark"
                ? "systemChromeMaterialDark"
                : "systemChromeMaterialLight"
            }
            style={[
              shape,
              {
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              },
            ]}
          >
            {items}
          </BlurView>
        ) : (
          <View
            style={[
              shape,
              {
                backgroundColor:
                  twilight || twilightExplore ? "#211D2B" : colors.surface,
                borderWidth: 1,
                borderColor:
                  twilight || twilightExplore ? "#3E344B" : colors.border,
              },
            ]}
          >
            {items}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bottomSafeArea: { position: "absolute", left: 0, right: 0, bottom: 0 },
  items: { flexDirection: "row", padding: rowPadding, alignItems: "stretch" },
  spotlight: {
    position: "absolute",
    left: 0,
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
    borderRadius: 24,
  },
  pressed: { opacity: 0.65 },
  label: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  iconFrame: {
    width: spotlightSize,
    height: spotlightSize,
    alignItems: "center",
    justifyContent: "center",
  },
});
