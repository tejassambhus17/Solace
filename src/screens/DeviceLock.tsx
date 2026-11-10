import React, { useEffect, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  deviceLockAvailability,
  deviceLockDelays,
  type DeviceLockSettings,
} from "../device-lock";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { spacing } from "../layout";
import { switchColors } from "../switch-colors";
import { webRadioProps } from "../radio-keyboard";
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
      <Row style={styles.settingsHeader}>
        <View
          style={[
            styles.settingsIcon,
            { backgroundColor: colors.lavenderSurface },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Icon
            name="finger-print-outline"
            size={19}
            color={colors.lavenderText}
          />
        </View>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.settingsCopy}
        >
          Biometric Lock
        </AppText>
      </Row>
      <AppText color={colors.muted}>
        Require biometrics to open Solace or My Journal on this device.
      </AppText>
      {availability && availability !== "ready" && (
        <AppText variant="caption" color={colors.muted}>
          {unavailableLabels[availability]}
        </AppText>
      )}
      {(availability === "ready" || appDelay !== null) && (
        <Row style={styles.option}>
          <AppText variant="label" style={styles.settingsCopy}>
            Lock Solace
          </AppText>
          <Switch
            accessibilityLabel="Lock Solace"
            value={appDelay !== null}
            disabled={app.deviceLockBusy}
            {...switchColors(colors, appDelay !== null)}
            onValueChange={(enabled) =>
              save({ appDelay: enabled ? 60 : null, journal })
            }
          />
        </Row>
      )}
      {appDelay !== null && (
        <View style={styles.delayGroup}>
          <AppText variant="caption" color={colors.muted}>
            When Solace is in the background
          </AppText>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Biometric lock delay"
            style={styles.delayOptions}
          >
            {deviceLockDelays.map((delay) => {
              const selected = appDelay === delay;
              return (
                <Pressable
                  key={delay}
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked: selected,
                    disabled: app.deviceLockBusy,
                  }}
                  aria-checked={selected}
                  {...webRadioProps(selected)}
                  disabled={app.deviceLockBusy}
                  onPress={() => {
                    if (!selected) save({ appDelay: delay, journal });
                  }}
                  style={({ pressed }) => [
                    styles.delayChoice,
                    {
                      borderColor: selected ? colors.sageText : colors.border,
                      backgroundColor: selected
                        ? colors.sageSurface
                        : colors.surface,
                      opacity: pressed || app.deviceLockBusy ? 0.72 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    color={selected ? colors.sageText : colors.text}
                  >
                    {delayLabels[delay]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText variant="caption" color={colors.muted}>
            Solace also locks whenever it starts again.
          </AppText>
        </View>
      )}
      {(availability === "ready" || journal) && (
        <Row style={styles.option}>
          <AppText variant="label" style={styles.settingsCopy}>
            Lock My Journal
          </AppText>
          <Switch
            accessibilityLabel="Lock My Journal"
            value={journal}
            disabled={app.deviceLockBusy}
            {...switchColors(colors, journal)}
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
  const fallback =
    !journal && app.appUnlock.phase === "fallback" ? app.appUnlock : null;
  const message = error || fallback?.message;
  const canRetry = journal ? !!app.deviceLock : fallback?.canRetry;
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
      {message ? (
        <AppText color={colors.danger} accessibilityRole="alert">
          {message}
        </AppText>
      ) : null}
      {canRetry && (
        <Button
          title="Unlock with biometrics"
          icon="finger-print-outline"
          loading={app.deviceLockBusy}
          disabled={app.busy || recovering}
          onPress={() => {
            const unlock = () => app.unlockDeviceLock(scope);
            void (journal ? run(unlock) : unlock().catch(() => {}));
          }}
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
  settings: { gap: spacing.row },
  settingsHeader: { gap: spacing.row },
  settingsCopy: { flex: 1, minWidth: 0 },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  option: { minHeight: 48, justifyContent: "space-between", gap: spacing.row },
  delayGroup: { gap: spacing.compact },
  delayOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.compact,
  },
  delayChoice: {
    minHeight: 48,
    borderRadius: spacing.card,
    borderWidth: 1,
    paddingHorizontal: spacing.row,
    justifyContent: "center",
  },
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
