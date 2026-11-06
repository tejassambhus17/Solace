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
const { VoiceTurn, MAX_VOICE_BYTES, voiceContentType } = exported.exports;
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
