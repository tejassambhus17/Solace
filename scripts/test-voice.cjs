const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync("src/voice-session.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const exported = { exports: {} };
new Function("module", "exports", compiled)(exported, exported.exports);
const { VoiceTurn, MAX_VOICE_BYTES, voiceContentType, voiceMeterLevel } =
  exported.exports;
const rtc = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(fs.readFileSync("src/realtime-rtc-core.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
)(rtc, rtc.exports);
const { openRealtimePeer } = rtc.exports;
const audioSDP = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";

test("ending a first voice call returns to chat while finalizing history in the background", async () => {
  const finish = Promise.withResolvers();
  const calls = [];
  const effects = [];
  let hardwareBack;
  const app = {
    params: {},
    canGoBack: true,
    back: () => calls.push("back"),
    navigate: (...args) => calls.push(args),
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useRef: (current) => ({ current }),
    useEffect: (effect) => effects.push(effect),
    useState: (state) => [state, () => {}],
  };
  const dependencies = {
    react,
    "react-native": {
      AppState: {
        currentState: "active",
        addEventListener: () => ({ remove() {} }),
      },
      View: "View",
      BackHandler: {
        addEventListener(_event, handler) {
          hardwareBack = handler;
          return { remove() {} };
        },
      },
      StyleSheet: { create: (styles) => styles },
      useWindowDimensions: () => ({ width: 320, height: 640, fontScale: 1 }),
    },
    "react-native-safe-area-context": {
      useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
    },
    "../ChatComposer": {},
    "../Companion": { useReducedMotion: () => false },
    "../layout": { spacing: {}, useScreenGutter: () => 16 },
    "../routes": { routes: { companion: "chat" } },
    "../realtime-voice-state": loadRealtimeState(),
    "../realtime-timing": { beginVoiceTiming() {}, markVoiceTiming() {} },
    "./CompanionAppActions": { useCompanionActions: () => ({}) },
    "../store": { useApp: () => app },
    "../theme": { useTheme: () => ({ colors: {}, resolved: "dark" }) },
    "../ui": {},
    "../useRealtimeVoice": {
      useRealtimeVoice: () => ({
        transport: "ready",
        conversationId: () => undefined,
        finish: () => {
          calls.push("finish");
          return finish.promise;
        },
      }),
    },
    "./VoiceTalkArtwork": { useVoiceLevel: () => undefined },
  };
  const compiled = ts.transpileModule(
    fs.readFileSync("src/screens/VoiceTalk.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, (name) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  });
  exports.VoiceTalkScreen();
  const cleanup = effects.map((effect) => effect());
  assert.equal(hardwareBack(), true);
  assert.equal(hardwareBack(), true);
  assert.deepEqual(calls, ["finish", "back"]);
  cleanup.forEach((dispose) => dispose?.());
  finish.resolve("eventual-conversation");
  await finish.promise;
  assert.deepEqual(calls, ["finish", "back"]);
});

function loadSource(path, dependencies = {}) {
  const source = { exports: {} };
  new Function(
    "module",
    "exports",
    "require",
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText,
  )(source, source.exports, (name) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  });
  return source.exports;
}

const routes = loadSource("src/routes.ts");
const loadRealtimeState = () =>
  loadSource("src/realtime-voice-state.ts", {
    "./routes": routes,
    "../server/src/companion-app-action": loadSource(
      "server/src/companion-app-action.ts",
    ),
  });
const voiceState = (id, changes = {}) => ({
  id,
  phase: "listening",
  userSpeaking: false,
  expiresAt: Date.now() + 10000,
  revision: 1,
  ...changes,
});

test("Live Voice artwork uses measured levels and cancels stale samples when paused", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const targets = [];
  let level;
  let effect;
  let dispose;
  let reads = 0;
  const late = Promise.withResolvers();
  class Value {
    constructor(value) {
      this.value = value;
    }
    setValue(value) {
      this.value = value;
    }
    stopAnimation() {}
  }
  const { useVoiceLevel } = loadSource("src/screens/VoiceTalkArtwork.tsx", {
    react: {
      __esModule: true,
      default: {
        memo: (component) => component,
        useRef: (current) => ({ current }),
      },
      useState: (initial) => [(level ??= initial())],
      useEffect: (next) => (effect = next),
    },
    "react-native": {
      Platform: { OS: "android" },
      StyleSheet: { create: (styles) => styles },
      Animated: {
        Value,
        timing(value, { toValue, useNativeDriver }) {
          assert.equal(useNativeDriver, true);
          targets.push(toValue);
          return { start: () => value.setValue(toValue) };
        },
      },
    },
    "../theme": { artGradient: () => ({}) },
    "../../assets/voice-companion-night.jpg": "night",
    "../../assets/voice-companion-dawn.jpg": "dawn",
    "../../assets/voice-night-plate.jpg": "night plate",
    "../../assets/voice-dawn-plate.jpg": "dawn plate",
    "../../assets/voice-night-lotus.png": "night petals",
    "../../assets/voice-dawn-lotus.png": "dawn petals",
  });
  const read = () => {
    const sample = [{}, { input: 0.04, output: 1 }, {}, late.promise][reads++];
    return Promise.resolve(sample);
  };
  function render(signal, paused = false) {
    dispose?.();
    useVoiceLevel(signal, read, paused);
    dispose = effect();
  }
  const flush = () => new Promise(setImmediate);
  render("input");
  await flush();
  assert.equal(level.value, 0);
  t.mock.timers.tick(140);
  await flush();
  assert.ok(Math.abs(level.value - 0.46) < 0.001);
  t.mock.timers.tick(140);
  await flush();
  assert.equal(level.value, 0);
  t.mock.timers.tick(140);
  render("output", true);
  late.resolve({ input: 1, output: 1 });
  await flush();
  t.mock.timers.tick(1400);
  assert.equal(reads, 4);
  assert.equal(targets.length, 2);
  assert.equal(level.value, 0);
});

function liveVoiceFixture(api, peer, autoConnect = true) {
  let onAppState;
  let onPeerState;
  let renderIndex = 0;
  const slots = [];
  const effects = [];
  const dependencies = {
    react: {
      useRef(value) {
        return (slots[renderIndex++] ??= { current: value });
      },
      useState(value) {
        const slot = renderIndex++;
        slots[slot] ??= { value };
        return [
          slots[slot].value,
          (next) => {
            slots[slot].value =
              typeof next === "function" ? next(slots[slot].value) : next;
          },
        ];
      },
      useEffect(effect) {
        effects.push(effect);
      },
    },
    "react-native": {
      AppState: {
        addEventListener(_, handler) {
          onAppState = handler;
          return { remove() {} };
        },
      },
    },
    "./realtime-rtc": {
      realtimePeerAvailable: () => true,
      createRealtimePeer: async (options) => {
        onPeerState = options.onState;
        return {
          offer: audioSDP,
          ...peer,
          async acceptAnswer(answer) {
            await peer.acceptAnswer?.(answer);
            if (autoConnect) onPeerState("connected");
          },
        };
      },
    },
    "./realtime-timing": { markVoiceTiming() {} },
    "./realtime-voice-state": loadRealtimeState(),
    "./routes": routes,
    "./audio-focus": { interruptAmbientPlayback() {} },
  };
  const { useRealtimeVoice } = loadSource(
    "src/useRealtimeVoice.ts",
    dependencies,
  );
  const render = () => {
    renderIndex = 0;
    return useRealtimeVoice(api, "existing-conversation");
  };
  const voice = render();
  const dispose = effects[0]();
  return {
    voice,
    render,
    dispose,
    onAppState,
    peerState: (state) => onPeerState(state),
  };
}

test("ending while negotiating closes the mic immediately and waits before retrying", async () => {
  const pending = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const released = Promise.withResolvers();
  const calls = [];
  const api = {
    startVoiceSession() {
      calls.push("start");
      entered.resolve();
      return pending.promise;
    },
    async endVoiceSession(id) {
      calls.push(id);
      await released.promise;
      return voiceState(id, {
        phase: "disconnected",
        conversationId: "saved-conversation",
      });
    },
    async refresh() {
      calls.push("refresh");
    },
  };
  const { voice, render, dispose, onAppState } = liveVoiceFixture(api, {
    close: () => calls.push("closed"),
  });
  const start = voice.start();
  await entered.promise;
  onAppState("background");
  assert.equal(await voice.finish(), "existing-conversation");
  assert.deepEqual(calls, ["start", "closed"]);
  assert.equal(render().ending, true);
  await voice.start();
  pending.resolve({ id: "late-session", state: {} });
  await new Promise(setImmediate);
  await voice.start();
  assert.deepEqual(calls, ["start", "closed", "late-session"]);
  released.resolve();
  await start;
  assert.equal(render().ending, false);
  assert.equal(voice.conversationId(), "saved-conversation");
  assert.deepEqual(calls, ["start", "closed", "late-session", "refresh"]);
  dispose();
});

test("malformed Realtime status closes capture once and keeps the last valid chat destination", async () => {
  for (const wrongStatus of [
    voiceState("other-call", { conversationId: "wrong-chat" }),
    voiceState("session", {
      revision: undefined,
      conversationId: "wrong-chat",
    }),
    voiceState("session", { revision: 0, conversationId: "wrong-chat" }),
  ]) {
    const calls = [];
    const api = {
      startVoiceSession: async () => ({
        id: "session",
        answer: audioSDP,
        state: voiceState("session", { conversationId: "current-chat" }),
      }),
      async voiceSessionStatus(id, revision) {
        calls.push(["status", id, revision]);
        if (calls.length > 1) throw new Error("Extra status request");
        return wrongStatus;
      },
      async endVoiceSession(id) {
        calls.push(["end", id]);
        return voiceState("other-call", { conversationId: "wrong-chat" });
      },
      async refresh() {
        calls.push(["refresh"]);
      },
    };
    const { voice, render, dispose } = liveVoiceFixture(api, {
      close: () => calls.push(["close"]),
      acceptAnswer: async () => {},
    });
    await voice.start();
    await voice.finish();
    assert.equal(render().transport, "failed");
    assert.match(render().error, /couldn’t connect/);
    assert.deepEqual(
      { destination: voice.conversationId(), calls },
      {
        destination: "current-chat",
        calls: [
          ["status", "session", 1],
          ["close"],
          ["end", "session"],
          ["refresh"],
        ],
      },
    );
    dispose();
  }
});

test("a synchronous native mute failure ends the call and releases capture", async () => {
  const polling = Promise.withResolvers();
  const calls = [];
  const api = {
    startVoiceSession: async () => ({
      id: "session",
      answer: audioSDP,
      state: voiceState("session"),
    }),
    voiceSessionStatus(_id, _revision, signal) {
      polling.resolve();
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("Cancelled"))),
      );
    },
    async endVoiceSession(id) {
      calls.push(["end", id]);
      return voiceState(id, { phase: "disconnected" });
    },
    async refresh() {},
  };
  const { voice, render, dispose } = liveVoiceFixture(api, {
    close: () => calls.push(["close"]),
    acceptAnswer: async () => {},
    setMuted: () => {
      throw new Error("Native microphone unavailable");
    },
  });
  const running = voice.start();
  await polling.promise;
  voice.toggleMute();
  await running;
  await voice.finish();
  assert.equal(render().transport, "failed");
  assert.match(render().error, /microphone couldn’t be changed/);
  assert.deepEqual(calls, [["close"], ["end", "session"]]);
  dispose();
});

test("live voice waits for media and sideband, and acknowledges media once across reconnect", async () => {
  const accepted = Promise.withResolvers();
  const nextPoll = Promise.withResolvers();
  const sideband = Promise.withResolvers();
  const requests = [];
  const api = {
    startVoiceSession: async () => ({
      id: "session",
      answer: audioSDP,
      mediaReadySignal: true,
      state: voiceState("session", { phase: "connecting", revision: 0 }),
    }),
    voiceSessionStatus(_id, revision, signal, ready) {
      requests.push([revision, ready]);
      if (requests.length === 1)
        return Promise.resolve(
          voiceState("session", { phase: "connecting", revision: 0 }),
        );
      if (requests.length === 2) return sideband.promise;
      nextPoll.resolve();
      return new Promise((_, reject) =>
        signal.addEventListener("abort", reject, { once: true }),
      );
    },
    async endVoiceSession(id) {
      return voiceState(id, { phase: "disconnected" });
    },
    async refresh() {},
  };
  const fixture = liveVoiceFixture(
    api,
    {
      acceptAnswer: () => accepted.resolve(),
      close() {},
    },
    false,
  );
  const running = fixture.voice.start();
  await accepted.promise;
  assert.equal(fixture.render().transport, "connecting");
  assert.deepEqual(requests, []);
  fixture.peerState("connected");
  await new Promise(setImmediate);
  assert.equal(fixture.render().transport, "connecting");
  assert.deepEqual(requests, [
    [undefined, true],
    [0, undefined],
  ]);
  sideband.resolve(voiceState("session"));
  await nextPoll.promise;
  const ready = fixture.render();
  assert.equal(ready.transport, "ready");
  assert.equal(ready.mediaAcknowledged, true);
  fixture.peerState("disconnected");
  assert.equal(fixture.render().transport, "reconnecting");
  fixture.peerState("connected");
  assert.equal(fixture.render().transport, "ready");
  assert.equal(fixture.render().connectedAt, ready.connectedAt);
  assert.deepEqual(requests, [
    [undefined, true],
    [0, undefined],
    [1, undefined],
  ]);
  await fixture.voice.finish();
  await running;
  fixture.dispose();
});

test("Realtime retries a temporary status error once without retrying rejected sessions", async () => {
  const { readVoiceStatus } = loadRealtimeState();
  const unavailable = Object.assign(new Error(), { status: 503 });
  const missing = Object.assign(new Error(), { status: 404 });
  const { signal } = new AbortController();
  const state = { phase: "listening", revision: 2 };
  let reads = 0;
  assert.equal(
    await readVoiceStatus(async () => {
      if (++reads === 1) throw unavailable;
      return state;
    }, signal),
    state,
  );
  assert.equal(reads, 2);
  reads = 0;
  await assert.rejects(
    readVoiceStatus(async () => {
      reads++;
      throw missing;
    }, signal),
    missing,
  );
  assert.equal(reads, 1);
  reads = 0;
  await assert.rejects(
    readVoiceStatus(async () => {
      reads++;
      throw unavailable;
    }, signal),
    unavailable,
  );
  assert.equal(reads, 2);
});

test("Realtime ending during status backoff cancels the retry", async () => {
  const { readVoiceStatus } = loadRealtimeState();
  const controller = new AbortController();
  let reads = 0;
  const offline = Object.assign(new Error(), { connection: true });
  const pending = readVoiceStatus(async () => {
    reads++;
    throw offline;
  }, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, offline);
  assert.equal(reads, 1);
});

test("Realtime ignores a microphone permission overlay and ends when the app truly leaves", () => {
  const { realtimeShouldEndOnAppState } = loadRealtimeState();
  assert.equal(realtimeShouldEndOnAppState("background", true), false);
  assert.equal(realtimeShouldEndOnAppState("inactive", true), false);
  assert.equal(realtimeShouldEndOnAppState("active", false), false);
  assert.equal(realtimeShouldEndOnAppState("background", false), true);
  assert.equal(realtimeShouldEndOnAppState("inactive", false), true);
});

test("live voice sends one audio-only SDP and disables the mic on mute", async () => {
  const states = [];
  const muted = [];
  const cleanup = [];
  let state;
  let remoteAudio;
  const peer = await openRealtimePeer(
    { onState: (next) => states.push(next) },
    async (setup) => {
      setup.cleanup(() => cleanup.push("microphone"));
      setup.cleanup(() => cleanup.push("peer"));
      state = setup.state;
      remoteAudio = setup.remoteAudio;
      return {
        offer: async () => audioSDP,
        acceptAnswer: async (answer) => assert.equal(answer, audioSDP),
        setMuted: (value) => muted.push(value),
      };
    },
  );
  assert.equal(peer.offer, audioSDP);
  await peer.acceptAnswer(audioSDP);
  state("connecting", "checking");
  state("connected", "connected");
  assert.deepEqual(states, ["connecting"]);
  remoteAudio();
  state("connected", "completed");
  peer.setMuted(true);
  peer.setMuted(false);
  state("disconnected", "disconnected");
  assert.deepEqual(cleanup, []);
  state("connecting", "checking");
  state("connected", "completed");
  state("failed", "failed");
  peer.setMuted(true);
  peer.close();
  assert.deepEqual(muted, [true, false]);
  assert.deepEqual(states, [
    "connecting",
    "connected",
    "disconnected",
    "connected",
    "failed",
  ]);
  assert.deepEqual(cleanup, ["peer", "microphone"]);
});

test("Realtime meters use audio-only RMS counters and omit unavailable stats", async () => {
  let report = [
    {
      id: "mic",
      type: "media-source",
      kind: "audio",
      audioLevel: 0.1,
      totalAudioEnergy: 1,
      totalSamplesDuration: 4,
    },
    {
      id: "remote",
      type: "inbound-rtp",
      mediaType: "audio",
      totalAudioEnergy: 1,
      totalSamplesDuration: 4,
    },
    { id: "video", type: "inbound-rtp", kind: "video", audioLevel: 1 },
    { id: "outbound", type: "outbound-rtp", kind: "audio", audioLevel: 1 },
  ];
  const peer = await openRealtimePeer({ onState: () => {} }, async () => ({
    offer: async () => audioSDP,
    acceptAnswer: async () => {},
    setMuted: () => {},
    getAudioStats: async () => report,
  }));
  assert.deepEqual(await peer.readAudioLevels(), { input: 0.1 });
  report = [
    { ...report[0], totalAudioEnergy: 2, totalSamplesDuration: 8 },
    { ...report[1], totalAudioEnergy: 1.25, totalSamplesDuration: 8 },
  ];
  assert.deepEqual(await peer.readAudioLevels(), { input: 0.5, output: 0.25 });
  report = [
    {
      ...report[0],
      audioLevel: Number.NaN,
      totalAudioEnergy: 0,
      totalSamplesDuration: 0,
    },
    {
      ...report[1],
      audioLevel: 2,
      totalAudioEnergy: 0,
      totalSamplesDuration: 0,
    },
  ];
  assert.deepEqual(await peer.readAudioLevels(), { output: 1 });
  peer.close();
});

test("Realtime shares pending meter reads, masks muted input, and discards stats after close", async () => {
  let reading = Promise.withResolvers();
  let reads = 0;
  const peer = await openRealtimePeer({ onState: () => {} }, async () => ({
    offer: async () => audioSDP,
    acceptAnswer: async () => {},
    setMuted: () => {},
    getAudioStats: () => {
      reads++;
      return reading.promise;
    },
  }));
  const first = peer.readAudioLevels();
  assert.equal(peer.readAudioLevels(), first);
  assert.equal(reads, 1);
  peer.setMuted(true);
  reading.resolve([
    { type: "media-source", kind: "audio", audioLevel: 0.7 },
    { type: "inbound-rtp", kind: "audio", audioLevel: 0.3 },
  ]);
  assert.deepEqual(await first, { input: 0, output: 0.3 });

  reading = Promise.withResolvers();
  const last = peer.readAudioLevels();
  peer.close();
  reading.resolve([{ type: "inbound-rtp", kind: "audio", audioLevel: 0.5 }]);
  assert.deepEqual(await last, {});
  assert.deepEqual(await peer.readAudioLevels(), {});
  assert.equal(reads, 2);
});

test("Realtime applies an available speaker preference and reports failed or closed route changes", async () => {
  const changes = [];
  const base = {
    offer: async () => audioSDP,
    acceptAnswer: async () => {},
    setMuted: () => {},
  };
  const unsupported = await openRealtimePeer(
    { onState: () => {} },
    async () => base,
  );
  assert.equal(unsupported.setSpeakerphone, undefined);
  assert.deepEqual(await unsupported.readAudioLevels(), {});
  unsupported.close();

  const peer = await openRealtimePeer({ onState: () => {} }, async () => ({
    ...base,
    setSpeakerphone: async (enabled) => {
      changes.push(enabled);
      if (enabled) throw new Error("native audio session busy");
    },
  }));
  assert.equal(await peer.setSpeakerphone(false), true);
  assert.equal(await peer.setSpeakerphone(true), false);
  peer.close();
  assert.equal(await peer.setSpeakerphone(false), false);
  assert.deepEqual(changes, [false, true]);
});

test("aborting while microphone permission is pending releases a late capture before making SDP", async () => {
  const permission = Promise.withResolvers();
  const controller = new AbortController();
  let stops = 0;
  let offers = 0;
  const opening = openRealtimePeer(
    { signal: controller.signal, onState: () => {} },
    async (setup) => {
      await permission.promise;
      setup.cleanup(() => stops++);
      setup.assertOpen();
      return {
        offer: async () => (offers++, audioSDP),
        acceptAnswer: async () => {},
        setMuted: () => {},
      };
    },
  );
  controller.abort();
  permission.resolve();
  await assert.rejects(opening, { name: "AbortError" });
  assert.equal(stops, 1);
  assert.equal(offers, 0);
});

test("live voice closes before applying an answer containing a client data channel", async () => {
  let stopped = false;
  const peer = await openRealtimePeer({ onState: () => {} }, async (setup) => {
    setup.cleanup(() => (stopped = true));
    return {
      offer: async () => audioSDP,
      acceptAnswer: async () =>
        assert.fail("rejected before remote description"),
      setMuted: () => {},
    };
  });
  await assert.rejects(
    peer.acceptAnswer(
      audioSDP + "m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n",
    ),
    /couldn’t connect/,
  );
  assert.equal(stopped, true);
});

test("recording visuals use bounded real samples and leave missing levels unavailable", () => {
  assert.equal(voiceMeterLevel(undefined), null);
  assert.equal(voiceMeterLevel(NaN), null);
  assert.equal(voiceMeterLevel(Infinity), null);
  assert.equal(voiceMeterLevel(-Infinity), 0);
  assert.equal(voiceMeterLevel(-110), 0);
  assert.equal(voiceMeterLevel(-27.5), 0.5);
  assert.equal(voiceMeterLevel(2), 1);
});
test("ending a voice turn aborts the active upload and discards its audio", async () => {
  let signal;
  const fixtureVoice = fixture({
    transcribe: (_audio, uploadSignal) => {
      signal = uploadSignal;
      return new Promise((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new Error("Upload cancelled")),
          { once: true },
        );
      });
    },
  });
  await fixtureVoice.turn.start();
  const stop = fixtureVoice.turn.stop();
  await Promise.resolve();
  assert.equal(signal.aborted, false);
  await fixtureVoice.turn.cancel();
  await stop;
  assert.equal(signal.aborted, true);
  assert.equal(fixtureVoice.turn.canRetry, false);
  assert.deepEqual(fixtureVoice.transcripts, []);
});
function fixture(overrides = {}) {
  const events = [],
    transcripts = [];
  let starts = 0,
    cancels = 0,
    uploads = 0;
  const turn = new VoiceTurn({
    permission: async () => true,
    start: async () => {
      starts++;
    },
    stop: async () => new ArrayBuffer(100),
    cancel: async () => {
      cancels++;
    },
    transcribe: async () => {
      uploads++;
      return "A short, actual transcript";
    },
    transcript: (text) => transcripts.push(text),
    changed: (state, error) => events.push({ state, error }),
    ...overrides,
  });
  return {
    turn,
    events,
    transcripts,
    starts: () => starts,
    cancels: () => cancels,
    uploads: () => uploads,
  };
}
test("permission denial does not start or upload audio and offers text fallback", async () => {
  const f = fixture({ permission: async () => false });
  await f.turn.start();
  assert.equal(f.starts(), 0);
  assert.equal(f.uploads(), 0);
  assert.equal(f.turn.state, "idle");
  assert.match(f.events.at(-1).error, /type your message/);
});

test("an OS permission overlay can leave the foreground without cancelling the pending permission", async () => {
  let answer;
  const f = fixture({
    permission: () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  });
  const pending = f.turn.start();
  await f.turn.leaveForeground();
  assert.equal(f.turn.state, "preparing");
  assert.equal(f.cancels(), 0);
  answer(false);
  await pending;
  assert.match(f.events.at(-1).error, /Microphone access is off/);
  assert.equal(f.starts(), 0);
});

test("granted permission waits for the app to resume, and backgrounding live audio cancels it", async () => {
  const away = fixture({ permission: async () => "away" });
  await away.turn.start();
  assert.equal(away.starts(), 0);
  assert.equal(away.turn.state, "idle");
  const active = fixture();
  await active.turn.start();
  assert.equal(active.turn.state, "listening");
  await active.turn.leaveForeground();
  assert.equal(active.turn.state, "idle");
  assert.equal(active.uploads(), 0);
  assert.match(active.events.at(-1).error, /discarded/);
});

test("an interruption explanation survives asynchronous recorder cleanup", async () => {
  let releaseCleanup;
  const f = fixture({
    cancel: () =>
      new Promise((resolve) => {
        releaseCleanup = resolve;
      }),
  });
  await f.turn.start();
  const cleanup = f.turn.cancel(
    "Recording was discarded when you left the app.",
  );
  await Promise.resolve();
  assert.equal(f.turn.state, "cancelling");
  await Promise.resolve();
  releaseCleanup();
  await cleanup;
  assert.deepEqual(f.events.at(-1), {
    state: "idle",
    error: "Recording was discarded when you left the app.",
  });
  assert.equal(f.uploads(), 0);
});
test("an actual start and stop yields a reviewable transcript without an automatic chat send", async () => {
  const f = fixture();
  await f.turn.start();
  assert.equal(f.turn.state, "listening");
  await f.turn.stop();
  assert.equal(f.turn.state, "idle");
  assert.equal(f.uploads(), 1);
  assert.deepEqual(f.transcripts, ["A short, actual transcript"]);
  assert.equal(f.turn.canRetry, false);
});
test("duplicate start/stop taps cannot duplicate recordings or uploads", async () => {
  const f = fixture();
  await Promise.all([f.turn.start(), f.turn.start()]);
  await Promise.all([f.turn.stop(), f.turn.stop()]);
  assert.equal(f.starts(), 1);
  assert.equal(f.uploads(), 1);
});
test("recording failures clean up and do not create transcript text", async () => {
  const f = fixture({
    start: async () => {
      throw Error("device unavailable");
    },
  });
  await f.turn.start();
  assert.equal(f.cancels(), 1);
  assert.equal(f.turn.state, "idle");
  assert.equal(f.transcripts.length, 0);
});
test("empty and oversized audio never reaches transcription", async () => {
  for (const size of [0, 44, MAX_VOICE_BYTES + 1]) {
    const f = fixture({ stop: async () => new ArrayBuffer(size) });
    await f.turn.start();
    await f.turn.stop();
    assert.equal(f.uploads(), 0);
    assert.equal(f.turn.canRetry, false);
    assert.match(f.events.at(-1).error, /empty or too large/);
  }
});
test("a failed transcription preserves bounded audio for explicit retry", async () => {
  let attempts = 0;
  const f = fixture({
    transcribe: async () => {
      if (++attempts === 1) throw Error("Network unavailable");
      return "Recovered words";
    },
  });
  await f.turn.start();
  await f.turn.stop();
  assert.equal(f.turn.canRetry, true);
  assert.match(f.events.at(-1).error, /Network/);
  await f.turn.retry();
  assert.deepEqual(f.transcripts, ["Recovered words"]);
  assert.equal(f.turn.canRetry, false);
});
test("empty or overlong provider text is not inserted into the draft", async () => {
  for (const text of ["  ", "x".repeat(4001)]) {
    const f = fixture({ transcribe: async () => text });
    await f.turn.start();
    await f.turn.stop();
    assert.deepEqual(f.transcripts, []);
    assert.match(f.events.at(-1).error, /shorter recording/);
  }
});
test("leaving the account during permission resolution prevents microphone access", async () => {
  let grant;
  const f = fixture({
    permission: () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  });
  const start = f.turn.start();
  f.turn.dispose();
  grant(true);
  await start;
  assert.equal(f.starts(), 0);
});
test("late transcription after cancellation cannot cross a conversation or account boundary", async () => {
  let finish;
  const f = fixture({
    transcribe: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await f.turn.start();
  const stop = f.turn.stop();
  await new Promise((resolve) => setImmediate(resolve));
  await f.turn.cancel();
  finish("Private prior account words");
  await stop;
  assert.deepEqual(f.transcripts, []);
  assert.equal(f.turn.canRetry, false);
});
test("a disposed voice turn ignores late provider results and cannot restart", async () => {
  let finish;
  const f = fixture({
    transcribe: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await f.turn.start();
  const stop = f.turn.stop();
  await new Promise((resolve) => setImmediate(resolve));
  f.turn.dispose();
  finish("Discarded");
  await stop;
  await f.turn.start();
  assert.deepEqual(f.transcripts, []);
  assert.equal(f.starts(), 1);
});
test("native m4a and web recordings use supported transport content types", () => {
  assert.equal(voiceContentType("ios", "file:///recording.m4a"), "audio/mp4");
  assert.equal(voiceContentType("android"), "audio/mp4");
  assert.equal(voiceContentType("web"), "audio/webm");
  assert.equal(voiceContentType("web", "file.wav"), "audio/wav");
});
test("cancel drains pending recorder preparation before allowing another turn", async () => {
  let finish,
    recording = false,
    starts = 0;
  const f = fixture({
    start: async () => {
      if (++starts === 1)
        await new Promise((resolve) => {
          finish = resolve;
        });
      recording = true;
    },
    cancel: async () => {
      recording = false;
    },
  });
  const first = f.turn.start();
  await new Promise((resolve) => setImmediate(resolve));
  const cancel = f.turn.cancel();
  await f.turn.start();
  assert.equal(starts, 1);
  assert.equal(f.turn.state, "cancelling");
  finish();
  await first;
  await cancel;
  await f.turn.start();
  assert.equal(recording, true);
  assert.equal(f.turn.state, "listening");
  assert.equal(starts, 2);
});
test("cancel also drains a pending native stop/file read before reusing the recorder", async () => {
  let finish,
    recording = false;
  const f = fixture({
    start: async () => {
      recording = true;
    },
    stop: async () => {
      await new Promise((resolve) => {
        finish = resolve;
      });
      recording = false;
      return new ArrayBuffer(100);
    },
    cancel: async () => {
      recording = false;
    },
  });
  await f.turn.start();
  const stop = f.turn.stop();
  const cancel = f.turn.cancel();
  await f.turn.start();
  assert.equal(f.turn.state, "cancelling");
  finish();
  await stop;
  await cancel;
  await f.turn.start();
  assert.equal(recording, true);
  assert.equal(f.turn.state, "listening");
  assert.equal(f.uploads(), 0);
});
test("a failed native stop is cancelled rather than leaving a live microphone with idle UI", async () => {
  const f = fixture({
    stop: async () => {
      throw Error("Device interrupted");
    },
  });
  await f.turn.start();
  await f.turn.stop();
  assert.equal(f.turn.state, "idle");
  assert.equal(f.cancels(), 1);
  assert.match(f.events.at(-1).error, /Device interrupted/);
});

test("a recorder reset with a finished flag discards audio instead of uploading it", async () => {
  const f = fixture();
  await f.turn.start();
  await f.turn.recorderEvent({ isFinished: true, mediaServicesDidReset: true });
  assert.equal(f.turn.state, "idle");
  assert.equal(f.cancels(), 1);
  assert.equal(f.uploads(), 0);
  assert.match(f.events.at(-1).error, /interrupted/);
});

test("normal recorder completion still transcribes exactly once", async () => {
  const f = fixture();
  await f.turn.start();
  await Promise.all([
    f.turn.recorderEvent({ isFinished: true }),
    f.turn.recorderEvent({ isFinished: true }),
  ]);
  await f.turn.recorderEvent({ hasError: true });
  assert.equal(f.turn.state, "idle");
  assert.equal(f.uploads(), 1);
  assert.equal(f.cancels(), 0);
  assert.equal(f.transcripts.length, 1);
});
