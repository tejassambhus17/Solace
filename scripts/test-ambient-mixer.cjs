const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { resolve } = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = readFileSync(resolve(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const result = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (id) => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
    result,
    result.exports,
  );
  return result.exports;
}

const contract = load("server/src/ambient-contract.ts");
const { ambientTracks } = contract;
const {
  ambientStartupTimeoutMs,
  ambientTrackLevel,
  createAmbientMixerPlayback,
} = load("src/ambient-mixer-playback.ts", {
  "../server/src/ambient-contract": contract,
});
const playing = { playing: true, isLoaded: true, isBuffering: false };
const paused = { ...playing, playing: false };
const mix = (volumes, masterVolume = 55) => ({
  volumes: { rain: 0, ocean: 0, forest: 0, wind: 0, ...volumes },
  masterVolume,
  timerMinutes: 0,
});

function harness() {
  const mock = () => ({
    calls: [],
    loop: false,
    volume: 0,
    replace(source) {
      this.calls.push(["replace", source]);
    },
    play() {
      this.calls.push(["play"]);
    },
    pause() {
      this.calls.push(["pause"]);
    },
  });
  const players = Object.fromEntries(
    ambientTracks.map((track) => [track, mock()]),
  );
  const sources = Object.fromEntries(
    ambientTracks.map((track) => [track, `ambient-${track}.wav`]),
  );
  const states = [];
  const mixer = createAmbientMixerPlayback(players, sources, (next) =>
    states.push(next),
  );
  return { mixer, players, states };
}

test("all four tracks play independently, update gains, mute, pause, resume and rewind", () => {
  const { mixer, players, states } = harness();
  mixer.update(mix({ rain: 40, ocean: 50, forest: 60, wind: 70 }));
  for (const track of ambientTracks) {
    assert.deepEqual(players[track].calls, [
      ["replace", `ambient-${track}.wav`],
      ["play"],
    ]);
    assert.ok(players[track].loop);
    mixer.receive(track, playing);
  }
  assert.deepEqual(states.at(-1), { phase: "playing", failed: [] });
  const before = players.ocean.volume;
  const settings = mix({ rain: 0, ocean: 50, forest: 80, wind: 70 });
  mixer.update(settings);
  assert.deepEqual(players.rain.calls.at(-1), ["pause"]);
  assert.equal(players.ocean.volume, before);
  assert.equal(players.forest.volume, ambientTrackLevel("forest", settings));
  for (const track of ["ocean", "forest", "wind"]) {
    assert.deepEqual(players[track].calls.at(-1), ["play"]);
    assert.equal(players[track].calls.length, 2);
  }
  mixer.pause();
  assert.equal(mixer.active, false);
  mixer.update(settings);
  assert.deepEqual(players.wind.calls, [
    ["replace", "ambient-wind.wav"],
    ["play"],
    ["pause"],
    ["play"],
  ]);
  mixer.pause(true);
  assert.deepEqual(players.wind.calls.at(-1), ["replace", null]);
  assert.deepEqual(players.rain.calls.at(-1), ["replace", null]);
  mixer.update(mix({ wind: 60 }));
  assert.deepEqual(players.wind.calls.slice(-2), [
    ["replace", "ambient-wind.wav"],
    ["play"],
  ]);
  mixer.pause();
});

test("a late-starting or failed layer is isolated and has its own watchdog", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { mixer, players, states } = harness();
  const settings = mix({ rain: 50, ocean: 50, forest: 50, wind: 50 });
  mixer.update(settings);
  mixer.receive("rain", playing);
  mixer.receive("ocean", playing);
  mixer.receive("forest", { ...paused, error: "decode failure" });
  assert.deepEqual(states.at(-1), { phase: "playing", failed: ["forest"] });
  t.mock.timers.tick(ambientStartupTimeoutMs);
  assert.deepEqual(states.at(-1), {
    phase: "playing",
    failed: ["forest", "wind"],
  });
  assert.deepEqual(players.rain.calls.at(-1), ["play"]);
  assert.deepEqual(players.ocean.calls.at(-1), ["play"]);
  mixer.update(mix({ rain: 50, ocean: 50 }));
  mixer.update(settings);
  mixer.receive("forest", playing);
  mixer.receive("wind", playing);
  assert.deepEqual(states.at(-1), { phase: "playing", failed: [] });
  assert.deepEqual(players.forest.calls.slice(-2), [
    ["replace", "ambient-forest.wav"],
    ["play"],
  ]);
  mixer.pause();
});

test("buffering and web load events do not stop a layer, but a sustained pause does", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { mixer, players, states } = harness();
  mixer.update(mix({ forest: 50, wind: 50 }));
  mixer.receive("forest", { ...playing, isLoaded: false });
  assert.equal(states.at(-1).phase, "starting");
  mixer.receive("forest", playing);
  mixer.receive("wind", playing);
  mixer.receive("forest", paused, true);
  t.mock.timers.tick(2500);
  assert.equal(states.at(-1).phase, "playing");
  mixer.receive("forest", { ...paused, isBuffering: true });
  t.mock.timers.tick(1500);
  mixer.receive("forest", playing);
  t.mock.timers.tick(ambientStartupTimeoutMs);
  assert.deepEqual(states.at(-1), { phase: "playing", failed: [] });
  mixer.receive("forest", paused);
  t.mock.timers.tick(2500);
  assert.deepEqual(states.at(-1), { phase: "playing", failed: ["forest"] });
  assert.deepEqual(players.wind.calls.at(-1), ["play"]);
  mixer.pause();
  mixer.receive("wind", playing);
  t.mock.timers.tick(ambientStartupTimeoutMs);
  assert.deepEqual(states.at(-1), { phase: "paused", failed: [] });
});

test("zero master pauses all layers and cancels startup watchdogs", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { mixer, players, states } = harness();
  mixer.update(mix({ forest: 50, wind: 50 }));
  mixer.update(mix({ forest: 50, wind: 50 }, 0));
  t.mock.timers.tick(ambientStartupTimeoutMs);
  assert.deepEqual(states.at(-1), { phase: "paused", failed: [] });
  for (const track of ["forest", "wind"])
    assert.deepEqual(players[track].calls.at(-1), ["pause"]);
});

test("the four bundled loops are distinct audible PCM assets with click-safe edges and mix headroom", () => {
  const hashes = new Set();
  const fullMix = mix({ rain: 100, ocean: 100, forest: 100, wind: 100 }, 100);
  const calibratedRms = [];
  let summedPeak = 0;
  for (const track of ambientTracks) {
    const file = readFileSync(
      resolve(__dirname, "..", "assets", `ambient-${track}.wav`),
    );
    hashes.add(createHash("sha256").update(file).digest("hex"));
    assert.equal(file.toString("ascii", 0, 4), "RIFF");
    assert.equal(file.toString("ascii", 8, 12), "WAVE");
    assert.equal(file.readUInt16LE(20), 1, "PCM format");
    assert.equal(file.readUInt16LE(22), 1, "mono");
    assert.equal(file.readUInt32LE(24), 22050, "sample rate");
    assert.equal(file.readUInt16LE(34), 16, "bits per sample");
    assert.equal(file.readUInt32LE(40), 12 * 22050 * 2, "12-second loop");
    assert.equal(file.readInt16LE(44), 0, "fade-in starts at silence");
    assert.equal(
      file.readInt16LE(file.length - 2),
      0,
      "fade-out reaches silence",
    );
    const gain = ambientTrackLevel(track, fullMix);
    let peak = 0;
    let sumSquares = 0;
    for (let offset = 44; offset < file.length; offset += 2) {
      const sample = (file.readInt16LE(offset) / 32768) * gain;
      peak = Math.max(peak, Math.abs(sample));
      sumSquares += sample ** 2;
    }
    summedPeak += peak;
    calibratedRms.push(20 * Math.log10(Math.sqrt(sumSquares / (12 * 22050))));
  }
  assert.equal(hashes.size, ambientTracks.length);
  assert.ok(summedPeak < 0.8, "even aligned peaks retain headroom");
  assert.ok(Math.max(...calibratedRms) - Math.min(...calibratedRms) < 3);
});
