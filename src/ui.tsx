import React, { createContext, useContext, useRef, useState } from "react";
import {
  View,
  Text as NativeText,
  TextProps,
  ScrollView,
  Pressable,
  TextInput,
  ViewStyle,
  StyleProp,
  TextStyle,
  Image,
  ImageSourcePropType,
  ImageStyle,
  ActivityIndicator,
  Platform,
  ScrollViewProps,
  StyleSheet,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "./theme";
import { spacing, useScreenGutter } from "./layout";
import { useGuardedBack } from "./navigation-reset";

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
      // Cormorant's 1.21-em vertical metrics need room for descenders on Android.
      lineHeight: Platform.OS === "android" ? 59 : 50,
      letterSpacing: -1.2,
    },
    title: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 37,
      lineHeight: Platform.OS === "android" ? 46 : 41,
      letterSpacing: -0.6,
    },
    heading: {
      fontFamily: "CormorantGaramond_600SemiBold",
      fontSize: 26,
      lineHeight: Platform.OS === "android" ? 33 : 30,
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
export function ScreenHeader({
  title,
  back,
}: {
  title: string;
  back?: () => void;
}) {
  const goBack = useGuardedBack(back);
  return (
    <Row style={{ marginBottom: spacing.screenTop }}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
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
      <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
    </Row>
  );
}

export function NestedHeader({
  title,
  onBack,
  eyebrow,
  subtitle,
  action,
  style,
  ariaLabel = "Go back",
}: {
  title: string;
  onBack?: () => void;
  eyebrow?: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  ariaLabel?: string;
}) {
  const { colors } = useTheme();
  const goBack = useGuardedBack(onBack);
  return (
    <View style={[nestedStyles.header, style]}>
      <View style={nestedStyles.headerRow}>
        {onBack && (
          <IconButton
            name="chevron-back"
            label={ariaLabel}
            onPress={goBack}
            size={48}
            appearance="outlined"
          />
        )}
        <View style={nestedStyles.title}>
          {eyebrow && (
            <AppText variant="caption" color={colors.lavenderText}>
              {eyebrow}
            </AppText>
          )}
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
        </View>
        {action}
      </View>
      {subtitle && <AppText color={colors.muted}>{subtitle}</AppText>}
    </View>
  );
}

export function NestedState({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={nestedStyles.state}>
      <View
        style={[
          nestedStyles.stateIcon,
          { backgroundColor: colors.lavenderSurface },
        ]}
      >
        <Icon name={icon} color={colors.lavenderText} size={22} />
      </View>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      <AppText color={colors.muted}>{description}</AppText>
      {children}
    </Card>
  );
}

const nestedStyles = StyleSheet.create({
  header: { gap: spacing.compact, marginBottom: spacing.card },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  title: { flex: 1, minWidth: 0, gap: 2 },
  state: { gap: spacing.row },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function Screen({
  children,
  scroll = true,
  style,
  title,
  back,
  scrollRef,
  onScroll,
  onContentSizeChange,
  contentContainerStyle,
  edgeToEdge = false,
  edgeToEdgeTop = false,
  heroStatusBar,
  adjustKeyboardInsets = true,
  variant,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  title?: string;
  back?: () => void;
  scrollRef?: React.ComponentProps<typeof ScrollView>["ref"];
  onScroll?: ScrollViewProps["onScroll"];
  onContentSizeChange?: ScrollViewProps["onContentSizeChange"];
  contentContainerStyle?: StyleProp<ViewStyle>;
  edgeToEdge?: boolean;
  edgeToEdgeTop?: boolean;
  heroStatusBar?: "light" | "dark";
  adjustKeyboardInsets?: boolean;
  variant?: "nested";
}) {
  const { colors, resolved } = useTheme();
  const gutter = useScreenGutter();
  const navigationInset = useNavigationInset();
  const { bottom, top } = useSafeAreaInsets();
  const bottomClearance = Math.max(navigationInset, bottom);
  const edgeTop = edgeToEdge || edgeToEdgeTop;
  const protectStatusBar =
    edgeTop && scroll && top > 0 && Platform.OS !== "web";
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const statusStyle = resolved === "dark" ? "light" : "dark";
  const content = (
    <View
      style={[
        {
          paddingHorizontal: gutter,
          paddingTop: spacing.screenTop,
          paddingBottom: spacing.bottom + (scroll ? 0 : bottomClearance),
        },
        style,
      ]}
    >
      {title &&
        (variant === "nested" ? (
          <NestedHeader title={title} onBack={back} />
        ) : (
          <ScreenHeader title={title} back={back} />
        ))}
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={
        variant === "nested"
          ? edgeTop
            ? ["left", "right"]
            : ["top", "left", "right"]
          : edgeTop
            ? []
            : ["top"]
      }
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets={
            Platform.OS === "ios" && adjustKeyboardInsets
          }
          keyboardDismissMode={
            Platform.OS === "ios" && adjustKeyboardInsets
              ? "interactive"
              : "on-drag"
          }
          onScroll={
            protectStatusBar
              ? (event) => {
                  const pastStatusArea =
                    event.nativeEvent.contentOffset.y > top;
                  if (pastStatusArea !== scrolledRef.current) {
                    scrolledRef.current = pastStatusArea;
                    setScrolled(pastStatusArea);
                  }
                  onScroll?.(event);
                }
              : onScroll
          }
          scrollEventThrottle={
            onScroll ? 16 : protectStatusBar ? 32 : undefined
          }
          onContentSizeChange={onContentSizeChange}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            { flexGrow: 1 },
            contentContainerStyle,
            { paddingBottom: bottomClearance },
          ]}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {protectStatusBar && (
        <>
          <StatusBar
            style={scrolled ? statusStyle : heroStatusBar || statusStyle}
          />
          {scrolled && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: top,
                backgroundColor: colors.bg,
              }}
            />
          )}
        </>
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
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
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
      accessibilityLabel={accessibilityLabel}
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
export function Input(props: React.ComponentPropsWithRef<typeof TextInput>) {
  const { colors, resolved } = useTheme();
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
          borderColor: focused
            ? resolved === "dark"
              ? colors.primary
              : colors.accent
            : colors.border,
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
      source={
        size > 128
          ? require("../assets/petal.png")
          : require("../assets/petal-compact.png")
      }
      resizeMode="contain"
      fadeDuration={0}
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
  appearance = "plain",
  expanded,
  indicator,
}: {
  name: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  appearance?: "plain" | "outlined" | "artwork";
  expanded?: boolean;
  indicator?: boolean;
}) {
  const { colors } = useTheme();
  const artwork = appearance === "artwork";
  const bordered = appearance !== "plain";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      aria-disabled={disabled}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: artwork
          ? "rgba(23, 17, 32, 0.64)"
          : bordered
            ? pressed
              ? colors.lavenderSurface
              : colors.surface
            : pressed
              ? colors.surface2
              : "transparent",
        borderWidth: bordered ? 1 : 0,
        borderColor: artwork ? "rgba(232, 215, 246, 0.42)" : colors.border,
        opacity: disabled ? 0.45 : artwork && pressed ? 0.72 : 1,
      })}
    >
      <Icon name={name} size={22} color={artwork ? "#FFF8F4" : undefined} />
      {indicator && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.lavender,
          }}
        />
      )}
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
        source={require("../assets/botanical-compact.png")}
        resizeMode="contain"
        fadeDuration={0}
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
