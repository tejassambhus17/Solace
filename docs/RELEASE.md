# Release and submission

Deadline: 10 November 2026 at 11:59 AM IST, supplied by user. Aim to upload by 10:30 AM IST.

## Public API
Deploy `server/` to a Node-capable service with one persistent private volume mounted at `DATABASE_PATH`. Set `NODE_ENV=production`, `AI_MODE=live`, `OPENAI_API_KEY` and precise `ALLOWED_ORIGINS`, then serve through HTTPS. Use the Dockerfile or `npm ci && npm run build` then start the server. Verify `/api/health`, a fresh account, and a live request. Configure proxy trust deliberately before exposing rate-limited endpoints behind a reverse proxy. Back up the SQLite file. [OpenAI configuration](OPENAI_MIGRATION.md)

## APK
Set root `EXPO_PUBLIC_API_URL=https://YOUR_API_HOST` in the EAS preview environment. It must be public HTTPS, not localhost, an emulator address or laptop LAN address. Run `npx eas-cli login`, then `npx eas-cli build --platform android --profile preview`. Credentials and project setup are account-specific; do not fabricate project IDs or signing material. The profile requests a directly installable APK.

## Install the Azure demo on a personal iPhone

Use a Mac with Xcode 26.4 or later, a supported Node version from `.node-version`, and an iPhone running iOS 16.4 or later. Sign in under **Xcode → Settings → Accounts** and use the Apple Development certificate for your Personal Team. If Xcode has no certificate, use **Manage Certificates** in Accounts to create one. Connect and trust the iPhone, then enable Developer Mode when iOS prompts for it. [Expo SDK 58 requirements](https://docs.expo.dev/versions/v58.0.0/) · [Apple Personal Team signing](https://developer.apple.com/help/account/basics/about-your-developer-account/) · [iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/)

From the project directory or the extracted iOS build archive, run `bash scripts/build-ios-azure.sh`. Select the connected iPhone and your Personal Team if prompted. The command generates the iOS project, builds the Release configuration with the Azure HTTPS API, and installs it to the selected device. The free Personal Team provisioning profile expires after seven days. [Expo local builds](https://docs.expo.dev/guides/local-app-development/) · [Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account/)

## Fresh-install acceptance
- Signup, login, reopen and verify session/data retained.
- Two accounts remain isolated; deleted conversation and its derived memories disappear.
- Use real live AI; converse over several turns, launch an activity, return to the same conversation.
- Complete an assessment, breathing session, reflection, guide and plan action; see actual records in Journey.
- Inspect consented memory, disable it and remove it.
- Schedule a reminder in the near future. Verify foreground, background and normally closed app; tap opens correct destination. Test edits, disabling and permission denial. Android Force stop is a separate OS restriction.
- Check large text, safe areas, keyboard, Android Back, interruption, reduced motion, light/dark/system theme.
- Turn off network during chat/save, retry without losing input.
- Run the APK with no development server running.

## Demo
Record the final installed build. Open with the problem and the signature check-in → conversation → Moment → feedback → return journey. Then briefly show assessments, resources, plans, history management, Journey, memory/privacy, reminders and both themes. Demonstrate a real delivered reminder. Label any prepared demo history. Do not claim built-in responses are live AI.

Submit APK and video in the Telegram submission thread identified by the brief. Confirm links and build installability from another device. Later TestFlight work requires Apple/Expo setup and signing; it is not covered by a web preview.

## Local Windows native build

`scripts/build-android.ps1 -ApiUrl https://YOUR_API_HOST` regenerates Android, applies the version-guarded Windows CMake compatibility patch, and builds an arm64 preview APK. The generated development signing key is not store signing. The patch addresses Windows short compiler paths dropping C++ driver mode, and native object-path limits. It never disables HTTPS requirements or accepts new SDK licenses. Review/retest the patch when upgrading Expo or React Native.

Behind a known proxy, configure `TRUST_PROXY_HOPS` to its exact known hop count (0–3); leave it 0 without a proxy. Do not expose the API through arbitrary/untrusted alternate paths with a nonzero hop count. Docker runtime build instructions are in server/README.md.

## Android Realtime USB QA

The isolated **Solace USB QA** release connects to `https://127.0.0.1:3164` through Android Debug Bridge. It uses a separate app ID and database. Its network configuration trusts the short-lived QA certificate for loopback. Standard releases continue to require public HTTPS.

1. Keep the QA API running on the Windows host. From the repository, restart a stopped instance with `& (node -p "require('./scripts/tooling.cjs').selectRuntime()") work/realtime-usb-release/start-api.mjs`.
2. Connect the physical Android phone, enable USB debugging, and approve the host on the phone. Run `adb -d reverse --no-rebind tcp:3164 tcp:3164`. Use `adb -d reverse --list` to check an existing mapping.
3. Install `outputs/Solace-Android-Realtime-USB-Release-arm64.apk` and open **Solace USB QA**. Register a disposable email/password account in its separate database.
4. Keep the USB connection and the phone's internet access active. Open Solace Companion and tap the microphone. Try two turns, interrupt a reply, mute and unmute, end the session, and reopen the conversation to check the transcript.
