import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import type { useApp } from "./store";

const walkthroughKey = "solace.onboarding.completed.v1";
const completed = "1";
const choiceKey = (account: string) => `solace.onboarding.choice.v1.${account}`;

export type WalkthroughAction = "skip" | "complete";
export type AuthPage = "login" | "signup";
type IntroApp = Pick<
  ReturnType<typeof useApp>,
  | "appLocked"
  | "initializing"
  | "sessionError"
  | "sessionExpired"
  | "user"
  | "updateUser"
>;

export function useOnboarding(app: IntroApp) {
  const [device, setDevice] = useState<"loading" | "new" | "complete">(
    "loading",
  );
  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [finishing, setFinishing] = useState(false);
  const [walkthroughError, setWalkthroughError] = useState("");
  const writingWalkthrough = useRef(false);
  const [authPresented, setAuthPresented] = useState(false);
  const [offer, setOffer] = useState<{
    account: string;
    status: "choice" | "saving";
    error?: string;
  } | null>(null);
  const savingChoice = useRef(false);
  const signedIn = !!app.user && !app.sessionExpired;
  const knownSession = signedIn || app.sessionExpired;
  const account = signedIn && app.user ? String(app.user.id) : null;
  const candidate = authPresented ? account : null;
  const current = useRef({
    account,
    consent: app.user?.personalization === true,
    update: app.updateUser,
  });
  current.current = {
    account,
    consent: app.user?.personalization === true,
    update: app.updateUser,
  };

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
    if (
      device === "complete" &&
      !knownSession &&
      !app.initializing &&
      !app.appLocked &&
      !app.sessionError
    )
      setAuthPresented(true);
  }, [app.appLocked, app.initializing, app.sessionError, device, knownSession]);

  useEffect(() => {
    if (!candidate) return;
    if (current.current.consent) {
      setAuthPresented(false);
      void AsyncStorage.setItem(choiceKey(candidate), completed).catch(
        () => {},
      );
      return;
    }
    let active = true;
    const read = (value: string | null) => {
      if (!active) return;
      if (value === completed) setAuthPresented(false);
      else setOffer({ account: candidate, status: "choice" });
    };
    void AsyncStorage.getItem(choiceKey(candidate)).then(read, () =>
      read(null),
    );
    return () => {
      active = false;
    };
  }, [candidate]);

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
        "Couldn’t save your progress. Try again, or tap Skip to continue for this launch.",
      );
    } finally {
      writingWalkthrough.current = false;
      setFinishing(false);
    }
  };

  const finishPersonalization = async (enable: boolean) => {
    const { account, update } = current.current;
    if (!account || account !== offer?.account || savingChoice.current) return;
    savingChoice.current = true;
    setOffer({ account, status: "saving" });
    try {
      if (enable) await update({ personalization: true });
      await AsyncStorage.setItem(choiceKey(account), completed).catch(() => {});
      if (current.current.account === account) {
        setOffer(null);
        setAuthPresented(false);
      }
    } catch {
      if (current.current.account === account)
        setOffer({
          account,
          status: "choice",
          error: "Couldn’t update your preference. Try again or skip for now.",
        });
    } finally {
      savingChoice.current = false;
    }
  };

  const showFirstLaunch = !knownSession && !app.sessionError && !app.appLocked;
  const currentOffer = offer?.account === candidate ? offer : null;
  const stage =
    (showFirstLaunch && device === "loading") || (candidate && !currentOffer)
      ? "loading"
      : showFirstLaunch && device === "new"
        ? "walkthrough"
        : currentOffer
          ? "personalize"
          : "app";
  return {
    stage,
    authPage,
    finishing,
    walkthroughError,
    finishWalkthrough,
    offer: currentOffer,
    finishPersonalization,
  };
}
