import { randomUUID } from "node:crypto";
import type { Store } from "./database.js";
import {
  legacyAppAction,
  readAppAction,
  type AppAction,
} from "./companion-app-action.js";
import {
  appActionAcknowledgement,
  appActionDraftFor,
  appActionInstructions,
  appActionSupportsWellnessGoals,
  appActionSupportsPracticeHandoff,
  appActionUnavailableReply,
  isAppActionRequest,
  realtimeAppActionTool,
  resolveExplicitAppAction,
  validateAppAction,
  type AppActionDraft,
} from "./companion-action-intent.js";
import type {
  RealtimeProvider,
  RealtimeProviderEvent,
  RealtimeSideband,
} from "./realtime-provider.js";

export type RealtimeLimits = {
  sessionSeconds?: number;
  dailySeconds?: number;
  globalDailySeconds?: number;
  heartbeatSeconds?: number;
};

export type RealtimeCloseReason =
  | "ended"
  | "expired"
  | "heartbeat_timeout"
  | "provider_unavailable"
  | "authorization_changed"
  | "support"
  | "shutdown";

export type RealtimeState = {
  id: string;
  expiresAt: number;
  phase:
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "support"
    | "disconnected";
  userSpeaking: boolean;
  revision: number;
  reason?: RealtimeCloseReason;
  support?: string;
  conversationId?: string;
  appAction?: AppAction;
  pendingActionId?: string;
};

export type RealtimeTurn = {
  id: string;
  userText: string;
  assistantText?: string;
  support?: boolean;
  actionResult?: boolean;
  appAction?: AppAction;
};

export type RealtimeStart = {
  ownerId: string;
  offer: string;
  instructions: string;
  history?: readonly { role: "user" | "assistant"; content: string }[];
  conversationId?: string;
  greetingName?: string;
  parallelSetup?: boolean;
  appActions?: boolean;
  appActionResults?: boolean;
  wellnessGoalNavigation?: boolean;
  practiceHandoff?: boolean;
  authorize: () => boolean;
  onTurn: (turn: RealtimeTurn) => { conversationId?: string } | void;
  safetyReply?: (text: string) => string | undefined;
  signal?: AbortSignal;
};

export class RealtimeError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RealtimeError";
  }
}

const unavailable = () =>
  new RealtimeError(
    503,
    "REALTIME_UNAVAILABLE",
    "Live voice is unavailable. You can keep talking with text.",
  );
const notFound = () =>
  new RealtimeError(
    404,
    "REALTIME_NOT_FOUND",
    "This live voice session is no longer available.",
  );
const changed = () =>
  new RealtimeError(
    409,
    "REALTIME_AUTH_CHANGED",
    "This conversation changed. Reopen voice to continue.",
  );
const busy = () =>
  new RealtimeError(
    409,
    "REALTIME_BUSY",
    "You already have a live voice session.",
  );
const DAY_MS = 86_400_000;
const MIN_CHARGE_MS = 10_000;
// A failed hangup holds the slot through the upstream session's maximum lifetime.
const MAX_UPSTREAM_LIFETIME_MS = 65 * 60_000;
const TERMINAL_TTL_MS = 60_000;
const MAX_INPUT_ITEMS = 128;
const MAX_TRANSCRIPT = 4_000;
const GREETING_QUIET_MS = 220;
const observedEvents = new Set([
  "input_audio_buffer.speech_started",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.committed",
  "conversation.item.input_audio_transcription.completed",
  "conversation.item.input_audio_transcription.failed",
  "response.created",
  "response.done",
  "output_audio_buffer.started",
  "output_audio_buffer.stopped",
  "output_audio_buffer.cleared",
  "error",
]);

type Lease = {
  user_id: string;
  id: string;
  day: string;
  started_at: number;
  expires_at: number;
  provider_call_id: string | null;
  hangup_attempts: number;
};

type History = NonNullable<RealtimeStart["history"]>[number][];
type InputItem = { committed: boolean; text?: string | null };
type ActionCall = {
  type: "function_call";
  name: string;
  call_id: string;
  arguments: string;
};
export type VoiceActionResult = { ok: boolean; message: string };
type IssuedAction = {
  turn: RealtimeTurn;
  call?: ActionCall;
  completed?: boolean;
};
type TurnOutput = {
  turn: RealtimeTurn;
  selectingAction?: boolean;
  appAction?: AppAction;
  call?: ActionCall;
  draft?: AppActionDraft;
  actionFeedback?: boolean;
  transcript?: string;
};
type Output = (TurnOutput | { greetingId: string }) & {
  responseId?: string;
  started?: boolean;
  done?: boolean;
  drained?: boolean;
  interrupted?: boolean;
  stopSent?: boolean;
  bufferCleared?: boolean;
};
type Listener = (state: RealtimeState) => void;
type ActiveSession = {
  lease: Lease;
  state: RealtimeState;
  controller: AbortController;
  connecting: boolean;
  link?: RealtimeSideband;
  closeReason?: RealtimeCloseReason;
  closing?: Promise<void>;
  heartbeatDeadline: number;
  timer?: ReturnType<typeof setTimeout>;
  authorize: RealtimeStart["authorize"];
  onTurn: RealtimeStart["onTurn"];
  safetyReply: RealtimeStart["safetyReply"];
  appActions?: boolean;
  appActionResults?: boolean;
  wellnessGoalNavigation?: boolean;
  practiceHandoff?: boolean;
  actionDraft?: AppActionDraft;
  issued: Map<string, IssuedAction>;
  actionReplies: { issued: IssuedAction; result: VoiceActionResult }[];
  history: History;
  inputs: Map<string, InputItem>;
  ordered: string[];
  output?: Output;
  greeting?: {
    text: string;
    ready?: true;
    timer?: ReturnType<typeof setTimeout>;
  };
  ignoredErrors: Set<string>;
  listeners: Set<Listener>;
};

const eventId = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value)
    ? value
    : undefined;

const object = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;

function voiceGreeting(displayName: string) {
  // Google sign-in stores this placeholder when its identity has no name.
  const name = displayName.trim();
  const firstName =
    name === "Solace user" ? undefined : name.split(/\s+/, 1)[0];
  // Only a short name token goes to the provider. Skip email addresses,
  // placeholders without letters, and punctuation outside ordinary names.
  const usableName =
    firstName &&
    firstName.length <= 40 &&
    /^\p{L}[\p{L}\p{M}]*(?:['’\p{Pd}]\p{L}[\p{L}\p{M}]*)*$/u.test(firstName);
  return `Hello${usableName ? `, ${firstName}` : ""}. What brings you here today?`;
}

function providerError(error: unknown) {
  const code = object(error)?.code;
  if (code === "REALTIME_INVALID_OFFER")
    return new RealtimeError(
      400,
      code,
      "This device could not start live voice.",
    );
  if (code === "REALTIME_RATE_LIMITED")
    return new RealtimeError(
      429,
      code,
      "Live voice is busy. Please try again later.",
    );
  if (code === "REALTIME_NOT_CONFIGURED")
    return new RealtimeError(
      503,
      code,
      "Live voice is unavailable. You can keep talking with text.",
    );
  return unavailable();
}

function outputTranscript(response: Record<string, unknown>) {
  if (!Array.isArray(response.output)) return;
  const parts = response.output.flatMap((value: unknown) => {
    const item = object(value);
    return item?.type === "message" &&
      item.role === "assistant" &&
      (item.status === undefined || item.status === "completed") &&
      Array.isArray(item.content)
      ? item.content.flatMap((value: unknown) => {
          const part = object(value);
          return part?.type === "output_audio" &&
            typeof part.transcript === "string"
            ? [part.transcript]
            : [];
        })
      : [];
  });
  const text = parts.join(" ").trim();
  return text && text.length <= MAX_TRANSCRIPT ? text : undefined;
}

function outputAction(response: Record<string, unknown>, turn: RealtimeTurn) {
  if (!Array.isArray(response.output)) return;
  const calls = response.output
    .map(object)
    .filter((item) => item?.type === "function_call");
  const call = calls[0];
  if (
    calls.length !== 1 ||
    !call ||
    call.name !== realtimeAppActionTool.name ||
    !eventId(call.call_id) ||
    (call.status !== undefined && call.status !== "completed") ||
    typeof call.arguments !== "string" ||
    call.arguments.length > 1400
  )
    return;
  try {
    const input = object(JSON.parse(call.arguments));
    if (
      input &&
      Object.keys(input).length === 1 &&
      Object.hasOwn(input, "action")
    )
      return {
        action: validateAppAction(input.action, turn.userText, turn.id),
        call: {
          type: "function_call",
          name: realtimeAppActionTool.name,
          call_id: eventId(call.call_id)!,
          arguments: call.arguments,
        } satisfies ActionCall,
      };
  } catch {
    // Malformed tool calls never become executable actions.
  }
}

function historyInput(history: History, acceptedAudioId: string) {
  return [
    ...history.map(({ role, content }) => ({
      type: "message",
      role,
      content: [
        { type: role === "user" ? "input_text" : "output_text", text: content },
      ],
    })),
    { type: "item_reference", id: acceptedAudioId },
  ];
}

export function createRealtimeService({
  store,
  provider,
  limits = {},
  now = Date.now,
}: {
  store: Store;
  provider: RealtimeProvider;
  limits?: RealtimeLimits;
  now?: () => number;
}) {
  const sessionMs = (limits.sessionSeconds ?? 300) * 1_000;
  const dailyMs = (limits.dailySeconds ?? 900) * 1_000;
  const globalDailyMs = (limits.globalDailySeconds ?? 3_600) * 1_000;
  const heartbeatMs = (limits.heartbeatSeconds ?? 20) * 1_000;
  if (
    ![sessionMs, dailyMs, globalDailyMs, heartbeatMs].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error("Invalid realtime voice limits.");

  const sessions = new Map<string, ActiveSession>();
  const terminals = new Map<
    string,
    {
      ownerId: string;
      state: RealtimeState;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const pending = new Set<Promise<unknown>>();
  const releasing = new Map<string, Promise<void>>();
  let disposed = false;

  function track<T>(task: Promise<T>) {
    pending.add(task);
    const done = () => pending.delete(task);
    void task.then(done, done);
    return task;
  }

  function leaseFor(ownerId: string) {
    return store.one<Lease>(
      "SELECT * FROM realtime_voice_leases WHERE user_id=?",
      [ownerId],
    );
  }

  function reserve(ownerId: string) {
    const start = now();
    const day = new Date(start).toISOString().slice(0, 10);
    const nextDay = (Math.floor(start / DAY_MS) + 1) * DAY_MS;
    return store.transaction(() => {
      if (leaseFor(ownerId)) throw busy();
      if (!store.one("SELECT id FROM users WHERE id=?", [ownerId]))
        throw changed();
      const userUsed =
        store.one<{ used_ms: number }>(
          "SELECT used_ms FROM realtime_voice_usage WHERE user_id=? AND day=?",
          [ownerId, day],
        )?.used_ms ?? 0;
      const globalUsed =
        store.one<{ used_ms: number }>(
          "SELECT used_ms FROM realtime_voice_totals WHERE day=?",
          [day],
        )?.used_ms ?? 0;
      const duration = Math.min(
        sessionMs,
        dailyMs - userUsed,
        globalDailyMs - globalUsed,
        nextDay - start,
      );
      if (duration < Math.min(sessionMs, 1_000))
        throw new RealtimeError(
          429,
          "REALTIME_DAILY_LIMIT",
          "The daily live voice limit has been reached. You can keep talking with text.",
        );
      const lease: Lease = {
        user_id: ownerId,
        id: randomUUID(),
        day,
        started_at: start,
        expires_at: start + duration,
        provider_call_id: null,
        hangup_attempts: 0,
      };
      store.run(
        "INSERT INTO realtime_voice_leases (user_id,id,day,started_at,expires_at) VALUES (?,?,?,?,?)",
        [ownerId, lease.id, day, start, lease.expires_at],
      );
      store.run(
        "INSERT INTO realtime_voice_usage VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET used_ms=used_ms+excluded.used_ms",
        [ownerId, day, duration],
      );
      store.run(
        "INSERT INTO realtime_voice_totals VALUES (?,?) ON CONFLICT(day) DO UPDATE SET used_ms=used_ms+excluded.used_ms",
        [day, duration],
      );
      const oldest = new Date(start - 7 * DAY_MS).toISOString().slice(0, 10);
      store.run("DELETE FROM realtime_voice_usage WHERE day < ?", [oldest]);
      store.run("DELETE FROM realtime_voice_totals WHERE day < ?", [oldest]);
      return lease;
    });
  }

  async function release(
    lease: Lease,
    refundable: boolean,
    endingActiveCall: boolean,
  ) {
    const persisted = leaseFor(lease.user_id);
    const stillOwned = persisted?.id === lease.id;
    if (
      lease.provider_call_id &&
      now() < lease.started_at + MAX_UPSTREAM_LIFETIME_MS
    ) {
      let confirmed = false;
      const attempts = stillOwned
        ? persisted.hangup_attempts
        : lease.hangup_attempts;
      for (let attempt = attempts; attempt < 2; attempt++) {
        if (stillOwned) {
          try {
            store.transaction(() =>
              store.run(
                "UPDATE realtime_voice_leases SET hangup_attempts=hangup_attempts+1 WHERE user_id=? AND id=?",
                [lease.user_id, lease.id],
              ),
            );
          } catch {
            // Loss of writable storage must not leave known upstream audio
            // active. Keep the reservation and make one best-effort hangup.
            if (endingActiveCall)
              await provider.hangup(lease.provider_call_id).catch(() => {});
            return;
          }
        }
        try {
          await provider.hangup(lease.provider_call_id);
          confirmed = true;
          break;
        } catch {
          // One bounded retry, then retain both the slot and the reservation.
        }
      }
      if (!confirmed) return;
    }
    if (!stillOwned || leaseFor(lease.user_id)?.id !== lease.id) return;
    const reserved = lease.expires_at - lease.started_at;
    const used = Math.min(
      reserved,
      Math.max(MIN_CHARGE_MS, now() - lease.started_at),
    );
    const refund = refundable ? reserved - used : 0;
    store.transaction(() => {
      store.run("DELETE FROM realtime_voice_leases WHERE user_id=? AND id=?", [
        lease.user_id,
        lease.id,
      ]);
      if (refund) {
        store.run(
          "UPDATE realtime_voice_usage SET used_ms=MAX(0,used_ms-?) WHERE user_id=? AND day=?",
          [refund, lease.user_id, lease.day],
        );
        store.run(
          "UPDATE realtime_voice_totals SET used_ms=MAX(0,used_ms-?) WHERE day=?",
          [refund, lease.day],
        );
      }
    });
  }

  function releaseOnce(
    lease: Lease,
    refundable: boolean,
    endingActiveCall = false,
  ) {
    const existing = releasing.get(lease.id);
    if (existing) return existing;
    const task = track(
      release(lease, refundable, endingActiveCall).catch(() => {}),
    );
    releasing.set(lease.id, task);
    void task.then(() => releasing.delete(lease.id));
    return task;
  }

  // A restart keeps its reservation. Revoke known upstream calls before
  // admitting another one, including calls disconnected during process loss.
  for (const lease of store.all<Lease>("SELECT * FROM realtime_voice_leases"))
    void releaseOnce(lease, false);

  function publish(session: ActiveSession, patch: Partial<RealtimeState>) {
    if (
      !Object.entries(patch).some(
        ([key, value]) => session.state[key as keyof RealtimeState] !== value,
      )
    )
      return;
    session.state = {
      ...session.state,
      ...patch,
      revision: session.state.revision + 1,
    };
    for (const listener of session.listeners) {
      try {
        listener({ ...session.state });
      } catch {
        session.listeners.delete(listener);
      }
    }
  }

  function settle(session: ActiveSession) {
    if (
      !session.closeReason ||
      (session.connecting && !session.lease.provider_call_id)
    )
      return;
    session.closing ??= releaseOnce(
      session.lease,
      session.closeReason !== "heartbeat_timeout",
      true,
    );
    return session.closing;
  }

  function discardGreeting(session: ActiveSession) {
    clearTimeout(session.greeting?.timer);
    session.greeting = undefined;
  }

  function close(
    session: ActiveSession,
    reason: RealtimeCloseReason,
    support?: string,
  ) {
    if (session.closeReason) return session.closing;
    session.closeReason = reason;
    clearTimeout(session.timer);
    discardGreeting(session);
    const link = session.link;
    if (link) {
      // Stop new VAD commits and queued output before attempting HTTP hangup.
      // These controls are best effort if the sideband has already failed.
      link.send({
        type: "session.update",
        session: {
          type: "realtime",
          audio: { input: { turn_detection: null } },
        },
      });
      link.send({ type: "input_audio_buffer.clear" });
      const output = session.output;
      if (output?.responseId && !output.done && !output.stopSent)
        link.send({ type: "response.cancel", response_id: output.responseId });
      if (output && !output.bufferCleared)
        link.send({ type: "output_audio_buffer.clear" });
      link.close();
    }
    session.controller.abort();
    const id = session.state.id;
    sessions.delete(id);
    const timer = setTimeout(() => terminals.delete(id), TERMINAL_TTL_MS);
    timer.unref();
    // Store the terminal state before notifying pollers so a second poll can
    // always see it, even when it begins synchronously from a listener.
    const terminal = {
      ownerId: session.lease.user_id,
      state: {
        ...session.state,
        phase: support ? "support" : "disconnected",
        userSpeaking: false,
        reason,
        support,
        appAction: undefined,
        pendingActionId: undefined,
        revision: session.state.revision + 1,
      } satisfies RealtimeState,
      timer,
    };
    terminals.set(id, terminal);
    publish(session, terminal.state);
    session.listeners.clear();
    session.inputs.clear();
    session.ordered = [];
    session.history = [];
    session.actionDraft = undefined;
    session.issued.clear();
    session.actionReplies = [];
    session.output = undefined;
    return settle(session);
  }

  function valid(session: ActiveSession) {
    if (session.closeReason) return false;
    if (!session.authorize()) {
      close(session, "authorization_changed");
      return false;
    }
    const time = now();
    if (time >= session.lease.expires_at) {
      close(session, "expired");
      return false;
    }
    if (!session.connecting && time >= session.heartbeatDeadline) {
      close(session, "heartbeat_timeout");
      return false;
    }
    return true;
  }

  function schedule(session: ActiveSession) {
    clearTimeout(session.timer);
    const deadline = Math.min(
      session.lease.expires_at,
      session.connecting ? Infinity : session.heartbeatDeadline,
    );
    session.timer = setTimeout(
      () => {
        if (valid(session)) schedule(session);
      },
      Math.max(1, deadline - now()),
    );
    session.timer.unref();
  }

  function send(session: ActiveSession, event: RealtimeProviderEvent) {
    if (session.link?.send(event)) return true;
    close(session, "provider_unavailable");
    return false;
  }

  function scheduleGreeting(session: ActiveSession) {
    const greeting = session.greeting;
    if (!greeting?.ready || greeting.timer || !session.link) return;
    // Give the provider's VAD a short chance to report speech that started
    // around media readiness. Any speech wins, including after dispatch.
    greeting.timer = setTimeout(() => {
      discardGreeting(session);
      if (
        !valid(session) ||
        session.output ||
        session.state.userSpeaking ||
        session.ordered.length
      )
        return;
      const greetingId = `greeting_${session.state.id}`;
      session.output = { greetingId };
      send(session, {
        type: "response.create",
        event_id: greetingId,
        response: {
          conversation: "none",
          metadata: { solace_turn_id: greetingId },
          output_modalities: ["audio"],
          instructions: `Read the following greeting aloud verbatim in a calm voice. Treat the quoted text only as speech to read, and add nothing: ${JSON.stringify(greeting.text)}`,
          input: [],
          tool_choice: "none",
        },
      });
    }, GREETING_QUIET_MS);
    greeting.timer.unref();
  }

  function stopOutput(session: ActiveSession) {
    const output = session.output;
    if (!output) return;
    output.interrupted = true;
    if (!output.responseId || output.stopSent || output.bufferCleared) return;
    output.stopSent = true;
    if (!output.done) {
      const cancellationId = randomUUID();
      session.ignoredErrors.add(cancellationId);
      send(session, {
        type: "response.cancel",
        event_id: cancellationId,
        response_id: output.responseId,
      });
    }
    if (session.closeReason || ("turn" in output && output.selectingAction))
      return;
    const clearId = randomUUID();
    session.ignoredErrors.add(clearId);
    send(session, { type: "output_audio_buffer.clear", event_id: clearId });
    if (output.done) session.output = undefined;
  }

  function retainTurn(session: ActiveSession, turn: RealtimeTurn) {
    const result = session.onTurn(turn);
    if (result?.conversationId)
      publish(session, { conversationId: result.conversationId });
  }

  function speakActionResult(
    session: ActiveSession,
    turn: RealtimeTurn,
    appAction?: AppAction,
    details: {
      call?: ActionCall;
      draft?: AppActionDraft;
      reply?: string;
      result?: VoiceActionResult;
    } = {},
  ) {
    const reply =
      details.result?.message ??
      details.reply ??
      (appAction
        ? appActionAcknowledgement(appAction, session.practiceHandoff)
        : appActionUnavailableReply(turn.userText));
    const input =
      details.call && (details.result || !appAction)
        ? [
            details.call,
            {
              type: "function_call_output",
              call_id: details.call.call_id,
              output: JSON.stringify(
                details.result ?? { ok: false, message: reply },
              ),
            },
          ]
        : [];
    session.output = {
      turn,
      appAction,
      call: details.call,
      draft: details.draft,
      actionFeedback: !!details.result,
    };
    send(session, {
      type: "response.create",
      response: {
        conversation: "none",
        metadata: { solace_turn_id: turn.id },
        output_modalities: ["audio"],
        instructions: `Say exactly this one sentence in a calm voice, with no additions: ${JSON.stringify(reply)}`,
        input,
        tool_choice: "none",
      },
    });
  }

  function nextResponse(session: ActiveSession) {
    if (
      session.output ||
      session.state.userSpeaking ||
      !session.link ||
      session.closeReason
    )
      return;
    while (session.ordered.length) {
      const id = session.ordered[0];
      const input = session.inputs.get(id)!;
      if (input.text === undefined) {
        publish(session, { phase: "thinking" });
        return;
      }
      session.ordered.shift();
      if (!input.text) continue;
      const turn: RealtimeTurn = { id: randomUUID(), userText: input.text };
      input.text = null;
      retainTurn(session, turn);
      const context = historyInput(session.history, id);
      session.history = [
        ...session.history,
        { role: "user", content: turn.userText },
      ].slice(-20) as History;
      publish(session, { phase: "thinking" });
      const direct = session.appActions
        ? resolveExplicitAppAction(
            turn.userText,
            session.actionDraft,
            now(),
            session.practiceHandoff,
          )
        : undefined;
      const action =
        direct?.action && readAppAction({ ...direct.action, id: turn.id });
      const pendingId = session.state.pendingActionId;
      const confirming =
        action?.kind === "confirm" && pendingId === action.targetId;
      if (!confirming) {
        session.actionDraft = undefined;
        if (pendingId) publish(session, { pendingActionId: undefined });
      }
      if (direct) {
        if (action?.kind === "confirm" && !confirming) {
          speakActionResult(session, turn, undefined, {
            reply:
              "There is no pending change to save. Ask again to review it.",
          });
          return;
        }
        if (confirming && !session.appActionResults) {
          session.actionDraft = undefined;
          publish(session, { pendingActionId: undefined });
          speakActionResult(session, turn, undefined, {
            reply:
              "Ask for the change again, then use the confirmation button in the app.",
          });
          return;
        }
        if (
          action &&
          ((!session.appActionResults && !legacyAppAction(action)) ||
            !appActionSupportsWellnessGoals(
              action,
              session.wellnessGoalNavigation,
            ) ||
            !appActionSupportsPracticeHandoff(action, session.practiceHandoff))
        ) {
          speakActionResult(session, turn, undefined, {
            reply:
              "This action needs the updated Solace app. You can still make that change using the app’s controls.",
          });
          return;
        }
        speakActionResult(session, turn, action, {
          draft: direct.draft,
          reply: direct.reply,
        });
        return;
      }
      const selectingAction =
        session.appActions && isAppActionRequest(turn.userText);
      session.output = { turn, selectingAction };
      send(session, {
        type: "response.create",
        response: {
          conversation: "none",
          metadata: { solace_turn_id: turn.id },
          output_modalities: selectingAction ? ["text"] : ["audio"],
          input: selectingAction
            ? [
                {
                  type: "message",
                  role: "user",
                  content: [{ type: "input_text", text: turn.userText }],
                },
              ]
            : context,
          ...(selectingAction
            ? {
                instructions: appActionInstructions,
                tools: [realtimeAppActionTool],
                tool_choice: "auto",
                max_output_tokens: 512,
              }
            : {}),
        },
      });
      return;
    }
    const feedback = session.actionReplies.shift();
    if (feedback) {
      publish(session, { phase: "thinking", appAction: undefined });
      speakActionResult(session, feedback.issued.turn, undefined, {
        call: feedback.issued.call,
        result: feedback.result,
      });
      return;
    }
    publish(session, { phase: "listening" });
  }

  function completeOutput(session: ActiveSession, output: Output) {
    const selectingAction = "turn" in output && output.selectingAction;
    if (
      !output.done ||
      (!selectingAction && !output.interrupted && !output.drained)
    )
      return;
    session.output = undefined;
    if (!("turn" in output)) {
      if (!session.state.userSpeaking) nextResponse(session);
      return;
    }
    if (
      output.selectingAction &&
      !output.interrupted &&
      !session.state.userSpeaking
    ) {
      speakActionResult(session, output.turn, output.appAction, {
        call: output.call,
      });
      return;
    }
    const deliverAction =
      output.started &&
      !output.interrupted &&
      !session.state.userSpeaking &&
      !session.ordered.length;
    const practiceOffer =
      deliverAction && output.appAction?.kind === "practice-start"
        ? output.appAction
        : undefined;
    const assistantText =
      output.transcript ??
      (practiceOffer
        ? "I’ve prepared a guided practice for you to review."
        : undefined);
    if (
      !output.actionFeedback &&
      output.started &&
      !output.interrupted &&
      assistantText
    ) {
      retainTurn(session, {
        ...output.turn,
        assistantText,
        ...(practiceOffer && { appAction: practiceOffer }),
      });
      session.history = [
        ...session.history,
        { role: "assistant", content: assistantText },
      ].slice(-20) as History;
    }
    if (deliverAction) {
      if (output.draft) session.actionDraft = output.draft;
      const action = output.appAction;
      if (action) {
        if (action.kind !== "confirm" && action.kind !== "cancel") {
          session.issued.set(action.id, {
            turn: output.turn,
            call: output.call,
          });
          if (session.issued.size > MAX_INPUT_ITEMS)
            session.issued.delete(session.issued.keys().next().value!);
        }
        const proposal = appActionDraftFor(
          action,
          now(),
          session.practiceHandoff,
        );
        if (proposal) session.actionDraft = proposal;
        const pendingActionId =
          action.kind === "confirm"
            ? session.state.pendingActionId
            : proposal?.kind === "proposal"
              ? action.id
              : undefined;
        publish(session, {
          appAction: action,
          pendingActionId,
          phase: "listening",
        });
      }
    }
    if (!session.state.userSpeaking) nextResponse(session);
  }

  function inputEvent(session: ActiveSession, event: RealtimeProviderEvent) {
    const id = eventId(event.item_id);
    if (!id || (event.content_index !== undefined && event.content_index !== 0))
      return;
    discardGreeting(session);
    let input = session.inputs.get(id);
    if (!input) {
      if (session.inputs.size >= MAX_INPUT_ITEMS) {
        close(session, "expired");
        return;
      }
      input = { committed: false };
      session.inputs.set(id, input);
    }
    if (event.type === "input_audio_buffer.committed") {
      if (!input.committed) {
        input.committed = true;
        session.ordered.push(id);
      }
    } else if (input.text === undefined) {
      const text =
        event.type ===
          "conversation.item.input_audio_transcription.completed" &&
        typeof event.transcript === "string"
          ? event.transcript.trim()
          : "";
      const support = text && session.safetyReply?.(text);
      if (support) {
        try {
          retainTurn(session, {
            id: randomUUID(),
            userText: text.slice(0, MAX_TRANSCRIPT),
            assistantText: support,
            support: true,
          });
        } finally {
          close(session, "support", support);
        }
        return;
      }
      input.text = text && text.length <= MAX_TRANSCRIPT ? text : null;
    }
    nextResponse(session);
  }

  function onEvent(session: ActiveSession, event: RealtimeProviderEvent) {
    if (!observedEvents.has(event.type)) return;
    try {
      if (!valid(session)) return;
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          discardGreeting(session);
          publish(session, {
            userSpeaking: true,
            phase: session.link ? "listening" : "connecting",
            appAction: undefined,
          });
          stopOutput(session);
          return;
        case "input_audio_buffer.speech_stopped":
          publish(session, { userSpeaking: false });
          nextResponse(session);
          return;
        case "input_audio_buffer.committed":
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.input_audio_transcription.failed":
          inputEvent(session, event);
          return;
        case "response.created": {
          const output = session.output;
          const response = object(event.response);
          const id = eventId(response?.id);
          if (output && id && output.responseId === id) return;
          if (
            !output ||
            !id ||
            output.responseId ||
            object(response?.metadata)?.solace_turn_id !==
              ("turn" in output ? output.turn.id : output.greetingId)
          ) {
            if (id)
              session.link?.send({ type: "response.cancel", response_id: id });
            session.link?.send({ type: "output_audio_buffer.clear" });
            close(session, "provider_unavailable");
            return;
          }
          output.responseId = id;
          if (output.interrupted) stopOutput(session);
          return;
        }
        case "output_audio_buffer.started":
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
        case "response.done": {
          const output = session.output;
          const response = object(event.response);
          const id = eventId(response?.id ?? event.response_id);
          if (!output || !id || id !== output.responseId) return;
          if (event.type === "response.done") {
            output.done = true;
            if (!("turn" in output)) {
              // The greeting is optional and is never a persisted chat turn.
              if (response?.status !== "completed") stopOutput(session);
            } else if (response?.status === "completed") {
              if (output.selectingAction) {
                const selected = outputAction(response, output.turn);
                const action = selected?.action;
                output.appAction =
                  action &&
                  (session.appActionResults || legacyAppAction(action)) &&
                  appActionSupportsWellnessGoals(
                    action,
                    session.wellnessGoalNavigation,
                  ) &&
                  appActionSupportsPracticeHandoff(
                    action,
                    session.practiceHandoff,
                  )
                    ? action
                    : undefined;
                output.call = selected?.call;
              } else output.transcript = outputTranscript(response);
            } else if (response?.status === "cancelled" || output.interrupted) {
              output.interrupted = true;
            } else if (!(
              output.selectingAction && response?.status === "incomplete"
            )) {
              close(session, "provider_unavailable");
              return;
            }
          } else if (event.type === "output_audio_buffer.started") {
            output.started = true;
            if (!output.interrupted) publish(session, { phase: "speaking" });
          } else if (event.type === "output_audio_buffer.stopped") {
            output.drained = true;
          } else {
            output.interrupted = true;
            output.bufferCleared = true;
          }
          completeOutput(session, output);
          return;
        }
        case "error": {
          const id = eventId(object(event.error)?.event_id);
          const output = session.output;
          if (
            output &&
            "greetingId" in output &&
            id === output.greetingId &&
            !output.responseId
          ) {
            session.output = undefined;
            nextResponse(session);
            return;
          }
          if (!id || !session.ignoredErrors.delete(id))
            close(session, "provider_unavailable");
          return;
        }
      }
    } catch {
      close(session, "authorization_changed");
    }
  }

  function current(ownerId: string, id: string) {
    const session = sessions.get(id);
    if (session?.lease.user_id === ownerId && valid(session)) return session;
    return undefined;
  }

  function state(ownerId: string, id: string): RealtimeState {
    const session = current(ownerId, id);
    if (session) return { ...session.state };
    const terminal = terminals.get(id);
    if (terminal?.ownerId === ownerId) return { ...terminal.state };
    throw notFound();
  }

  async function attachSideband(session: ActiveSession, callId: string) {
    const disconnected = () => close(session, "provider_unavailable");
    session.link = await provider.connect(
      callId,
      {
        onEvent: (event) => onEvent(session, event),
        onError: disconnected,
        onClose: disconnected,
      },
      session.controller.signal,
    );
    if (!valid(session)) {
      session.link.close();
      throw changed();
    }
    session.heartbeatDeadline = now() + heartbeatMs;
    publish(session, { phase: "listening" });
    nextResponse(session);
    scheduleGreeting(session);
  }

  async function completeSetup(session: ActiveSession) {
    session.connecting = false;
    if (session.closeReason) await settle(session);
    else schedule(session);
  }

  async function connect(session: ActiveSession, input: RealtimeStart) {
    const cancel = () => close(session, "ended");
    input.signal?.addEventListener("abort", cancel, { once: true });
    if (input.signal?.aborted) cancel();
    let detached = false;
    try {
      if (!valid(session)) throw changed();
      const { answer, callId } = await provider.create(input.offer, {
        instructions: input.instructions,
        signal: session.controller.signal,
      });
      session.lease.provider_call_id = callId;
      store.transaction(() =>
        store.run(
          "UPDATE realtime_voice_leases SET provider_call_id=? WHERE user_id=? AND id=?",
          [callId, input.ownerId, session.lease.id],
        ),
      );
      if (!valid(session)) throw changed();
      const sideband = attachSideband(session, callId);
      if (input.parallelSetup) {
        detached = true;
        // The answer can start ICE while the trusted server control link opens.
        // Only status can confirm that both sides are ready for conversation.
        void track(
          sideband
            .catch(() => {
              close(session, "provider_unavailable");
            })
            .finally(() => completeSetup(session)),
        );
        return {
          id: session.state.id,
          answer,
          state: { ...session.state },
          mediaReadySignal: true as const,
        };
      }
      await sideband;
      return { id: session.state.id, answer, state: { ...session.state } };
    } catch (error) {
      close(session, "provider_unavailable");
      throw error instanceof RealtimeError ? error : providerError(error);
    } finally {
      input.signal?.removeEventListener("abort", cancel);
      if (!detached) await completeSetup(session);
    }
  }

  async function start(input: RealtimeStart) {
    if (disposed || input.signal?.aborted) throw unavailable();
    if (!input.authorize()) throw changed();
    const lease = leaseFor(input.ownerId);
    if (lease) {
      const active = sessions.get(lease.id);
      if (active && valid(active)) throw busy();
      if (active) await settle(active);
      else await releaseOnce(lease, false);
    }
    if (disposed || input.signal?.aborted) throw unavailable();
    if (!input.authorize()) throw changed();
    const reserved = reserve(input.ownerId);
    const session: ActiveSession = {
      lease: reserved,
      state: {
        id: reserved.id,
        expiresAt: reserved.expires_at,
        phase: "connecting",
        userSpeaking: false,
        revision: 0,
        conversationId: input.conversationId,
      },
      controller: new AbortController(),
      connecting: true,
      heartbeatDeadline: reserved.expires_at,
      authorize: input.authorize,
      onTurn: input.onTurn,
      safetyReply: input.safetyReply,
      appActions: input.appActions,
      appActionResults: input.appActionResults,
      wellnessGoalNavigation: input.wellnessGoalNavigation,
      practiceHandoff: input.practiceHandoff,
      issued: new Map(),
      actionReplies: [],
      history: (input.history ?? []).slice(-20).map(({ role, content }) => ({
        role,
        content: content.slice(0, MAX_TRANSCRIPT),
      })),
      inputs: new Map(),
      ordered: [],
      greeting:
        input.greetingName === undefined
          ? undefined
          : { text: voiceGreeting(input.greetingName) },
      ignoredErrors: new Set(),
      listeners: new Set(),
    };
    sessions.set(reserved.id, session);
    schedule(session);
    return track(connect(session, input));
  }

  return {
    start,
    state,
    reportActionResult(
      ownerId: string,
      id: string,
      actionId: string,
      result: VoiceActionResult,
    ) {
      const session = current(ownerId, id);
      const issued = session?.issued.get(actionId);
      if (!session?.appActionResults || !issued) throw notFound();
      if (issued.completed) return;
      retainTurn(session, {
        ...issued.turn,
        assistantText: result.message,
        actionResult: true,
      });
      issued.completed = true;
      if (
        session.actionDraft?.kind === "proposal" &&
        session.actionDraft.action.id === actionId
      )
        session.actionDraft = undefined;
      session.history = [
        ...session.history,
        { role: "assistant", content: result.message },
      ].slice(-20) as History;
      publish(session, {
        ...(session.state.pendingActionId === actionId && {
          pendingActionId: undefined,
        }),
        ...(session.state.appAction?.id === actionId && {
          appAction: undefined,
        }),
      });
      session.actionReplies.push({ issued, result });
      nextResponse(session);
    },
    heartbeat(ownerId: string, id: string, ready = false) {
      const session = current(ownerId, id);
      if (!session) return state(ownerId, id);
      session.heartbeatDeadline = now() + heartbeatMs;
      schedule(session);
      if (ready && session.greeting) {
        session.greeting.ready = true;
        scheduleGreeting(session);
      }
      return { ...session.state };
    },
    subscribe(ownerId: string, id: string, listener: Listener) {
      const session = current(ownerId, id);
      if (!session) {
        listener(state(ownerId, id));
        return () => {};
      }
      if (session.listeners.size >= 8)
        throw new RealtimeError(
          429,
          "REALTIME_RATE_LIMITED",
          "Wait a moment before checking live voice again.",
        );
      session.listeners.add(listener);
      return () => {
        session.listeners.delete(listener);
      };
    },
    async end(ownerId: string, id: string) {
      const session = current(ownerId, id);
      if (session) await close(session, "ended");
      return state(ownerId, id);
    },
    recheckOwner(ownerId: string) {
      for (const session of sessions.values())
        if (session.lease.user_id === ownerId) valid(session);
    },
    closeOwner(
      ownerId: string,
      reason: RealtimeCloseReason = "authorization_changed",
    ) {
      for (const session of sessions.values())
        if (session.lease.user_id === ownerId) close(session, reason);
    },
    async dispose() {
      disposed = true;
      for (const session of sessions.values()) close(session, "shutdown");
      while (pending.size) await Promise.allSettled([...pending]);
      for (const terminal of terminals.values()) clearTimeout(terminal.timer);
      terminals.clear();
    },
  };
}
