import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Store } from "../src/database.js";
import {
  createRealtimeService,
  type RealtimeLimits,
  type RealtimeStart,
  type RealtimeTurn,
} from "../src/realtime.js";
import type {
  RealtimeProvider,
  RealtimeProviderEvent,
} from "../src/realtime-provider.js";

function users(store: Store) {
  for (const id of ["owner", "other", "third"])
    store.run(
      "INSERT INTO users (id,email,name,password,created_at) VALUES (?,?,?,?,?)",
      [id, id + "@example.test", "Synthetic", "fixture", "2026-01-01"],
    );
}

function fakeProvider() {
  const hangups: string[] = [];
  const sent: RealtimeProviderEvent[] = [];
  const connections: {
    callbacks: Parameters<RealtimeProvider["connect"]>[1];
    closed: boolean;
  }[] = [];
  let calls = 0;
  let failHangup = false;
  const provider: RealtimeProvider = {
    async create() {
      return { answer: "synthetic answer", callId: "rtc_" + ++calls };
    },
    async connect(_id, callbacks) {
      const connection = { callbacks, closed: false };
      connections.push(connection);
      return {
        send(event) {
          if (connection.closed) return false;
          sent.push(event);
          return true;
        },
        close() {
          connection.closed = true;
        },
      };
    },
    async hangup(id) {
      hangups.push(id);
      if (failHangup) throw new Error("synthetic hangup failure");
    },
  };
  return {
    provider,
    sent,
    hangups,
    connections,
    emit(event: RealtimeProviderEvent, connection = 0) {
      connections[connection].callbacks.onEvent(event);
    },
    failHangup() {
      failHangup = true;
    },
  };
}

const input = (overrides: Partial<RealtimeStart> = {}): RealtimeStart => ({
  ownerId: "owner",
  offer: "synthetic offer",
  instructions: "Synthetic Solace safety prompt.",
  authorize: () => true,
  onTurn: () => {},
  ...overrides,
});

function ready(
  emit: ReturnType<typeof fakeProvider>["emit"],
  id: string,
  transcript: string,
) {
  emit({ type: "input_audio_buffer.committed", item_id: id });
  emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: id,
    transcript,
  });
}

function response(
  fake: ReturnType<typeof fakeProvider>,
  id: string,
  transcript: string,
  complete = true,
) {
  const request = fake.sent.findLast(({ type }) => type === "response.create");
  assert.ok(request);
  const metadata = (request.response as { metadata: object }).metadata;
  fake.emit({ type: "response.created", response: { id, metadata } });
  fake.emit({ type: "output_audio_buffer.started", response_id: id });
  if (complete) {
    fake.emit({
      type: "response.done",
      response: {
        id,
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_audio", transcript }],
          },
        ],
      },
    });
  }
}

async function fixture(limits?: RealtimeLimits) {
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  let time = Date.parse("2026-01-01T12:00:00Z");
  const service = createRealtimeService({
    store,
    provider: fake.provider,
    limits,
    now: () => time,
  });
  return {
    store,
    fake,
    service,
    advance(ms: number) {
      time += ms;
    },
    async close() {
      await service.dispose();
      store.close();
    },
  };
}

test("greeting waits for readiness, uses only the first name and runs once per session", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { service, fake, close } = await fixture();
  const turns: RealtimeTurn[] = [];
  try {
    const session = await service.start(
      input({
        greetingName: "  Áda Example  ",
        onTurn: (turn) => {
          turns.push(turn);
        },
      }),
    );
    const greetingRequests = () =>
      fake.sent.filter(({ type }) => type === "response.create");
    service.heartbeat("owner", session.id);
    mock.timers.tick(500);
    assert.deepEqual(greetingRequests(), []);
    service.heartbeat("owner", session.id, true);
    service.heartbeat("owner", session.id, true);
    assert.deepEqual(greetingRequests(), []);
    mock.timers.tick(500);
    assert.equal(greetingRequests().length, 1);
    const greeting = greetingRequests()[0];
    const parameters = greeting.response as Record<string, unknown>;
    assert.equal(greeting.event_id, `greeting_${session.id}`);
    assert.deepEqual(parameters.metadata, {
      solace_turn_id: greeting.event_id,
    });
    assert.deepEqual(parameters.output_modalities, ["audio"]);
    assert.equal(parameters.conversation, "none");
    assert.equal(parameters.tool_choice, "none");
    assert.match(
      String(parameters.instructions),
      /"Hello, Áda\. What brings you here today\?"/,
    );
    assert.doesNotMatch(String(parameters.instructions), /Example/);
    assert.equal(service.state("owner", session.id).phase, "listening");
    response(fake, "resp_greeting", "Hello, Áda. What brings you here today?");
    assert.equal(service.state("owner", session.id).phase, "speaking");
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "resp_greeting",
    });
    assert.equal(service.state("owner", session.id).phase, "listening");
    assert.deepEqual(turns, [], "opening audio is not saved as a chat turn");
    service.heartbeat("owner", session.id, true);
    mock.timers.tick(500);
    assert.equal(greetingRequests().length, 1);
    await service.end("owner", session.id);

    const next = await service.start(
      input({ greetingName: "private@example.test" }),
    );
    service.heartbeat("owner", next.id, true);
    mock.timers.tick(500);
    assert.equal(greetingRequests().length, 2);
    assert.notEqual(greetingRequests()[1].event_id, greeting.event_id);
    assert.match(
      String(
        (greetingRequests()[1].response as Record<string, unknown>)
          .instructions,
      ),
      /"Hello\. What brings you here today\?"/,
    );
  } finally {
    await close();
  }
});

test("speech before readiness or during the quiet window suppresses the greeting", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  for (const signalReadyFirst of [false, true]) {
    const { service, fake, close } = await fixture();
    try {
      const session = await service.start(input({ greetingName: "Fixture" }));
      if (signalReadyFirst) service.heartbeat("owner", session.id, true);
      fake.emit({ type: "input_audio_buffer.speech_started" });
      fake.emit({ type: "input_audio_buffer.speech_stopped" });
      service.heartbeat("owner", session.id, true);
      mock.timers.tick(500);
      assert.deepEqual(fake.sent, []);
      ready(fake.emit, "item_early", "I spoke before the opening greeting.");
      assert.equal(fake.sent[0].type, "response.create");
      assert.notEqual(fake.sent[0].event_id, `greeting_${session.id}`);
    } finally {
      await close();
    }
  }
});

test("speech arriving before the greeting response ID still cancels its playback", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { service, fake, close } = await fixture();
  try {
    const session = await service.start(input({ greetingName: "Fixture" }));
    service.heartbeat("owner", session.id, true);
    mock.timers.tick(500);
    fake.emit({ type: "input_audio_buffer.speech_started" });
    response(fake, "resp_interrupt_greeting", "", false);
    assert.deepEqual(
      fake.sent.slice(1).map(({ type }) => type),
      ["response.cancel", "output_audio_buffer.clear"],
    );
    assert.equal(service.state("owner", session.id).phase, "listening");
    fake.emit({
      type: "response.done",
      response: { id: "resp_interrupt_greeting", status: "cancelled" },
    });
    fake.emit({ type: "input_audio_buffer.speech_stopped" });
    ready(fake.emit, "item_barge", "I'd like to talk about my day.");
    assert.equal(fake.sent.at(-1)?.type, "response.create");
    assert.equal(service.state("owner", session.id).phase, "thinking");
  } finally {
    await close();
  }
});

test("greeting rejection leaves voice usable and ending clears a pending greeting", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const { service, fake, close } = await fixture();
  try {
    const session = await service.start(input({ greetingName: "Solace user" }));
    service.heartbeat("owner", session.id, true);
    mock.timers.tick(500);
    assert.match(
      String((fake.sent[0].response as Record<string, unknown>).instructions),
      /"Hello\. What brings you here today\?"/,
    );
    fake.emit({ type: "error", error: { event_id: fake.sent[0].event_id } });
    assert.equal(service.state("owner", session.id).phase, "listening");
    service.heartbeat("owner", session.id, true);
    mock.timers.tick(500);
    assert.equal(fake.sent.length, 1);
    await service.end("owner", session.id);

    const next = await service.start(input({ greetingName: "Fixture" }));
    service.heartbeat("owner", next.id, true);
    await service.end("owner", next.id);
    mock.timers.tick(500);
    assert.equal(
      fake.sent.filter(({ type }) => type === "response.create").length,
      1,
    );
  } finally {
    await close();
  }
});

test("parallel setup returns SDP early and latches media readiness until sideband attaches", async ({
  mock,
}) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  const allowAttach = Promise.withResolvers<void>();
  const service = createRealtimeService({
    store,
    provider: {
      ...fake.provider,
      async connect(...args) {
        await allowAttach.promise;
        return fake.provider.connect(...args);
      },
    },
  });
  try {
    const session = await service.start(
      input({ parallelSetup: true, greetingName: "Fixture" }),
    );
    assert.equal(session.answer, "synthetic answer");
    assert.equal(session.mediaReadySignal, true);
    assert.equal(session.state.phase, "connecting");
    assert.equal(
      service.heartbeat("owner", session.id, true).phase,
      "connecting",
    );
    mock.timers.tick(500);
    assert.deepEqual(fake.sent, []);
    const attached = Promise.withResolvers<void>();
    service.subscribe("owner", session.id, ({ phase }) => {
      if (phase === "listening") attached.resolve();
    });
    allowAttach.resolve();
    await attached.promise;
    mock.timers.tick(500);
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].event_id, `greeting_${session.id}`);
  } finally {
    allowAttach.resolve();
    await service.dispose();
    store.close();
  }
});

test("parallel sideband failure tears down its call before admitting a new session", async () => {
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  const firstAttach = Promise.withResolvers<void>();
  const service = createRealtimeService({
    store,
    provider: {
      ...fake.provider,
      async connect(...args) {
        if (args[0] === "rtc_1") await firstAttach.promise;
        return fake.provider.connect(...args);
      },
    },
  });
  try {
    const first = await service.start(
      input({ parallelSetup: true, greetingName: "Fixture" }),
    );
    service.heartbeat("owner", first.id, true);
    await assert.rejects(service.start(input()), { code: "REALTIME_BUSY" });
    const disconnected = Promise.withResolvers<void>();
    service.subscribe("owner", first.id, ({ phase }) => {
      if (phase === "disconnected") disconnected.resolve();
    });
    firstAttach.reject(new Error("synthetic sideband connection failure"));
    await disconnected.promise;
    assert.equal(
      service.state("owner", first.id).reason,
      "provider_unavailable",
    );
    const retry = await service.start(input());
    assert.notEqual(retry.id, first.id);
    assert.equal(retry.state.phase, "listening");
    assert.deepEqual(fake.hangups, ["rtc_1"]);
    assert.deepEqual(fake.sent, []);
  } finally {
    firstAttach.resolve();
    await service.dispose();
    store.close();
  }
});

test("speech arriving during sideband attachment is held until the control link is ready", async () => {
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  const allowAttach = Promise.withResolvers<void>();
  const service = createRealtimeService({
    store,
    provider: {
      ...fake.provider,
      async connect(...args) {
        const link = await fake.provider.connect(...args);
        await allowAttach.promise;
        return link;
      },
    },
  });
  try {
    const session = await service.start(
      input({ parallelSetup: true, greetingName: "Fixture" }),
    );
    service.heartbeat("owner", session.id, true);
    fake.emit({ type: "input_audio_buffer.speech_started" });
    assert.equal(service.state("owner", session.id).phase, "connecting");
    fake.emit({ type: "input_audio_buffer.speech_stopped" });
    ready(
      fake.emit,
      "item_pre_attach",
      "I spoke while the control link was connecting.",
    );
    assert.deepEqual(fake.sent, []);
    const thinking = Promise.withResolvers<void>();
    service.subscribe("owner", session.id, ({ phase }) => {
      if (phase === "thinking") thinking.resolve();
    });
    allowAttach.resolve();
    await thinking.promise;
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].type, "response.create");
    assert.notEqual(fake.sent[0].event_id, `greeting_${session.id}`);
  } finally {
    allowAttach.resolve();
    await service.dispose();
    store.close();
  }
});

test("ending parallel setup hangs up the known call and closes any late sideband link", async () => {
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  const allowAttach = Promise.withResolvers<void>();
  const allowHangup = Promise.withResolvers<void>();
  const hangupStarted = Promise.withResolvers<void>();
  let firstSignal: AbortSignal | undefined;
  const service = createRealtimeService({
    store,
    provider: {
      ...fake.provider,
      async connect(...args) {
        if (args[0] === "rtc_1") {
          firstSignal = args[2];
          await allowAttach.promise;
        }
        return fake.provider.connect(...args);
      },
      async hangup(id) {
        if (id === "rtc_1") {
          hangupStarted.resolve();
          await allowHangup.promise;
        }
        await fake.provider.hangup(id);
      },
    },
  });
  try {
    const first = await service.start(
      input({ parallelSetup: true, greetingName: "Fixture" }),
    );
    service.heartbeat("owner", first.id, true);
    const ending = service.end("owner", first.id);
    await hangupStarted.promise;
    assert.equal(firstSignal?.aborted, true);
    const retrying = service.start(input());
    assert.equal(service.state("owner", first.id).reason, "ended");
    allowHangup.resolve();
    assert.equal((await ending).phase, "disconnected");
    assert.equal((await retrying).state.phase, "listening");
    allowAttach.resolve();
    await service.dispose();
    assert.equal(fake.hangups.filter((id) => id === "rtc_1").length, 1);
    assert.equal(fake.connections.length, 2);
    assert.ok(fake.connections.every((connection) => connection.closed));
    assert.equal(
      fake.sent.filter(({ type }) => type === "response.create").length,
      0,
    );
  } finally {
    allowHangup.resolve();
    allowAttach.resolve();
    await service.dispose();
    store.close();
  }
});

test("a voiced one-minute offer saves its provenance and waits for a drained explicit approval", async () => {
  const { service, fake, close } = await fixture();
  const turns: RealtimeTurn[] = [];
  try {
    const session = await service.start(
      input({
        appActions: true,
        appActionResults: true,
        practiceHandoff: true,
        onTurn: (turn) => {
          turns.push(turn);
          return { conversationId: "practice-thread" };
        },
      }),
    );
    const state = () => service.state("owner", session.id);
    ready(
      fake.emit,
      "practice_input",
      "Start a one-minute breathing exercise.",
    );
    response(
      fake,
      "practice_offer",
      "Would you like to try this one-minute breathing reset?",
    );
    assert.equal(state().appAction, undefined);
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "practice_offer",
    });
    const offer = state().appAction;
    assert.deepEqual(offer, {
      id: offer?.id,
      kind: "practice-start",
      practice: "breathing",
      minutes: 1,
    });
    assert.equal(state().pendingActionId, offer?.id);
    assert.equal(state().conversationId, "practice-thread");
    assert.deepEqual(turns.at(-1)?.appAction, offer);
    fake.emit({ type: "input_audio_buffer.speech_started" });
    fake.emit({ type: "input_audio_buffer.speech_stopped" });
    ready(fake.emit, "practice_confirmation", "Yes.");
    response(fake, "practice_ack", "I’ll ask Solace to open the practice.");
    assert.equal(state().appAction, undefined);
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "practice_ack",
    });
    assert.deepEqual(state().appAction, {
      id: state().appAction?.id,
      kind: "confirm",
      targetId: offer?.id,
    });
    assert.equal(state().pendingActionId, offer?.id);
    assert.equal(
      (await service.end("owner", session.id)).phase,
      "disconnected",
    );
    assert.equal(fake.connections[0].closed, true);
  } finally {
    await close();
  }
});

test("live app actions publish only after a completed tool turn and drained acknowledgement", async () => {
  const { service, fake, close } = await fixture();
  try {
    const session = await service.start(
      input({ appActions: true, appActionResults: true }),
    );
    const liveState = () => service.state("owner", session.id);
    const actionEvents: string[] = [];
    service.subscribe("owner", session.id, (state) => {
      if (state.appAction) actionEvents.push(state.appAction.id);
    });
    const selectAction = (
      itemId: string,
      responseId: string,
      interrupt = false,
    ) => {
      ready(fake.emit, itemId, "Please open the journal library for me");
      const response = fake.sent.findLast(
        ({ type }) => type === "response.create",
      )?.response as {
        metadata: { solace_turn_id: string };
        output_modalities: string[];
        tools: { name: string }[];
      };
      assert.deepEqual(response.output_modalities, ["text"]);
      assert.equal(response.tools[0].name, "solace_app_action");
      fake.emit({
        type: "response.created",
        response: { id: responseId, metadata: response.metadata },
      });
      if (interrupt) fake.emit({ type: "input_audio_buffer.speech_started" });
      const call = {
        type: "function_call",
        name: "solace_app_action",
        call_id: "call_test",
        status: "completed",
        arguments: JSON.stringify({
          action: { kind: "navigate", destination: "journal" },
        }),
      };
      fake.emit({
        ...call,
        type: "response.function_call_arguments.done",
        response_id: responseId,
      });
      assert.equal(liveState().appAction, undefined);
      fake.emit({
        type: "response.done",
        response: { id: responseId, status: "completed", output: [call] },
      });
      assert.equal(liveState().appAction, undefined);
      return response.metadata.solace_turn_id;
    };

    selectAction("user_interrupted", "select_interrupted", true);
    assert.equal(
      fake.sent.filter(({ type }) => type === "response.create").length,
      1,
    );
    fake.emit({ type: "input_audio_buffer.speech_stopped" });

    selectAction("user_ack_interrupted", "select_ack_interrupted");
    response(fake, "ack_interrupted", "I’ll pass that to the app.");
    fake.emit({ type: "input_audio_buffer.speech_started" });
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "ack_interrupted",
    });
    assert.equal(liveState().appAction, undefined);
    fake.emit({ type: "input_audio_buffer.speech_stopped" });

    const actionId = selectAction("user_success", "select_success");
    response(fake, "ack_success", "I’ll pass that to the app.");
    assert.equal(liveState().appAction, undefined);
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "ack_success",
    });
    assert.deepEqual(liveState().appAction, {
      id: actionId,
      kind: "navigate",
      destination: "journal",
    });
    assert.throws(() => service.state("other", session.id), {
      code: "REALTIME_NOT_FOUND",
    });
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "ack_success",
    });
    assert.deepEqual(actionEvents, [actionId]);
    fake.emit({ type: "input_audio_buffer.speech_started" });
    assert.equal(liveState().appAction, undefined);
    fake.emit({ type: "input_audio_buffer.speech_stopped" });
    ready(fake.emit, "user_theme", "Switch the app’s mode to light mode.");
    const selection = fake.sent.findLast(
      ({ type }) => type === "response.create",
    )?.response as {
      metadata: { solace_turn_id: string };
      tools: { name: string }[];
    };
    assert.equal(selection.tools[0].name, "solace_app_action");
    fake.emit({
      type: "response.created",
      response: { id: "select_theme", metadata: selection.metadata },
    });
    const themeCall = {
      type: "function_call",
      name: "solace_app_action",
      call_id: "call_theme",
      arguments: JSON.stringify({ action: { kind: "theme", mode: "light" } }),
    };
    fake.emit({
      type: "response.done",
      response: {
        id: "select_theme",
        status: "completed",
        output: [themeCall],
      },
    });
    response(
      fake,
      "theme_preflight",
      "I’ll send that appearance change to the app.",
    );
    fake.emit({
      type: "output_audio_buffer.stopped",
      response_id: "theme_preflight",
    });
    const theme = liveState().appAction;
    assert.equal(theme?.kind, "theme");
    const failed = {
      ok: false,
      message: "The appearance preference could not be saved.",
    };
    service.reportActionResult("owner", session.id, theme!.id, failed);
    const resultReply = fake.sent.at(-1)?.response as {
      instructions: string;
      input: unknown[];
      tool_choice: string;
    };
    assert.match(resultReply.instructions, /could not be saved/);
    assert.equal(resultReply.tool_choice, "none");
    assert.deepEqual(resultReply.input, [
      themeCall,
      {
        type: "function_call_output",
        call_id: "call_theme",
        output: JSON.stringify(failed),
      },
    ]);
    const eventsAfterResult = fake.sent.length;
    service.reportActionResult("owner", session.id, theme!.id, failed);
    assert.equal(fake.sent.length, eventsAfterResult);
    await service.end("owner", session.id);
    assert.equal(liveState().appAction, undefined);
  } finally {
    await close();
  }
});

test("orders finalized transcripts, scopes generated context and only saves drained assistant audio", async () => {
  const f = await fixture();
  try {
    const writes: RealtimeTurn[] = [];
    const start = await f.service.start(
      input({
        history: [{ role: "assistant", content: "From saved history." }],
        onTurn: (turn) => {
          writes.push(turn);
          return { conversationId: "saved-conversation" };
        },
      }),
    );
    assert.equal(start.answer, "synthetic answer");
    assert.equal(start.state.phase, "listening");
    const revisions: number[] = [];
    const unsubscribe = f.service.subscribe("owner", start.id, (state) =>
      revisions.push(state.revision),
    );
    const { emit } = f.fake;
    emit({ type: "input_audio_buffer.committed", item_id: "first" });
    ready(emit, "second", "Later phrase");
    assert.equal(f.fake.sent.length, 0);
    ready(emit, "first", "Earlier phrase");
    ready(emit, "first", "Duplicate phrase");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].userText, "Earlier phrase");
    assert.deepEqual(
      (f.fake.sent[0].response as { conversation: string; input: object[] })
        .input,
      [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "From saved history." }],
        },
        { type: "item_reference", id: "first" },
      ],
    );
    assert.equal(
      (f.fake.sent[0].response as { conversation: string }).conversation,
      "none",
    );
    assert.equal(
      f.service.state("owner", start.id).conversationId,
      "saved-conversation",
    );
    response(f.fake, "resp_first", "An audible reply.");
    assert.equal(f.service.state("owner", start.id).phase, "speaking");
    assert.equal(writes.length, 1);
    emit({ type: "output_audio_buffer.stopped", response_id: "resp_first" });
    emit({ type: "output_audio_buffer.stopped", response_id: "resp_first" });
    assert.equal(writes.length, 3);
    assert.deepEqual(writes[1], {
      ...writes[0],
      assistantText: "An audible reply.",
    });
    assert.equal(writes[2].userText, "Later phrase");
    assert.deepEqual(
      revisions,
      [...new Set(revisions)].sort((a, b) => a - b),
    );
    assert.equal(
      f.service.heartbeat("owner", start.id).revision,
      revisions.at(-1),
    );
    unsubscribe();
  } finally {
    await f.close();
  }
});

test("barge-in cancels and clears the response, and urgent speech terminates with local support", async () => {
  const f = await fixture();
  try {
    const writes: RealtimeTurn[] = [];
    const start = await f.service.start(
      input({
        onTurn: (turn) => {
          writes.push(turn);
        },
        safetyReply: (text) =>
          text.includes("urgent") ? "Talk with a trusted person." : undefined,
      }),
    );
    const { emit, sent } = f.fake;
    ready(emit, "one", "I spoke normally.");
    response(f.fake, "resp_one", "This was interrupted.", false);
    emit({ type: "input_audio_buffer.speech_started", item_id: "two" });
    emit({ type: "input_audio_buffer.speech_started", item_id: "two" });
    assert.equal(f.service.state("owner", start.id).userSpeaking, true);
    assert.deepEqual(
      sent.map(({ type }) => type),
      ["response.create", "response.cancel", "output_audio_buffer.clear"],
    );
    emit({
      type: "response.done",
      response: { id: "resp_one", status: "cancelled" },
    });
    emit({ type: "output_audio_buffer.stopped", response_id: "resp_one" });
    emit({ type: "input_audio_buffer.speech_stopped", item_id: "two" });
    ready(emit, "two", "This is urgent.");
    assert.equal(
      sent.filter(({ type }) => type === "response.create").length,
      1,
    );
    assert.deepEqual(
      writes.map(({ userText, assistantText, support }) => ({
        userText,
        assistantText,
        support,
      })),
      [
        {
          userText: "I spoke normally.",
          assistantText: undefined,
          support: undefined,
        },
        {
          userText: "This is urgent.",
          assistantText: "Talk with a trusted person.",
          support: true,
        },
      ],
    );
    assert.equal(f.service.state("owner", start.id).phase, "support");
    assert.equal(
      f.service.state("owner", start.id).support,
      "Talk with a trusted person.",
    );
    assert.equal(f.fake.connections[0].closed, true);
    assert.deepEqual(
      sent.find(({ type }) => type === "session.update")?.session,
      {
        type: "realtime",
        audio: { input: { turn_detection: null } },
      },
    );
    assert.equal(
      sent.some(({ type }) => type === "input_audio_buffer.clear"),
      true,
    );
  } finally {
    await f.close();
  }
});

test("scopes sessions to the authenticated owner and closes on stale authorization or heartbeat", async () => {
  const f = await fixture();
  try {
    let authorized = true;
    const first = await f.service.start(input({ authorize: () => authorized }));
    assert.throws(() => f.service.heartbeat("other", first.id), {
      code: "REALTIME_NOT_FOUND",
    });
    await assert.rejects(f.service.end("other", first.id), {
      code: "REALTIME_NOT_FOUND",
    });
    await assert.rejects(f.service.start(input()), { code: "REALTIME_BUSY" });
    authorized = false;
    assert.equal(
      f.service.heartbeat("owner", first.id).reason,
      "authorization_changed",
    );
    assert.equal(f.fake.connections[0].closed, true);
    const second = await f.service.start(input());
    f.advance(19_000);
    assert.equal(f.service.heartbeat("owner", second.id).phase, "listening");
    f.advance(21_000);
    assert.equal(
      f.service.heartbeat("owner", second.id).reason,
      "heartbeat_timeout",
    );
    assert.equal(f.fake.connections[1].closed, true);
  } finally {
    await f.close();
  }
});

test("revocation during negotiation hangs up and prevents late provider events", async () => {
  const store = await Store.open(":memory:");
  users(store);
  const fake = fakeProvider();
  const started = Promise.withResolvers<AbortSignal | undefined>();
  const created = Promise.withResolvers<{ answer: string; callId: string }>();
  const provider = {
    ...fake.provider,
    create: async (
      _offer: string,
      options: { instructions: string; signal?: AbortSignal },
    ) => {
      started.resolve(options.signal);
      return created.promise;
    },
  };
  const service = createRealtimeService({ store, provider });
  try {
    const begin = service.start(input());
    const failed = assert.rejects(begin, { code: "REALTIME_AUTH_CHANGED" });
    const signal = await started.promise;
    assert.ok(signal);
    await assert.rejects(service.start(input()), { code: "REALTIME_BUSY" });
    service.closeOwner("owner");
    assert.equal(signal.aborted, true);
    created.resolve({ answer: "late answer", callId: "rtc_late" });
    await failed;
    assert.deepEqual(fake.hangups, ["rtc_late"]);
    assert.equal(fake.connections.length, 0);
  } finally {
    await service.dispose();
    store.close();
  }
});

test("an unexpected response closes the media before any conversation write", async () => {
  const f = await fixture();
  try {
    const start = await f.service.start(
      input({
        onTurn: () =>
          assert.fail(
            "A response without an approved transcript must not be stored",
          ),
      }),
    );
    f.fake.emit({
      type: "response.created",
      response: { id: "resp_unrequested" },
    });
    assert.equal(
      f.service.state("owner", start.id).reason,
      "provider_unavailable",
    );
    assert.equal(f.fake.connections[0].closed, true);
  } finally {
    await f.close();
  }
});

test("reserves per-owner and global budget across UTC days and limits stale calls", async () => {
  const f = await fixture({
    sessionSeconds: 10,
    dailySeconds: 20,
    globalDailySeconds: 25,
    heartbeatSeconds: 20,
  });
  try {
    const first = await f.service.start(input());
    const other = await f.service.start(input({ ownerId: "other" }));
    assert.equal(first.state.expiresAt, other.state.expiresAt);
    f.advance(10_000);
    assert.equal(f.service.heartbeat("owner", first.id).reason, "expired");
    assert.equal(f.service.heartbeat("other", other.id).reason, "expired");
    const last = await f.service.start(input());
    assert.equal(last.state.expiresAt, first.state.expiresAt + 5_000);
    await f.service.end("owner", last.id);
    await assert.rejects(f.service.start(input({ ownerId: "third" })), {
      code: "REALTIME_DAILY_LIMIT",
    });
    f.advance(86_400_000);
    assert.equal(
      (await f.service.start(input({ ownerId: "third" }))).state.phase,
      "listening",
    );
  } finally {
    await f.close();
  }
});

test("a storage failure does not prevent terminating an active provider call", async () => {
  const f = await fixture();
  const persist = f.store.persist.bind(f.store);
  try {
    const call = await f.service.start(input());
    f.store.persist = () => {
      throw new Error("Synthetic write failure");
    };
    assert.equal((await f.service.end("owner", call.id)).phase, "disconnected");
    assert.equal(f.fake.connections[0].closed, true);
    assert.deepEqual(f.fake.hangups, ["rtc_1"]);
    await f.service.end("owner", call.id);
    await assert.rejects(f.service.start(input()));
    assert.deepEqual(f.fake.hangups, ["rtc_1"]);
    assert.equal(
      f.store.one("SELECT id FROM realtime_voice_leases WHERE id=?", [call.id])
        ?.id,
      call.id,
      "a write failure does not refund the reservation",
    );
  } finally {
    f.store.persist = persist;
    await f.close();
  }
});

test("retains a failed provider hangup reservation and bounds repeat cleanup attempts", async () => {
  const f = await fixture();
  try {
    const start = await f.service.start(input());
    f.fake.failHangup();
    await f.service.end("owner", start.id);
    assert.deepEqual(f.fake.hangups, ["rtc_1", "rtc_1"]);
    await assert.rejects(f.service.start(input()), { code: "REALTIME_BUSY" });
    await assert.rejects(f.service.start(input()), { code: "REALTIME_BUSY" });
    assert.deepEqual(f.fake.hangups, ["rtc_1", "rtc_1"]);
    assert.equal(
      f.store.one<{ used_ms: number }>(
        "SELECT used_ms FROM realtime_voice_usage WHERE user_id='owner'",
      )?.used_ms,
      300_000,
    );
  } finally {
    await f.close();
  }
});

test("restart revokes upstream lease, retains reservation, and user deletion removes owned metadata", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-realtime-"));
  const dbPath = join(directory, "initial.sqlite");
  const reopenedPath = join(directory, "reopened.sqlite");
  const time = Date.parse("2026-01-01T12:00:00Z");
  try {
    const store = await Store.open(dbPath);
    users(store);
    const fake = fakeProvider();
    const service = createRealtimeService({
      store,
      provider: fake.provider,
      now: () => time,
    });
    try {
      await service.start(input());
      copyFileSync(dbPath, reopenedPath);
    } finally {
      await service.dispose();
      store.close();
    }
    const reopened = await Store.open(reopenedPath);
    const recovery = fakeProvider();
    const restored = createRealtimeService({
      store: reopened,
      provider: recovery.provider,
      now: () => time + 1_000,
      limits: { dailySeconds: 300 },
    });
    try {
      await assert.rejects(restored.start(input()), {
        code: "REALTIME_DAILY_LIMIT",
      });
      assert.deepEqual(recovery.hangups, ["rtc_1"]);
      assert.equal(
        reopened.one(
          "SELECT id FROM realtime_voice_leases WHERE user_id='owner'",
        ),
        undefined,
      );
      reopened.transaction(() =>
        reopened.run("DELETE FROM users WHERE id='owner'"),
      );
      assert.equal(
        reopened.one(
          "SELECT used_ms FROM realtime_voice_usage WHERE user_id='owner'",
        ),
        undefined,
      );
      assert.deepEqual(
        reopened.one("SELECT used_ms FROM realtime_voice_totals"),
        { used_ms: 300_000 },
      );
    } finally {
      await restored.dispose();
      reopened.close();
    }
  } finally {
    for (const file of [
      dbPath,
      reopenedPath,
      dbPath + ".tmp",
      reopenedPath + ".tmp",
    ])
      rmSync(file, { force: true });
    rmdirSync(directory);
  }
});
