import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Image,
  Platform,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond/600SemiBold";
import { ThemeProvider, useTheme } from "./src/theme";
import { AppProvider, useApp } from "./src/store";
import { AppText, Button, NavigationInset, Petal } from "./src/ui";
import {
  AuthScreen,
  ChatScreen,
  HistoryScreen,
  TodayScreen,
  ExploreScreen,
} from "./src/screens/Core";
import { JourneyScreen } from "./src/screens/Journey";
import { MomentsScreen, MomentPlayerScreen } from "./src/screens/Moments";
import WellnessScreen from "./src/screens/Wellness";
import ProfileScreen from "./src/screens/Profile";
import { TabBar } from "./src/Navigation";
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
function Shell() {
  const app = useApp();
  const { colors, resolved } = useTheme();
  const [navigationHeight, setNavigationHeight] = useState(88);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const showNavigation =
    !!app.user &&
    !app.sessionExpired &&
    !keyboardOpen &&
    !["breathing", "moment", "grounding", "moment-player"].includes(app.route);
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
      ["breathing", "moment", "grounding", "moment-player"].includes(app.route)
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
  else if (app.route === "explore") content = <ExploreScreen />;
  else if (app.route === "moments") content = <MomentsScreen />;
  else if (app.route === "moment-player")
    content = <MomentPlayerScreen key={app.params?.activity?.id || "player"} />;
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
          <NavigationInset.Provider
            value={showNavigation ? navigationHeight : 0}
          >
            {content}
            {showNavigation && <TabBar onHeight={setNavigationHeight} />}
          </NavigationInset.Provider>
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
