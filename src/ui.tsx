import React from "react";
import {
  View,
  Text as NativeText,
  TextProps,
  ScrollView,
  Pressable,
  TextInput,
  TextInputProps,
  ViewStyle,
  StyleProp,
  TextStyle,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "./theme";

export function AppText({
  children,
  variant = "body",
  style,
  color,
  ...props
}: TextProps & {
  variant?: "display" | "title" | "heading" | "body" | "caption" | "label";
  color?: string;
}) {
  const { colors } = useTheme();
  const variants: Record<string, TextStyle> = {
    display: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 45,
      lineHeight: 48,
    },
    title: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 37,
      lineHeight: 41,
    },
    heading: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 26,
      lineHeight: 30,
    },
    body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23 },
    caption: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
    label: { fontFamily: "Inter_600SemiBold", fontSize: 14, lineHeight: 20 },
  };
  return (
    <NativeText
      {...props}
      style={[{ color: color || colors.text }, variants[variant], style]}
    >
      {children}
    </NativeText>
  );
}
export function Screen({
  children,
  scroll = true,
  style,
  title,
  back,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
  back?: () => void;
}) {
  const { colors } = useTheme();
  const content = (
    <View
      style={[
        { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 36 },
        style,
      ]}
    >
      {title && (
        <Row style={{ marginBottom: 18 }}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={back}
              style={{ padding: 8, marginLeft: -8 }}
            >
              <Icon name="arrow-back" size={23} />
            </Pressable>
          )}
          <AppText variant="heading">{title}</AppText>
        </Row>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}
    >
      {children}
    </View>
  );
}
export function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors.surface,
      borderRadius: 25,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    style,
  ];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles}>
      {children}
    </Pressable>
  ) : (
    <View style={styles}>{children}</View>
  );
}
export function Icon({
  name,
  size = 20,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name as React.ComponentProps<typeof Ionicons>["name"]}
      size={size}
      color={color || colors.text}
    />
  );
}
export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const fg = variant === "primary" ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        {
          borderRadius: 30,
          backgroundColor:
            variant === "primary"
              ? colors.primary
              : variant === "secondary"
                ? colors.surface2
                : "transparent",
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          paddingHorizontal: 20,
          minHeight: 50,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row style={{ justifyContent: "center" }}>
          {icon && <Icon name={icon} color={fg} size={18} />}
          <AppText variant="label" style={{ color: fg, textAlign: "center" }}>
            {title}
          </AppText>
        </Row>
      )}
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 18,
          color: colors.text,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          paddingHorizontal: 16,
          paddingVertical: 13,
          minHeight: 50,
        },
        props.multiline && { minHeight: 100, textAlignVertical: "top" },
        props.style,
      ]}
    />
  );
}
export function Petal({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/petal.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
    />
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ marginBottom: 13 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <AppText variant="heading">{title}</AppText>
        {action && (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <AppText variant="label">{action}</AppText>
          </Pressable>
        )}
      </Row>
      {subtitle && (
        <AppText variant="caption" style={{ marginTop: 4 }}>
          {subtitle}
        </AppText>
      )}
    </View>
  );
}
