import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useApp } from "../store";
import { useTheme } from "../theme";
import {
  AppText,
  Button,
  Icon,
  PauseArtwork,
  Row,
  Screen,
  SectionTitle,
} from "../ui";

function ExploreLink({
  title,
  description,
  icon,
  route,
}: {
  title: string;
  description: string;
  icon: string;
  route: string;
}) {
  const app = useApp();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => app.navigate(route)}
      style={({ pressed }) => ({
        paddingVertical: 17,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Row style={{ gap: 14 }}>
        <Icon name={icon} color={colors.accent} size={23} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="label">{title}</AppText>
          <AppText
            variant="caption"
            color={colors.muted}
            style={{ marginTop: 3 }}
          >
            {description}
          </AppText>
        </View>
        <Icon name="chevron-forward" color={colors.muted} size={17} />
      </Row>
    </Pressable>
  );
}

export function ExploreScreen() {
  const app = useApp();
  const { colors } = useTheme();
  return (
    <Screen>
      <AppText
        variant="display"
        style={{ marginTop: 8, fontSize: 43, lineHeight: 46 }}
      >
        A little more room.
      </AppText>
      <AppText color={colors.muted} style={{ marginTop: 10, marginBottom: 26 }}>
        Choose a practice for the moment you’re in.
      </AppText>
      <View
        style={{
          backgroundColor: colors.heroSurface,
          borderColor: colors.heroBorder,
          borderWidth: 1,
          borderRadius: 26,
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        <PauseArtwork
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
        <View
          style={{
            padding: 22,
            minHeight: 255,
            alignItems: "flex-start",
            justifyContent: "center",
          }}
        >
          <View style={{ maxWidth: "54%" }}>
            <AppText variant="title" style={{ fontSize: 35, lineHeight: 35 }}>
              Breathe{`\n`}& release.
            </AppText>
            <AppText
              color={colors.text}
              style={{
                fontSize: 14,
                lineHeight: 21,
                marginTop: 12,
                marginBottom: 17,
              }}
            >
              A slower rhythm, one breath at a time.
            </AppText>
            <Button
              title="Breathe"
              icon="arrow-forward"
              onPress={() => app.navigate("breathing", { durationSec: 180 })}
              style={{
                minHeight: 46,
                paddingHorizontal: 16,
                alignSelf: "flex-start",
              }}
            />
            <AppText
              variant="caption"
              color={colors.heroMuted}
              style={{ marginTop: 10, fontSize: 11 }}
            >
              3 min · guided practice
            </AppText>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Five-senses grounding"
        onPress={() => app.navigate("grounding")}
        style={({ pressed }) => ({
          paddingVertical: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Row style={{ gap: 16 }}>
          <View
            style={{
              width: 50,
              height: 50,
              marginHorizontal: 18,
              backgroundColor: colors.sageSurface,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="hand-left-outline" color={colors.sageText} size={27} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="heading" style={{ fontSize: 26, lineHeight: 28 }}>
              Find your ground
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 5 }}
            >
              Five senses. One present moment.
            </AppText>
          </View>
          <Icon name="arrow-forward" color={colors.sageText} size={20} />
        </Row>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write a reflection"
        onPress={() => app.navigate("reflection")}
        style={({ pressed }) => ({
          paddingVertical: 19,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Row style={{ gap: 16 }}>
          <View
            style={{
              width: 50,
              height: 50,
              marginHorizontal: 18,
              backgroundColor: colors.peachSurface,
              borderRadius: 25,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="create-outline" color={colors.peachText} size={26} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="heading" style={{ fontSize: 26, lineHeight: 28 }}>
              Write it out
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 5 }}
            >
              A private place for a thought.
            </AppText>
          </View>
          <Icon name="arrow-forward" color={colors.peachText} size={20} />
        </Row>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your saved toolkit"
        onPress={() => app.navigate("toolkit")}
        style={({ pressed }) => ({
          marginTop: 25,
          marginBottom: 30,
          padding: 18,
          backgroundColor: colors.surface,
          borderRadius: 18,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Row style={{ gap: 14 }}>
          <Icon name="bookmark-outline" color={colors.accent} size={25} />
          <View style={{ flex: 1 }}>
            <AppText variant="label">Your saved toolkit</AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 3 }}
            >
              {app.data.favorites.length
                ? `${app.data.favorites.length} saved, close at hand.`
                : "Keep the practices that feel right for you."}
            </AppText>
          </View>
          <Icon name="chevron-forward" color={colors.muted} size={17} />
        </Row>
      </Pressable>
      <SectionTitle title="A little guidance" />
      <ExploreLink
        title="Guides & resources"
        description="Sleep, stress, connection, and more."
        icon="book-outline"
        route="resources"
      />
      <ExploreLink
        title="Reflective check-ins"
        description="Notice patterns at your own pace."
        icon="clipboard-outline"
        route="assessments"
      />
      <ExploreLink
        title="Your wellness plan"
        description="Choose small steps for the week."
        icon="calendar-outline"
        route="plan"
      />
      <ExploreLink
        title="Daily affirmation"
        description="Keep a kind thought close."
        icon="heart-outline"
        route="affirmation"
      />
      <ExploreLink
        title="Daily challenge"
        description="One small, gentle action."
        icon="sparkles-outline"
        route="challenge"
      />
    </Screen>
  );
}
