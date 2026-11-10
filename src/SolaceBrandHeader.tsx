import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useScreenGutter } from "./layout";
import { AppText, LotusMark, Row } from "./ui";

export function useMainTabHeaderInsets() {
  const { top, left, right } = useSafeAreaInsets();
  const gutter = useScreenGutter();
  return {
    paddingTop: top + spacing.compact,
    paddingLeft: gutter + left,
    paddingRight: gutter + right,
  };
}

export function MainTabHeader({
  color,
  children,
  style,
}: {
  color?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row style={[styles.header, style]}>
      <SolaceBrandHeader color={color} />
      {children && <Row style={styles.actions}>{children}</Row>}
    </Row>
  );
}

export function SolaceBrandHeader({
  color,
  style,
}: {
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row style={[styles.lockup, style]}>
      <LotusMark size={30} />
      <AppText
        variant="heading"
        color={color}
        style={styles.wordmark}
        numberOfLines={1}
        maxFontSizeMultiplier={1.5}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        Solace
      </AppText>
    </Row>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 48,
    gap: spacing.compact,
    justifyContent: "space-between",
  },
  actions: { gap: spacing.compact, flexShrink: 0 },
  lockup: { gap: 6, flexShrink: 1 },
  wordmark: { fontSize: 24, lineHeight: 28, flexShrink: 1 },
});
