import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { API_URL, useApp } from "./store";
import {
  googleAuthMessage,
  runGoogleFlow,
  type GoogleFlowProof,
} from "./google-auth-flow";

type Availability =
  "checking" | "available" | "unavailable" | "failed" | "linked";

export function useGoogleAuth(mode: "login" | "link", enabled = true) {
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;
  const ownerId = mode === "link" ? app.user?.id : undefined;
  const mobile = Platform.OS === "ios" || Platform.OS === "android";
  const secureConnection = API_URL.startsWith("https://");
  const blocked = mode === "link" && (app.appLocked || app.privacyCovered);
  const canCheck = enabled && mobile && secureConnection && !blocked;
  const [status, setStatus] = useState<{
    ownerId?: string;
    availability: Availability;
  }>({ availability: "checking" });
  const availability =
    status.ownerId === ownerId ? status.availability : "checking";
  const setAvailability = (next: Availability) =>
    setStatus({ ownerId, availability: next });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    ownerId?: string;
    text: string;
    error?: boolean;
  }>();
  const pending = useRef<AbortController | null>(null);
  const resumeLink = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!canCheck || pending.current) return;
    const request = new AbortController();
    setAvailability("checking");
    const check = async () => {
      try {
        const config = await appRef.current.googleConfiguration(request.signal);
        if (request.signal.aborted) return;
        const linked =
          mode === "link"
            ? (await appRef.current.googleLinkStatus(request.signal)).linked ===
              true
            : false;
        if (!request.signal.aborted)
          setAvailability(
            linked
              ? "linked"
              : config.enabled === true
                ? "available"
                : "unavailable",
          );
      } catch {
        if (!request.signal.aborted) setAvailability("failed");
      }
    };
    void check();
    return () => request.abort();
  }, [attempt, canCheck, mode, ownerId]);

  useEffect(
    () => () => {
      const request = pending.current;
      if (request) {
        pending.current = null;
        request.abort();
        setBusy(false);
      }
    },
    [enabled, mode, ownerId],
  );
  useEffect(() => {
    if (!blocked) resumeLink.current?.();
  }, [blocked]);

  async function currentUnlockedAccount(signal: AbortSignal) {
    const current = appRef.current;
    if (signal.aborted || current.user?.id !== ownerId)
      throw new Error("The account changed.");
    if (current.appLocked || current.privacyCovered) {
      await new Promise<void>((resolve, reject) => {
        const cancel = () => {
          resumeLink.current = null;
          reject(new Error("The linking request was cancelled."));
        };
        resumeLink.current = () => {
          resumeLink.current = null;
          signal.removeEventListener("abort", cancel);
          resolve();
        };
        signal.addEventListener("abort", cancel, { once: true });
      });
    }
    if (signal.aborted || appRef.current.user?.id !== ownerId)
      throw new Error("The account changed.");
    return appRef.current;
  }

  async function completeLink(proof: GoogleFlowProof, signal: AbortSignal) {
    const current = await currentUnlockedAccount(signal);
    try {
      if ((await current.googleLinkComplete(proof, signal)).linked !== true)
        throw new Error("Solace did not confirm the link.");
    } catch (error) {
      if (signal.aborted || !appRef.current.appLocked) throw error;
      // A background lock can interrupt the response after the server committed.
      const unlocked = await currentUnlockedAccount(signal);
      if (
        (await unlocked.googleLinkStatus(signal)).linked !== true &&
        (await unlocked.googleLinkComplete(proof, signal)).linked !== true
      )
        throw new Error("Solace did not confirm the link.");
    }
  }

  async function start() {
    if (pending.current || !canCheck || availability !== "available") return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setMessage(undefined);
    Keyboard.dismiss();
    try {
      const result = await runGoogleFlow(
        {
          apiOrigin: new URL(API_URL).origin,
          randomBytes: Crypto.getRandomBytesAsync,
          digestBase64: (value) =>
            Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              value,
              {
                encoding: Crypto.CryptoEncoding.BASE64,
              },
            ),
          start: mode === "link" ? app.googleLinkStart : app.googleLoginStart,
          open: WebBrowser.openAuthSessionAsync,
          complete: mode === "link" ? completeLink : app.googleLogin,
        },
        request.signal,
      );
      if (request.signal.aborted) return;
      if (result === "cancelled") {
        setMessage({
          ownerId,
          text:
            mode === "link"
              ? "Google linking was cancelled."
              : "Google sign-in was cancelled.",
        });
      } else if (mode === "link") {
        setAvailability("linked");
      }
    } catch (error) {
      if (!request.signal.aborted)
        setMessage({
          ownerId,
          text: googleAuthMessage(error, mode === "link"),
          error:
            (error as { code?: unknown } | null)?.code !== "GOOGLE_CANCELLED",
        });
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  const notice = !mobile
    ? "Google sign-in is available in the Solace mobile app."
    : !secureConnection
      ? __DEV__
        ? "Google sign-in needs a reachable HTTPS Solace API. See the Google setup guide."
        : "Google sign-in is currently unavailable."
      : availability === "failed"
        ? "Couldn’t check Google availability. Check your connection and try again."
        : availability === "unavailable"
          ? __DEV__
            ? "Google sign-in is not configured on this server. See the Google setup guide."
            : "Google sign-in is currently unavailable."
          : undefined;

  return {
    availability: canCheck ? availability : "unavailable",
    busy,
    message: message?.ownerId === ownerId ? message : undefined,
    clearMessage: () => setMessage(undefined),
    notice,
    pending,
    retry: () => setAttempt((previous) => previous + 1),
    start,
  };
}

const GoogleLinkContext = createContext<ReturnType<
  typeof useGoogleAuth
> | null>(null);

export function GoogleLinkProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  // Keep the proof in memory when the protected account screen unmounts to lock.
  const auth = useGoogleAuth("link", !!app.user && app.route === "account");
  return createElement(GoogleLinkContext.Provider, { value: auth }, children);
}

export function useGoogleAccountLink() {
  const auth = useContext(GoogleLinkContext);
  if (!auth) throw new Error("Google account linking requires its provider.");
  return auth;
}
