import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "./theme";
import { Icon } from "./ui";

export const chatControlSize = 48;
const lineHeight = 22;
const inputPadding = 10;

export function VoiceWaveform({
  color,
  size = 20,
}: {
  color: string;
  size?: number;
}) {
  return (
    <MaterialCommunityIcons
      name="waveform"
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      allowFontScaling={false}
    />
  );
}

export function ChatComposerInput({
  inputRef,
  value,
  editable,
  onChangeText,
}: {
  inputRef: React.RefObject<React.ElementRef<typeof TextInput> | null>;
  value: string;
  editable: boolean;
  onChangeText: (text: string) => void;
}) {
  const { colors, resolved } = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const minHeight = Math.max(
    chatControlSize,
    Math.ceil(lineHeight * fontScale) + 2 * inputPadding + 2,
  );
  const maxHeight = Math.max(
    minHeight,
    Math.min(132, Math.round(height * 0.24)),
  );
  const inputHeight = Math.max(
    minHeight,
    Math.min(maxHeight, value ? contentHeight : 0),
  );

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !inputRef.current) return;
    const element = inputRef.current as unknown as HTMLTextAreaElement;
    // RN Web measures scrollHeight at the current height. Temporarily remove
    // the height so wrapped text can shrink as well as grow.
    const previousHeight = element.style.height;
    const previousScroll = element.scrollTop;
    element.style.height = "0px";
    const measured = element.scrollHeight + 2;
    element.style.height = previousHeight;
    element.scrollTop = previousScroll;
    setContentHeight(measured);
  }, [inputRef, value, width, fontScale]);

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !focused || contentHeight <= maxHeight) return;
    const element = inputRef.current as unknown as HTMLTextAreaElement | null;
    if (
      element?.selectionStart === value.length &&
      element.selectionEnd === value.length
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [inputRef, value, contentHeight, maxHeight, focused]);

  return (
    <TextInput
      ref={inputRef}
      accessibilityLabel="Message Solace"
      placeholder={
        width < 360 || fontScale > 1.25 ? "Message…" : "Message Solace…"
      }
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onContentSizeChange={
        Platform.OS === "web"
          ? undefined
          : ({ nativeEvent }) =>
              setContentHeight(Math.ceil(nativeEvent.contentSize.height) + 2)
      }
      multiline
      underlineColorAndroid="transparent"
      numberOfLines={Platform.OS === "web" ? 1 : undefined}
      scrollEnabled
      editable={editable}
      maxLength={4000}
      style={[
        styles.input,
        {
          height: inputHeight,
          color: colors.text,
          backgroundColor: resolved === "dark" ? "#2C243CF5" : colors.surface,
          borderColor: focused
            ? resolved === "dark"
              ? colors.primary
              : colors.accent
            : colors.border,
        },
      ]}
    />
  );
}

export function ChatComposerControl({
  icon,
  label,
  hint,
  onPress,
  tone = "quiet",
  disabled = false,
  busy = false,
}: {
  icon: string;
  label: string;
  hint?: string;
  onPress: () => void;
  tone?: "quiet" | "primary" | "live" | "recording";
  disabled?: boolean;
  busy?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const primary = tone === "primary" && (!disabled || busy);
  const recording = tone === "recording";
  const live = tone === "live";
  const fill = primary
    ? colors.primary
    : recording
      ? colors.peachSurface
      : live
        ? colors.lavenderSurface
        : resolved === "dark"
          ? "#302838F2"
          : colors.surface2;
  const ink = primary
    ? colors.primaryText
    : recording
      ? colors.danger
      : disabled
        ? colors.muted
        : live
          ? colors.lavenderText
          : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, busy }}
      aria-disabled={disabled}
      aria-busy={busy}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        {
          backgroundColor: fill,
          borderColor: primary ? colors.primary : colors.border,
          opacity: pressed ? 0.74 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={ink} />
      ) : icon === "waveform" ? (
        <VoiceWaveform color={ink} />
      ) : (
        <Icon name={icon} size={21} color={ink} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minWidth: 0,
    includeFontPadding: false,
    paddingHorizontal: 12,
    paddingVertical: inputPadding,
    borderWidth: 1,
    borderRadius: 24,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight,
    textAlignVertical: "top",
  },
  control: {
    width: chatControlSize,
    height: chatControlSize,
    flexShrink: 0,
    borderRadius: chatControlSize / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
