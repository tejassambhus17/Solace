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
  Alert,
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
} from "./src/screens/Core";
import { ExploreScreen, exploreCardArrivalRoutes } from "./src/screens/Explore";
import { TimedPracticeScreen } from "./src/screens/TimedPractice";
import { WellnessToolsScreen } from "./src/screens/WellnessTools";
import { wellnessToolArrivalRoutes } from "./src/wellness-tools";
import {
  JourneyActivityScreen,
  JourneyCheckinScreen,
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
import { habitRoutes, routes } from "./src/routes";
import { habitReminderInput } from "./src/habit-reminders";
import { HabitsScreen } from "./src/screens/Habits";
import { experienceDestination } from "./src/experience-links";
import { VoiceTalkScreen } from "./src/screens/VoiceTalk";
import { AmbientMixerScreen } from "./src/screens/AmbientMixer";
import {
  DevicePrivacyCover,
  DeviceUnlockScreen,
} from "./src/screens/DeviceLock";
import { MilestoneCelebration } from "./src/MilestoneCelebration";
import { widgetDestination } from "./src/widget-links";
import WellnessScreen from "./src/screens/Wellness";
import { WellnessPlansScreen } from "./src/screens/WellnessPlans";
import ProfileScreen from "./src/screens/Profile";
import { AmbientSoundPreferences } from "./src/screens/AmbientSoundPreferences";
import { TabBar } from "./src/Navigation";
import { NavigationDetail, useIosEdgeBack } from "./src/NavigationDetail";
import type { TabSelectionIntent } from "./src/navigation-motion";
import {
  TabResetGuardContext,
  type ExitGuard,
  type ExitReason,
} from "./src/navigation-reset";
import { useReducedMotion } from "./src/Companion";
import { useOnboarding } from "./src/onboarding-state";
import { PracticeInsightsScreen } from "./src/screens/PracticeInsights";
import { OnboardingScreen } from "./src/screens/Onboarding";
import {
  WellnessGoalsScreen,
  WellnessGoalsWelcome,
} from "./src/screens/WellnessGoals";
import { readWellnessGoals } from "./server/src/wellness-goals";
import { firstWellnessRecommendation } from "./src/wellness-recommendations";
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
  routes.sessionDetail,
  "reflection",
  "reflections",
  "reflection-detail",
  "saved-affirmations",
  "resources",
  "resource",
  "sleep",
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
  [routes.companion]: ({
    scrollMemory,
  }: React.ComponentProps<typeof ChatScreen>) => (
    <ExperienceTheme>
      <ChatScreen scrollMemory={scrollMemory} />
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
  routes.voice,
  routes.history,
  routes.journalEditor,
  routes.journalEntry,
  routes.journalReflect,
  routes.techniques,
  routes.technique,
  routes.wellnessTools,
  routes.timedPractice,
]);

const RetainedScreen = React.memo(function RetainedScreen({
  route,
  app,
  scrollMemory,
}: {
  route: RetainedRoot;
  app: ReturnType<typeof useApp> | null;
  scrollMemory: React.ComponentProps<typeof ChatScreen>["scrollMemory"];
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
          <Root scrollMemory={scrollMemory} />
        </AppRouteScope>
      ),
    [Root, scrollMemory, state],
  );
  return <Activity mode={app ? "visible" : "hidden"}>{content}</Activity>;
});

function Shell() {
  const app = useApp();
  const onboarding = useOnboarding(app);
  const [pendingLink, setPendingLink] = useState<
    | ReturnType<typeof widgetDestination>
    | ReturnType<typeof experienceDestination>
  >(null);
  const currentApp = useRef(app);
  currentApp.current = app;
  useEffect(() => {
    let live = true;
    let receivedEvent = false;
    const accept = (url: string | null | undefined) => {
      const destination = widgetDestination(url) ?? experienceDestination(url);
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
    onboarding.stage === "app" &&
    !!app.user &&
    !app.sessionExpired &&
    !app.appLocked &&
    !app.privacyCovered;
  useEffect(() => {
    if (!canOpenLink || !pendingLink) return;
    setPendingLink(null);
    const { navigate, switchSolaceMode } = currentApp.current;
    if ("tab" in pendingLink) {
      navigate(pendingLink.tab);
      if (pendingLink.route !== pendingLink.tab)
        navigate(
          pendingLink.route,
          "params" in pendingLink ? pendingLink.params : undefined,
        );
      return;
    }
    if ("mode" in pendingLink) {
      switchSolaceMode(pendingLink.mode);
      return;
    }
    navigate(routes.explore);
    navigate(pendingLink.route);
    if (pendingLink.techniqueId)
      navigate(routes.technique, { id: pendingLink.techniqueId });
  }, [canOpenLink, pendingLink]);
  const awaitingUnlock = app.appLocked && app.appUnlock.phase !== "fallback";
  const privacyCovered = app.privacyCovered || awaitingUnlock;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={privacyCovered}
        importantForAccessibility={
          privacyCovered ? "no-hide-descendants" : "auto"
        }
      >
        {awaitingUnlock ? null : app.appLocked ? (
          <DeviceUnlockScreen scope="app" />
        ) : (
          <AccountShell
            key={app.user?.id ?? "signed-out"}
            app={app}
            onboarding={onboarding}
          />
        )}
      </View>
      {privacyCovered && <DevicePrivacyCover />}
    </View>
  );
}

function AccountShell({
  app,
  onboarding,
}: {
  app: ReturnType<typeof useApp>;
  onboarding: ReturnType<typeof useOnboarding>;
}) {
  const { colors, resolved } = useTheme();
  const reducedMotion = useReducedMotion();
  const previousTab = useRef(app.activeTab);
  const switchingTabs = previousTab.current !== app.activeTab;
  useLayoutEffect(() => {
    previousTab.current = app.activeTab;
  }, [app.activeTab]);
  const navigate = useRef(app.navigate);
  navigate.current = app.navigate;
  const habits = useRef(app.data.habits);
  habits.current = app.data.habits;
  const tabAction = useRef(app);
  tabAction.current = app;
  const resetGuards = useRef(new Map<number, ExitGuard>());
  const registerResetGuard = useCallback(
    (routeKey: number, guard: ExitGuard) => {
      resetGuards.current.set(routeKey, guard);
      return () => {
        resetGuards.current.delete(routeKey);
      };
    },
    [],
  );
  const resetPrompt = useRef<object | null>(null);
  const leave = useCallback((action: () => void, reason: ExitReason) => {
    const { routeKey } = tabAction.current;
    const guard = resetGuards.current.get(routeKey);
    if (guard === "saving" || resetPrompt.current) return;
    if (!guard) {
      action();
      return;
    }
    const title = "Discard unsaved changes?";
    const message =
      reason === "tab"
        ? "Returning to the tab home will discard your unsaved changes."
        : "Going back will discard your unsaved changes.";
    if (Platform.OS === "web") {
      if (globalThis.confirm(`${title}\n\n${message}`)) action();
      return;
    }
    const prompt = {};
    resetPrompt.current = prompt;
    const dismiss = () => {
      if (resetPrompt.current === prompt) resetPrompt.current = null;
    };
    Alert.alert(
      title,
      message,
      [
        { text: "Keep editing", style: "cancel", onPress: dismiss },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            if (resetPrompt.current !== prompt) return;
            dismiss();
            if (tabAction.current.routeKey === routeKey) action();
          },
        },
      ],
      { cancelable: true, onDismiss: dismiss },
    );
  }, []);
  const navigationGuard = useMemo(
    () => ({ register: registerResetGuard, leave }),
    [leave, registerResetGuard],
  );
  const goBack = useCallback(
    () => leave(tabAction.current.back, "back"),
    [leave],
  );
  const selectTab = useCallback(
    (tab: string, intent: TabSelectionIntent) => {
      const { setTab } = tabAction.current;
      if (intent === "switch") setTab(tab, intent);
      else leave(() => setTab(tab, intent), "tab");
    },
    [leave],
  );
  const [chatPositions] = useState(() => new Map<string, number>());
  const [visitedRoots] = useState(() => new Set<RetainedRoot>());
  const detailCache = useRef(
    new Map<
      typeof app.activeTab,
      { app: typeof app; content: React.ReactElement }
    >(),
  );
  const journalLocked = app.journalLocked && app.journalRouteProtected;
  const activeRoot =
    !journalLocked && Object.hasOwn(retainedRoots, app.route)
      ? (app.route as RetainedRoot)
      : null;
  const authenticated =
    !!app.user && !app.sessionExpired && onboarding.stage === "app";
  const replayingIntro = authenticated && app.route === routes.onboarding;
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
      () => {
        // Keep the rail hidden while the iOS Companion composer is moving.
        if (
          Platform.OS !== "ios" ||
          tabAction.current.route !== routes.companion
        )
          setKeyboardOpen(false);
      },
    );
    const didHide =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false))
        : undefined;
    return () => {
      show.remove();
      hide.remove();
      didHide?.remove();
    };
  }, []);
  const showNavigation =
    authenticated &&
    !replayingIntro &&
    !keyboardOpen &&
    app.route !== routes.wellnessGoals &&
    !immersiveRoutes.has(app.route);
  const keepChatRail =
    authenticated && keyboardOpen && app.route === routes.companion;
  const canUseBack =
    authenticated &&
    !replayingIntro &&
    app.canGoBack &&
    !immersiveRoutes.has(app.route);
  const edgeBack = useIosEdgeBack(
    canUseBack && !keyboardOpen && !app.privacyCovered && !journalLocked
      ? goBack
      : undefined,
  );
  useEffect(() => {
    if (!authenticated || !app.user) return;
    restoreDeviceReminders(String(app.user.id), [
      ...app.data.reminders,
      ...app.data.habits.flatMap((habit) => {
        const reminder = habitReminderInput(habit);
        return reminder ? [reminder] : [];
      }),
    ]).catch((error) =>
      console.warn("Reminder schedules could not be restored:", error.message),
    );
    return subscribeNotificationNavigation((route, params) => {
      if (route === routes.habitDetails) {
        navigate.current(routes.explore);
        navigate.current(routes.habits);
        if (
          habits.current.some(
            (habit) => habit.id === params?.id && habit.status === "active",
          )
        )
          navigate.current(route, params);
        return;
      }
      navigate.current(routes.today);
      if (route !== routes.today) navigate.current(route);
    });
  }, [app.user?.id, authenticated]);
  useEffect(() => {
    if (!canUseBack) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => handler.remove();
  }, [canUseBack, goBack]);
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
  else if (onboarding.stage === "walkthrough")
    content = (
      <OnboardingScreen
        onFinish={onboarding.finishWalkthrough}
        finishing={onboarding.finishing}
        error={onboarding.walkthroughError}
      />
    );
  else if (!app.user || app.sessionExpired)
    content = <AuthScreen initialPage={onboarding.authPage} />;
  else if (onboarding.stage === "goals")
    content = (
      <WellnessGoalsScreen
        key={app.user.id}
        mode="onboarding"
        initialGoals={
          onboarding.draftGoals ?? readWellnessGoals(app.user.wellnessGoals)
        }
        onSave={onboarding.finishGoals}
        onSelectionChange={onboarding.rememberGoals}
      />
    );
  else if (onboarding.stage === "goal-welcome") {
    const recommendation = firstWellnessRecommendation(onboarding.welcomeGoals);
    content = (
      <WellnessGoalsWelcome
        recommendation={recommendation}
        onStart={() => {
          if (recommendation.via) app.navigate(recommendation.via);
          app.navigate(recommendation.route, recommendation.params);
          onboarding.finishWelcome();
        }}
        onDone={onboarding.finishWelcome}
      />
    );
  } else if (replayingIntro)
    content = <OnboardingScreen onFinish={app.back} onBack={app.back} />;
  else if (journalLocked) content = <DeviceUnlockScreen scope="journal" />;
  else if (activeRoot) content = null;
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
  else if (app.route === routes.wellnessTools)
    content = <WellnessToolsScreen />;
  else if (app.route === routes.timedPractice)
    content = <TimedPracticeScreen />;
  else if (
    app.route === routes.wellnessPlan ||
    app.route === routes.guidedPrograms ||
    app.route === routes.guidedProgram
  )
    content = <WellnessPlansScreen name={app.route} />;
  else if (habitRoutes.has(app.route))
    content = <HabitsScreen name={app.route} />;
  else if (app.route === routes.voice) content = <VoiceTalkScreen />;
  else if (app.route === "ambient-mixer") content = <AmbientMixerScreen />;
  else if (app.route === routes.history) content = <HistoryScreen />;
  else if (app.route === "journey-activity")
    content = <JourneyActivityScreen />;
  else if (app.route === routes.practiceInsights)
    content = <PracticeInsightsScreen />;
  else if (app.route === routes.journeyCheckin)
    content = <JourneyCheckinScreen />;
  else if (app.route === "journey-milestones")
    content = <JourneyMilestonesScreen />;
  else if (app.route === "journey-goal") content = <JourneyGoalScreen />;
  else if (app.route === "moments") content = <MomentsScreen />;
  else if (app.route === routes.wellnessGoals)
    content = (
      <WellnessGoalsScreen
        key={app.user.id}
        mode="edit"
        initialGoals={readWellnessGoals(app.user.wellnessGoals)}
        onBack={goBack}
        onSave={async (goals) => {
          await app.saveWellnessGoals(goals);
        }}
      />
    );
  else if (app.route === routes.momentPlayer)
    content = (
      <MomentPlayerScreen
        key={app.params.techniqueId ?? app.params.activity?.id ?? "player"}
      />
    );
  else if (app.route === routes.ambientSoundPreferences)
    content = <AmbientSoundPreferences />;
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
  const presentingDetail =
    !!content && authenticated && !journalLocked && !replayingIntro;
  const detailKey = app.habitHub?.key ?? app.routeKey;
  const presentedContent = (
    <ExperienceTheme
      useBaseCanvas={
        app.route === routes.journalEditor ||
        app.route === routes.techniques ||
        app.route === routes.technique ||
        app.route === routes.momentPlayer ||
        app.route === routes.wellnessTools ||
        app.route === routes.timedPractice ||
        habitRoutes.has(app.route)
      }
      enabled={
        authenticated &&
        (cinematicRoutes.has(app.route) ||
          habitRoutes.has(app.route) ||
          (app.route === routes.momentPlayer && !!app.params.techniqueId))
      }
    >
      {presentingDetail ? (
        <NavigationDetail
          key={detailKey}
          reducedMotion={reducedMotion}
          guardArrivalTouches={
            app.activeTab === routes.explore &&
            (exploreCardArrivalRoutes.has(app.route) ||
              wellnessToolArrivalRoutes.has(app.route))
          }
          stationary={
            switchingTabs ||
            app.route === routes.journalEditor ||
            app.route === routes.habitCreate ||
            app.route === routes.habitEdit ||
            immersiveRoutes.has(app.route)
          }
        >
          {content}
        </NavigationDetail>
      ) : (
        content
      )}
    </ExperienceTheme>
  );
  const liveDetail =
    presentingDetail && !immersiveRoutes.has(app.route)
      ? { app, content: presentedContent }
      : null;
  const details = authenticated
    ? [...detailCache.current.values()].filter(
        ({ app: saved }) =>
          saved.activeTab !== app.activeTab &&
          !(app.journalLocked && saved.journalRouteProtected),
      )
    : [];
  if (liveDetail) details.push(liveDetail);
  useLayoutEffect(() => {
    // Keep one committed detail per tab. Activity suspends its effects while
    // hidden and keeps its form state and native scroll view mounted.
    const cache = detailCache.current;
    if (!authenticated) {
      cache.clear();
      return;
    }
    if (app.journalLocked)
      for (const [tab, detail] of cache)
        if (detail.app.journalRouteProtected) cache.delete(tab);
    if (liveDetail) cache.set(app.activeTab, liveDetail);
    else cache.delete(app.activeTab);
  }, [app.activeTab, app.journalLocked, authenticated, liveDetail]);
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
        {app.initializing || onboarding.stage === "loading" ? (
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
              color={resolved === "dark" ? colors.primary : colors.accent}
              style={{ marginTop: 24 }}
            />
          </View>
        ) : (
          <TabResetGuardContext.Provider value={navigationGuard}>
            <NavigationInset.Provider
              value={
                showNavigation || (Platform.OS === "ios" && keepChatRail)
                  ? navigationHeight
                  : 0
              }
            >
              <View style={{ flex: 1 }} {...edgeBack}>
                {authenticated &&
                  Array.from(visitedRoots, (route) => (
                    <RetainedScreen
                      key={route}
                      route={route}
                      app={activeRoot === route ? app : null}
                      scrollMemory={chatPositions}
                    />
                  ))}
                {details.map((detail) => (
                  <Activity
                    key={detail.app.habitHub?.key ?? detail.app.routeKey}
                    mode={detail === liveDetail ? "visible" : "hidden"}
                  >
                    <AppRouteScope value={detail.app}>
                      {detail.content}
                    </AppRouteScope>
                  </Activity>
                ))}
                {!liveDetail && presentedContent}
              </View>
              {authenticated && (
                <MilestoneCelebration
                  allowed={
                    showNavigation &&
                    app.route !== "checkin" &&
                    app.route !== "feedback" &&
                    !(
                      app.route === routes.companion &&
                      app.params.originCheckinId
                    )
                  }
                />
              )}
              {authenticated && (
                <Activity
                  mode={showNavigation || keepChatRail ? "visible" : "hidden"}
                >
                  <TabBar
                    activeTab={app.activeTab}
                    route={app.route}
                    hidden={!showNavigation}
                    reducedMotion={reducedMotion}
                    onSelect={selectTab}
                    onHeight={setNavigationHeight}
                  />
                </Activity>
              )}
            </NavigationInset.Provider>
          </TabResetGuardContext.Provider>
        )}
      </View>
    </View>
  );
}

function FontGate() {
  const { colors, ready, resolved } = useTheme();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    CormorantGaramond_600SemiBold,
  });
  return (
    <AppProvider>
      {ready && (loaded || error) ? (
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
          <ActivityIndicator
            color={resolved === "dark" ? colors.primary : colors.accent}
            style={{ marginTop: 20 }}
          />
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
