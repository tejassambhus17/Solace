import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const deviceLockDelays = [0, 60, 300] as const;
export type DeviceLockDelay = (typeof deviceLockDelays)[number];
export type DeviceLockSettings = {
  appDelay: DeviceLockDelay | null;
  journal: boolean;
};
export type DeviceLockPolicy = DeviceLockSettings & { owner: string };

export class DeviceLockError extends Error {
  constructor(
    message: string,
    readonly canRetry: boolean,
  ) {
    super(message);
  }
}

const policyKey = "solace.biometric.policy.v1";
const biometricKey = "solace.biometric.proof.v1";
const keychain = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const biometricOptions = (authenticationPrompt: string) => ({
  ...keychain,
  requireAuthentication: true,
  authenticationPrompt,
});

export async function readDeviceLock(): Promise<DeviceLockPolicy | null> {
  if (Platform.OS === "web") return null;
  const value = await SecureStore.getItemAsync(policyKey, keychain);
  if (!value) return null;
  const policy = JSON.parse(value) as DeviceLockPolicy | null;
  if (
    !policy ||
    typeof policy.owner !== "string" ||
    !policy.owner ||
    typeof policy.journal !== "boolean" ||
    (policy.appDelay !== null && !deviceLockDelays.includes(policy.appDelay))
  )
    throw new Error("Could not read this device’s biometric settings.");
  return policy;
}

export async function deviceLockAvailability() {
  if (Platform.OS === "web") return "mobile-only";
  try {
    // Delay evaluating the native module so an older development client can
    // still open Solace and show the unavailable state in Settings.
    const LocalAuthentication: typeof import("expo-local-authentication") = require("expo-local-authentication");
    if (!(await LocalAuthentication.hasHardwareAsync())) return "no-hardware";
    if (!(await LocalAuthentication.isEnrolledAsync())) return "not-enrolled";
    if (
      Platform.OS === "android" &&
      (await LocalAuthentication.getEnrolledLevelAsync()) !==
        LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
    )
      return "not-strong";
    return SecureStore.canUseBiometricAuthentication()
      ? "ready"
      : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function verifyDeviceLock(owner: string, prompt: string) {
  // This key is bound to the enrolled biometric set. A freshly enrolled
  // biometric cannot release the old key, even if the hardware still works.
  let proof: string | null;
  try {
    proof = await SecureStore.getItemAsync(
      biometricKey,
      biometricOptions(prompt),
    );
  } catch {
    const canRetry = (await deviceLockAvailability()) === "ready";
    throw new DeviceLockError(
      canRetry
        ? "Biometric confirmation did not finish. Try again, or sign in again to recover access."
        : "Biometrics are unavailable. Sign in again to continue.",
      canRetry,
    );
  }
  if (proof !== owner)
    throw new DeviceLockError(
      "Biometrics may have changed. Sign in again to set up a new lock.",
      false,
    );
}

export async function provisionDeviceLock(owner: string) {
  if ((await deviceLockAvailability()) !== "ready")
    throw new Error(
      "Set up supported biometrics in your device settings first.",
    );
  const prompt = "Confirm your biometrics for Solace";
  try {
    // Remove an orphaned key first so an old or invalid enrollment cannot
    // prevent a fresh setup after successful account recovery.
    await SecureStore.deleteItemAsync(biometricKey, keychain);
    await SecureStore.setItemAsync(
      biometricKey,
      owner,
      biometricOptions(prompt),
    );
    // Android authenticates during the write. iOS authenticates on read.
    if (Platform.OS === "ios") await verifyDeviceLock(owner, prompt);
  } catch {
    throw new Error(
      "Biometric setup did not finish. Try again when you’re ready.",
    );
  }
}

export async function persistDeviceLock(policy: DeviceLockPolicy | null) {
  if (Platform.OS === "web") return;
  if (policy) {
    await SecureStore.setItemAsync(policyKey, JSON.stringify(policy), keychain);
  } else {
    await SecureStore.deleteItemAsync(policyKey, keychain);
    // The proof is unusable without its policy and a current account session.
    await SecureStore.deleteItemAsync(biometricKey, keychain).catch(() => {});
  }
}
