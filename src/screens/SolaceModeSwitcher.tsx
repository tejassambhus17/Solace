import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { SolaceMode } from "../routes";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Icon } from "../ui";

const options = [
  { mode: "companion", label: "Companion", icon: "chatbubble-outline" },
  { mode: "journal", label: "My Journal", icon: "book-outline" },
] as const;

export function SolaceModeSwitcher({ mode }: { mode: SolaceMode }) {
  const app = useApp();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.rail, { backgroundColor: colors.surface2 }]}>
        {options.map((option) => {
          const selected = option.mode === mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => {
                if (!selected) app.switchSolaceMode(option.mode);
              }}
              style={({ pressed }) => [
                styles.choice,
                {
                  backgroundColor: selected
                    ? colors.lavenderSurface
                    : "transparent",
                  opacity: pressed && !selected ? 0.65 : 1,
                },
              ]}
            >
              <Icon
                name={option.icon}
                size={16}
                color={selected ? colors.lavenderText : colors.muted}
              />
              <AppText
                variant="label"
                color={selected ? colors.lavenderText : colors.muted}
                style={styles.label}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 3, paddingBottom: 8 },
  rail: { borderRadius: 24, padding: 3, flexDirection: "row", gap: 3 },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 6,
  },
  label: { textAlign: "center", flexShrink: 1 },
});
