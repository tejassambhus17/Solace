import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Companion, type CompanionState } from "../Companion";
import { spacing } from "../layout";
import { artGradient, useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, LotusMark, Row } from "../ui";

export function ChatScene({ height }: { height: number }) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      style={[
        styles.scene,
        {
          height,
          backgroundColor: colors.bg,
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
              `linear-gradient(180deg, ${colors.bg} 0%, transparent 16%, transparent 72%, ${colors.bg} 100%)`,
            ),
          ]}
        />
      </View>
    </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
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
            backgroundColor:
              variant === "filled" ? colors.surface2 : "transparent",
          },
        ]}
      >
        <Icon name={icon} color={colors.text} size={21} />
      </View>
    </Pressable>
  );
}

export function ChatAvatar({
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
}

export const ChatBubble = React.memo(function ChatBubble({
  children,
  user = false,
  label,
  createdAt,
  avatar = false,
  avatarState = "idle",
  intro = false,
}: {
  children: string;
  user?: boolean;
  label?: string;
  createdAt?: string;
  avatar?: boolean;
  avatarState?: CompanionState;
  intro?: boolean;
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
              backgroundColor: user
                ? dark
                  ? colors.lavenderSurface
                  : "#35533F"
                : dark
                  ? colors.surface
                  : "#FFF7EDF5",
              borderColor: dark
                ? intro
                  ? "#775C73"
                  : colors.border
                : user
                  ? "#99AE8C"
                  : colors.border,
            },
          ]}
        >
          <AppText
            selectable
            color={user && !dark ? "#FFF9EE" : colors.text}
            style={intro && styles.introText}
          >
            {children}
          </AppText>
        </View>
        {(label || time) && (
          <Row
            style={[
              styles.turnMeta,
              user && styles.userMeta,
              { backgroundColor: colors.bg },
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
  const { resolved } = useTheme();
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
            "linear-gradient(90deg, #20192CDE 0%, #241B38AA 45%, #322B1B09 100%)",
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
              opacity: disabled ? 0.5 : pressed ? 0.76 : 1,
            },
          ]}
        >
          <Icon name="play" size={15} color="#2D2042" />
          <AppText variant="label" color="#2D2042">
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
    backgroundColor: "#FFDDC2",
  },
});
