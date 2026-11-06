import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import sharp from "sharp";
import initSqlJs from "sql.js";
import { Store } from "../src/database.js";
import { createApp } from "../src/app.js";
import { getReply, type AIConfig } from "../src/ai.js";
import { parseTrustProxyHops } from "../src/config.js";
import { hashPassword } from "../src/auth.js";
import { AVATAR_MAX_BYTES, AVATAR_PIXELS } from "../src/avatar.js";
const ai: AIConfig = {
  mode: "offline",
  model: "test",
  baseUrl: "https://api.openai.com/v1",
};
test("proxy hops configuration rejects ambiguous or out-of-range values", () => {
  assert.equal(parseTrustProxyHops(undefined), 0);
  for (const value of ["0", "1", "2", "3"]) {
    assert.equal(parseTrustProxyHops(value), Number(value));
  }
  for (const value of [
    "",
    "true",
    "false",
    "4",
    "-1",
    "1.5",
    "01",
    " 1",
    "1 ",
  ]) {
    assert.throws(() => parseTrustProxyHops(value), /TRUST_PROXY_HOPS/);
  }
});
test("proxy trust defaults off and uses only the explicit configured hop count", async () => {
  const { app, store } = await fixture();
  try {
    assert.equal(app.get("trust proxy"), false);
    app.get("/test-client-ip", (req, res) => res.json({ ip: req.ip }));
    const direct = await request(app)
      .get("/test-client-ip")
      .set("X-Forwarded-For", "198.51.100.4, 203.0.113.7")
      .expect(200);
    assert.notEqual(direct.body.ip, "198.51.100.4");
    assert.notEqual(direct.body.ip, "203.0.113.7");
    const proxied = createApp({
      store,
      ai,
      rateLimits: false,
      trustProxyHops: 1,
    });
    proxied.get("/test-client-ip", (req, res) => res.json({ ip: req.ip }));
    assert.equal(proxied.get("trust proxy"), 1);
    const viaProxy = await request(proxied)
      .get("/test-client-ip")
      .set("X-Forwarded-For", "198.51.100.4, 203.0.113.7")
      .expect(200);
    assert.equal(viaProxy.body.ip, "203.0.113.7");
    assert.throws(
      () => createApp({ store, ai, trustProxyHops: 4 }),
      /TRUST_PROXY_HOPS/,
    );
  } finally {
    store.close();
  }
});
async function fixture(file = ":memory:") {
  const store = await Store.open(file);
  const app = createApp({ store, ai, rateLimits: false });
  const create = async (email: string) =>
    (
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Alex", email, password: "correct horse battery" })
        .expect(201)
    ).body;
  return { store, app, create };
}
test("failed initial session creation rolls back registration so signup can be retried", async () => {
  const { app, store, create } = await fixture();
  const run = store.run.bind(store);
  let failTokenInsert = true;
  store.run = (sql, params) => {
    if (failTokenInsert && sql.startsWith("INSERT INTO tokens"))
      throw new Error("Test session write failure");
    run(sql, params);
  };
  try {
    const email = "atomic-signup@example.com";
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Alex", email, password: "correct horse battery" })
      .expect(500);
    assert.equal(store.all("SELECT id FROM users").length, 0);
    assert.equal(store.all("SELECT hash FROM tokens").length, 0);
    failTokenInsert = false;
    const account = await create(email);
    await request(app)
      .get("/api/state")
      .auth(account.token, { type: "bearer" })
      .expect(200);
  } finally {
    store.close();
  }
});
test("registration hashes passwords, validates input, logs in and revokes sessions", async () => {
  const { app, store, create } = await fixture();
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "", email: "bad", password: "x" })
      .expect(400);
    const account = await create("alex@example.com");
    assert.ok(account.token);
    assert.equal(account.user.personalization, false);
    assert.equal(account.user.avatar, null);
    assert.equal(account.user.password, undefined);
    assert.notEqual(
      store.one<{ password: string }>("SELECT password FROM users")!.password,
      "correct horse battery",
    );
    await request(app)
      .post("/api/auth/login")
      .send({ email: "alex@example.com", password: "wrong password" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "ALEX@example.com", password: "correct horse battery" })
      .expect(200);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(200);
    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(204);
    await request(app)
      .get("/api/state")
      .set("Authorization", `Bearer ${account.token}`)
      .expect(401);
  } finally {
    store.close();
  }
});
test("records are isolated by account and validation rejects malformed changes", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create("a@example.com"),
      b = await create("b@example.com");
    const authA = { Authorization: `Bearer ${a.token}` },
      authB = { Authorization: `Bearer ${b.token}` };
    const saved = (
      await request(app)
        .post("/api/records/checkins")
        .set(authA)
        .send({ mood: "calm", note: "Private" })
        .expect(201)
    ).body.record;
    assert.equal(
      (await request(app).get("/api/records/checkins").set(authB).expect(200))
        .body.records.length,
      0,
    );
    await request(app)
      .patch(`/api/records/checkins/${saved.id}`)
      .set(authB)
      .send({ mood: "low" })
      .expect(404);
    await request(app)
      .delete(`/api/records/checkins/${saved.id}`)
      .set(authB)
      .expect(404);
    await request(app)
      .post("/api/records/reminders")
      .set(authA)
      .send({ hour: 25 })
      .expect(400);
    await request(app)
      .patch(`/api/records/checkins/${saved.id}`)
      .set(authA)
      .send({ mood: null })
      .expect(400);
    const changed = (
      await request(app)
        .patch(`/api/records/checkins/${saved.id}`)
        .set(authA)
        .send({ note: "Updated", id: "hijack" })
        .expect(200)
    ).body.record;
    assert.equal(changed.id, saved.id);
    assert.equal(changed.note, "Updated");
    await request(app).get("/api/records/not-real").set(authA).expect(400);
  } finally {
    store.close();
  }
});
test("chat retains context, labels offline mode and deletes source-linked memories", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("chat@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const first = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "My exams are overwhelming" })
        .expect(200)
    ).body;
    assert.equal(first.provider, "offline");
    assert.equal(first.conversation.messages.length, 2);
    assert.equal(first.action.type, "breathing");
    const id = first.conversation.id;
    const second = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "Can we talk about it?", conversationId: id })
        .expect(200)
    ).body;
    assert.equal(second.conversation.messages.length, 4);
    assert.match(second.reply, /exams/);
    await request(app)
      .post("/api/records/memories")
      .set(auth)
      .send({
        text: "Prefers short sessions",
        approved: true,
        sourceConversationId: id,
      })
      .expect(201);
    await request(app)
      .delete(`/api/records/conversations/${id}`)
      .set(auth)
      .expect(204);
    assert.equal(
      (await request(app).get("/api/records/memories").set(auth)).body.records
        .length,
      0,
    );
    await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "Still here?", conversationId: id })
      .expect(404);
  } finally {
    store.close();
  }
});
test("personalization requires consent; urgent distress receives human support guidance", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("consent@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    await request(app)
      .post("/api/records/memories")
      .set(auth)
      .send({ text: "short grounding sessions" })
      .expect(201);
    const before = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "I am stressed" })
    ).body;
    assert.doesNotMatch(before.reply, /short grounding sessions/);
    await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ personalization: true })
      .expect(200);
    const after = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "I am stressed" })
    ).body;
    assert.match(after.reply, /short grounding sessions/);
    const support = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "I want to kill myself" })
    ).body;
    assert.equal(support.support, true);
    assert.match(support.reply, /person right now/);
    assert.equal(support.action, undefined);
  } finally {
    store.close();
  }
});
test("database and auth persist across reopen; export and account deletion work", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-db-"));
  const file = join(directory, "app.sqlite");
  try {
    const first = await fixture(file);
    const account = await first.create("persist@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    await request(first.app)
      .post("/api/records/reflections")
      .set(auth)
      .send({ text: "A quiet moment" })
      .expect(201);
    first.store.close();
    const second = await fixture(file);
    try {
      const state = (
        await request(second.app).get("/api/state").set(auth).expect(200)
      ).body;
      assert.equal(state.data.reflections[0].text, "A quiet moment");
      const exported = (
        await request(second.app).get("/api/export").set(auth).expect(200)
      ).body;
      assert.equal(exported.user.email, "persist@example.com");
      assert.equal(exported.user.password, undefined);
      await request(second.app).delete("/api/account").set(auth).expect(204);
      await request(second.app).get("/api/state").set(auth).expect(401);
      assert.equal(
        second.store.one<{ count: number }>(
          "SELECT COUNT(*) count FROM records",
        )!.count,
        0,
      );
    } finally {
      second.store.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test("explicit live mode without provider key does not pretend to be live", async () => {
  await assert.rejects(
    getReply(
      { ...ai, mode: "live" },
      { text: "Hello", name: "Alex", history: [], memories: [], context: [] },
    ),
    /AI_NOT_CONFIGURED/,
  );
});

test("built-in guidance honors reflection starters and keeps urgent support first", async () => {
  const input = { name: "Alex", history: [], memories: [], context: [] };
  for (const text of [
    "I'd like to reflect on my day",
    "I want to reflect on my quiet evening walk",
    "Can I write about feeling stressed?",
    "I'd like to journal",
  ]) {
    const result = await getReply(ai, { ...input, text });
    assert.equal(result.provider, "offline");
    assert.equal(result.action?.type, "reflection", text);
    assert.match(result.reply, /space to write/);
  }
  // "Interested" contains "rest", but does not express sleep or rest intent.
  const unrelated = await getReply(ai, {
    ...input,
    text: "I am interested in a quiet walk.",
  });
  assert.equal(unrelated.action?.type, "breathing");
  assert.doesNotMatch(unrelated.reply, /rest is on your mind/);
  const tired = await getReply(ai, {
    ...input,
    text: "I feel tired before bedtime.",
  });
  assert.equal(tired.action?.type, "wind-down");
  assert.match(tired.reply, /rest is on your mind/);
  const urgent = await getReply(ai, {
    ...input,
    text: "I want to journal because I want to hurt myself.",
  });
  assert.equal(urgent.provider, "offline");
  assert.equal(urgent.support, true);
  assert.equal(urgent.safety, true);
  assert.equal(urgent.action, undefined);
});
test("live provider sends bounded context with store:false and extracts output blocks", async () => {
  const original = globalThis.fetch;
  let captured: Record<string, any> | undefined;
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    captured = JSON.parse(String(init.body));
    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  reply: "We can take a short breathing pause, if you like.",
                  practice: "breathing",
                }),
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const output = await getReply(
      { ...ai, apiKey: "test-only", mode: "live" },
      {
        name: "Alex",
        text: "I feel tense",
        history: [],
        memories: ["Prefers short sessions"],
        context: [],
      },
    );
    assert.equal(output.provider, "live");
    assert.equal(output.action?.type, "breathing");
    assert.equal(captured?.store, false);
    assert.equal(captured?.input[0].content, "I feel tense");
    assert.equal(captured?.text.format.name, "solace_chat_turn");
    assert.match(captured?.instructions, /Prefers short sessions/);
  } finally {
    globalThis.fetch = original;
  }
});
test("actual mobile wellness, plan, reminder and memory record shapes survive round trips", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("mobile@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const now = new Date().toISOString();
    const payloads: Record<string, Record<string, unknown>> = {
      checkins: {
        mood: "Stressed",
        tags: ["Work"],
        note: "A busy day",
        day: "2026-11-05",
        createdAt: now,
      },
      assessments: {
        assessmentType: "anxiety",
        title: "Anxiety check",
        answers: [0, 1, 2, 3],
        score: 6,
        summary: { score: 6, title: "Pause", text: "A reflection" },
        createdAt: now,
      },
      reflections: {
        text: "I made a little space",
        need: "A quiet evening",
        createdAt: now,
      },
      plans: {
        type: "wellness",
        title: "Your next 3 days",
        tasks: [
          {
            title: "Take a mindful pause",
            description: "A brief reset",
            action: "breathing",
            completed: false,
          },
        ],
        createdAt: now,
      },
      reminders: {
        type: "custom",
        title: "Take a pause",
        hour: 20,
        minute: 0,
        days: [0, 1, 2, 3, 4, 5, 6],
        enabled: true,
        notificationIds: ["device-id"],
        permission: "granted",
      },
    };
    for (const [collection, payload] of Object.entries(payloads)) {
      const record = (
        await request(app)
          .post(`/api/records/${collection}`)
          .set(auth)
          .send(payload)
          .expect(201)
      ).body.record;
      for (const [field, value] of Object.entries(payload))
        assert.deepEqual(record[field], value, `${collection}.${field}`);
    }
    const session = (
      await request(app)
        .post("/api/records/sessions")
        .set(auth)
        .send({
          type: "breathing",
          title: "A reset moment",
          durationSec: 60,
          duration: 60,
          plannedDurationSec: 60,
          completed: true,
          source: "wellness",
          feedback: "Helped",
          note: "Useful",
          createdAt: now,
        })
        .expect(201)
    ).body.record;
    const memory = (
      await request(app)
        .post("/api/records/memories")
        .set(auth)
        .send({
          text: "Finds short breathing moments helpful.",
          content: "Finds short breathing moments helpful.",
          sourceType: "session",
          sourceId: session.id,
          approved: true,
          createdAt: now,
        })
        .expect(201)
    ).body.record;
    assert.equal(memory.sourceId, session.id);
    await request(app)
      .patch(`/api/records/memories/${memory.id}`)
      .set(auth)
      .send({ text: "Prefers grounding" })
      .expect(200);
    await request(app)
      .delete(`/api/records/sessions/${session.id}`)
      .set(auth)
      .expect(204);
    assert.equal(
      (await request(app).get("/api/records/memories").set(auth)).body.records
        .length,
      0,
    );
  } finally {
    store.close();
  }
});
test("invalid dates, reminder days, task shapes and source IDs are rejected", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create("validation@example.com"),
      b = await create("other-source@example.com");
    const auth = { Authorization: `Bearer ${a.token}` };
    const other = (
      await request(app)
        .post("/api/records/sessions")
        .set("Authorization", `Bearer ${b.token}`)
        .send({ type: "breathing", completed: true })
        .expect(201)
    ).body.record;
    await request(app)
      .post("/api/records/memories")
      .set(auth)
      .send({ text: "Preference", sourceType: "session", sourceId: other.id })
      .expect(404);
    await request(app)
      .post("/api/records/checkins")
      .set(auth)
      .send({ mood: "Calm", day: "2026-02-30" })
      .expect(400);
    await request(app)
      .post("/api/records/checkins")
      .set(auth)
      .send({ mood: "Calm", createdAt: "not-a-date" })
      .expect(400);
    await request(app)
      .post("/api/records/sessions")
      .set(auth)
      .send({ durationSec: "forever" })
      .expect(400);
    await request(app)
      .post("/api/records/plans")
      .set(auth)
      .send({ tasks: ["not a task"] })
      .expect(400);
    await request(app)
      .post("/api/records/reminders")
      .set(auth)
      .send({ days: [7] })
      .expect(400);
    await request(app)
      .post("/api/records/reminders")
      .set(auth)
      .send({ notificationIds: new Array(8).fill("x") })
      .expect(400);
    await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ personalization: "true" })
      .expect(400);
    const changed = (
      await request(app)
        .patch("/api/auth/me")
        .set(auth)
        .send({ name: "New name", personalization: true })
        .expect(200)
    ).body.user;
    assert.equal(changed.name, "New name");
    assert.equal(changed.personalization, true);
  } finally {
    store.close();
  }
});
test("failed persistence restores in-memory state and SQL rollback keeps foreign keys active", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-atomic-"));
  const file = join(directory, "app.sqlite");
  const { store, app, create } = await fixture(file);
  try {
    const account = await create("atomic@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const original = store.persist.bind(store);
    store.persist = () => {
      throw new Error("DISK_WRITE_FAILED");
    };
    await request(app)
      .post("/api/records/reflections")
      .set(auth)
      .send({ text: "Should not be saved" })
      .expect(500);
    store.persist = original;
    assert.equal(
      (await request(app).get("/api/records/reflections").set(auth)).body
        .records.length,
      0,
    );
    assert.equal(
      store.one<{ foreign_keys: number }>("PRAGMA foreign_keys")!.foreign_keys,
      1,
    );
    assert.throws(() =>
      store.transaction(() => {
        store.run(
          "INSERT INTO records(id,user_id,collection,json,created_at) VALUES(?,?,?,?,?)",
          ["bad", "missing-owner", "sessions", "{}", new Date().toISOString()],
        );
      }),
    );
    await request(app)
      .post("/api/records/reflections")
      .set(auth)
      .send({ text: "Durable" })
      .expect(201);
    const second = await Store.open(file);
    try {
      assert.equal(second.all("SELECT id FROM records").length, 1);
    } finally {
      second.close();
    }
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("large chat requests and overlong conversation history are bounded before provider use", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("bounds@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "x".repeat(4001) })
      .expect(400);
    const record = (
      await request(app)
        .post("/api/records/conversations")
        .set(auth)
        .send({
          title: "Long",
          messages: Array.from({ length: 199 }, () => ({
            role: "user",
            content: "x",
          })),
        })
        .expect(201)
    ).body.record;
    const response = await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "Another message", conversationId: record.id })
      .expect(400);
    assert.equal(response.body.code, "CONVERSATION_LIMIT");
    assert.equal(
      (await request(app).get("/api/records/conversations").set(auth)).body
        .records[0].messages.length,
      199,
    );
    const urgent = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "I want to hurt myself", conversationId: record.id })
        .expect(200)
    ).body;
    assert.equal(urgent.support, true);
    assert.equal(urgent.provider, "offline");
    assert.notEqual(urgent.conversation.id, record.id);
    assert.equal(urgent.conversation.messages.length, 2);
  } finally {
    store.close();
  }
});
test("concurrent chat is bounded and a late provider response cannot revive a deleted chat", async () => {
  const { app, store, create } = await fixture();
  const originalFetch = globalThis.fetch;
  let release!: () => void;
  let started!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const providerRelease = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (async () => {
    started();
    await providerRelease;
    return new Response(
      JSON.stringify({ output_text: "Here is a thoughtful reply." }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const account = await create("race@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const conversation = (
      await request(app)
        .post("/api/records/conversations")
        .set(auth)
        .send({ title: "A conversation", messages: [] })
        .expect(201)
    ).body.record;
    const live = createApp({
      store,
      ai: { ...ai, mode: "live", apiKey: "test-only" },
      rateLimits: false,
    });
    const pending = request(live)
      .post("/api/chat")
      .set(auth)
      .send({ text: "A thoughtful question", conversationId: conversation.id })
      .then((result) => result);
    await providerStarted;
    await request(live)
      .post("/api/chat")
      .set(auth)
      .send({ text: "Concurrent question" })
      .expect(409);
    const urgent = (
      await request(live)
        .post("/api/chat")
        .set(auth)
        .send({
          text: "I want to hurt myself",
          conversationId: conversation.id,
        })
        .expect(200)
    ).body;
    assert.equal(urgent.support, true);
    assert.equal(urgent.provider, "offline");
    assert.notEqual(urgent.conversation.id, conversation.id);
    await request(live)
      .delete(`/api/records/conversations/${conversation.id}`)
      .set(auth)
      .expect(204);
    release();
    const late = await pending;
    assert.equal(late.status, 404);
    const chats = (
      await request(live).get("/api/records/conversations").set(auth)
    ).body.records;
    assert.deepEqual(
      chats.map((chat: { id: string }) => chat.id),
      [urgent.conversation.id],
    );
    // The failed request also releases the per-user chat lock.
    await request(live)
      .post("/api/chat")
      .set(auth)
      .send({ text: "A new beginning" })
      .expect(200);
  } finally {
    release();
    globalThis.fetch = originalFetch;
    store.close();
  }
});
test("a late reply cannot overwrite a new conversation that reused a deleted ID", async () => {
  const { store, create } = await fixture();
  const originalFetch = globalThis.fetch;
  let start!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    start = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (async () => {
    start();
    await released;
    return new Response(JSON.stringify({ output_text: "Private reply" }));
  }) as typeof fetch;
  try {
    const { token } = await create("replacement@example.com");
    const auth = { Authorization: `Bearer ${token}` };
    const app = createApp({
      store,
      ai: { ...ai, mode: "live", apiKey: "test-only" },
      rateLimits: false,
    });
    const id = "same-id";
    const path = "/api/records/conversations";
    const createConversation = (title: string) =>
      request(app)
        .post(path)
        .set(auth)
        .send({ id, title, messages: [] })
        .expect(201);
    await createConversation("Original");
    const pending = request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "Private draft", conversationId: id })
      .then((response) => response);
    await started;
    await request(app).delete(`${path}/${id}`).set(auth).expect(204);
    const replacement = (await createConversation("Replacement")).body.record;
    release();
    const late = await pending;
    assert.equal(late.status, 409);
    assert.equal(late.body.code, "CONVERSATION_CHANGED");
    const state = (await request(app).get(path).set(auth).expect(200)).body
      .records;
    assert.deepEqual(state, [replacement]);
  } finally {
    release();
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test("chat retries replay a durable, account-scoped turn and cannot restore a deleted chat", async () => {
  const folder = mkdtempSync(join(tmpdir(), "solace-chat-retry-"));
  const file = join(folder, "retry.sqlite");
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = (async () => {
    providerCalls++;
    return new Response(
      JSON.stringify({
        output: [
          { content: [{ type: "output_text", text: "We can take a pause." }] },
        ],
      }),
    );
  }) as typeof fetch;
  const makeLive = (store: Store) =>
    createApp({
      store,
      ai: { ...ai, mode: "live", apiKey: "test-only" },
      rateLimits: false,
    });
  let store: Store | undefined;
  try {
    const first = await fixture(file);
    store = first.store;
    const a = await first.create("retry-a@example.com");
    const b = await first.create("retry-b@example.com");
    const send = (
      app: ReturnType<typeof createApp>,
      token: string,
      input: object,
    ) =>
      request(app)
        .post("/api/chat")
        .auth(token, { type: "bearer" })
        .send(input);
    const draft = { text: "Help me slow down", requestId: randomUUID() };
    const sent = (await send(makeLive(store), a.token, draft).expect(200)).body;
    store.close();
    store = undefined;
    store = await Store.open(file);
    const app = makeLive(store);
    const replayed = (await send(app, a.token, draft).expect(200)).body;
    assert.deepEqual(replayed, sent);
    assert.equal(providerCalls, 1);
    const conflict = await send(app, a.token, {
      ...draft,
      text: "Changed draft",
    }).expect(409);
    assert.equal(conflict.body.code, "CHAT_REQUEST_CONFLICT");
    await send(app, a.token, {
      ...draft,
      conversationId: sent.conversation.id,
    }).expect(409);
    const sameIdForOtherOwner = (await send(app, b.token, draft).expect(200))
      .body;
    assert.notEqual(sameIdForOtherOwner.conversation.id, sent.conversation.id);
    assert.equal(providerCalls, 2);
    await request(app)
      .delete(`/api/records/conversations/${sent.conversation.id}`)
      .auth(a.token, { type: "bearer" })
      .expect(204);
    await send(app, a.token, draft).expect(404);
    assert.equal(providerCalls, 2);
    const records = (
      await request(app)
        .get("/api/records/conversations")
        .auth(a.token, { type: "bearer" })
        .expect(200)
    ).body.records;
    assert.deepEqual(records, []);
    assert.equal(store.all("SELECT id FROM chat_requests").length, 2);
    await request(app)
      .delete("/api/account")
      .auth(a.token, { type: "bearer" })
      .expect(204);
    assert.deepEqual(store.all("SELECT user_id FROM chat_requests"), [
      { user_id: b.user.id },
    ]);
    store.run("UPDATE chat_requests SET expires_at=0 WHERE user_id=?", [
      b.user.id,
    ]);
    store.close();
    store = undefined;
    store = await Store.open(file);
    assert.deepEqual(store.all("SELECT user_id FROM chat_requests"), []);
    assert.equal(store.all("SELECT id FROM records").length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    store?.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("development CORS allows explicit loopback aliases and configured origins stay restricted", async () => {
  const { app, store } = await fixture();
  try {
    for (const origin of [
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "http://127.0.0.1:8082",
    ]) {
      const response = await request(app)
        .get("/api/health")
        .set("Origin", origin)
        .expect(200);
      assert.equal(response.headers["access-control-allow-origin"], origin);
    }
    const restricted = createApp({
      store,
      ai,
      rateLimits: false,
      allowedOrigins: ["https://solace.example"],
    });
    const permitted = await request(restricted)
      .get("/api/health")
      .set("Origin", "https://solace.example")
      .expect(200);
    assert.equal(
      permitted.headers["access-control-allow-origin"],
      "https://solace.example",
    );
    for (const origin of ["https://foreign.example", "http://127.0.0.1:8081"]) {
      const denied = await request(restricted)
        .get("/api/health")
        .set("Origin", origin)
        .expect(200);
      assert.equal(denied.headers["access-control-allow-origin"], undefined);
    }
  } finally {
    store.close();
  }
});

test("continued conversations remain recent after refresh and keep assistant metadata on edits", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("recent@example.com");
    const other = await create("recent-other@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const older = (
      await request(app)
        .post("/api/records/conversations")
        .set(auth)
        .send({
          title: "An earlier conversation",
          createdAt: "2026-01-01T12:00:00Z",
          messages: [],
        })
        .expect(201)
    ).body.record;
    await request(app)
      .post("/api/records/conversations")
      .set(auth)
      .send({
        title: "A newer conversation",
        createdAt: "2026-02-01T12:00:00Z",
        messages: [],
      })
      .expect(201);
    const continued = (
      await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "I am stressed", conversationId: older.id })
        .expect(200)
    ).body.conversation;
    const edited = (
      await request(app)
        .patch(`/api/records/conversations/${older.id}`)
        .set(auth)
        .send({ title: "Renamed conversation" })
        .expect(200)
    ).body.record;
    assert.deepEqual(edited.messages, continued.messages);
    assert.equal(edited.messages[1].provider, "offline");
    assert.equal(edited.messages[1].action.type, "breathing");
    const refreshed = (
      await request(app).get("/api/state").set(auth).expect(200)
    ).body;
    assert.equal(refreshed.data.conversations[0].id, older.id);
    assert.equal(
      (
        await request(app)
          .get("/api/state")
          .set("Authorization", `Bearer ${other.token}`)
          .expect(200)
      ).body.data.conversations.length,
      0,
    );
  } finally {
    store.close();
  }
});

test("human support flags persist when an urgent conversation is reopened", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("support-reopen@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "I want to hurt myself" })
      .expect(200);
    const message = (await request(app).get("/api/state").set(auth).expect(200))
      .body.data.conversations[0].messages[1];
    assert.equal(message.support, true);
    assert.equal(message.safety, true);
    assert.equal(message.provider, "offline");
    assert.equal(message.action, undefined);
  } finally {
    store.close();
  }
});

test("renaming a conversation while a reply is pending survives the reply commit", async () => {
  const { store, create } = await fixture();
  const originalFetch = globalThis.fetch;
  let release!: () => void;
  let started!: () => void;
  const providerStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const providerRelease = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (async () => {
    started();
    await providerRelease;
    return new Response(
      JSON.stringify({ output_text: "We can take it slowly." }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const account = await create("rename-pending@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const app = createApp({
      store,
      ai: { ...ai, mode: "live", apiKey: "test-only" },
      rateLimits: false,
    });
    const conversation = (
      await request(app)
        .post("/api/records/conversations")
        .set(auth)
        .send({ title: "Original name", messages: [] })
        .expect(201)
    ).body.record;
    const pending = request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "A question", conversationId: conversation.id })
      .then((response) => response);
    await providerStarted;
    const edited = await request(app)
      .patch(`/api/records/conversations/${conversation.id}`)
      .set(auth)
      .send({ messages: [{ role: "user", content: "Forged chat history" }] })
      .expect(409);
    assert.equal(edited.body.code, "CONVERSATION_HISTORY_LOCKED");
    await request(app)
      .patch(`/api/records/conversations/${conversation.id}`)
      .set(auth)
      .send({ title: "A name I chose" })
      .expect(200);
    release();
    const completed = await pending;
    assert.equal(completed.status, 200);
    assert.equal(completed.body.conversation.title, "A name I chose");
    assert.equal(completed.body.conversation.messages.length, 2);
    assert.equal(completed.body.conversation.messages[1].provider, "live");
    const reopened = (
      await request(app).get("/api/state").set(auth).expect(200)
    ).body;
    assert.equal(reopened.data.conversations[0].title, "A name I chose");
  } finally {
    release();
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test("provider transport and malformed responses are recoverable and do not save partial turns", async () => {
  const { store, create } = await fixture();
  const originalFetch = globalThis.fetch;
  try {
    const account = await create("provider-failure@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const app = createApp({
      store,
      ai: { ...ai, mode: "live", apiKey: "test-only" },
      rateLimits: false,
    });
    const invalidBodies = [
      "not JSON",
      "null",
      JSON.stringify({
        output: [{ content: [{ type: "output_text", text: 7 }] }],
      }),
      JSON.stringify({ status: "incomplete", output_text: "Partial reply" }),
      JSON.stringify({
        output_text: "Refused output",
        output: [{ content: [{ type: "refusal", refusal: "Refused" }] }],
      }),
      JSON.stringify({ output_text: "a".repeat(10001) }),
      JSON.stringify({ output_text: "Valid reply", data: "a".repeat(262144) }),
    ];
    for (const body of [undefined, ...invalidBodies]) {
      globalThis.fetch = (async () => {
        if (body === undefined) throw new TypeError("fetch failed");
        return new Response(body, { status: 200 });
      }) as typeof fetch;
      const failed = await request(app)
        .post("/api/chat")
        .set(auth)
        .send({ text: "A question worth keeping" })
        .expect(502);
      assert.equal(failed.body.code, "AI_UNAVAILABLE");
      assert.match(failed.body.error, /try again/);
      assert.equal(
        (await request(app).get("/api/state").set(auth).expect(200)).body.data
          .conversations.length,
        0,
      );
    }
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ output_text: "We can take a pause." }), {
        status: 200,
      })) as typeof fetch;
    // Every failure releases the chat lock, and a retry commits exactly one turn.
    const retried = await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "A question worth keeping" })
      .expect(200);
    assert.equal(retried.body.conversation.messages.length, 2);
    assert.equal(retried.body.provider, "live");
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test("saved toolkit practices are validated, idempotent and private to each account", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create("toolkit-a@example.com");
    const b = await create("toolkit-b@example.com");
    const authA = { Authorization: `Bearer ${a.token}` };
    const authB = { Authorization: `Bearer ${b.token}` };
    const practice = {
      kind: "resource",
      targetId: "sleep",
      title: "Sleep & rest",
    };
    const saves = await Promise.all([
      request(app).post("/api/records/favorites").set(authA).send(practice),
      request(app).post("/api/records/favorites").set(authA).send(practice),
    ]);
    assert.deepEqual(
      saves.map((response) => response.status).sort(),
      [200, 201],
    );
    const favorite = saves[0].body.record;
    assert.equal(favorite.id, "favorite-resource-sleep");
    assert.equal(saves[1].body.record.id, favorite.id);
    const listed = (
      await request(app).get("/api/records/favorites").set(authA).expect(200)
    ).body.records;
    assert.equal(listed.length, 1);
    assert.equal(
      (await request(app).get("/api/records/favorites").set(authB).expect(200))
        .body.records.length,
      0,
    );
    await request(app)
      .patch(`/api/records/favorites/${favorite.id}`)
      .set(authB)
      .send({ title: "Someone else's" })
      .expect(404);
    await request(app)
      .delete(`/api/records/favorites/${favorite.id}`)
      .set(authB)
      .expect(404);
    const independent = (
      await request(app)
        .post("/api/records/favorites")
        .set(authB)
        .send({ ...practice, title: "My sleep practice" })
        .expect(201)
    ).body.record;
    assert.equal(independent.id, favorite.id);
    await request(app)
      .patch(`/api/records/favorites/${favorite.id}`)
      .set(authA)
      .send({ title: "Wind down" })
      .expect(200);
    assert.equal(
      (await request(app).get("/api/records/favorites").set(authB).expect(200))
        .body.records[0].title,
      "My sleep practice",
    );
    await request(app)
      .patch(`/api/records/favorites/${favorite.id}`)
      .set(authA)
      .send({ targetId: "anxiety" })
      .expect(409);
    for (const invalid of [
      { kind: "resource", targetId: "invented-resource", title: "Unknown" },
      { kind: "grounding", targetId: "breathing", title: "Wrong target" },
      { kind: "therapist", targetId: "someone", title: "Unknown kind" },
      { kind: "breathing", targetId: "breathing", title: "" },
      { kind: "breathing", targetId: "breathing", title: "x".repeat(121) },
      { ...practice, ownerId: b.user.id },
    ])
      await request(app)
        .post("/api/records/favorites")
        .set(authA)
        .send(invalid)
        .expect(400);
    await request(app)
      .delete(`/api/records/favorites/${favorite.id}`)
      .set(authA)
      .expect(204);
    assert.equal(
      (await request(app).get("/api/records/favorites").set(authA).expect(200))
        .body.records.length,
      0,
    );
    assert.equal(
      (await request(app).get("/api/records/favorites").set(authB).expect(200))
        .body.records.length,
      1,
    );
  } finally {
    store.close();
  }
});

test("toolkit favorites and grounding sessions persist, export and cascade with account deletion", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-toolkit-"));
  const file = join(directory, "app.sqlite");
  try {
    const first = await fixture(file);
    const account = await first.create("toolkit-persist@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    for (const kind of ["breathing", "reflection", "grounding"])
      await request(first.app)
        .post("/api/records/favorites")
        .set(auth)
        .send({ kind, targetId: kind, title: `${kind} practice` })
        .expect(201);
    const session = (
      await request(first.app)
        .post("/api/records/sessions")
        .set(auth)
        .send({
          type: "grounding",
          title: "Five-senses grounding",
          completed: true,
          durationSec: 96,
          feedback: "Helped",
          steps: [0, 1, 2, 3, 4],
        })
        .expect(201)
    ).body.record;
    first.store.close();
    const second = await fixture(file);
    try {
      const state = (
        await request(second.app).get("/api/state").set(auth).expect(200)
      ).body.data;
      assert.equal(state.favorites.length, 3);
      assert.equal(state.sessions[0].type, "grounding");
      assert.equal(state.sessions[0].id, session.id);
      const exported = (
        await request(second.app).get("/api/export").set(auth).expect(200)
      ).body;
      assert.equal(exported.data.favorites.length, 3);
      assert.equal(exported.data.sessions[0].durationSec, 96);
      await request(second.app).delete("/api/account").set(auth).expect(204);
      assert.equal(
        second.store.one<{ count: number }>(
          "SELECT COUNT(*) count FROM records WHERE user_id=?",
          [account.user.id],
        )!.count,
        0,
      );
      await request(second.app)
        .get("/api/records/favorites")
        .set(auth)
        .expect(401);
    } finally {
      second.store.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const photoURI = (bytes: Buffer) =>
  `data:image/jpeg;base64,${bytes.toString("base64")}`;
const examplePhoto = () =>
  sharp({
    create: { width: 640, height: 480, channels: 3, background: "#cba99a" },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

test("profile photos are decoded, oriented, normalized and stripped of metadata for their owner only", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create("photo-a@example.com");
    const b = await create("photo-b@example.com");
    const authA = { Authorization: `Bearer ${a.token}` };
    const authB = { Authorization: `Bearer ${b.token}` };
    const source = await examplePhoto();
    const sourceMetadata = await sharp(source).metadata();
    assert.ok(sourceMetadata.exif);
    assert.ok(sourceMetadata.icc);
    assert.equal(sourceMetadata.orientation, 6);
    const saved = (
      await request(app)
        .patch("/api/auth/me")
        .set(authA)
        .send({
          avatar: photoURI(source),
          name: "Photo owner",
          personalization: true,
        })
        .expect(200)
    ).body.user;
    assert.equal(saved.id, a.user.id);
    assert.equal(saved.name, "Photo owner");
    assert.equal(saved.personalization, true);
    assert.notEqual(saved.avatar, photoURI(source));
    const normalized = Buffer.from(saved.avatar.split(",")[1], "base64");
    const metadata = await sharp(normalized).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, AVATAR_PIXELS);
    assert.equal(metadata.height, AVATAR_PIXELS);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.equal(metadata.orientation, undefined);
    assert.ok(normalized.length <= AVATAR_MAX_BYTES);
    assert.equal(
      (await request(app).get("/api/state").set(authA).expect(200)).body.user
        .avatar,
      saved.avatar,
    );
    assert.equal(
      (await request(app).get("/api/auth/me").set(authB).expect(200)).body.user
        .avatar,
      null,
    );
    assert.equal(
      (await request(app).get("/api/export").set(authB).expect(200)).body.user
        .avatar,
      null,
    );
    await request(app)
      .patch("/api/auth/me")
      .set(authB)
      .send({ avatar: saved.avatar, userId: a.user.id })
      .expect(400);
    await request(app)
      .patch("/api/auth/me")
      .send({ avatar: saved.avatar })
      .expect(401);
    assert.equal(
      (await request(app).get("/api/auth/me").set(authA).expect(200)).body.user
        .avatar,
      saved.avatar,
    );
    const removed = (
      await request(app)
        .patch("/api/auth/me")
        .set(authA)
        .send({ avatar: null })
        .expect(200)
    ).body.user;
    assert.equal(removed.avatar, null);
    assert.equal(removed.name, "Photo owner");
    assert.equal(removed.personalization, true);
    assert.equal(
      store.one<{ avatar: string | null }>(
        "SELECT avatar FROM users WHERE id=?",
        [a.user.id],
      )!.avatar,
      null,
    );
  } finally {
    store.close();
  }
});

test("profile photo validation rejects malformed, oversized and excessive-dimension input without replacing a saved photo", async () => {
  const { app, store, create } = await fixture();
  try {
    const account = await create("photo-invalid@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    const source = await examplePhoto();
    const original = (
      await request(app)
        .patch("/api/auth/me")
        .set(auth)
        .send({ avatar: photoURI(source) })
        .expect(200)
    ).body.user.avatar;
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const wide = await sharp({
      create: { width: 4097, height: 1, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .toBuffer();
    const pixels = await sharp({
      create: { width: 2100, height: 2100, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .toBuffer();
    for (const avatar of [
      "",
      "https://example.com/profile.jpg",
      "file:///private/photo.jpg",
      "data:image/jpeg;base64,!!!!",
      "data:image/jpeg;base64,AB==",
      photoURI(Buffer.from("not an image")),
      photoURI(png),
      photoURI(wide),
      photoURI(pixels),
      photoURI(source.subarray(0, Math.floor(source.length / 2))),
      "data:image/png;base64," + png.toString("base64"),
    ]) {
      const failed = await request(app)
        .patch("/api/auth/me")
        .set(auth)
        .send({ avatar, name: "Must not change" })
        .expect(400);
      assert.equal(failed.body.code, "INVALID_AVATAR");
    }
    const tooLarge = await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ avatar: photoURI(Buffer.alloc(AVATAR_MAX_BYTES + 1)) })
      .expect(413);
    assert.equal(tooLarge.body.code, "AVATAR_TOO_LARGE");
    const largeJSON = await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ avatar: "x".repeat(513 * 1024) })
      .expect(413);
    assert.equal(largeJSON.body.code, "REQUEST_TOO_LARGE");
    for (const avatar of [true, {}, 1])
      await request(app)
        .patch("/api/auth/me")
        .set(auth)
        .send({ avatar })
        .expect(400);
    const current = (
      await request(app).get("/api/auth/me").set(auth).expect(200)
    ).body.user;
    assert.equal(current.avatar, original);
    assert.equal(current.name, "Alex");
    // The larger JSON allowance applies only to profile updates, not chat.
    await request(app)
      .post("/api/chat")
      .set(auth)
      .send({ text: "x".repeat(201 * 1024) })
      .expect(413);
    const detailed = await sharp(randomBytes(512 * 512 * 3), {
      raw: { width: 512, height: 512, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    assert.ok(detailed.length < AVATAR_MAX_BYTES);
    assert.ok(photoURI(detailed).length > 200 * 1024);
    await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ avatar: photoURI(detailed) })
      .expect(200);
  } finally {
    store.close();
  }
});

test("legacy accounts migrate safely and profile photos persist, export and disappear with account deletion", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-avatar-migration-"));
  const file = join(directory, "app.sqlite");
  try {
    const SQL = await initSqlJs();
    const legacy = new SQL.Database();
    legacy.run(
      "CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created_at TEXT NOT NULL,personalization INTEGER NOT NULL DEFAULT 0)",
    );
    legacy.run(
      "INSERT INTO users(id,email,name,password,created_at,personalization) VALUES(?,?,?,?,?,?)",
      [
        "legacy-owner",
        "legacy-photo@example.com",
        "Legacy name",
        await hashPassword("correct horse battery"),
        "2026-01-01T12:00:00Z",
        1,
      ],
    );
    writeFileSync(file, legacy.export());
    legacy.close();
    const first = await fixture(file);
    let auth: { Authorization: string };
    let avatar: string;
    try {
      const login = (
        await request(first.app)
          .post("/api/auth/login")
          .send({
            email: "legacy-photo@example.com",
            password: "correct horse battery",
          })
          .expect(200)
      ).body;
      auth = { Authorization: `Bearer ${login.token}` };
      assert.equal(login.user.avatar, null);
      assert.equal(login.user.name, "Legacy name");
      assert.equal(login.user.personalization, true);
      avatar = (
        await request(first.app)
          .patch("/api/auth/me")
          .set(auth)
          .send({ avatar: photoURI(await examplePhoto()) })
          .expect(200)
      ).body.user.avatar;
    } finally {
      first.store.close();
    }
    const second = await fixture(file);
    try {
      assert.equal(
        second.store
          .all<{ name: string }>("PRAGMA table_info(users)")
          .filter((column) => column.name === "avatar").length,
        1,
      );
      assert.equal(
        (await request(second.app).get("/api/state").set(auth!).expect(200))
          .body.user.avatar,
        avatar!,
      );
      const exported = (
        await request(second.app).get("/api/export").set(auth!).expect(200)
      ).body;
      assert.equal(exported.user.avatar, avatar!);
      assert.equal(exported.user.id, "legacy-owner");
      assert.equal(exported.user.password, undefined);
      await request(second.app).delete("/api/account").set(auth!).expect(204);
      assert.equal(
        second.store.one("SELECT avatar FROM users WHERE id=?", [
          "legacy-owner",
        ]),
        undefined,
      );
      assert.equal(
        second.store.all("SELECT * FROM tokens WHERE user_id=?", [
          "legacy-owner",
        ]).length,
        0,
      );
      await request(second.app).get("/api/state").set(auth!).expect(401);
    } finally {
      second.store.close();
    }
    const third = await Store.open(file);
    try {
      assert.equal(
        third.one("SELECT avatar FROM users WHERE id=?", ["legacy-owner"]),
        undefined,
      );
    } finally {
      third.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// Hold the real decoder at its asynchronous output boundary, then let it finish.
// This exercises actual JPEG processing and API persistence rather than replacing
// normalization with a fake success adapter.
function holdPhotoDecode() {
  const prototype = Object.getPrototypeOf(sharp());
  const original = prototype.toBuffer;
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  prototype.toBuffer = async function (...args: unknown[]) {
    started();
    await wait;
    return original.apply(this, args);
  };
  return {
    ready,
    release,
    restore: () => {
      prototype.toBuffer = original;
    },
  };
}

test("late photo uploads cannot commit after logout, session expiry or account deletion", async () => {
  const source = photoURI(await examplePhoto());
  for (const action of ["logout", "expire", "delete"] as const) {
    const { app, store, create } = await fixture();
    const account = await create(`photo-race-${action}@example.com`);
    const auth = { Authorization: `Bearer ${account.token}` };
    const decoder = holdPhotoDecode();
    try {
      const pending = request(app)
        .patch("/api/auth/me")
        .set(auth)
        .send({ avatar: source, name: "Late name" })
        .then((response) => response);
      await decoder.ready;
      if (action === "logout")
        await request(app).post("/api/auth/logout").set(auth).expect(204);
      if (action === "expire")
        store.transaction(() =>
          store.run("UPDATE tokens SET expires_at=0 WHERE user_id=?", [
            account.user.id,
          ]),
        );
      if (action === "delete")
        await request(app).delete("/api/account").set(auth).expect(204);
      decoder.release();
      const late = await pending;
      assert.equal(late.status, 401);
      assert.equal(late.body.code, "UNAUTHORIZED");
      const row = store.one<{ avatar: string | null; name: string }>(
        "SELECT avatar,name FROM users WHERE id=?",
        [account.user.id],
      );
      if (action === "delete") assert.equal(row, undefined);
      else {
        assert.equal(row!.avatar, null);
        assert.equal(row!.name, "Alex");
      }
    } finally {
      decoder.release();
      decoder.restore();
      store.close();
    }
  }
});

test("photo removal supersedes a pending upload and concurrent account edits are preserved", async () => {
  const source = photoURI(await examplePhoto());
  const { app, store, create } = await fixture();
  try {
    const account = await create("photo-change-race@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    for (const remove of [true, false]) {
      const decoder = holdPhotoDecode();
      try {
        const pending = request(app)
          .patch("/api/auth/me")
          .set(auth)
          .send({ avatar: source })
          .then((response) => response);
        await decoder.ready;
        await request(app)
          .patch("/api/auth/me")
          .set(auth)
          .send({
            name: "Edited while uploading",
            personalization: true,
            ...(remove ? { avatar: null } : {}),
          })
          .expect(200);
        decoder.release();
        const late = await pending;
        assert.equal(late.status, remove ? 409 : 200);
        if (remove) assert.equal(late.body.code, "AVATAR_CHANGED");
        const current = (
          await request(app).get("/api/auth/me").set(auth).expect(200)
        ).body.user;
        assert.equal(current.name, "Edited while uploading");
        assert.equal(current.personalization, true);
        assert.equal(current.avatar === null, remove);
      } finally {
        decoder.release();
        decoder.restore();
      }
    }
  } finally {
    store.close();
  }
});

test("failed photo persistence reports an error and keeps the previous profile intact", async () => {
  const { app, store, create } = await fixture();
  const originalPersist = store.persist.bind(store);
  try {
    const account = await create("photo-persist-failure@example.com");
    const auth = { Authorization: `Bearer ${account.token}` };
    store.persist = () => {
      throw new Error("DISK_WRITE_FAILED");
    };
    await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ avatar: photoURI(await examplePhoto()), name: "Unsaved name" })
      .expect(500);
    store.persist = originalPersist;
    const current = (
      await request(app).get("/api/auth/me").set(auth).expect(200)
    ).body.user;
    assert.equal(current.avatar, null);
    assert.equal(current.name, "Alex");
  } finally {
    store.persist = originalPersist;
    store.close();
  }
});
