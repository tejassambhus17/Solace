import React, { type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { spacing, useScreenGutter } from "../layout";
import { SolaceBrandHeader } from "../SolaceBrandHeader";
import { useTheme } from "../theme";

export function OnboardingLayout({
  testID,
  children,
  leading,
  trailing,
  footer,
}: {
  testID: string;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  footer: ReactNode;
}) {
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const canvas = resolved === "dark" ? colors.bg : colors.surface;

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.frame, { backgroundColor: canvas }]}
    >
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <View
        style={[styles.column, styles.header, { paddingHorizontal: gutter }]}
      >
        <View style={styles.brand}>
          {leading}
          <SolaceBrandHeader />
        </View>
        {trailing}
      </View>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View
          style={[styles.column, styles.body, { paddingHorizontal: gutter }]}
        >
          {children}
        </View>
      </ScrollView>
      <View
        style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <View
          style={[styles.column, styles.footer, { paddingHorizontal: gutter }]}
        >
          {footer}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  column: { width: "100%", maxWidth: 480, alignSelf: "center" },
  header: {
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.compact,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    flexShrink: 1,
  },
  scroll: { flex: 1 },
  body: { paddingTop: spacing.compact, paddingBottom: spacing.section },
  footer: {
    paddingTop: spacing.row,
    paddingBottom: spacing.row,
    gap: spacing.compact,
  },
});
