import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Companion, type CompanionState } from "../Companion";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, coverImageStyle, Icon, Row } from "../ui";

export function ChatScene({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      style={[
        styles.scene,
        {
          minHeight: height,
          backgroundColor: dark ? colors.heroSurface : "#343E27",
        },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          source={
            dark
              ? require("../../assets/redesign-chat-scene-dark.jpg")
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
            {
              backgroundImage: `linear-gradient(180deg, #10160FC7 0%, #10160F48 25%, transparent 45%, transparent 64%, ${colors.bg} 100%)`,
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

export function ChatHeaderButton({
  icon,
  label,
  onPress,
  disabled,
  featured,
  scenic,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  featured?: boolean;
  scenic?: boolean;
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
            backgroundColor: scenic
              ? featured
                ? "#FAE7BE45"
                : "#FAE7BE24"
              : featured
                ? colors.sageSurface
                : colors.surface,
            borderColor: scenic ? "#FFF4D978" : colors.border,
          },
        ]}
      >
        <Icon name={icon} color={scenic ? "#FFF7E9" : colors.text} size={20} />
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
}: {
  children: string;
  user?: boolean;
  label?: string;
  createdAt?: string;
  avatar?: boolean;
  avatarState?: CompanionState;
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
          <ChatAvatar state={avatarState} />
        </View>
      )}
      <View style={styles.turnContent}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: user
                ? dark
                  ? "#304739"
                  : "#35533F"
                : dark
                  ? "#221F1DF7"
                  : "#FFF7EDF5",
              borderColor: user ? "#99AE8C" : dark ? "#605249" : "#FFFCF4",
            },
          ]}
        >
          <AppText selectable color={user ? "#FFF9EE" : colors.text}>
            {children}
          </AppText>
        </View>
        {(label || time) && (
          <Row
            style={[
              styles.turnMeta,
              user && styles.userMeta,
              { backgroundColor: dark ? "#121211F2" : "#FBF0E8F2" },
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
  mood,
  state,
}: {
  mood?: string;
  state: CompanionState;
}) {
  const { colors } = useTheme();
  return (
    <>
      <ChatBubble avatar avatarState={state}>
        {
          "Hi there, I’m Solace.\nI’m here to listen, support, and help you find a little calm whenever you need it."
        }
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
  onActivity,
  onTalk,
  disabled,
}: {
  onActivity: () => void;
  onTalk: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row style={styles.replies}>
      {[
        {
          title: "Try a quick reset",
          icon: "leaf-outline",
          background: colors.sageSurface,
          color: colors.sageText,
          onPress: onActivity,
        },
        {
          title: "I’d like to talk",
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
        style={[StyleSheet.absoluteFill, styles.resetScrim]}
      />
      <Icon name="leaf-outline" size={23} color="#FFF7E9" />
      <View style={styles.resetCopy}>
        <AppText
          variant="heading"
          accessibilityRole="header"
          color="#FFF7E9"
          style={styles.resetHeading}
        >
          Guided Breath
        </AppText>
        <AppText color="#FFF7E9" style={styles.resetDescription}>
          A 2-minute reset to take a breath and find your footing.
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
          <Icon name="play" size={16} color="#21352A" />
          <AppText variant="label" color="#21352A">
            Start Now
          </AppText>
        </Pressable>
        <Row style={styles.duration}>
          <Icon name="timer-outline" size={15} color="#FFF7E9" />
          <AppText variant="caption" color="#FFF7E9">
            2 min
          </AppText>
        </Row>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    overflow: "hidden",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
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
  replies: { gap: spacing.compact, alignItems: "stretch" },
  reply: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.compact,
    gap: 5,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyCopy: { textAlign: "center", fontSize: 13, lineHeight: 19 },
  resetCard: {
    position: "relative",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#FFE4BD",
    backgroundColor: "#292C24",
    overflow: "hidden",
    padding: 16,
  },
  resetScrim: {
    backgroundImage:
      "linear-gradient(90deg, #161910DD 0%, #242219B0 46%, #322B1B20 100%)",
  },
  resetCopy: { width: "78%" },
  resetHeading: { fontSize: 30, lineHeight: 34 },
  resetDescription: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  resetActions: {
    marginTop: 12,
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 7,
  },
  resetButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 24,
    gap: 8,
    backgroundColor: "#FFF3E3",
  },
  duration: {
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 13,
    backgroundColor: "#232318B3",
    borderColor: "#FBEAC16B",
    borderWidth: 1,
  },
});
