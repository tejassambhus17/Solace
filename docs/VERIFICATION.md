# Verification record

## Cross-platform UI repair — 6 November 2026

The [UI repair QA report](QA_UI_REPAIR.md) records matched visual evidence, physical Android recordings, the Explore and Daily Pause completion journeys, and the measured tab-rendering changes. All 162 client checks and 76 backend tests passed. Native iOS materials, public release sign-in, and final Android release performance remain separate checks.

## Gemini integration — 6 November 2026

- The configured server-side key listed `gemini-3.1-flash-lite` and generated a reply. The compiled API then passed a synthetic smoke test with the local `AI_MODE=auto`, an in-memory database and OpenAI disabled for the run. Gemini recalled a detail from a prior chat turn, both turns were saved, a validated structured Moment used the approved synthetic preference, and a weekly question was generated from counts. Explicit urgent input still took the built-in support route.
- In an early repeat, Gemini returned weekly wording that the existing validator rejected. The prompt now specifies the accepted question form. The full live smoke test and four additional weekly cases with different synthetic counts passed after that change.
- `npm run server:test` passed **76/76** and `npm run test:tooling` passed **18/18**. Integration tests exercised provider selection, history, consent revocation before failover, structured output, rate limits, refusal, and transient OpenAI failover using stubs. Client and server type checks, formatting, server build and web export passed. The exported JavaScript was checked for the configured provider credentials.
- The live checks used synthetic data. The Google project's billing and data-sharing settings were outside this test, and OpenAI failover and transcription were exercised through stubs. Production HTTPS and a full run from the release APK remain separate.

## Stabilization pass — 6 November 2026

[Reproductions, fixes, retests, screen coverage and screenshots](QA_STABILIZATION.md)

### Automated and build checks

| Check | Actual result |
|---|---|
| `npm run doctor` | Passed on Node 24.22.1. Both npm package trees and native Sharp/transform binaries were present. |
| `npm run format:check`, `npm run typecheck`, `npm run server:typecheck`, `npm run server:build` | Passed. The repository has no separate JavaScript lint script. |
| `npm run server:test` | **73/73** integration and process tests passed with loopback access. A sandbox-only attempt failed with socket `EACCES`. |
| Client regressions | **157/157** passed across wellness (7), reminders (8), session-state (35), insights (9), routine (10), offline (9), tooling (18), API config (11), voice (17), progress (18), Moments (9) and native config (6). |
| `npm run export:web`, `npm run export:android`, `npm run export:ios` | Passed with an explicit reserved HTTPS QA URL and two Metro workers. iOS evidence is a JavaScript/Hermes export. |
| Physical Android Debug | Rebuilt arm64 with JDK 21 and the installed Android SDK, using a separate QA application ID. Started on Android 15 using Metro and USB reverse. Actual SDK permission declarations include audio recording and notifications. |
| Android release-mode Gradle assembly | Passed offline with an isolated arm64 QA ID and a development signing key. Inspected the final 1,974,716-byte embedded Hermes bundle and confirmed the reserved HTTPS QA URL. |
| Physical Android packaged startup | **Passed** on the attended retry. The separate non-debuggable release QA package installed after the initial `INSTALL_FAILED_USER_RESTRICTED`. With no USB reverse mappings and the QA Metro process stopped, it cold-launched to Welcome and opened onboarding. Android reported 1,519 ms for the Activity launch. The reserved HTTPS URL limits this run to startup and onboarding. [Welcome](screenshots/stabilization/android-release-welcome.png) · [Onboarding](screenshots/stabilization/android-release-onboarding.png) |

### Physical Android coverage

- **Verified.** Fresh welcome and onboarding, signup through the OS keyboard, saved Calm mood, cold app restart with restored session and check-in, native chat send with keyboard present, labeled built-in reply, and honest Voice Talk fallback. These used a real Express server and disposable SQLite records over USB reverse.
- **Verified.** At the handset's existing text scale, a two-line chat message could be sent with the keyboard open. The corrected composer left 28 physical pixels between its border and the IME, down from 158 on the same phone and state.
- **Verified.** Solace's recommended two-minute breathing practice paused at 1:45, held across two captures, resumed to feedback and saved. The same account's Journey displayed one Moment and two mindful minutes. [Native Journey](screenshots/stabilization/android-journey-after-practice.png)
- **Verified.** A second native practice kept the Pause/Resume button in the same physical position during manual pause and after returning from the background. The foreground return explained why the clock was paused. [Background pause](screenshots/stabilization/android-breath-background.png)
- **Verified.** Ending the second practice and leaving feedback unsaved kept Journey at one Moment and two minutes. Android hardware Back restored Explore's two Sleep results. Today retained its selected Calm mood and five pastel petals in Light and Dark. The disposable account signed out successfully.
- **Verified.** Dark onboarding retained complete serif descenders at the existing text scale and at 1.3×. The account action scrolled clear of the Android system bar with Reduce Motion enabled. This is a focused onboarding check. [Large text capture](screenshots/stabilization/android-onboarding-large-reduced-motion.png)
- **Verified.** Android requested notification permission for the isolated package. A test reminder was posted while the app was backgrounded. ADB checked the notification by the QA package ID. Foreground, normal-closed recurring delivery and tap routing are separate checks. [Permission prompt](screenshots/stabilization/android-notification-permission.png)
- **Blocked.** The Xiaomi shade did not yield a usable UIAutomator tree. Automatic approval review declined whole-shade screenshot/OCR because it could reveal unrelated notifications. Package-scoped evidence establishes posting. The manual tap step is listed below.

### Remaining manual gates

1. **iOS blocked on this Windows session.** Open the Personal Team development build on a Mac with a paired iPhone. Rebuild with the current Expo native dependencies and the existing signing configuration. With a disposable account, repeat signup, multiline input and scrolling, inspect VoiceOver and larger text, test Reduce Motion/Reduce Transparency, and check that the last action clears the unchanged Liquid Glass rail on each tab and detail.
2. **Live provider and public release blocked by deferred setup.** Configure the key only in `server/.env`. Verify live chat, generated Moments, weekly drafts and real transcription. Deploy the configured API over publicly reachable HTTPS with persistent storage. Rebuild and install the release APK, disable Metro, and repeat the complete two-account sequence against that HTTPS API before recording the submission demo.
3. **Native voice and audio.** On the live-provider build, deny the mic, then allow it. Record, stop, review a long transcript and send explicitly. Cancel and retry a failed upload. Repeat with permission revoked, while backgrounding, during an audio interruption and while switching audio routes. Check TTS stop/mute and ambient handoff.
4. **Native reminders.** In the QA app, send a test and tap the Solace alert in the phone's shade. Expect the Check-in screen. On each target OS, save a recurring reminder for a near future time, save it again, edit it, disable it, and confirm only the current enabled schedule can deliver. Repeat in foreground, background and after normal close, and cross a timezone change. Verify permission denial and recovery. Remote push is a separate provisioning and delivery test.
5. **Further device coverage.** Recheck the remaining nested Explore, account/photo picker and assessment routes at smaller and larger native sizes. Test photo cancellation, denial and upload failure with a disposable image. Repeat cross-tab and immersive tests with larger text and Reduce Motion. Gather release frame and memory traces during navigation, chat scrolling and voice transitions.

## Historical verification

Date: 5 November 2026. Record actual results here; never turn an unexecuted release checklist into a pass.

## Automated checks executed
- Mobile TypeScript: passed after integration and dependency alignment.
- Expo SDK compatibility: dependencies are up to date.
- Wellness regressions: **7/7 passed**. Tests cover local-calendar dates, duplicate check-ins, streak boundaries, partial completion, XP, reflection totals and stable daily affirmations.
- Reminder coordination regressions: **6/6 passed**, executing the current scheduling module with mocked native APIs. Logout cancels a late schedule; cleanup from an old restore preserves a newer account's schedules. These do not establish OS notification delivery.
- Backend integration: **22/22 passed** (latest toolkit/artwork pass). Tests cover password/token handling, login/logout, isolation, input validation, durable persistence/reopen, failed-disk rollback, consent, history, source-memory deletion, account export/deletion, chat bounds, concurrent deletion, provider adapter with stub, explicit CORS and bounded reverse-proxy configuration.
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


## 5 November premium UI and reliability pass

Executed with the project's scripts and supported **Node 24.22.1**:
- Client TypeScript: passed after final UI changes.
- Server TypeScript and production build: passed.
- Wellness regressions: 7/7 passed; reminder coordination regressions: 2/2 passed.
- Server integration: 18/18 passed, including account isolation, updated history ordering, preservation of action/provider/support/safety metadata, urgent-support reopen behavior, and recoverable provider failures with no partial turns. Initial sandbox run could not connect to temporary localhost ports (EACCES); rerun outside the sandbox passed. Mocked provider evidence is not a real-provider test.
- Expo web and Android JavaScript/Hermes exports: passed after final UI changes. These update dist/, not the existing APK.
- One Impeccable detector pass over App, shared UI/theme and three screen modules returned no findings. Later fixes added explicit web selection semantics and bounded hero copy width.

Browser checks on the shared React Native source, using synthetic local QA accounts:
1. Reviewed Today light/dark, login, welcome, Profile, Journey, chat and breathing at an effective 390×845 CSS phone viewport; reviewed the centered mobile column at 1281×900 desktop with no document horizontal overflow.
2. Confirmed no upper-right profile shortcut on account entry or Today; four bottom tabs remain in the required order.
3. Created a fresh synthetic Mira account; checked password visibility; saved a Calm mood with a note; signed out; entered an incorrect password and saw a recoverable error with fields retained; corrected it and signed in. Reload restored account, saved check-in and dark theme.
4. Typed a chat draft, switched to Journey and back, and confirmed the draft survived. Sent it; saw an explicitly labeled built-in response and working activity action.
5. Ran the suggested 60-second activity to automatic completion; saved Helped feedback; returned to the same conversation with retained messages.
6. Verified the web DOM announces Calm as aria-checked=true and the active tab as aria-selected=true. Native screen-reader behavior remains pending.
7. No browser error-level console entries were recorded at the end of the final pass.

These are bounded representative checks, not exhaustive interaction or accessibility certification. Native reminder scheduling changes, all reminder edit/permission scenarios, background delivery and tap routing remain device checks. Source review additionally covers auth-success/data-load retry, confirmed-deletion reconciliation, account-generation draft guards, resource progress clearing and reminder schedule coordination; those client recovery edges were not separately fault-injected in the browser.

ADB returned an empty attached-device list. No physical-device, installed APK, iOS, native large-text or native performance verification was possible. No new APK was built; outputs/solace-build-validation.apk remains the old compilation-only artifact. Live provider, public HTTPS deployment and final demo remain pending.

Visual evidence: docs/screenshots/polish-*.png. polish-comparison.png places light/dark viewport crops side by side; raw browser captures are preserved, and no UI elements were changed in the screenshot composition. New artwork and exact built-in generation prompts are recorded in assets/ARTWORK.md.

Tooling note: the design context loader reports that PRODUCT.md lacks its optional Platform metadata, although AGENTS.md and the implementation explicitly establish React Native/Expo. Aligning that metadata to adaptive is available as a separate housekeeping change; it was not silently repaired during UI work.

Final formatting check passed across app/server sources; git diff --check reported no whitespace errors. The final server-only formatting pass changed whitespace, with no behavior changes after the successful integration run.

## Follow-up: true-black mode and continuity

The user's black-mode correction overrides the earlier forest-dark target. No new raster assets were generated; the dark featured activity now uses the existing transparent petal on charcoal and supporting leaves are softly tinted champagne.

Executed checks on Node 24.22.1:
- Client TypeScript and project formatting: passed after the final changes.
- Wellness: 7/7 passed.
- Session/provider-state harness: 8/8 passed via `npm run test:session-state`. The harness executes the real AppProvider implementation with controlled React/storage/network mocks. Cases cover same-account expiry resumption, different-account draft clearing, late 401 responses, auth/data-load recovery, stale snapshots, credential-write/logout ordering, conditional draft clearing, stale API/navigation callbacks, and originating tab navigation.
- Native reminder coordination with deterministic mocks: 6/6 passed, including late manual/test schedules and stale notification navigation. These do not prove OS delivery.
- Server integration: 20/20 passed, including cross-account privacy, rename during a pending provider reply, metadata persistence, explicit reflection intent and urgent-support priority. Server typecheck and production build passed. Ephemeral localhost tests ran outside the sandbox after socket restrictions blocked the initial attempt.
- Final web export and Android/Hermes export passed. The green-backed artwork is no longer bundled in dark mode. These are JavaScript exports, not a new installable APK.
- One Impeccable detector pass over the final changed UI returned no findings.
- Dark token contrast measurements: ivory body / black 18.51:1; secondary text / charcoal 8.75:1 and / raised charcoal 7.80:1; button text / ivory 13.58:1. These token measurements do not certify every screen or artwork combination.

Browser evidence from synthetic QA accounts:
- At effective 390×845 CSS size, the rendered main backgrounds were measured as RGB(0,0,0), RGB(17,17,18) and RGB(29,29,31), with no green-tinted dark surfaces. Mood-specific color remains intentional.
- Searched a conversation's message using uppercase WALK, renamed it to Evening reflections, and confirmed message-text search still found it after renaming. A missing query showed 0 matches with working clear-search controls.
- Journal text survived Keep draft and leave, reopening, and a Today → Journey tab round trip. Saving produced an actual private reflection and Journey XP increased from actual saved activity. Detail screens correctly retain their originating tab.
- After refreshing the identified local Solace API process with the tested code, the exact starter “I'd like to reflect on my day” returned a reflection action, labeled as built-in guidance with live AI off.

Check-in and feedback draft protection, expiry UI hiding, guarded discard and pending controls are additionally source-reviewed; session race behavior is covered by the provider-state harness. Full expiry fault injection and all native keyboard/permission/background scenarios were not browser/device tested. Drafts are private in-memory state and do not survive app/process restart.

Public HTTPS hosting, real-provider evaluation, a rebuilt functional APK, physical-device notification verification and the final demo remain release gates. The old compilation-check APK was not rebuilt or relabeled in this pass.

Final confirmation: reload retained black mode, saved account data and the renamed conversation. The Today resume card reopened the latest retained conversation with its reflection action intact. The 1281×900 CSS wide preview had no document horizontal overflow. No browser error-level entries were recorded in the final check. Screenshots are preserved in docs/screenshots/black-mode-*.png; black-mode-preview.png contains viewport crops of the raw home/history captures with no altered UI. The local API was restarted with the tested source after verifying its exact Solace process identity; persistent account data remained intact.

Total current regressions: **41 passed** (20 server, 8 session/navigation state, 7 wellness, 6 reminder coordination). No new installable APK or external deployment was produced.

## Dark artwork, saved toolkit and weekly review pass

Current executed regression total: **53 passed** = 22 server integration + 9 session/provider-state + 9 weekly review + 7 wellness + 6 native-reminder coordination mocks. The previous 41-test total above is historical. All runs use Node 24.22.1 through project scripts or the configured runtime.

### Automated evidence
- Client/server TypeScript and server production build passed. Project formatting and git whitespace checks passed.
- Toolkit tests cover known-target validation, identity immutability, repeated/concurrent save deduplication, account-isolated list/update/delete, independent same-target favorites across accounts, persistence/reopen, export and account deletion. Grounding session shapes round-trip through the API.
- Session-state harness covers idempotent favorite responses without client duplicates and clearing data on account changes, alongside existing session/draft/navigation races.
- Weekly helper 9/9 covers empty/small data, local-calendar windows, duplicate IDs versus repeat entries, tied/unknown moods, completed/self-reported feedback, future/invalid records, midnight/timezone and DST boundaries. It produces no emotional-worth or clinical score.
- Final Expo web and Android/Hermes exports passed. These are source/bundle checks, not a rebuilt installed APK.
- One final UI detector pass returned no findings. Subsequent layout-only changes kept light-mode botanical art away from text.
- Generated petal alpha verified RGBA with range 0–255 at 1254×1254; stillness and night are 1536×1024 RGB. Originals and original reference archive are retained; exact built-in generation prompts and paths are in assets/DARK_ARTWORK.md.

### Browser journeys actually checked
Using the synthetic local Mira account, with the restarted current API and built-in companion mode:
1. Reviewed black Today, toolkit empty state, grounding intro/steps/feedback, resources, sleep guide, Profile, appearance and weekly Journey at effective 390×845 CSS phone width. Reviewed the centered mobile column at 1281 CSS pixels wide with no horizontal document overflow.
2. Saved grounding to toolkit, completed the practice with one sense skipped, selected Helped and saved feedback. Journey showed one completed moment and weekly review showed one supportive completed moment. The optional memory label explicitly named grounding and was left unchecked.
3. Followed Reflect on your week. The factual suggested prompt appeared separately; the writing field stayed empty rather than being overwritten.
4. Saved Sleep wind-down to toolkit, reloaded the app, and saw both favorites retained. Reopened saved grounding. Removed the sleep bookmark through toolkit and saw it disappear. One saved grounding practice remains in the QA account.
5. Ran a second grounding practice with all five senses skipped and saved without feedback. Journey's completed count remained 1, weekly supportive count remained 1, and participation XP remained 40. The incomplete session stayed visible as an actual recent record.
6. Switched to Light and inspected supporting navigation and the new grounding feature; softened/offset its botanical art for readable text. Restored Dark. Appearance radios announce their actual checked state.
7. Final browser console error list was empty. Screenshots are in docs/screenshots/premium-*.png. The contact sheet crops renderer padding only and does not alter UI.

The five-senses sequence was checked against the NHS Hull University Teaching Hospitals reference linked in REQUIREMENTS.md. Optional alternatives/skips and app copy are original; the exercise makes no treatment promise.

### Optimization evidence and limits
Search indexes/derived review selectors are memoized by records, history mounts 30 rows initially with explicit show-more, breathing retains precise ref-based timing while displaying integer seconds, and chat only autoscrolls near the bottom or on send. Off-bottom changes expose Latest messages. Artwork is bundled and uses target-size native resize hints. These are source-reviewed changes, not measured native FPS, startup-time, network or memory results. Large-history pagination is not implemented; the API still returns a full account snapshot. The chat reader-position branch and large-history show-more have not been exhaustively browser/device stress-tested.

Grounding native Back confirmation, permission behavior, background/foreground timing and final notification delivery remain device checks. No physical-device, native performance or live-provider evaluation was performed. Public HTTPS hosting, real AI configuration, final functional APK and demo remain release gates. The existing compilation-only APK has not been rebuilt or relabeled.

## Daily pause, Explore, platform navigation and private photos

Latest executed regression total: **88 passed** on Node 24.22.1 = 28 server integration + 20 session/provider-state + 10 daily-routine + 8 protected-vault + 9 weekly-review + 7 wellness + 6 reminder-coordination tests. Earlier totals above are historical.

### Automated checks
- Client/server TypeScript and server production build passed. Final project formatting and `git diff --check` passed. Server formatting after tests changed whitespace only.
- Web, Android/Hermes and iOS/Hermes exports passed. New `npm run export:ios`, `test:routine` and `test:offline` scripts use the supported runtime. These exports are not native installations or proof of OS material rendering.
- Server photo tests cover real JPEG decoding, dimensions/input limits, EXIF/GPS removal, safe legacy database migration, route-specific JSON limits, owner-scoped state/export/removal/deletion, persistence rollback and late uploads racing logout/expiry/replacement/deletion. The client prepares a 256px JPEG; the server independently normalizes it again.
- Routine tests cover empty accounts, directly supplied current-day moods, global historical-personalization consent, approved/dated preferences, helpful completed sessions, negated preference text, actual completion, resource completion, deterministic selection and input immutability. A journal practice can satisfy reflection from one real saved entry; an incomplete practice does not count.
- Vault tests use deterministic storage mocks to cover Unicode chunk size, account partitions, interrupted commits, shorter writes, complete/retryable erasure despite damaged payloads, serialized draft/queue changes, bounded storage/queues, exclusion of chat/snapshots and web memory-only lifetime. These do not verify the actual iOS Keychain or Android Keystore.
- Provider harness executes real AppProvider logic with controlled React/storage/network. New cases cover queued saves, validation exclusion, exact owned-record reconciliation after a lost response, stable retry identity when device persistence fails, native restore/background protection, stale-account sync, expiry/sync recovery, retryable logout erasure/token failures and account-deletion cleanup semantics. Existing session/navigation/privacy regressions remain green.
- Semantic text/surface contrast: light lilac 6.96:1, peach 5.87:1, sage 6.44:1; dark lilac 10.52:1, peach 9.48:1, sage 10.05:1. Primary button text is 8.64:1 light and 10.34:1 dark. These token checks are not accessibility certification.

### Browser journeys actually checked
Using the synthetic local Mira account and the restarted current API, in explicitly labeled built-in companion mode:
1. Reviewed Today, Explore, Journey, Profile and account/photo controls. Today contains one daily-pause card and conversation continuation. Explore holds practices and guidance. Journey's optional activity milestones expand to actual stored participation (50 XP after the new real reflection).
2. The five navigation controls announced their labels and selected states. At effective 390×845 CSS size, each measured about 70×60 CSS pixels. The chat composer bottom measured 711px and the navigation began at 769px, leaving the composer clear. Native keyboard behavior is not proven by this browser check.
3. Selected generated dark-petal.png through the real file chooser. The client processed the PNG into JPEG, the API saved it, and account/Profile showed the image. Reloaded and saw the photo retained. Removed it through Remove photo and saw Add profile photo and the explicit removal notice return. No personal photo was uploaded.
4. Stopped the local API, wrote a synthetic reflection and saved. The screen explicitly said the entry was kept in the browser tab and waiting to sync, with a keep-tab-open warning. Your account showed the queued entry and retry/discard controls. Restarted the API; the automatic retry removed the queue panel and Journey increased from one reflection to two. The recovered text appeared once in the reflections list. The manual retry button was not separately exercised here because automatic retry completed before the click.
5. Reviewed Light and Dark semantic colors, then restored Dark. Checked effective 358px, 390px and 1281px widths with no document horizontal overflow. The attempted smaller browser viewport was clamped to 358px; no 320px browser claim is made.
6. Final captured browser error-level log list was empty. Restored the normal browser viewport and left the local Today preview available.

Evidence is in `docs/screenshots/calm-*.png`. `calm-ui-preview.png` places three actual phone viewport crops side by side; only the browser renderer's extra white padding is removed. No UI content was retouched. The Profile image in this historical capture is the synthetic test photo; it was removed after the persistence test.

### Native and release boundaries
- iOS uses a custom rail backed by real Expo GlassView after **both** availability checks, native blur on older supported iOS, and an opaque Reduce Transparency fallback. This is not a migration to UIKit native tab navigation. The existing custom stack has detail Back buttons and Android hardware-Back handling; native iOS edge-swipe navigation is not implemented, and Android predictive-Back integration remains follow-up work. Material rendering, VoiceOver, Reduce Transparency, large text, safe areas and gestures still require iOS hardware/simulator verification. Windows cannot provide that evidence here. Implementation references: [Expo GlassView](https://docs.expo.dev/versions/latest/sdk/glass-effect/) and [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials).
- Android has an opaque tonal rail, a selected icon indicator, native ripple and explicit resize keyboard configuration. ADB returned an empty attached-device list after a sandbox daemon restriction was resolved outside the sandbox. No installed-device capture, gesture, photo picker, permission, reminder-delivery or performance test was possible. A fresh native build is required for the added libraries.
- Native draft writes debounce 650ms and attempt protection on inactive/background. A force-kill before a successful commit can lose the latest draft edits. At most 10 submitted entries and about 96KB of allowed writing are kept in account-scoped SecureStore chunks. Chat/feedback drafts remain in memory, and full account snapshots are excluded. Web writing is memory-only and disappears on reload/close if not synced.
- Cold launch still requires successful API session restoration before opening the protected vault; a complete offline account cache is not implemented. Expired cold-token account partitions remain encrypted and inaccessible to another signed-in account; actual device lifecycle/cleanup still needs testing.
- Account deletion erases local protected writing before calling the online deletion endpoint. Explicit deletion confirmation covers local writing too; a later network failure cannot restore discarded local writing. An online deletion that committed is not misreported as failed if credential cleanup subsequently needs retry.
- Dependency audit: server install reported zero known vulnerabilities; the root Expo toolchain audit reported five moderate findings through CLI/fingerprint glob/minimatch dependencies. npm offered an Expo SDK downgrade as its automatic fix. No forced SDK downgrade or unverified cross-major override was applied. Review the upstream-compatible patch before release: [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). This audit does not establish exploitability in the mobile bundle.

Public HTTPS hosting, real-provider configuration/evaluation, a rebuilt functional installable APK tested on a physical phone, verified native reminders and the final demo remain release gates. The old compilation-only APK was not rebuilt or relabeled. Local feature/UI completion is separate from production submission readiness.

## Illustrated Today and dark-mode parity refinement

The user requested a more inviting home and daily pause, while keeping the beautiful light identity and improving dark mode. This is a visual/navigation refinement; the routine selector, server ownership, data/consent logic and storage contracts were retained.

### Executed automated checks
- **88 tests passed again** on configured Node 24.22.1: 28 server integration, 20 session/provider-state, 10 routine, 8 protected-vault, 9 weekly review, 7 wellness, 6 reminder mocks. Server tests bound isolated loopback servers through approved escalation. Client/server TypeScript, server build and project formatting passed.
- Final web, Android/Hermes and iOS/Hermes exports passed after the contrast adjustment. Outputs are in dist/web, dist/android and dist/ios. Exports do not prove native rendering or installation.
- Dark token contrasts: body on graphite 15.96:1; secondary on raised 7.57:1; primary button 9.84:1; lilac 10.39:1, peach 9.91:1 and sage 9.99:1 semantic pairs. Light raised secondary text was strengthened from #697164 to #626B5D, measuring 4.54:1 on #EEE8D6; warm canvas/forest identity was retained. Hero caption over a conservative white image behind an 80%-graphite scrim measures 5.79:1. This conservative calculation and token measurements do not certify every pixel or native accessibility behavior.
- Shared decorative icons are excluded from accessibility focus. Native and explicit web progress ranges use real recorded steps; final browser DOM reported role `progressbar`, `min=0`, `max=3`, `value=3` and “3 of 3 steps recorded today.”

### Browser evidence actually observed
Using synthetic local QA accounts, with live AI off:
1. Reviewed dark/light Today and Explore at effective 390×845 CSS phone size, supporting dark check-in/feedback/journal/account/settings material changes, plus 358 px and 1281 px widths without document horizontal overflow. The approved warm light palette remains; black mode now uses graphite surfaces, champagne actions and a matching softly lit botanical illustration instead of a large flat purple pause panel.
2. A fresh Rowan account opened with no fabricated progress. Selecting Stressed opened the correct selected mood. Saved the check-in through the UI; Today offered grounding and the Why this pause? control explained the directly supplied current-day mood. No historical personalization consent was enabled.
3. Followed the actual grounding route, continued one sense and skipped four, then saved without positive feedback or memory consent. Today advanced to its reflection step. This verifies actual saved participation, not sensory efficacy or a clinical outcome.
4. Opened the reflection CTA; its guided prompt remained separate from the writing field. Saved a synthetic QA reflection. Today then showed the completed-day state from the real account records.
5. The completed-day Take a moment action opened the breathing screen with 3 min selected and 0:00 / 3:00. Returned using Back before starting, without creating an extra completed session.
6. The new editorial daily thought opened Today’s affirmation with the same curated text and an actual Save affirmation control. It does not claim AI generation or automatic saving.
7. One initial inspection and one confirmation round were used. The fix batch strengthened the art readability scrim, shortened the crowded pause CTA, made grounding’s small marker explicit, and added web progress semantics. Final light and dark screenshots show the matched composition, current-step path and single clear action. At 390×845, the light completed-state CTA ended around 641 px while navigation began around 769 px.
8. Final browser error-level log list was empty. Restored Dark, reset the temporary viewport override and left Today available as the preview.

Screenshots: `docs/screenshots/bloom-today-light.png`, `bloom-today-dark.png`, `bloom-explore-dark.png`, `bloom-today-wide-dark.png`. `bloom-home-preview.png` puts the actual 390×845 viewport crops side by side, removing only browser-renderer padding. New art is 1536×1024 RGB; full built-in prompt and asset provenance are in `assets/DAILY_PAUSE_ARTWORK.md`. Original images and the reference archive remain intact.

### Native and release limits
No new native dependency was needed for this pass. The installed RN 0.88 supports the gradient style used for readability ([official React Native view styles](https://reactnative.dev/docs/view-style-props#backgroundimage)); source/bundle checks are separate from OS rendering proof. Native gradient/image decoding, Dynamic Type, VoiceOver/TalkBack, system-material appearance, keyboard/safe-area behavior and performance still require device inspection. No new native device evidence, installable APK, public deployment, live-provider evaluation or demo was produced. Prior reminder, native-navigation, protected-writing lifecycle, dependency-advisory and release gaps above remain in force.


## Backend bootstrap and authentication repair — 5 November 2026

The user deferred access to the Mac/iPhone simulator and asked to continue authentication repair before configuring real AI. This section records local Windows evidence only; it does not close those deferred acceptance gates. Advanced features and navigation migration were not started during this repair.

### Diagnosis and implementation

The reported missing server/node_modules/tsx/dist/cli.mjs belongs to the separate server package. Root-only installation does not install it, and production-only server installation omits it. The exact prior Mac installation command is unknown. The previous launcher assumed a hardcoded tsx CLI path and did not explain how to restore the separate install. The repaired launcher resolves the installed loader and gives explicit recovery instructions when dependencies are absent.

`npm run setup` installs both lockfiles, explicitly including development and optional platform packages, using the selected supported Node executable, then compiles the API. It creates only missing environment files. `doctor` checks dependency availability and loads Sharp/esbuild platform binaries without printing environment contents. The validated local baseline is Node 24.22.1; installed Expo/RN engines also accept Node 26, so the missing file does not establish a Node 26 incompatibility.

The dev supervisor waits for its own API child's ready IPC and an actual healthy Solace response before launching Expo. It rejects a non-default server port with blank public client configuration. Private provider/database settings are not forwarded to Metro. Server paths are anchored to server/ regardless of the caller's working directory. Configuration errors fail clearly. Production start uses compiled JavaScript.

Review found a busy-port startup race: opening SQL.js before a failed listen could rewrite a database used by the existing API. The API now reserves its port before database access, returns HTTP 503 during initialization, attaches the application after success, and releases the port on initialization failure. Ready IPC follows successful initialization.

### Checks actually executed after a clean install

- `npm run setup` succeeded: 499 app packages and 129 server packages installed from the existing lockfiles, then the server production build passed. It created the previously missing root/server .env files from their blank examples. Existing database accounts were retained. No provider credential was configured.
- `npm run doctor` passed on Node 24.22.1, including actual Sharp/esbuild native-binary loads. Client/server TypeScript, server build and project formatting passed.
- **125 regressions passed:** 34 server integration/process, 18 tooling, 10 API configuration, 23 provider/session-state, 10 routine, 8 protected-vault, 9 weekly-review, 7 wellness and 6 reminder-coordination tests. Earlier totals in this document are historical.
- Server process tests launch the compiled API repeatedly against isolated temporary databases. They verify signup/login/session persistence, logout revocation after restart, account isolation, and conversation history continuing from two to four stored messages across three actual API starts. Other startup tests verify missing-key/invalid-port failure, busy-port byte/mtime preservation, invalid database sentinels remaining unopened on a busy port, HTTP 503/no-ready during held initialization, and listener release after failed database initialization.
- Tooling tests include a real source API launched through the tsx loader, actual signup/authenticated state/logout and listener shutdown. Expo is a stub in that fixture. Readiness, failed health, missing dependency, environment boundaries, custom-port mismatch and process/signal handling also have regressions. POSIX process-group and outer-wrapper forwarding branches use controlled fixtures; they do not establish actual macOS OS-process cleanup.
- API configuration tests cover platform defaults, URL normalization, IPv6, malformed/credential-bearing URLs, HTTPS release requirements, loopback rejection, safe diagnostics and the installed Expo URL implementation. Provider tests confirm configuration errors do not fetch or enter the offline queue, and connection errors retain writing/recovery semantics.
- `npm run export:web:preview`, `export:android` and `export:ios` passed. The native outputs are Hermes JavaScript bundles, not newly installed native applications. The native release bundles have no deployed API configured and must not be distributed as functional releases. The local static preview explicitly uses development mode.
- Loopback/process-tree checks were run with approved local permissions after the sandbox denied those operations. A sandboxed tooling attempt failed health/cleanup and was cleaned up; its later approved-permission run and the post-install rerun passed. No failed attempt is counted as successful verification.

### Browser authentication actually verified

Against the actual `npm run dev -- --localhost --port 8081` stack:

1. Reloaded the existing synthetic Rowan account and confirmed its session/private data survived the repaired server launch and clean dependency install.
2. Logged out through Your account; Welcome returned. Created a fresh synthetic Avery QA account through the normal signup screen. It reached Today with zero daily-pause progress and no fabricated records.
3. Sent a synthetic test message through the chat composer. An actual persisted built-in companion exchange returned, explicitly labeled “Built-in companion · Live AI is off.” This is not a real-provider test.
4. Stopped the owned development stack; netstat showed no listeners on ports 3001/8081. Restarted the complete API/Expo stack, reloaded the client, and reopened the saved conversation from history. Its two messages remained. Continued it and received a second stored exchange using its earlier context.
5. Logged out again. Submitted an incorrect password and saw “Email or password is incorrect” with the fields preserved. Replaced the password with the synthetic account's correct password and logged in. Today showed Avery and the existing conversation continuation.
6. Captured the actual final signed-in page in docs/screenshots/auth-repair-today.png. The capture includes browser-renderer padding and has not been retouched. The final captured browser error-level log list was empty. Left the local preview running on port 8081.

This proves local browser signup/login/logout, browser session restoration and conversation persistence through a real API restart. It does not prove iOS SecureStore, native app force-quit/relaunch, fresh installation, simulator transport settings or physical-device networking.

### Remaining gates

Mac/iPhone simulator signup and native restart are deferred by the user. Real-provider credentials and a successful real AI response are also deferred while authentication repair is prioritized. Use docs/LOCAL_DEVELOPMENT.md for the Mac handoff and exact acceptance steps. Live-provider adapter stubs and built-in responses are not substitutes for that evidence.

Public HTTPS hosting, final installable APK tested on a physical device, native permissions/reminder delivery/tap behavior, iOS build verification, device performance and the final demo remain release work. No new Docker setup or branch was introduced. Existing root install audit still reports five moderate toolchain findings; the server install reports zero. No forced Expo downgrade was applied. The older compilation-check APK remains unchanged.


## Connected feature implementation — 6 November 2026

The user explicitly requested implementation without questions and deferred provider, hosting and device setup. Feature development proceeded on the repaired local foundation. This checkpoint implements the master feature flows; it does not mark deferred external acceptance as passed.

### Implementation and files

- Four tabs in workspace order: Today, Solace, Journey, Profile. App.tsx, Navigation.tsx and store.tsx preserve the existing account/session lifecycle. Today and chat reach Moments; the practice library retains all previous tools and now has an explicit Back action.
- Moments.tsx, moments.ts and the pure server moment-contract.ts connect a feeling to a bounded activity preview, accurate provider/memory explanation, timed player, background pause, environment selection, exit guard, feedback and retry-safe persisted completion. Chat carries its latest message and owned conversation ID through the activity and back to the conversation.
- Companion.tsx and Environment.tsx provide the six interaction states, reduced motion and forest/ocean/twilight scenes. Original optional WAV ambience is documented in assets/AMBIENT_AUDIO.md. Asset-backed views and code geometry extend the existing botanical identity.
- Journey.tsx/progress.ts add month/day history, actual completed minutes/helpfulness, factual weekly reflections, editable/pauseable goals, optional streaks and record-derived milestones. Profile memory controls add category, correction, source navigation, approval and explicit clear-all. No automatic memory save is claimed.
- VoiceControls/VoiceControlsImpl, AmbientSound/AmbientSoundImpl, native-features.ts and voice-session.ts provide capability-aware recording, bounded authenticated transcription, explicit transcript review, manual send, optional device TTS, cancellation and safe older-build fallbacks. Native imports are gated before evaluation. A transcript that exceeds the composer's remaining capacity stays reviewable rather than being silently truncated.
- Server moments.ts/weekly.ts/voice.ts, app.ts and validation.ts add the private feature routes and preferences/goals/generated-session persistence. Approved-memory changes reset future provider history without erasing visible chats; late stale replies are rejected. Conversation deletion cascades through direct and indirect session-derived memories, including legacy records. Source ownership and immutable provenance are enforced.
- Urgent-language routing includes explicit first-person death wishes and inability to stay safe, including typographic apostrophes. Both chat and Moments prioritize the existing human-support response without a generated activity or provider call. Ordinary tiredness, idioms and negation have regressions. This is bounded keyword routing, not clinically validated detection. Human-support priority is consistent with [NHS urgent-help guidance](https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/).

### Automated checks actually run

**193 tests passed on selected Node 24.22.1:**

| Suite | Passed | Main evidence |
|---|---:|---|
| Server integration/process | 61 | Auth/isolation/persistence, structured/provider failures, memory consent/provenance/deletion races, weekly facts, bounded voice transports, restart/startup safety |
| Development tooling | 18 | Lockfiles/runtime/readiness, private Metro environment, source API authentication and process cleanup |
| Provider/session state | 28 | Account-generation guards, raw authenticated voice, new collection creation, drafts/offline/session recovery |
| API configuration | 10 | Platform defaults, URL safety, production HTTPS and Expo URL implementation |
| Moment clock | 7 | Real active time, pause gaps, completion/phase/step bounds, safe input |
| Journey progress | 9 | Calendar boundaries, actual records, goals, completion/helpfulness and empty states |
| Voice turn lifecycle | 14 | Permission denial, failures/retry, byte/text bounds, cancellation/start/stop races and late-account protection |
| Native config/compatibility | 6 | Actual Expo plugin introspection plus controlled missing-module fallbacks |
| Routine / vault / weekly helpers | 27 | 10 routine, 8 protected-writing, 9 weekly-data regressions |
| Wellness / reminders | 13 | 7 wellness facts, 6 mocked notification coordination regressions |

Client/server TypeScript, production API compilation, formatting and final web, Android/Hermes and iOS/Hermes exports passed. Exports are JavaScript/bundle checks, not installed native builds. The production native exports lack a deployed HTTPS API and are not functional release artifacts. The old compilation-only APK remains unchanged.

Expo configuration introspection caught and verified the fix for a real cross-plugin conflict: the old photo-picker microphonePermission:false blocked Android RECORD_AUDIO. Both plugins now use the voice purpose string. The resulting configuration permits recording, leaves the unused iOS camera permission absent, and enables neither background audio recording nor playback services. Older binaries without new audio modules render honest text/quiet fallbacks; that path is tested with controlled registry fixtures, not an actual old device binary.

A relocated ambient implementation initially retained its former relative WAV paths, causing export/HMR failures. Those paths were corrected. A fresh Metro cache/reload, all three final exports and actual browser audio controls then passed. The failed attempts are not counted as successful verification. One earlier locator timed out while cold Metro was compiling alongside exports; the app loaded successfully afterward. No startup/device performance guarantee is inferred from this development run.

### Browser journeys actually observed

Using the synthetic Avery QA account against the real local API, with live AI off:

1. Reviewed the four-tab shell, Moments builder/player, Journey, memory and onboarding at effective 390×845 CSS phone width in dark/light themes. Reviewed the centered layout at 1281×900; document scrollWidth equaled viewport width. A final compact-preset adjustment left Create my Moment ending near 713px and navigation starting near 769px.
2. Generated a built-in 60-second breathing Moment from a selected feeling. The preview accurately labeled live AI off and explained the directly supplied feeling. Saved Ocean as the preferred environment; it survived reauthentication/restart.
3. Started the actual timer and optional ambience. At 0:48, paused, switched Ocean → Twilight → Forest and opened exit confirmation. Time remained 0:48 while paused; Keep going resumed it. Browser playback status changed between playing and paused. Completed the full active minute, selected Helped, added a synthetic QA note and saved the session.
4. Followed Remember what helped. Its source-linked text was only prefilled. Explicitly saved an Activities preference, corrected its wording, and enabled personalization. A later generated suggestion named that exact approved preference in its explanation. Native privacy/consent prompts were not exercised.
5. Journey showed the actual saved session, one minute and self-reported helpfulness. Created a factual recorded weekly reflection, saved a five-minute goal, paused/resumed it, and expanded the earned first-Moment milestone. Other milestones stayed unearned. Streaks were off by default.
6. Opened the microphone control with transcription unconfigured; it offered a clear text fallback and availability retry, without requesting microphone permission or inventing a transcript. Text chat remained functional. Device/browser TTS emitted a speaking event, changed the companion and Stop reading reply control, and stopped on request. This verifies browser playback state, not native hardware routing or perceived sound.
7. Logged out, reviewed the new onboarding introduction, opened signup, returned to login and reauthenticated. Session, goal, environment and approved memory persisted. Restarted the entire API/Expo stack and reloaded; account state returned.
8. Followed chat's Make a Moment action; the latest message prefilled the feeling field. Completed and saved a second actual 60-second Moment in Ocean without helpfulness feedback. Continue your conversation reopened the retained chat. Journey's goal progress reported 120 of 300 seconds / 2 of 5 minutes. The two completions straddle the local midnight boundary; daily and weekly history retained their real dates.
9. Verified final lazy audio imports with a clean bundle: read-aloud start/stop, a brief ambient practice, and leaving without saving. Brief verification practices were not recorded as completions. Final Moment progress exposed actual 0/60-second ARIA values; goal progress exposed actual 120/300-second values. The full library remained reachable with Back navigation.
10. Final post-fix browser error-level log list was empty. Restored the normal viewport and left the local Moments preview available. Screenshots are in docs/screenshots/features-*.png. Earlier raw captures contain browser-renderer padding; final phone captures use the browser's screenshot clip API without retouching UI.

### Deferred acceptance and known limits

Live AI generation/conversation/weekly reflection and real transcription require private provider configuration and actual provider evaluation. Mock transport tests and built-in activities do not prove those services. Native recording/permission denial, audio routing, app lifecycle, OS accessibility, glass materials, reminder/background/tap behavior, physical-device performance and native installable builds remain unverified. New audio/speech modules require a rebuilt native binary for those features; the guarded fallback is not native voice verification.

Public HTTPS deployment, a final APK tested on physical hardware, Mac/iOS simulator acceptance and final demo/submission remain deliberately deferred. The existing SQL.js adapter is single-instance, full account state is still loaded as a snapshot, cold offline launch still requires session restoration, and prior root toolchain audit findings remain documented above. No Docker, public social features, extra branch or real credential was introduced.

## Reliability and UI hardening — 6 November 2026

### Changes

- `server/src/app.ts`, `database.ts` and provider readers now make registration and initial session creation atomic, validate bounded provider responses, and protect conversation metadata and privacy boundaries during concurrent writes. A successful turn and its account-scoped retry receipt are written together. Within 24 hours an identical request replays the stored turn, including after API restart. Deleted conversations cannot be recreated by replaying their receipts.
- `src/store.tsx`, `notifications.ts` and voice controls reject late account mutations, protect stored credentials and writing during account transitions, deduplicate reminder taps, serialize restore/edit work, and keep interrupted drafts or voice feedback available for recovery.
- `App.tsx`, `src/ui.tsx` and the Solace, Moments, Journey, Profile and Wellness screens simplify first-use actions, keep scrollable controls above the floating tabs, expose a direct support action for urgent chat replies, invalidate stale activity previews, preserve paused practice time, and clarify reminder editing and confirmation.
- `scripts/preview.mjs` serves packaged WAV assets with their media type and byte ranges and returns an actual 404 for missing files. Animated scenes use the web driver in the preview and the native driver on mobile.

### Checks executed

**205 tests passed on Node 24.22.1.** Server integration and process tests passed 64/64. Tooling passed 18/18, API configuration 10/10, session state 33/33, wellness 7/7, insights 9/9, routine 10/10, offline writing 8/8, voice 15/15, Journey progress 10/10, Moments 7/7, native configuration 6/6, and reminders 8/8.

Client and server TypeScript, the server pretest compilation, Prettier, and `git diff --check` passed. Expo exported the development web preview and Android and iOS Hermes bundles. Metro fell back to a full file crawl after an incompatible local cache read and completed the affected exports. The UI source detector returned zero findings for its scanned files. The packaged preview passed HTTP checks for the root page, WAV HEAD and partial byte responses, an unsatisfiable range and a missing asset.

### Browser checks executed

Used a synthetic account and separate SQLite file on a loopback API configured for built-in replies.

1. Completed onboarding and signup. Reloaded after an API and Expo restart and restored the signed-in account and conversation. Logged out through Privacy & data, logged back in, and reopened the saved Journey.
2. Viewed the light Solace screen and dark Journey at 390 × 845 CSS pixels. The document measured 390 pixels wide with no horizontal overflow. A starter filled the composer and the other starter disappeared. Sent a message, reopened it from history, and followed the direct human-support action for synthetic distress text.
3. Stopped the local API before sending a draft. The composer preserved the full text and offered Retry. After restarting the API, retry added one visible copy of the message and cleared the composer.
4. Moved to the previous Journey month and returned to today. Saved a Calm check-in and saw it in the calendar. Chose and saved Ocean Calm, generated a built-in activity and verified that editing the feeling removed the old preview.
5. Started a breathing Moment and paused at 17 seconds. Opened and canceled exit, confirmed the timer stayed at 17 seconds, then resumed and enabled ambience. The browser reported playback. Completed the active minute, saved it with Helped feedback, and saw both real test entries in Journey after reauthentication.
6. Entered a reminder at 0830, saw the saved 08:30 preference, canceled an edit, and verified the delete confirmation with Keep reminder. The browser showed Preferences only and disabled the native delivery test. The final observed browser error log list was empty.

Phone screenshots from the browser are [Solace in light appearance](screenshots/polish-chat-light.png) and [Journey in dark appearance](screenshots/polish-journey-dark.png). The loopback preview on port 8083 uses synthetic data.

### Deferred release acceptance

Live provider calls, public HTTPS deployment, installed Android and iOS verification, native microphone/audio behavior, reminder delivery and taps, and the final demo remain deferred at the user's direction. Expo exports verify bundling. The existing single-instance database and cold-start connectivity limits still apply.

## Explore access correction — 6 November 2026

- The browser preview previously required opening Moments before reaching the practice library. The bottom bar now has a labeled Explore action between Solace and Journey. The four main tabs keep their accessible tab roles and their existing order.
- Opened all ten Explore destinations in the preview. Moments, reflection, toolkit, resources, reflective check-ins, plan, affirmation, and challenge each opened their named screen. Breathing opened with three minutes selected, and grounding opened its five-senses intro. These checks exercised navigation into each feature.
- Verified that returning to Explore from a library detail restores the library, and that Back from the library returns to Today. The session-state regression also covers an origin on the Solace history screen, repeated Explore selection, and switching to a main tab.
- The light preview measured 390, 358 and 851 CSS pixels without horizontal overflow. The Explore target measured 64 pixels wide in the narrow view. The final browser error log was empty. The final screen is captured in [Explore on a phone](screenshots/explore-restored-phone.png).
- TypeScript, formatting, 34 session-state tests, seven wellness tests and 64 server integration tests passed. Expo exports passed for web, Android and iOS. Installed-device navigation and assistive technology remain separate.

## Today, Solace chat, and Voice Talk — 6 November 2026

Compared the two supplied references with the app at 390 × 845 CSS pixels. Checked the light and dark Today and chat layouts, with an additional 480-pixel check and no horizontal overflow in the measured views.

- Today showed the watercolor mood images, the selected label, and the daily pause progress. Tapping Okay opened the check-in with Okay selected. The home conversation continuation and quote were absent.
- Chat showed both contextual quick replies, the illustrated reset, the paper plane, and the microphone beside it. The talk action focused an empty composer without sending, and both reset actions opened the timer with one minute selected. Verified the built-in label in the transcript and the human support action for synthetic urgent text.
- The inline mic and Voice Talk showed the unconfigured transcription state. Sent a typed test message in Voice Talk, observed the reply start reading, and verified the turn in regular chat and conversation history after returning. The browser log contained zero errors at the end of the run.
- Web, Android, and iOS exports, client type checking, formatting, 64 server integration tests, 34 session-state tests, 15 voice lifecycle tests, six native configuration tests, ten routine tests, and seven wellness tests passed.

The preview used the built-in companion and browser speech. Live transcription, live agent replies, and installed-device microphone and audio behavior remain pending. The provider key belongs in the private server configuration.

See the [Today capture](screenshots/reference-today-phone.png), [Solace capture](screenshots/reference-chat-phone.png), and [Voice Talk capture](screenshots/reference-voice-phone.png).

## Scenic Today, Solace, and Explore redesign — 6 November 2026

Compared the three supplied designs with the Expo browser preview in light and dark appearance at 390 × 845 CSS pixels. The screenshots use real app data, generated artwork, and rendered controls. The final browser error log was empty.

- Today showed the account's recorded mood and counts. Okay opened the selected mood check-in. Reminders and the alternate daily pause opened their working routes. Start Moment opened the five-minute Calm Reset.
- Explore filtered to Gentle Movement, which opened a three-minute session. Search found and opened Sleep Wind Down. Calm Your Mind opened at five minutes. Reflect with ten minutes opened the correct guided player. The practice plan preview showed the three selected timed steps, and expanded wellness tools exposed guides, affirmation, and challenge.
- Solace sent a test message and displayed an actual built-in reply with timestamps. The composer menu exposed reply playback, and Voice Talk showed the unconfigured transcription state. Guided Breath opened with two minutes selected, ran to completion, and saved. Journey displayed the new completed session and updated totals, and Today displayed the updated weekly Moment count.
- TypeScript, formatting, the web, Android, and iOS exports, and 156 targeted and server integration tests passed. The Moment contract test covers all five authored focus choices with all three durations.

[Today](screenshots/scenic-today-phone.png), [Solace](screenshots/scenic-chat-phone.png), [Explore](screenshots/scenic-explore-phone.png), and [all three dark screens](screenshots/scenic-dark-phone.png) show the browser preview. Installed device rendering, native reminders, and live voice provider behavior remain pending.

## Physical Android smoke test — 6 November 2026

Built and installed the ARM64 Android debug APK on an Android 15 phone over USB. Used the local Metro server and an isolated SQLite API with the built-in companion. No production credentials or account data were used.

- Completed onboarding and signup from a fresh installation. Saved a Calm check-in from Today and confirmed the account and saved mood were restored after stopping and reopening the app.
- Sent synthetic messages, observed built-in replies, and confirmed both conversations appeared in History after reopening. Reproduced the Android keyboard covering the composer, then verified that Send stayed reachable and worked with the keyboard open after the fix.
- Reviewed Today in light and dark, checked Explore’s Move filter returned Gentle Movement, and verified full-bleed artwork on the updated Today and Explore cards. Verified the full Voice Talk title and its unconfigured transcription notice on the phone.
- The phone granted Solace notification permission. The ten-second test reported successful scheduling and Android listed the Solace notification as active. Notification-tap routing and background delivery remain to be confirmed.
- Client type check, formatting, web and Android exports, all 64 server integration tests, eight reminder coordination tests, and 15 voice lifecycle tests passed during the device pass.

Native recording and audio playback, broader notification scenarios, iOS, and release APK verification remain pending. This debug build uses the USB-forwarded local API and Metro.

## Twilight Today phone redesign — 6 November 2026

- Compared the supplied reference and final app in a side-by-side capture at equivalent phone widths. Reviewed light and dark at 394 × 852 CSS pixels and checked for horizontal overflow at 320, 394 and 1536 pixels. The verified Chrome tab had zero error-level entries.
- With a synthetic account on a separate offline API, Calm opened preselected, saved successfully and appeared selected on Today. Journey advanced to one recorded step and its card opened the Journey tab. Start Moment opened the Calm Reset player at `0:00 / 5:00`.
- Breathe opened the breathing timer, Reflect opened journaling, Sleep opened wind-down, and Focus opened grounding. Guided Programs opened the three-day plan, Wellness Toolkit opened the saved tools screen, Check-Ins opened mood entry, and See All opened the Explore library.
- Client type check, formatting, web export, Android and iOS JavaScript exports, 64 server integration tests, ten daily-routine tests, and eight Moment tests passed.

[Dark capture](screenshots/twilight-today-dark.jpg) · [Light capture](screenshots/twilight-today-light.jpg) · [Design comparison notes](../design-qa.md)

The connected Android display was off during the redesign check. Installed-device appearance, iPhone safe areas and iOS glass are pending.

## Compact Explore phone layout — 6 November 2026

- Compared the reference with the rendered Explore screen. Reviewed light and dark at 394 × 852 CSS pixels. Checked 320 and 430 pixel widths without page overflow and confirmed all six filters fit at 394 pixels.
- Verified the featured and Five Senses timers opened at five minutes, Breath Reset at three minutes, and Sleep Wind Down at ten minutes. Quick Reflection opened the journal. Sleep filtered to the two sleep entries and search found Gentle Movement.
- Saved the three-day plan from its banner on the isolated test account. Verified the toolkit and check-in routes, and started a ten-minute reflection from the secondary timed-practice builder. The preview reported no console errors during these route checks.
- TypeScript, formatting, the web preview export, eight Moment tests, and 64 server integration tests passed. Native iPhone appearance remains pending.

## Today petal and interaction polish — 6 November 2026

- The five mood images had identical asset paths, 29 × 24 dimensions, and placement in both themes at 394 × 852 CSS pixels. The page fit 320 and 430 pixel viewports without horizontal overflow.
- Low opened preselected in the existing check-in. Saving it updated the Today selection and the grounding recommendation explained that it used the recorded Low mood.
- TypeScript, formatting, seven wellness tests, ten routine tests, and the web preview export passed. The native haptic selection and accessibility announcement still need a rebuilt app on a physical iPhone. The tint transition uses the existing Reduce Motion preference.

[Dark capture](screenshots/today-petals-dark.jpg) · [Light capture](screenshots/today-petals-light.jpg)

## Grouped Profile and About — 6 November 2026

- Compared both supplied Profile references with the light and dark browser captures. The 320 and 430 pixel layouts had no horizontal overflow. About was reachable by scrolling at 320 pixels.
- Updated a synthetic account name and selected a synthetic photo through the account editor. Both appeared on Profile and persisted after reloading. The reminder badge changed from Off to On after saving an enabled preference, and the memory badge changed from zero to one after saving a preference. The browser reported preferences saved and deferred notification delivery to the mobile app.
- Verified the reminder, memory, appearance, privacy, support, and About routes. Appearance presented Light, Dark, and System. Privacy exposed export and account deletion controls. About showed the wellness disclaimer and safety guidance. No account was deleted. The verified preview tab reported zero error-level entries.
- TypeScript, formatting, the web preview export, and the Android and iOS JavaScript exports passed. Native picker, VoiceOver, Dynamic Type, and Liquid Glass remain to be checked on an iPhone.

[Dark capture](screenshots/profile-grouped-dark.jpg) · [Light capture](screenshots/profile-grouped-light.jpg)

## Journey redesign and record flows — 6 November 2026

- **Automated:** TypeScript and Prettier passed. Server integration: 71/71; Journey progress: 17/17, also run under `America/New_York`; offline: 9/9; session state: 34/34; Moment clock: 8/8. Expo web preview, Android and iOS JavaScript/Hermes exports passed. The server suite needs loopback access on Windows; it passed when run with that access. The repo has no separate lint command.
- **Browser, isolated test API:** A fresh account showed zero totals, no comparison gains, locked milestones, and a guided prompt for a week with no records. A populated account showed 4 distinct check-in days, 6 completed Moments and 28 mindful minutes, with comparisons of +2 days, +3 Moments and +12 minutes. Week, Month and All time changed the reporting window. Prior-week navigation, date markers, future-date disabling and selected-day history were checked. Two check-ins on the same day counted once; the detail showed an ended-early session without adding it to the totals.
- **Reflection, goal and story:** Used and edited a labeled local weekly draft; saved it, reopened it from the library, and edited it again. A separate manual reflection also saved. The weekly-reflection milestone unlocked from the saved record. Opened the reflection, affirmation and check-in categories. Created a 10-Moment weekly goal, verified it at 60%, and finished an actual one-minute Moment: Journey showed 7 completed Moments, 29 minutes and 70% goal progress. An ended-early session did not change the totals. Paused, resumed and edited the goal; checked the remove confirmation and kept the goal. Reload restored the session, Month selection, edited goal and saved reflections. API tests exercise goal and weekly-reflection deletion, authorization, date boundaries, stale data, and cancellation/retry with a stubbed provider.
- **Layout and device:** Compared both 394 × 852 CSS-pixel browser captures with the supplied mockup. The browser had no horizontal overflow at 320 and 430 pixels. On the connected physical Android phone, the existing debug app loaded the updated source from Metro, and Week, Month and scrolling to the saved-story links were checked. A new native release APK, Xcode build and physical iPhone were not tested. Live provider output was not tested; the local browser used offline guidance and the server tests used a stub.

[Dark capture](screenshots/journey-redesign-dark.jpg) · [Light capture](screenshots/journey-redesign-light.jpg)
