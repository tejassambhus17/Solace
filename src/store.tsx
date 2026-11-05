import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  | "favorites";
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
});
const webHost =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.hostname
    : "localhost";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : `http://${webHost}:3001`)
).replace(/\/$/, "");
const TOKEN_KEY = "solace.session";
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
  updateUser: (changes: Item) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportData: () => Promise<any>;
};
const Context = createContext<AppState | null>(null);
async function request(
  path: string,
  token: string | null,
  options: RequestInit = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    path === "/chat" ? 45000 : 15000,
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
      throw new Error(
        controller.signal.aborted
          ? "Solace is taking too long to respond. Please try again."
          : "Unable to connect to Solace. Check your connection and try again.",
      );
    }
    let body: any = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: text };
      }
    }
    if (!response.ok) {
      const error = new Error(
        body?.error ||
          body?.message ||
          "Something went wrong. Please try again.",
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const owner = useRef<string | null>(null);
  const revision = useRef(0);
  const credentialWrites = useRef<Promise<void>>(Promise.resolve());
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
  const [user, setUser] = useState<Item | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyData());
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [editorDrafts, setEditorDrafts] = useState<Record<string, EditorDraft>>(
    {},
  );
  const draftGeneration = generation.current;
  const setChatDraft = (key: string, text: string, expected?: string) => {
    // A late completion from an old account must never restore its private text.
    if (draftGeneration !== generation.current) return;
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
    if (draftGeneration !== generation.current) return;
    setEditorDrafts((previous) => {
      const current = previous[key];
      if (
        expected !== undefined &&
        (!current ||
          Object.keys(current).length !== Object.keys(expected).length ||
          Object.keys(expected).some(
            (field) => current[field] !== expected[field],
          ))
      )
        return previous;
      if (draft) return { ...previous, [key]: { ...draft } };
      const next = { ...previous };
      delete next[key];
      return next;
    });
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
    const expiredVersion = ++generation.current;
    setToken(null);
    setSessionError(null);
    setSessionExpired(true);
    setBusy(false);
    // Drafts and the intended route stay in memory for this account only.
    // Authenticated content is hidden by Shell until reauthentication.
    void writeCredential(null, expiredVersion).catch(() => {});
  };
  const authenticatedRequest = async (
    path: string,
    options: RequestInit,
    version: number,
  ) => {
    assertSession(version);
    if (!token) throw new Error("Please sign in again to continue.");
    try {
      return await request(path, token, options);
    } catch (error) {
      expireSession(error, version);
      throw error;
    }
  };
  const load = async (t: string, version = generation.current) => {
    assertSession(version);
    const startedAt = revision.current;
    const result = await request("/state", t);
    assertSession(version);
    owner.current = String(result.user.id);
    // A snapshot requested before a local save must not erase that newer save.
    if (startedAt === revision.current) {
      setData({ ...emptyData(), ...result.data });
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
    assertSession(version);
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
    assertSession(draftGeneration);
    const version = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await request(path, null, {
        method: "POST",
        body: JSON.stringify(values),
      });
      assertSession(version);
      await writeCredential(result.token, version);
      assertSession(version);
      const sameAccount = owner.current === String(result.user?.id);
      if (!sameAccount) {
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
      if (version === generation.current) setBusy(false);
    }
  };
  const signIn = (email: string, password: string) =>
    authorize("/auth/login", { email, password });
  const signUp = (name: string, email: string, password: string) =>
    authorize("/auth/register", { name, email, password });
  const signOut = async () => {
    assertSession(draftGeneration);
    const version = ++generation.current;
    try {
      if (token) await request("/auth/logout", token, { method: "POST" });
    } catch {}
    if (version !== generation.current) return;
    await writeCredential(null, version);
    assertSession(version);
    owner.current = null;
    setToken(null);
    setUser(null);
    setBusy(false);
    setSessionError(null);
    setSessionExpired(false);
    setData(emptyData());
    setChatDrafts({});
    setEditorDrafts({});
    setStack([{ name: "today", params: {} }]);
  };
  const refresh = async () => {
    const version = draftGeneration;
    assertSession(version);
    if (token) {
      try {
        await load(token, version);
      } catch (error) {
        expireSession(error, version);
        throw error;
      }
    }
  };
  const save = async (collection: Collection, record: Item) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    const id = record.id;
    const result = await authenticatedRequest(
      `/records/${collection}${id ? "/" + encodeURIComponent(id) : ""}`,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(record) },
      version,
    );
    assertSession(version);
    const saved = result.record;
    revision.current += 1;
    setData((prev) => ({
      ...prev,
      [collection]: id
        ? prev[collection].map((x) => (x.id === id ? saved : x))
        : [saved, ...prev[collection].filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };
  const remove = async (collection: Collection, id: string) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    await authenticatedRequest(
      `/records/${collection}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
      version,
    );
    assertSession(version);
    revision.current += 1;
    setData((previous) => {
      const next = {
        ...previous,
        [collection]: previous[collection].filter((record) => record.id !== id),
      };
      if (collection === "conversations" || collection === "sessions") {
        next.memories = next.memories.filter((memory) =>
          collection === "conversations"
            ? memory.sourceConversationId !== id &&
              !(memory.sourceType === "conversation" && memory.sourceId === id)
            : !(memory.sourceType === "session" && memory.sourceId === id),
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
    if (!token) throw new Error("Please sign in first.");
    const result = await authenticatedRequest(
      "/chat",
      {
        method: "POST",
        body: JSON.stringify({ text, conversationId }),
      },
      version,
    );
    assertSession(version);
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
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    await authenticatedRequest("/account", { method: "DELETE" }, version);
    assertSession(version);
    const deletedVersion = ++generation.current;
    await writeCredential(null, deletedVersion);
    assertSession(deletedVersion);
    owner.current = null;
    setToken(null);
    setUser(null);
    setData(emptyData());
    setChatDrafts({});
    setEditorDrafts({});
    setSessionExpired(false);
    setSessionError(null);
    setStack([{ name: "today", params: {} }]);
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
    setStack((old) =>
      tab ? [{ name: tab, params }] : [...old, { name, params }],
    );
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
        params: current.params,
        canGoBack: stack.length > 1,
        token,
        chatDrafts,
        setChatDraft,
        editorDrafts,
        setEditorDraft,
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
