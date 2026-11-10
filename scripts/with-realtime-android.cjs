const fs = require("node:fs/promises");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const rules = [
  [
    "WebRTC M155 ships an orphaned JNI wrapper for an optional AV1 video decoder.",
    "-dontwarn org.webrtc.Dav1dDecoder$Natives",
  ],
  [
    "WebRTC JNI_OnLoad looks up this generated class and its init method by name.",
    "-keep class org.jni_zero.JniZero { private static java.lang.Object[] init(boolean); }",
  ],
];

module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    async (mod) => {
      const file = path.join(
        mod.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      const existing = (await fs.readFile(file, "utf8")).split(/\r?\n/);
      const missing = rules.filter(([, rule]) => !existing.includes(rule));
      if (missing.length) {
        await fs.appendFile(
          file,
          missing
            .map(([comment, rule]) => `\n# ${comment}\n${rule}\n`)
            .join(""),
        );
      }
      return mod;
    },
  ]);
