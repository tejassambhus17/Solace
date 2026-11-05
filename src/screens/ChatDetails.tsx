import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Companion, type CompanionState } from "../Companion";
import { useTheme } from "../theme";
import { AppText, Artwork, Icon, Row } from "../ui";

export function ChatHeaderButton({
  icon,
  label,
  onPress,
  disabled,
  featured,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  featured?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
      })}
    >
      <View
        style={[
          styles.headerIcon,
          {
            backgroundColor: featured ? colors.sageSurface : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Icon
          name={icon}
          color={featured ? colors.sageText : colors.text}
          size={19}
        />
      </View>
    </Pressable>
  );
}

export function ChatBubble({
  children,
  user = false,
  label,
}: {
  children: React.ReactNode;
  user?: boolean;
  label?: string;
}) {
  const { colors, resolved } = useTheme();
  const backgroundColor = user
    ? resolved === "dark"
      ? colors.surface2
      : colors.sageSurface
    : colors.surface;
  return (
    <View
      style={[
        styles.bubble,
        {
          alignSelf: user ? "flex-end" : "flex-start",
          backgroundColor,
          borderBottomRightRadius: user ? 8 : 24,
          borderBottomLeftRadius: user ? 24 : 8,
          borderColor: colors.border,
        },
      ]}
    >
      {label && (
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.replyLabel}
        >
          {label}
        </AppText>
      )}
      {children}
    </View>
  );
}

export function ChatWelcome({
  mood,
  state,
}: {
  mood?: string;
  state: CompanionState;
}) {
  return (
    <>
      <View style={styles.welcome}>
        {state === "idle" ? (
          <Artwork size={53} />
        ) : (
          <Companion size={53} state={state} />
        )}
        <View style={styles.welcomeCopy}>
          <ChatBubble>
            <AppText>
              Hi there. I’m Solace.{"\n"}I’m here to listen, support, and help
              you find a little calm whenever you need it.
            </AppText>
          </ChatBubble>
        </View>
      </View>
      <ChatBubble>
        <AppText>
          {mood
            ? `You checked in feeling ${mood.toLowerCase()} today. Want to take a moment to feel more grounded?`
            : "Would you like a quick reset, or would it help to talk for a bit?"}
        </AppText>
      </ChatBubble>
    </>
  );
}

export function ChatQuickReplies({
  onActivity,
  onTalk,
  disabled,
  reflection,
}: {
  onActivity: () => void;
  onTalk: () => void;
  disabled: boolean;
  reflection?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.replies}>
      {[
        {
          title: reflection
            ? "Yes, I’d like to reflect"
            : "Yes, a quick reset sounds good",
          icon: reflection ? "book-outline" : "leaf-outline",
          background: colors.sageSurface,
          color: colors.sageText,
          onPress: onActivity,
        },
        {
          title: "Actually, I’d like to talk for a bit",
          icon: "ellipsis-horizontal",
          background: colors.surface,
          color: colors.text,
          onPress: onTalk,
        },
      ].map(({ title, icon, background, color, onPress }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.reply,
            {
              backgroundColor: background,
              borderColor: colors.border,
              opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon name={icon} color={color} size={20} />
          <AppText color={color} style={styles.replyCopy}>
            {title}
          </AppText>
        </Pressable>
      ))}
    </Row>
  );
}

export function ChatResetCard({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors, resolved } = useTheme();
  const source =
    resolved === "dark"
      ? require("../../assets/chat-reset-dark.jpg")
      : require("../../assets/chat-reset-light.jpg");
  return (
    <View
      style={[
        styles.resetCard,
        { backgroundColor: colors.lavenderSurface, borderColor: colors.border },
      ]}
    >
      <Image
        source={source}
        accessible={false}
        accessibilityIgnoresInvertColors
        pointerEvents="none"
        resizeMode="cover"
        fadeDuration={0}
        style={styles.resetImage}
      />
      <AppText
        variant="heading"
        accessibilityRole="header"
        accessibilityLabel="Start a 60-second reset"
        style={styles.resetHeading}
      >
        Start a 60 sec reset
      </AppText>
      <View style={styles.resetCopy}>
        <AppText style={styles.resetDescription}>
          A simple breathing exercise to pause and recenter.
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start now"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: colors.primary,
              opacity: disabled ? 0.5 : pressed ? 0.76 : 1,
            },
          ]}
        >
          <AppText variant="label" color={colors.primaryText}>
            Start now
          </AppText>
          <Icon name="arrow-forward" size={17} color={colors.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "94%",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyLabel: { fontSize: 11, lineHeight: 16, marginBottom: 4 },
  welcome: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  welcomeCopy: { flex: 1, minWidth: 0, paddingTop: 18 },
  replies: { gap: 8, alignItems: "stretch" },
  reply: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 5,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyCopy: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  resetCard: {
    position: "relative",
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 17,
  },
  resetImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  resetCopy: { maxWidth: "68%", alignItems: "flex-start" },
  resetHeading: { maxWidth: "89%", fontSize: 27, lineHeight: 29 },
  resetDescription: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  resetButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 15,
    borderRadius: 24,
    gap: 8,
  },
});
