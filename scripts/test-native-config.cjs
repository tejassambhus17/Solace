const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { ROOT, packageBin, runtimeEnvironment } = require("./tooling.cjs");
const fs = require("node:fs");
const os = require("node:os");
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

test("Android launch uses the Solace lotus and matching day/night window colors", () => {
  const { styles, colors, colorsNight } = mods.android;
  const theme = (name) => Object.fromEntries(
    styles.resources.style.find(({ $ }) => $.name === name).item.map(
      ({ $, _ }) => [$.name, _],
    ),
  );
  const launch = theme("Theme.App.SplashScreen");
  assert.equal(launch["android:windowBackground"], "@drawable/solace_legacy_launch");
  assert.equal(launch["android:windowSplashScreenAnimatedIcon"], "@drawable/solace_launch_logo");
  assert.equal(launch["android:windowSplashScreenBackground"], "@color/solace_launch_background");
  assert.equal(theme("AppTheme")["android:windowBackground"], launch["android:windowSplashScreenBackground"]);
  assert.equal(theme("AppTheme")["android:windowLightStatusBar"], "?attr/isLightTheme");
  assert.equal(theme("AppTheme")["android:windowLightNavigationBar"], "?attr/isLightTheme");
  const color = (values) => values.resources.color.find(({ $ }) => $.name === "solace_launch_background")._;
  assert.equal(color(colors), "#FBF0E8");
  assert.equal(color(colorsNight), "#000000");
  assert.equal(manifest.application[0].activity.find(({ $ }) => $["android:name"] === ".MainActivity").$["android:theme"], "@style/Theme.App.SplashScreen");
});

function iconFixtureRoot(t) {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const projectRoot = fs.mkdtempSync(path.join(temporaryRoot, "solace-icons-"));
  t.after(() => {
    const resolved = fs.realpathSync(projectRoot);
    assert.equal(path.dirname(resolved), temporaryRoot);
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return projectRoot;
}

test("Expo generates Solace's three iOS Home Screen appearances in the AppIcon catalog", async (t) => {
  const { getPngInfo } = require("@expo/image-utils");
  const {
    setIconsAsync,
  } = require("@expo/prebuild-config/build/plugins/icons/withIosIcons");
  const projectRoot = iconFixtureRoot(t);
  const iosTarget = path.join(projectRoot, "ios", "Solace");
  fs.mkdirSync(iosTarget, { recursive: true });
  fs.writeFileSync(path.join(iosTarget, "AppDelegate.swift"), "");

  assert.equal(config.name, "Solace");
  assert.equal(config.ios.bundleIdentifier, "com.solacewellness.app");
  assert.equal(config.icon, config.ios.icon.light);
  const appearances = ["light", "dark", "tinted"];
  const icon = Object.fromEntries(
    appearances.map((appearance) => [
      appearance,
      path.resolve(ROOT, config.ios.icon[appearance]),
    ]),
  );
  assert.equal(new Set(Object.values(icon)).size, appearances.length);
  await setIconsAsync({ ios: { icon } }, projectRoot);

  const catalog = path.join(iosTarget, "Images.xcassets", "AppIcon.appiconset");
  const { images } = JSON.parse(
    fs.readFileSync(path.join(catalog, "Contents.json"), "utf8"),
  );
  assert.deepEqual(
    images.map((image) => image.appearances ?? []),
    [
      [],
      [{ appearance: "luminosity", value: "dark" }],
      [{ appearance: "luminosity", value: "tinted" }],
    ],
  );
  for (const image of images) {
    assert.equal(image.idiom, "universal");
    assert.equal(image.platform, "ios");
    assert.equal(image.size, "1024x1024");
    const { width, height } = await getPngInfo(
      path.join(catalog, image.filename),
    );
    assert.equal(width, 1024);
    assert.equal(height, 1024);
  }
});

test("Expo generates Solace's Android adaptive, monochrome and fallback launcher resources", async (t) => {
  const { compileModsAsync } = require("@expo/config-plugins");
  const {
    withAndroidIcons,
  } = require("@expo/prebuild-config/build/plugins/icons/withAndroidIcons");
  const projectRoot = iconFixtureRoot(t);
  const appRoot = path.join(projectRoot, "android", "app", "src", "main");
  const res = path.join(appRoot, "res");
  const colorsPath = path.join(res, "values", "colors.xml");
  const manifestPath = path.join(appRoot, "AndroidManifest.xml");
  fs.mkdirSync(path.dirname(colorsPath), { recursive: true });
  fs.writeFileSync(
    colorsPath,
    '<resources><color name="colorPrimary">#000000</color></resources>',
  );
  fs.writeFileSync(
    manifestPath,
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:name=".MainApplication" android:icon="@mipmap/ic_launcher"/></manifest>',
  );

  assert.equal(config.android.package, "com.solacewellness.app");
  const { foregroundImage, monochromeImage, backgroundColor } =
    config.android.adaptiveIcon;
  assert.notEqual(foregroundImage, monochromeImage);
  assert.match(backgroundColor, /^#[0-9a-f]{6}$/i);
  const androidConfig = {
    icon: path.resolve(ROOT, config.icon),
    android: {
      adaptiveIcon: {
        foregroundImage: path.resolve(ROOT, foregroundImage),
        monochromeImage: path.resolve(ROOT, monochromeImage),
        backgroundColor,
      },
    },
  };
  await compileModsAsync(withAndroidIcons(androidConfig), {
    projectRoot,
    platforms: ["android"],
  });

  const launcherManifest = fs.readFileSync(manifestPath, "utf8");
  assert.match(launcherManifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(
    launcherManifest,
    /android:roundIcon="@mipmap\/ic_launcher_round"/,
  );
  assert.ok(
    fs
      .readFileSync(colorsPath, "utf8")
      .includes(`<color name="iconBackground">${backgroundColor}</color>`),
  );
  for (const launcher of ["ic_launcher", "ic_launcher_round"]) {
    const xml = fs.readFileSync(
      path.join(res, "mipmap-anydpi-v26", `${launcher}.xml`),
      "utf8",
    );
    assert.match(xml, /<background android:drawable="@color\/iconBackground"/);
    assert.match(
      xml,
      /<foreground android:drawable="@mipmap\/ic_launcher_foreground"/,
    );
    assert.match(
      xml,
      /<monochrome android:drawable="@mipmap\/ic_launcher_monochrome"/,
    );
  }
  for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
    for (const launcher of [
      "ic_launcher",
      "ic_launcher_round",
      "ic_launcher_foreground",
      "ic_launcher_monochrome",
    ]) {
      assert.ok(
        fs.statSync(path.join(res, `mipmap-${density}`, `${launcher}.webp`))
          .size > 0,
      );
    }
  }
});

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
    /live voice conversation/i,
  );
  assert.match(
    mods.ios.infoPlist.NSMicrophoneUsageDescription,
    /voice message for transcription/i,
  );
  assert.equal(mods.ios.infoPlist.NSCameraUsageDescription, undefined);
});
test("iOS local reminders require no remote push signing entitlement", () => {
  assert.ok(mods.ios.entitlements);
  assert.equal(mods.ios.entitlements["aps-environment"], undefined);
  assert.ok(
    !(mods.ios.infoPlist.UIBackgroundModes || []).includes("remote-notification"),
  );
});
test("Android declares the WebRTC network permissions without enabling camera", () => {
  const enabled = permissions
    .filter((entry) => entry.$["tools:node"] !== "remove")
    .map((entry) => entry.$["android:name"]);
  assert.ok(enabled.includes("android.permission.ACCESS_NETWORK_STATE"));
  assert.ok(enabled.includes("android.permission.CHANGE_NETWORK_STATE"));
  assert.ok(enabled.includes("android.permission.MODIFY_AUDIO_SETTINGS"));
  assert.ok(!enabled.includes("android.permission.CAMERA"));
});
test("native prebuild gives Biometric Lock an explicit Face ID purpose and Android permission", () => {
  assert.match(
    mods.ios.infoPlist.NSFaceIDUsageDescription,
    /unlock your saved sign-in or private journal/i,
  );
  assert.ok(
    permissions.some(
      (entry) =>
        entry.$["android:name"] === "android.permission.USE_BIOMETRIC" &&
        entry.$["tools:node"] !== "remove",
    ),
  );
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
test("older native apps can load the live voice transport before a rebuild", async () => {
  const transport = loadSource("realtime-rtc.ts", (name) => {
    if (name === "react-native")
      return { Platform: { OS: "android" }, NativeModules: {} };
    if (name === "./realtime-rtc-core")
      return loadSource("realtime-rtc-core.ts");
    if (name === "./audio-focus") return loadSource("audio-focus.ts");
    throw new Error(`Unexpected native import before a rebuild: ${name}`);
  });
  assert.equal(transport.realtimePeerAvailable(), false);
  await assert.rejects(
    transport.createRealtimePeer({ onState: () => {} }),
    /isn’t available in this app build/,
  );
});
test("widget routes accept only the four local destinations and ship without group entitlements", () => {
  const { widgetDestination } = loadSource("widget-links.ts");
  assert.equal(widgetDestination("solace://widget/today").route, "today");
  assert.deepEqual(widgetDestination("solace://widget/breathe").params, {
    durationSec: 180,
    source: "widget",
  });
  assert.equal(
    widgetDestination("solace://widget/affirmation").route,
    "affirmation",
  );
  assert.equal(widgetDestination("solace://widget/reminders").tab, "profile");
  for (const invalid of [
    null,
    "solace://widget/voice-talk",
    "solace://widget/breathe?account=other",
    "https://widget/breathe",
    "solace://widget/%62reathe",
  ])
    assert.equal(widgetDestination(invalid), null);
  assert.equal(config.scheme, "solace");
  assert.equal(
    mods.ios.entitlements?.["com.apple.security.application-groups"],
    undefined,
  );
});
test("an older native binary renders text fallbacks without evaluating missing audio libraries", () => {
  for (const platform of ["ios", "android"]) {
    let showVoiceNotice;
    const requireMock = (name) => {
      if (name === "react")
        return {
          __esModule: true,
          useState: (initial) => [
            showVoiceNotice ?? initial,
            (shown) => (showVoiceNotice = shown),
          ],
          default: {
            Fragment: "Fragment",
            createElement: (type, props, ...children) => ({
              type,
              props,
              children,
            }),
          },
        };
      if (name === "react-native")
        return {
          Platform: { OS: platform },
          Pressable: "Pressable",
          StyleSheet: { create: (styles) => styles },
        };
      if (name === "expo") return { requireOptionalNativeModule: () => null };
      if (name === "@expo/vector-icons/MaterialCommunityIcons")
        return { default: "MaterialCommunityIcons", __esModule: true };
      if (name === "./ui")
        return { AppText: "AppText", Icon: "Icon", IconButton: "IconButton" };
      if (name === "./theme")
        return { useTheme: () => ({ colors: { muted: "#aaa" } }) };
      if (name === "./native-features") return featureGuard;
      if (name === "./ChatComposer")
        return loadSource("ChatComposer.tsx", requireMock);
      throw Error(`A missing native implementation was evaluated: ${name}`);
    };
    const { VoiceControls } = loadSource("VoiceControls.tsx", requireMock);
    const fallback = VoiceControls({
      variant: "talk",
      renderComposer: (microphone) => ({ type: "Composer", microphone }),
    });
    const rendered = fallback.type(fallback.props);
    assert.equal(rendered.children[0].type, "AppText");
    assert.match(rendered.children[0].children[0], /still type your message/);
    assert.equal(rendered.children[1].type, "Composer");
    assert.equal(
      rendered.children[1].microphone.props.label,
      "Voice availability",
    );
    const chat = VoiceControls({
      renderComposer: (microphone, playback, details) => ({
        microphone,
        playback,
        details,
      }),
    });
    const composer = chat.type(chat.props);
    assert.equal(composer.playback, null);
    assert.equal(composer.details, undefined);
    const microphone = composer.microphone.type(composer.microphone.props);
    assert.equal(microphone.type, "Pressable");
    assert.equal(microphone.props.accessibilityLabel, "Voice availability");
    microphone.props.onPress();
    assert.match(
      chat.type(chat.props).details.children[0],
      /still type your message/,
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
