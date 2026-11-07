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

export function ChatComposerInput({
  inputRef,
  value,
  editable,
  onChangeText,
  onFocus,
}: {
  inputRef: React.RefObject<React.ElementRef<typeof TextInput> | null>;
  value: string;
  editable: boolean;
  onChangeText: (text: string) => void;
  onFocus: () => void;
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
    element.style.height = "0px";
    const measured = element.scrollHeight + 2;
    element.style.height = previousHeight;
    setContentHeight(measured);
  }, [inputRef, value, width, fontScale]);

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
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      onContentSizeChange={
        Platform.OS === "web"
          ? undefined
          : ({ nativeEvent }) =>
              setContentHeight(Math.ceil(nativeEvent.contentSize.height) + 2)
      }
      multiline
      numberOfLines={Platform.OS === "web" ? 1 : undefined}
      scrollEnabled={contentHeight > maxHeight}
      editable={editable}
      maxLength={4000}
      style={[
        styles.input,
        {
          height: inputHeight,
          color: colors.text,
          backgroundColor: resolved === "dark" ? "#2C243CF5" : "#FFF8F2F7",
          borderColor: focused ? colors.primary : colors.border,
        },
      ]}
    />
  );
}

export function ChatComposerControl({
  icon,
  label,
  onPress,
  tone = "quiet",
  disabled = false,
  busy = false,
  expanded,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: "quiet" | "primary" | "selected" | "recording";
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
}) {
  const { colors, resolved } = useTheme();
  const primary = tone === "primary" && (!disabled || busy);
  const recording = tone === "recording";
  const selected = tone === "selected";
  const fill = primary
    ? colors.primary
    : recording
      ? colors.peachSurface
      : selected
        ? colors.lavenderSurface
        : resolved === "dark"
          ? "#302838F2"
          : "#F0EEE0F5";
  const ink = primary
    ? colors.primaryText
    : recording
      ? colors.danger
      : disabled
        ? colors.muted
        : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy, expanded }}
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
