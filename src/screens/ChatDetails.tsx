import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Companion, type CompanionState } from "../Companion";
import { spacing } from "../layout";
import { artGradient, useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, LotusMark, Row } from "../ui";

export function companionSendError(error: unknown) {
  if (
    error instanceof Error &&
    "connection" in error &&
    error.connection === true
  )
    return "Couldn’t reach Solace. Check your connection and try again.";
  return error instanceof Error && error.message
    ? error.message
    : "Couldn’t send this message.";
}

export const ChatScene = React.memo(function ChatScene({
  height,
  canvas,
}: {
  height: number;
  canvas: string;
}) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      style={[
        styles.scene,
        {
          height,
          backgroundColor: canvas,
        },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={
            dark
              ? require("../../assets/solace-companion-twilight.jpg")
              : require("../../assets/redesign-chat-scene-light.jpg")
          }
          accessible={false}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          fadeDuration={0}
          style={coverImageStyle}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            artGradient(
              dark
                ? `linear-gradient(180deg, ${canvas} 0%, transparent 16%, transparent 72%, ${canvas} 100%)`
                : `linear-gradient(180deg, ${canvas} 0%, ${canvas}00 7%, ${canvas}00 89%, ${canvas} 100%)`,
            ),
          ]}
        />
      </View>
    </View>
  );
});

export function CompanionAction({
  label,
  onPress,
  disabled = false,
  expanded,
  style,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (Platform.OS === "web")
    return (
      <button
        type="button"
        aria-label={label}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onPress}
        style={{
          appearance: "none",
          borderStyle: "solid",
          borderWidth: 0,
          background: "transparent",
          margin: 0,
          padding: 0,
          color: "inherit",
          font: "inherit",
          textAlign: "start",
          boxSizing: "border-box",
          display: "flex",
          cursor: disabled ? "default" : "pointer",
          ...(StyleSheet.flatten(style) as React.CSSProperties),
          opacity: disabled ? 0.48 : 1,
        }}
      >
        {children}
      </button>
    );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        { opacity: disabled ? 0.48 : pressed ? 0.72 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ChatHeaderButton({
  icon,
  label,
  onPress,
  disabled,
  variant = "plain",
  expanded,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  variant?: "plain" | "filled";
  expanded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <CompanionAction
      label={label}
      onPress={onPress}
      disabled={disabled}
      expanded={expanded}
      style={styles.headerButton}
    >
      <View
        style={[
          styles.headerIcon,
          {
            backgroundColor:
              variant === "filled" ? colors.surface2 : "transparent",
          },
        ]}
      >
        <Icon name={icon} color={colors.text} size={21} />
      </View>
    </CompanionAction>
  );
}

export const ChatAvatar = React.memo(function ChatAvatar({
  size = 34,
  state = "idle",
}: {
  size?: number;
  state?: CompanionState;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface2,
          borderColor: colors.border,
        },
      ]}
    >
      {state === "idle" ? (
        <Image
          source={require("../../assets/redesign-chat-avatar.jpg")}
          accessible={false}
          resizeMode="cover"
          fadeDuration={0}
          style={coverImageStyle}
        />
      ) : (
        <Companion size={size - 5} state={state} />
      )}
    </View>
  );
});

export const ChatBubble = React.memo(function ChatBubble({
  children,
  user = false,
  label,
  createdAt,
  avatar = false,
  avatarState = "idle",
  intro = false,
  playback,
}: {
  children: string;
  user?: boolean;
  label?: string;
  createdAt?: string;
  avatar?: boolean;
  avatarState?: CompanionState;
  intro?: boolean;
  playback?: React.ReactNode;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  const date = createdAt ? new Date(createdAt) : null;
  const time =
    date && Number.isFinite(date.valueOf())
      ? date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
  return (
    <View style={[styles.turn, user && styles.userTurn]}>
      {!user && avatar && (
        <View style={styles.turnAvatar}>
          <ChatAvatar size={intro ? 32 : undefined} state={avatarState} />
        </View>
      )}
      <View style={styles.turnContent}>
        <View
          style={[
            styles.bubble,
            intro && styles.introBubble,
            {
              backgroundColor: user ? colors.lavenderSurface : colors.surface,
              borderColor: dark
                ? intro
                  ? "#775C73"
                  : colors.border
                : user
                  ? colors.lavender
                  : colors.border,
            },
          ]}
        >
          <AppText
            selectable
            color={colors.text}
            style={intro && styles.introText}
          >
            {children}
          </AppText>
        </View>
        {(label || time || !!playback) && (
          <Row
            style={[
              styles.turnMeta,
              user && styles.userMeta,
              !!playback && styles.playbackMeta,
              !dark && { backgroundColor: colors.bg },
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
            {time && (
              <AppText
                variant="caption"
                color={colors.muted}
                style={styles.replyLabel}
              >
                {time}
              </AppText>
            )}
            {time && user && (
              <Icon
                name="checkmark-done-outline"
                color={colors.sageText}
                size={14}
              />
            )}
            {playback}
          </Row>
        )}
      </View>
    </View>
  );
});

export function ChatWelcome({
  name,
  mood,
  state,
}: {
  name?: string;
  mood?: string;
  state: CompanionState;
}) {
  const { colors } = useTheme();
  const firstName =
    typeof name === "string" ? name.trim().split(/\s+/u)[0] : "";
  return (
    <>
      <ChatBubble avatar avatarState={state} intro>
        {`Hi ${firstName || "there"}, I’m Solace.\nI’m here to listen, support, and help you feel a little more balanced. How are you feeling today?`}
      </ChatBubble>
      {!!mood && (
        <AppText
          variant="caption"
          color={colors.muted}
          style={styles.moodContext}
        >
          You checked in feeling {mood.toLowerCase()} today.
        </AppText>
      )}
    </>
  );
}

export function ChatQuickReplies({
  onPrompt,
  disabled,
}: {
  onPrompt: (prompt: string) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.replies}>
      {[
        {
          title: "I’m feeling stressed",
          icon: "leaf-outline",
          background: colors.sageSurface,
          color: colors.sageText,
        },
        {
          title: "I want to sleep better",
          icon: "moon-outline",
          background: colors.lavenderSurface,
          color: colors.lavenderText,
        },
        {
          title: "I need to focus",
          icon: "sparkles-outline",
          background: colors.peachSurface,
          color: colors.peachText,
        },
      ].map(({ title, icon, background, color }) => (
        <Pressable
          key={title}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onPrompt(title)}
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
      ? require("../../assets/redesign-guided-dark.jpg")
      : require("../../assets/redesign-guided-light.jpg");
  return (
    <View style={styles.resetCard}>
      <Image
        source={source}
        accessible={false}
        accessibilityIgnoresInvertColors
        pointerEvents="none"
        resizeMode="cover"
        fadeDuration={0}
        style={coverImageStyle}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          artGradient(
            resolved === "dark"
              ? "linear-gradient(90deg, #20192CDE 0%, #241B38AA 45%, #322B1B09 100%)"
              : "linear-gradient(90deg, #20192CF0 0%, #241B38A8 50%, #322B1B00 86%)",
          ),
        ]}
      />
      <View style={styles.resetCopy}>
        <Row style={styles.resetTitle}>
          <LotusMark size={21} />
          <AppText
            variant="heading"
            accessibilityRole="header"
            color="#FFF7E9"
            style={styles.resetHeading}
          >
            A Quick Reset
          </AppText>
        </Row>
        <AppText color="#FFF7E9" style={styles.resetDescription}>
          A 3-minute breathing practice to slow down and feel calmer.
        </AppText>
      </View>
      <Row style={styles.resetActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start now"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: colors.lavenderAction,
              opacity: disabled ? 0.5 : pressed ? 0.76 : 1,
            },
          ]}
        >
          <Icon name="play" size={15} color={colors.lavenderActionText} />
          <AppText variant="label" color={colors.lavenderActionText}>
            Start Now
          </AppText>
        </Pressable>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: "hidden",
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  turn: {
    maxWidth: "90%",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  userTurn: { alignSelf: "flex-end", maxWidth: "83%" },
  turnContent: { flexShrink: 1, minWidth: 0 },
  avatar: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  turnAvatar: { marginTop: 4 },
  bubble: {
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 21,
    borderWidth: 1,
    boxShadow: "0 8px 20px #271C1314",
  },
  introBubble: {
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 15,
    boxShadow: undefined,
  },
  introText: { fontSize: 15, lineHeight: 21 },
  turnMeta: {
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 4,
    marginHorizontal: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  userMeta: { alignSelf: "flex-end" },
  playbackMeta: { flexWrap: "wrap" },
  replyLabel: { fontSize: 11, lineHeight: 16 },
  moodContext: { marginLeft: 42, fontSize: 12, lineHeight: 17 },
  replies: { gap: 7, alignItems: "stretch" },
  reply: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: spacing.compact,
    gap: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyCopy: { textAlign: "center", fontSize: 12, lineHeight: 16 },
  resetCard: {
    position: "relative",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#805F71",
    backgroundColor: "#242031",
    overflow: "hidden",
    padding: 11,
    minHeight: 148,
    justifyContent: "center",
  },
  resetCopy: { maxWidth: "77%" },
  resetTitle: { gap: 5 },
  resetHeading: { flexShrink: 1, fontSize: 24, lineHeight: 30 },
  resetDescription: { fontSize: 13, lineHeight: 17, marginTop: 1 },
  resetActions: {
    marginTop: 8,
    flexWrap: "wrap",
    gap: 7,
  },
  resetButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 24,
    gap: 8,
  },
});
