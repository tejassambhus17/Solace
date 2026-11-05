import React from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { AppText } from "./ui";
import { useTheme } from "./theme";
import { nativeModulesAvailable } from "./native-features";

import type { VoiceControlsImpl } from "./VoiceControlsImpl";
type VoiceProps = React.ComponentProps<typeof VoiceControlsImpl>;
export function VoiceControls(props: VoiceProps) {
  const { colors } = useTheme();
  if (
    !nativeModulesAvailable(Platform.OS, requireOptionalNativeModule, [
      "ExpoAudio",
      "ExpoSpeech",
      "FileSystem",
    ])
  )
    return (
      <AppText
        variant="caption"
        color={colors.muted}
        style={{ paddingVertical: 12 }}
      >
        Voice isn't available in this build. You can type your message below.
      </AppText>
    );
  const Controls = require("./VoiceControlsImpl")
    .VoiceControlsImpl as React.ComponentType<VoiceProps>;
  return <Controls {...props} />;
}
