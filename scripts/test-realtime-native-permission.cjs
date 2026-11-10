const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function load(file, requireModule) {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", file),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    requireModule,
    module,
    module.exports,
  );
  return module.exports;
}

function fixture({ granted = false, canAskAgain = true } = {}) {
  const deferred = Promise.withResolvers();
  const requesting = Promise.withResolvers();
  const listeners = new Set();
  const prompt = [];
  const recordings = [];
  let media = 0;
  let requests = 0;
  const AppState = {
    currentState: "active",
    addEventListener(_event, callback) {
      listeners.add(callback);
      return { remove: () => listeners.delete(callback) };
    },
  };
  const track = {
    enabled: true,
    addEventListener() {},
    removeEventListener() {},
    stop() {},
  };
  const rtc = {
    RTCPeerConnection: class {
      addEventListener() {}
      removeEventListener() {}
      addTrack() {}
      close() {}
      async createOffer() {
        return {
          type: "offer",
          sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
        };
      }
      async setLocalDescription(value) {
        this.localDescription = value;
      }
    },
    mediaDevices: {
      async getUserMedia(constraints) {
        assert.deepEqual(constraints, { audio: true, video: false });
        media++;
        return {
          getTracks: () => [track],
          getAudioTracks: () => [track],
          release() {},
        };
      },
    },
  };
  const { createRealtimePeer } = load("realtime-rtc.ts", (name) => {
    if (name === "react-native")
      return {
        AppState,
        Platform: { OS: "android" },
        NativeModules: { WebRTCModule: { peerConnectionInit() {} } },
      };
    if (name === "./realtime-rtc-core") return load("realtime-rtc-core.ts");
    if (name === "./audio-focus") return load("audio-focus.ts");
    if (name === "react-native-webrtc") return rtc;
    if (name === "expo-audio")
      return {
        AudioModule: {
          getRecordingPermissionsAsync: async () => ({ granted, canAskAgain }),
          requestRecordingPermissionsAsync: async () => {
            requests++;
            requesting.resolve();
            return deferred.promise;
          },
        },
        setAudioModeAsync: async (mode) =>
          recordings.push(mode.allowsRecording),
      };
    throw new Error(`Unexpected import ${name}`);
  });
  return {
    deferred,
    requesting,
    prompt,
    recordings,
    media: () => media,
    requests: () => requests,
    open: (signal) =>
      createRealtimePeer({
        signal,
        onState: () => {},
        onPermissionPrompt: (pending) => prompt.push(pending),
      }),
    change: (next) => {
      AppState.currentState = next;
      for (const callback of listeners) callback(next);
    },
  };
}

test("native realtime capture waits for the foreground after a microphone prompt", async () => {
  const f = fixture();
  const opening = f.open();
  await f.requesting.promise;
  f.change("background");
  f.deferred.resolve({ granted: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.prompt, [true]);
  assert.deepEqual(f.recordings, []);
  assert.equal(f.media(), 0);
  f.change("active");
  const peer = await opening;
  assert.deepEqual(f.prompt, [true, false]);
  assert.deepEqual(f.recordings, [true]);
  assert.equal(f.media(), 1);
  peer.close();
});

test("native realtime reuses an existing microphone grant without a prompt", async () => {
  const f = fixture({ granted: true });
  const peer = await f.open();
  assert.equal(f.requests(), 0);
  assert.deepEqual(f.prompt, []);
  assert.equal(f.media(), 1);
  peer.close();
});

test("microphone denial clears the native prompt state without audio setup", async () => {
  const f = fixture();
  const opening = f.open();
  await f.requesting.promise;
  f.change("background");
  f.deferred.resolve({ granted: false });
  await assert.rejects(opening, /Allow microphone access/);
  assert.deepEqual(f.prompt, [true, false]);
  assert.deepEqual(f.recordings, []);
  assert.equal(f.media(), 0);
});

test("native realtime stops pending foreground recovery when the attempt is aborted", async () => {
  const f = fixture();
  const controller = new AbortController();
  const opening = f.open(controller.signal);
  await f.requesting.promise;
  f.change("background");
  f.deferred.resolve({ granted: true });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(opening, { name: "AbortError" });
  assert.deepEqual(f.prompt, [true, false]);
  assert.deepEqual(f.recordings, []);
  assert.equal(f.media(), 0);
});
