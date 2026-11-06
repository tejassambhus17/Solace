import React from "react";
import { useGoogleAccountLink } from "../google-auth";
import { useTheme } from "../theme";
import { AppText, Card, Icon, Row } from "../ui";
import { GoogleAuthAction } from "./GoogleAuthAction";

export function GoogleAccountLink() {
  const { colors } = useTheme();
  const google = useGoogleAccountLink();
  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="heading" accessibilityRole="header">
        Google sign-in
      </AppText>
      {google.availability === "linked" ? (
        <Row>
          <Icon name="checkmark-circle-outline" color={colors.text} size={20} />
          <AppText
            color={colors.muted}
            accessibilityLiveRegion="polite"
            style={{ flex: 1 }}
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
