import { Platform, useWindowDimensions } from "react-native";

export const spacing = {
  compact: 8,
  row: 12,
  card: 16,
  screenTop: 18,
  section: 24,
  bottom: 32,
} as const;

export function useScreenGutter() {
  const { width } = useWindowDimensions();
  const compactWidth = Platform.OS === "android" ? 600 : 360;
  return width < compactWidth ? spacing.card : spacing.section;
}
