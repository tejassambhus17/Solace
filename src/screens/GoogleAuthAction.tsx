import React from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useFonts } from "expo-font";
import type { useGoogleAuth } from "../google-auth";
import { useTheme } from "../theme";
import { AppText, Button, Row } from "../ui";

export function GoogleAuthAction({
  auth,
  title,
  disabled = false,
  onPress,
}: {
  auth: ReturnType<typeof useGoogleAuth>;
  title: "Continue with Google" | "Link Google account";
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { colors, resolved } = useTheme();
  const [fontReady] = useFonts({
    SolaceGoogleLabel: require("../../assets/google-sign-in-label.ttf"),
  });
  const dark = resolved === "dark";
  const ink = dark ? "#E3E3E3" : "#1F1F1F";
  const loading = auth.busy || auth.availability === "checking";
  const inactive = disabled || loading || auth.availability !== "available";
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress ?? (() => void auth.start())}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: dark ? "#131314" : "#FFFFFF",
            borderColor: dark ? "#8E918F" : "#747775",
            opacity: pressed ? 0.78 : inactive && !loading ? 0.62 : 1,
          },
        ]}
      >
        <Row style={styles.buttonContent}>
          <View style={styles.markFrame}>
            {loading ? (
              <ActivityIndicator size="small" color={ink} />
            ) : (
              <Image
                source={require("../../assets/google-sign-in-mark.png")}
                resizeMode="contain"
                accessible={false}
                accessibilityIgnoresInvertColors
                style={styles.mark}
              />
            )}
          </View>
          <AppText
            variant="label"
            color={ink}
            style={[styles.label, fontReady && styles.googleFont]}
          >
            {title}
          </AppText>
        </Row>
      </Pressable>
      {auth.notice && (
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.notice}
          accessibilityLiveRegion="polite"
        >
          {auth.notice}
        </AppText>
      )}
      {auth.availability === "failed" && (
        <Button
          title="Retry Google availability"
          variant="ghost"
          disabled={disabled}
          onPress={auth.retry}
        />
      )}
      {auth.message && (
        <AppText
          variant="caption"
          color={auth.message.error ? colors.danger : colors.muted}
          accessibilityRole={auth.message.error ? "alert" : undefined}
          accessibilityLiveRegion="polite"
          style={styles.notice}
        >
          {auth.message.text}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 },
  button: {
    minHeight: 52,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: Platform.OS === "ios" ? 16 : 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: { gap: Platform.OS === "ios" ? 12 : 10 },
  markFrame: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { width: 18, height: 18 },
  label: { fontSize: 14, lineHeight: 20, textAlign: "center", flexShrink: 1 },
  googleFont: { fontFamily: "SolaceGoogleLabel" },
  notice: { textAlign: "center" },
});
