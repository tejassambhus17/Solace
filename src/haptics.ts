import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
} from "expo-haptics";
import { Platform } from "react-native";

export async function playHaptic(kind: "selection" | "confirmation") {
  try {
    if (Platform.OS === "android") {
      await performAndroidHapticsAsync(
        kind === "selection"
          ? AndroidHaptics.Context_Click
          : Platform.Version >= 30
            ? AndroidHaptics.Confirm
            : AndroidHaptics.Long_Press,
      );
    } else if (Platform.OS === "ios") {
      if (kind === "selection") await impactAsync(ImpactFeedbackStyle.Light);
      else await notificationAsync(NotificationFeedbackType.Success);
    }
  } catch {
    // Haptics are optional and must never block the underlying action.
  }
}
