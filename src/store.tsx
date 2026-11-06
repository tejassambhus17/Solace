import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, AppState as NativeAppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiConnectionError, resolveApiConfiguration } from "./api-config";
import {
  createOfflineVault,
  isProtectedDraft,
  isRecoverableConnectionError,
  matchesPending,
  writingRecord,
  type PendingWrite,
  type WritingCollection,
} from "./offline";

import type { SolaceMoment } from "../server/src/moment-contract";

export type MomentResult = {
  activity: SolaceMoment | null;
  provider: "live" | "offline";
  explanation: string;
  usedMemoryIds: string[];
  support?: boolean;
  message?: string;
};
export type WeeklyReflectionResult = {
  provider: "live" | "offline";
  hasActivity: boolean;
  prompt: string;
  reflection: string;
  facts: {
    checkins: number;
    completedSessions: number;
    minutes: number;
    reflections: number;
    helpfulSessions: number;
    days: string[];
  };
  period: { start: string; end: string };
  explanation: string;
};
type WeeklyReflectionOptions = {
  today?: string;
  timeZone?: string;
  signal?: AbortSignal;
};

export type Item = Record<string, any> & { id?: string };
export type Collection =
  | "checkins"
  | "conversations"
  | "sessions"
  | "reflections"
  | "assessments"
  | "memories"
  | "reminders"
  | "plans"
  | "favorites"
  | "preferences"
  | "goals";
export type Data = Record<Collection, Item[]>;
export type EditorDraft = Record<string, string>;
const mainTabs = new Set(["today", "chat", "journey", "profile"]);
const mainTabFor = (name: string) =>
  name === "solace" ? "chat" : mainTabs.has(name) ? name : null;
const emptyData = (): Data => ({
  checkins: [],
  conversations: [],
  sessions: [],
  reflections: [],
  assessments: [],
  memories: [],
  reminders: [],
  plans: [],
  favorites: [],
  preferences: [],
  goals: [],
});
const apiConfiguration = resolveApiConfiguration({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  platform: Platform.OS,
  development: typeof __DEV__ !== "undefined" && __DEV__,
  webHostname:
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.hostname
      : undefined,
});
export const API_URL = apiConfiguration.baseUrl || "";
const TOKEN_KEY = "solace.session";
const newChatRequestId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  // This is an idempotency identifier scoped to an account, never a credential.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (digit) => {
    const bits = Math.floor(Math.random() * 16);
    return (digit === "x" ? bits : (bits & 3) | 8).toString(16);
  });
};
const persist = {
  get: () =>
    Platform.OS === "web"
      ? AsyncStorage.getItem(TOKEN_KEY)
      : SecureStore.getItemAsync(TOKEN_KEY),
  set: (value: string) =>
    Platform.OS === "web"
      ? AsyncStorage.setItem(TOKEN_KEY, value)
      : SecureStore.setItemAsync(TOKEN_KEY, value),
  remove: () =>
    Platform.OS === "web"
      ? AsyncStorage.removeItem(TOKEN_KEY)
      : SecureStore.deleteItemAsync(TOKEN_KEY),
};
export type AppState = {
  user: Item | null;
  data: Data;
  initializing: boolean;
  sessionError: string | null;
  sessionExpired: boolean;
  retrySession: () => Promise<void>;
  busy: boolean;
  error: string | null;
  route: string;
  activeTab: string;
  inExplore: boolean;
  params: Record<string, any>;
  canGoBack: boolean;
  token: string | null;
  chatDrafts: Record<string, string>;
  setChatDraft: (key: string, text: string, expected?: string) => void;
  editorDrafts: Record<string, EditorDraft>;
  setEditorDraft: (
    key: string,
    draft: EditorDraft | null,
    expected?: EditorDraft,
  ) => void;
  pendingWrites: Omit<PendingWrite, "record">[];
  syncingWrites: boolean;
  offlineError: string | null;
  draftProtection: "device" | "memory";
  flushPendingWrites: () => Promise<void>;
  discardPendingWrite: (id: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  save: (collection: Collection, record: Item) => Promise<Item>;
  remove: (collection: Collection, id: string) => Promise<void>;
  navigate: (name: string, params?: Record<string, any>) => void;
  setParams: (params: Record<string, any>) => void;
  back: () => void;
  setTab: (name: string) => void;
  chat: (text: string, conversationId?: string) => Promise<any>;
  generateMoment: (
    feeling: string,
    environment?: "forest" | "ocean" | "twilight",
  ) => Promise<MomentResult>;
  weeklyReflection: (
    endDate?: string,
    options?: WeeklyReflectionOptions,
  ) => Promise<WeeklyReflectionResult>;
  capabilities: () => Promise<{
    voiceTranscription: boolean;
    aiProvider: "live" | "offline";
  }>;
  transcribeVoice: (
    audio: ArrayBuffer,
    contentType: string,
  ) => Promise<{ text: string; provider: "live" }>;
  updateUser: (changes: Item) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportData: () => Promise<any>;
};
const Context = createContext<AppState | null>(null);
async function request(
  path: string,
  token: string | null,
  options: RequestInit = {},
  sessionSignal?: AbortSignal,
) {
  if (!apiConfiguration.baseUrl)
    throw new Error(
      apiConfiguration.error || "Solace's API address is not configured.",
    );
  const controller = new AbortController();
  const externalSignals = [options.signal, sessionSignal];
  const cancel = () => controller.abort();
  for (const signal of externalSignals) {
    if (signal?.aborted) cancel();
    else signal?.addEventListener("abort", cancel, { once: true });
  }
  const timer = setTimeout(
    () => controller.abort(),
    [
      "/chat",
      "/moments/generate",
      "/insights/weekly",
      "/voice/transcribe",
    ].includes(path)
      ? 45000
      : 15000,
  );
  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(`${API_URL}/api${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      text = await response.text();
    } catch {
      if (externalSignals.some((signal) => signal?.aborted))
        throw new Error("The request was cancelled.");
      const error = new Error(
        apiConnectionError(apiConfiguration, controller.signal.aborted),
      ) as Error & { connection: boolean };
      error.connection = true;
      throw error;
    }
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {}
    }
    if (!response.ok) {
      const error = new Error(
        (typeof body?.error === "string" && body.error) ||
          (typeof body?.message === "string" && body.message) ||
          "Something went wrong. Please try again.",
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    if (
      response.status === 204 &&
      (options.method === "DELETE" || path === "/auth/logout")
    )
      return null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error(
        "Solace returned an unexpected response. Please try again.",
      );
    return body;
  } finally {
    for (const signal of externalSignals)
      signal?.removeEventListener("abort", cancel);
    clearTimeout(timer);
  }
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const sessionRequests = useRef<AbortController | null>(null);
  sessionRequests.current ??= new AbortController();
  const advanceSession = () => {
    const version = ++generation.current;
    const previous = sessionRequests.current;
    sessionRequests.current = new AbortController();
    previous?.abort();
    return version;
  };
  const accountTransition = useRef<number | null>(null);
  const owner = useRef<string | null>(null);
  const revision = useRef(0);
  const credentialWrites = useRef<Promise<void>>(Promise.resolve());
  const vault = useRef(
    createOfflineVault(
      Platform.OS === "web"
        ? undefined
        : {
            get: (key) => SecureStore.getItemAsync(key),
            set: (key, value) =>
              SecureStore.setItemAsync(key, value, {
                keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
              }),
            remove: (key) => SecureStore.deleteItemAsync(key),
          },
    ),
  ).current;
  const pending = useRef<PendingWrite[]>([]);
  const writingOwner = useRef<string | null>(null);
  const editors = useRef<Record<string, EditorDraft>>({});
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushLock = useRef<Promise<void> | null>(null);
  const discarding = useRef(new Set<string>());
  const retryWriting = useRef<
    Partial<
      Record<WritingCollection, { fingerprint: string; entry: PendingWrite }>
    >
  >({});
  const writeCredential = (value: string | null, version: number) => {
    // Serialize device credential changes. A late sign-in write cannot restore
    // its token after a newer logout/account switch has removed it.
    const job = credentialWrites.current
      .catch(() => {})
      .then(async () => {
        if (version !== generation.current) return;
        if (value === null) await persist.remove();
        else await persist.set(value);
      });
    credentialWrites.current = job;
    return job;
  };
  const assertSession = (version: number) => {
    if (version !== generation.current)
      throw new Error(
        "Your session changed. Please try again in the current account.",
      );
  };
  const canUseAccount = (version: number) =>
    version === generation.current && accountTransition.current !== version;
  const assertActiveSession = (version: number) => {
    assertSession(version);
    if (!canUseAccount(version))
      throw new Error(
        "Wait for the current account change to finish and try again.",
      );
  };
  const finishAccountTransition = (version: number) => {
    if (accountTransition.current === version) accountTransition.current = null;
    if (version === generation.current) setBusy(false);
  };
  const [user, setUser] = useState<Item | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyData());
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const chatAttempts = useRef(new Map<string, { id: string; text: string }>());
  const [editorDrafts, setEditorDrafts] = useState<Record<string, EditorDraft>>(
    {},
  );
  const [pendingWrites, setPendingWrites] = useState<
    Omit<PendingWrite, "record">[]
  >([]);
  const [syncingWrites, setSyncingWrites] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const publishPending = (entries: PendingWrite[]) => {
    pending.current = entries;
    setPendingWrites(entries.map(({ record: _record, ...entry }) => entry));
  };
  const mergePending = (snapshot: Data) => {
    const next = { ...emptyData(), ...snapshot };
    for (const entry of pending.current) {
      next[entry.collection] = [
        { ...entry.record, localOnly: true },
        ...next[entry.collection].filter((record) => record.id !== entry.id),
      ];
    }
    return next;
  };
  const restoreWriting = async (account: string, version: number) => {
    try {
      const snapshot = await vault.read(account);
      assertSession(version);
      if (owner.current !== account) return;
      publishPending(snapshot.pending);
      writingOwner.current = account;
      editors.current = { ...snapshot.drafts, ...editors.current };
      setEditorDrafts(editors.current);
      setOfflineError(null);
    } catch (error) {
      if (version === generation.current)
        setOfflineError(
          error instanceof Error
            ? error.message
            : "Could not restore protected writing.",
        );
    }
  };
  const clearWriting = async (account: string | null) => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    if (account) await vault.clear(account);
  };
  const draftGeneration = generation.current;
  const setChatDraft = (key: string, text: string, expected?: string) => {
    // A late completion from an old account must never restore its private text.
    if (!canUseAccount(draftGeneration)) return;
    if (
      expected === undefined &&
      chatAttempts.current.get(key)?.text !== text.trim()
    )
      chatAttempts.current.delete(key);
    setChatDrafts((previous) => {
      if (expected !== undefined && previous[key] !== expected) return previous;
      if (text) return { ...previous, [key]: text };
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };
  const setEditorDraft = (
    key: string,
    draft: EditorDraft | null,
    expected?: EditorDraft,
  ) => {
    if (!canUseAccount(draftGeneration)) return;
    const previous = editors.current;
    const current = previous[key];
    if (
      expected !== undefined &&
      (!current ||
        Object.keys(current).length !== Object.keys(expected).length ||
        Object.keys(expected).some(
          (field) => current[field] !== expected[field],
        ))
    )
      return;
    const next = { ...previous };
    if (draft) next[key] = { ...draft };
    else delete next[key];
    editors.current = next;
    setEditorDrafts(next);
    const account = owner.current;
    if (!account || !isProtectedDraft(key)) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    const protectedDrafts = Object.fromEntries(
      Object.entries(next).filter(([draftKey]) => isProtectedDraft(draftKey)),
    );
    const persistDraft = async () => {
      if (!canUseAccount(draftGeneration)) return;
      try {
        await vault.update(account, (snapshot) => ({
          ...snapshot,
          drafts: protectedDrafts,
        }));
        if (draftGeneration === generation.current) setOfflineError(null);
      } catch (error) {
        if (draftGeneration === generation.current)
          setOfflineError(
            error instanceof Error
              ? error.message
              : "Your draft is open here but could not be protected on this device.",
          );
      }
    };
    // Short debounce limits keychain work while typing. Clear/save operations
    // commit immediately so a removed draft does not reappear after restart.
    if (draft === null) void persistDraft();
    else
      draftTimer.current = setTimeout(() => {
        draftTimer.current = null;
        void persistDraft();
      }, 650);
  };
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<
    { name: string; params: Record<string, any> }[]
  >([{ name: "today", params: {} }]);
  const expireSession = (error: unknown, version: number) => {
    if (
      (error as Error & { status?: number }).status !== 401 ||
      version !== generation.current
    )
      return;
    const expiredVersion = advanceSession();
    setToken(null);
    setSessionError(null);
    setSessionExpired(true);
    setBusy(false);
    setSyncingWrites(false);
    // Drafts and the intended route stay in memory for this account only.
    // Authenticated content is hidden by Shell until reauthentication.
    void writeCredential(null, expiredVersion).catch(() => {});
  };
  const authenticatedRequest = async (
    path: string,
    options: RequestInit,
    version: number,
    allowAccountTransition = false,
  ) => {
    if (allowAccountTransition) assertSession(version);
    else assertActiveSession(version);
    if (!token) throw new Error("Please sign in again to continue.");
    try {
      return await request(
        path,
        token,
        options,
        sessionRequests.current?.signal,
      );
    } catch (error) {
      expireSession(error, version);
      throw error;
    }
  };
  const load = async (t: string, version = generation.current) => {
    assertSession(version);
    const startedAt = revision.current;
    const result = await request(
      "/state",
      t,
      {},
      sessionRequests.current?.signal,
    );
    assertSession(version);
    if (
      typeof result?.user?.id !== "string" ||
      !result.user.id ||
      !result.data ||
      typeof result.data !== "object" ||
      Array.isArray(result.data) ||
      Object.keys(emptyData()).some(
        (key) => key in result.data && !Array.isArray(result.data[key]),
      )
    )
      throw new Error(
        "Solace could not read your saved space. Please try again.",
      );
    owner.current = String(result.user.id);
    if (writingOwner.current !== owner.current)
      await restoreWriting(owner.current, version);
    assertSession(version);
    // A snapshot requested before a local save must not erase that newer save.
    if (startedAt === revision.current) {
      setData(mergePending({ ...emptyData(), ...result.data }));
      setUser(result.user);
    }
  };
  const restore = async (t: string, version = generation.current) => {
    assertSession(version);
    try {
      await load(t, version);
      assertSession(version);
      setToken(t);
      setSessionError(null);
      setSessionExpired(false);
    } catch (e) {
      if (version !== generation.current) return;
      if ((e as Error & { status?: number }).status === 401) {
        await writeCredential(null, version);
        if (version !== generation.current) return;
        setToken(null);
        setSessionError(null);
        setSessionExpired(false);
      } else {
        setToken(t);
        setSessionError(
          e instanceof Error ? e.message : "Could not restore your session.",
        );
      }
    }
  };
  useEffect(() => {
    let active = true;
    const version = generation.current;
    (async () => {
      try {
        const t = await persist.get();
        if (t && active && version === generation.current)
          await restore(t, version);
      } catch (e) {
        if (active && version === generation.current)
          setSessionError(
            e instanceof Error ? e.message : "Could not restore your session.",
          );
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const retrySession = async () => {
    const version = draftGeneration;
    assertActiveSession(version);
    setInitializing(true);
    try {
      const t = token || (await persist.get());
      assertSession(version);
      if (t) await restore(t, version);
      else setSessionError(null);
    } finally {
      setInitializing(false);
    }
  };
  const authorize = async (path: string, values: Item) => {
    assertActiveSession(draftGeneration);
    const version = advanceSession();
    accountTransition.current = version;
    flushLock.current = null;
    setSyncingWrites(false);
    setBusy(true);
    setError(null);
    try {
      const result = await request(
        path,
        null,
        { method: "POST", body: JSON.stringify(values) },
        sessionRequests.current?.signal,
      );
      assertSession(version);
      if (
        typeof result?.token !== "string" ||
        !result.token ||
        typeof result.user?.id !== "string" ||
        !result.user.id
      )
        throw new Error(
          "Solace could not read your new session. Please try again.",
        );
      const sameAccount = owner.current === result.user.id;
      if (!sameAccount) await clearWriting(owner.current);
      assertSession(version);
      await writeCredential(result.token, version);
      assertSession(version);
      if (!sameAccount) {
        writingOwner.current = null;
        retryWriting.current = {};
        publishPending([]);
        editors.current = {};
        chatAttempts.current.clear();
        setChatDrafts({});
        setEditorDrafts({});
        setData(emptyData());
        setStack([{ name: "today", params: {} }]);
      }
      owner.current = String(result.user.id);
      setUser(null);
      setToken(result.token);
      setSessionError(null);
      try {
        await load(result.token, version);
      } catch (e) {
        assertSession(version);
        // The account and session already exist. Retry data loading instead of
        // asking the user to submit registration or credentials a second time.
        setSessionError(
          e instanceof Error ? e.message : "Could not load your saved space.",
        );
        setSessionExpired(false);
        return;
      }
      setSessionExpired(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Unable to sign in";
      if (version === generation.current) setError(m);
      throw e;
    } finally {
      finishAccountTransition(version);
    }
  };
  const signIn = (email: string, password: string) =>
    authorize("/auth/login", { email, password });
  const signUp = (name: string, email: string, password: string) =>
    authorize("/auth/register", { name, email, password });
  const signOut = async () => {
    assertSession(draftGeneration);
    const version = advanceSession();
    accountTransition.current = version;
    flushLock.current = null;
    setSyncingWrites(false);
    setBusy(true);
    try {
      // Do not report logout complete if protected writing could not be erased.
      try {
        await clearWriting(owner.current);
      } catch (error) {
        if (version === generation.current)
          setOfflineError(
            "Protected writing could not be removed from this device. Please try signing out again.",
          );
        throw error;
      }
      assertSession(version);
      try {
        if (token) await request("/auth/logout", token, { method: "POST" });
      } catch {}
      if (version !== generation.current) return;
      try {
        await writeCredential(null, version);
      } catch (error) {
        if (version === generation.current)
          setOfflineError(
            "This device could not clear its saved sign-in. Please try signing out again.",
          );
        throw error;
      }
      assertSession(version);
      owner.current = null;
      writingOwner.current = null;
      retryWriting.current = {};
      publishPending([]);
      editors.current = {};
      setOfflineError(null);
      setToken(null);
      setUser(null);
      setSessionError(null);
      setSessionExpired(false);
      setData(emptyData());
      chatAttempts.current.clear();
      setChatDrafts({});
      setEditorDrafts({});
      setStack([{ name: "today", params: {} }]);
    } finally {
      finishAccountTransition(version);
    }
  };
  const refresh = async () => {
    const version = draftGeneration;
    assertActiveSession(version);
    if (token) {
      try {
        await load(token, version);
      } catch (error) {
        expireSession(error, version);
        throw error;
      }
    }
  };
  const postWriting = async (
    entry: PendingWrite,
    version: number,
  ): Promise<Item> => {
    try {
      const result = await authenticatedRequest(
        `/records/${entry.collection}`,
        {
          method: "POST",
          body: JSON.stringify(entry.record),
        },
        version,
      );
      assertSession(version);
      return result.record;
    } catch (error) {
      if ((error as { status?: number }).status === 401) throw error;
      assertSession(version);
      if ((error as { status?: number }).status !== 409) throw error;
      // A lost response may mean the first POST committed. The server lists
      // only this authenticated owner's records; equality prevents ID reuse
      // from acknowledging different writing as successfully synchronized.
      const result = await authenticatedRequest(
        `/records/${entry.collection}`,
        {},
        version,
      );
      assertSession(version);
      const existing = result.records?.find(
        (record: Item) => record.id === entry.id,
      );
      if (!existing || !matchesPending(entry, existing))
        throw new Error(
          "This entry could not be matched safely. Your device copy is still here; please retry or export your writing before removing it.",
        );
      return existing;
    }
  };
  const flushPendingWrites = async () => {
    const version = draftGeneration;
    assertActiveSession(version);
    if (!token || !owner.current)
      throw new Error("Please sign in again to sync your writing.");
    if (flushLock.current) return flushLock.current;
    const account = owner.current;
    const job = (async () => {
      setSyncingWrites(true);
      setOfflineError(null);
      try {
        for (const entry of [...pending.current]) {
          assertSession(version);
          if (discarding.current.has(entry.id)) continue;
          const saved = await postWriting(entry, version);
          assertSession(version);
          const snapshot = await vault.update(account, (current) => ({
            ...current,
            pending: current.pending.filter((item) => item.id !== entry.id),
          }));
          assertSession(version);
          publishPending(snapshot.pending);
          revision.current += 1;
          setData((previous) => ({
            ...previous,
            [entry.collection]: [
              saved,
              ...previous[entry.collection].filter(
                (item) => item.id !== entry.id,
              ),
            ],
          }));
        }
      } catch (error) {
        if (version === generation.current)
          setOfflineError(
            error instanceof Error
              ? error.message
              : "Your writing is still on this device. Try syncing again.",
          );
        throw error;
      } finally {
        if (version === generation.current) setSyncingWrites(false);
      }
    })();
    flushLock.current = job;
    try {
      await job;
    } finally {
      if (flushLock.current === job) flushLock.current = null;
    }
  };
  const discardPendingWrite = async (id: string) => {
    const version = draftGeneration;
    assertActiveSession(version);
    if (flushLock.current)
      throw new Error(
        "Please wait for syncing to finish before removing this entry.",
      );
    const account = owner.current;
    const entry = pending.current.find((item) => item.id === id);
    if (!account || !entry || discarding.current.has(id)) return;
    discarding.current.add(id);
    try {
      const snapshot = await vault.update(account, (current) => ({
        ...current,
        pending: current.pending.filter((item) => item.id !== id),
      }));
      assertSession(version);
      publishPending(snapshot.pending);
      revision.current += 1;
      setData((previous) => ({
        ...previous,
        [entry.collection]: previous[entry.collection].filter(
          (item) => item.id !== id,
        ),
      }));
      setOfflineError(null);
    } finally {
      discarding.current.delete(id);
    }
  };
  const save = async (collection: Collection, record: Item) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    const id = record.id;
    const queued = pending.current.find(
      (entry) => entry.collection === collection && entry.id === id,
    );
    if (queued)
      throw new Error("Sync this device-saved entry before editing it.");
    if (!id && (collection === "checkins" || collection === "reflections")) {
      const account = owner.current;
      assertActiveSession(version);
      if (!account)
        throw new Error("Please sign in again to save your writing.");
      const fields = writingRecord(collection, { ...record, id: "identity" });
      const { createdAt: _createdAt, ...content } = fields;
      const fingerprint = JSON.stringify(content);
      const prior = retryWriting.current[collection];
      const submitted =
        prior?.fingerprint === fingerprint
          ? prior.entry.record
          : writingRecord(collection, {
              ...record,
              // This is a retry identity, never a credential. Account ownership is
              // enforced by the API and by the vault's authenticated account key.
              id: `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
              createdAt: record.createdAt || new Date().toISOString(),
            });
      const entry: PendingWrite = {
        id: submitted.id,
        collection,
        createdAt: submitted.createdAt,
        record: submitted,
      };
      // Keep identity even if the protected queue itself fails (for example a
      // full keychain). Retrying unchanged writing can reconcile a lost response
      // instead of creating a second server record with a fresh identity.
      retryWriting.current[collection] = { fingerprint, entry };
      let saved: Item;
      try {
        saved = await postWriting(entry, version);
      } catch (error) {
        if ((error as { status?: number }).status === 401) throw error;
        assertSession(version);
        if (!isRecoverableConnectionError(error)) throw error;
        // Await the protected commit before claiming it was saved on-device.
        const snapshot = await vault.update(account, (current) => ({
          ...current,
          pending: [
            ...current.pending.filter((item) => item.id !== entry.id),
            entry,
          ],
        }));
        assertSession(version);
        publishPending(snapshot.pending);
        setOfflineError(null);
        saved = { ...submitted, localOnly: true };
      }
      assertSession(version);
      delete retryWriting.current[collection];
      revision.current += 1;
      setData((previous) => ({
        ...previous,
        [collection]: [
          saved,
          ...previous[collection].filter((item) => item.id !== saved.id),
        ],
      }));
      return saved;
    }
    const createWithId =
      !!id &&
      ["sessions", "preferences", "goals", "memories", "reminders"].includes(
        collection,
      ) &&
      !data[collection].some((item) => item.id === id);
    const updating = !!id && !createWithId;
    const result = await authenticatedRequest(
      `/records/${collection}${updating ? "/" + encodeURIComponent(id!) : ""}`,
      { method: updating ? "PATCH" : "POST", body: JSON.stringify(record) },
      version,
    );
    assertSession(version);
    const saved = result.record;
    revision.current += 1;
    setData((prev) => ({
      ...prev,
      [collection]: updating
        ? prev[collection].map((x) => (x.id === id ? saved : x))
        : [saved, ...prev[collection].filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };
  const remove = async (collection: Collection, id: string) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    if (
      pending.current.some(
        (entry) => entry.collection === collection && entry.id === id,
      )
    ) {
      await discardPendingWrite(id);
      return;
    }
    await authenticatedRequest(
      `/records/${collection}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
      version,
    );
    assertSession(version);
    revision.current += 1;
    if (collection === "conversations") chatAttempts.current.delete(id);
    setData((previous) => {
      const next = {
        ...previous,
        [collection]: previous[collection].filter((record) => record.id !== id),
      };
      if (collection === "conversations" || collection === "sessions") {
        const sessionIds = new Set(
          collection === "sessions"
            ? [id]
            : previous.sessions
                .filter((session) => session.sourceConversationId === id)
                .map((session) => session.id),
        );
        next.memories = next.memories.filter(
          (memory) =>
            !(
              memory.sourceType === "session" && sessionIds.has(memory.sourceId)
            ) &&
            (collection !== "conversations" ||
              (memory.sourceConversationId !== id &&
                !(
                  memory.sourceType === "conversation" && memory.sourceId === id
                ))),
        );
      }
      return next;
    });
    // DELETE has succeeded. A connection error during reconciliation must not
    // turn that committed operation into a misleading failure or stale record.
    try {
      await load(token, version);
    } catch (error) {
      expireSession(error, version);
    }
  };
  const chat = async (text: string, conversationId?: string) => {
    const version = draftGeneration;
    assertActiveSession(version);
    if (!token) throw new Error("Please sign in first.");
    const key = conversationId || "new";
    const previous = chatAttempts.current.get(key);
    const attempt =
      previous?.text === text ? previous : { text, id: newChatRequestId() };
    chatAttempts.current.set(key, attempt);
    const forgetAttempt = () => {
      if (chatAttempts.current.get(key) === attempt)
        chatAttempts.current.delete(key);
    };
    let result: any;
    try {
      result = await authenticatedRequest(
        "/chat",
        {
          method: "POST",
          body: JSON.stringify({ text, conversationId, requestId: attempt.id }),
        },
        version,
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![401, 408, 425, 429].includes(status)
      )
        forgetAttempt();
      throw error;
    }
    assertSession(version);
    if (
      typeof result?.conversation?.id !== "string" ||
      !Array.isArray(result.conversation.messages)
    )
      throw new Error(
        "Solace returned an unexpected reply. Please retry your message.",
      );
    forgetAttempt();
    revision.current += 1;
    setData((prev) => ({
      ...prev,
      conversations: [
        result.conversation,
        ...prev.conversations.filter((x) => x.id !== result.conversation.id),
      ],
    }));
    return result;
  };
  const featureRequest = async (path: string, options: RequestInit = {}) => {
    const version = draftGeneration;
    const result = await authenticatedRequest(path, options, version);
    assertSession(version);
    return result;
  };
  const generateMoment = (
    feeling: string,
    environment?: "forest" | "ocean" | "twilight",
  ): Promise<MomentResult> =>
    featureRequest("/moments/generate", {
      method: "POST",
      body: JSON.stringify({ feeling, environment }),
    });
  const weeklyReflection = (
    endDate?: string,
    { today, timeZone, signal }: WeeklyReflectionOptions = {},
  ): Promise<WeeklyReflectionResult> =>
    featureRequest("/insights/weekly", {
      method: "POST",
      body: JSON.stringify({ endDate, today, timeZone }),
      signal,
    });
  const capabilities = () => featureRequest("/capabilities");
  const transcribeVoice = (audio: ArrayBuffer, contentType: string) =>
    featureRequest("/voice/transcribe", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: audio,
    });
  const updateUser = async (changes: Item) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    const result = await authenticatedRequest(
      "/auth/me",
      {
        method: "PATCH",
        body: JSON.stringify(changes),
      },
      version,
    );
    assertSession(version);
    revision.current += 1;
    setUser(result.user);
  };
  const deleteAccount = async () => {
    assertActiveSession(draftGeneration);
    if (!token) throw new Error("Please sign in first.");
    const version = advanceSession();
    accountTransition.current = version;
    flushLock.current = null;
    setSyncingWrites(false);
    setBusy(true);
    try {
      // Erase the device vault first. Once the API commits account deletion,
      // storage trouble must never make us claim the online deletion failed.
      await clearWriting(owner.current);
      assertSession(version);
      const localIds = new Set(pending.current.map((entry) => entry.id));
      publishPending([]);
      editors.current = {};
      setEditorDrafts({});
      retryWriting.current = {};
      setData((previous) => ({
        ...previous,
        checkins: previous.checkins.filter(
          (record) => !localIds.has(record.id!),
        ),
        reflections: previous.reflections.filter(
          (record) => !localIds.has(record.id!),
        ),
      }));
      await authenticatedRequest(
        "/account",
        { method: "DELETE" },
        version,
        true,
      );
      assertSession(version);
      owner.current = null;
      writingOwner.current = null;
      retryWriting.current = {};
      publishPending([]);
      editors.current = {};
      setOfflineError(null);
      setToken(null);
      setUser(null);
      setData(emptyData());
      chatAttempts.current.clear();
      setChatDrafts({});
      setEditorDrafts({});
      setSessionExpired(false);
      setSessionError(null);
      setStack([{ name: "today", params: {} }]);
      try {
        await writeCredential(null, version);
      } catch {
        if (version === generation.current)
          setSessionError(
            "Your online account was deleted. This device could not clear its old sign-in. Retry to finish cleaning up.",
          );
      }
    } catch (error) {
      if (version === generation.current)
        setOfflineError(
          error instanceof Error
            ? error.message
            : "Could not finish removing protected writing. Please try again.",
        );
      throw error;
    } finally {
      finishAccountTransition(version);
    }
  };
  const exportData = async () => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    const result = await authenticatedRequest("/export", {}, version);
    assertSession(version);
    return result;
  };
  const navigate = (name: string, params: Record<string, any> = {}) => {
    if (draftGeneration !== generation.current) return;
    const tab = mainTabFor(name);
    setStack((old) => {
      if (tab) return [{ name: tab, params }];
      if (name === "explore") {
        const index = old.findIndex((entry) => entry.name === "explore");
        if (index !== -1)
          return index === old.length - 1 ? old : old.slice(0, index + 1);
      }
      return [...old, { name, params }];
    });
  };
  const setParams = (params: Record<string, any>) => {
    if (draftGeneration !== generation.current) return;
    setStack((old) =>
      old.map((entry, index) =>
        index === old.length - 1
          ? { ...entry, params: { ...entry.params, ...params } }
          : entry,
      ),
    );
  };
  const back = () => {
    if (draftGeneration !== generation.current) return;
    setStack((old) =>
      old.length > 1 ? old.slice(0, -1) : [{ name: "today", params: {} }],
    );
  };
  const setTab = (name: string) => {
    if (draftGeneration !== generation.current) return;
    const tab = mainTabFor(name);
    if (tab) setStack([{ name: tab, params: {} }]);
  };
  const current = stack[stack.length - 1];
  const activeTab = mainTabFor(stack[0].name) || "today";
  const inExplore = stack.some((entry) => entry.name === "explore");
  useEffect(() => {
    const version = draftGeneration;
    const account = owner.current;
    if (!account || !token) return;
    const protect = () => {
      if (!canUseAccount(version)) return;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = null;
      const drafts = Object.fromEntries(
        Object.entries(editors.current).filter(([key]) =>
          isProtectedDraft(key),
        ),
      );
      void vault
        .update(account, (snapshot) => ({ ...snapshot, drafts }))
        .catch(() => {
          if (version === generation.current)
            setOfflineError(
              "Your writing is open here but could not be protected on this device. Keep the app open and try saving again.",
            );
        });
    };
    const subscription = NativeAppState?.addEventListener?.(
      "change",
      (state) => {
        if (state === "inactive" || state === "background") protect();
      },
    );
    return () => subscription?.remove();
  }, [token, user?.id, draftGeneration]);
  useEffect(() => {
    if (!token || !user?.id || !pendingWrites.length || sessionExpired) return;
    const retry = () => {
      void flushPendingWrites().catch(() => {});
    };
    // Foreground retries and a short active timer cover reconnecting without
    // adding a native network dependency. Nothing claims background delivery.
    const timer = setInterval(retry, 30000);
    (timer as any).unref?.();
    const subscription = NativeAppState?.addEventListener?.(
      "change",
      (state) => {
        if (state === "active") retry();
      },
    );
    if (Platform.OS === "web" && typeof window !== "undefined")
      window.addEventListener("online", retry);
    return () => {
      clearInterval(timer);
      subscription?.remove();
      if (Platform.OS === "web" && typeof window !== "undefined")
        window.removeEventListener("online", retry);
    };
  }, [token, user?.id, pendingWrites.length, sessionExpired]);
  return (
    <Context.Provider
      value={{
        user,
        data,
        initializing,
        sessionError,
        sessionExpired,
        retrySession,
        busy,
        error,
        route: current.name,
        activeTab,
        inExplore,
        params: current.params,
        canGoBack: stack.length > 1,
        token,
        chatDrafts,
        setChatDraft,
        editorDrafts,
        setEditorDraft,
        pendingWrites,
        syncingWrites,
        offlineError,
        draftProtection: vault.durable ? "device" : "memory",
        flushPendingWrites,
        discardPendingWrite,
        signIn,
        signUp,
        signOut,
        refresh,
        save,
        remove,
        navigate,
        setParams,
        back,
        setTab,
        chat,
        generateMoment,
        weeklyReflection,
        capabilities,
        transcribeVoice,
        updateUser,
        deleteAccount,
        exportData,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
