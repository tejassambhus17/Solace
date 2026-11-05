# Verification record

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
