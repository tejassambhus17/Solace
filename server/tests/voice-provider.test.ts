import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

test("OpenAI transcription bounds the audio, cancels on disconnect and releases the voice turn", async () => {
  const store = await Store.open(":memory:");
  const app = createApp({
    store,
    ai: {
      mode: "live",
      model: "fixture",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "fixture-key",
    },
    rateLimits: false,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const realFetch = globalThis.fetch;
  const client = new AbortController();
  const started = Promise.withResolvers<void>();
  const disconnected = Promise.withResolvers<void>();
  const audio = Buffer.alloc(48, 16);
  let calls = 0;
  try {
    const { token } = (
      await request(server)
        .post("/api/auth/register")
        .send({
          name: "Voice QA",
          email: "voice-cancel@solace.test",
          password: "fixture-only-password",
        })
        .expect(201)
    ).body;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "audio/mp4",
    };
    const capabilities = await request(server)
      .get("/api/capabilities")
      .set(headers)
      .expect(200);
    assert.equal(capabilities.body.voiceTranscription, true);
    assert.equal(capabilities.body.voiceSpeech, true);
    globalThis.fetch = async (url, options) => {
      if (String(url) === "data:,") return realFetch(url, options);
      calls++;
      try {
        assert.equal(
          String(url),
          "https://api.openai.com/v1/audio/transcriptions",
        );
        assert.equal(
          new Headers(options?.headers).get("authorization"),
          "Bearer fixture-key",
        );
        assert.equal(options?.redirect, "error");
        assert.ok(options?.body instanceof FormData);
        assert.equal(options.body.get("model"), "gpt-transcribe");
        const file = options.body.get("file");
        assert.ok(file instanceof File);
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), audio);
      } catch (error) {
        started.reject(error);
        throw error;
      }
      if (calls === 1) {
        started.resolve();
        return new Promise((_, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              disconnected.resolve();
              reject(new Error("Fixture provider request aborted"));
            },
            { once: true },
          );
        });
      }
      return Response.json({ text: "Fixture transcript" });
    };

    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/voice/transcribe`;
    const pending = realFetch(url, {
      method: "POST",
      headers,
      body: new Uint8Array(audio),
      signal: client.signal,
    });
    void pending.catch(() => {});
    await started.promise;
    client.abort();
    await assert.rejects(pending, { name: "AbortError" });
    await disconnected.promise;
    const next = await request(server)
      .post("/api/voice/transcribe")
      .set(headers)
      .send(audio)
      .expect(200);
    assert.deepEqual(next.body, {
      text: "Fixture transcript",
      provider: "live",
    });
    assert.equal(calls, 2);
    const state = await request(server)
      .get("/api/state")
      .set(headers)
      .expect(200);
    assert.deepEqual(state.body.data.conversations, []);
  } finally {
    globalThis.fetch = realFetch;
    client.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});

test("speech accepts only an owned live assistant reply and returns private audio", async () => {
  const store = await Store.open(":memory:");
  const app = createApp({
    store,
    ai: {
      mode: "live",
      model: "fixture",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "fixture-key",
      ttsModel: "fixture-tts",
      ttsVoice: "marin",
    },
    rateLimits: false,
  });
  const realFetch = globalThis.fetch;
  const audio = Buffer.from("fixture mp3 data");
  let calls = 0;
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let hold = false;
  let providerResult: "speech" | "limit" | "bad-content" = "speech";
  try {
    const accounts = await Promise.all(
      ["owner", "other"].map(
        async (name) =>
          (
            await request(app)
              .post("/api/auth/register")
              .send({
                name,
                email: `speech-${name}@solace.test`,
                password: "fixture-only-password",
              })
              .expect(201)
          ).body,
      ),
    );
    const [owner, other] = accounts;
    const createdAt = new Date().toISOString();
    const reply = "A short synthetic response.";
    const messages = [
      { id: "user-message", role: "user", content: "Private fixture draft" },
      {
        id: "assistant-reply",
        role: "assistant",
        provider: "live",
        content: reply,
      },
      {
        id: "builtin-reply",
        role: "assistant",
        provider: "offline",
        content: reply,
      },
      {
        id: "support-reply",
        role: "assistant",
        provider: "live",
        safety: true,
        content: reply,
      },
    ];
    const conversationId = "speech-fixture";
    store.run(
      "INSERT INTO records(id,user_id,collection,json,created_at) VALUES(?,?,?,?,?)",
      [
        conversationId,
        owner.user.id,
        "conversations",
        JSON.stringify({ id: conversationId, messages, createdAt }),
        createdAt,
      ],
    );
    const payload = { conversationId, messageId: "assistant-reply" };
    const speak = (account: typeof owner, messageId = payload.messageId) =>
      request(app)
        .post("/api/voice/speech")
        .auth(account.token, { type: "bearer" })
        .send({ conversationId, messageId });

    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(String(url), "https://api.openai.com/v1/audio/speech");
      assert.equal(options?.redirect, "error");
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        "Bearer fixture-key",
      );
      assert.deepEqual(JSON.parse(String(options?.body)), {
        model: "fixture-tts",
        voice: "marin",
        input: reply,
        response_format: "mp3",
      });
      if (hold) {
        started.resolve();
        await release.promise;
      }
      if (providerResult === "limit")
        return Response.json(
          { error: { message: "private provider details" } },
          { status: 429 },
        );
      if (providerResult === "bad-content")
        return Response.json({ wrong: true });
      return new Response(new Uint8Array(audio), {
        headers: { "content-type": "audio/mpeg" },
      });
    };
    await request(app).post("/api/voice/speech").send(payload).expect(401);
    await speak(other).expect(404);
    await speak(owner, "user-message").expect(404);
    await speak(owner, "builtin-reply").expect(404);
    await speak(owner, "support-reply").expect(404);
    await request(app)
      .post("/api/voice/speech")
      .auth(owner.token, { type: "bearer" })
      .send({ ...payload, text: "A caller must not supply arbitrary text." })
      .expect(400);
    assert.equal(calls, 0);
    const response = await speak(owner)
      .buffer()
      .expect("Cache-Control", "private, no-store")
      .expect("Content-Type", /audio\/mpeg/)
      .expect(200);
    assert.deepEqual(response.body, audio);

    providerResult = "limit";
    const rateLimited = await speak(owner).expect(429);
    assert.equal(rateLimited.body.code, "VOICE_RATE_LIMITED");
    assert.doesNotMatch(
      JSON.stringify(rateLimited.body),
      /private provider details/,
    );
    providerResult = "bad-content";
    await speak(owner).expect(502);
    providerResult = "speech";

    hold = true;
    const pending = speak(owner).then((result) => result);
    await started.promise;
    await speak(owner).expect(409);
    await request(app)
      .delete(`/api/records/conversations/${conversationId}`)
      .auth(owner.token, { type: "bearer" })
      .expect(204);
    release.resolve();
    assert.equal((await pending).status, 404);
    assert.equal(calls, 4);
  } finally {
    release.resolve();
    globalThis.fetch = realFetch;
    store.close();
  }
});
