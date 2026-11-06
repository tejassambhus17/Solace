import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "../Companion";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Button, Icon, Row } from "../ui";

const labels = {
  general: "General suggestion",
  conversation: "From this conversation",
  personalized: "Personalized suggestion",
  "current-checkin": "Today’s check-in",
  "your-choice": "Your choice",
};

export function RecommendationExplanation({
  open,
  onClose,
  onManage,
  title,
  reason,
  basis,
}: {
  open: boolean;
  onClose: () => void;
  onManage?: () => void;
  title: string;
  reason: string;
  basis: keyof typeof labels;
}) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      transparent
      visible={open}
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: colors.surface }]}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={{
              padding: spacing.section,
              paddingBottom: spacing.section + bottom,
              gap: spacing.row,
            }}
          >
            <Row style={{ alignItems: "flex-start", gap: spacing.compact }}>
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={styles.heading}
              >
                Why Solace suggested this
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close explanation"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  {
                    backgroundColor: colors.surface2,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Icon name="close-outline" size={22} />
              </Pressable>
            </Row>
            <AppText variant="label">{title}</AppText>
            <View
              style={[
                styles.label,
                { backgroundColor: colors.lavenderSurface },
              ]}
            >
              <AppText variant="caption" color={colors.lavenderText}>
                {labels[basis]}
              </AppText>
            </View>
            <AppText color={colors.muted}>{reason}</AppText>
            {onManage && (
              <Button
                title="Manage memory and preferences"
                icon="shield-checkmark-outline"
                variant="secondary"
                onPress={onManage}
                style={{ marginTop: spacing.compact }}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "86%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  heading: { flex: 1, marginTop: spacing.compact },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: spacing.row,
    paddingVertical: 5,
  },
});
