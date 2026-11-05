const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { ROOT, packageBin, runtimeEnvironment } = require("./tooling.cjs");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// Run the real Expo plugins in memory. This catches cross-plugin permission
// conflicts that a JavaScript bundle cannot reveal; it does not install an app.
const result = spawnSync(
  process.execPath,
  [
    packageBin(ROOT, "expo", "expo"),
    "config",
    "--type",
    "introspect",
    "--json",
  ],
  {
    cwd: ROOT,
    env: runtimeEnvironment(process.execPath),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  },
);
assert.equal(
  result.status,
  0,
  "Expo native configuration must introspect successfully",
);
const config = JSON.parse(result.stdout);
const mods = config._internal.modResults;
const manifest = mods.android.manifest.manifest;
const permissions = manifest["uses-permission"] || [];
test("photo-picker configuration does not block the voice microphone permission", () => {
  const entries = permissions.filter(
    (entry) => entry.$["android:name"] === "android.permission.RECORD_AUDIO",
  );
  assert.ok(entries.length > 0, "Recording permission must be declared");
  assert.ok(
    entries.every((entry) => entry.$["tools:node"] !== "remove"),
    "The photo plugin must not remove the audio permission",
  );
  assert.ok(
    !(config.android.blockedPermissions || []).includes(
      "android.permission.RECORD_AUDIO",
    ),
  );
});
test("iOS microphone purpose explains voice while the unused camera permission remains absent", () => {
  assert.match(
    mods.ios.infoPlist.NSMicrophoneUsageDescription,
    /voice message for Solace/i,
  );
  assert.match(
    mods.ios.infoPlist.NSMicrophoneUsageDescription,
    /transcription/i,
  );
  assert.equal(mods.ios.infoPlist.NSCameraUsageDescription, undefined);
});
test("voice and ambience do not enable background recording or playback services", () => {
  assert.ok(!(mods.ios.infoPlist.UIBackgroundModes || []).includes("audio"));
  const services = manifest.application.flatMap(
    (application) => application.service || [],
  );
  assert.ok(
    !services.some((service) =>
      /expo\.modules\.audio\.service\.(AudioRecordingService|AudioControlsService)/.test(
        service.$["android:name"],
      ),
    ),
  );
  assert.ok(
    !permissions.some(
      (entry) =>
        entry.$["android:name"] ===
          "android.permission.FOREGROUND_SERVICE_MICROPHONE" &&
        entry.$["tools:node"] !== "remove",
    ),
  );
});

function loadSource(
  filename,
  requireMock = () => {
    throw Error("Unexpected import");
  },
) {
  const output = ts.transpileModule(
    fs.readFileSync(path.join(ROOT, "src", filename), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    requireMock,
  );
  return module.exports;
}
const featureGuard = loadSource("native-features.ts");
test("an older native binary renders text fallbacks without evaluating missing audio libraries", () => {
  for (const platform of ["ios", "android"]) {
    const requireMock = (name) => {
      if (name === "react")
        return {
          __esModule: true,
          default: {
            createElement: (type, props, ...children) => ({
              type,
              props,
              children,
            }),
          },
        };
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "expo") return { requireOptionalNativeModule: () => null };
      if (name === "./ui") return { AppText: "AppText" };
      if (name === "./theme")
        return { useTheme: () => ({ colors: { muted: "#aaa" } }) };
      if (name === "./native-features") return featureGuard;
      throw Error(`A missing native implementation was evaluated: ${name}`);
    };
    assert.equal(
      loadSource("VoiceControls.tsx", requireMock).VoiceControls({}).type,
      "AppText",
    );
    assert.equal(
      loadSource("AmbientSound.tsx", requireMock).AmbientSound({}).type,
      "AppText",
    );
  }
});
test("web does not probe a native module registry before loading its real browser implementation", () => {
  assert.equal(
    featureGuard.nativeModulesAvailable(
      "web",
      () => {
        throw Error("Native registry is unavailable on web");
      },
      ["ExpoAudio"],
    ),
    true,
  );
});
test("a native feature requires every dependency and handles an unavailable registry honestly", () => {
  const modules = new Set(["ExpoAudio", "ExpoSpeech", "FileSystem"]);
  assert.equal(
    featureGuard.nativeModulesAvailable("ios", (name) => modules.has(name), [
      ...modules,
    ]),
    true,
  );
  modules.delete("ExpoSpeech");
  assert.equal(
    featureGuard.nativeModulesAvailable("ios", (name) => modules.has(name), [
      "ExpoAudio",
      "ExpoSpeech",
      "FileSystem",
    ]),
    false,
  );
  assert.equal(
    featureGuard.nativeModulesAvailable(
      "android",
      () => {
        throw Error("Missing registry");
      },
      ["ExpoAudio"],
    ),
    false,
  );
});
