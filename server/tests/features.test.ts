import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { Store } from "../src/database.js";
import { createApp } from "../src/app.js";
import { curatedMoment, momentSchema } from "../src/moments.js";
import {
  lastVisibleWeekEnd,
  weeklyFacts,
  weeklyLocalToday,
} from "../src/weekly.js";
import { isUrgent, type AIConfig } from "../src/ai.js";
import { AUDIO_MAX_BYTES } from "../src/voice.js";
import { openAIEvents, openAIResponse } from "./openai-fixture.js";
const offline: AIConfig = {
  mode: "offline",
  model: "test",
  baseUrl: "https://api.openai.com/v1",
};
const live: AIConfig = {
  ...offline,
  mode: "live",
  apiKey: "test-only-provider-sentinel",
  transcriptionModel: "test-transcription-model",
};
function chatOutput(reply: string) {
  return openAIResponse(
    JSON.stringify({ reply, practice: "none", basis: "general" }),
    true,
  );
}

test("OpenAI streams bounded chat turns and respects consent changes", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const { token } = await create();
    const firstText = "My synthetic project is called Violet Kestrel.";
    const followUp = "What was the project name?";
    const preference = "I prefer grounding sessions";
    const chat = (text: string, conversationId?: string) =>
      request(app)
        .post("/api/chat")
        .auth(token, { type: "bearer" })
        .send({ text, conversationId });
    let calls = 0;
    await withFetch(
      async (url, init) => {
        calls++;
        assert.equal(url, "https://api.openai.com/v1/responses");
        assert.equal(
          new Headers(init?.headers).get("authorization"),
          `Bearer ${live.apiKey}`,
        );
        assert.equal(init?.redirect, "error");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.stream, true);
        assert.equal(body.text.format.type, "json_schema");
        assert.equal(body.text.format.strict, true);
        if (calls === 2) {
          assert.match(body.instructions, /I prefer grounding sessions/);
          assert.deepEqual(body.input, [
            { role: "user", content: firstText },
            { role: "assistant", content: "I can help with that." },
            { role: "user", content: followUp },
          ]);
        } else {
          assert.doesNotMatch(body.instructions, /I prefer grounding sessions/);
          assert.equal(body.input.length, 1);
        }
        return chatOutput("I can help with that.");
      },
      async () => {
        const first = (await chat(firstText).expect(200)).body;
        assert.equal(first.provider, "live");
        assert.equal(first.reply, "I can help with that.");
        await remember(app, token, preference);
        const next = (await chat(followUp, first.conversation.id).expect(200))
          .body;
        assert.equal(next.conversation.id, first.conversation.id);
        assert.equal(next.conversation.messages.length, 4);
        assert.deepEqual(
          next.conversation.messages
            .slice(0, 2)
            .map((message: { id: string }) => message.id),
          first.conversation.messages.map(
            (message: { id: string }) => message.id,
          ),
        );
        await request(app)
          .patch("/api/auth/me")
          .auth(token, { type: "bearer" })
          .send({ personalization: false })
          .expect(200);
        await chat(
          "Continue without personalization.",
          first.conversation.id,
        ).expect(200);
        const urgent = (await chat("I want to die").expect(200)).body;
        assert.equal(urgent.safety, true);
        assert.equal(urgent.provider, "offline");
      },
    );
    assert.equal(calls, 3);
  } finally {
    store.close();
  }
});

test("OpenAI uses schema-constrained Moments and receives only counts for weekly questions", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const { token } = await create();
    const memory = await remember(app, token);
    const post = (path: string, body: object) =>
      request(app).post(path).auth(token, { type: "bearer" }).send(body);
    await post("/api/records/reflections", {
      text: "private-writing-sentinel",
    }).expect(201);
    await withFetch(
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.text.format.type, "json_schema");
        assert.equal(body.text.format.strict, true);
        assert.equal(body.text.format.schema.additionalProperties, false);
        const input = JSON.parse(body.input);
        if (body.text.format.name === "solace_weekly_invitation") {
          assert.equal(input.reflections, 1);
          assert.equal(input.days, undefined);
          assert.doesNotMatch(String(init?.body), /private-writing-sentinel/);
          return providerResponse({
            invitation: "What would you like to carry forward?",
          });
        }
        assert.equal(body.text.format.name, "solace_moment");
        assert.equal(input.approvedPreference, memory.text);
        return providerResponse(input.template);
      },
      async () => {
        const moment = (
          await post("/api/moments/generate", {
            feeling: "A quiet minute",
            environment: "ocean",
          }).expect(200)
        ).body;
        assert.equal(moment.provider, "live");
        assert.equal(moment.activity.type, "grounding");
        assert.deepEqual(moment.usedMemoryIds, [memory.id]);
        const weekly = (await post("/api/insights/weekly", {}).expect(200))
          .body;
        assert.equal(weekly.provider, "live");
        assert.equal(weekly.facts.reflections, 1);
      },
    );
    const capabilities = await request(app)
      .get("/api/capabilities")
      .auth(token, { type: "bearer" })
      .expect(200);
    assert.equal(capabilities.body.aiProvider, "live");
    assert.equal(capabilities.body.voiceTranscription, true);
  } finally {
    store.close();
  }
});

test("OpenAI streamed failures expose no provider details and never save a partial conversation", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const { token } = await create();
    const chat = () =>
      request(app)
        .post("/api/chat")
        .auth(token, { type: "bearer" })
        .send({ text: "A synthetic question" });
    const delta = {
      type: "response.output_text.delta",
      delta: "upstream-private-delta",
    };
    const complete = await chatOutput("A complete reply.").text();
    const partial = openAIEvents(delta);
    const cases = [
      [
        429,
        async () =>
          Response.json(
            { error: { message: "upstream-secret-sentinel" } },
            { status: 429 },
          ),
      ],
      [
        502,
        async () => {
          throw new TypeError("upstream-secret-sentinel");
        },
      ],
      [
        502,
        async () =>
          openAIEvents({
            type: "response.completed",
            response: {
              status: "completed",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [
                    { type: "refusal", refusal: "upstream-secret-sentinel" },
                  ],
                },
              ],
            },
          }),
      ],
      [
        502,
        async () =>
          openAIEvents(delta, {
            type: "response.incomplete",
            response: { status: "incomplete", output: [] },
          }),
      ],
      [502, async () => partial.clone()],
    ] as const;
    let calls = 0;
    for (const [status, response] of cases) {
      await withFetch(
        async (url) => {
          assert.equal(url, "https://api.openai.com/v1/responses");
          calls++;
          return response();
        },
        async () => {
          const failure = (await chat().expect(status)).body;
          assert.equal(
            failure.code,
            status === 429 ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE",
          );
          assert.doesNotMatch(JSON.stringify(failure), /upstream-/);
        },
      );
    }
    assert.equal(calls, cases.length);
    assert.deepEqual(
      (
        await request(app)
          .get("/api/records/conversations")
          .auth(token, { type: "bearer" })
          .expect(200)
      ).body.records,
      [],
    );
    await withFetch(
      async () =>
        new Response((await partial.text()) + complete, {
          headers: { "Content-Type": "text/event-stream" },
        }),
      async () => {
        const result = (await chat().expect(200)).body;
        assert.equal(result.reply, "A complete reply.");
        assert.doesNotMatch(JSON.stringify(result), /upstream-private-delta/);
      },
    );
  } finally {
    store.close();
  }
});

test("the shared AI limit is owner-scoped and leaves urgent support and chat receipts available", async () => {
  const { store, create } = await fixture(live);
  try {
    const owner = await create();
    const other = await create("ai-budget-other@example.test");
    const app = createApp({ store, ai: live });
    const post = (token: string, path: string, body: object) =>
      request(app).post(path).auth(token, { type: "bearer" }).send(body);
    const first = { text: "A synthetic question.", requestId: randomUUID() };
    let calls = 0;
    await withFetch(
      async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        return body.stream
          ? chatOutput("A complete reply.")
          : providerResponse(JSON.parse(body.input).template);
      },
      async () => {
        const created = (
          await post(owner.token, "/api/chat", first).expect(200)
        ).body;
        for (let count = 1; count < 24; count++) {
          await post(owner.token, "/api/moments/generate", {
            feeling: "A quiet moment.",
          }).expect(200);
        }
        assert.equal(calls, 24);
        const limited = await post(owner.token, "/api/chat", {
          text: "A new question.",
        }).expect(429);
        assert.equal(limited.body.code, "AI_RATE_LIMITED");
        assert.ok(Number(limited.headers["retry-after"]) > 0);
        await post(owner.token, "/api/plans/preview", {}).expect(429);
        const replay = (await post(owner.token, "/api/chat", first).expect(200))
          .body;
        assert.equal(replay.conversation.id, created.conversation.id);
        assert.equal(
          (
            await post(owner.token, "/api/chat", {
              text: "I can't keep myself safe.",
            }).expect(200)
          ).body.safety,
          true,
        );
        const text = "I want to die.";
        const record = (
          await post(owner.token, "/api/records/reflections", {
            kind: "journal",
            text,
          }).expect(201)
        ).body.record;
        const urgent = await post(
          owner.token,
          `/api/journal/${record.id}/reflect`,
          {
            start: 0,
            end: text.length,
            revision: record.updatedAt,
            action: "reflect",
          },
        ).expect(200);
        assert.equal(urgent.body.support, true);
        assert.equal(calls, 24);
        await post(other.token, "/api/chat", first).expect(200);
        assert.equal(calls, 25);
      },
    );
  } finally {
    store.close();
  }
});

test(
  "closing a Moment preview aborts provider work and permits retry",
  { timeout: 5000 },
  async () => {
    const { app, store, create } = await fixture(live);
    const { token } = await create();
    const server = app.listen(0, "127.0.0.1");
    const clientFetch = globalThis.fetch;
    const controller = new AbortController();
    try {
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const url = `http://127.0.0.1:${address.port}/api/moments/generate`;
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const body = JSON.stringify({ feeling: "A synthetic quiet moment." });
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      let calls = 0;
      await withFetch(
        async (_url, init) => {
          if (++calls > 1)
            return providerResponse(
              JSON.parse(JSON.parse(String(init?.body)).input).template,
            );
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("Provider request aborted"));
                aborted.resolve();
              },
              { once: true },
            );
            started.resolve();
          });
        },
        async () => {
          const cancelled = assert.rejects(
            clientFetch(url, {
              method: "POST",
              headers,
              body,
              signal: controller.signal,
            }),
            { name: "AbortError" },
          );
          await started.promise;
          controller.abort();
          await cancelled;
          await aborted.promise;
          const retried = await clientFetch(url, {
            method: "POST",
            headers,
            body,
          });
          assert.equal(retried.status, 200);
          assert.equal((await retried.json()).provider, "live");
          assert.equal(calls, 2);
        },
      );
    } finally {
      controller.abort();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    }
  },
);

async function fixture(ai: AIConfig = offline) {
  const store = await Store.open(":memory:");
  const app = createApp({ store, ai, rateLimits: false });
  const create = async (email = "feature-qa@solace.test") =>
    (
      await request(app)
        .post("/api/auth/register")
        .send({ name: "Feature QA", email, password: "feature-test-password" })
        .expect(201)
    ).body;
  return { store, app, create };
}
function providerResponse(value: unknown) {
  return openAIResponse(JSON.stringify(value));
}
async function withFetch<T>(fetcher: typeof fetch, fn: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = (input, options) =>
    String(input) === "data:,"
      ? original(input, options)
      : fetcher(input, options);
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}
async function remember(
  app: ReturnType<typeof createApp>,
  token: string,
  text = "I prefer grounding sessions",
) {
  await request(app)
    .patch("/api/auth/me")
    .auth(token, { type: "bearer" })
    .send({ personalization: true })
    .expect(200);
  return (
    await request(app)
      .post("/api/records/memories")
      .auth(token, { type: "bearer" })
      .send({ text, approved: true, category: "activity" })
      .expect(201)
  ).body.record;
}

test("structured activities reject unsafe rhythms, mismatched timing, unknown fields and clinical promises", () => {
  const safe = curatedMoment("breathing");
  assert.ok(momentSchema.safeParse(safe).success);
  for (const activity of [
    { ...safe, durationSec: 600 },
    { ...safe, breathing: { inhale: 4, hold: 40, exhale: 6 } },
    { ...safe, execute: "javascript" },
    { ...safe, description: "This treatment will cure anxiety." },
    { ...safe, type: "rest" },
    { ...safe, steps: [] },
  ])
    assert.equal(momentSchema.safeParse(activity).success, false);
});
test("curated Moments use direct feelings, optional approved memory, owned environment and honest provider labels", async () => {
  const { app, store, create } = await fixture();
  try {
    await request(app)
      .post("/api/moments/generate")
      .send({ feeling: "a little tired" })
      .expect(401);
    const a = await create();
    const b = await create("other-feature@solace.test");
    await request(app)
      .post("/api/records/preferences")
      .auth(a.token, { type: "bearer" })
      .send({
        id: "wellness",
        environment: "ocean",
        ambientEnabled: false,
        streaksEnabled: false,
      })
      .expect(201);
    const memory = await remember(app, a.token);
    const inherited = await request(app)
      .post("/api/moments/generate")
      .auth(a.token, { type: "bearer" })
      .send({ feeling: "I need a minute" })
      .expect(200);
    assert.equal(inherited.body.activity.type, "grounding");
    assert.equal(inherited.body.activity.environment, "ocean");
    assert.equal(inherited.body.provider, "offline");
    assert.deepEqual(inherited.body.usedMemoryIds, [memory.id]);
    assert.match(inherited.body.explanation, /approved preference/);
    const direct = await request(app)
      .post("/api/moments/generate")
      .auth(a.token, { type: "bearer" })
      .send({ feeling: "I'm feeling overwhelmed", environment: "twilight" })
      .expect(200);
    assert.equal(direct.body.activity.type, "breathing");
    assert.equal(direct.body.activity.environment, "twilight");
    assert.deepEqual(direct.body.usedMemoryIds, []);
    await request(app)
      .patch("/api/auth/me")
      .auth(a.token, { type: "bearer" })
      .send({ personalization: false })
      .expect(200);
    const disabled = await request(app)
      .post("/api/moments/generate")
      .auth(a.token, { type: "bearer" })
      .send({ feeling: "I need a minute" })
      .expect(200);
    assert.equal(disabled.body.activity.type, "breathing");
    assert.deepEqual(disabled.body.usedMemoryIds, []);
    const isolated = await request(app)
      .post("/api/moments/generate")
      .auth(b.token, { type: "bearer" })
      .send({ feeling: "I need a minute" })
      .expect(200);
    assert.equal(isolated.body.activity.environment, "forest");
    assert.deepEqual(isolated.body.usedMemoryIds, []);
    await request(app)
      .post("/api/moments/generate")
      .auth(a.token, { type: "bearer" })
      .send({ feeling: "tired", environment: "unknown" })
      .expect(400);
  } finally {
    store.close();
  }
});
test("serious distress prioritizes human support without a provider call or generated activity", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    await withFetch(
      (async () => {
        throw new Error("must not call provider");
      }) as typeof fetch,
      async () => {
        const result = await request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "I want to end my life" })
          .expect(200);
        assert.equal(result.body.activity, null);
        assert.equal(result.body.support, true);
        assert.equal(result.body.provider, "offline");
        assert.match(result.body.message, /local emergency services/);
        assert.deepEqual(result.body.usedMemoryIds, []);
      },
    );
  } finally {
    store.close();
  }
});
test("live Moments request a strict bounded schema with store:false and validate the provider response", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    let calls = 0;
    await withFetch(
      (async (url, init) => {
        calls++;
        assert.match(String(url), /\/responses$/);
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.text.format.type, "json_schema");
        assert.equal(body.text.format.strict, true);
        assert.equal(body.text.format.schema.additionalProperties, false);
        const input = JSON.parse(body.input);
        assert.equal(input.approvedPreference, null);
        return providerResponse({ ...input.template, title: "A soft return" });
      }) as typeof fetch,
      async () => {
        const result = await request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "overwhelmed", environment: "ocean" })
          .expect(200);
        assert.equal(result.body.provider, "live");
        assert.equal(result.body.activity.title, "A soft return");
        assert.equal(calls, 1);
      },
    );
    await withFetch(
      (async () =>
        providerResponse({
          ...curatedMoment("breathing"),
          durationSec: 500,
        })) as typeof fetch,
      async () => {
        await request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "overwhelmed" })
          .expect(502);
      },
    );
    const state = await request(app)
      .get("/api/state")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(state.body.data.sessions.length, 0);
  } finally {
    store.close();
  }
});
test("provider refusal or transport failure never silently turns into a successful generated Moment", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    for (const fetcher of [
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [{ content: [{ type: "refusal", refusal: "no" }] }],
          }),
        ),
      async () => {
        throw new Error("network");
      },
      async () => new Response("invalid JSON"),
    ])
      await withFetch(fetcher as typeof fetch, async () => {
        const response = await request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "overwhelmed" })
          .expect(502);
        assert.equal(response.body.activity, undefined);
      });
  } finally {
    store.close();
  }
});
test("deleted or revoked approved memory cannot appear in a late generated recommendation", async () => {
  for (const revoke of [false, true]) {
    const { app, store, create } = await fixture(live);
    try {
      const a = await create();
      const memory = await remember(app, a.token);
      let release!: () => void;
      let started!: () => void;
      const waiting = new Promise<void>((resolve) => (started = resolve));
      await withFetch(
        (async (_url, init) => {
          const template = JSON.parse(
            JSON.parse(String(init?.body)).input,
          ).template;
          started();
          return new Promise<Response>(
            (resolve) => (release = () => resolve(providerResponse(template))),
          );
        }) as typeof fetch,
        async () => {
          const pending = request(app)
            .post("/api/moments/generate")
            .auth(a.token, { type: "bearer" })
            .send({ feeling: "I need a minute" })
            .then((result) => result);
          await waiting;
          await request(app)
            .post("/api/moments/generate")
            .auth(a.token, { type: "bearer" })
            .send({ feeling: "I need a minute" })
            .expect(409);
          const urgent = await request(app)
            .post("/api/moments/generate")
            .auth(a.token, { type: "bearer" })
            .send({ feeling: "I can't keep myself safe" })
            .expect(200);
          assert.equal(urgent.body.support, true);
          assert.equal(urgent.body.activity, null);
          assert.deepEqual(urgent.body.usedMemoryIds, []);
          if (revoke)
            await request(app)
              .patch("/api/auth/me")
              .auth(a.token, { type: "bearer" })
              .send({ personalization: false })
              .expect(200);
          else
            await request(app)
              .delete(`/api/records/memories/${memory.id}`)
              .auth(a.token, { type: "bearer" })
              .expect(204);
          release();
          const response = await pending;
          assert.equal(response.status, 409);
          assert.equal(response.body.code, "PERSONALIZATION_CHANGED");
          assert.equal(response.body.activity, undefined);
        },
      );
    } finally {
      store.close();
    }
  }
});
test("revoked sessions cannot receive late generated activities", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => (started = resolve));
    await withFetch(
      (async (_url, init) => {
        const template = JSON.parse(
          JSON.parse(String(init?.body)).input,
        ).template;
        started();
        return new Promise<Response>(
          (resolve) => (release = () => resolve(providerResponse(template))),
        );
      }) as typeof fetch,
      async () => {
        const pending = request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "overwhelmed" })
          .then((result) => result);
        await waiting;
        await request(app)
          .post("/api/auth/logout")
          .auth(a.token, { type: "bearer" })
          .expect(204);
        release();
        const result = await pending;
        assert.equal(result.status, 401);
        assert.equal(result.body.activity, undefined);
      },
    );
  } finally {
    store.close();
  }
});
test("generated sessions, preferences and goals are private, validated and idempotent with stable IDs", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("isolated-feature@solace.test");
    const activity = curatedMoment("breathing");
    const record = {
      id: "moment-stable-qa",
      createdAt: new Date().toISOString(),
      title: activity.title,
      kind: "generated",
      activity,
      environment: "forest",
      durationSec: 60,
      completed: true,
      feedback: "Helped",
    };
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send(record)
      .expect(201);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send(record)
      .expect(200);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({ ...record, durationSec: 30 })
      .expect(409);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({ ...record, createdAt: new Date(Date.now() - 1000).toISOString() })
      .expect(409);
    await request(app)
      .post("/api/records/sessions")
      .auth(b.token, { type: "bearer" })
      .send(record)
      .expect(201);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({ kind: "generated", durationSec: 60 })
      .expect(400);
    await request(app)
      .post("/api/records/goals")
      .auth(a.token, { type: "bearer" })
      .send({
        id: "goal-weekly",
        title: "Make room",
        targetMinutesPerWeek: 15,
        active: true,
      })
      .expect(201);
    await request(app)
      .post("/api/records/goals")
      .auth(a.token, { type: "bearer" })
      .send({
        id: "goal-weekly",
        title: "Make room",
        targetMinutesPerWeek: 15,
        active: true,
      })
      .expect(200);
    await request(app)
      .post("/api/records/goals")
      .auth(a.token, { type: "bearer" })
      .send({ title: "too much", targetMinutesPerWeek: 999 })
      .expect(400);
    await request(app)
      .post("/api/records/preferences")
      .auth(a.token, { type: "bearer" })
      .send({ id: "wrong", environment: "ocean" })
      .expect(400);
    const exported = await request(app)
      .get("/api/export")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(exported.body.data.sessions.length, 1);
    assert.equal(exported.body.data.goals.length, 1);
    const other = await request(app)
      .get("/api/state")
      .auth(b.token, { type: "bearer" })
      .expect(200);
    assert.equal(other.body.data.goals.length, 0);
    await request(app)
      .delete("/api/account")
      .auth(a.token, { type: "bearer" })
      .expect(204);
    assert.equal(
      store.one<{ count: number }>(
        "SELECT COUNT(*) AS count FROM records WHERE user_id=?",
        [a.user.id],
      )!.count,
      0,
    );
    assert.equal(
      (
        await request(app)
          .get("/api/state")
          .auth(b.token, { type: "bearer" })
          .expect(200)
      ).body.data.sessions.length,
      1,
    );
  } finally {
    store.close();
  }
});
test("legacy activity completion retries reconcile the original record for its owner", async () => {
  const { store, app, create } = await fixture();
  try {
    const a = await create("legacy-retry-a@solace.test");
    const b = await create("legacy-retry-b@solace.test");
    const record = {
      id: "session-qa-retry",
      title: "Breathing",
      type: "breathing",
      durationSec: 60,
      completed: true,
      feedback: "A little",
    };
    const save = (token: string, body = record) =>
      request(app)
        .post("/api/records/sessions")
        .auth(token, { type: "bearer" })
        .send(body);
    const initial = await save(a.token).expect(201);
    const retry = await save(a.token).expect(200);
    assert.deepEqual(retry.body.record, initial.body.record);
    await save(a.token, { ...record, durationSec: 90 }).expect(409);
    const before = await request(app)
      .get("/api/state")
      .auth(b.token, { type: "bearer" })
      .expect(200);
    assert.equal(before.body.data.sessions.length, 0);
    await save(b.token).expect(201);
    const rememberCompletion = (token: string, text = "Short practices") =>
      request(app)
        .post("/api/records/memories")
        .auth(token, { type: "bearer" })
        .send({
          id: `memory-${record.id}`,
          sourceType: "session",
          sourceId: record.id,
          text,
          approved: true,
        });
    const memory = await rememberCompletion(a.token).expect(201);
    const memoryRetry = await rememberCompletion(a.token).expect(200);
    assert.deepEqual(memoryRetry.body.record, memory.body.record);
    await rememberCompletion(a.token, "Long practices").expect(409);
    const after = await request(app)
      .get("/api/state")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(after.body.data.sessions.length, 1);
    assert.equal(after.body.data.memories.length, 1);
    assert.equal(
      (
        await request(app)
          .get("/api/state")
          .auth(b.token, { type: "bearer" })
          .expect(200)
      ).body.data.memories.length,
      0,
    );
  } finally {
    store.close();
  }
});

test("a lost reminder create response can be retried without another account schedule", async () => {
  const { store, app, create } = await fixture();
  try {
    const { token } = await create();
    const record = {
      id: "reminder-qa-retry",
      type: "checkin",
      enabled: true,
      hour: 8,
      minute: 30,
      days: [1, 3, 5],
    };
    const save = (body = record) =>
      request(app)
        .post("/api/records/reminders")
        .auth(token, { type: "bearer" })
        .send(body);
    const initial = await save().expect(201);
    const retry = await save().expect(200);
    assert.deepEqual(retry.body.record, initial.body.record);
    await save({ ...record, minute: 45 }).expect(409);
    const state = await request(app)
      .get("/api/state")
      .auth(token, { type: "bearer" })
      .expect(200);
    assert.equal(state.body.data.reminders.length, 1);
  } finally {
    store.close();
  }
});

test("weekly facts use actual local-day records and exclude future or incomplete activity", () => {
  const now = new Date("2026-11-05T20:00:00Z");
  const record = { createdAt: "2026-11-04T23:00:00Z", day: "2026-11-05" };
  const result = weeklyFacts(
    {
      checkins: [
        record,
        { createdAt: "2026-11-06T01:00:00Z", day: "2026-11-05" },
      ],
      sessions: [
        { ...record, completed: true, durationSec: 90, feedback: "A little" },
        { ...record, completed: false, durationSec: 900 },
        { ...record, type: "resource", completed: true, feedback: "Helped" },
      ],
      reflections: [record],
    },
    "2026-11-05",
    now,
  );
  assert.deepEqual(result.period, { start: "2026-10-30", end: "2026-11-05" });
  assert.deepEqual(result.facts, {
    checkins: 1,
    completedSessions: 1,
    minutes: 1,
    reflections: 1,
    helpfulSessions: 1,
    days: ["2026-11-05"],
  });
});
test("a calendar-week review uses the viewer's zone for older timestamps and excludes future days", () => {
  const now = new Date("2027-01-06T01:00:00.000Z");
  const timeZone = "America/Los_Angeles";
  const today = weeklyLocalToday(now, timeZone);
  assert.equal(today, "2027-01-05");
  assert.equal(lastVisibleWeekEnd(today), "2027-01-10");
  const result = weeklyFacts(
    {
      checkins: [
        { id: "prior-week", createdAt: "2027-01-04T03:30:00.000Z" },
        { id: "monday", createdAt: "2027-01-04T10:00:00.000Z" },
        { id: "monday", createdAt: "2027-01-04T10:00:00.000Z" },
        {
          id: "tuesday",
          createdAt: "2027-01-06T00:30:00.000Z",
          day: "2027-01-05",
        },
        {
          id: "future-day",
          createdAt: "2027-01-06T00:30:00.000Z",
          day: "2027-01-06",
        },
      ],
      sessions: [],
      reflections: [],
    },
    "2027-01-10",
    now,
    { today, timeZone },
  );
  assert.deepEqual(result.period, { start: "2027-01-04", end: "2027-01-10" });
  assert.equal(result.facts.checkins, 2);
  assert.deepEqual(result.facts.days, ["2027-01-04", "2027-01-05"]);
});
test("weekly reflection reports only owned persisted facts and has a useful empty state", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("weekly-other@solace.test");
    const empty = await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({})
      .expect(200);
    assert.equal(empty.body.facts.checkins, 0);
    assert.match(empty.body.reflection, /fresh page/);
    assert.equal(empty.body.provider, "offline");
    assert.equal(empty.body.hasActivity, false);
    assert.equal(typeof empty.body.prompt, "string");
    await request(app)
      .post("/api/records/checkins")
      .auth(a.token, { type: "bearer" })
      .send({ mood: "Calm" })
      .expect(201);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({
        title: "Breathing",
        durationSec: 120,
        completed: true,
        feedback: "Helped",
      })
      .expect(201);
    const own = await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({})
      .expect(200);
    assert.equal(own.body.facts.checkins, 1);
    assert.equal(own.body.facts.minutes, 2);
    assert.equal(own.body.facts.helpfulSessions, 1);
    const other = await request(app)
      .post("/api/insights/weekly")
      .auth(b.token, { type: "bearer" })
      .send({})
      .expect(200);
    assert.equal(other.body.facts.completedSessions, 0);
    await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({ endDate: "2026-02-30" })
      .expect(400);
  } finally {
    store.close();
  }
});
test("a selected calendar week can be reviewed, saved, edited and deleted by its owner", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("weekly-private@solace.test");
    const timeZone = "Asia/Kolkata";
    const today = weeklyLocalToday(new Date(), timeZone);
    const endDate = lastVisibleWeekEnd(today);
    await request(app)
      .post("/api/records/checkins")
      .auth(a.token, { type: "bearer" })
      .send({ mood: "Calm", day: today })
      .expect(201);
    const draft = await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({ endDate, today, timeZone })
      .expect(200);
    assert.equal(draft.body.hasActivity, true);
    assert.equal(draft.body.period.end, endDate);
    assert.equal(draft.body.facts.checkins, 1);
    const writing = {
      id: "weekly-test-first",
      text: "I chose to pause for a minute.",
      day: today,
      weeklyPeriod: draft.body.period,
      weeklyProvider: draft.body.provider,
    };
    const saved = await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send(writing)
      .expect(201);
    const replay = await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send(writing)
      .expect(200);
    assert.deepEqual(replay.body.record, saved.body.record);
    await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send({ ...writing, id: "weekly-test-other", text: "Different draft" })
      .expect(409);
    await request(app)
      .post("/api/records/reflections")
      .auth(b.token, { type: "bearer" })
      .send({
        ...writing,
        id: "weekly-test-second-account",
        text: "A separate story for the same week.",
      })
      .expect(201);
    const path = `/api/records/reflections/${saved.body.record.id}`;
    const changed = await request(app)
      .patch(path)
      .auth(a.token, { type: "bearer" })
      .send({ text: "I chose to pause and listen." })
      .expect(200);
    assert.equal(changed.body.record.text, "I chose to pause and listen.");
    assert.deepEqual(changed.body.record.weeklyPeriod, draft.body.period);
    assert.equal(changed.body.record.weeklyProvider, "offline");
    await request(app)
      .patch(path)
      .auth(a.token, { type: "bearer" })
      .send({
        weeklyPeriod: { start: "2026-11-02", end: "2026-11-08" },
        weeklyProvider: "live",
      })
      .expect(409);
    await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "Invalid period",
        weeklyPeriod: { start: today, end: "2026-02-30" },
      })
      .expect(400);
    await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "Future period",
        weeklyPeriod: { start: "9999-12-20", end: "9999-12-26" },
      })
      .expect(400);
    await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({ endDate: "9999-12-26", today, timeZone })
      .expect(400);
    await request(app)
      .post("/api/insights/weekly")
      .auth(a.token, { type: "bearer" })
      .send({ endDate, today, timeZone: "Invalid/Zone" })
      .expect(400);
    await request(app)
      .patch(path)
      .auth(b.token, { type: "bearer" })
      .send({ text: "Different account" })
      .expect(404);
    await request(app)
      .delete(path)
      .auth(b.token, { type: "bearer" })
      .expect(404);
    await request(app)
      .delete(path)
      .auth(a.token, { type: "bearer" })
      .expect(204);
    const state = await request(app)
      .get("/api/state")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(state.body.data.reflections.length, 0);
  } finally {
    store.close();
  }
});
test("AI-assisted weekly questions receive counts only and cannot replace factual totals", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    await request(app)
      .post("/api/records/reflections")
      .auth(a.token, { type: "bearer" })
      .send({ text: "private-writing-never-send" })
      .expect(201);
    await withFetch(
      (async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.doesNotMatch(body.input, /private-writing-never-send/);
        assert.equal(JSON.parse(body.input).reflections, 1);
        assert.equal(JSON.parse(body.input).days, undefined);
        return providerResponse({
          invitation: "What would you like to make a little room for next?",
        });
      }) as typeof fetch,
      async () => {
        const result = await request(app)
          .post("/api/insights/weekly")
          .auth(a.token, { type: "bearer" })
          .send({})
          .expect(200);
        assert.equal(result.body.provider, "live");
        assert.match(result.body.reflection, /saved 1 reflection/);
      },
    );
    for (const invitation of [
      "Your mood improved by 50 percent.",
      "You cannot make time for yourself. What would change that?",
    ]) {
      await withFetch(
        (async () => providerResponse({ invitation })) as typeof fetch,
        async () => {
          await request(app)
            .post("/api/insights/weekly")
            .auth(a.token, { type: "bearer" })
            .send({})
            .expect(502);
        },
      );
    }
  } finally {
    store.close();
  }
});
test(
  "cancelled weekly drafting aborts the provider request and lets the owner retry",
  { timeout: 5000 },
  async () => {
    const { app, store, create } = await fixture(live);
    const server = app.listen(0, "127.0.0.1");
    const controller = new AbortController();
    try {
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const a = await create();
      await request(app)
        .post("/api/records/checkins")
        .auth(a.token, { type: "bearer" })
        .send({ mood: "Calm" })
        .expect(201);
      const clientFetch = globalThis.fetch;
      let notifyStart!: () => void;
      let notifyAbort!: () => void;
      const started = new Promise<void>((resolve) => {
        notifyStart = resolve;
      });
      const aborted = new Promise<void>((resolve) => {
        notifyAbort = resolve;
      });
      let calls = 0;
      await withFetch(
        (async (_url, init) => {
          if (++calls > 1)
            return providerResponse({
              invitation: "What would you like to carry forward?",
            });
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("Provider request aborted"));
                notifyAbort();
              },
              { once: true },
            );
            notifyStart();
          });
        }) as typeof fetch,
        async () => {
          const cancelled = assert.rejects(
            clientFetch(
              `http://127.0.0.1:${address.port}/api/insights/weekly`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${a.token}`,
                  "Content-Type": "application/json",
                },
                body: "{}",
                signal: controller.signal,
              },
            ),
            { name: "AbortError" },
          );
          await started;
          controller.abort();
          await cancelled;
          await aborted;
          const retry = await request(app)
            .post("/api/insights/weekly")
            .auth(a.token, { type: "bearer" })
            .send({})
            .expect(200);
          assert.equal(retry.body.provider, "live");
          assert.equal(calls, 2);
          const state = await request(app)
            .get("/api/state")
            .auth(a.token, { type: "bearer" })
            .expect(200);
          assert.equal(state.body.data.reflections.length, 0);
        },
      );
    } finally {
      controller.abort();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    }
  },
);
test("voice capability is honest when unconfigured and private routes require authentication", async () => {
  const { app, store, create } = await fixture();
  try {
    await request(app).get("/api/capabilities").expect(401);
    const a = await create();
    const capabilities = await request(app)
      .get("/api/capabilities")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(capabilities.body.voiceTranscription, false);
    await request(app)
      .post("/api/voice/transcribe")
      .auth(a.token, { type: "bearer" })
      .set("Content-Type", "audio/mp4")
      .send(Buffer.alloc(64))
      .expect(503);
  } finally {
    store.close();
  }
});
test("voice forwards only bounded audio as multipart with a server-side model and returns a real provider transcript", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    await withFetch(
      (async (url, init) => {
        assert.match(String(url), /\/audio\/transcriptions$/);
        assert.ok(init?.body instanceof FormData);
        const form = init.body as FormData;
        assert.equal(form.get("model"), "test-transcription-model");
        assert.equal((form.get("file") as File).size, 64);
        assert.equal((form.get("file") as File).name, "solace-voice.m4a");
        return Response.json({ text: "I would like a quiet moment." });
      }) as typeof fetch,
      async () => {
        const result = await request(app)
          .post("/api/voice/transcribe")
          .auth(a.token, { type: "bearer" })
          .set("Content-Type", "audio/mp4")
          .send(Buffer.alloc(64))
          .expect(200);
        assert.equal(result.body.text, "I would like a quiet moment.");
        assert.equal(result.body.provider, "live");
      },
    );
    const state = await request(app)
      .get("/api/state")
      .auth(a.token, { type: "bearer" })
      .expect(200);
    assert.equal(state.body.data.conversations.length, 0);
    assert.equal(state.body.data.sessions.length, 0);
  } finally {
    store.close();
  }
});
test("voice rejects unsupported, empty, oversized and malformed provider audio without invented text", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    await request(app)
      .post("/api/voice/transcribe")
      .auth(a.token, { type: "bearer" })
      .set("Content-Type", "text/plain")
      .send("hello")
      .expect(415);
    await request(app)
      .post("/api/voice/transcribe")
      .auth(a.token, { type: "bearer" })
      .set("Content-Type", "audio/mp4")
      .send(Buffer.alloc(1))
      .expect(400);
    await request(app)
      .post("/api/voice/transcribe")
      .auth(a.token, { type: "bearer" })
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(AUDIO_MAX_BYTES + 1))
      .expect(413);
    for (const text of ["", "x".repeat(4001)])
      await withFetch(
        (async () => Response.json({ text })) as typeof fetch,
        async () => {
          const result = await request(app)
            .post("/api/voice/transcribe")
            .auth(a.token, { type: "bearer" })
            .set("Content-Type", "audio/mp4")
            .send(Buffer.alloc(64))
            .expect(502);
          assert.equal(result.body.text, undefined);
        },
      );
  } finally {
    store.close();
  }
});
test("a late transcription cannot return after logout", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    let started!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (started = resolve));
    await withFetch(
      (async () => {
        started();
        return new Promise<Response>(
          (resolve) =>
            (release = () => resolve(Response.json({ text: "Test words" }))),
        );
      }) as typeof fetch,
      async () => {
        const pending = request(app)
          .post("/api/voice/transcribe")
          .auth(a.token, { type: "bearer" })
          .set("Content-Type", "audio/mp4")
          .send(Buffer.alloc(64))
          .then((result) => result);
        await waiting;
        await request(app)
          .post("/api/auth/logout")
          .auth(a.token, { type: "bearer" })
          .expect(204);
        release();
        const result = await pending;
        assert.equal(result.status, 401);
        assert.equal(result.body.text, undefined);
      },
    );
  } finally {
    store.close();
  }
});

test("generated activities, preferences and goals survive a database close/reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "solace-features-"));
  let store = await Store.open(join(directory, "test.sqlite"));
  try {
    let app = createApp({ store, ai: offline, rateLimits: false });
    const account = (
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Persistence QA",
          email: "persist-features@solace.test",
          password: "feature-test-password",
        })
        .expect(201)
    ).body;
    const activity = curatedMoment("rest", "twilight");
    await request(app)
      .post("/api/records/sessions")
      .auth(account.token, { type: "bearer" })
      .send({
        id: "persisted-generated",
        kind: "generated",
        activity,
        environment: "twilight",
        durationSec: 90,
        completed: true,
        feedback: "A little",
      })
      .expect(201);
    await request(app)
      .post("/api/records/preferences")
      .auth(account.token, { type: "bearer" })
      .send({
        id: "wellness",
        environment: "twilight",
        ambientEnabled: true,
        streaksEnabled: false,
      })
      .expect(201);
    await request(app)
      .post("/api/records/goals")
      .auth(account.token, { type: "bearer" })
      .send({ title: "A little space", targetMinutesPerWeek: 10, active: true })
      .expect(201);
    store.close();
    store = await Store.open(join(directory, "test.sqlite"));
    app = createApp({ store, ai: offline, rateLimits: false });
    const state = (
      await request(app)
        .get("/api/state")
        .auth(account.token, { type: "bearer" })
        .expect(200)
    ).body.data;
    assert.equal(state.sessions[0].activity.id, activity.id);
    assert.equal(state.sessions[0].feedback, "A little");
    assert.equal(state.preferences[0].environment, "twilight");
    assert.equal(state.preferences[0].streaksEnabled, false);
    assert.equal(state.goals[0].targetMinutesPerWeek, 10);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test("a pending personalized chat cannot retain deleted memory or revoked consent", async () => {
  for (const revoke of [false, true]) {
    const { app, store, create } = await fixture(live);
    try {
      const a = await create();
      const memory = await remember(app, a.token);
      let started!: () => void;
      let release!: () => void;
      const waiting = new Promise<void>((resolve) => (started = resolve));
      await withFetch(
        (async () => {
          started();
          return new Promise<Response>(
            (resolve) =>
              (release = () =>
                resolve(
                  chatOutput("A reply based on now-removed personalization."),
                )),
          );
        }) as typeof fetch,
        async () => {
          const pending = request(app)
            .post("/api/chat")
            .auth(a.token, { type: "bearer" })
            .send({ text: "Can we make a little space?" })
            .then((result) => result);
          await waiting;
          if (revoke)
            await request(app)
              .patch("/api/auth/me")
              .auth(a.token, { type: "bearer" })
              .send({ personalization: false })
              .expect(200);
          else
            await request(app)
              .delete(`/api/records/memories/${memory.id}`)
              .auth(a.token, { type: "bearer" })
              .expect(204);
          release();
          const response = await pending;
          assert.equal(response.status, 409);
          assert.equal(response.body.code, "PERSONALIZATION_CHANGED");
          assert.equal(
            (
              await request(app)
                .get("/api/state")
                .auth(a.token, { type: "bearer" })
                .expect(200)
            ).body.data.conversations.length,
            0,
          );
        },
      );
    } finally {
      store.close();
    }
  }
});
test("weekly reflection cannot return stale facts after a source record is removed", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    const record = (
      await request(app)
        .post("/api/records/checkins")
        .auth(a.token, { type: "bearer" })
        .send({ mood: "Okay" })
        .expect(201)
    ).body.record;
    let started!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (started = resolve));
    await withFetch(
      (async () => {
        started();
        return new Promise<Response>(
          (resolve) =>
            (release = () =>
              resolve(
                providerResponse({
                  invitation: "What would you like to make room for next?",
                }),
              )),
        );
      }) as typeof fetch,
      async () => {
        const pending = request(app)
          .post("/api/insights/weekly")
          .auth(a.token, { type: "bearer" })
          .send({})
          .then((result) => result);
        await waiting;
        await request(app)
          .delete(`/api/records/checkins/${record.id}`)
          .auth(a.token, { type: "bearer" })
          .expect(204);
        release();
        const response = await pending;
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "WEEKLY_CHANGED");
        assert.equal(response.body.facts, undefined);
      },
    );
  } finally {
    store.close();
  }
});

test("forgetting a memory keeps visible history but resets future AI context and cannot be undone by rename", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    const memory = await remember(
      app,
      a.token,
      "I prefer grounding, with a private qa marker",
    );
    let turn = 0;
    let conversationId = "";
    await withFetch(
      (async (_url, init) => {
        const input = JSON.parse(String(init?.body));
        turn++;
        if (turn === 1)
          return chatOutput("I noticed your approved private qa marker.");
        assert.equal(input.input.length, 1);
        assert.equal(input.input[0].content, "Continue after forgetting");
        assert.doesNotMatch(JSON.stringify(input), /private qa marker/);
        return chatOutput("We can begin from what you choose to share now.");
      }) as typeof fetch,
      async () => {
        const first = await request(app)
          .post("/api/chat")
          .auth(a.token, { type: "bearer" })
          .send({ text: "Hello" })
          .expect(200);
        conversationId = first.body.conversation.id;
        await request(app)
          .delete(`/api/records/memories/${memory.id}`)
          .auth(a.token, { type: "bearer" })
          .expect(204);
        let state = (
          await request(app)
            .get("/api/state")
            .auth(a.token, { type: "bearer" })
            .expect(200)
        ).body.data;
        const reset = state.conversations[0];
        assert.equal(reset.contextResetMessageCount, 2);
        assert.ok(reset.contextResetAt);
        assert.ok(reset.contextResetId);
        const renamed = await request(app)
          .patch(`/api/records/conversations/${conversationId}`)
          .auth(a.token, { type: "bearer" })
          .send({
            title: "Renamed safely",
            contextResetMessageCount: 0,
            contextResetId: "client-undo",
          })
          .expect(200);
        assert.equal(renamed.body.record.contextResetMessageCount, 2);
        assert.equal(renamed.body.record.contextResetId, reset.contextResetId);
        await request(app)
          .post("/api/chat")
          .auth(a.token, { type: "bearer" })
          .send({ text: "Continue after forgetting", conversationId })
          .expect(200);
        state = (
          await request(app)
            .get("/api/state")
            .auth(a.token, { type: "bearer" })
            .expect(200)
        ).body.data;
        assert.equal(state.conversations[0].messages.length, 4);
        assert.match(
          state.conversations[0].messages[1].content,
          /private qa marker/,
        );
        assert.equal(state.conversations[0].contextResetMessageCount, 2);
      },
    );
  } finally {
    store.close();
  }
});
test("deleting a source conversation removes its memory and resets remaining conversation context", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const first = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "My first conversation" })
        .expect(200)
    ).body.conversation;
    await request(app)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "I prefer a quiet pause",
        approved: true,
        sourceConversationId: first.id,
      })
      .expect(201);
    const second = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Another conversation" })
        .expect(200)
    ).body.conversation;
    await request(app)
      .delete(`/api/records/conversations/${first.id}`)
      .auth(a.token, { type: "bearer" })
      .expect(204);
    const state = (
      await request(app)
        .get("/api/state")
        .auth(a.token, { type: "bearer" })
        .expect(200)
    ).body.data;
    assert.equal(state.memories.length, 0);
    assert.equal(state.conversations.length, 1);
    assert.equal(state.conversations[0].id, second.id);
    assert.equal(state.conversations[0].contextResetMessageCount, 2);
  } finally {
    store.close();
  }
});
test("a pending reply cannot restore context reset while personalization was already off", async () => {
  const { app: offlineApp, store, create } = await fixture();
  try {
    const a = await create();
    const first = (
      await request(offlineApp)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Earlier words" })
        .expect(200)
    ).body.conversation;
    const memory = (
      await request(offlineApp)
        .post("/api/records/memories")
        .auth(a.token, { type: "bearer" })
        .send({ text: "A remembered preference", approved: true })
        .expect(201)
    ).body.record;
    const app = createApp({ store, ai: live, rateLimits: false });
    let started!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (started = resolve));
    await withFetch(
      (async () => {
        started();
        return new Promise<Response>(
          (resolve) => (release = () => resolve(chatOutput("Stale reply"))),
        );
      }) as typeof fetch,
      async () => {
        const pending = request(app)
          .post("/api/chat")
          .auth(a.token, { type: "bearer" })
          .send({ text: "One more turn", conversationId: first.id })
          .then((result) => result);
        await waiting;
        await request(app)
          .delete(`/api/records/memories/${memory.id}`)
          .auth(a.token, { type: "bearer" })
          .expect(204);
        release();
        const result = await pending;
        assert.equal(result.status, 409);
        assert.equal(result.body.code, "CONTEXT_CHANGED");
        assert.equal(
          (
            await request(app)
              .get("/api/state")
              .auth(a.token, { type: "bearer" })
              .expect(200)
          ).body.data.conversations[0].messages.length,
          2,
        );
      },
    );
  } finally {
    store.close();
  }
});

test("activity source conversations must be owned and remain immutable after creation", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("source-other@solace.test");
    const source = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Source conversation" })
        .expect(200)
    ).body.conversation;
    const otherOwned = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Another owned conversation" })
        .expect(200)
    ).body.conversation;
    const foreign = (
      await request(app)
        .post("/api/chat")
        .auth(b.token, { type: "bearer" })
        .send({ text: "Other account's conversation" })
        .expect(200)
    ).body.conversation;
    for (const sourceConversationId of [foreign.id, "missing-source"])
      await request(app)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({ title: "A moment", completed: true, sourceConversationId })
        .expect(404);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({ title: "A moment", sourceConversationId: { id: source.id } })
      .expect(400);
    const session = (
      await request(app)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({
          title: "A moment",
          completed: true,
          sourceConversationId: source.id,
        })
        .expect(201)
    ).body.record;
    await request(app)
      .patch(`/api/records/sessions/${session.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ feedback: "Helped" })
      .expect(200);
    await request(app)
      .patch(`/api/records/sessions/${session.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceConversationId: foreign.id })
      .expect(404);
    await request(app)
      .patch(`/api/records/sessions/${session.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceConversationId: otherOwned.id })
      .expect(409);
    await request(app)
      .patch(`/api/records/sessions/${session.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceConversationId: null })
      .expect(409);
    const manual = (
      await request(app)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({ title: "Source-free activity", completed: true })
        .expect(201)
    ).body.record;
    await request(app)
      .patch(`/api/records/sessions/${manual.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceConversationId: source.id })
      .expect(409);
    assert.equal(
      (
        await request(app)
          .get("/api/state")
          .auth(a.token, { type: "bearer" })
          .expect(200)
      ).body.data.sessions.find((record: any) => record.id === session.id)
        .sourceConversationId,
      source.id,
    );
  } finally {
    store.close();
  }
});
test("session-derived memory inherits its canonical owned conversation and source edits cannot detach it", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("memory-source-other@solace.test");
    const conversation = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Choose an activity" })
        .expect(200)
    ).body.conversation;
    const other = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "Unrelated activity" })
        .expect(200)
    ).body.conversation;
    const session = (
      await request(app)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({
          title: "Breathing",
          completed: true,
          sourceConversationId: conversation.id,
        })
        .expect(201)
    ).body.record;
    const memory = (
      await request(app)
        .post("/api/records/memories")
        .auth(a.token, { type: "bearer" })
        .send({
          text: "Short grounding sessions help me",
          approved: true,
          sourceType: "session",
          sourceId: session.id,
        })
        .expect(201)
    ).body.record;
    assert.equal(memory.sourceConversationId, conversation.id);
    await request(app)
      .post("/api/records/memories")
      .auth(b.token, { type: "bearer" })
      .send({
        text: "Foreign source",
        approved: true,
        sourceType: "session",
        sourceId: session.id,
      })
      .expect(404);
    await request(app)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "Misleading source",
        sourceType: "session",
        sourceId: session.id,
        sourceConversationId: other.id,
      })
      .expect(404);
    await request(app)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({ text: "Incomplete source", sourceType: "session" })
      .expect(404);
    const corrected = (
      await request(app)
        .patch(`/api/records/memories/${memory.id}`)
        .auth(a.token, { type: "bearer" })
        .send({
          text: "I prefer brief grounding",
          category: "activity",
          sourceConversationId: null,
        })
        .expect(200)
    ).body.record;
    assert.equal(corrected.sourceConversationId, conversation.id);
    await request(app)
      .patch(`/api/records/memories/${memory.id}`)
      .auth(a.token, { type: "bearer" })
      .send({
        sourceType: "conversation",
        sourceId: other.id,
        sourceConversationId: other.id,
      })
      .expect(409);
    const manual = (
      await request(app)
        .post("/api/records/memories")
        .auth(a.token, { type: "bearer" })
        .send({ text: "A manual preference", approved: true })
        .expect(201)
    ).body.record;
    await request(app)
      .patch(`/api/records/memories/${manual.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceType: "session", sourceId: session.id })
      .expect(409);
  } finally {
    store.close();
  }
});
test("conversation deletion cascades through session-derived legacy memories without deleting activity history", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const b = await create("cascade-other@solace.test");
    const source = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "A source conversation" })
        .expect(200)
    ).body.conversation;
    const retained = (
      await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "A retained conversation" })
        .expect(200)
    ).body.conversation;
    const session = (
      await request(app)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({
          title: "Grounding",
          completed: true,
          sourceConversationId: source.id,
        })
        .expect(201)
    ).body.record;
    const memory = (
      await request(app)
        .post("/api/records/memories")
        .auth(a.token, { type: "bearer" })
        .send({
          text: "I prefer grounding",
          approved: true,
          sourceType: "session",
          sourceId: session.id,
        })
        .expect(201)
    ).body.record;
    // Simulate a persisted legacy preference created before canonical inheritance existed.
    delete memory.sourceConversationId;
    store.transaction(() =>
      store.run(
        "UPDATE records SET json=? WHERE user_id=? AND collection='memories' AND id=?",
        [JSON.stringify(memory), a.user.id, memory.id],
      ),
    );
    await request(app)
      .post("/api/records/memories")
      .auth(b.token, { type: "bearer" })
      .send({
        id: memory.id,
        text: "Independent other-account preference",
        approved: true,
      })
      .expect(201);
    await request(app)
      .delete(`/api/records/conversations/${source.id}`)
      .auth(a.token, { type: "bearer" })
      .expect(204);
    const state = (
      await request(app)
        .get("/api/state")
        .auth(a.token, { type: "bearer" })
        .expect(200)
    ).body.data;
    assert.equal(state.memories.length, 0);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].sourceConversationId, source.id);
    assert.equal(state.conversations[0].id, retained.id);
    assert.equal(state.conversations[0].contextResetMessageCount, 2);
    assert.equal(
      (
        await request(app)
          .get("/api/state")
          .auth(b.token, { type: "bearer" })
          .expect(200)
      ).body.data.memories.length,
      1,
    );
    await request(app)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "Cannot revive a deleted source",
        approved: true,
        sourceType: "session",
        sourceId: session.id,
      })
      .expect(404);
    await request(app)
      .post("/api/records/sessions")
      .auth(a.token, { type: "bearer" })
      .send({
        title: "Cannot reuse a deleted source",
        sourceConversationId: source.id,
      })
      .expect(404);
    await request(app)
      .patch(`/api/records/sessions/${session.id}`)
      .auth(a.token, { type: "bearer" })
      .send({ sourceConversationId: source.id, feedback: "Helped" })
      .expect(404);
    await request(app)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "A new explicitly entered manual preference",
        approved: true,
      })
      .expect(201);
  } finally {
    store.close();
  }
});
test("a session's deleted conversation cannot influence a late generated recommendation", async () => {
  const { app: offlineApp, store, create } = await fixture();
  try {
    const a = await create();
    const source = (
      await request(offlineApp)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: "A source" })
        .expect(200)
    ).body.conversation;
    const session = (
      await request(offlineApp)
        .post("/api/records/sessions")
        .auth(a.token, { type: "bearer" })
        .send({
          title: "Grounding",
          completed: true,
          sourceConversationId: source.id,
        })
        .expect(201)
    ).body.record;
    await request(offlineApp)
      .patch("/api/auth/me")
      .auth(a.token, { type: "bearer" })
      .send({ personalization: true })
      .expect(200);
    await request(offlineApp)
      .post("/api/records/memories")
      .auth(a.token, { type: "bearer" })
      .send({
        text: "I prefer grounding",
        approved: true,
        sourceType: "session",
        sourceId: session.id,
      })
      .expect(201);
    const app = createApp({ store, ai: live, rateLimits: false });
    let started!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => (started = resolve));
    await withFetch(
      (async (_url, init) => {
        const input = JSON.parse(JSON.parse(String(init?.body)).input);
        assert.match(input.approvedPreference, /grounding/);
        started();
        return new Promise<Response>(
          (resolve) =>
            (release = () => resolve(providerResponse(input.template))),
        );
      }) as typeof fetch,
      async () => {
        const pending = request(app)
          .post("/api/moments/generate")
          .auth(a.token, { type: "bearer" })
          .send({ feeling: "I need a minute" })
          .then((result) => result);
        await waiting;
        await request(app)
          .delete(`/api/records/conversations/${source.id}`)
          .auth(a.token, { type: "bearer" })
          .expect(204);
        release();
        const response = await pending;
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "PERSONALIZATION_CHANGED");
        assert.equal(response.body.activity, undefined);
      },
    );
  } finally {
    store.close();
  }
});

test("explicit first-person death wishes and inability to stay safe bypass providers for chat and Moments", async () => {
  const { app, store, create } = await fixture(live);
  try {
    const a = await create();
    const phrases = [
      "I want to die",
      "I just want to die",
      "I wish I was dead",
      "I wish I were dead",
      "I cannot keep myself safe",
      "I can't keep myself safe",
      "I can’t keep myself safe",
      "I’m unable to keep myself safe",
      "I don't think I can keep myself safe",
      "I don’t feel able to keep myself safe",
      "I don't want to live",
      "I don’t want to live",
      "I cannot\nkeep myself safe",
    ];
    await withFetch(
      (async () => {
        throw new Error("Explicit urgent language must not call a provider");
      }) as typeof fetch,
      async () => {
        for (const phrase of phrases) {
          assert.equal(isUrgent(phrase), true, phrase);
          const moment = await request(app)
            .post("/api/moments/generate")
            .auth(a.token, { type: "bearer" })
            .send({ feeling: phrase })
            .expect(200);
          assert.equal(moment.body.activity, null, phrase);
          assert.equal(moment.body.support, true, phrase);
          assert.equal(moment.body.provider, "offline", phrase);
          assert.match(moment.body.message, /local emergency services/);
          const chat = await request(app)
            .post("/api/chat")
            .auth(a.token, { type: "bearer" })
            .send({ text: phrase })
            .expect(200);
          assert.equal(chat.body.support, true, phrase);
          assert.equal(chat.body.safety, true, phrase);
          assert.equal(chat.body.provider, "offline", phrase);
          assert.equal(chat.body.action, undefined, phrase);
          assert.match(chat.body.reply, /support from a person/);
        }
      },
    );
    const state = (
      await request(app)
        .get("/api/state")
        .auth(a.token, { type: "bearer" })
        .expect(200)
    ).body.data;
    assert.equal(state.sessions.length, 0);
  } finally {
    store.close();
  }
});
test("ordinary tiredness, common idioms and negated death wishes keep the normal conversation/activity flow", async () => {
  const { app, store, create } = await fixture();
  try {
    const a = await create();
    const phrases = [
      "I am tired",
      "I am dead tired",
      "I'm exhausted after work",
      "I can't keep up with my deadlines",
      "I don't want to die",
      "I want to die laughing at a comedy",
      "I wish I was dead tired so I could sleep",
    ];
    for (const phrase of phrases) {
      assert.equal(isUrgent(phrase), false, phrase);
      const moment = await request(app)
        .post("/api/moments/generate")
        .auth(a.token, { type: "bearer" })
        .send({ feeling: phrase })
        .expect(200);
      assert.ok(moment.body.activity, phrase);
      assert.equal(moment.body.support, undefined, phrase);
      const chat = await request(app)
        .post("/api/chat")
        .auth(a.token, { type: "bearer" })
        .send({ text: phrase })
        .expect(200);
      assert.equal(chat.body.support, undefined, phrase);
      assert.equal(chat.body.safety, undefined, phrase);
    }
  } finally {
    store.close();
  }
});
