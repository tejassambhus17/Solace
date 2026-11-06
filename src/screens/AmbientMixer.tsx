import React from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { nativeModulesAvailable } from "../native-features";
import { useApp } from "../store";
import { AppText, Screen } from "../ui";

export function AmbientMixerScreen() {
  const app = useApp();
  if (
    !nativeModulesAvailable(Platform.OS, requireOptionalNativeModule, [
      "ExpoAudio",
    ])
  ) {
    return (
      <Screen title="Ambient sound mixer" back={app.back}>
        <AppText>Sound playback is unavailable in this build.</AppText>
      </Screen>
    );
  }
  const Mixer = require("./AmbientMixerImpl")
    .AmbientMixerImpl as React.ComponentType;
  return <Mixer />;
}
