import React from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { AppText } from "./ui";
import { useTheme } from "./theme";
import { nativeModulesAvailable } from "./native-features";
import type { AmbientSoundImpl } from "./AmbientSoundImpl";

export function AmbientSound(
  props: React.ComponentProps<typeof AmbientSoundImpl>,
) {
  const { colors } = useTheme();
  if (
    !nativeModulesAvailable(Platform.OS, requireOptionalNativeModule, [
      "ExpoAudio",
    ])
  )
    return (
      <AppText
        variant="caption"
        color={colors.muted}
        style={{ paddingVertical: 14, textAlign: "center" }}
      >
        Ambient sound isn't available in this build. Continue quietly.
      </AppText>
    );
  const Player = require("./AmbientSoundImpl")
    .AmbientSoundImpl as React.ComponentType<typeof props>;
  return <Player {...props} />;
}
