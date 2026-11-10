import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import {
  appActionCapabilityHeader,
  appActionCapabilityVersion,
} from "../src/companion-app-action.js";
import type {
  RealtimeProvider,
  RealtimeProviderEvent,
} from "../src/realtime-provider.js";

const offer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
const offline = {
  mode: "offline",
  model: "fixture",
  baseUrl: "https://api.openai.com/v1",
} as const;

test("Realtime routes scope voice and transcripts to the authenticated conversation owner", async () => {
  const store = await Store.open(":memory:");
  let events: Parameters<RealtimeProvider["connect"]>[1] | undefined;
  let hangs = 0;
  const sent: RealtimeProviderEvent[] = [];
  const fake: RealtimeProvider = {
    async create(_offer, config) {
      assert.match(config.instructions, /AI wellness companion/);
      return { answer: offer, callId: "rtc_fixture" };
    },
    async connect(_id, callbacks) {
      events = callbacks;
      return {
        send(event) {
          sent.push(event);
          return true;
        },
        close() {},
      };
    },
    async hangup() {
      hangs += 1;
    },
  };
  const app = createApp({
    store,
    ai: offline,
    realtimeProvider: fake,
    rateLimits: false,
  });
  const client = request(app);
  const createUser = async (name: string) => {
    const { body } = await client
      .post("/api/auth/register")
      .send({
        name,
        email: name.toLowerCase().replace(/\s+/g, "-") + "@solace.test",
        password: "fixture-only-password",
      })
      .expect(201);
    return { Authorization: "Bearer " + body.token };
  };
  const emit = (event: RealtimeProviderEvent) => events!.onEvent(event);
  const speech = (id: string, transcript: string) => {
    emit({ type: "input_audio_buffer.speech_started", item_id: id });
    emit({ type: "input_audio_buffer.speech_stopped", item_id: id });
    emit({ type: "input_audio_buffer.committed", item_id: id });
    emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: id,
      transcript,
    });
  };
  try {
    const owner = await createUser("Ada Example");
    const other = await createUser("other");
    await client.post("/api/voice/realtime").send({ offer }).expect(401);
    const started = await client
      .post("/api/voice/realtime")
      .set(owner)
      .send({ offer })
      .expect(201);
    const id = started.body.id;
    const base = "/api/voice/realtime/" + id;
    await client
      .post(base + "/status")
      .set(other)
      .send({ ready: true })
      .expect(404);
    await client
      .post(base + "/end")
      .set(other)
      .send({})
      .expect(404);
    await client
      .post("/api/voice/realtime")
      .set(owner)
      .send({ offer })
      .expect(409);
    speech("item_1", "A synthetic morning walk.");
    assert.equal(sent.length, 1);
    const metadata = (sent[0].response as { metadata: unknown }).metadata;
    emit({ type: "response.created", response: { id: "resp_1", metadata } });
    emit({ type: "output_audio_buffer.started", response_id: "resp_1" });
    const done = {
      type: "response.done",
      response: {
        id: "resp_1",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              { type: "output_audio", transcript: "A synthetic voice reply." },
            ],
          },
        ],
      },
    };
    emit(done);
    emit({ type: "output_audio_buffer.stopped", response_id: "resp_1" });
    emit(done);
    const saved = await client
      .post(base + "/status")
      .set(owner)
      .send({})
      .expect(200);
    const conversationId = saved.body.conversationId;
    assert.equal(saved.body.phase, "listening");
    const loaded = await client.get("/api/state").set(owner).expect(200);
    assert.deepEqual(
      loaded.body.data.conversations[0].messages.map(
        ({ role, content }: { role: string; content: string }) => [
          role,
          content,
        ],
      ),
      [
        ["user", "A synthetic morning walk."],
        ["assistant", "A synthetic voice reply."],
      ],
    );
    assert.equal(
      (await client.get("/api/state").set(other).expect(200)).body.data
        .conversations.length,
      0,
    );
    await client
      .post("/api/voice/realtime")
      .set(other)
      .send({ offer, conversationId })
      .expect(404);
    await client
      .post(base + "/end")
      .set(owner)
      .send({})
      .expect(200);
    await client
      .post(base + "/end")
      .set(owner)
      .send({})
      .expect(200);
    assert.equal(hangs, 1);

    const next = await client
      .post("/api/voice/realtime")
      .set(owner)
      .send({ offer, conversationId })
      .expect(201);
    speech("item_2", "I want to kill myself.");
    const support = await client
      .post("/api/voice/realtime/" + next.body.id + "/status")
      .set(owner)
      .send({})
      .expect(200);
    assert.equal(support.body.phase, "support");
    assert.equal(
      sent.filter(({ type }) => type === "response.create").length,
      1,
      "local support bypasses provider generation",
    );
    const withSupport = await client.get("/api/state").set(owner).expect(200);
    assert.equal(
      withSupport.body.data.conversations[0].messages.at(-1).support,
      true,
    );
    await client
      .patch("/api/auth/me")
      .set(owner)
      .send({ personalization: true })
      .expect(200);
    const privateCall = await client
      .post("/api/voice/realtime")
      .set(owner)
      .set(appActionCapabilityHeader, "1")
      .send({ offer, conversationId })
      .expect(201);
    speech("item_action", "Please open the journal library for me.");
    const actionTurn = sent.findLast(({ type }) => type === "response.create")
      ?.response as {
      tools?: { name: string }[];
    };
    assert.equal(actionTurn.tools?.[0].name, "solace_app_action");
    await client
      .patch("/api/auth/me")
      .set(owner)
      .send({ personalization: false })
      .expect(200);
    const revoked = await client
      .post("/api/voice/realtime/" + privateCall.body.id + "/status")
      .set(owner)
      .send({})
      .expect(200);
    assert.equal(revoked.body.reason, "authorization_changed");
    assert.equal(
      hangs,
      3,
      "revocation explicitly hangs up after the database write",
    );

    const agentCall = await client
      .post("/api/voice/realtime")
      .set(owner)
      .set(appActionCapabilityHeader, appActionCapabilityVersion)
      .send({ offer, conversationId })
      .expect(201);
    const actionBase = "/api/voice/realtime/" + agentCall.body.id;
    const readState = async () =>
      (
        await client
          .post(actionBase + "/status")
          .set(owner)
          .send({})
          .expect(200)
      ).body;
    const drain = (responseId: string) => {
      const request = sent.findLast(({ type }) => type === "response.create")!;
      const metadata = (request.response as { metadata: unknown }).metadata;
      emit({
        type: "response.created",
        response: { id: responseId, metadata },
      });
      emit({ type: "output_audio_buffer.started", response_id: responseId });
      emit({
        type: "response.done",
        response: { id: responseId, status: "completed" },
      });
      emit({ type: "output_audio_buffer.stopped", response_id: responseId });
    };
    speech("new_habit", "Create a habit for walking.");
    drain("ask_schedule");
    assert.equal((await readState()).appAction, undefined);
    speech("habit_schedule", "Daily.");
    drain("ask_reminder");
    speech("habit_reminder", "No reminder.");
    drain("offer_habit");
    const proposed = (await readState()).appAction;
    assert.equal(proposed.kind, "habit-create");
    assert.match(proposed.name, /^walking$/i);
    assert.equal(proposed.schedule, "daily");
    assert.equal((await readState()).pendingActionId, proposed.id);
    speech("confirm_habit", "Yes.");
    drain("confirm_reply");
    const confirmed = await readState();
    assert.equal(confirmed.pendingActionId, proposed.id);
    assert.equal(confirmed.appAction.kind, "confirm");
    assert.equal(confirmed.appAction.targetId, proposed.id);
    const habit = await client
      .post("/api/habits")
      .set(owner)
      .send({
        id: `companion-${proposed.id}`,
        name: proposed.name,
        category: "movement",
        icon: "heart",
        color: "sage",
        goal: { type: "completion" },
        schedule: { type: "daily" },
        reminderTime: null,
        timeZone: "UTC",
      })
      .expect(201);
    const result = {
      actionId: proposed.id,
      ok: true,
      message: "Walking was saved to My Habits.",
    };
    await client
      .post(actionBase + "/action-result")
      .set(other)
      .send(result)
      .expect(404);
    await client
      .post(actionBase + "/action-result")
      .set(owner)
      .send(result)
      .expect(200);
    await client
      .post(actionBase + "/action-result")
      .set(owner)
      .send(result)
      .expect(200);
    drain("app_confirmed_result");
    assert.equal((await readState()).pendingActionId, undefined);
    const ownerState = (await client.get("/api/state").set(owner).expect(200))
      .body;
    assert.equal(ownerState.data.habits[0].id, habit.body.habit.id);
    assert.equal(
      ownerState.data.conversations[0].messages.filter(
        ({ content }: { content: string }) => content === result.message,
      ).length,
      1,
    );

    await client
      .post(actionBase + "/end")
      .set(owner)
      .send({})
      .expect(200);
    const greetingCall = await client
      .post("/api/voice/realtime")
      .set(owner)
      .set("X-Solace-Voice-Setup", "1")
      .send({ offer, conversationId })
      .expect(201);
    assert.equal(greetingCall.body.mediaReadySignal, true);
    const greetingBase = "/api/voice/realtime/" + greetingCall.body.id;
    await client
      .post(greetingBase + "/status")
      .set(owner)
      .send({ ready: true })
      .expect(200);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const greeting = sent.at(-1)!;
    assert.equal(greeting.event_id, `greeting_${greetingCall.body.id}`);
    assert.match(
      (greeting.response as { instructions: string }).instructions,
      /"Hello, Ada\. What brings you here today\?"/,
    );
    drain("greeting_reply");
    const afterGreeting = (
      await client.get("/api/state").set(owner).expect(200)
    ).body;
    assert.deepEqual(
      afterGreeting.data.conversations,
      ownerState.data.conversations,
    );
  } finally {
    await app.locals.closeRealtime();
    store.close();
  }
});

test("missing OpenAI Realtime configuration keeps voice unavailable", async () => {
  const store = await Store.open(":memory:");
  const app = createApp({ store, ai: offline, rateLimits: false });
  try {
    const { body } = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Fixture",
        email: "realtime-disabled@solace.test",
        password: "fixture-only-password",
      })
      .expect(201);
    const auth = { Authorization: "Bearer " + body.token };
    const capabilities = await request(app)
      .get("/api/capabilities")
      .set(auth)
      .expect(200);
    assert.equal(capabilities.body.voiceRealtime, false);
    await request(app)
      .post("/api/voice/realtime")
      .set(auth)
      .send({ offer })
      .expect(503);
  } finally {
    store.close();
  }
});
