import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { AIConfig } from "../src/ai.js";
import { Store } from "../src/database.js";
import { MAX_JOURNAL_EXCERPT } from "../src/journal-contract.js";
import { journalExcerpts } from "../../src/journal-excerpts.js";

const ai: AIConfig = {
  mode: "live",
  baseUrl: "https://api.openai.com/v1",
  model: "test-openai",
  apiKey: "fixture-openai",
  gemini: { apiKey: "fixture-gemini", model: "test-gemini" },
  openAIFallback: true,
};

function providerTurn(value: Record<string, string>) {
  return Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
}

async function register(app: ReturnType<typeof createApp>, identifier: string) {
  const result = await request(app)
    .post("/api/auth/register")
    .send({
      name: `Synthetic ${identifier}`,
      email: `journal-ai-${identifier}@example.test`,
      password: "fixture-not-a-user-password",
    })
    .expect(201);
  return { Authorization: `Bearer ${result.body.token}` };
}

test("excerpt sections are bounded, never split emoji, and skip blank paragraphs", () => {
  const first = "A".repeat(MAX_JOURNAL_EXCERPT - 1) + "🌿";
  const body = `\n\n ${first}\n\n\n\nSeparate paragraph.\n\n`;
  const ranges = journalExcerpts(body);
  assert.ok(
    ranges.every(
      ({ start, end }) => end > start && end - start <= MAX_JOURNAL_EXCERPT,
    ),
  );
  assert.equal(
    ranges.map(({ start, end }) => body.slice(start, end).trim()).join(""),
    first + "Separate paragraph.",
  );
  assert.ok(
    ranges.some(({ start, end }) => body.slice(start, end).includes("🌿")),
  );
  assert.deepEqual(journalExcerpts(" \n\n "), []);
});

test("journal AI sends only the approved excerpt, isolates accounts and memory, and resets linked context on delete", async () => {
  const store = await Store.open(":memory:");
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  try {
    const app = createApp({ store, ai, rateLimits: false });
    const owner = await register(app, "owner");
    const other = await register(app, "other");
    const selected =
      "The synthetic fixture feels overwhelmed by an upcoming class.";
    const privateText = "PRIVATE UNSELECTED CONTENT";
    const body = `${privateText}\n\n${selected}\n\nPRIVATE TRAILING CONTENT`;
    let response = providerTurn({
      reflection:
        "It sounds like there is a lot on your mind. Grounding could offer a short pause.",
      practice: "grounding",
    });
    globalThis.fetch = async (url, init) => {
      assert.match(
        String(url),
        /^https:\/\/generativelanguage\.googleapis\.com\//,
      );
      calls.push(String(init?.body));
      return response.clone();
    };
    await request(app)
      .patch("/api/auth/me")
      .set(owner)
      .send({ personalization: true })
      .expect(200);
    await request(app)
      .post("/api/records/memories")
      .set(owner)
      .send({
        category: "preference",
        approved: true,
        text: "UNRELATED APPROVED PREFERENCE",
      })
      .expect(201);
    const { record: entry } = (
      await request(app)
        .post("/api/records/reflections")
        .set(owner)
        .send({
          kind: "journal",
          title: "PRIVATE TITLE",
          text: body,
        })
        .expect(201)
    ).body;
    const selection = {
      start: body.indexOf(selected),
      end: body.indexOf(selected) + selected.length,
      revision: entry.updatedAt,
    };
    const reflect = `/api/journal/${entry.id}/reflect`;
    const discuss = `/api/journal/${entry.id}/discuss`;
    const requestId = randomUUID();
    await request(app).get("/api/records/reflections").set(owner).expect(200);
    await request(app)
      .post(reflect)
      .set(other)
      .send({ ...selection, action: "grounding" })
      .expect(404);
    await request(app)
      .post(discuss)
      .set(other)
      .send({ ...selection, requestId })
      .expect(404);
    await request(app)
      .post(reflect)
      .set(owner)
      .send({ ...selection, action: "grounding", text: body })
      .expect(400);
    await request(app)
      .post(reflect)
      .set(owner)
      .send({ ...selection, end: body.length + 1, action: "grounding" })
      .expect(409);
    assert.equal(calls.length, 0);
    const reflection = await request(app)
      .post(reflect)
      .set(owner)
      .send({ ...selection, action: "grounding" })
      .expect(200);
    assert.equal(reflection.body.provider, "live");
    assert.equal(reflection.body.practice, "grounding");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /upcoming class/);
    assert.doesNotMatch(calls[0], /PRIVATE|UNRELATED|Synthetic owner/);
    assert.equal(
      (
        await request(app)
          .get("/api/records/conversations")
          .set(owner)
          .expect(200)
      ).body.records.length,
      0,
    );

    response = providerTurn({
      reply:
        "It sounds like class has been on your mind. What part of it is weighing on you?",
      practice: "none",
      basis: "general",
    });
    const opened = await request(app)
      .post(discuss)
      .set(owner)
      .send({ ...selection, requestId })
      .expect(200);
    assert.equal(opened.body.provider, "live");
    assert.deepEqual(opened.body.conversation.journalSource, {
      id: entry.id,
      ...selection,
    });
    assert.doesNotMatch(
      JSON.stringify(opened.body.conversation),
      /synthetic fixture|PRIVATE/,
    );
    assert.equal(calls.length, 2);
    assert.match(calls[1], /upcoming class/);
    assert.doesNotMatch(calls[1], /PRIVATE|UNRELATED|Synthetic owner/);
    const retried = await request(app)
      .post(discuss)
      .set(owner)
      .send({ ...selection, requestId })
      .expect(200);
    assert.equal(retried.body.conversation.id, opened.body.conversation.id);
    await request(app)
      .post(discuss)
      .set(owner)
      .send({ ...selection, start: selection.start + 1, requestId })
      .expect(409);
    assert.equal(calls.length, 2);
    assert.equal(
      (await request(app).get("/api/records/memories").set(owner).expect(200))
        .body.records.length,
      1,
    );
    assert.equal(
      (
        await request(app)
          .get("/api/records/conversations")
          .set(other)
          .expect(200)
      ).body.records.length,
      0,
    );
    const conversationId = opened.body.conversation.id;
    await request(app)
      .post("/api/chat")
      .set(owner)
      .send({ text: "I have a presentation.", conversationId })
      .expect(200);
    assert.match(calls[2], /What part of it is weighing on you/);
    assert.doesNotMatch(calls[2], /synthetic fixture|PRIVATE/);

    await request(app)
      .delete(`/api/records/reflections/${entry.id}`)
      .set(owner)
      .expect(204);
    await request(app)
      .post(discuss)
      .set(owner)
      .send({ ...selection, requestId })
      .expect(404);
    const afterDelete = await request(app)
      .get("/api/records/conversations")
      .set(owner)
      .expect(200);
    assert.equal(afterDelete.body.records[0].journalSource, undefined);
    assert.equal(afterDelete.body.records[0].contextResetMessageCount, 4);
    await request(app)
      .post("/api/chat")
      .set(owner)
      .send({ text: "I am following up.", conversationId })
      .expect(200);
    assert.doesNotMatch(
      calls[3],
      /What part of it|synthetic fixture|PRIVATE|I have a presentation/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test("journal AI handles rate limits, stale consent, and urgent support without a second disclosure", async () => {
  const store = await Store.open(":memory:");
  const originalFetch = globalThis.fetch;
  try {
    const app = createApp({ store, ai, rateLimits: false });
    const auth = await register(app, "failure");
    const text = "The fixture is practicing after class.";
    const { record: entry } = (
      await request(app)
        .post("/api/records/reflections")
        .set(auth)
        .send({ kind: "journal", text })
        .expect(201)
    ).body;
    const reflect = `/api/journal/${entry.id}/reflect`;
    const discuss = `/api/journal/${entry.id}/discuss`;
    const selection = { start: 0, end: text.length, revision: entry.updatedAt };
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      assert.match(
        String(url),
        /^https:\/\/generativelanguage\.googleapis\.com\//,
      );
      return new Response(null, { status: 429 });
    };
    await request(app)
      .post(reflect)
      .set(auth)
      .send({ ...selection, action: "reflect" })
      .expect(429);
    await request(app)
      .post(discuss)
      .set(auth)
      .send({ ...selection, requestId: randomUUID() })
      .expect(429);
    assert.equal(calls, 2);
    assert.equal(
      (
        await request(app)
          .get("/api/records/conversations")
          .set(auth)
          .expect(200)
      ).body.records.length,
      0,
    );

    let pendingFetch!: () => void;
    const fetching = new Promise<void>((resolve) => {
      pendingFetch = resolve;
    });
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    globalThis.fetch = () => {
      pendingFetch();
      return pending;
    };
    const pendingDiscussion = request(app)
      .post(discuss)
      .set(auth)
      .send({ ...selection, requestId: randomUUID() })
      .then((value) => value);
    await fetching;
    const next = (
      await request(app)
        .patch(`/api/records/reflections/${entry.id}`)
        .set(auth)
        .send({ text: "I can't keep myself safe" })
        .expect(200)
    ).body.record;
    finish(
      providerTurn({
        reply: "Thanks for sharing. What could help you today?",
        practice: "none",
        basis: "general",
      }),
    );
    assert.equal((await pendingDiscussion).status, 409);
    assert.equal(
      (
        await request(app)
          .get("/api/records/conversations")
          .set(auth)
          .expect(200)
      ).body.records.length,
      0,
    );

    const urgentSelection = {
      start: 0,
      end: next.text.length,
      revision: next.updatedAt,
    };
    globalThis.fetch = async () => {
      assert.fail("Explicit distress must use local human support");
    };
    const safe = await request(app)
      .post(reflect)
      .set(auth)
      .send({ ...urgentSelection, action: "grounding" })
      .expect(200);
    assert.equal(safe.body.provider, "offline");
    assert.equal(safe.body.support, true);
    assert.equal(safe.body.practice, undefined);
    const safeChat = await request(app)
      .post(discuss)
      .set(auth)
      .send({ ...urgentSelection, requestId: randomUUID() })
      .expect(200);
    assert.equal(safeChat.body.provider, "offline");
    assert.equal(safeChat.body.support, true);
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test(
  "canceling a journal handoff aborts the provider and leaves no partial conversation",
  { timeout: 5000 },
  async () => {
    const store = await Store.open(":memory:");
    const app = createApp({ store, ai, rateLimits: false });
    const server = app.listen(0, "127.0.0.1");
    const clientFetch = globalThis.fetch;
    const controller = new AbortController();
    try {
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const auth = await register(app, "cancel");
      const text = "A synthetic excerpt about preparing for class.";
      const { record: entry } = (
        await request(app)
          .post("/api/records/reflections")
          .set(auth)
          .send({ kind: "journal", text })
          .expect(201)
      ).body;
      const path = `/api/journal/${entry.id}/discuss`;
      const input = {
        start: 0,
        end: text.length,
        revision: entry.updatedAt,
        requestId: randomUUID(),
      };
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      globalThis.fetch = (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
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
      const cancelled = assert.rejects(
        clientFetch(`http://127.0.0.1:${address.port}${path}`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        }),
        { name: "AbortError" },
      );
      await started.promise;
      controller.abort();
      await cancelled;
      await aborted.promise;
      const beforeRetry = await request(app)
        .get("/api/records/conversations")
        .set(auth)
        .expect(200);
      assert.deepEqual(beforeRetry.body.records, []);
      globalThis.fetch = async () =>
        providerTurn({
          reply: "How do you feel about getting ready?",
          practice: "none",
          basis: "general",
        });
      const retry = await request(app)
        .post(path)
        .set(auth)
        .send(input)
        .expect(200);
      assert.equal(retry.body.conversation.messages.length, 2);
    } finally {
      globalThis.fetch = clientFetch;
      controller.abort();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    }
  },
);
