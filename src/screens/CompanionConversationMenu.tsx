import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Icon, Row } from "../ui";
import { ChatHeaderButton, CompanionAction } from "./ChatDetails";

export function CompanionConversationMenu({
  open,
  gutter,
  reducedMotion,
  disabled,
  onClose,
  onNewConversation,
  onHistory,
}: {
  open: boolean;
  gutter: number;
  reducedMotion: boolean;
  disabled: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onHistory: () => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const { top, bottom, left, right } = useSafeAreaInsets();
  const menuTop = top + 48;
  const actions = [
    { label: "New Conversation", icon: "add-outline", run: onNewConversation },
    { label: "Conversation History", icon: "time-outline", run: onHistory },
  ];

  return (
    <Modal
      visible={open}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          onStartShouldSetResponder={() => true}
          onResponderRelease={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View pointerEvents="box-none" style={styles.anchor}>
          <View
            accessibilityViewIsModal
            style={[
              styles.menu,
              {
                top: menuTop,
                right: gutter + right,
                maxHeight: Math.max(0, height - menuTop - bottom - spacing.row),
                width: Math.min(
                  248,
                  Math.max(0, width - left - right - 2 * gutter),
                ),
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.scroll}
            >
              <Row style={styles.heading}>
                <AppText
                  variant="label"
                  accessibilityRole="header"
                  style={styles.label}
                >
                  Conversations
                </AppText>
                <ChatHeaderButton
                  icon="close-outline"
                  label="Close conversations menu"
                  disabled={false}
                  onPress={onClose}
                />
              </Row>
              {actions.map(({ label, icon, run }) => (
                <CompanionAction
                  key={label}
                  label={label}
                  disabled={disabled}
                  onPress={() => {
                    onClose();
                    run();
                  }}
                  style={styles.action}
                >
                  <Icon name={icon} size={18} color={colors.lavenderText} />
                  <AppText variant="label" style={styles.label}>
                    {label}
                  </AppText>
                </CompanionAction>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, alignItems: "center" },
  anchor: { flex: 1, width: "100%", maxWidth: 480 },
  menu: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  scroll: { flexGrow: 0 },
  heading: { justifyContent: "space-between", paddingLeft: 10 },
  label: { flexShrink: 1, minWidth: 0 },
  action: {
    minHeight: 48,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.compact,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
