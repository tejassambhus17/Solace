import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import initSqlJs from "sql.js";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth.js";
import {
  appActionCapabilityHeader,
  appActionCapabilityVersion,
} from "../src/companion-app-action.js";
import { Store } from "../src/database.js";
import type {
  RealtimeProvider,
  RealtimeProviderEvent,
} from "../src/realtime-provider.js";
import { wellnessGoalsActionHeader } from "../src/wellness-goals.js";
import { openAIResponse } from "./openai-fixture.js";

const offline = {
  mode: "offline",
  model: "fixture",
  baseUrl: "https://api.openai.com/v1",
} as const;
const goalsRoute = "/api/auth/wellness-goals";
const password = "disposable-test-password";
const bearer = { type: "bearer" } as const;

async function register(client: ReturnType<typeof request>, name: string) {
  return (
    await client
      .post("/api/auth/register")
      .send({
        email: `${randomUUID()}@example.test`,
        name,
        password,
      })
      .expect(201)
  ).body;
}

test("legacy database migration leaves existing accounts ungated and preserves goal changes across restart and login", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "solace-wellness-goals-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, "old.sqlite");
  const sqlite = await initSqlJs();
  const legacy = new sqlite.Database();
  legacy.run(
    "CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, created_at TEXT NOT NULL, personalization INTEGER NOT NULL DEFAULT 0)",
  );
  const email = "legacy@example.test";
  legacy.run(
    "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)",
    [
      randomUUID(),
      email,
      "Legacy QA",
      await hashPassword(password),
      new Date().toISOString(),
    ],
  );
  writeFileSync(file, legacy.export());
  legacy.close();

  const store = await Store.open(file);
  const api = request(createApp({ store, ai: offline, rateLimits: false }));
  const login = (client: ReturnType<typeof request>) =>
    client.post("/api/auth/login").send({ email, password }).expect(200);
  try {
    const { body: account } = await login(api);
    assert.equal(account.user.wellnessOnboarding, "legacy");
    assert.deepEqual(account.user.wellnessGoals, []);
    await api
      .patch(goalsRoute)
      .auth(account.token, bearer)
      .send({ goals: ["focus"], completeOnboarding: true })
      .expect(200, { user: account.user });
    const saved = await api
      .patch(goalsRoute)
      .auth(account.token, bearer)
      .send({ goals: ["habits", "feelings"] })
      .expect(200);
    assert.equal(saved.body.user.wellnessOnboarding, "completed");
    assert.deepEqual(saved.body.user.wellnessGoals, ["feelings", "habits"]);
    await api.post("/api/auth/logout").auth(account.token, bearer).expect(204);
    await api
      .patch(goalsRoute)
      .auth(account.token, bearer)
      .send({ goals: ["focus"] })
      .expect(401);
  } finally {
    store.close();
  }

  const restarted = await Store.open(file);
  const restored = request(
    createApp({ store: restarted, ai: offline, rateLimits: false }),
  );
  try {
    const { body: account } = await login(restored);
    assert.equal(account.user.wellnessOnboarding, "completed");
    assert.deepEqual(account.user.wellnessGoals, ["feelings", "habits"]);
    const exportResponse = await restored
      .get("/api/export")
      .auth(account.token, bearer)
      .expect(200);
    assert.deepEqual(
      exportResponse.body.user.wellnessGoals,
      account.user.wellnessGoals,
    );
    await restored
      .patch(goalsRoute)
      .auth(account.token, bearer)
      .send({ goals: [] })
      .expect(200, { user: { ...account.user, wellnessGoals: [] } });
    await restored
      .get("/api/state")
      .auth(account.token, bearer)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.user.wellnessOnboarding, "completed");
        assert.deepEqual(body.user.wellnessGoals, []);
      });
  } finally {
    restarted.close();
  }
});

test("goal completion is validated, account-scoped and idempotent even after later edits", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const api = request(createApp({ store, ai: offline, rateLimits: false }));
  const owner = await register(api, "First QA");
  const other = await register(api, "Second QA");
  assert.equal(owner.user.wellnessOnboarding, "pending");
  assert.deepEqual(owner.user.wellnessGoals, []);
  await api
    .patch(goalsRoute)
    .send({ goals: [], completeOnboarding: true })
    .expect(401);
  for (const body of [
    { goals: [] },
    { goals: ["sleep"] },
    { goals: [], completeOnboarding: false },
    { goals: ["sleep", "sleep"], completeOnboarding: true },
    { goals: ["unknown"], completeOnboarding: true },
    { goals: ["sleep"], completeOnboarding: true, ownerId: other.user.id },
  ])
    await api
      .patch(goalsRoute)
      .auth(owner.token, bearer)
      .send(body)
      .expect(400);
  const first = {
    goals: ["explore", "calm", "sleep"],
    completeOnboarding: true,
  };
  const complete = () =>
    api.patch(goalsRoute).auth(owner.token, bearer).send(first).expect(200);
  const replies = await Promise.all([complete(), complete()]);
  assert.deepEqual(replies[0].body, replies[1].body);
  assert.equal(replies[0].body.user.wellnessOnboarding, "completed");
  assert.deepEqual(replies[0].body.user.wellnessGoals, [
    "calm",
    "sleep",
    "explore",
  ]);
  assert.equal(replies[0].body.user.personalization, false);
  const edit = await api
    .patch(goalsRoute)
    .auth(owner.token, bearer)
    .send({ goals: ["focus"] })
    .expect(200);
  assert.deepEqual((await complete()).body, edit.body);
  await api
    .get("/api/auth/me")
    .auth(other.token, bearer)
    .expect(200, { user: other.user });
  const skip = (token: string) =>
    api
      .patch(goalsRoute)
      .auth(token, bearer)
      .send({ goals: [], completeOnboarding: true });
  await skip(owner.token).expect(200, edit.body);
  const skipped = { ...other.user, wellnessOnboarding: "completed" };
  await skip(other.token).expect(200, { user: skipped });
  await skip(other.token).expect(200, { user: skipped });
  await api.post("/api/auth/logout").auth(other.token, bearer).expect(204);
  const reopened = await api
    .post("/api/auth/login")
    .send({ email: other.user.email, password })
    .expect(200);
  assert.deepEqual(reopened.body.user, skipped);
  await api
    .get("/api/state")
    .auth(reopened.body.token, bearer)
    .expect(200)
    .expect(({ body }) => assert.deepEqual(body.user, skipped));
  await api
    .get("/api/auth/me")
    .auth(owner.token, bearer)
    .expect(200, edit.body);
});

test("a failed persistence rolls back both onboarding fields and remains retryable", async (t) => {
  const store = await Store.open(":memory:");
  t.after(() => store.close());
  const api = request(createApp({ store, ai: offline, rateLimits: false }));
  const account = await register(api, "Rollback QA");
  const persist = store.persist;
  store.persist = () => {
    throw new Error("fixture storage unavailable");
  };
  const save = () =>
    api
      .patch(goalsRoute)
      .auth(account.token, bearer)
      .send({ goals: ["calm"], completeOnboarding: true });
  try {
    await save().expect(500);
    await api
      .get("/api/auth/me")
      .auth(account.token, bearer)
      .expect(200, { user: account.user });
  } finally {
    store.persist = persist;
  }
  await save()
    .expect(200)
    .expect(({ body }) => {
      assert.equal(body.user.wellnessOnboarding, "completed");
      assert.deepEqual(body.user.wellnessGoals, ["calm"]);
    });
});

test("Companion sends only approved fixed goals to text and Realtime and invalidates old voice context", async () => {
  const store = await Store.open(":memory:");
  const textPrompts: string[] = [];
  const voicePrompts: string[] = [];
  const originalFetch = globalThis.fetch;
  let waitForReply: (() => Promise<void>) | undefined;
  globalThis.fetch = (async (_input, init) => {
    textPrompts.push(JSON.parse(String(init?.body)).instructions);
    await waitForReply?.();
    return openAIResponse(
      JSON.stringify({
        reply: "A fixture reply.",
        practice: "none",
        basis: "general",
      }),
      true,
    );
  }) as typeof fetch;
  const offer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
  const provider: RealtimeProvider = {
    async create(_offer, { instructions }) {
      voicePrompts.push(instructions);
      return { answer: offer, callId: `rtc_goal${voicePrompts.length}` };
    },
    async connect() {
      return { send: () => true, close() {} };
    },
    async hangup() {},
  };
  const app = createApp({
    store,
    ai: { ...offline, mode: "live", apiKey: "test-only" },
    realtimeProvider: provider,
    rateLimits: false,
  });
  const api = request(app);
  try {
    const owner = await register(api, "Consent QA");
    const other = await register(api, "Other QA");
    const save = (token: string, goals: string[]) =>
      api
        .patch(goalsRoute)
        .auth(token, bearer)
        .send({ goals, completeOnboarding: true })
        .expect(200);
    await save(owner.token, ["sleep", "explore"]);
    await save(other.token, ["focus"]);
    const chat = (token: string) =>
      api
        .post("/api/chat")
        .auth(token, bearer)
        .send({ text: "I'd like a small pause." })
        .expect(200);
    const voice = (token: string) =>
      api
        .post("/api/voice/realtime")
        .auth(token, bearer)
        .send({ offer })
        .expect(201);
    const close = (token: string, id: string) =>
      api
        .post(`/api/voice/realtime/${id}/end`)
        .auth(token, bearer)
        .send({})
        .expect(200);
    await chat(owner.token);
    await close(owner.token, (await voice(owner.token)).body.id);
    assert.doesNotMatch(textPrompts[0], /wellness goals chosen/);
    assert.doesNotMatch(voicePrompts[0], /wellness goals chosen/);
    await api
      .patch("/api/auth/me")
      .auth(owner.token, bearer)
      .send({ personalization: true })
      .expect(200);
    await chat(owner.token);
    await chat(other.token);
    const active = await voice(owner.token);
    for (const prompt of [textPrompts[1], voicePrompts[1]]) {
      assert.match(
        prompt,
        /wellness goals chosen by the user: \["Sleep better"\]/,
      );
      assert.doesNotMatch(prompt, /Just explore|Improve my focus/);
    }
    assert.doesNotMatch(textPrompts[2], /wellness goals chosen/);
    await api
      .patch(goalsRoute)
      .auth(owner.token, bearer)
      .send({ goals: ["calm"] })
      .expect(200);
    await api
      .post(`/api/voice/realtime/${active.body.id}/status`)
      .auth(owner.token, bearer)
      .send({})
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.reason, "authorization_changed");
        assert.equal(body.phase, "disconnected");
      });
    await chat(owner.token);
    assert.match(textPrompts[3], /\["Feel calmer"\]/);
    assert.doesNotMatch(textPrompts[3], /Sleep better/);

    const requested = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    waitForReply = () => {
      requested.resolve();
      return resume.promise;
    };
    const inFlight = api
      .post("/api/chat")
      .auth(owner.token, bearer)
      .send({ text: "A turn with a stale goal snapshot." })
      .expect(409)
      .expect(({ body }) => assert.equal(body.code, "PERSONALIZATION_CHANGED"))
      .then(() => {});
    try {
      await requested.promise;
      await api
        .patch(goalsRoute)
        .auth(owner.token, bearer)
        .send({ goals: [] })
        .expect(200);
    } finally {
      resume.resolve();
    }
    await inFlight;
  } finally {
    globalThis.fetch = originalFetch;
    await app.locals.closeRealtime();
    store.close();
  }
});

test("only capable clients receive the wellness goals navigation action in text and voice", async () => {
  const store = await Store.open(":memory:");
  const offer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
  const sent: RealtimeProviderEvent[] = [];
  let sideband: Parameters<RealtimeProvider["connect"]>[1] | undefined;
  const provider: RealtimeProvider = {
    async create() {
      return { answer: offer, callId: "rtc_goalnav" };
    },
    async connect(_callId, callbacks) {
      sideband = callbacks;
      return {
        send(event) {
          sent.push(event);
          return true;
        },
        close() {},
      };
    },
    async hangup() {},
  };
  const app = createApp({
    store,
    ai: offline,
    realtimeProvider: provider,
    rateLimits: false,
  });
  const api = request(app);
  try {
    const account = await register(api, "Action QA");
    const text = "Open my wellness goals.";
    for (const supported of [false, true]) {
      const headers: Record<string, string> = {
        [appActionCapabilityHeader]: appActionCapabilityVersion,
      };
      if (supported) headers[wellnessGoalsActionHeader] = "1";
      const chat = await api
        .post("/api/chat")
        .auth(account.token, bearer)
        .set(headers)
        .send({ text })
        .expect(200);
      assert.equal(
        chat.body.appAction?.destination,
        supported ? "wellness-goals" : undefined,
      );
      if (!supported) assert.match(chat.body.reply, /updated Solace app/);
      const voice = await api
        .post("/api/voice/realtime")
        .auth(account.token, bearer)
        .set(headers)
        .send({ offer })
        .expect(201);
      const item_id = `fixture_goal_${Number(supported)}`;
      sideband!.onEvent({ type: "input_audio_buffer.committed", item_id });
      sideband!.onEvent({
        type: "conversation.item.input_audio_transcription.completed",
        item_id,
        transcript: text,
      });
      const response = sent
        .filter((event) => event.type === "response.create")
        .at(-1)?.response as { instructions: string; metadata: unknown };
      if (supported)
        assert.match(response.instructions, /pass that request to the app/);
      else assert.match(response.instructions, /updated Solace app/);
      const response_id = `goal_nav_${Number(supported)}`;
      sideband!.onEvent({
        type: "response.created",
        response: { id: response_id, metadata: response.metadata },
      });
      sideband!.onEvent({ type: "output_audio_buffer.started", response_id });
      sideband!.onEvent({
        type: "response.done",
        response: { id: response_id, status: "completed", output: [] },
      });
      sideband!.onEvent({ type: "output_audio_buffer.stopped", response_id });
      await api
        .post(`/api/voice/realtime/${voice.body.id}/status`)
        .auth(account.token, bearer)
        .send({})
        .expect(200)
        .expect(({ body }) => {
          assert.equal(
            body.appAction?.destination,
            supported ? "wellness-goals" : undefined,
          );
        });
      await api
        .post(`/api/voice/realtime/${voice.body.id}/end`)
        .auth(account.token, bearer)
        .send({})
        .expect(200);
    }
  } finally {
    await app.locals.closeRealtime();
    store.close();
  }
});
