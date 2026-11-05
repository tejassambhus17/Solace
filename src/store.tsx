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
  | "plans";
export type Data = Record<Collection, Item[]>;
const emptyData = (): Data => ({
  checkins: [],
  conversations: [],
  sessions: [],
  reflections: [],
  assessments: [],
  memories: [],
  reminders: [],
  plans: [],
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
  retrySession: () => Promise<void>;
  busy: boolean;
  error: string | null;
  route: string;
  params: Record<string, any>;
  canGoBack: boolean;
  token: string | null;
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
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    path === "/chat" ? 45000 : 15000,
  );
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
  } catch {
    throw new Error(
      controller.signal.aborted
        ? "Solace is taking too long to respond. Please try again."
        : "Unable to connect to Solace. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
  let body: any = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }
  if (!response.ok) {
    const error = new Error(
      body?.error || body?.message || "Something went wrong. Please try again.",
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const generation = useRef(0);
  const assertSession = (version: number) => {
    if (version !== generation.current)
      throw new Error(
        "Your session changed. Please try again in the current account.",
      );
  };
  const [user, setUser] = useState<Item | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyData());
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<
    { name: string; params: Record<string, any> }[]
  >([{ name: "today", params: {} }]);
  const load = async (t: string, version = generation.current) => {
    const result = await request("/state", t);
    assertSession(version);
    setData({ ...emptyData(), ...result.data });
    setUser(result.user);
  };
  const restore = async (t: string) => {
    const version = generation.current;
    try {
      await load(t, version);
      assertSession(version);
      setToken(t);
      setSessionError(null);
    } catch (e) {
      if (version !== generation.current) return;
      if ((e as Error & { status?: number }).status === 401) {
        await persist.remove();
        setToken(null);
        setSessionError(null);
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
    (async () => {
      try {
        const t = await persist.get();
        if (t && active) await restore(t);
      } catch (e) {
        if (active)
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
    setInitializing(true);
    try {
      const t = token || (await persist.get());
      if (t) await restore(t);
      else setSessionError(null);
    } finally {
      setInitializing(false);
    }
  };
  const authorize = async (path: string, values: Item) => {
    const version = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await request(path, null, {
        method: "POST",
        body: JSON.stringify(values),
      });
      assertSession(version);
      await persist.set(result.token);
      assertSession(version);
      setToken(result.token);
      await load(result.token, version);
      setStack([{ name: "today", params: {} }]);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Unable to sign in";
      setError(m);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const signIn = (email: string, password: string) =>
    authorize("/auth/login", { email, password });
  const signUp = (name: string, email: string, password: string) =>
    authorize("/auth/register", { name, email, password });
  const signOut = async () => {
    const version = ++generation.current;
    try {
      if (token) await request("/auth/logout", token, { method: "POST" });
    } catch {}
    if (version !== generation.current) return;
    await persist.remove();
    setToken(null);
    setUser(null);
    setSessionError(null);
    setData(emptyData());
    setStack([{ name: "today", params: {} }]);
  };
  const refresh = async () => {
    if (token) await load(token);
  };
  const save = async (collection: Collection, record: Item) => {
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    const id = record.id;
    const result = await request(
      `/records/${collection}${id ? "/" + encodeURIComponent(id) : ""}`,
      token,
      { method: id ? "PATCH" : "POST", body: JSON.stringify(record) },
    );
    assertSession(version);
    const saved = result.record;
    setData((prev) => ({
      ...prev,
      [collection]: id
        ? prev[collection].map((x) => (x.id === id ? saved : x))
        : [saved, ...prev[collection]],
    }));
    return saved;
  };
  const remove = async (collection: Collection, id: string) => {
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    await request(`/records/${collection}/${encodeURIComponent(id)}`, token, {
      method: "DELETE",
    });
    await load(token, version);
  };
  const chat = async (text: string, conversationId?: string) => {
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    const result = await request("/chat", token, {
      method: "POST",
      body: JSON.stringify({ text, conversationId }),
    });
    assertSession(version);
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
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    const result = await request("/auth/me", token, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    assertSession(version);
    setUser(result.user);
  };
  const deleteAccount = async () => {
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    await request("/account", token, { method: "DELETE" });
    assertSession(version);
    generation.current += 1;
    await persist.remove();
    setToken(null);
    setUser(null);
    setData(emptyData());
  };
  const exportData = async () => {
    const version = generation.current;
    if (!token) throw new Error("Please sign in first.");
    const result = await request("/export", token);
    assertSession(version);
    return result;
  };
  const navigate = (name: string, params: Record<string, any> = {}) =>
    setStack((old) => [...old, { name, params }]);
  const setParams = (params: Record<string, any>) =>
    setStack((old) =>
      old.map((entry, index) =>
        index === old.length - 1
          ? { ...entry, params: { ...entry.params, ...params } }
          : entry,
      ),
    );
  const back = () =>
    setStack((old) =>
      old.length > 1 ? old.slice(0, -1) : [{ name: "today", params: {} }],
    );
  const setTab = (name: string) => setStack([{ name, params: {} }]);
  const current = stack[stack.length - 1];
  return (
    <Context.Provider
      value={{
        user,
        data,
        initializing,
        sessionError,
        retrySession,
        busy,
        error,
        route: current.name,
        params: current.params,
        canGoBack: stack.length > 1,
        token,
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
