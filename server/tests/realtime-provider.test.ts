import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { AIConfig } from "../src/openai-service.js";
import {
  createOpenAIRealtimeProvider,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_TRANSCRIPTION_MODEL,
  DEFAULT_REALTIME_VOICE,
  type RealtimeProviderEvent,
} from "../src/realtime-provider.js";

const ai: AIConfig = {
  mode: "live",
  model: "fixture-text",
  apiKey: "fixture-only",
  baseUrl: "https://api.openai.com/v1",
};
const sdp = [
  "v=0",
  "o=- 100 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "a=rtpmap:111 opus/48000/2",
  "",
].join("\r\n");
const callId = "rtc_fixture";
const callPath = "/v1/realtime/calls";
const instructions = "A synthetic request.";

function reply(answer = sdp, location = callPath + "/" + callId) {
  return new Response(answer, {
    status: 201,
    headers: { "Content-Type": "application/sdp", Location: location },
  });
}

test("WebRTC creates a server-authorized multipart call with a gated, low-cost audio session", async (t) => {
  const provider = createOpenAIRealtimeProvider(ai);
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer fixture-only",
    );
    const path = new URL(String(url)).pathname;
    requests.push(path);
    if (path.endsWith("/hangup")) return new Response(null, { status: 204 });
    const body = await new Request(String(url), {
      ...init,
      duplex: "half",
    } as RequestInit).formData();
    const field = async (name: string) => {
      const value = body.get(name);
      assert.ok(value);
      return typeof value === "string" ? value : value.text();
    };
    assert.equal(await field("sdp"), sdp);
    const session = JSON.parse(await field("session"));
    assert.equal(session.type, "realtime");
    assert.equal(session.model, DEFAULT_REALTIME_MODEL);
    assert.equal(session.instructions, instructions);
    assert.equal(session.tracing, null);
    assert.deepEqual(session.output_modalities, ["audio"]);
    assert.equal(
      session.audio.input.transcription.model,
      DEFAULT_REALTIME_TRANSCRIPTION_MODEL,
    );
    assert.deepEqual(session.audio.input.turn_detection, {
      type: "semantic_vad",
      eagerness: "auto",
      create_response: false,
      interrupt_response: true,
    });
    assert.equal(session.audio.output.voice, DEFAULT_REALTIME_VOICE);
    return reply();
  });
  assert.deepEqual(await provider.create(sdp, { instructions }), {
    answer: sdp,
    callId,
  });
  await provider.hangup(callId);
  assert.deepEqual(requests, [callPath, callPath + "/" + callId + "/hangup"]);
});

test("browser command channels and invalid offers are rejected before contacting OpenAI", async (t) => {
  const provider = createOpenAIRealtimeProvider(ai);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => reply());
  const attempts = [
    "",
    sdp + "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n",
    sdp + " M=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n",
    sdp.replace("UDP/TLS/RTP/SAVPF 111", "UDP/DTLS/SCTP webrtc-datachannel"),
    sdp + "m=video 9 UDP/TLS/RTP/SAVPF 111\r\n",
    sdp + "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
    sdp + "a=fmtp:" + "x".repeat(64 * 1024),
  ];
  for (const offer of attempts)
    await assert.rejects(provider.create(offer, { instructions }), {
      code: "REALTIME_INVALID_OFFER",
    });
  assert.throws(
    () =>
      createOpenAIRealtimeProvider({
        ...ai,
        baseUrl: "https://fixture.invalid/v1",
      }),
    { code: "REALTIME_NOT_CONFIGURED" },
  );
  assert.throws(
    () => createOpenAIRealtimeProvider({ ...ai, apiKey: undefined }),
    { code: "REALTIME_NOT_CONFIGURED" },
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("unexpected call metadata fails closed and a known invalid call is hung up", async (t) => {
  const provider = createOpenAIRealtimeProvider(ai);
  let location = "https://fixture.invalid/v1/realtime/calls/" + callId;
  let answer = sdp;
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = new URL(String(url)).pathname;
    requests.push(path);
    if (path.endsWith("/hangup")) return Response.json({}, { status: 404 });
    return reply(answer, location);
  });
  await assert.rejects(provider.create(sdp, { instructions }), {
    code: "REALTIME_UNAVAILABLE",
  });
  assert.deepEqual(requests.splice(0), [callPath]);
  location = callPath + "/" + callId;
  answer += "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n";
  await assert.rejects(provider.create(sdp, { instructions }), {
    code: "REALTIME_UNAVAILABLE",
  });
  assert.deepEqual(requests, [callPath, callPath + "/" + callId + "/hangup"]);
});

test("HTTP rejections expose only stable error codes and do not replay calls", async (t) => {
  const provider = createOpenAIRealtimeProvider(ai);
  let status = 429;
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: { message: "Sensitive upstream error." } },
      { status },
    ),
  );
  await assert.rejects(provider.create(sdp, { instructions }), {
    message: "REALTIME_RATE_LIMITED",
    code: "REALTIME_RATE_LIMITED",
  });
  status = 500;
  await assert.rejects(provider.create(sdp, { instructions }), {
    message: "REALTIME_UNAVAILABLE",
    code: "REALTIME_UNAVAILABLE",
  });
  assert.equal(fetchMock.mock.callCount(), 2);
});

class FakeSocket extends EventTarget {
  static OPEN = 1;
  static latest: FakeSocket;
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  closed = false;

  constructor(
    readonly url: URL,
    readonly init: { headers: Record<string, string> },
  ) {
    super();
    FakeSocket.latest = this;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  close() {
    this.readyState = 3;
    this.closed = true;
    this.dispatchEvent(new Event("close"));
  }

  send(value: string) {
    this.sent.push(value);
  }

  message(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function mockSocket(t: TestContext) {
  const old = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  t.after(() => {
    globalThis.WebSocket = old;
  });
}

test("sideband uses a credential-free official URL, forwards transcripts, and closes quietly", async (t) => {
  mockSocket(t);
  const provider = createOpenAIRealtimeProvider(ai);
  const events: RealtimeProviderEvent[] = [];
  let failure = 0;
  const signal = new AbortController();
  const pending = provider.connect(
    callId,
    {
      onEvent(event) {
        events.push(event);
      },
      onClose() {
        failure++;
      },
      onError() {
        failure++;
      },
    },
    signal.signal,
  );
  const socket = FakeSocket.latest;
  assert.equal(
    socket.url.toString(),
    "wss://api.openai.com/v1/realtime?call_id=rtc_fixture",
  );
  assert.equal(socket.init.headers.Authorization, "Bearer fixture-only");
  socket.open();
  const channel = await pending;
  signal.abort();
  const transcript = {
    type: "conversation.item.input_audio_transcription.completed",
    transcript: "Synthetic transcript.",
  };
  socket.message(JSON.stringify(transcript));
  socket.message(
    JSON.stringify({ type: "response.output_audio.delta", delta: "opaque" }),
  );
  assert.deepEqual(events, [transcript]);
  assert.equal(channel.send({ type: "response.create" }), true);
  socket.bufferedAmount = 256 * 1024;
  assert.equal(channel.send({ type: "response.create" }), false);
  assert.deepEqual(
    socket.sent.map((value) => JSON.parse(value)),
    [{ type: "response.create" }],
  );
  channel.close();
  channel.close();
  assert.equal(socket.closed, true);
  assert.equal(failure, 0);
  assert.equal(channel.send({ type: "response.create" }), false);
});

test("sideband aborts before opening and reports an unsolicited failure only once", async (t) => {
  mockSocket(t);
  const provider = createOpenAIRealtimeProvider(ai);
  let errors = 0;
  let closes = 0;
  const callbacks = {
    onEvent() {},
    onClose() {
      closes++;
    },
    onError() {
      errors++;
    },
  };
  const abort = new AbortController();
  const pending = provider.connect(callId, callbacks, abort.signal);
  abort.abort(new Error("Private cancellation."));
  await assert.rejects(pending, { code: "REALTIME_UNAVAILABLE" });
  assert.equal(FakeSocket.latest.closed, true);
  assert.equal(errors + closes, 0);
  const ready = provider.connect(callId, callbacks);
  const socket = FakeSocket.latest;
  socket.open();
  await ready;
  socket.message("not JSON");
  socket.dispatchEvent(new Event("error"));
  socket.dispatchEvent(new Event("close"));
  assert.equal(socket.closed, true);
  assert.equal(errors, 1);
  assert.equal(closes, 0);
});

test("an early sideband failure retries only the same provider call", async (t) => {
  mockSocket(t);
  const provider = createOpenAIRealtimeProvider(ai);
  const events = {
    onEvent() {},
    onClose() {
      assert.fail("The channel never opened");
    },
    onError() {
      assert.fail("The channel never opened");
    },
  };
  const pending = provider.connect(callId, events, AbortSignal.timeout(3000));
  const first = FakeSocket.latest;
  first.dispatchEvent(new Event("error"));
  for (let attempt = 0; FakeSocket.latest === first && attempt < 150; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  const second = FakeSocket.latest;
  assert.notEqual(first, second);
  assert.equal(first.url.href, second.url.href);
  assert.equal(first.closed, true);
  second.open();
  (await pending).close();
});
