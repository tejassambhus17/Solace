# Verification record

Date: 5 November 2026. Record actual results here; never turn an unexecuted release checklist into a pass.

## Automated checks executed
- Mobile TypeScript: passed after integration and dependency alignment.
- Expo SDK compatibility: dependencies are up to date.
- Wellness regressions: **7/7 passed**. Tests cover local-calendar dates, duplicate check-ins, streak boundaries, partial completion, XP, reflection totals and stable daily affirmations.
- Reminder coordination regressions: **2/2 passed**, executing the current scheduling module with mocked native APIs. Logout cancels a late schedule; cleanup from an old restore preserves a newer account's schedules. These do not establish OS notification delivery.
- Backend integration: **15/15 passed**. Tests cover password/token handling, login/logout, isolation, input validation, durable persistence/reopen, failed-disk rollback, consent, history, source-memory deletion, account export/deletion, chat bounds, concurrent deletion, provider adapter with stub, explicit CORS and bounded reverse-proxy configuration.
- Backend TypeScript and production compilation: passed.
- Expo web export: passed. Android JavaScript/Hermes export: passed. These are bundle checks, not installed APK checks.
- Impeccable source detector: no findings (`[]`). Browser design comparison reviewed in root `design-qa.md`.

## Browser journeys actually exercised
Using a synthetic account on the local API (no external AI key):
1. Create account and open personal home.
2. Select mood, add note, save check-in, see success.
3. Send companion message; receive an explicitly labeled built-in response and working activity action.
4. Start the suggested 60-second breathing session; observe completion into feedback.
5. Save feedback and explicitly approve a preference; return to the same conversation with retained messages.
6. Open Journey and verify actual check-in, completed moment, feedback and XP counts.
7. Inspect saved memory and enable personalization.
8. Switch light/dark, inspect both themes at phone size, reload and retain session/theme.
9. Complete all four anxiety-reflection questions and save the result.
10. Start and save a guided journal entry.
11. Open anxiety resource, mark a practice tried and save partial progress.
12. Mark a plan task complete and save the plan.
13. Enter invalid reminder time, observe validation, then save a valid preference. Web limitation is shown; no fake delivery claim.
14. Browser console had no recorded error entries at end of test pass.

Other implemented controls are source-reviewed and API-covered where applicable, but are not all separately browser-click-tested. Tests use isolated temporary data. The preview account is synthetic QA data, not a preseeded production history.

## Native build and external completion
- EAS account check: **not logged in**.
- Native Android prebuild: passed after adding `expo-system-ui`.
- Local Android release-preview build: attempted with available JDK21, installed SDK, and a workspace Gradle cache. See the final build outcome below.
- Live provider: **not tested against a real service**. User explicitly chose to continue without a key. Stub test does not establish account/model access.
- Public HTTPS API: not deployed/configured.
- APK fresh installation, native reminder foreground/background/closed delivery, tap routing, permission denial, device theme/accessibility and interruption checks: **pending**.
- Final demo/submission: pending.

Reminder preferences restore on native sign-in when OS permission is already granted; permission denial requires explicit user action. Native schedule IDs are tracked device-locally. This reconciliation code is compiled/source-reviewed but not device-verified.

Final source review caught and fixed a sign-in ordering issue: the authenticated user is now published only after saved account data loads, so reminder restoration sees the saved preferences. Logout invalidates in-flight restoration; stale cleanup cancels only its own schedules. The native restore path still requires the device checks above.

## Dependency advisory review
The backend audit is clean after updating Zod. The root/mobile `npm audit` reports five moderate transitive advisories through Expo CLI/fingerprint's glob/minimatch dependencies, and no high/critical advisories. The suggested automatic fix downgrades Expo across major SDK versions; it was not applied because that would break the selected native toolchain. These tooling advisories are not evidence of a tested exploit in the private-data API. Recheck upstream patches before release; no blanket zero-vulnerability claim is made.

## Local Android build outcome
**Succeeded**: arm64 Android release-preview APK produced at `outputs/solace-build-validation.apk` (30,061,857 bytes). `aapt` confirms package `com.solacewellness.app`, launchable MainActivity, minSdk24 and targetSdk36. `apksigner` verifies Android Debug signing certificate. No Android device was attached, so installation/launch/device behavior remain unverified.

Build failures fixed: Windows 8.3 compiler name combined with `-no-canonical-prefixes` lost C++ driver mode; explicit `--driver-mode=g++` restored runtime linkage. Windows Ninja object paths exceeded limits; a tested 240-character CMake setting resolved them. `scripts/patch-native.cjs` records version guards for the pinned Expo/RN versions and is called after prebuild.

The APK embeds the development emulator address `http://10.0.2.2:3001`; release cleartext transport remains blocked. It predates the final reminder-restoration hardening; the current source is separately checked and bundled. This artifact proves native compilation and is **not a functional phone/submission build**. Configure public HTTPS and rebuild before distributing it. The build script forces JavaScript rebundling and checks the expected API URL is embedded.

Automatic approval review rejected a proposed broad cleartext-HTTP opt-in in the Android release manifest as a transport-security weakening. The opt-in was not applied; no alternative mechanism bypasses it. Hosting was explicitly deferred by the user until local app review.

