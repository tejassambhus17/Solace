import { Platform } from "react-native";

export function switchColors(
  colors: {
    border: string;
    primary: string;
    primaryText: string;
    muted: string;
    surface2: string;
  },
  enabled: boolean,
) {
  return {
    trackColor: { false: colors.border, true: colors.primary },
    thumbColor:
      enabled && Platform.OS !== "web" ? colors.primaryText : colors.muted,
    ios_backgroundColor: colors.surface2,
    ...(Platform.OS === "web" ? { activeThumbColor: colors.primaryText } : {}),
  };
}
