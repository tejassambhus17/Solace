import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/database.js";

test("Gemini-only transcription bounds the audio, cancels on disconnect and releases the voice turn", async () => {
  const store = await Store.open(":memory:");
  const app = createApp({
    store,
    ai: {
      mode: "live",
      model: "fixture",
      baseUrl: "https://api.openai.com/v1",
      gemini: { model: "gemini-fixture", apiKey: "fixture-key" },
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
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-fixture:generateContent",
      );
      assert.equal(
        new Headers(options?.headers).get("x-goog-api-key"),
        "fixture-key",
      );
      assert.equal(options?.redirect, "error");
      const payload = JSON.parse(String(options?.body));
      assert.deepEqual(payload.contents[0].parts[0].inlineData, {
        mimeType: "audio/m4a",
        data: audio.toString("base64"),
      });
      assert.equal(payload.store, false);
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
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { text: JSON.stringify({ transcript: "Fixture transcript" }) },
              ],
            },
          },
        ],
      });
    };

    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/voice/transcribe`;
    const pending = realFetch(url, {
      method: "POST",
      headers,
      body: new Uint8Array(audio),
      signal: client.signal,
    });
    const wasAborted = assert.rejects(pending, { name: "AbortError" });
    await started.promise;
    client.abort();
    await wasAborted;
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
  }
});
