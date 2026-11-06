import React, { useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, Switch, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  deviceLockAvailability,
  deviceLockDelays,
  type DeviceLockSettings,
} from "../device-lock";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, Button, Card, Icon, Row, Screen } from "../ui";

const delayLabels = {
  0: "Immediately",
  60: "After 1 minute",
  300: "After 5 minutes",
};
const unavailableLabels = {
  "mobile-only": "Biometric Lock is available in the mobile app.",
  "no-hardware": "This device does not have supported biometric hardware.",
  "not-enrolled":
    "Set up Face ID, Touch ID, or a fingerprint in your device settings first.",
  "not-strong":
    "Set up a supported fingerprint or strong face unlock in your device settings first.",
  unavailable: "Biometrics are unavailable on this device right now.",
};

export function DeviceLockSettingsCard() {
  const app = useApp();
  const { colors } = useTheme();
  const [availability, setAvailability] = useState<Awaited<
    ReturnType<typeof deviceLockAvailability>
  > | null>(null);
  const [error, setError] = useState("");
  const appDelay = app.deviceLock?.appDelay ?? null;
  const journal = app.deviceLock?.journal === true;
  useEffect(() => {
    let active = true;
    const check = () =>
      void deviceLockAvailability().then((result) => {
        if (active) setAvailability(result);
      });
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  function save(settings: DeviceLockSettings) {
    setError("");
    void app.updateDeviceLock(settings).catch((reason: unknown) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update Biometric Lock.",
      );
    });
  }
  return (
    <Card style={styles.settings}>
      <Row style={{ gap: 8 }}>
        <Icon
          name="finger-print-outline"
          size={20}
          color={colors.lavenderText}
        />
        <AppText variant="heading" style={{ flex: 1 }}>
          Biometric Lock
        </AppText>
      </Row>
      <AppText color={colors.muted}>
        Require biometrics to open Solace or My Journal on this device.
      </AppText>
      {availability && availability !== "ready" && (
        <AppText color={colors.muted}>
          {unavailableLabels[availability]}
        </AppText>
      )}
      {(availability === "ready" || appDelay !== null) && (
        <Row style={styles.option}>
          <AppText variant="label" style={{ flex: 1 }}>
            Lock Solace
          </AppText>
          <Switch
            accessibilityLabel="Lock Solace"
            value={appDelay !== null}
            disabled={app.deviceLockBusy}
            onValueChange={(enabled) =>
              save({ appDelay: enabled ? 60 : null, journal })
            }
          />
        </Row>
      )}
      {appDelay !== null && (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" color={colors.muted}>
            When Solace is in the background
          </AppText>
          {deviceLockDelays.map((delay) => (
            <Button
              key={delay}
              title={delayLabels[delay]}
              variant={appDelay === delay ? "primary" : "secondary"}
              disabled={app.deviceLockBusy || appDelay === delay}
              onPress={() => save({ appDelay: delay, journal })}
            />
          ))}
          <AppText variant="caption" color={colors.muted}>
            Solace also locks whenever it starts again.
          </AppText>
        </View>
      )}
      {(availability === "ready" || journal) && (
        <Row style={styles.option}>
          <AppText variant="label" style={{ flex: 1 }}>
            Lock My Journal
          </AppText>
          <Switch
            accessibilityLabel="Lock My Journal"
            value={journal}
            disabled={app.deviceLockBusy}
            onValueChange={(enabled) => save({ appDelay, journal: enabled })}
          />
        </Row>
      )}
      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </Card>
  );
}

export function DeviceUnlockScreen({ scope }: { scope: "app" | "journal" }) {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const [error, setError] = useState("");
  const journal = scope === "journal";
  const [recovering, setRecovering] = useState(false);
  const label = journal ? "Unlock My Journal" : "Unlock Solace";
  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not unlock. Please try again.",
      );
    }
  }
  return (
    <Screen style={styles.unlock}>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <View
        style={[styles.symbol, { backgroundColor: colors.lavenderSurface }]}
      >
        <Icon
          name="lock-closed-outline"
          size={28}
          color={colors.lavenderText}
        />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {label}
      </AppText>
      <AppText color={colors.muted}>
        {journal
          ? "Confirm your device biometrics to open your private entries."
          : "Confirm your device biometrics to continue to your saved space."}
      </AppText>
      {error ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {!!app.deviceLock && (
        <Button
          title="Unlock with biometrics"
          icon="finger-print-outline"
          loading={app.deviceLockBusy}
          disabled={app.busy || recovering}
          onPress={() => void run(() => app.unlockDeviceLock(scope))}
        />
      )}
      {recovering ? (
        <Card style={{ gap: 10 }}>
          <AppText color={colors.muted}>
            Sign out of this device and use your normal sign-in to recover
            access. Unsynced device-only drafts and edits will be cleared.
          </AppText>
          <Button
            title="Sign out and sign in again"
            disabled={app.busy || app.deviceLockBusy}
            onPress={() => void run(app.signOut)}
          />
          <Button
            title="Keep this session"
            variant="ghost"
            disabled={app.busy}
            onPress={() => setRecovering(false)}
          />
        </Card>
      ) : (
        <Button
          title="Sign in again instead"
          variant="secondary"
          disabled={app.deviceLockBusy || app.busy}
          onPress={() => setRecovering(true)}
        />
      )}
      {journal && (
        <Button
          title="Leave My Journal"
          variant="ghost"
          disabled={app.deviceLockBusy || app.busy}
          onPress={() => (app.canGoBack ? app.back() : app.navigate("today"))}
        />
      )}
    </Screen>
  );
}

export function DevicePrivacyCover() {
  const { colors } = useTheme();
  return Platform.OS !== "web" ? (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.cover,
        { backgroundColor: colors.bg },
      ]}
      accessibilityViewIsModal
    >
      <Icon name="lock-closed-outline" color={colors.lavenderText} size={24} />
      <AppText variant="title">Solace</AppText>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  settings: { gap: 10, marginBottom: 16 },
  option: { minHeight: 48, justifyContent: "space-between" },
  unlock: { flexGrow: 1, justifyContent: "center", gap: 14 },
  symbol: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  cover: { alignItems: "center", justifyContent: "center", gap: 10 },
});
