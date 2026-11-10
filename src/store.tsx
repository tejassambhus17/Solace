import React, {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, AppState as NativeAppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appActionCapabilityHeader,
  appActionCapabilityVersion,
  practiceHandoffHeader,
} from "../server/src/companion-app-action";
import {
  isWellnessGoal,
  wellnessGoalsActionHeader,
  type WellnessGoal,
} from "../server/src/wellness-goals";
import {
  habitHubParams,
  isHabitDrillDown,
  isRecordId,
  journalRoutes,
  routes,
  solaceRoots,
  type SolaceMode,
} from "./routes";
import { apiConnectionError, resolveApiConfiguration } from "./api-config";
import { cancelAllReminders } from "./notifications";
import { isJournalRecord } from "./journal-record";
import { isPracticeFollowUpId } from "./practice-follow-up";
import type { TabSelectionIntent } from "./navigation-motion";
import type {
  VoiceConnection,
  VoiceActionResult,
  VoiceSessionState,
} from "./realtime-voice-state";
import {
  DeviceLockError,
  deviceLockAvailability,
  deviceLockDelays,
  persistDeviceLock,
  provisionDeviceLock,
  readDeviceLock,
  verifyDeviceLock,
  type DeviceLockPolicy,
  type DeviceLockSettings,
} from "./device-lock";
import {
  createOfflineVault,
  isProtectedDraft,
  isRecoverableConnectionError,
  matchesPending,
  writingRecord,
  type PendingWrite,
  type WritingCollection,
} from "./offline";

import type { MomentResult } from "../server/src/moment-contract";
import type {
  GardenIntention,
  GardenIntentionChoice,
  GardenState,
} from "../server/src/garden-contract";
import type {
  PlanPreview,
  PlanPreviewInput,
} from "../server/src/wellness-plan-ai";
import type {
  Habit,
  HabitDraft,
  HabitGarden,
  HabitProgress,
  HabitStatus,
} from "../server/src/habit-contract";
import type {
  HabitAiInput,
  HabitAiResult,
} from "../server/src/habit-ai-contract";
import type {
  JournalAction,
  JournalReflectionResult,
  JournalSelection,
} from "../server/src/journal-contract";

export type { MomentResult } from "../server/src/moment-contract";
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
export type Data = Record<Collection, Item[]> & {
  habits: Habit[];
  habitProgress: HabitProgress[];
  habitGarden: HabitGarden[];
  gardenIntentions: GardenIntention[];
};
type HabitEdit = { draft?: HabitDraft; status?: HabitStatus };
type HabitSaveResult = { habit: Habit; reminderNotice?: string };
type HabitProgressWrite = {
  day: string;
  amount: number;
  expectedRevision: number;
  sessionId?: string;
};
export type EditorDraft = Record<string, string>;
type DraftPersistence = "writing" | "committed" | "failed";
type PendingWriteTarget = Pick<PendingWrite, "collection" | "id">;
type PendingWriteStatus = Omit<PendingWrite, "record"> & {
  syncState?: "syncing" | "failed";
  syncError?: string;
};
const mainTabs = [
  routes.today,
  routes.companion,
  routes.explore,
  routes.journey,
  routes.profile,
] as const;
export const immersiveRoutes = new Set([
  "breathing",
  "moment",
  "grounding",
  "moment-player",
  "voice-talk",
]);
type MainTab = (typeof mainTabs)[number];
type RouteEntry = {
  key: number;
  name: string;
  params: Record<string, any>;
  destinationParams: Record<string, unknown>;
  returnTab?: MainTab;
  returnMode?: SolaceMode;
};
type NavigationState = {
  activeTab: MainTab;
  stacks: Partial<Record<MainTab, RouteEntry[]>>;
  solaceMode?: SolaceMode;
  solaceViews?: Partial<Record<SolaceMode, RouteEntry[]>>;
};

const mainTabFor = (name: string) =>
  name === routes.solace
    ? routes.companion
    : mainTabs.find((tab) => tab === name);

const solaceModeKey = (account: string) => `solace.mode.${account}`;

const isSolaceModeRoot = (name: string) =>
  name === routes.companion || name === routes.journal;

function rememberSolaceView(navigation: NavigationState) {
  const stack = navigation.stacks.chat;
  if (!stack) return navigation.solaceViews;
  const root = stack[0].name;
  const mode =
    root === routes.companion
      ? "companion"
      : root === routes.journal
        ? "journal"
        : null;
  if (!mode) return navigation.solaceViews;
  const firstTemporary = stack.findIndex(
    (entry) =>
      immersiveRoutes.has(entry.name) ||
      entry.returnTab ||
      entry.returnMode ||
      (entry.name === routes.companion && entry.params.fromJournal),
  );
  return {
    ...navigation.solaceViews,
    [mode]: firstTemporary < 0 ? stack : stack.slice(0, firstTemporary),
  };
}

function stacksAfterLeavingImmersive({ activeTab, stacks }: NavigationState) {
  const active = stacks[activeTab]!;
  if (active.length < 2 || !immersiveRoutes.has(active.at(-1)!.name))
    return stacks;
  return { ...stacks, [activeTab]: active.slice(0, -1) };
}

let nextRouteKey = 0;
const routeEntry = (
  name: string,
  params: Record<string, any> = {},
): RouteEntry => ({
  key: ++nextRouteKey,
  name,
  params,
  destinationParams: params,
});

function matchesDestination(route: RouteEntry, entry: RouteEntry) {
  if (route.name !== entry.name) return false;
  const fields = Object.keys(entry.destinationParams);
  return (
    fields.length === Object.keys(route.destinationParams).length &&
    fields.every(
      (field) =>
        Object.hasOwn(route.destinationParams, field) &&
        Object.is(
          route.destinationParams[field],
          entry.destinationParams[field],
        ),
    )
  );
}

const initialNavigation = (): NavigationState => ({
  activeTab: "today",
  stacks: { today: [routeEntry("today")] },
});
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
  habits: [],
  habitProgress: [],
  habitGarden: [],
  gardenIntentions: [],
});
function mergeGardenState(
  previous: Data,
  result: Partial<GardenState> & { garden?: HabitGarden },
) {
  const incoming = result.habitGarden?.[0] ?? result.garden;
  const habitGarden =
    incoming &&
    incoming.earnedTotal > (previous.habitGarden[0]?.earnedTotal ?? 0)
      ? [incoming]
      : previous.habitGarden;
  if (!Array.isArray(result.gardenIntentions)) return { habitGarden };
  const intentions = new Map(
    previous.gardenIntentions.map((item) => [item.id, item]),
  );
  for (const item of result.gardenIntentions) {
    const current = intentions.get(item.id);
    if (
      !current ||
      item.contributors.length > current.contributors.length ||
      (item.contributors.length === current.contributors.length &&
        item.createdAt >= current.createdAt)
    )
      intentions.set(item.id, item);
  }
  return {
    habitGarden,
    gardenIntentions: [...intentions.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  };
}
const apiConfiguration = resolveApiConfiguration({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  androidUsbQa: process.env.EXPO_PUBLIC_SOLACE_USB_QA === "1",
  platform: Platform.OS,
  development: typeof __DEV__ !== "undefined" && __DEV__,
  webHostname:
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.hostname
      : undefined,
});
export const API_URL = apiConfiguration.baseUrl || "";
const TOKEN_KEY = "solace.session";
export const newChatRequestId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  // This is an idempotency identifier scoped to an account, never a credential.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (digit) => {
    const bits = Math.floor(Math.random() * 16);
    return (digit === "x" ? bits : (bits & 3) | 8).toString(16);
  });
};
const persist = {
  async get() {
    if (Platform.OS !== "web") return SecureStore.getItemAsync(TOKEN_KEY);
    if (typeof window === "undefined") return null;
    const current = window.sessionStorage.getItem(TOKEN_KEY);
    // AsyncStorage used this localStorage key on the web preview.
    const legacy = window.localStorage.getItem(TOKEN_KEY);
    if (!legacy) return current;
    if (!current) window.sessionStorage.setItem(TOKEN_KEY, legacy);
    window.localStorage.removeItem(TOKEN_KEY);
    return current ?? legacy;
  },
  set: (value: string) =>
    Platform.OS === "web"
      ? window.sessionStorage.setItem(TOKEN_KEY, value)
      : SecureStore.setItemAsync(TOKEN_KEY, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
  async remove() {
    if (Platform.OS !== "web") return SecureStore.deleteItemAsync(TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
    return window.sessionStorage.removeItem(TOKEN_KEY);
  },
};
type GoogleAuthFlow = { id: string; url: string };
type GoogleAuthProof = { id: string; verifier: string; handoff: string };

type AppUnlock =
  | { phase: "unlocked" | "locked" | "prompting" }
  | { phase: "fallback"; message: string; canRetry: boolean };

export type AppState = {
  user: Item | null;
  saveWellnessGoals: (
    goals: WellnessGoal[],
    completeOnboarding?: true,
  ) => Promise<WellnessGoal[]>;
  data: Data;
  initializing: boolean;
  sessionError: string | null;
  sessionExpired: boolean;
  deviceLock: DeviceLockSettings | null;
  deviceLockBusy: boolean;
  appUnlock: AppUnlock | { phase: "checking" };
  appLocked: boolean;
  journalLocked: boolean;
  journalRouteProtected: boolean;
  privacyCovered: boolean;
  updateDeviceLock: (settings: DeviceLockSettings) => Promise<void>;
  unlockDeviceLock: (scope: "app" | "journal") => Promise<void>;
  retrySession: () => Promise<void>;
  busy: boolean;
  error: string | null;
  route: string;
  routeKey: number;
  habitHub?: { key: number; params: Record<string, unknown> };
  activeTab: MainTab;
  params: Record<string, any>;
  canGoBack: boolean;
  token: string | null;
  chatDrafts: Record<string, string>;
  chatPending: Record<string, string>;
  setChatDraft: (key: string, text: string, expected?: string) => void;
  editorDrafts: Record<string, EditorDraft>;
  editorDraftPersistence: Partial<Record<string, DraftPersistence>>;
  setEditorDraft: (
    key: string,
    draft: EditorDraft | null,
    expected?: EditorDraft,
  ) => void;
  flushEditorDrafts: () => Promise<boolean>;
  pendingWrites: PendingWriteStatus[];
  syncingWrites: boolean;
  offlineError: string | null;
  draftProtection: "device" | "memory";
  flushPendingWrites: (target?: PendingWriteTarget) => Promise<void>;
  discardPendingWrite: (id: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  googleConfiguration: (signal?: AbortSignal) => Promise<{ enabled: boolean }>;
  googleLoginStart: (
    challenge: string,
    signal?: AbortSignal,
  ) => Promise<GoogleAuthFlow>;
  googleLogin: (proof: GoogleAuthProof, signal?: AbortSignal) => Promise<void>;
  googleLinkStatus: (signal?: AbortSignal) => Promise<{ linked: boolean }>;
  googleLinkStart: (
    challenge: string,
    signal?: AbortSignal,
  ) => Promise<GoogleAuthFlow>;
  googleLinkComplete: (
    proof: GoogleAuthProof,
    signal?: AbortSignal,
  ) => Promise<{ linked: true }>;
  requestPasswordReset: (email: string, signal?: AbortSignal) => Promise<void>;
  resetPassword: (
    email: string,
    code: string,
    password: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  saveGardenIntention: (
    choice: GardenIntentionChoice,
    timeZone: string,
  ) => Promise<void>;
  save: (
    collection: Collection,
    record: Item,
    journalDraft?: { key: string; value: EditorDraft },
  ) => Promise<Item>;
  remove: (collection: Collection, id: string) => Promise<void>;
  createHabit: (draft: HabitDraft, id: string) => Promise<HabitSaveResult>;
  editHabit: (
    id: string,
    expectedRevision: number,
    change: HabitEdit,
  ) => Promise<HabitSaveResult>;
  deleteHabit: (id: string) => Promise<{ reminderNotice?: string }>;
  setHabitProgress: (
    id: string,
    write: HabitProgressWrite,
  ) => Promise<HabitProgress>;
  retryHabitReminder: (habit: Habit) => Promise<string | undefined>;
  suggestHabit: (
    input: HabitAiInput,
    signal?: AbortSignal,
  ) => Promise<HabitAiResult>;
  navigate: (name: string, params?: Record<string, any>) => void;
  setParams: (params: Record<string, any>) => void;
  back: () => void;
  setTab: (name: string, intent?: TabSelectionIntent) => void;
  switchSolaceMode: (mode: SolaceMode) => void;
  chat: (text: string, conversationId?: string) => Promise<any>;
  reflectJournal: (
    id: string,
    selection: JournalSelection,
    action: JournalAction,
    signal?: AbortSignal,
  ) => Promise<JournalReflectionResult>;
  discussJournal: (
    id: string,
    selection: JournalSelection,
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<{ conversation: Item }>;
  generateMoment: (
    feeling: string,
    environment?: "forest" | "ocean" | "twilight",
  ) => Promise<MomentResult>;
  generatePlanPreview: (
    input: PlanPreviewInput,
    signal?: AbortSignal,
  ) => Promise<PlanPreview>;
  weeklyReflection: (
    endDate?: string,
    options?: WeeklyReflectionOptions,
  ) => Promise<WeeklyReflectionResult>;
  capabilities: () => Promise<{
    voiceTranscription: boolean;
    voiceSpeech: boolean;
    aiProvider: "live" | "offline";
  }>;
  transcribeVoice: (
    audio: ArrayBuffer,
    contentType: string,
    signal?: AbortSignal,
  ) => Promise<{ text: string; provider: "live" }>;
  speakVoiceReply: (
    conversationId: string,
    messageId: string,
    signal?: AbortSignal,
  ) => Promise<ArrayBuffer>;
  startVoiceSession: (
    offer: string,
    conversationId: string | undefined,
    signal: AbortSignal,
  ) => Promise<VoiceConnection>;
  voiceSessionStatus: (
    id: string,
    revision: number | undefined,
    signal: AbortSignal,
    ready?: true,
  ) => Promise<VoiceSessionState>;
  endVoiceSession: (id: string) => Promise<VoiceSessionState>;
  reportVoiceActionResult: (
    id: string,
    actionId: string,
    result: VoiceActionResult,
    signal: AbortSignal,
  ) => Promise<void>;
  updateUser: (changes: Item) => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportData: () => Promise<any>;
};
const Context = createContext<AppState | null>(null);
export const AppRouteScope = Context.Provider;
type ApiRequestOptions = RequestInit & { responseType?: "mp3" };
const SPEECH_MAX_BYTES = 2 * 1024 * 1024;
function confirmedRecord(
  result: { record?: Item } | null,
  expectedId?: string,
) {
  const record = result?.record;
  if (!isRecordId(record?.id) || (expectedId && record.id !== expectedId))
    throw new Error("Solace couldn’t confirm the save. Please try again.");
  return record;
}

async function request(
  path: string,
  token: string | null,
  { responseType, ...options }: ApiRequestOptions = {},
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
      "/habits/suggest",
      "/plans/preview",
      "/voice/transcribe",
      "/voice/speech",
    ].includes(path) || /^\/journal\/[^/]+\/(?:reflect|discuss)$/.test(path)
      ? 45000
      : path === "/voice/realtime"
        ? 22000
        : 15000,
  );
  try {
    let response: Response;
    let text = "";
    let audio: ArrayBuffer | undefined;
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
      if (response.ok && responseType === "mp3") {
        if (
          response.headers.get("content-type")?.split(";")[0] ===
            "audio/mpeg" &&
          Number(response.headers.get("content-length")) <= SPEECH_MAX_BYTES
        )
          audio = await response.arrayBuffer();
      } else text = await response.text();
    } catch {
      if (externalSignals.some((signal) => signal?.aborted))
        throw new Error("The request was cancelled.");
      const error = new Error(
        apiConnectionError(apiConfiguration, controller.signal.aborted),
      ) as Error & { connection: boolean };
      error.connection = true;
      throw error;
    }
    if (response.ok && responseType === "mp3") {
      if (!audio?.byteLength || audio.byteLength > SPEECH_MAX_BYTES)
        throw new Error(
          "Spoken playback couldn’t start. Try again or read the reply.",
        );
      if (controller.signal.aborted)
        throw new Error("The request was cancelled.");
      return audio;
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
      ) as Error & { status?: number; code?: string };
      error.status = response.status;
      if (typeof body?.code === "string") error.code = body.code;
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
  const [localLock, setLocalLock] = useState({
    policy: null as DeviceLockPolicy | null,
    appUnlock: { phase: "unlocked" } as AppUnlock,
    journalGranted: false,
    covered: false,
  });
  const appLocked = localLock.appUnlock.phase !== "unlocked";
  const lockState = useRef(localLock);
  const lockWrites = useRef<Promise<void>>(Promise.resolve());
  const [deviceLockBusy, setDeviceLockBusy] = useState(false);
  const prompting = useRef(false);
  const backgroundSince = useRef<number | null>(null);
  const backgroundGeneration = useRef(0);
  const lastNativeState = useRef(NativeAppState?.currentState ?? "active");
  const journalVisit = useRef(0);
  const changeDeviceLock = (change: Partial<typeof localLock>) => {
    const next = { ...lockState.current, ...change };
    lockState.current = next;
    setLocalLock(next);
  };
  const inFlightChats = useRef(new Set<string>());
  const inFlightHabits = useRef(new Set<string>());
  const [chatPending, setChatPending] = useState<Record<string, string>>({});
  const sessionRequests = useRef<AbortController | null>(null);
  sessionRequests.current ??= new AbortController();
  const advanceSession = () => {
    const version = ++generation.current;
    if (inFlightChats.current.size) {
      inFlightChats.current.clear();
      setChatPending({});
    }
    const previous = sessionRequests.current;
    sessionRequests.current = new AbortController();
    previous?.abort();
    return version;
  };
  const accountTransition = useRef<number | null>(null);
  const owner = useRef<string | null>(null);
  const revision = useRef(0);
  const loads = useRef({ requested: 0, applied: 0 });
  const credentialWrites = useRef<Promise<void>>(Promise.resolve());
  const [vault] = useState(() =>
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
  );
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
    version === generation.current &&
    accountTransition.current !== version &&
    lockState.current.appUnlock.phase === "unlocked";
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
  const requireUnlockedJournal = () => {
    if (lockState.current.policy?.journal && !lockState.current.journalGranted)
      throw new Error(
        "Unlock My Journal before opening or changing private writing.",
      );
  };
  const saveDevicePolicy = (
    policy: DeviceLockPolicy | null,
    version: number,
    publish = true,
  ) => {
    const job = lockWrites.current
      .catch(() => {})
      .then(async () => {
        assertSession(version);
        await persistDeviceLock(policy);
        assertSession(version);
        if (publish)
          changeDeviceLock({
            policy,
            journalGranted: false,
            appUnlock: { phase: "unlocked" },
            covered: policy ? lockState.current.covered : false,
          });
      });
    lockWrites.current = job;
    return job;
  };
  const localBiometricPrompt = async <T,>(
    work: (assertForeground: () => void) => Promise<T>,
  ) => {
    if (prompting.current)
      throw new Error("A biometric prompt is already open.");
    prompting.current = true;
    setDeviceLockBusy(true);
    const background = backgroundGeneration.current;
    const assertForeground = () => {
      if (background !== backgroundGeneration.current)
        throw new Error(
          "Solace went into the background. Try again when you’re ready.",
        );
    };
    try {
      const result = await work(assertForeground);
      assertForeground();
      return result;
    } finally {
      prompting.current = false;
      setDeviceLockBusy(false);
    }
  };
  const [user, setUser] = useState<Item | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const chatAttempts = useRef(new Map<string, { id: string; text: string }>());
  const [editorDrafts, setEditorDrafts] = useState<Record<string, EditorDraft>>(
    {},
  );
  const [editorDraftPersistence, setEditorDraftPersistence] = useState<
    Partial<Record<string, DraftPersistence>>
  >({});
  const [pendingWrites, setPendingWrites] = useState<PendingWriteStatus[]>([]);
  const [syncingWrites, setSyncingWrites] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const isSameWrite = (entry: PendingWriteTarget, target: PendingWriteTarget) =>
    entry.id === target.id && entry.collection === target.collection;
  const publishPending = (entries: PendingWrite[]) => {
    pending.current = entries;
    setPendingWrites((previous) =>
      entries.map(
        ({ record: _record, ...entry }) =>
          previous.find((old) => isSameWrite(old, entry)) ?? entry,
      ),
    );
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
      markDraftPersistence(snapshot.drafts, "committed", version);
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
    if (expected === undefined && inFlightChats.current.has(key)) return;
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
  const sameDraft = (current: EditorDraft | undefined, expected: EditorDraft) =>
    !!current &&
    Object.keys(current).length === Object.keys(expected).length &&
    Object.keys(expected).every((field) => current[field] === expected[field]);
  const markDraftPersistence = (
    drafts: Record<string, EditorDraft>,
    status: DraftPersistence,
    version: number,
  ) => {
    setEditorDraftPersistence((previous) => {
      if (version !== generation.current) return previous;
      let next = previous;
      for (const [key, draft] of Object.entries(drafts)) {
        if (
          previous[key] !== status &&
          sameDraft(editors.current[key], draft) &&
          (status !== "failed" || previous[key] !== "committed")
        ) {
          if (next === previous) next = { ...previous };
          next[key] = status;
        }
      }
      return next;
    });
  };
  const flushEditorDrafts = async (checkpoint?: () => boolean) => {
    const account = owner.current;
    const canWrite = checkpoint ?? (() => canUseAccount(draftGeneration));
    if (!account || !canWrite()) return false;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    const protectedDrafts = () =>
      Object.fromEntries(
        Object.entries(editors.current).filter(([key]) =>
          isProtectedDraft(key),
        ),
      );
    let attempted = protectedDrafts();
    try {
      const committed = await vault.update(account, (snapshot) => {
        if (!canWrite()) return snapshot;
        attempted = protectedDrafts();
        return { ...snapshot, drafts: attempted };
      });
      if (!canWrite()) return false;
      markDraftPersistence(committed.drafts, "committed", generation.current);
      setOfflineError(null);
      return true;
    } catch (error) {
      if (canWrite()) {
        markDraftPersistence(attempted, "failed", generation.current);
        setOfflineError(
          error instanceof Error
            ? error.message
            : "Your draft is open here but could not be protected on this device.",
        );
      }
      return false;
    }
  };
  const setEditorDraft = (
    key: string,
    draft: EditorDraft | null,
    expected?: EditorDraft,
  ) => {
    if (!canUseAccount(draftGeneration)) return;
    const previous = editors.current;
    const current = previous[key];
    if (expected !== undefined && !sameDraft(current, expected)) return;
    const next = { ...previous };
    if (draft) next[key] = { ...draft };
    else delete next[key];
    editors.current = next;
    setEditorDrafts(next);
    if (!owner.current || !isProtectedDraft(key)) return;
    setEditorDraftPersistence((previous) => {
      const next = { ...previous };
      if (draft) next[key] = "writing";
      else delete next[key];
      return next;
    });
    if (draftTimer.current) clearTimeout(draftTimer.current);
    // Short debounce limits keychain work while typing. Clear/save operations
    // commit immediately so a removed draft does not reappear after restart.
    if (draft === null) void flushEditorDrafts();
    else
      draftTimer.current = setTimeout(() => {
        void flushEditorDrafts();
      }, 650);
  };
  const [initializing, setInitializing] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigation, setNavigation] = useState(initialNavigation);
  const expireSession = (error: unknown, version: number) => {
    if (
      (error as Error & { status?: number }).status !== 401 ||
      version !== generation.current
    )
      return;
    const expiredVersion = advanceSession();
    changeDeviceLock({
      journalGranted: false,
      appUnlock: { phase: "unlocked" },
    });
    setToken(null);
    setSessionError(null);
    setSessionExpired(true);
    setBusy(false);
    setSyncingWrites(false);
    setPendingWrites((entries) =>
      entries.map((entry) =>
        entry.syncState === "syncing"
          ? { ...entry, syncState: undefined }
          : entry,
      ),
    );
    // Drafts and the intended route stay in memory for this account only.
    // Authenticated content is hidden by Shell until reauthentication.
    void writeCredential(null, expiredVersion).catch(() => {});
  };
  const authenticatedRequest = async (
    path: string,
    options: ApiRequestOptions,
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
  const load = async (
    t: string,
    version = generation.current,
    verifiedOwner?: string,
  ) => {
    assertSession(version);
    const startedAt = revision.current;
    const loadId = ++loads.current.requested;
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
      Object.keys(emptyData()).some((key) => {
        if (!(key in result.data)) return false;
        const records = result.data[key];
        return (
          !Array.isArray(records) ||
          records.some(
            (record) =>
              !record || typeof record !== "object" || Array.isArray(record),
          )
        );
      })
    )
      throw new Error(
        "Solace could not read your saved space. Please try again.",
      );
    if (verifiedOwner && result.user.id !== verifiedOwner)
      throw Object.assign(
        new Error("This saved sign-in has changed. Sign in again to continue."),
        { status: 401 },
      );
    if (loadId < loads.current.applied) return;
    if (
      lockState.current.policy &&
      lockState.current.policy.owner !== result.user.id
    )
      await saveDevicePolicy(null, version);
    owner.current = String(result.user.id);
    if (writingOwner.current !== owner.current)
      await restoreWriting(owner.current, version);
    assertSession(version);
    // A snapshot requested before a local save must not erase that newer save.
    if (startedAt === revision.current && loadId > loads.current.applied) {
      loads.current.applied = loadId;
      setData(mergePending({ ...emptyData(), ...result.data }));
      setUser(result.user);
    }
  };
  const restore = async (
    t: string,
    version = generation.current,
    verifiedOwner?: string,
  ) => {
    assertSession(version);
    try {
      await load(t, version, verifiedOwner);
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
        if (!active || version !== generation.current) return;
        let policy: DeviceLockPolicy | null;
        try {
          policy = await readDeviceLock();
        } catch {
          if (active && version === generation.current && t)
            changeDeviceLock({
              appUnlock: {
                phase: "fallback",
                message:
                  "This device lock could not be read. Sign in again to continue.",
                canRetry: false,
              },
            });
          return;
        }
        if (!active || version !== generation.current) return;
        const locked = !!t && !!policy && policy.appDelay !== null;
        changeDeviceLock({
          policy,
          appUnlock: { phase: locked ? "locked" : "unlocked" },
          covered: locked && lastNativeState.current !== "active",
        });
        if (t && !locked) await restore(t, version);
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
  const updateDeviceLock = async (settings: DeviceLockSettings) => {
    const version = draftGeneration;
    assertActiveSession(version);
    const account = owner.current;
    if (Platform.OS === "web" || !token || !account)
      throw new Error("Open Solace on a signed-in phone to set up biometrics.");
    if (
      settings.appDelay !== null &&
      !deviceLockDelays.includes(settings.appDelay)
    )
      throw new Error("Choose a supported lock delay.");
    const current = lockState.current.policy;
    const next =
      settings.appDelay !== null || settings.journal
        ? { ...settings, owner: account }
        : null;
    if (!current && !next) return;
    await localBiometricPrompt(async () => {
      if (current?.owner === account)
        await verifyDeviceLock(account, "Confirm changes to Biometric Lock");
      else await provisionDeviceLock(account);
    });
    assertActiveSession(version);
    await saveDevicePolicy(next, version);
  };
  const attemptAppUnlock = async (automatic: boolean) => {
    const { appUnlock, covered, policy } = lockState.current;
    if (prompting.current) {
      if (automatic) return;
      throw new Error("A biometric prompt is already open.");
    }
    if (automatic) {
      if (appUnlock.phase !== "locked") return;
    } else if (appUnlock.phase !== "fallback" || !appUnlock.canRetry) return;
    if (covered || lastNativeState.current !== "active") return;

    const version = draftGeneration;
    assertSession(version);
    const background = backgroundGeneration.current;
    // Claim the lock event before native calls so renders and AppState events
    // cannot start a second prompt while this attempt is in progress.
    changeDeviceLock({ appUnlock: { phase: "prompting" } });
    try {
      const saved = await localBiometricPrompt(async (assertForeground) => {
        if (!policy || (owner.current && owner.current !== policy.owner))
          throw new DeviceLockError("Sign in again to recover access.", false);
        if ((await deviceLockAvailability()) !== "ready")
          throw new DeviceLockError(
            "Biometrics are unavailable. Sign in again to continue.",
            false,
          );
        assertSession(version);
        assertForeground();
        if (lastNativeState.current !== "active")
          throw new DeviceLockError("Try again when Solace is active.", true);
        await verifyDeviceLock(policy.owner, "Unlock Solace");
        assertSession(version);
        assertForeground();

        const credential = token || (await persist.get());
        assertSession(version);
        assertForeground();
        if (!credential)
          throw Object.assign(new Error("Sign in again to continue."), {
            status: 401,
          });
        if (token) {
          // A local biometric match cannot restore a revoked server session.
          const result = await request(
            "/auth/me",
            credential,
            {},
            sessionRequests.current?.signal,
          );
          if (typeof result?.user?.id !== "string" || !result.user.id)
            throw new Error("Could not verify this session.");
          if (result.user.id !== policy.owner)
            throw Object.assign(new Error("This saved sign-in has changed."), {
              status: 401,
            });
        } else await load(credential, version, policy.owner);
        return credential;
      });
      assertSession(version);
      if (background !== backgroundGeneration.current)
        throw new DeviceLockError(
          "Solace went into the background. Try again when you’re ready.",
          true,
        );
      setToken(saved);
      setSessionError(null);
      setSessionExpired(false);
      changeDeviceLock({ appUnlock: { phase: "unlocked" } });
    } catch (error) {
      if (version !== generation.current) return;
      if ((error as Error & { status?: number }).status === 401) {
        expireSession(error, version);
        return;
      }
      const failure =
        error instanceof DeviceLockError
          ? error
          : new DeviceLockError(
              "Could not finish unlocking. Try again or sign in again.",
              true,
            );
      changeDeviceLock({
        appUnlock: {
          phase: "fallback",
          message: failure.message,
          canRetry: failure.canRetry,
        },
      });
      throw failure;
    }
  };
  const startAutomaticUnlock = useEffectEvent(() => {
    void attemptAppUnlock(true).catch(() => {});
  });
  useEffect(() => {
    if (
      !initializing &&
      localLock.appUnlock.phase === "locked" &&
      !localLock.covered &&
      !deviceLockBusy
    )
      startAutomaticUnlock();
  }, [
    initializing,
    localLock.appUnlock.phase,
    localLock.covered,
    deviceLockBusy,
  ]);
  const unlockDeviceLock = async (scope: "app" | "journal") => {
    if (scope === "app") return attemptAppUnlock(false);
    const version = draftGeneration;
    assertSession(version);
    const { policy, appUnlock } = lockState.current;
    if (!policy || (owner.current && owner.current !== policy.owner))
      throw new Error(
        "This device lock could not be read. Sign in again to recover access.",
      );
    const visit = journalVisit.current;
    if (
      appUnlock.phase !== "unlocked" ||
      !policy.journal ||
      !token ||
      !insideJournal
    )
      return;
    await localBiometricPrompt(async (assertForeground) => {
      await verifyDeviceLock(policy.owner, "Unlock My Journal");
      assertForeground();
      assertSession(version);
      if (journalVisit.current === visit)
        changeDeviceLock({ journalGranted: true });
    });
  };
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
  const authorize = async (
    path: string,
    values: Item,
    signal?: AbortSignal,
  ) => {
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
        { method: "POST", body: JSON.stringify(values), signal },
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
      if (
        lockState.current.policy?.owner !== result.user.id &&
        lockState.current.policy
      )
        await saveDevicePolicy(null, version);
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
        setEditorDraftPersistence({});
        setData(emptyData());
        setNavigation(initialNavigation());
      }
      owner.current = String(result.user.id);
      changeDeviceLock({
        journalGranted: false,
        appUnlock: { phase: "unlocked" },
      });
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
  const googleConfiguration = (signal?: AbortSignal) =>
    request("/auth/google/config", null, { signal });
  const googleLoginStart = (challenge: string, signal?: AbortSignal) =>
    request("/auth/google/start", null, {
      method: "POST",
      body: JSON.stringify({ challenge }),
      signal,
    });
  const googleLogin = (proof: GoogleAuthProof, signal?: AbortSignal) =>
    authorize("/auth/google/complete", proof, signal);
  const googleLinkStatus = (signal?: AbortSignal) =>
    authenticatedRequest("/auth/google/link", { signal }, draftGeneration);
  const googleLinkStart = (challenge: string, signal?: AbortSignal) =>
    authenticatedRequest(
      "/auth/google/link/start",
      {
        method: "POST",
        body: JSON.stringify({ challenge }),
        signal,
      },
      draftGeneration,
    );
  const googleLinkComplete = (proof: GoogleAuthProof, signal?: AbortSignal) =>
    authenticatedRequest(
      "/auth/google/link/complete",
      {
        method: "POST",
        body: JSON.stringify(proof),
        signal,
      },
      draftGeneration,
    );
  const requestPasswordReset = async (email: string, signal?: AbortSignal) => {
    await request("/auth/password/request", null, {
      method: "POST",
      body: JSON.stringify({ email }),
      signal,
    });
  };
  const resetPassword = async (
    email: string,
    code: string,
    password: string,
    signal?: AbortSignal,
  ) => {
    await request("/auth/password/reset", null, {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
      signal,
    });
  };
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
        await clearWriting(
          owner.current ?? lockState.current.policy?.owner ?? null,
        );
      } catch (error) {
        if (version === generation.current)
          setOfflineError(
            "Protected writing could not be removed from this device. Please try signing out again.",
          );
        throw error;
      }
      assertSession(version);
      try {
        const saved =
          token ||
          (lockState.current.appUnlock.phase !== "unlocked"
            ? await persist.get()
            : null);
        if (saved) await request("/auth/logout", saved, { method: "POST" });
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
      if (
        lockState.current.policy ||
        lockState.current.appUnlock.phase !== "unlocked"
      )
        // Keep the gate in place until this account's in-memory state is gone.
        await saveDevicePolicy(null, version, false).catch(() => {});
      assertSession(version);
      // Keep the current account's schedules intact if local sign-out fails.
      await cancelAllReminders().catch(() => {});
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
      setEditorDraftPersistence({});
      setNavigation(initialNavigation());
      changeDeviceLock({
        policy: null,
        appUnlock: { phase: "unlocked" },
        journalGranted: false,
        covered: false,
      });
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
      const saved = confirmedRecord(result, entry.id);
      if (result.gardenIntentions) {
        revision.current += 1;
        setData((previous) => ({
          ...previous,
          ...mergeGardenState(previous, result),
        }));
      }
      return saved;
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
  const flushPendingWrites = async (target?: PendingWriteTarget) => {
    const version = draftGeneration;
    assertActiveSession(version);
    if (!token || !owner.current)
      throw new Error("Please sign in again to sync your writing.");
    if (flushLock.current) return flushLock.current;
    const account = owner.current;
    const job = (async () => {
      setSyncingWrites(true);
      setOfflineError(null);
      let active: PendingWriteTarget | undefined;
      try {
        for (const entry of [...pending.current]) {
          assertSession(version);
          if (
            discarding.current.has(entry.id) ||
            (target && !isSameWrite(entry, target))
          )
            continue;
          active = entry;
          setPendingWrites((entries) =>
            entries.map((item) =>
              isSameWrite(item, entry)
                ? { ...item, syncState: "syncing", syncError: undefined }
                : item,
            ),
          );
          const saved = await postWriting(entry, version);
          assertSession(version);
          const snapshot = await vault.update(account, (current) => ({
            ...current,
            pending: current.pending.filter(
              (item) => !isSameWrite(item, entry),
            ),
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
          active = undefined;
        }
      } catch (error) {
        if (version === generation.current) {
          const failed = active;
          const message =
            error instanceof Error
              ? error.message
              : "Couldn’t sync this entry. Try again.";
          if (failed)
            setPendingWrites((entries) =>
              entries.map((entry) =>
                isSameWrite(entry, failed)
                  ? { ...entry, syncState: "failed", syncError: message }
                  : entry,
              ),
            );
          setOfflineError(message);
        }
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
  const save = async (
    collection: Collection,
    record: Item,
    journalDraft?: { key: string; value: EditorDraft },
  ) => {
    const version = draftGeneration;
    if (!token) throw new Error("Please sign in first.");
    const id = record.id;
    if (
      collection === "reflections" &&
      (record.kind === "journal" ||
        (id &&
          data.reflections.some(
            (item) => item.id === id && isJournalRecord(item),
          )))
    )
      requireUnlockedJournal();
    const queued = pending.current.find(
      (entry) => entry.collection === collection && entry.id === id,
    );
    if (queued)
      throw new Error("Sync this device-saved entry before editing it.");
    const newJournalEntry =
      collection === "reflections" &&
      record.kind === "journal" &&
      !data.reflections.some((item) => item.id === id);
    if (
      newJournalEntry ||
      (collection === "checkins" &&
        isPracticeFollowUpId(id) &&
        !data.checkins.some((item) => item.id === id)) ||
      (!id && (collection === "checkins" || collection === "reflections"))
    ) {
      const account = owner.current;
      assertActiveSession(version);
      if (!account)
        throw new Error("Please sign in again to save your writing.");
      const fields = writingRecord(collection, {
        ...record,
        id: id ?? "identity",
      });
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
              id:
                id ??
                `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`,
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
        const snapshot = await vault.update(account, (current) => {
          const drafts = { ...current.drafts };
          if (
            journalDraft &&
            sameDraft(drafts[journalDraft.key], journalDraft.value)
          )
            delete drafts[journalDraft.key];
          return {
            drafts,
            pending: [
              ...current.pending.filter((item) => item.id !== entry.id),
              entry,
            ],
          };
        });
        assertSession(version);
        if (journalDraft)
          setEditorDraft(journalDraft.key, null, journalDraft.value);
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
      [
        "sessions",
        "preferences",
        "goals",
        "memories",
        "reminders",
        "plans",
      ].includes(collection) &&
      !data[collection].some((item) => item.id === id);
    const updating = !!id && !createWithId;
    const submit = (payload: Item) =>
      authenticatedRequest(
        `/records/${collection}${updating ? "/" + encodeURIComponent(id!) : ""}`,
        { method: updating ? "PATCH" : "POST", body: JSON.stringify(payload) },
        version,
      );
    let result;
    try {
      result = await submit(record);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        collection !== "sessions" ||
        updating ||
        !id ||
        (code !== "SESSION_SOURCE_NOT_FOUND" &&
          code !== "PRACTICE_ORIGIN_NOT_FOUND")
      )
        throw error;
      // An optional link can be deleted while the player is running. Keep the
      // original completion identity and retry without unavailable provenance.
      const {
        sourceConversationId,
        originCheckinId,
        originActionId,
        ...practice
      } = record;
      result = await submit(practice);
    }
    assertSession(version);
    const saved = confirmedRecord(result, updating ? id : undefined);
    revision.current += 1;
    setData((prev) => ({
      ...prev,
      ...mergeGardenState(prev, result),
      [collection]: updating
        ? prev[collection].map((x) => (x.id === id ? saved : x))
        : [saved, ...prev[collection].filter((item) => item.id !== saved.id)],
    }));
    return saved;
  };
  const remove = async (collection: Collection, id: string) => {
    if (
      collection === "reflections" &&
      data.reflections.some((item) => item.id === id && isJournalRecord(item))
    )
      requireUnlockedJournal();
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
      if (collection === "reflections") {
        next.conversations = next.conversations.map((conversation) => {
          if (conversation.journalSource?.id !== id) return conversation;
          const { journalSource: _source, ...unlinked } = conversation;
          return unlinked;
        });
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
    if (inFlightChats.current.has(key))
      throw new Error("Solace is still replying. Wait a moment and try again.");
    const previous = chatAttempts.current.get(key);
    const attempt =
      previous?.text === text ? previous : { text, id: newChatRequestId() };
    chatAttempts.current.set(key, attempt);
    inFlightChats.current.add(key);
    setChatPending((pending) => ({ ...pending, [key]: text }));
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
          headers: {
            [appActionCapabilityHeader]: appActionCapabilityVersion,
            [wellnessGoalsActionHeader]: "1",
            [practiceHandoffHeader]: "1",
          },
          body: JSON.stringify({
            text,
            conversationId,
            requestId: attempt.id,
          }),
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
    } finally {
      if (version === generation.current) {
        inFlightChats.current.delete(key);
        setChatPending((pending) => {
          const next = { ...pending };
          delete next[key];
          return next;
        });
      }
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
  const featureRequest = async (
    path: string,
    options: ApiRequestOptions = {},
  ) => {
    const version = draftGeneration;
    const result = await authenticatedRequest(path, options, version);
    assertSession(version);
    return result;
  };
  const habitWrite = async <T,>(
    id: string,
    write: (version: number) => Promise<T>,
  ) => {
    const version = draftGeneration;
    assertActiveSession(version);
    const key = `${version}:${id}`;
    if (inFlightHabits.current.has(key))
      throw new Error("This habit is already being saved.");
    inFlightHabits.current.add(key);
    try {
      return await write(version);
    } catch (error) {
      if (
        (error as { status?: number }).status === 409 &&
        version === generation.current
      )
        await refresh().catch(() => {});
      throw error;
    } finally {
      inFlightHabits.current.delete(key);
    }
  };
  const applyHabit = (habit: Habit) => {
    revision.current += 1;
    setData((previous) => ({
      ...previous,
      habits: [
        habit,
        ...previous.habits.filter((item) => item.id !== habit.id),
      ],
    }));
  };
  const applyHabitReminder = async (
    version: number,
    id: string,
    habit: Habit | null,
    ask: boolean,
  ) => {
    const { reconcileHabitReminder } = await import("./habit-reminders");
    assertActiveSession(version);
    const account = owner.current;
    if (!account) return;
    const notice = await reconcileHabitReminder(account, id, habit, ask);
    assertSession(version);
    return notice;
  };
  const createHabit: AppState["createHabit"] = (draft, id) =>
    habitWrite(id, async (version) => {
      const result = await featureRequest("/habits", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          id,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      if (result?.habit?.id !== id)
        throw new Error("Solace couldn’t confirm this habit. Please retry.");
      const habit: Habit = result.habit;
      applyHabit(habit);
      const reminderNotice = habit.reminderTime
        ? await applyHabitReminder(version, id, habit, true)
        : undefined;
      return { habit, reminderNotice };
    });
  const editHabit: AppState["editHabit"] = (id, expectedRevision, change) =>
    habitWrite(id, async (version) => {
      const before = data.habits.find((item) => item.id === id);
      const result = await featureRequest(`/habits/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...change, expectedRevision }),
      });
      if (result?.habit?.id !== id)
        throw new Error(
          "Solace couldn’t confirm the habit update. Please retry.",
        );
      const habit: Habit = result.habit;
      applyHabit(habit);
      const timeChanged = before?.reminderTime !== habit.reminderTime;
      const scheduleChanged =
        JSON.stringify(before?.schedule) !== JSON.stringify(habit.schedule);
      const reminderNotice =
        (before?.reminderTime || habit.reminderTime) &&
        (timeChanged || scheduleChanged || before?.status !== habit.status)
          ? await applyHabitReminder(
              version,
              id,
              habit,
              !!change.draft && !!habit.reminderTime && !before?.reminderTime,
            )
          : undefined;
      return { habit, reminderNotice };
    });
  const deleteHabit: AppState["deleteHabit"] = (id) =>
    habitWrite(id, async (version) => {
      await featureRequest(`/habits/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      revision.current += 1;
      setData((previous) => ({
        ...previous,
        habits: previous.habits.filter((item) => item.id !== id),
        habitProgress: previous.habitProgress.filter(
          (item) => item.habitId !== id,
        ),
      }));
      const reminderNotice = await applyHabitReminder(version, id, null, false);
      return { reminderNotice };
    });
  const setHabitProgress: AppState["setHabitProgress"] = (id, write) =>
    habitWrite(id, async () => {
      const result = await featureRequest(
        `/habits/${encodeURIComponent(id)}/progress`,
        {
          method: "PUT",
          body: JSON.stringify(write),
        },
      );
      if (
        !result?.progress?.id ||
        result.progress.habitId !== id ||
        result.progress.day !== write.day
      )
        throw new Error("Solace couldn’t confirm your progress. Please retry.");
      const progress: HabitProgress = result.progress;
      revision.current += 1;
      setData((previous) => ({
        ...previous,
        ...mergeGardenState(previous, result),
        habitProgress: [
          progress,
          ...previous.habitProgress.filter((item) => item.id !== progress.id),
        ],
      }));
      return progress;
    });
  const saveGardenIntention: AppState["saveGardenIntention"] = async (
    choice,
    timeZone,
  ) => {
    const result = await featureRequest("/habits/garden-intention", {
      method: "PUT",
      body: JSON.stringify({ ...choice, timeZone }),
    });
    if (
      !Array.isArray(result?.gardenIntentions) ||
      !result.gardenIntentions.length
    )
      throw new Error(
        "Solace couldn’t confirm your Garden intention. Please try again.",
      );
    revision.current += 1;
    setData((previous) => ({
      ...previous,
      ...mergeGardenState(previous, result),
    }));
  };
  const retryHabitReminder: AppState["retryHabitReminder"] = (habit) =>
    habitWrite(habit.id, async (version) => {
      const current = data.habits.find((item) => item.id === habit.id);
      if (!current) throw new Error("This habit is no longer available.");
      return applyHabitReminder(version, current.id, current, true);
    });
  const suggestHabit: AppState["suggestHabit"] = (input, signal) =>
    featureRequest("/habits/suggest", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  const reflectJournal: AppState["reflectJournal"] = async (
    id,
    selection,
    action,
    signal,
  ) => {
    requireUnlockedJournal();
    return featureRequest(`/journal/${encodeURIComponent(id)}/reflect`, {
      method: "POST",
      body: JSON.stringify({ ...selection, action }),
      signal,
    });
  };
  const discussJournal: AppState["discussJournal"] = async (
    id,
    selection,
    requestId,
    signal,
  ) => {
    requireUnlockedJournal();
    const result = await featureRequest(
      `/journal/${encodeURIComponent(id)}/discuss`,
      {
        method: "POST",
        body: JSON.stringify({ ...selection, requestId }),
        signal,
      },
    );
    if (
      !isRecordId(result?.conversation?.id) ||
      !Array.isArray(result.conversation.messages)
    )
      throw new Error("Solace returned an unexpected reply. Please try again.");
    if (!signal?.aborted) {
      revision.current += 1;
      setData((prev) => ({
        ...prev,
        conversations: [
          result.conversation,
          ...prev.conversations.filter(
            (item) => item.id !== result.conversation.id,
          ),
        ],
      }));
    }
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
  const generatePlanPreview = (
    input: PlanPreviewInput,
    signal?: AbortSignal,
  ): Promise<PlanPreview> =>
    featureRequest("/plans/preview", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
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
  const transcribeVoice = (
    audio: ArrayBuffer,
    contentType: string,
    signal?: AbortSignal,
  ) =>
    featureRequest("/voice/transcribe", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: audio,
      signal,
    });
  const speakVoiceReply = (
    conversationId: string,
    messageId: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> =>
    featureRequest("/voice/speech", {
      method: "POST",
      body: JSON.stringify({ conversationId, messageId }),
      responseType: "mp3",
      signal,
    });
  const startVoiceSession: AppState["startVoiceSession"] = (
    offer,
    conversationId,
    signal,
  ) =>
    featureRequest("/voice/realtime", {
      method: "POST",
      headers: {
        [appActionCapabilityHeader]: appActionCapabilityVersion,
        [wellnessGoalsActionHeader]: "1",
        [practiceHandoffHeader]: "1",
        "X-Solace-Voice-Setup": "1",
      },
      body: JSON.stringify({ offer, conversationId }),
      signal,
    });
  const voiceSessionStatus: AppState["voiceSessionStatus"] = (
    id,
    revision,
    signal,
    ready,
  ) =>
    featureRequest(`/voice/realtime/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ revision, ready }),
      signal,
    });
  const endVoiceSession: AppState["endVoiceSession"] = (id) =>
    authenticatedRequest(
      `/voice/realtime/${encodeURIComponent(id)}/end`,
      { method: "POST", body: "{}" },
      draftGeneration,
      true,
    );
  const reportVoiceActionResult: AppState["reportVoiceActionResult"] = (
    id,
    actionId,
    result,
    signal,
  ) =>
    featureRequest(`/voice/realtime/${encodeURIComponent(id)}/action-result`, {
      method: "POST",
      body: JSON.stringify({ actionId, ...result }),
      signal,
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
  const saveWellnessGoals: AppState["saveWellnessGoals"] = async (
    goals,
    completeOnboarding,
  ) => {
    const version = draftGeneration;
    const account = owner.current;
    const result = await authenticatedRequest(
      "/auth/wellness-goals",
      { method: "PATCH", body: JSON.stringify({ goals, completeOnboarding }) },
      version,
    );
    assertSession(version);
    const saved = result?.user;
    if (
      !account ||
      saved?.id !== account ||
      saved.wellnessOnboarding !== "completed" ||
      !Array.isArray(saved.wellnessGoals) ||
      !saved.wellnessGoals.every(isWellnessGoal)
    )
      throw new Error(
        "Solace couldn’t confirm your saved goals. Please try again.",
      );
    revision.current += 1;
    setUser((previous) =>
      previous?.id === account
        ? {
            ...previous,
            wellnessGoals: saved.wellnessGoals,
            wellnessOnboarding: saved.wellnessOnboarding,
          }
        : previous,
    );
    return saved.wellnessGoals;
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
      setEditorDraftPersistence({});
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
      // Only stop delivery after the API has confirmed account deletion.
      await cancelAllReminders().catch(() => {});
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
      setEditorDraftPersistence({});
      setSessionExpired(false);
      setSessionError(null);
      setNavigation(initialNavigation());
      try {
        await writeCredential(null, version);
        if (lockState.current.policy) await saveDevicePolicy(null, version);
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
    const policy = lockState.current.policy;
    if (policy?.journal && policy.owner === owner.current) {
      assertActiveSession(version);
      await localBiometricPrompt(() =>
        verifyDeviceLock(policy.owner, "Confirm to export private writing"),
      );
    }
    const result = await authenticatedRequest("/export", {}, version);
    assertSession(version);
    return result;
  };
  const { activeTab, stacks } = navigation;
  const stack = stacks[activeTab]!;
  const current = stack[stack.length - 1];
  const habitHub =
    current.name === routes.habits || isHabitDrillDown(current.name)
      ? stack.findLast(({ name }) => name === routes.habits)
      : undefined;
  const insideJournal =
    journalRoutes.has(current.name) ||
    ([routes.reflectionDetail, "reflection"].includes(current.name) &&
      data.reflections.some(
        (record) =>
          isJournalRecord(record) &&
          record.id === (current.params.id ?? current.params.editId),
      ));
  const journalLocked =
    !!localLock.policy?.journal && !localLock.journalGranted;
  const displayedData = useMemo(() => {
    if (!localLock.policy?.journal || (insideJournal && !journalLocked))
      return data;
    return {
      ...data,
      // Journey can still count and link private entries without displaying
      // titles, content, tags, or notes on an unlocked secondary screen.
      reflections: data.reflections.map((record) =>
        isJournalRecord(record)
          ? {
              id: record.id,
              kind: "journal",
              title: "Private journal entry",
              day: record.day,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              localOnly: record.localOnly,
            }
          : record,
      ),
    };
  }, [data, insideJournal, journalLocked, localLock.policy?.journal]);
  const switchSolaceMode = (
    mode: SolaceMode,
    entryDay?: string,
    entryTitle?: string,
  ) => {
    if (draftGeneration !== generation.current) return;
    setNavigation((old) => {
      const root = solaceRoots[mode];
      const existing = old.stacks.chat;
      if (
        old.activeTab === routes.companion &&
        !entryDay &&
        !entryTitle &&
        existing?.[0].name === root &&
        !immersiveRoutes.has(existing.at(-1)!.name) &&
        !existing.some((entry) => entry.params.fromJournal)
      )
        return old;
      const views = rememberSolaceView(old);
      const saved = views?.[mode];
      const journalFilter = (entryDay || entryTitle) && {
        entryDay,
        entryTitle,
        query: "",
        mood: null,
        favorites: false,
        moodOnly: false,
        scrollY: 0,
      };
      return {
        ...old,
        activeTab: routes.companion,
        solaceMode: mode,
        solaceViews: views,
        stacks: {
          ...stacksAfterLeavingImmersive(old),
          chat: journalFilter
            ? [routeEntry(root, journalFilter)]
            : saved?.length
              ? saved
              : [routeEntry(root)],
        },
      };
    });
  };
  const navigate = (name: string, params: Record<string, any> = {}) => {
    if (draftGeneration !== generation.current) return;
    const hubParams = habitHubParams(name, params);
    if (hubParams) {
      name = routes.habits;
      params = hubParams;
    }
    if (name === routes.journal) {
      const entryDay =
        typeof params.entryDay === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(params.entryDay)
          ? params.entryDay
          : undefined;
      const entryTitle =
        typeof params.entryTitle === "string" &&
        params.entryTitle.trim().length <= 80
          ? params.entryTitle.trim()
          : undefined;
      switchSolaceMode("journal", entryDay, entryTitle);
      return;
    }
    if (
      (name === routes.journalEntry ||
        name === routes.journalReflect ||
        (name === routes.journalEditor && params.id !== undefined)) &&
      !isRecordId(params.id)
    )
      return;
    const tab = mainTabFor(name);
    const entry = routeEntry(
      name === routes.solace && !Object.keys(params).length
        ? name
        : tab || name,
      params,
    );
    setNavigation((old) => {
      const previousStack = old.stacks[old.activeTab]!;
      const previousRoute = previousStack[previousStack.length - 1];
      if (
        hubParams ||
        (name === routes.habitDetails && isRecordId(params.id))
      ) {
        const index = previousStack.findLastIndex(
          ({ name }) => name === routes.habits,
        );
        if (hubParams && index >= 0) {
          const hub = previousStack[index];
          if (
            index === previousStack.length - 1 &&
            Object.keys(hubParams).every((key) =>
              Object.is(
                hub.params[key],
                hubParams[key as keyof typeof hubParams],
              ),
            )
          )
            return old;
          return {
            ...old,
            stacks: {
              ...old.stacks,
              [old.activeTab]: [
                ...previousStack.slice(0, index),
                { ...hub, params: { ...hub.params, ...hubParams } },
              ],
            },
          };
        }
        if (!hubParams && index < 0)
          return {
            ...old,
            stacks: {
              ...old.stacks,
              [old.activeTab]: [
                ...previousStack,
                routeEntry(routes.habits, { section: "today" }),
                entry,
              ],
            },
          };
      }
      if (tab === routes.companion && entry.name === routes.companion) {
        const views = rememberSolaceView(old);
        if (
          params.habitAssistant === "reflect" ||
          params.habitAssistant === "simplify"
        ) {
          const assistant = {
            habitAssistant: params.habitAssistant,
            habitAssistantId: isRecordId(params.habitAssistantId)
              ? params.habitAssistantId
              : undefined,
          };
          if (
            old.activeTab === routes.companion &&
            previousRoute.name === routes.companion
          ) {
            return {
              ...old,
              stacks: {
                ...old.stacks,
                chat: [
                  ...previousStack.slice(0, -1),
                  {
                    ...previousRoute,
                    params: { ...previousRoute.params, ...assistant },
                  },
                ],
              },
            };
          }
          const root = views?.companion?.[0] ?? routeEntry(routes.companion);
          const sameMode =
            old.activeTab === routes.companion &&
            previousStack[0].name === routes.companion;
          const handoff: RouteEntry = {
            ...entry,
            params: { ...root.params, ...assistant },
            returnTab:
              old.activeTab !== routes.companion ? old.activeTab : undefined,
            returnMode:
              old.activeTab === routes.companion &&
              !sameMode &&
              previousStack[0].name === routes.journal
                ? "journal"
                : undefined,
          };
          return {
            ...old,
            activeTab: routes.companion,
            solaceMode: "companion",
            solaceViews: views,
            stacks: {
              ...stacksAfterLeavingImmersive(old),
              chat: [...(sameMode ? previousStack : [root]), handoff],
            },
          };
        }
        const inJournal =
          old.activeTab === routes.companion &&
          previousStack[0].name === routes.journal;
        const origin = params.fromJournal;
        if (
          inJournal &&
          isRecordId(origin) &&
          previousStack.some(
            (route) =>
              journalRoutes.has(route.name) && route.params.id === origin,
          )
        ) {
          if (
            previousRoute.name === routes.companion &&
            previousRoute.params.id === params.id
          )
            return old;
          return {
            ...old,
            stacks: { ...old.stacks, chat: [...previousStack, entry] },
          };
        }
        const handoffIndex = inJournal
          ? previousStack.findIndex(
              (route) =>
                route.name === routes.companion && route.params.fromJournal,
            )
          : -1;
        if (handoffIndex >= 0) {
          const handoff = previousStack[handoffIndex];
          const replacement = {
            ...handoff,
            params: { ...params, fromJournal: handoff.params.fromJournal },
          };
          return {
            ...old,
            stacks: {
              ...old.stacks,
              chat: [...previousStack.slice(0, handoffIndex), replacement],
            },
          };
        }
        const { fromJournal: _origin, ...safeParams } = params;
        return {
          ...old,
          activeTab: routes.companion,
          solaceMode: "companion",
          solaceViews: views,
          stacks: {
            ...stacksAfterLeavingImmersive(old),
            chat: [{ ...entry, params: safeParams }],
          },
        };
      }
      if (
        journalRoutes.has(name) &&
        (old.activeTab !== routes.companion ||
          previousStack[0].name !== routes.journal)
      ) {
        const views = rememberSolaceView(old);
        const root = views?.journal?.[0] ?? routeEntry(routes.journal);
        const returnTab =
          old.activeTab === routes.companion ? undefined : old.activeTab;
        const returnMode =
          !returnTab && previousStack[0].name === routes.companion
            ? "companion"
            : undefined;
        return {
          ...old,
          activeTab: routes.companion,
          solaceMode: "journal",
          solaceViews: views,
          stacks: {
            ...stacksAfterLeavingImmersive(old),
            chat: [root, { ...entry, returnTab, returnMode }],
          },
        };
      }
      if (tab) {
        const saved = old.stacks[tab];
        const reopenExplore = tab === "explore" && !Object.keys(params).length;
        if (reopenExplore && old.activeTab === tab && saved?.length === 1)
          return old;
        return {
          ...old,
          activeTab: tab,
          ...(entry.name === routes.solace && {
            solaceViews: rememberSolaceView(old),
          }),
          stacks: {
            ...stacksAfterLeavingImmersive(old),
            [tab]: reopenExplore && saved ? saved.slice(0, 1) : [entry],
          },
        };
      }
      if (
        (journalRoutes.has(name) ||
          name === routes.techniques ||
          name === routes.technique) &&
        previousRoute.name === name &&
        previousRoute.params.id === params.id
      )
        return old;
      // Match the original destination independently of view state added by
      // setParams. Reopening an ancestor keeps its saved filters and scroll.
      let previousIndex = previousStack.length - 1;
      while (
        previousIndex >= 0 &&
        !matchesDestination(previousStack[previousIndex], entry)
      )
        previousIndex -= 1;
      if (previousIndex === previousStack.length - 1) return old;
      return {
        ...old,
        stacks: {
          ...old.stacks,
          [old.activeTab]:
            previousIndex < 0
              ? [...previousStack, entry]
              : previousStack.slice(0, previousIndex + 1),
        },
      };
    });
  };
  const setParams = (params: Record<string, any>) => {
    if (draftGeneration !== generation.current) return;
    setNavigation((old) => {
      const merge = (entries: RouteEntry[] | undefined) => {
        const index =
          entries?.findIndex((entry) => entry.key === current.key) ?? -1;
        if (!entries || index < 0) return;
        const entry = entries[index];
        if (
          Object.keys(params).every((key) =>
            Object.is(params[key], entry.params[key]),
          )
        )
          return;
        const updated = [...entries];
        updated[index] = { ...entry, params: { ...entry.params, ...params } };
        return updated;
      };
      const visible = merge(old.stacks[activeTab]);
      if (visible)
        return { ...old, stacks: { ...old.stacks, [activeTab]: visible } };
      if (activeTab !== routes.companion) return old;
      const mode = stack[0].name === routes.companion ? "companion" : "journal";
      const cached = merge(old.solaceViews?.[mode]);
      return cached
        ? { ...old, solaceViews: { ...old.solaceViews, [mode]: cached } }
        : old;
    });
  };
  const back = () => {
    if (draftGeneration !== generation.current) return;
    setNavigation((old) => {
      const activeStack = old.stacks[old.activeTab]!;
      const top = activeStack[activeStack.length - 1];
      // A delayed save/delete or repeated Back should only close the page
      // that requested it, including two details with the same route name.
      if (top.key !== current.key) return old;
      if (activeStack.length === 1) {
        if (old.activeTab !== routes.companion || !isSolaceModeRoot(top.name))
          return old;
        return {
          ...old,
          solaceViews: rememberSolaceView(old),
          stacks: { ...old.stacks, chat: [routeEntry(routes.solace)] },
        };
      }
      const { returnTab, returnMode } = top;
      const priorMode = returnMode && old.solaceViews?.[returnMode];
      if (returnMode && priorMode?.length)
        return {
          ...old,
          solaceMode: returnMode,
          solaceViews: rememberSolaceView(old),
          stacks: { ...old.stacks, chat: priorMode },
        };
      return {
        ...old,
        activeTab: returnTab ?? old.activeTab,
        stacks: { ...old.stacks, [old.activeTab]: activeStack.slice(0, -1) },
      };
    });
  };
  const setTab = (name: string, intent: TabSelectionIntent = "switch") => {
    if (!canUseAccount(draftGeneration)) return;
    const tab = mainTabFor(name);
    if (!tab) return;
    setNavigation((old) => {
      const active = old.stacks[old.activeTab]!;
      const top = active[active.length - 1];
      if (immersiveRoutes.has(top.name)) return old;
      if (intent === "reselect") {
        if (old.activeTab !== tab || top.key !== current.key) return old;
        const resetSolace = tab === routes.companion;
        const root = active[0];
        const alreadyAtRoot = !resetSolace || root.name === routes.solace;
        if (active.length === 1 && alreadyAtRoot) return old;
        const views = resetSolace ? rememberSolaceView(old) : undefined;
        return {
          ...old,
          ...(resetSolace &&
            views && {
              solaceViews: {
                companion: views.companion?.slice(0, 1),
                journal: views.journal?.slice(0, 1),
              },
            }),
          stacks: {
            ...old.stacks,
            [tab]: [alreadyAtRoot ? root : routeEntry(routes.solace)],
          },
        };
      }
      if (old.activeTab === tab) return old;
      const { stacks } = old;
      const root =
        tab === routes.companion
          ? old.solaceMode
            ? solaceRoots[old.solaceMode]
            : routes.solace
          : tab;
      return {
        ...old,
        activeTab: tab,
        stacks: stacks[tab] ? stacks : { ...stacks, [tab]: [routeEntry(root)] },
      };
    });
  };
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const account = String(user.id);
    void AsyncStorage.getItem(solaceModeKey(account))
      .then((mode) => {
        if (
          !active ||
          owner.current !== account ||
          (mode !== "companion" && mode !== "journal")
        )
          return;
        setNavigation((old) => {
          if (old.solaceMode) return old;
          const showingChoices = old.stacks.chat?.[0].name === routes.solace;
          return {
            ...old,
            solaceMode: mode,
            stacks: showingChoices
              ? { ...old.stacks, chat: [routeEntry(solaceRoots[mode])] }
              : old.stacks,
          };
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.id]);
  useEffect(() => {
    if (user?.id && navigation.solaceMode)
      void AsyncStorage.setItem(
        solaceModeKey(String(user.id)),
        navigation.solaceMode,
      ).catch(() => {});
  }, [navigation.solaceMode, user?.id]);
  useEffect(() => {
    if (insideJournal) return;
    journalVisit.current += 1;
    if (lockState.current.journalGranted)
      changeDeviceLock({ journalGranted: false });
  }, [insideJournal]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const cancelSensitiveWork = () => {
      // Local drafts may finish one protected checkpoint while remote calls
      // are aborted. A later logout or account transition still invalidates it.
      let checkpointVersion = generation.current;
      const account = owner.current;
      if (token && account && Object.keys(editors.current).length)
        void flushEditorDrafts(
          () =>
            generation.current === checkpointVersion &&
            accountTransition.current === null &&
            owner.current === account,
        );
      checkpointVersion = advanceSession();
      flushLock.current = null;
      setSyncingWrites(false);
      setPendingWrites((entries) =>
        entries.map((entry) =>
          entry.syncState === "syncing"
            ? { ...entry, syncState: undefined }
            : entry,
        ),
      );
    };
    const relockApp = () => {
      if (
        !token ||
        sessionExpired ||
        lockState.current.appUnlock.phase !== "unlocked" ||
        accountTransition.current !== null
      )
        return;
      changeDeviceLock({
        appUnlock: { phase: "locked" },
        journalGranted: false,
      });
      cancelSensitiveWork();
    };
    const subscription = NativeAppState?.addEventListener?.(
      "change",
      (state) => {
        const enteredBackground =
          state === "background" && lastNativeState.current !== "background";
        lastNativeState.current = state;
        if (enteredBackground) backgroundGeneration.current += 1;
        const since = backgroundSince.current;
        if (state === "active") backgroundSince.current = null;
        const policy = lockState.current.policy;
        if (
          policy &&
          (policy.owner === owner.current ||
            lockState.current.appUnlock.phase !== "unlocked")
        ) {
          if (state === "inactive" || state === "background") {
            changeDeviceLock({ covered: true });
          }
          if (state === "background" && backgroundSince.current === null) {
            backgroundSince.current = Date.now();
            if (policy.appDelay === 0) relockApp();
            else if (policy.journal && lockState.current.journalGranted) {
              changeDeviceLock({ journalGranted: false });
              cancelSensitiveWork();
            }
          }
          if (
            state === "active" &&
            since !== null &&
            policy.appDelay !== null &&
            Date.now() - since >= policy.appDelay * 1000
          ) {
            relockApp();
          }
        }
        if (state === "active" && lockState.current.covered) {
          changeDeviceLock({ covered: false });
        }
      },
    );
    return () => subscription?.remove();
  }, [token, user?.id, localLock.policy, draftGeneration, sessionExpired]);
  useEffect(() => {
    if (!owner.current || !token) return;
    const subscription = NativeAppState?.addEventListener?.(
      "change",
      (state) => {
        if (state === "inactive" || state === "background")
          void flushEditorDrafts();
      },
    );
    return () => subscription?.remove();
  }, [token, user?.id, draftGeneration]);
  useEffect(() => {
    if (
      !token ||
      !user?.id ||
      !pendingWrites.length ||
      sessionExpired ||
      appLocked
    )
      return;
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
  }, [token, user?.id, pendingWrites.length, sessionExpired, appLocked]);
  return (
    <Context.Provider
      value={{
        user,
        data: displayedData,
        initializing,
        sessionError,
        sessionExpired,
        deviceLock: localLock.policy,
        deviceLockBusy,
        appUnlock:
          initializing && !appLocked
            ? { phase: "checking" }
            : localLock.appUnlock,
        appLocked,
        journalLocked,
        journalRouteProtected: insideJournal,
        privacyCovered: localLock.covered,
        updateDeviceLock,
        unlockDeviceLock,
        retrySession,
        busy,
        error,
        route: current.name,
        routeKey: current.key,
        habitHub,
        activeTab,
        params: current.params,
        canGoBack:
          stack.length > 1 ||
          (activeTab === routes.companion && isSolaceModeRoot(current.name)),
        token,
        chatDrafts,
        chatPending,
        setChatDraft,
        editorDrafts,
        editorDraftPersistence,
        setEditorDraft,
        flushEditorDrafts,
        pendingWrites,
        syncingWrites,
        offlineError,
        draftProtection: vault.durable ? "device" : "memory",
        flushPendingWrites,
        discardPendingWrite,
        signIn,
        signUp,
        googleConfiguration,
        googleLoginStart,
        googleLogin,
        googleLinkStatus,
        googleLinkStart,
        googleLinkComplete,
        requestPasswordReset,
        resetPassword,
        signOut,
        refresh,
        saveGardenIntention,
        save,
        remove,
        createHabit,
        editHabit,
        deleteHabit,
        setHabitProgress,
        retryHabitReminder,
        suggestHabit,
        navigate,
        setParams,
        back,
        setTab,
        switchSolaceMode,
        chat,
        reflectJournal,
        discussJournal,
        generateMoment,
        generatePlanPreview,
        weeklyReflection,
        capabilities,
        transcribeVoice,
        speakVoiceReply,
        startVoiceSession,
        voiceSessionStatus,
        endVoiceSession,
        reportVoiceActionResult,
        updateUser,
        saveWellnessGoals,
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
