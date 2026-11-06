import React, {
  Activity,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Linking,
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
import { ExperienceTheme, ThemeProvider, useTheme } from "./src/theme";
import {
  AppProvider,
  AppRouteScope,
  immersiveRoutes,
  useApp,
} from "./src/store";
import { AppText, Button, NavigationInset, Petal, Screen } from "./src/ui";
import {
  AuthScreen,
  ChatScreen,
  HistoryScreen,
  TodayScreen,
  ExploreScreen,
} from "./src/screens/Core";
import {
  JourneyActivityScreen,
  JourneyMilestonesScreen,
  JourneyScreen,
} from "./src/screens/Journey";
import { JourneyGoalScreen } from "./src/screens/JourneyGoal";
import { MomentsScreen, MomentPlayerScreen } from "./src/screens/Moments";
import { JournalScreen } from "./src/screens/Journal";
import { JournalReflectionScreen } from "./src/screens/JournalReflection";
import { SolaceHome } from "./src/screens/SolaceHome";
import {
  TechniqueDetailScreen,
  TechniquesScreen,
} from "./src/screens/Techniques";
import { routes } from "./src/routes";
import { experienceDestination } from "./src/experience-links";
import { VoiceTalkScreen } from "./src/screens/VoiceTalk";
import { AmbientMixerScreen } from "./src/screens/AmbientMixer";
import {
  DevicePrivacyCover,
  DeviceUnlockScreen,
} from "./src/screens/DeviceLock";
import { MilestoneCelebration } from "./src/MilestoneCelebration";
import WellnessScreen from "./src/screens/Wellness";
import ProfileScreen from "./src/screens/Profile";
import { TabBar } from "./src/Navigation";
import { NavigationDetail, useIosEdgeBack } from "./src/NavigationDetail";
import { useReducedMotion } from "./src/Companion";
import { GoogleLinkProvider } from "./src/google-auth";
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
  "about",
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
const retainedRoots = {
  today: TodayScreen,
  [routes.solace]: () => (
    <ExperienceTheme>
      <SolaceHome />
    </ExperienceTheme>
  ),
  [routes.journal]: () => (
    <ExperienceTheme>
      <JournalScreen name={routes.journal} />
    </ExperienceTheme>
  ),
  explore: ExploreScreen,
  journey: JourneyScreen,
  profile: () => <ProfileScreen name="profile" />,
};
type RetainedRoot = keyof typeof retainedRoots;
const cinematicRoutes = new Set<string>([
  routes.companion,
  routes.voice,
  routes.history,
  routes.journalEditor,
  routes.journalEntry,
  routes.journalReflect,
  routes.techniques,
  routes.technique,
]);

const RetainedScreen = React.memo(function RetainedScreen({
  route,
  app,
}: {
  route: RetainedRoot;
  app: ReturnType<typeof useApp> | null;
}) {
  // A hidden screen keeps its own route snapshot. Activity suspends its
  // effects while preserving native views, local controls and scroll state.
  const scopedApp = useRef(app);
  if (app) scopedApp.current = app;
  const state = scopedApp.current;
  const Root = retainedRoots[route];
  const content = useMemo(
    () =>
      state && (
        <AppRouteScope value={state}>
          <Root />
        </AppRouteScope>
      ),
    [Root, state],
  );
  return <Activity mode={app ? "visible" : "hidden"}>{content}</Activity>;
});

function Shell() {
  const app = useApp();
  const [pendingLink, setPendingLink] =
    useState<ReturnType<typeof experienceDestination>>(null);
  const currentApp = useRef(app);
  currentApp.current = app;
  useEffect(() => {
    let live = true;
    let receivedEvent = false;
    const accept = (url: string | null | undefined) => {
      const destination = experienceDestination(url);
      if (live && destination) {
        receivedEvent = true;
        setPendingLink(destination);
      }
    };
    const listener = Linking.addEventListener("url", ({ url }) => {
      accept(url);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (!receivedEvent) accept(url);
      })
      .catch(() => {});
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  const canOpenLink =
    !app.initializing &&
    !!app.user &&
    !app.sessionExpired &&
    !app.appLocked &&
    !app.privacyCovered;
  useEffect(() => {
    if (!canOpenLink || !pendingLink) return;
    setPendingLink(null);
    const { navigate, switchSolaceMode } = currentApp.current;
    if ("mode" in pendingLink) {
      switchSolaceMode(pendingLink.mode);
      return;
    }
    navigate(routes.explore);
    navigate(pendingLink.route);
    if (pendingLink.techniqueId)
      navigate(routes.technique, { id: pendingLink.techniqueId });
  }, [canOpenLink, pendingLink]);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={app.privacyCovered}
        importantForAccessibility={
          app.privacyCovered ? "no-hide-descendants" : "auto"
        }
      >
        {app.appLocked ? (
          <DeviceUnlockScreen scope="app" />
        ) : (
          <AccountShell key={app.user?.id ?? "signed-out"} app={app} />
        )}
      </View>
      {app.privacyCovered && <DevicePrivacyCover />}
    </View>
  );
}

function AccountShell({ app }: { app: ReturnType<typeof useApp> }) {
  const { colors, resolved } = useTheme();
  const reducedMotion = useReducedMotion();
  const previousTab = useRef(app.activeTab);
  const switchingTabs = previousTab.current !== app.activeTab;
  useLayoutEffect(() => {
    previousTab.current = app.activeTab;
  }, [app.activeTab]);
  const navigate = useRef(app.navigate);
  navigate.current = app.navigate;
  const back = useRef(app.back);
  back.current = app.back;
  const tabAction = useRef(app.setTab);
  tabAction.current = app.setTab;
  const selectTab = useCallback((tab: string) => tabAction.current(tab), []);
  const [chatPositions] = useState(() => new Map<string, number>());
  const [visitedRoots] = useState(() => new Set<RetainedRoot>());
  const journalLocked = app.journalLocked && app.journalRouteProtected;
  const activeRoot =
    !journalLocked && Object.hasOwn(retainedRoots, app.route)
      ? (app.route as RetainedRoot)
      : null;
  const authenticated = !!app.user && !app.sessionExpired;
  if (!authenticated) visitedRoots.clear();
  else if (activeRoot) visitedRoots.add(activeRoot);
  if (app.journalLocked) visitedRoots.delete(routes.journal);
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
    !immersiveRoutes.has(app.route);
  const canUseBack =
    authenticated && app.canGoBack && !immersiveRoutes.has(app.route);
  const edgeBack = useIosEdgeBack(
    canUseBack && !keyboardOpen && !app.privacyCovered && !journalLocked
      ? app.back
      : undefined,
  );
  useEffect(() => {
    if (!app.user || app.sessionExpired) return;
    restoreDeviceReminders(String(app.user.id), app.data.reminders).catch(
      (error) =>
        console.warn(
          "Reminder schedules could not be restored:",
          error.message,
        ),
    );
    return subscribeNotificationNavigation((route: string) => {
      navigate.current(routes.today);
      if (route !== routes.today) navigate.current(route);
    });
  }, [app.user?.id, app.sessionExpired]);
  useEffect(() => {
    if (!canUseBack) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      back.current();
      return true;
    });
    return () => handler.remove();
  }, [canUseBack]);
  useEffect(() => {
    if (Platform.OS !== "web")
      SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);
  let content: React.ReactNode;
  if (app.sessionError && !app.user)
    content = (
      <Screen style={{ flexGrow: 1, justifyContent: "center", gap: 14 }}>
        <Petal size={70} />
        <AppText variant="title" accessibilityRole="header">
          Let's try again.
        </AppText>
        <AppText accessibilityRole="alert">{app.sessionError}</AppText>
        <Button
          title="Retry connection"
          disabled={app.busy}
          onPress={() => {
            app.retrySession().catch(() => {});
          }}
        />
        <Button
          title="Sign out"
          variant="secondary"
          disabled={app.busy}
          onPress={() => {
            app.signOut().catch(() => {});
          }}
        />
      </Screen>
    );
  else if (!app.user || app.sessionExpired) content = <AuthScreen />;
  else if (journalLocked) content = <DeviceUnlockScreen scope="journal" />;
  else if (activeRoot) content = null;
  else if (app.route === routes.companion)
    content = <ChatScreen scrollMemory={chatPositions} />;
  else if (
    app.route === routes.journalEditor ||
    app.route === routes.journalEntry
  )
    content = (
      <JournalScreen
        key={`${app.route}-${app.params.id ?? "new"}`}
        name={app.route}
      />
    );
  else if (app.route === routes.journalReflect)
    content = <JournalReflectionScreen key={app.params.id} />;
  else if (app.route === routes.techniques) content = <TechniquesScreen />;
  else if (app.route === routes.technique) content = <TechniqueDetailScreen />;
  else if (app.route === routes.voice) content = <VoiceTalkScreen />;
  else if (app.route === "ambient-mixer") content = <AmbientMixerScreen />;
  else if (app.route === routes.history) content = <HistoryScreen />;
  else if (app.route === "journey-activity")
    content = <JourneyActivityScreen />;
  else if (app.route === "journey-milestones")
    content = <JourneyMilestonesScreen />;
  else if (app.route === "journey-goal") content = <JourneyGoalScreen />;
  else if (app.route === "moments") content = <MomentsScreen />;
  else if (app.route === routes.momentPlayer)
    content = (
      <MomentPlayerScreen
        key={app.params.techniqueId ?? app.params.activity?.id ?? "player"}
      />
    );
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
            <View style={{ flex: 1 }} {...edgeBack}>
              {authenticated &&
                Array.from(visitedRoots, (route) => (
                  <RetainedScreen
                    key={route}
                    route={route}
                    app={activeRoot === route ? app : null}
                    />
                ))}
              <ExperienceTheme
                enabled={
                  authenticated &&
                  (cinematicRoutes.has(app.route) ||
                    (app.route === routes.momentPlayer &&
                      !!app.params.techniqueId))
                }
              >
                {content && authenticated && !journalLocked ? (
                  <NavigationDetail
                    key={`${app.route}:${app.params.id ?? ""}`}
                    reducedMotion={reducedMotion}
                    stationary={
                      switchingTabs ||
                      app.route === routes.journalEditor ||
                      immersiveRoutes.has(app.route)
                    }
                  >
                    {content}
                  </NavigationDetail>
                ) : (
                  content
                )}
              </ExperienceTheme>
            </View>
            {authenticated && <MilestoneCelebration allowed={showNavigation} />}
            {authenticated && (
              <Activity mode={showNavigation ? "visible" : "hidden"}>
                <TabBar
                  activeTab={app.activeTab}
                  route={app.route}
                  reducedMotion={reducedMotion}
                  onSelect={selectTab}
                  onHeight={setNavigationHeight}
                />
              </Activity>
            )}
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
  return (
    <AppProvider>
      {loaded || error ? (
        <GoogleLinkProvider>
          <Shell />
        </GoogleLinkProvider>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.bg,
          }}
        >
          <Petal size={120} />
          <StatusBar style={resolved === "dark" ? "light" : "dark"} />
          <Text style={{ fontSize: 28, color: colors.text, marginTop: 10 }}>
            Solace
          </Text>
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        </View>
      )}
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
