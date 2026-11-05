import React, { useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond/600SemiBold";
import { ThemeProvider, useTheme } from "./src/theme";
import { AppProvider, useApp } from "./src/store";
import { AppText, Button, Icon, Petal } from "./src/ui";
import {
  AuthScreen,
  ChatScreen,
  HistoryScreen,
  JourneyScreen,
  TodayScreen,
} from "./src/screens/Core";
import WellnessScreen from "./src/screens/Wellness";
import ProfileScreen from "./src/screens/Profile";
import {
  subscribeNotificationNavigation,
  restoreDeviceReminders,
} from "./src/notifications";

const profileScreens = new Set([
  "profile",
  "settings",
  "reminders",
  "memory",
  "account",
  "support",
]);
const wellnessScreens = new Set([
  "checkin",
  "assessments",
  "assessment",
  "assessment-result",
  "breathing",
  "moment",
  "feedback",
  "session-detail",
  "reflection",
  "reflections",
  "reflection-detail",
  "saved-affirmations",
  "resources",
  "resource",
  "sleep",
  "plan",
  "affirmation",
  "challenge",
  "grounding",
  "toolkit",
]);
const tabs = [
  { name: "today", title: "Today", icon: "home-outline", activeIcon: "home" },
  { name: "chat", title: "Solace", icon: "leaf-outline", activeIcon: "leaf" },
  {
    name: "journey",
    title: "Journey",
    icon: "analytics-outline",
    activeIcon: "analytics",
  },
  {
    name: "profile",
    title: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];
function TabBar() {
  const app = useApp();
  const { colors } = useTheme();
  const active = app.activeTab;
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          paddingTop: 10,
          paddingBottom: Platform.OS === "web" ? 10 : 4,
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.name === active;
          return (
            <Pressable
              key={tab.name}
              onPress={() => app.setTab(tab.name)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              aria-selected={selected}
              accessibilityLabel={tab.title}
              style={({ pressed }) => ({
                alignItems: "center",
                justifyContent: "center",
                minWidth: 64,
                minHeight: 48,
                paddingHorizontal: 8,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon
                name={selected ? tab.activeIcon : tab.icon}
                size={22}
                color={selected ? colors.text : colors.muted}
              />
              <AppText
                variant="caption"
                color={selected ? colors.text : colors.muted}
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  fontFamily: selected
                    ? "Inter_600SemiBold"
                    : "Inter_400Regular",
                }}
              >
                {tab.title}
              </AppText>
              <View
                style={{
                  height: 2,
                  width: 28,
                  backgroundColor: selected ? colors.primary : "transparent",
                  marginTop: 5,
                  borderRadius: 2,
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
function Shell() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  useEffect(() => {
    if (!app.user || app.sessionExpired) return;
    restoreDeviceReminders(String(app.user.id), app.data.reminders).catch(
      (error) =>
        console.warn(
          "Reminder schedules could not be restored:",
          error.message,
        ),
    );
    return subscribeNotificationNavigation((route: string) =>
      app.navigate(route),
    );
  }, [app.user?.id, app.sessionExpired]);
  useEffect(() => {
    if (
      !app.user ||
      app.sessionExpired ||
      !app.canGoBack ||
      ["breathing", "moment", "grounding"].includes(app.route)
    )
      return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      app.back();
      return true;
    });
    return () => handler.remove();
  }, [app.user?.id, app.sessionExpired, app.route, app.canGoBack]);
  useEffect(() => {
    if (Platform.OS !== "web")
      SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
  let content: React.ReactNode;
  if (app.sessionError && !app.user)
    content = (
      <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 14 }}>
        <Petal size={70} />
        <AppText variant="title">Let's try again.</AppText>
        <AppText>{app.sessionError}</AppText>
        <AppText variant="caption" color={colors.muted}>
          Your saved session remains on this device.
        </AppText>
        <Button
          title="Retry connection"
          onPress={() => {
            app.retrySession().catch(() => {});
          }}
        />
        <Button
          title="Sign out"
          variant="secondary"
          onPress={() => {
            app.signOut().catch(() => {});
          }}
        />
      </View>
    );
  else if (!app.user || app.sessionExpired) content = <AuthScreen />;
  else if (app.route === "today") content = <TodayScreen />;
  else if (app.route === "chat" || app.route === "solace")
    content = <ChatScreen />;
  else if (app.route === "history") content = <HistoryScreen />;
  else if (app.route === "journey") content = <JourneyScreen />;
  else if (profileScreens.has(app.route))
    content = <ProfileScreen name={app.route} />;
  else if (wellnessScreens.has(app.route))
    content = (
      <WellnessScreen
        key={`${app.route}-${app.params?.id || ""}`}
        name={app.route}
      />
    );
  else content = <TodayScreen />;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          Platform.OS === "web"
            ? resolved === "dark"
              ? "#000000"
              : "#EAD5C5"
            : colors.bg,
        alignItems: "center",
      }}
    >
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          backgroundColor: colors.bg,
          ...(Platform.OS === "web"
            ? { boxShadow: "0 0 48px rgba(0,0,0,.12)" }
            : {}),
        }}
      >
        {app.initializing ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Petal size={100} />
            <AppText variant="title" style={{ marginTop: 14 }}>
              Solace
            </AppText>
            <AppText
              variant="caption"
              color={colors.muted}
              style={{ marginTop: 7 }}
            >
              A little space for you.
            </AppText>
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 24 }}
            />
          </View>
        ) : (
          <>
            {content}
            {!!app.user &&
              !app.sessionExpired &&
              app.route !== "breathing" &&
              app.route !== "moment" &&
              app.route !== "grounding" && <TabBar />}
          </>
        )}
      </View>
    </View>
  );
}
function FontGate() {
  const { colors, resolved } = useTheme();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    CormorantGaramond_600SemiBold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <Image
          source={require("./assets/petal.png")}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <StatusBar style={resolved === "dark" ? "light" : "dark"} />
        <Text style={{ fontSize: 28, color: colors.text, marginTop: 10 }}>
          Solace
        </Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FontGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
