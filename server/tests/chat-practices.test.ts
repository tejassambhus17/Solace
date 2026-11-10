import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import { getReply, type AIConfig } from "../src/ai.js";
import { chatPracticeIds } from "../src/chat-practice.js";
import {
  availableChatEvidence,
  describeChatExplanation,
} from "../src/chat-evidence.js";
import { momentSchema } from "../src/moments.js";
import {
  createChatPractice,
  shortChatPracticeReason,
} from "../../src/chat-practices.js";
import { journeySummary } from "../../src/progress.js";
import { openAIResponse } from "./openai-fixture.js";

const ai: AIConfig = {
  mode: "live",
  baseUrl: "https://api.openai.com/v1",
  model: "test-model",
  apiKey: "test-provider",
};

function providerTurn(text: string) {
  return openAIResponse(text, true);
}

test("chat presets are stable, playable snapshots accepted by the completion API", () => {
  const practices = chatPracticeIds.map(createChatPractice);
  assert.equal(new Set(practices.map((practice) => practice.id)).size, 6);
  for (const practice of practices)
    assert.ok(momentSchema.safeParse(practice).success);
});

test("short card reasons name a topic only when the user mentioned it and the basis is the conversation", () => {
  const conversation = {
    basis: "conversation",
    reason: "From this chat.",
  } as const;
  const general = { basis: "general", reason: "A general practice." } as const;
  const personalized = {
    basis: "personalized",
    reason: "An approved preference.",
  } as const;
  assert.equal(
    shortChatPracticeReason(
      "wind-down",
      conversation,
      "I want to relax before bed.",
    ),
    "You brought up bedtime.",
  );
  assert.equal(
    shortChatPracticeReason("wind-down", conversation, "Today was tiring."),
    "Based on what you shared in this conversation.",
  );
  assert.equal(
    shortChatPracticeReason(
      "wind-down",
      general,
      "I want to relax before bed.",
    ),
    general.reason,
  );
  assert.equal(
    shortChatPracticeReason(
      "wind-down",
      personalized,
      "I want to relax before bed.",
    ),
    personalized.reason,
  );
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

test("chat explanations only cite matching authorized evidence and hide it after correction or deletion", async () => {
  const store = await Store.open(":memory:");
  const fetchBefore = globalThis.fetch;
  try {
    const app = createApp({ store, ai, rateLimits: false });
    const registration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Synthetic QA",
        email: "explanation-qa@example.test",
        password: "private-qa-password",
      })
      .expect(201);
    const auth = { Authorization: `Bearer ${registration.body.token}` };
    const memory = (
      await request(app)
        .post("/api/records/memories")
        .set(auth)
        .send({
          category: "preference",
          text: "I prefer short grounding sessions.",
          approved: true,
        })
        .expect(201)
    ).body.record;
    let practice = "grounding";
    let sawGroundingBasis = false;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const instructions = body.instructions;
      sawGroundingBasis = instructions.includes(
        '{"kind":"approved-preference","practice":"grounding"}',
      );
      assert.ok(!instructions.includes(memory.id));
      return providerTurn(
        JSON.stringify({
          reply: "We could try an optional practice.",
          practice,
          basis: "approved-preference",
          evidence: { id: "invented-provider-id" },
        }),
      );
    };
    const chat = async () =>
      (
        await request(app)
          .post("/api/chat")
          .set(auth)
          .send({ text: "Can I try a short practice?" })
          .expect(200)
      ).body.action;
    assert.deepEqual((await chat()).explanation, { basis: "general" });
    assert.equal(sawGroundingBasis, false);

    await request(app)
      .patch("/api/auth/me")
      .set(auth)
      .send({ personalization: true })
      .expect(200);
    practice = "focus";
    assert.deepEqual((await chat()).explanation, { basis: "general" });
    assert.equal(sawGroundingBasis, true);

    practice = "grounding";
    const action = await chat();
    assert.equal(action.explanation.basis, "personalized");
    assert.equal(action.explanation.evidence.id, memory.id);
    assert.equal(action.explanation.evidence.kind, "approved-preference");
    const state = async () =>
      (await request(app).get("/api/state").set(auth).expect(200)).body.data;
    assert.equal(
      describeChatExplanation(
        action.explanation,
        "grounding",
        true,
        await state(),
      ).basis,
      "personalized",
    );
    assert.equal(
      describeChatExplanation(
        action.explanation,
        "grounding",
        false,
        await state(),
      ).basis,
      "general",
    );

    await request(app)
      .patch(`/api/records/memories/${memory.id}`)
      .set(auth)
      .send({ text: "I prefer short breathing sessions." })
      .expect(200);
    assert.equal(
      describeChatExplanation(
        action.explanation,
        "grounding",
        true,
        await state(),
      ).basis,
      "general",
    );
    await request(app)
      .delete(`/api/records/memories/${memory.id}`)
      .set(auth)
      .expect(204);
    assert.equal(
      describeChatExplanation(
        action.explanation,
        "grounding",
        true,
        await state(),
      ).basis,
      "general",
    );
    assert.deepEqual((await chat()).explanation, { basis: "general" });
  } finally {
    globalThis.fetch = fetchBefore;
    store.close();
  }
});

test("explanations use the latest mood and only helpful practices with approved linked feedback", () => {
  const now = Date.parse("2026-11-06T10:00:00.000Z");
  const createdAt = new Date(now).toISOString();
  const sources = {
    checkins: [{ id: "mood", createdAt, mood: "Stressed" }],
    sessions: [
      {
        id: "unhelpful",
        createdAt,
        type: "breathing",
        completed: true,
        feedback: "Not for me",
      },
      {
        id: "unfinished",
        createdAt,
        type: "breathing",
        completed: false,
        feedback: "Helped",
      },
      {
        id: "helpful",
        createdAt,
        type: "grounding",
        activity: { id: "chat-focus" },
        completed: true,
        feedback: "Helped",
      },
    ],
    memories: [
      {
        id: "negative",
        createdAt,
        category: "preference",
        approved: true,
        text: "I do not like breathing sessions.",
      },
    ],
  };
  assert.deepEqual(
    availableChatEvidence(sources, now).map(({ id, kind, practice }) => ({
      id,
      kind,
      practice,
    })),
    [{ id: "mood", kind: "checkin", practice: "breathing" }],
  );
  const approved = {
    ...sources,
    memories: [
      ...sources.memories,
      {
        id: "remembered-feedback",
        createdAt,
        category: "preference",
        approved: true,
        sourceType: "session",
        sourceId: "helpful",
        text: "I find grounding Moments helpful.",
      },
    ],
  };
  const evidence = availableChatEvidence(approved, now).find(
    (item) => item.kind === "helpful-moment",
  );
  assert.ok(evidence);
  assert.equal(evidence.id, "helpful");
  assert.equal(evidence.practice, "focus");
  const explanation = { basis: "personalized", evidence } as const;
  assert.equal(
    describeChatExplanation(explanation, "focus", true, approved).basis,
    "personalized",
  );
  assert.equal(
    describeChatExplanation(explanation, "focus", true, sources).basis,
    "general",
  );
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
        body.text.format.schema.properties.practice.enum.includes("focus"),
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
