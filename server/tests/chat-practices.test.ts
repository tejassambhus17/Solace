import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { getReply, type AIConfig } from "../src/ai.js";
import { chatPracticeIds } from "../src/chat-practice.js";
import { momentSchema } from "../src/moments.js";
import { createChatPractice } from "../../src/chat-practices.js";
import { journeySummary } from "../../src/progress.js";

const ai: AIConfig = {
  mode: "live",
  baseUrl: "https://api.openai.com/v1",
  model: "test-model",
  gemini: { apiKey: "test-provider", model: "test-gemini" },
};

function providerTurn(text: string) {
  return Response.json({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
  });
}

test("chat presets are stable, playable snapshots accepted by the completion API", () => {
  const practices = chatPracticeIds.map(createChatPractice);
  assert.equal(new Set(practices.map((practice) => practice.id)).size, 6);
  for (const practice of practices)
    assert.ok(momentSchema.safeParse(practice).success);
});

test("model text cannot create a card by mentioning a practice or choosing an unknown identifier", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    const input = {
      text: "Can we pause?",
      name: "QA",
      history: [],
      memories: [],
      context: [],
    };
    for (const text of [
      "A breathing pause might feel useful.",
      JSON.stringify({
        reply: "A short pause sounds useful.",
        practice: "private/settings",
      }),
    ]) {
      globalThis.fetch = async () => providerTurn(text);
      const result = await getReply(ai, input);
      assert.equal(result.provider, "live");
      assert.equal(result.action, undefined);
    }
  } finally {
    globalThis.fetch = fetchBefore;
  }
});

test("chat suggestion opens an owned practice that saves once and updates Journey", async () => {
  const store = await Store.open(":memory:");
  const fetchBefore = globalThis.fetch;
  try {
    const app = createApp({ store, ai, rateLimits: false });
    async function register(email: string) {
      const result = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Synthetic QA",
          email,
          password: "private-qa-password",
        })
        .expect(201);
      return { Authorization: `Bearer ${result.body.token}` };
    }
    const owner = await register("chat-moment-qa@example.test");
    const other = await register("chat-moment-other@example.test");
    let providerCalls = 0;
    globalThis.fetch = async (_url, init) => {
      providerCalls++;
      const body = JSON.parse(String(init?.body));
      assert.ok(
        body.generationConfig.responseJsonSchema.properties.practice.enum.includes(
          "focus",
        ),
      );
      return providerTurn(
        JSON.stringify({
          reply:
            "A short focus pause could give you room to choose one thing to do next.",
          practice: "focus",
        }),
      );
    };
    const turn = {
      text: "I have trouble concentrating on a synthetic task",
      requestId: randomUUID(),
    };
    const reply = await request(app)
      .post("/api/chat")
      .set(owner)
      .send(turn)
      .expect(200);
    const retry = await request(app)
      .post("/api/chat")
      .set(owner)
      .send(turn)
      .expect(200);
    assert.equal(providerCalls, 1);
    assert.deepEqual(retry.body.action, reply.body.action);
    assert.equal(reply.body.action.type, "focus");
    const activity = createChatPractice(reply.body.action.type);
    const completion = {
      id: "chat-focus-qa-completion",
      createdAt: new Date().toISOString(),
      kind: "generated",
      type: activity.type,
      title: activity.title,
      activity,
      environment: activity.environment,
      provider: "offline",
      durationSec: activity.durationSec,
      plannedDurationSec: activity.durationSec,
      completed: true,
      feedback: "Helped",
      source: "Solace chat",
      sourceConversationId: reply.body.conversation.id,
    };
    await request(app)
      .post("/api/records/sessions")
      .set(other)
      .send(completion)
      .expect(404);
    await request(app)
      .post("/api/records/sessions")
      .set(owner)
      .send(completion)
      .expect(201);
    await request(app)
      .post("/api/records/sessions")
      .set(owner)
      .send(completion)
      .expect(200);
    const state = (await request(app).get("/api/state").set(owner).expect(200))
      .body.data;
    const journey = journeySummary(state);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].feedback, "Helped");
    assert.equal(journey.completedCount, 1);
    assert.equal(journey.helpfulCount, 1);
    assert.equal(
      journey.milestones.find((milestone) => milestone.id === "first-moment")
        ?.earned,
      true,
    );
    assert.equal(state.conversations[0].messages[1].action.type, "focus");
  } finally {
    globalThis.fetch = fetchBefore;
    store.close();
  }
});
