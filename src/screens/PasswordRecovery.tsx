import React, { useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { spacing } from "../layout";
import { useApp } from "../store";
import { useTheme } from "../theme";
import { AppText, BrandMark, Button, Input, Screen } from "../ui";

export function PasswordRecoveryScreen({
  onBack,
  initialEmail,
}: {
  onBack: () => void;
  initialEmail: string;
}) {
  const { requestPasswordReset, resetPassword } = useApp();
  const { colors } = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "complete">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onBack]);

  async function submit(reset: boolean) {
    if (request.current) return;
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter the email address you use for Solace.");
      return;
    }
    if (
      reset &&
      (!/^[A-Za-z0-9_-]{16}$/.test(code.trim()) || password.length < 8)
    ) {
      setError(
        "Enter the code from your email and a password with at least 8 characters.",
      );
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      if (reset) {
        await resetPassword(
          email.trim(),
          code.trim(),
          password,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setCode("");
        setPassword("");
        setStage("complete");
      } else {
        await requestPasswordReset(email.trim(), controller.signal);
        if (controller.signal.aborted) return;
        setStage("code");
        setNotice(
          "If this address has a Solace password, a code will arrive by email. It expires in 10 minutes.",
        );
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      const problem = failure as { code?: string; status?: number };
      setError(
        problem.code === "RECOVERY_UNAVAILABLE"
          ? __DEV__
            ? "Password recovery needs SMTP settings on the Solace server."
            : "Password recovery is temporarily unavailable. Please try again later."
          : problem.code === "RECOVERY_CODE_INVALID"
            ? "That code is invalid or expired. Request another code and try again."
            : problem.status === 429
              ? "Too many attempts. Wait a moment and try again."
              : problem.status === 400 && !reset
                ? "Enter a valid email address."
                : "Solace couldn’t complete this request. Please try again.",
      );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Screen title="Password recovery" back={onBack} style={styles.screen}>
      <BrandMark />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {stage === "complete" ? "Password updated" : "Reset your password"}
        </AppText>
        <AppText color={colors.muted}>
          {stage === "complete"
            ? "You can now log in with your new password."
            : stage === "code"
              ? "Enter your email code and choose a new password."
              : "We’ll email a reset code for your Solace password."}
        </AppText>
      </View>
      {stage === "complete" ? (
        <Button title="Back to log in" onPress={onBack} />
      ) : (
        <View style={styles.form}>
          <AppText variant="label">Email</AppText>
          <Input
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!busy && stage === "email"}
          />
          {stage === "code" && (
            <>
              <AppText variant="label">Recovery code</AppText>
              <Input
                accessibilityLabel="Recovery code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="oneTimeCode"
                editable={!busy}
              />
              <AppText variant="label">New password</AppText>
              <Input
                accessibilityLabel="New password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!busy}
                maxLength={128}
                onSubmitEditing={() => void submit(true)}
              />
            </>
          )}
          {error ? (
            <AppText accessibilityRole="alert" color={colors.danger}>
              {error}
            </AppText>
          ) : null}
          {notice ? (
            <AppText accessibilityLiveRegion="polite" color={colors.muted}>
              {notice}
            </AppText>
          ) : null}
          <Button
            title={
              stage === "email" ? "Email a reset code" : "Save new password"
            }
            loading={busy}
            onPress={() => void submit(stage === "code")}
          />
          {stage === "code" && (
            <Button
              title="Change email or request another code"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setStage("email");
                setCode("");
                setPassword("");
                setNotice("");
                setError("");
              }}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.section },
  intro: { gap: spacing.compact },
  form: { gap: spacing.row },
});
