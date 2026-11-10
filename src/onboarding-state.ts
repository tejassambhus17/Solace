import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import type { WellnessGoal } from "../server/src/wellness-goals";
import type { useApp } from "./store";

const walkthroughKey = "solace.onboarding.completed.v1";
const completed = "1";

export type WalkthroughAction = "skip" | "complete";
export type AuthPage = "login" | "signup";
type IntroApp = Pick<
  ReturnType<typeof useApp>,
  | "appLocked"
  | "initializing"
  | "sessionError"
  | "sessionExpired"
  | "user"
  | "saveWellnessGoals"
>;

type GoalFlow = {
  account: string;
  goals?: WellnessGoal[];
};

export function useOnboarding(app: IntroApp) {
  const [device, setDevice] = useState<"loading" | "new" | "complete">(
    "loading",
  );
  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [finishing, setFinishing] = useState(false);
  const [walkthroughError, setWalkthroughError] = useState("");
  const writingWalkthrough = useRef(false);
  const [goalFlow, setGoalFlow] = useState<GoalFlow | null>(null);
  const savingGoals = useRef(false);
  const goalDraft = useRef<{ account: string; goals: WellnessGoal[] } | null>(
    null,
  );
  const signedIn = !!app.user && !app.sessionExpired;
  const knownSession = signedIn || app.sessionExpired;
  const account = signedIn && app.user ? String(app.user.id) : null;
  const knownAccount = app.user?.id;
  const current = useRef(account);
  current.current = account;
  const currentFlow = goalFlow?.account === account ? goalFlow : null;

  useEffect(() => {
    let active = true;
    const restore = (value: string | null) => {
      if (active)
        setDevice((old) =>
          old === "loading" ? (value === completed ? "complete" : "new") : old,
        );
    };
    void AsyncStorage.getItem(walkthroughKey).then(restore, () =>
      restore(null),
    );
    return () => {
      active = false;
    };
  }, []);

  // Preserve entry for accounts already using Solace before the walkthrough.
  useEffect(() => {
    if (!knownSession) return;
    setAuthPage("login");
    if (device === "complete") return;
    setDevice("complete");
    void AsyncStorage.setItem(walkthroughKey, completed).catch(() => {});
  }, [device, knownSession]);

  useEffect(() => {
    setGoalFlow((flow) => (flow?.account === account ? flow : null));
  }, [account]);

  useEffect(() => {
    const draft = goalDraft.current;
    if (
      draft &&
      (knownAccount ? draft.account !== knownAccount : !app.sessionExpired)
    )
      goalDraft.current = null;
  }, [app.sessionExpired, knownAccount]);

  const finishWalkthrough = async (action: WalkthroughAction) => {
    if (writingWalkthrough.current) return;
    if (action === "skip" && walkthroughError) {
      setDevice("complete");
      return;
    }
    writingWalkthrough.current = true;
    setFinishing(true);
    setWalkthroughError("");
    try {
      await AsyncStorage.setItem(walkthroughKey, completed);
      setAuthPage(action === "complete" ? "signup" : "login");
      setDevice("complete");
    } catch {
      setWalkthroughError(
        "Couldn’t save your progress. Try again, or tap Log in to continue for this launch.",
      );
    } finally {
      writingWalkthrough.current = false;
      setFinishing(false);
    }
  };

  const finishGoals = async (goals: WellnessGoal[]) => {
    if (!account || savingGoals.current) return;
    savingGoals.current = true;
    // Keep the picker mounted if the account snapshot commits before the
    // save callback advances to the welcome screen.
    setGoalFlow({ account });
    try {
      const saved = await app.saveWellnessGoals(goals, true);
      if (current.current === account) {
        goalDraft.current = null;
        setGoalFlow(
          goals.length && saved.length ? { account, goals: saved } : null,
        );
      }
    } catch {
      if (current.current === account) setGoalFlow(null);
      throw new Error(
        "Couldn’t save your goals. Check your connection and try again.",
      );
    } finally {
      savingGoals.current = false;
    }
  };

  const showFirstLaunch = !knownSession && !app.sessionError && !app.appLocked;
  const stage =
    showFirstLaunch && device === "loading"
      ? "loading"
      : showFirstLaunch && device === "new"
        ? "walkthrough"
        : currentFlow?.goals
          ? "goal-welcome"
          : account &&
              (currentFlow || app.user?.wellnessOnboarding === "pending")
            ? "goals"
            : "app";
  return {
    stage,
    authPage,
    finishing,
    walkthroughError,
    finishWalkthrough,
    finishGoals,
    draftGoals:
      goalDraft.current?.account === account
        ? goalDraft.current?.goals
        : undefined,
    rememberGoals: (goals: WellnessGoal[]) => {
      if (account) goalDraft.current = { account, goals };
    },
    welcomeGoals: currentFlow?.goals,
    finishWelcome: () => setGoalFlow(null),
  };
}
