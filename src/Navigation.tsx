import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
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
import { useApp } from "./store";
import { useTheme } from "./theme";
import { AppText, Icon } from "./ui";

const tabs = [
  { name: "today", title: "Today", icon: "home-outline", active: "home" },
  { name: "chat", title: "Solace", icon: "leaf-outline", active: "leaf" },
  {
    name: "journey",
    title: "Journey",
    icon: "analytics-outline",
    active: "analytics",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    active: "person",
  },
];

export function TabBar({ onHeight }: { onHeight: (height: number) => void }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const android = Platform.OS === "android";
  const selectedSurface =
    resolved === "dark" ? colors.surface2 : colors.lavenderSurface;
  const selectedInk =
    resolved === "dark" ? colors.primary : colors.lavenderText;
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
    <View style={{ flexDirection: "row", padding: 5, alignItems: "stretch" }}>
      {tabs.map((tab) => {
        const selected = app.activeTab === tab.name;
        return (
          <Pressable
            key={tab.name}
            onPress={() => app.setTab(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            accessibilityLabel={tab.title}
            android_ripple={{
              color: colors.lavenderSurface,
              borderless: false,
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 60,
              minWidth: android ? 48 : 44,
              borderRadius: 29,
              paddingVertical: 7,
              paddingHorizontal: 1,
              gap: 4,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                selected && !android ? selectedSurface : "transparent",
              overflow: "hidden",
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <View
              style={
                android
                  ? {
                      width: 54,
                      height: 30,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected
                        ? selectedSurface
                        : "transparent",
                    }
                  : undefined
              }
            >
              <Icon
                name={selected ? tab.active : tab.icon}
                size={23}
                color={selected ? selectedInk : colors.muted}
              />
            </View>
            <AppText
              variant="caption"
              color={selected ? selectedInk : colors.muted}
              style={{
                fontSize: 10.5,
                lineHeight: 15,
                fontFamily: selected ? "Inter_600SemiBold" : "Inter_400Regular",
              }}
            >
              {tab.title}
            </AppText>
          </Pressable>
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
        paddingBottom: Math.max(insets.bottom, 10),
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
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            {items}
          </View>
        )}
      </View>
    </View>
  );
}
