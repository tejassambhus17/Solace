import React, { useState } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { AppText, IconButton } from "./ui";
import { useTheme } from "./theme";
import { nativeModulesAvailable } from "./native-features";

import type { VoiceControlsImpl } from "./VoiceControlsImpl";
type VoiceProps = React.ComponentProps<typeof VoiceControlsImpl>;
function UnavailableVoiceControls({
  disabled,
  renderComposer,
  variant,
}: VoiceProps) {
  const [show, setShow] = useState(variant === "talk");
  const { colors } = useTheme();
  const microphone = (
    <IconButton
      name="mic-off-outline"
      label="Voice availability"
      size={46}
      disabled={disabled}
      onPress={() => setShow(true)}
    />
  );
  return (
    <>
      {show && (
        <AppText
          variant="caption"
          color={colors.muted}
          accessibilityRole="alert"
          style={{ paddingVertical: 8 }}
        >
          Voice isn't available in this build. You can still type your message.
        </AppText>
      )}
      {renderComposer ? renderComposer(microphone, null) : microphone}
    </>
  );
}

export function VoiceControls(props: VoiceProps) {
  if (
    !nativeModulesAvailable(Platform.OS, requireOptionalNativeModule, [
      "ExpoAudio",
      "ExpoSpeech",
      "FileSystem",
    ])
  )
    return <UnavailableVoiceControls {...props} />;
  const Controls = require("./VoiceControlsImpl")
    .VoiceControlsImpl as React.ComponentType<VoiceProps>;
  return <Controls {...props} />;
}
