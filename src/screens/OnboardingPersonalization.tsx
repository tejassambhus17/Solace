import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../theme";
import { AppText, Button, Icon, Petal, Screen } from "../ui";

export function OnboardingPersonalization({
  onChoose,
  saving,
  error,
}: {
  onChoose: (enable: boolean) => void;
  saving: boolean;
  error?: string;
}) {
  const { colors } = useTheme();
  return (
    <Screen style={styles.page}>
      <View style={styles.content}>
        <Petal size={92} />
        <AppText
          variant="display"
          accessibilityRole="header"
          style={styles.center}
        >
          Personalize your space
        </AppText>
        <AppText color={colors.muted} style={styles.center}>
          Let Solace use preferences you choose to save to tailor conversations
          and suggest Moments.
        </AppText>
        <View style={[styles.note, { borderColor: colors.border }]}>
          <Icon
            name="lock-closed-outline"
            size={18}
            color={colors.lavenderText}
          />
          <AppText
            variant="caption"
            color={colors.muted}
            style={styles.noteText}
          >
            Change this anytime in Profile. Sharing a Journal excerpt for AI
            reflection always asks for separate permission.
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        {!!error && (
          <AppText accessibilityRole="alert" color={colors.danger}>
            {error}
          </AppText>
        )}
        <Button
          title="Enable personalization"
          icon="leaf-outline"
          loading={saving}
          onPress={() => onChoose(true)}
        />
        <Button
          title="Skip for now"
          variant="ghost"
          disabled={saving}
          onPress={() => onChoose(false)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 24, paddingBottom: 18 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 340,
    alignSelf: "center",
  },
  center: { textAlign: "center" },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    marginTop: 8,
  },
  noteText: { flex: 1 },
  actions: {
    gap: 7,
    paddingTop: 28,
    width: "100%",
    maxWidth: 340,
    alignSelf: "center",
  },
});
