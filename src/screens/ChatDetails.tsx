import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Companion, type CompanionState } from "../Companion";
import { useTheme } from "../theme";
import { AppText, Icon, Row } from "../ui";

export function ChatScene({
  height,
  offset = 0,
  viewportHeight = height,
}: {
  height: number;
  offset?: number;
  viewportHeight?: number;
}) {
  const { colors, resolved } = useTheme();
  const dark = resolved === "dark";
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.scene, { height: viewportHeight }]}
    >
      <View style={{ height, top: -offset }}>
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
          style={styles.fullImage}
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
    </View>
  );
}

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
            backgroundColor: featured ? "#FAE7BE45" : "#FAE7BE24",
          },
        ]}
      >
        <Icon name={icon} color="#FFF7E9" size={20} />
      </View>
    </Pressable>
  );
}

export function ChatBubble({
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
        <View
          style={[
            styles.avatar,
            { backgroundColor: dark ? "#3A312A" : "#D8B79A" },
          ]}
        >
          {avatarState === "idle" ? (
            <Image
              source={require("../../assets/redesign-chat-avatar.jpg")}
              accessible={false}
              fadeDuration={0}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Companion size={29} state={avatarState} />
          )}
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
}

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
        style={styles.fullImage}
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FFF4D978",
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
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#FFF1DD9C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    overflow: "hidden",
  },
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
    borderWidth: 1,
    borderColor: "#FFE4BD",
    backgroundColor: "#292C24",
    overflow: "hidden",
    padding: 16,
  },
  fullImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  resetScrim: {
    backgroundImage:
      "linear-gradient(90deg, #161910DD 0%, #242219B0 46%, #322B1B20 100%)",
  },
  resetCopy: { maxWidth: "78%" },
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
