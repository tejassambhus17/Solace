import React from "react";
import { StyleSheet, View } from "react-native";
import { useGoogleAccountLink } from "../google-auth";
import { spacing } from "../layout";
import { useTheme } from "../theme";
import { AppText, Card, Icon, Row } from "../ui";
import { GoogleAuthAction } from "./GoogleAuthAction";

export function GoogleAccountLink() {
  const { colors } = useTheme();
  const google = useGoogleAccountLink();
  return (
    <Card style={styles.group}>
      <Row style={styles.group}>
        <View
          style={[styles.icon, { backgroundColor: colors.lavenderSurface }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Icon name="link-outline" size={19} color={colors.lavenderText} />
        </View>
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={styles.copy}
        >
          Google sign-in
        </AppText>
      </Row>
      {google.availability === "linked" ? (
        <Row>
          <Icon
            name="checkmark-circle-outline"
            color={colors.sageText}
            size={20}
          />
          <AppText
            color={colors.muted}
            accessibilityLiveRegion="polite"
            style={styles.copy}
          >
            Google is linked to this Solace account.
          </AppText>
        </Row>
      ) : (
        <>
          <AppText color={colors.muted}>
            Add Google as another way to sign in to this Solace account.
          </AppText>
          <GoogleAuthAction auth={google} title="Link Google account" />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.row },
  copy: { flex: 1, minWidth: 0 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
