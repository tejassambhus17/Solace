import { useWindowDimensions } from "react-native";

export const spacing = {
  compact: 8,
  row: 12,
  card: 16,
  screenTop: 18,
  section: 24,
  bottom: 32,
} as const;

export function useScreenGutter() {
  return useWindowDimensions().width < 360 ? spacing.card : spacing.section;
}
