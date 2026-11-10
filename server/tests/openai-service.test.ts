import assert from "node:assert/strict";
import { setImmediate as nextTick } from "node:timers/promises";
import { test } from "node:test";
import {
  generateText,
  provider,
  structuredOutput,
  type AIConfig,
} from "../src/generation.js";
import {
  OPENAI_TIMEOUT_MS,
  openAIClient,
  openAIUsageSnapshot,
} from "../src/openai-service.js";
import { openAIEvents, openAIResponse } from "./openai-fixture.js";

const ai: AIConfig = {
  mode: "live",
  apiKey: "fixture-only",
  model: "gpt-6.1-terra",
  lightModel: "gpt-6-luna",
  baseUrl: "https://api.openai.com/v1",
};
const generation = {
  instructions: "Keep this test private.",
  input: "A synthetic wellness prompt.",
  maxTokens: 250,
};

function completion(text: string) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
  };
}

test("OpenAI transport is server-only, bounded, and uses the current fetch", async (t) => {
  const client = openAIClient(ai);
  assert.equal(client.maxRetries, 0);
  assert.equal(client.logLevel, "off");
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(options?.redirect, "error");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      "Bearer fixture-only",
    );
    return openAIResponse("Approved text.");
  });
  await client.responses.create({
    input: generation.input,
    model: ai.model,
    store: false,
  });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(provider({ ...ai, mode: "offline" }), "offline");
  assert.equal(provider({ ...ai, apiKey: undefined }), "offline");
  await assert.rejects(
    generateText({ ...ai, apiKey: undefined }, generation),
    /AI_NOT_CONFIGURED/,
  );
  await assert.rejects(
    generateText({ ...ai, mode: "offline" }, generation),
    /AI_NOT_CONFIGURED/,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("structured workflows use the light model and report aggregate safe usage", async (t) => {
  const schema = {
    type: "object",
    properties: { question: { type: "string" } },
    required: ["question"],
    additionalProperties: false,
  };
  let validCounters = true;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.model, "gpt-6-luna");
    assert.equal(payload.store, false);
    assert.equal(payload.previous_response_id, undefined);
    assert.deepEqual(payload.reasoning, { effort: "none" });
    assert.deepEqual(payload.prompt_cache_options, { mode: "explicit" });
    assert.deepEqual(payload.text.format, {
      type: "json_schema",
      strict: true,
      name: "solace_weekly_invitation",
      schema,
    });
    assert.equal(payload.max_output_tokens, 250);
    assert.deepEqual(JSON.parse(payload.input), { checkins: 2 });
    return Response.json({
      ...completion(JSON.stringify({ question: "What felt useful?" })),
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: validCounters ? 20 : 101 },
        output_tokens: 40,
      },
      service_tier: "default",
      id: "private-provider-id",
    });
  });
  const reply = () =>
    structuredOutput(
      ai,
      "solace_weekly_invitation",
      schema,
      generation.instructions,
      { checkins: 2 },
      { maxTokens: 250 },
    );
  assert.deepEqual(await reply(), { question: "What felt useful?" });
  validCounters = false;
  await reply();
  const metrics = openAIUsageSnapshot().filter(
    ({ workflow }) => workflow === "weekly",
  );
  assert.deepEqual(
    metrics.map(({ estimatedUsd, ...usage }) => ({
      ...usage,
      estimatedUsd: estimatedUsd?.toFixed(8),
    })),
    [
      {
        model: "gpt-6-luna",
        workflow: "weekly",
        calls: 1,
        inputTokens: 100,
        outputTokens: 40,
        cachedTokens: 20,
        estimatedUsd: "0.00002820",
      },
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(metrics),
    /provider-id|synthetic|question|prompt|fixture-only/i,
  );
});

test("the streamed Companion turn remains buffered until a completed response", async (t) => {
  const input = [
    { role: "assistant", content: "What is on your mind?" },
    { role: "user", content: "I feel stressed today." },
  ] as const;
  let body!: ReadableStreamDefaultController<Uint8Array>;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const request = JSON.parse(String(options?.body));
    assert.equal(request.stream, true);
    assert.equal(request.model, "gpt-6.1-terra");
    assert.equal(request.store, false);
    assert.deepEqual(request.input, input);
    return new Response(
      new ReadableStream({
        start(controller) {
          body = controller;
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  let settled = false;
  const pending = generateText(ai, {
    ...generation,
    input: [...input],
    stream: true,
  }).finally(() => {
    settled = true;
  });
  await nextTick();
  const event = (data: object) =>
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  body.enqueue(
    event({ type: "response.output_text.delta", delta: "Partial draft" }),
  );
  await nextTick();
  assert.equal(settled, false);
  body.enqueue(
    event({
      type: "response.completed",
      response: completion("Final validated text."),
    }),
  );
  body.close();
  assert.equal(await pending, "Final validated text.");
});

test("an explicit rate or capacity rejection can retry once when context remains current", async (t) => {
  let calls = 0;
  let status = 429;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (calls === 1) {
      return Response.json(
        { error: { message: "private upstream body" } },
        {
          status,
          headers: { "retry-after-ms": "0" },
        },
      );
    }
    return openAIResponse("A completed retry.");
  });
  for (const code of [429, 503]) {
    status = code;
    calls = 0;
    assert.equal(await generateText(ai, generation), "A completed retry.");
    assert.equal(calls, 2);
  }
  calls = 0;
  status = 429;
  let guardChecks = 0;
  await assert.rejects(
    generateText(ai, { ...generation, canRetry: () => ++guardChecks === 1 }),
    { message: "AI_PROVIDER_429" },
  );
  assert.equal(calls, 1);
  assert.equal(guardChecks, 2);
  assert.equal(fetchMock.mock.callCount(), 5);
});

test("ambiguous, long, permanent, or streamed failures are never resubmitted", async (t) => {
  const cases = [
    {
      response: () => {
        throw new TypeError("Private network failure.");
      },
      message: "AI_UNAVAILABLE",
    },
    {
      response: () =>
        Response.json(
          { error: { code: "insufficient_quota" } },
          { status: 429 },
        ),
      message: "AI_QUOTA_EXCEEDED",
    },
    {
      response: () =>
        Response.json({}, { status: 429, headers: { "Retry-After": "60" } }),
      message: "AI_PROVIDER_429",
    },
    {
      response: () => Response.json({}, { status: 503 }),
      message: "AI_PROVIDER_503",
    },
    {
      response: () =>
        Response.json({}, { status: 429, headers: { "retry-after-ms": "0" } }),
      message: "AI_PROVIDER_429",
      stream: true,
    },
  ];
  let handle: () => Response;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => handle());
  for (const entry of cases) {
    handle = entry.response;
    const count = fetchMock.mock.callCount();
    await assert.rejects(
      generateText(ai, { ...generation, stream: entry.stream }),
      {
        message: entry.message,
      },
    );
    assert.equal(fetchMock.mock.callCount() - count, 1);
  }
});

test("refusals, truncated streams, cancellations, and oversized replies fail closed", async (t) => {
  let handle: () => Response;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => handle());
  handle = () =>
    openAIEvents(
      { type: "response.refusal.delta", delta: "Sensitive refusal." },
      {
        type: "response.completed",
        response: completion("Ignore the refusal."),
      },
    );
  await assert.rejects(generateText(ai, { ...generation, stream: true }), {
    message: "AI_REFUSED",
  });
  handle = () =>
    openAIEvents({
      type: "response.output_text.delta",
      delta: "Partial private text.",
    });
  await assert.rejects(generateText(ai, { ...generation, stream: true }), {
    message: "AI_INCOMPLETE_RESPONSE",
  });
  handle = () =>
    Response.json({
      ...completion("Too large."),
      extra: "a".repeat(256 * 1024),
    });
  await assert.rejects(generateText(ai, generation), {
    message: "AI_INVALID_RESPONSE",
  });
  const abort = new AbortController();
  let canceled = false;
  handle = () =>
    new Response(
      new ReadableStream({
        cancel() {
          canceled = true;
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  const pending = generateText(ai, {
    ...generation,
    stream: true,
    signal: abort.signal,
  });
  await nextTick();
  abort.abort(new Error("Private cancellation reason."));
  await assert.rejects(pending, { message: "AI_UNAVAILABLE" });
  assert.equal(canceled, true);
  assert.equal(fetchMock.mock.callCount(), 4);
});

test("the total deadline also aborts a stalled body after response headers", async (t) => {
  const deadline = new AbortController();
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, OPENAI_TIMEOUT_MS);
    return deadline.signal;
  });
  let headersSent = false;
  let canceled = false;
  t.mock.method(globalThis, "fetch", async () => {
    headersSent = true;
    return new Response(
      new ReadableStream({
        cancel() {
          canceled = true;
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  const pending = generateText(ai, generation);
  await nextTick();
  assert.equal(headersSent, true);
  deadline.abort(new DOMException("Deadline elapsed.", "TimeoutError"));
  await assert.rejects(pending, { message: "AI_UNAVAILABLE" });
  assert.equal(canceled, true);
});
