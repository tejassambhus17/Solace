import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";
import type { AIConfig } from "../src/generation.js";
import { habitDay } from "../src/habit-contract.js";

const offline: AIConfig = {
  mode: "offline",
  model: "habit-qa",
  baseUrl: "https://example.invalid",
};
const gemini: AIConfig = {
  ...offline,
  mode: "live",
  gemini: { apiKey: "synthetic-test-key", model: "gemini-3.1-flash-lite" },
};
const response = (value: unknown) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
const selected = { starter: "walk", days: 3, target: 5, anchor: "morning" };

async function fixture(ai = offline) {
  const store = await Store.open(":memory:");
  const app = createApp({ store, ai, rateLimits: false });
  async function account(name = "Habit QA") {
    const result = await request(app)
      .post("/api/auth/register")
      .send({
        name,
        email: `${randomUUID()}@example.test`,
        password: "TestPassword7",
      })
      .expect(201);
    return result.body.token as string;
  }
  const suggest = (token: string, input: object) =>
    request(app)
      .post("/api/habits/suggest")
      .auth(token, { type: "bearer" })
      .send(input);
  const state = async (token: string) =>
    (
      await request(app)
        .get("/api/state")
        .auth(token, { type: "bearer" })
        .expect(200)
    ).body.data;
  const personalize = (token: string, value: boolean) =>
    request(app)
      .patch("/api/auth/me")
      .auth(token, { type: "bearer" })
      .send({ personalization: value })
      .expect(200);
  async function createHabit(token: string, name = "Private habit title") {
    const id = randomUUID();
    const { body } = await request(app)
      .post("/api/habits")
      .auth(token, { type: "bearer" })
      .send({
        id,
        name,
        description: "Private habit description",
        category: "movement",
        icon: "walk",
        color: "sage",
        goal: { type: "duration", target: 20 },
        schedule: { type: "daily" },
        reminderTime: "08:00",
        timeZone: "UTC",
      })
      .expect(201);
    return body.habit;
  }
  return { store, app, account, suggest, state, personalize, createHabit };
}

async function mockedProvider<T>(mock: typeof fetch, action: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await action();
  } finally {
    globalThis.fetch = original;
  }
}

test("guided habit suggestion is authorized, structured, editable and never writes a record", async () => {
  const { store, app, account, suggest, state } = await fixture();
  try {
    await request(app)
      .post("/api/habits/suggest")
      .send({ intent: "routine", prompt: "A short walk" })
      .expect(401);
    const token = await account();
    const { body } = await suggest(token, {
      intent: "routine",
      prompt: "I want to walk three times this week in my morning routine.",
    }).expect(200);
    assert.equal(body.provider, "offline");
    assert.equal(body.suggestion.name, "Take a short walk");
    assert.deepEqual(body.suggestion.goal, { type: "duration", target: 5 });
    assert.deepEqual(body.suggestion.schedule, {
      type: "weekly",
      daysPerWeek: 3,
    });
    assert.equal(body.suggestion.reminderTime, null);
    assert.equal((await state(token)).habits.length, 0);
    await suggest(token, {
      intent: "invent",
      prompt: "Something",
      owner: "other",
    }).expect(400);
  } finally {
    store.close();
  }
});

test("schedule adjustments use only the selected owner's habit and leave existing records intact", async () => {
  const { store, account, suggest, state, createHabit } = await fixture();
  try {
    const owner = await account();
    const other = await account();
    const habit = await createHabit(owner);
    const input = {
      intent: "adjust",
      prompt: "Could I try twice a week?",
      habitId: habit.id,
    };
    await suggest(other, input).expect(404);
    const { body } = await suggest(owner, input).expect(200);
    assert.equal(body.habitId, habit.id);
    assert.equal(body.revision, habit.revision);
    assert.deepEqual(body.suggestion.goal, habit.goal);
    assert.deepEqual(body.suggestion.schedule, {
      type: "weekly",
      daysPerWeek: 2,
    });
    assert.equal(body.suggestion.reminderTime, "08:00");
    assert.deepEqual((await state(owner)).habits, [habit]);
  } finally {
    store.close();
  }
});

test("AI receives only requested counts and selected goal settings, never private titles or identity", async () => {
  const { store, app, account, suggest, personalize, createHabit } =
    await fixture(gemini);
  try {
    const token = await account("Private account name");
    const habit = await createHabit(token);
    const other = await account();
    const otherHabit = await createHabit(other);
    const day = habitDay("UTC");
    for (const [id, credential] of [
      [habit.id, token],
      [otherHabit.id, other],
    ]) {
      await request(app)
        .put(`/api/habits/${id}/progress`)
        .auth(credential, { type: "bearer" })
        .send({ day, amount: 20, expectedRevision: 0 })
        .expect(200);
    }
    const reflection = {
      intent: "reflect",
      prompt: "Help me notice what worked",
      includeProgress: true,
      timeZone: "UTC",
    };
    await suggest(token, reflection).expect(403);
    await personalize(token, true);
    const inputs: unknown[] = [];
    await mockedProvider(
      async (url, init) => {
        assert.match(String(url), /generativelanguage\.googleapis\.com/);
        const payload = JSON.parse(String(init?.body));
        assert.equal(payload.store, false);
        assert.equal(
          payload.generationConfig.responseMimeType,
          "application/json",
        );
        assert.doesNotMatch(
          JSON.stringify(payload),
          /Private habit|Private account|synthetic-test-key/,
        );
        inputs.push(JSON.parse(payload.contents[0].parts[0].text));
        return response(selected);
      },
      async () => {
        const { body } = await suggest(token, reflection).expect(200);
        assert.equal(body.provider, "live");
        assert.equal(body.suggestion, undefined);
        assert.match(body.note, /1 completion across 1 day/);
        await suggest(token, {
          intent: "adjust",
          prompt: "Reduce my weekly frequency",
          habitId: habit.id,
        }).expect(200);
      },
    );
    assert.deepEqual(inputs, [
      {
        intention: "reflect",
        idea: reflection.prompt,
        progress: { completions: 1, activeDays: 1 },
      },
      {
        intention: "adjust",
        idea: "Reduce my weekly frequency",
        selectedHabit: { goalType: "duration", target: 20, days: 7 },
      },
    ]);
  } finally {
    store.close();
  }
});

test("invalid provider structures are rejected and urgent text bypasses the provider", async () => {
  const { store, account, suggest, state } = await fixture(gemini);
  try {
    const token = await account();
    let calls = 0;
    await mockedProvider(
      async () => {
        calls++;
        return response({
          ...selected,
          starter: "unrecognized",
          hiddenRoute: "/api/auth/me",
        });
      },
      async () => {
        await suggest(token, {
          intent: "suggest",
          prompt: "Try a small walk",
        }).expect(502);
        const { body } = await suggest(token, {
          intent: "suggest",
          prompt: "I want to end my life.",
        }).expect(200);
        assert.equal(body.support, true);
        assert.equal(body.suggestion, undefined);
      },
    );
    assert.equal(calls, 1);
    assert.equal((await state(token)).habits.length, 0);
  } finally {
    store.close();
  }
});

test("revoking personalization during generation discards the now-stale reflection", async () => {
  const { store, account, suggest, personalize } = await fixture(gemini);
  try {
    const token = await account();
    await personalize(token, true);
    let signalEntered!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await mockedProvider(
      async () => {
        signalEntered();
        await hold;
        return response(selected);
      },
      async () => {
        const pending = suggest(token, {
          intent: "reflect",
          prompt: "How has my routine gone?",
          includeProgress: true,
        })
          .expect(409)
          .then((result) => result.body);
        await entered;
        await personalize(token, false);
        release();
        assert.equal((await pending).code, "HABIT_CONTEXT_CHANGED");
      },
    );
  } finally {
    store.close();
  }
});
