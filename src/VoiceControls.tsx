import React, { useState } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { ChatComposerControl } from "./ChatComposer";
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
  const microphone =
    variant === "talk" ? (
      <IconButton
        name="mic-off-outline"
        label="Voice availability"
        size={46}
        disabled={disabled}
        onPress={() => setShow(true)}
      />
    ) : (
      <ChatComposerControl
        icon="mic-off-outline"
        label="Voice availability"
        disabled={disabled}
        onPress={() => setShow(true)}
      />
    );
  const details = show && (
    <AppText
      variant="caption"
      color={colors.muted}
      accessibilityRole="alert"
      style={{ paddingVertical: 8 }}
    >
      Voice isn't available in this build. You can still type your message.
    </AppText>
  );
  if (renderComposer && variant !== "talk")
    return renderComposer(microphone, null, details || undefined);
  return (
    <>
      {details}
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
