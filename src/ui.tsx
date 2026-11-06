import React, { createContext, useContext, useState } from "react";
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
  ImageSourcePropType,
  ImageStyle,
  ActivityIndicator,
  ScrollViewProps,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "./theme";

// Floating navigation shares its measured height with scrolling and fixed composers.
export const NavigationInset = createContext(0);
export const useNavigationInset = () => useContext(NavigationInset);

// The insets fill the card, including padding. Clear Image's intrinsic size.
export const coverImageStyle: ImageStyle = {
  ...StyleSheet.absoluteFill,
  width: "auto",
  height: "auto",
};

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
      fontSize: 48,
      lineHeight: 50,
      letterSpacing: -1.2,
    },
    title: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 37,
      lineHeight: 41,
      letterSpacing: -0.6,
    },
    heading: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 26,
      lineHeight: 30,
    },
    body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23 },
    caption: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
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
  scrollRef,
  onContentSizeChange,
  contentContainerStyle,
  edgeToEdge = false,
  edgeToEdgeTop = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
  back?: () => void;
  scrollRef?: React.ComponentProps<typeof ScrollView>["ref"];
  onContentSizeChange?: ScrollViewProps["onContentSizeChange"];
  contentContainerStyle?: StyleProp<ViewStyle>;
  edgeToEdge?: boolean;
  edgeToEdgeTop?: boolean;
}) {
  const { colors } = useTheme();
  const navigationInset = useNavigationInset();
  const content = (
    <View
      style={[
        {
          paddingHorizontal: 24,
          paddingTop: 18,
          paddingBottom: 32 + (scroll ? 0 : navigationInset),
        },
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
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                marginLeft: -4,
              }}
            >
              <Icon name="arrow-back" size={23} />
            </Pressable>
          )}
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ flex: 1 }}
          >
            {title}
          </AppText>
        </Row>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={edgeToEdge || edgeToEdgeTop ? [] : ["top"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={
            navigationInset && !edgeToEdge
              ? { marginBottom: navigationInset }
              : undefined
          }
          onContentSizeChange={onContentSizeChange}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { flexGrow: 1 },
            edgeToEdge && { paddingBottom: navigationInset },
            contentContainerStyle,
          ]}
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
      borderRadius: 24,
      padding: 18,
      borderWidth: 0.75,
      borderColor: colors.border,
    },
    style,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles,
        pressed && { opacity: 0.78, transform: [{ scale: 0.99 }] },
      ]}
    >
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
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
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
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: 30,
          backgroundColor:
            variant === "primary" ? colors.primary : "transparent",
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          paddingHorizontal: 20,
          minHeight: 52,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row style={{ justifyContent: "center" }}>
          {icon && <Icon name={icon} color={fg} size={18} />}
          <AppText
            variant="label"
            style={{ color: fg, textAlign: "center", flexShrink: 1 }}
          >
            {title}
          </AppText>
        </Row>
      )}
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      selectionColor={colors.accent}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.border,
          borderRadius: 16,
          color: colors.text,
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          paddingHorizontal: 16,
          paddingVertical: 13,
          minHeight: 54,
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
      accessible={false}
    />
  );
}

export const Artwork = React.memo(function Artwork({
  kind = "petal",
  size = 140,
  style,
  muted = false,
}: {
  kind?: "petal" | "stillness" | "night";
  size?: number;
  style?: StyleProp<ImageStyle>;
  muted?: boolean;
}) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const source = dark
    ? kind === "petal"
      ? require("../assets/dark-petal.png")
      : kind === "stillness"
        ? require("../assets/dark-stillness.png")
        : require("../assets/dark-night.png")
    : kind === "petal"
      ? require("../assets/petal.png")
      : require("../assets/botanical.png");
  return (
    <Image
      source={source}
      accessible={false}
      pointerEvents="none"
      accessibilityIgnoresInvertColors
      resizeMode={kind === "petal" || !dark ? "contain" : "cover"}
      resizeMethod="resize"
      fadeDuration={0}
      style={[
        {
          width: size,
          height: size,
          opacity: (muted ? 0.65 : 1) * (dark || kind === "petal" ? 1 : 0.3),
        },
        style,
      ]}
    />
  );
});

/** Matched botanical artwork; text is rendered separately over a quiet scrim. */
export const PauseArtwork = React.memo(function PauseArtwork({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const source = dark
    ? require("../assets/daily-pause-dark-v2.png")
    : require("../assets/moment-light.png");
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Image
        source={source}
        defaultSource={source}
        accessible={false}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
        style={{ width: "100%", height: "100%" }}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage: dark
              ? "linear-gradient(90deg, rgba(20,20,22,0.97) 0%, rgba(20,20,22,0.90) 55%, rgba(20,20,22,0) 100%)"
              : "linear-gradient(90deg, rgba(243,230,214,0.92) 0%, rgba(243,230,214,0.66) 40%, rgba(243,230,214,0) 85%)",
          },
        ]}
      />
    </View>
  );
});
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
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
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

export function LotusMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/redesign-lotus.png")}
      accessible={false}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      fadeDuration={0}
      style={{ width: size, height: size * 0.72 }}
    />
  );
}

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Row style={{ gap: 7 }}>
      <Petal size={size} />
      <AppText variant="heading" style={{ fontSize: 29, lineHeight: 34 }}>
        Solace
      </AppText>
    </Row>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  disabled = false,
  size = 44,
}: {
  name: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surface2 : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon name={name} size={22} />
    </Pressable>
  );
}

export function BotanicalBackdrop({
  variant = "corner",
  style,
}: {
  variant?: "corner" | "footer";
  style?: StyleProp<ViewStyle>;
}) {
  const { resolved } = useTheme();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: "absolute",
          width: 240,
          height: 240,
          right: -72,
          top: -30,
          opacity: resolved === "dark" ? 0.16 : 0.32,
        },
        variant === "footer" && {
          top: undefined,
          bottom: -60,
          right: -30,
          width: 360,
          height: 260,
          transform: [{ rotate: "-24deg" }],
        },
        style,
      ]}
    >
      <Image
        source={require("../assets/botanical.png")}
        resizeMode="contain"
        style={{
          width: "100%",
          height: "100%",
          tintColor: resolved === "dark" ? "#C4AE8A" : undefined,
        }}
        accessible={false}
      />
    </View>
  );
}

export function MoodStone({
  mood,
  size = 30,
}: {
  mood: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const tone =
    (
      {
        Okay: colors.peach,
        Calm: "#B4BA96",
        Low: colors.lavender,
        Stressed: "#E8AC75",
        Great: "#B1BC83",
      } as Record<string, string>
    )[mood] || colors.border;
  return (
    <View
      accessible={false}
      style={{
        width: size + 3,
        height: size + 3,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size * 0.84,
          borderTopLeftRadius: size * 0.65,
          borderTopRightRadius: size * 0.46,
          borderBottomLeftRadius: size * 0.42,
          borderBottomRightRadius: size * 0.6,
          backgroundColor: tone,
          transform: [{ rotate: "-28deg" }],
          overflow: "hidden",
          boxShadow:
            "inset 3px 4px 7px rgba(255,255,255,0.45), inset -2px -3px 6px rgba(61,53,35,0.1)",
        }}
      />
    </View>
  );
}

export const moodPetals = [
  { mood: "Okay", image: require("../assets/mood-okay.png") },
  { mood: "Calm", image: require("../assets/mood-calm.png") },
  { mood: "Low", image: require("../assets/mood-low.png") },
  { mood: "Stressed", image: require("../assets/mood-stressed.png") },
  { mood: "Great", image: require("../assets/mood-great.png") },
] as const;

export function MoodPetal({
  source,
  style,
}: {
  source: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={source}
      accessible={false}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      fadeDuration={0}
      style={style}
    />
  );
}
