import React, { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ENVIRONMENTS, EnvironmentScene } from "../Environment";
import { spacing } from "../layout";
import type { MomentEnvironment } from "../moments";
import { useTheme } from "../theme";
import { AppText, Icon, Row } from "../ui";

type EnvironmentSelection = {
  value: MomentEnvironment;
  onChange: (environment: MomentEnvironment) => void;
};

export function EnvironmentPicker({
  value,
  onChange,
  disabled = false,
  stacked = false,
}: EnvironmentSelection & { disabled?: boolean; stacked?: boolean }) {
  const { colors, resolved } = useTheme();
  return (
    <View style={[styles.options, stacked && styles.stackedOptions]}>
      {ENVIRONMENTS.map((environment) => {
        const selected = value === environment.id;
        return (
          <Pressable
            key={environment.id}
            accessibilityRole="radio"
            accessibilityLabel={environment.title}
            accessibilityState={{ selected, checked: selected, disabled }}
            aria-checked={selected}
            disabled={disabled}
            onPress={() => onChange(environment.id)}
            style={({ pressed }) => [
              stacked ? styles.stackedOption : styles.option,
              { opacity: pressed ? 0.75 : disabled ? 0.55 : 1 },
            ]}
          >
            <EnvironmentScene
              environment={environment.id}
              style={stacked ? styles.stackedScene : styles.scene}
              scenic
            />
            <Row style={stacked ? styles.stackedLabel : styles.optionLabel}>
              {selected && (
                <Icon
                  name="checkmark-circle"
                  size={14}
                  color={resolved === "dark" ? colors.primary : colors.accent}
                />
              )}
              <AppText
                variant="caption"
                style={stacked ? styles.flexText : styles.shortName}
                color={selected ? colors.text : colors.muted}
              >
                {stacked ? environment.title : environment.short}
              </AppText>
            </Row>
          </Pressable>
        );
      })}
    </View>
  );
}

export const GuidedEnvironmentSelector = React.memo(
  function GuidedEnvironmentSelector({
    value,
    soundEnvironment,
    onChange,
  }: EnvironmentSelection & { soundEnvironment: MomentEnvironment }) {
    const { colors, resolved } = useTheme();
    const { top, bottom, left, right } = useSafeAreaInsets();
    const { width, fontScale } = useWindowDimensions();
    const [open, setOpen] = useState(false);
    const closeButton = useRef<React.ComponentRef<typeof View>>(null);
    const trigger = useRef<React.ComponentRef<typeof View>>(null);
    const environment = ENVIRONMENTS.find((item) => item.id === value)!;
    const close = useCallback(() => setOpen(false), []);
    const focusCloseButton = useCallback(() => {
      if (Platform.OS !== "web" && closeButton.current)
        AccessibilityInfo.sendAccessibilityEvent(closeButton.current, "focus");
    }, []);
    const restoreFocus = useCallback(() => {
      if (Platform.OS === "ios" && trigger.current)
        AccessibilityInfo.sendAccessibilityEvent(trigger.current, "focus");
    }, []);
    const sideInset = Math.max(left, right);
    const stacked = width - sideInset * 2 < 320 || fontScale >= 1.4;

    return (
      <>
        <Pressable
          ref={trigger}
          testID="guided-environment-trigger"
          accessibilityRole="button"
          accessibilityLabel={`Space for this Moment, ${environment.title}`}
          accessibilityHint="Opens environment choices"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.trigger,
            {
              backgroundColor: pressed ? colors.surface2 : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Icon
            name={environment.icon}
            size={19}
            color={resolved === "dark" ? colors.primary : colors.accent}
          />
          <View style={styles.flexText}>
            <AppText variant="caption" color={colors.muted}>
              Space for this Moment
            </AppText>
            <AppText variant="label">{environment.title}</AppText>
          </View>
          <Icon name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
        <Modal
          visible={open}
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          accessibilityLabel="Choose an environment"
          onRequestClose={close}
          onShow={focusCloseButton}
          onDismiss={restoreFocus}
        >
          <View
            style={[
              styles.backdrop,
              {
                backgroundColor: colors.overlay,
                paddingTop: top + spacing.compact,
                paddingHorizontal: sideInset,
              },
            ]}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
              onStartShouldSetResponder={() => true}
              onResponderRelease={close}
              style={StyleSheet.absoluteFill}
            />
            <View
              testID="guided-environment-sheet"
              accessibilityViewIsModal
              style={[styles.sheet, { backgroundColor: colors.surface }]}
            >
              <ScrollView
                bounces={false}
                contentContainerStyle={[
                  styles.sheetContent,
                  { paddingBottom: Math.max(bottom, spacing.card) },
                ]}
              >
                <Row>
                  <AppText
                    variant="heading"
                    accessibilityRole="header"
                    style={styles.flexText}
                  >
                    Choose an environment
                  </AppText>
                  <Pressable
                    ref={closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close environment picker"
                    onPress={close}
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
                <EnvironmentPicker
                  value={value}
                  onChange={onChange}
                  stacked={stacked}
                />
                <View style={styles.details}>
                  <AppText color={colors.muted}>
                    {environment.description}
                  </AppText>
                  <AppText variant="caption" color={colors.muted}>
                    Ambient sound ·{" "}
                    {
                      ENVIRONMENTS.find(({ id }) => id === soundEnvironment)
                        ?.sound
                    }
                  </AppText>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </>
    );
  },
);

const styles = StyleSheet.create({
  options: { flexDirection: "row", gap: 9 },
  stackedOptions: { flexDirection: "column" },
  option: { flex: 1, minWidth: 0 },
  stackedOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.row,
  },
  scene: { minHeight: 65, height: 65, borderRadius: 14 },
  stackedScene: { minHeight: 48, height: 48, width: 62, borderRadius: 12 },
  optionLabel: {
    gap: 4,
    marginTop: 8,
    justifyContent: "center",
    minHeight: 24,
  },
  stackedLabel: { flex: 1, gap: spacing.compact },
  shortName: { fontSize: 12 },
  flexText: { flex: 1, minWidth: 0 },
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.row,
    paddingVertical: 4,
    gap: spacing.compact,
    borderWidth: 1,
    borderRadius: 14,
  },
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetContent: { gap: spacing.card, padding: spacing.card },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  details: { gap: 3 },
});
