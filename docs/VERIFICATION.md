# Verification record

## Final production release with optional onboarding

The 334-file release source snapshot was fingerprinted before packaging. Azure deployment `e11029e1-140e-446f-b899-5f50bb42f0e6` reached `RuntimeSuccessful`. Production served the exact candidate web bundle and passed health and media checks. A verified private SQLite backup and a byte-matched rollback archive were prepared before upload. Hosted checks used two disposable accounts and verified goal selection, the explicit empty-goal skip, protection against stale retries, account isolation, and completion after logout and login. A separate hosted Chrome run confirmed fresh signup, Skip for now, Today, and a reload without repeating onboarding. All disposable accounts were removed. [Deployment status](../work/latest-production-release/azure/deployment.json) · [Hosted API checks](../work/latest-production-release/azure/hosted-smoke.json) · [Hosted browser checks](../work/latest-production-release/azure/hosted-browser.json)

The final Android ARM64 APK passed release assembly and lint, signature verification against the previous sideload certificate, and 16 KiB alignment. The embedded Hermes bundle points to the production HTTPS endpoint. No Android phone was connected for install or launch checks. [Android APK](../outputs/Solace-Android-Final-Production-ARM64.apk) · [Android verification](../work/final-production-release/android-verification.json)

The iOS Release build was signed with the existing Personal Team profile after retrying from the Mac's local Terminal session. Strict signature, archive and transfer checksum verification passed. The production IPA installed and launched on the paired iPhone 15 Pro Max. In-app flows were checked in the hosted browser separately from device launch. The profile expires November 13, 2026 at 1:46 p.m. IST. [iOS IPA](../outputs/Solace-iOS-Final-Production-Device.ipa) · [iOS verification](../work/latest-production-release/ios/ipa-verification.json)

## Single-screen onboarding and optional goals

The illustrated welcome and goal picker rendered in both themes at 320, 390 and 430 px. An isolated authenticated browser run verified signup, first login, the optional skip, goal save and retry, reload and returning login, About replay, Profile edits, and account isolation. TypeScript, formatting, the server suite, navigation, and session-state tests passed. [Current evidence and screenshots](ONBOARDING_QA.md#single-screen-introduction-and-optional-goals)

## iPhone light-mode contrast repair

The five supplied iPhone screenshots established the contrast and material issues. Matching browser previews were captured before and after the source changes. All five light tabs rendered at 320, 390, and 430 px, and 12 paired dark captures at 390 px were pixel-identical. The browser confirmed that every Quick Action and each tab’s last action can clear the rail. The Android and iOS app builds are on hold at the user’s request. [Screenshots, contrast readings and coverage](LIGHT_MODE_AUDIT.md#iphone-contrast-repair)

## Five-issue UI and navigation pass

| Area | Change | Rendered evidence |
| --- | --- | --- |
| Journey | `PracticeInsights.tsx` replaces the separate thumbnail panel with lotus art blended into the existing Journey card proportions. The card and its detail destination use the original recorded-insight selector. | Eight Chromium checks covered empty and populated states in both themes, opening the existing detail from the card. Detail captures matched before and after. [Results](../work/master-five-journey/explore-after.json) |
| Ambient sound | `Profile.tsx`, `App.tsx`, `routes.ts` and `AmbientSoundPreferences.tsx` give the setting its own route. `Moments.tsx`, `GuidedBreathingPlayer.tsx` and `MomentEnvironmentPicker.tsx` apply the saved audio default to the shared Moment players while retaining their scenic art and session override. `Journey.tsx` limits the streaks update to its own preference. | Chromium checked Back to Appearance, persisted Ocean and enabled playback, recovered from HTTP 503, and saw the actual loop play past one second. [Results](../work/ambient-preferences-qa/browser-result.json) |
| Companion keyboard | `Core.tsx` retains overlap-based keyboard avoidance on both native platforms. The Android emulator showed that `adjustResize` alone can leave the absolute composer behind the keyboard. `App.tsx` synchronizes the Companion inset change with iOS keyboard events, and `Navigation.tsx` keeps the hidden rail mounted and out of touch and accessibility traversal during the transition. | The rebuilt APK placed the composer 22 pixels above the Android 13 keyboard in the measured light and dark states. No nearly black frame was detected in the upper app area of 1,293 sampled video frames. This does not measure frame timing. The iOS bundle exported, but a trusted connection to the signing Mac was unavailable for native keyboard and swipe Back checks. |
| Quick replies | `Core.tsx` sends all three welcome prompts through the usual chat submission path. The send guard blocks duplicate presses, and the first reply moves any unrelated draft into the new thread. A failed quick reply can retry without filling the composer. | Chromium tapped each prompt twice, observed one initial request, verified a live provider reply and one saved user message per thread, and reopened Conversation History. A dropped response retried with the same request ID. The Android emulator independently saved one user message for each prompt through the isolated API. Both disposable accounts were deleted. [Live results](../work/master-five/quick-replies.json) · [Android results](../work/master-five-native/final/results.json) |
| Solace Back | `store.tsx` gives one-entry Companion and Journal modes a Back destination while retaining their saved route state. `Core.tsx` and `Journal.tsx` call that same Back path. Deeper routes still pop to their existing parent. | The previous Android APK reproduced the Companion hardware Back failure by exiting to the launcher. In the candidate, Android hardware and header Back both returned from Companion and Journal to Solace. Reopening Companion restored its unsent draft, and Android Back from the Journal editor returned to the library. State tests also cover writing drafts and the unrelated Explore stack. [Baseline](../work/master-five-native/baseline/back-companion-hardware.png) · [Companion](../work/master-five-native/final/back-companion-hardware.png) · [Journal](../work/master-five-native/final/back-journal-hardware.png) |

App TypeScript, Prettier, backend integration (187), navigation (49), session state (91), Companion actions (10), Moment (15), ambient mixer (5), progress (27), native configuration (14), and Voice (36) passed. Web and iOS bundle exports and isolated Android release assembly and lint passed. The changes are in the working tree. A new standalone client bundle is required to get these fixes on installed production builds.

| Visual comparisons | Light | Dark |
| --- | --- | --- |
| Journey before | [Empty](../work/master-five-journey/before-light-insight-empty.png) · [Populated](../work/master-five-journey/before-light-insight-populated.png) | [Empty](../work/master-five-journey/before-dark-insight-empty.png) · [Populated](../work/master-five-journey/before-dark-insight-populated.png) |
| Journey after | [Empty](../work/master-five-journey/light-insight-empty.png) · [Populated](../work/master-five-journey/light-insight-populated.png) | [Empty](../work/master-five-journey/dark-insight-empty.png) · [Populated](../work/master-five-journey/dark-insight-populated.png) |
| Ambient sound | [Saved Ocean preference](../work/ambient-preferences-qa/ambient-settings-light-390.png) | [Default preference](../work/ambient-preferences-qa/ambient-settings-dark-320.png) |
| Android keyboard | [Recording](../work/master-five-native/keyboard-completion/keyboard-light.mp4) · [Frame scan](../work/master-five-native/keyboard-fixed/keyboard-light-scan-frame-scan.json) | [Recording](../work/master-five-native/keyboard-completion/keyboard-dark.mp4) · [Frame scan](../work/master-five-native/keyboard-fixed/keyboard-dark-scan-frame-scan.json) |

The Android keyboard check covered two empty opens, a short draft, a 231-character wrapped draft, and a 295-character multiline draft in each theme. The longer drafts matched their pre-dismissal text exactly after reopening. An existing conversation also retained its new unsent line after closing and reopening the keyboard. All 11 samples measured the composer above the keyboard using Android's reported IME bounds. The frame scans are from separate light and dark recordings of the same APK. [Keyboard results](../work/master-five-native/keyboard-completion/results.json) · [Existing conversation](../work/master-five-native/keyboard-completion/keyboard-populated-transcript.png)

A separate Android test reopened a saved 12-message thread. After dismissing its practice suggestion, the latest user message remained reachable before and after reopening the keyboard, the unsent line matched exactly, and the composer again measured 22 pixels clear of the IME. [Long-history results](../work/master-five-native/keyboard-long-history-dismissed/results.json) · [Rendered thread](../work/master-five-native/keyboard-long-history-dismissed/history-latest-and-composer-reopened.png)

## Connected Wellness production rollout

Azure returned `RuntimeSuccessful` for deployment `a0ae3f3a-a883-4395-ae28-b50fd64b2325`. The live web page served the candidate bundle, and the exact deployment package passed local account isolation, restart persistence, and byte-range audio checks before rollout. The previous hosted bundle matched the saved rollback archive. A private online SQLite backup passed `PRAGMA quick_check` before the upload. [Deployment evidence](../work/connected-production-release/deploy.log) · [Rollback package verification](../work/connected-production-release/rollback.json)

A disposable account on the deployed API verified registration, sign-in, goal onboarding, the one-minute Companion action and its retry receipt, one saved practice with its original check-in and recheck, and one Garden credit. The practice record was a smoke-test fixture. The account was deleted and its token was rejected afterward. Hosted media byte ranges and unauthorized state rejection also passed. Local TypeScript, formatting, and 187 server tests passed. [Hosted checks](../work/connected-production-release/hosted-smoke.json)

The [Android ARM64 APK](../outputs/Solace-Android-Connected-Production-ARM64.apk) passed release assembly, release lint, v2 signature verification, and 16 KB zip alignment. It uses the same sideload signing certificate and app ID as the previous production APK, with the current UI and the Azure HTTPS endpoint embedded. The final ARM64 artifact still needs physical Android installation and interaction checks.

The [signed iPhone IPA](../outputs/Solace-iOS-Connected-Production-Device.ipa) passed Xcode Release build, strict code-signature verification, archive validation, and SHA-256 verification after transfer. The bundle contains the deployed Azure URL and Connected Wellness screens. Installation and launch passed on the paired iPhone 15 Pro Max. Its existing Personal Team profile expires November 13, 2026 at 08:16 UTC. Full physical-device Voice and reminder checks remain open. Neither mobile artifact was submitted to a store. [iOS build and install evidence](../work/connected-production-release/ios-completed.log)

## Final submission stabilization

The [submission report](SOLACE_FINAL_SUBMISSION_QA.md) records the rollback snapshot, targeted fixes, current screen coverage, runtime and release results, and recording plan. The isolated demo passed from onboarding to Garden with real Realtime audio. Existing production builds predate that flow, and final physical-device acceptance remains open.

## Connected wellness experience

| Feature | Authoritative data and behavior |
| --- | --- |
| Next step after mood | The existing account check-in saves first. Local rules rank catalog practices by the saved mood, wellness goals, available preferences, and recent completed activity. Recheck history can guide that ranking only with the existing personalization preference and enough matching observations. The recommendation offers the existing practice, Companion, reflection, and a way to leave. |
| Companion practice handoff | Text and Realtime use the same validated `practice-start` action and capability flag. Supported durations and routes resolve against existing practice definitions. A confirmed voice action closes capture and opens the player above the originating thread. Returning restores chat without opening another call. |
| Completion and emotional recheck | The existing session ID carries `practiceId`, actual start/end and active seconds, outcome, and owned check-in or Companion-action provenance when available. More settled, About the same, and Less settled update the completed session. Skipping leaves its completion intact. A cancelled launch cannot earn completion or Garden credit. |
| What helped me | Journey reads completed, synchronized sessions directly. It summarizes up to 30 recent practices, shows a pattern after at least three recorded rechecks, and excludes skipped, early, and resource records from the recheck denominator. Records open their saved detail or actual practice. A linked check-in appears only when that account still has it. |
| Weekly Garden intention | The current week offers calming, breathing, sleep, journal, and eligible scheduled-habit choices. Goal preferences guide the suggestion. The server validates each qualifying record and writes its contribution with the existing Garden ledger in one transaction. A choice can change before its first contribution. Credits are capped at the weekly target, and missed weeks preserve earned growth. |

The server extends existing JSON session records and adds owner-scoped Garden intention and contribution records in the existing records table. There is no SQLite schema migration. Duplicate completion requests preserve the original session and Garden contribution. A recheck cannot change the session’s timing or provenance. Pending check-ins are linked only if synchronized by the time completion is saved. If the user deleted an optional source during a practice, the client retries once with the same session ID and omits the unavailable links. An existing owned session still accepts its recheck after the source has been deleted. Legacy follow-up check-ins still appear in session details. Existing history and earned Garden growth are retained. Legacy records do not retroactively earn intention credit. The current player pauses in the background, and incomplete or failed starts earn no credit. Abandoned Moments and failures before a session begins have no new Journey history row.

**Companion runtime.** Chromium connected to real OpenAI Realtime on an isolated local API. A synthetic spoken “Start a one-minute breathing exercise” received the illustrated offer. Spoken “Yes” started the actual one-minute player. The peer closed and the microphone stopped before playback. The API persisted one 60-second completion, the original conversation and action IDs, and its More settled recheck. Returning to Companion restored the thread with one total peer opened. Separate rendered light-mode tests verified button and typed confirmation, and early exit with zero completion credit. [Realtime result](../work/connected-voice-qa/ui-result.json) · [Text action](../work/connected-voice-qa/text-ui-result.json) · [Typed confirmation](../work/connected-voice-qa/text-confirmation-ui-result.json) · [Voice proposal](../work/connected-voice-qa/voice-proposal-dark.png) · [Text proposal](../work/connected-voice-qa/text-proposal-light.png)

**Connected flow in Chromium.** With an isolated SQLite account, saving a Stressed check-in surfaced the one-minute reset. The real player ran for 60 seconds. The recheck updated the same session, with its original check-in ID. Two seeded earlier responses plus the new response produced the expected 2-of-3 Journey observation. The Garden displayed one of three planned practices, advanced to Sprout, and showed the exact contributing session. Journey and Garden data were still present after reopening the database and browser. Reduced-motion captures at 320 CSS px dark and 390 CSS px light included the insufficient-data state. [End-to-end results](../work/connected-practice-qa/browser-result.json) · [Reload results](../work/connected-practice-qa/browser-reload-result.json)

| Rendered screen | Dark | Light |
| --- | --- | --- |
| Saved mood and recommendation | [320 px](../work/connected-practice-qa/mood-next-step-dark-320.png) | [390 px](../work/connected-practice-qa/mood-next-step-light-390.png) |
| Practice completion and recheck | [320 px](../work/connected-practice-qa/practice-completion-dark-320.png) | [390 px](../work/connected-practice-qa/practice-completion-light-390.png) |
| Journey observation | [320 px](../work/connected-practice-qa/journey-summary-dark-320.png) | [390 px](../work/connected-practice-qa/journey-summary-light-390.png) |
| Journey insufficient data | [320 px](../work/connected-practice-qa/journey-empty-dark-320.png) | [390 px](../work/connected-practice-qa/journey-empty-light-390.png) |
| Garden intention progress | [320 px](../work/connected-practice-qa/garden-progress-dark-320.png) | [390 px](../work/connected-practice-qa/garden-progress-light-390.png) |

**Android runtime.** On an Android API 33 x86_64 emulator at about 393 × 807 dp, the first QA APK saved Stressed, rendered the recommendation in both themes, and completed the native 60-second player. The API readback contained one new completed session, one original check-in and one More settled response. Journey displayed the correct 2-of-3 observation and original mood. Garden advanced to Sprout with 1 of 3. The final signed QA APK repeated the first check-in in both themes with no obstructing celebration, opened the actual player, and displayed the exact Garden contributor from a seeded saved session. Android UIAutomator returned an empty hierarchy on the running player in the final short smoke. Its screenshot independently shows the timer at 0:23 and the Pause control. The full timer was exercised on the preceding QA build. Test accounts and the local HTTPS fixture were cleaned up. [First Android run](../work/connected-native-qa/android-connected-through-garden-result.json) · [Final smoke](../work/connected-native-qa/android-final-smoke.json) · [Android recheck](../work/connected-native-qa/android-dark-recheck.png) · [Journey](../work/connected-native-qa/android-dark-what-helped.png) · [Running player](../work/connected-native-qa/final-android-diagnostic.png) · [Garden contributor](../work/connected-native-qa/final-android-light-garden-growth.png)

**Automated and build checks.** App and server TypeScript, server build, and repository Prettier passed. Suites passed for the backend (185), session persistence (90), navigation (49), voice lifecycle (36), Journey/progress (26), Today routine (19), reminders (16), Moments (15), native configuration (14), Google auth fixtures (12), API configuration (12), Companion actions (10), weekly insights (10), offline (10), wellness plans (7), and ambient mixer (5). Garden coverage includes owner isolation, duplicate delivery, rejected false completions, a week rollover, and earned growth retention. Web and iOS bundle exports passed. Gradle release assembly, release lint and APK signature verification passed on the project’s supported Node 24 runtime. The final smoke installed that rebuilt APK. [Server test log](../work/connected-wellness-qa/server-final-tests.log) · [Android build log](../work/connected-wellness-qa/android-supported-build.log)

**Release status.** The emulator APK is isolated from Azure production. The Mac was unreachable, so no iOS native build or runtime test ran. Real-device WebRTC/audio handoff, screen readers and enlarged native text remain unverified. Production was checked only with a read-only health request. The matching server and client bundles have not been deployed. Existing standalone apps need an updated client bundle and server release to use this workflow. The change adds no native dependencies.

**Implementation map.** The mood recommendation and player integration reuse `CheckinNextStep.tsx`, `PracticeFollowUp.tsx`, `Wellness.tsx`, and `Moments.tsx`. Journey adds `PracticeInsights.tsx` and its selector in `practice-insights.ts`. Garden adds `GardenIntentionCard.tsx` and integrates the existing Habits sections and ledger. Companion extends the shared action contract, intent classifier, action card, and the existing Realtime and text handlers. The account store applies authoritative session and intention responses through the same authenticated flow.

## Personalized wellness goal onboarding

New email registrations and newly created Google accounts start with account-level onboarding pending. The authenticated `/state` response resolves eligibility before Today renders. The existing welcome walkthrough remains separate. Accounts predating this release are eligible to opt in through Profile, and completed accounts go directly to their existing destination. The theme preference hydrates before either goal screen mounts.

`PATCH /api/auth/wellness-goals` validates six stable goal identifiers and scopes writes to the authenticated account. The first save commits selections and completion together. Retrying completion returns the saved account state and preserves newer edits. The additive SQLite migration leaves older accounts in the legacy state. The Profile editor writes to the same fields and supports removing every choice. Confirmed saves update the account snapshot, while failed saves leave the current selections available for retry. A same-account reauthentication restores the pending picker selection within the running app.

| Choice | Optional first action | Ongoing recommendations |
| --- | --- | --- |
| Feel calmer | Three-minute Breath Reset | Breathing, with grounding still available in Explore |
| Sleep better | Ten-minute Sleep Wind Down | Wind-down in Explore and guided rest in Daily Pause |
| Understand my feelings | Mood check-in | Quick Reflection in Explore and guided reflection in Daily Pause |
| Build healthy habits | Create a habit | Habit Builder, My Habits and Garden through the existing hub |
| Improve my focus | Timed Practice set to five minutes and Focus | Focus practice in Explore and grounding in Daily Pause |
| Just explore | Explore | The usual mix of practices |

Multiple specific goals rotate priority by local day. Today uses a goal when it lacks a more relevant signal from the user’s current check-in, approved preferences, or chosen daily practice. All destinations remain available. Goal selection informs local recommendations independently of AI consent. With the existing AI personalization setting enabled, text and Live Voice receive fixed labels for relevant specific goals. Journal and urgent-support paths stay separate. The existing authorized Companion navigation tool can open the editor on clients that advertise support. Provider tests captured the consent-gated instructions and checked in-flight context invalidation using fixture responses.

Chromium exercised nine scenarios using the exported React Native app, a local API, and a disposable SQLite database. The run covered signup, failure and recovery during authenticated initialization, both themes and system appearance changes, checkbox keyboard selection, 320/390/430 px layouts, reduced motion, offline and server save failures, a rapid double tap, real token revocation and same-account recovery, returning after a database reopen and cleared browser storage, legacy opt-in, clearing saved goals, leaving without saving, account isolation, and the existing focus-practice destination. The browser recorded zero runtime exceptions. [Functional evidence](../work/wellness-goals-qa/browser-result.json) · [Light](../work/wellness-goals-qa/light-390-reference-selection.png) · [Dark](../work/wellness-goals-qa/dark-430-selected.png) · [Welcome](../work/wellness-goals-qa/dark-personalized-welcome.png)

Android API 33 emulator QA used a pending synthetic account on an isolated HTTPS API. Login showed the picker, two selections survived a live system light-to-dark change, and the API read back the confirmed goals and completed status. The rendered welcome continued to Today. Force-closing and reopening returned directly to Today. Android signup automation and the native Profile large-text check were inconclusive. Chromium covered signup and the complete Profile flow. The installed QA pass preceded the final dark contrast adjustment, which was verified in Chromium and built into the final signed emulator APK. [Android result](../work/wellness-goals-qa/android-result.json) · [Light](../work/wellness-goals-qa/android-light-selected.png) · [Dark](../work/wellness-goals-qa/android-dark-selected.png) · [Welcome](../work/wellness-goals-qa/android-dark-welcome.png)

Mobile and server TypeScript, formatting, 89 session, 48 navigation, 19 routine, eight Companion action, 36 voice, and 176 server integration tests passed. Five final focused backend tests also passed. Web and iOS JavaScript exports succeeded, and Android assembled and signed a dedicated emulator QA APK with release lint. The iOS build Mac was unreachable. Native iOS and physical-device checks are pending. Standalone builds require the updated client bundle and a matching server release with the additive migration. Existing native modules and signing configuration are sufficient. Production rollout is pending.

The new UI lives in `src/screens/WellnessGoals.tsx`. Account gating and theme hydration use `App.tsx`, `src/onboarding-state.ts`, `src/theme.tsx`, and `src/store.tsx`. Routes, Profile, Daily Pause, Explore and app actions reuse their existing components and navigation. Shared goal identifiers are in `server/src/wellness-goals.ts`. Server persistence and AI context changes are in `database.ts`, `auth.ts`, `google-auth.ts`, `app.ts`, `ai.ts`, `realtime.ts`, and the Companion action contracts. Asset provenance is in [ARTWORK.md](../assets/ARTWORK.md), and the visual comparison is in [design QA](../design-qa.md#personalized-wellness-goal-onboarding).

## Companion actions and six-issue fixes

| Issue | Cause and implementation | Local evidence |
| --- | --- | --- |
| Companion back | The header chose between an avatar and a context-dependent Back action. A filled circular button now opens the Solace landing route while the store retains the Companion view and drafts. | Navigation fixture and Chromium with a new draft and a saved conversation. |
| Ambient Sound Mixer | The same low gain was applied to all four loops and a failing track could pause the mix. Gain is calibrated per track. Each track has its own playback state and failure recovery. Added mute, mix pause/resume and stop. | Five regression tests and Chromium media playback. All four distinct loops played alone and together, wrapped at the loop boundary, recovered from an injected Wind failure and stopped on Back. |
| Companion actions | AI replies previously exposed practice suggestions without a general action path. Text and Realtime use a shared validated proposal contract, and the client executes against the existing authenticated app services. | Isolated Chromium and mocked provider tests. Confirmed habit/reminder persistence, typed cancellation, theme persistence and navigation. Server and client tests cover forged actions, account isolation, retries and interrupted voice. |
| Habits Insights | Wrapping was allowed inside unequal-content segments. Week and Month now use equal widths and center their icon-label pairs, with selected state exposed to assistive technology. | Component and browser checks. |
| Gentle Reminders | The form relied on manual HH:MM entry. Three scrollable columns show a 12-hour time and save through the existing scheduler. | Sixteen reminder tests, including all 1,440 time conversions and mocked native triggers. Chromium verified wheel, keyboard, cancel and save in both themes. |
| Lavender accents | Shared dark CTA and focus tokens were warm beige and several buttons overrode the theme. CTA, focus, selection and indicator colors now reuse lavender tokens. | Theme contrast and representative light/dark browser checks. Cream surfaces, semantic colors and cinematic artwork remain available. |

### Actions available in text and Live Voice

- **Today and Solace** — Home, Daily Pause, mood check-in, Solace landing, Companion, Conversation History, Journal and the Journal editor.
- **Explore and Habits** — Wellness Tools, Ambient Sound Mixer, Toolkit, Guided Techniques, Guided Programs, Wellness Plan, Timed Practice, Solace Moments, habit dashboard and library, Insights, Garden, resources, the sleep guide, grounding, affirmations, Daily Challenge and Reflective Check-ins.
- **Journey and Profile** — Journey overview and a requested period, activity history, milestones, personal goal, saved affirmations, Profile, Appearance & Preferences, Gentle Reminders, memories, account, Privacy & Data, human support and About.
- **App operations** — Save light, dark or device appearance. Read this week's or this month's actual habit completion count. Filter Journal to today or yesterday. Open the player for breathing, grounding or wind-down at 5, 10, 15 or 20 minutes. The player still asks the user to begin.
- **Review before saving** — Create a basic daily, weekday or weekend habit, complete an owned and eligible occurrence, or save a recurring daily, weekday or weekend reminder at a reviewed local time. Habit completions resolve against existing records and duplicate reminders are checked. Voice confirmations check that the server still recognizes the pending turn. Cancel dismisses the proposal.

Direct requests are checked against the current turn. Tool data cannot provide arbitrary routes, URLs or record IDs. The client uses existing authorization and keeps journal content out of the action request. Journal excerpt discussions continue to use their consent-based path. Destructive mutations, arbitrary dates, one-off reminders and arbitrary settings changes are outside this action contract.

The app negotiates actions using `X-Solace-App-Actions: 1`. Existing clients and servers can continue normal conversation without this feature. The updated backend and app bundle are both needed for actions. No new native module, model setting, signing setting, production data change or Azure deployment is needed for local verification.

### Test evidence and release boundaries

- Mobile and backend TypeScript checks, Prettier, and the 160-test backend suite passed. The backend suite used mock provider events for tool negotiation, isolation and interrupted voice turns.
- All 283 app checks passed across Companion actions (7), navigation (45), voice (35), session state (87), progress (25), Daily Pause (17), wellness (7), reminders (16), ambient mixer (5), offline (10), Moments (15) and native configuration (14).
- Expo produced the Android, iOS and web bundles. Android `compileReleaseKotlin` and `lintVitalRelease` passed. Native iOS compilation needs Xcode. No installable release was produced in this pass.
- Chromium verified Companion Back with new and saved drafts, centered 138 × 44 px Insights segments at a 320 px viewport, and representative light and dark accent contrast. The minimum measured text contrast in those checks was 6.96:1. See `work/master-six-browser-qa/browser-result.json` and the screenshots next to it.
- Chromium used real local media playback for the mixer and an isolated mock AI reply endpoint for app actions. See `work/ambient-mixer-four-layer-playback-dark-320.png`, `work/companion-app-action-habit-confirmation.png` and the time-picker screenshots under `work/reminder-picker-qa/`.
- Live provider actions, physical-device back and accessibility, native audio focus/Bluetooth and background reminder delivery still need verification. ADB listed no connected devices during this pass. See the [six-fix rollout](#six-fix-rollout) for deployment evidence.

### Change map

- Companion navigation and the text action surface use `src/screens/Core.tsx`. The shared client action flow uses `src/companion-actions.ts`, `src/screens/CompanionAppActions.tsx`, `src/store.tsx`, `src/realtime-voice-state.ts` and `src/screens/VoiceTalk.tsx`. Destination support touches `src/screens/Discover.tsx`, `src/screens/Journal.tsx` and `src/screens/Journey.tsx`.
- The server action contract and integration are in `server/src/companion-app-action.ts`, `server/src/companion-action-intent.ts`, `server/src/ai.ts`, `server/src/app.ts` and `server/src/realtime.ts`. Coverage is in `server/tests/api.test.ts`, `server/tests/companion-app-action.test.ts`, `server/tests/realtime.test.ts` and `server/tests/realtime-routes.test.ts`.
- Mixer changes are in `src/ambient-mixer-playback.ts`, `src/screens/AmbientMixerImpl.tsx` and `assets/AMBIENT_AUDIO.md`. The WAV assets were reused.
- The Insights control is in `src/screens/HabitsInsights.tsx`. Reminder changes are in `src/screens/Profile.tsx`, `src/screens/ReminderTimePicker.tsx`, `src/reminder-time.ts` and `src/save-reminder.ts`.
- The accent audit updated `src/theme.tsx` and control overrides in `src/screens/ChatDetails.tsx`, `src/screens/Discover.tsx`, `src/screens/Explore.tsx`, `src/screens/HabitsInsights.tsx`, `src/screens/Journal.tsx`, `src/screens/JournalCalendar.tsx`, `src/screens/Journey.tsx`, `src/screens/SolaceHome.tsx`, `src/screens/SolaceRecommendationCard.tsx` and `src/screens/Wellness.tsx`.
- Client checks were added or updated in `scripts/test-ambient-mixer.cjs`, `scripts/test-companion-actions.cjs`, `scripts/test-navigation.cjs`, `scripts/test-reminders.cjs`, `scripts/test-routine.mjs`, `scripts/test-session-state.cjs` and `scripts/test-voice.cjs`. `package.json` and `scripts/runtime.cjs` expose the two new suites. The root and server READMEs and this requirements and verification documentation record the behavior.

## OpenAI migration

- The [migration report](OPENAI_MIGRATION.md) inventories live and deterministic features, setup, privacy controls and model assignments. All four default models were exercised with a disposable Solace account. [Live results](../work/openai-migration/live-result.json)
- The smoke reopened saved chat history, checked multi-turn context and deleted-memory exclusion, persisted a generated Moment completion, and exercised Journal, plan, habit and weekly output. OpenAI synthesized an MP3 and transcribed it. Production Chrome verified the client’s speaking state, Stop, cleanup and 429 fallback using synthetic MP3 input. [Voice checks](../work/openai-migration/voice-browser.json)
- TypeScript, Prettier, 260 app and tooling tests, and 131 backend tests passed. Production Expo bundles exported for web, Android and iOS. Android x86-64 release assembly and native lint passed.
- The earlier Gemini evidence below records historical runs. Current runtime requests use the official OpenAI SDK only.

## Nested screen design consistency

- The [screen audit](SOLACE_SCREEN_DESIGN_AUDIT.md) inventories 56 nested route IDs across 43 workflow groups. The [consistency report](SOLACE_DESIGN_CONSISTENCY_REPORT.md) records the screen-by-screen checklist, comparison images, working interactions, and device boundaries.
- Current Chrome checks covered 320–430 CSS px in light and dark, using disposable authenticated accounts. They exercised nested routes, editable forms, Journey goal persistence, reminders, memory, Journal consent, wellness saves, and mixer playback. The five approved root layouts were compared with a pre-change production export. Android emulator smoke exercised the settings, Moments and Journey nested routes, including hardware Back.
- TypeScript, Prettier, 241 app tests, 119 backend tests, production Expo exports for web/Android/iOS, and Android x86-64 release assembly and lint passed. Native iOS, physical-device audio, notifications, biometrics and assistive technology require follow-up.

## Guided Techniques breathing player

- Box breathing and Slow breathing use the existing Moment timer and completion flow. The full-screen player measures its safe-area viewport, scales the ring, centers the cue and full step instructions, and groups the timer and transport above a compact environment control. Twilight artwork is a decorative layer. The forest and ocean scenes and their audio remain available from the environment sheet. Very short windows and enlarged text can scroll to reach the controls.
- The production Chrome comparison measured ready-screen vertical overflow of 137 → 0 CSS px at 320 × 568, 98 → 0 at 375 × 667, and 28 → 0 at 390 × 844. The 430 × 932 viewport fit before and after. The revised visible ring measured about 41% of the viewport width at rest. Light and dark were covered. [Baseline measurements](../work/guided-player-qa/baseline.json), [final browser results](../work/guided-player-qa/final-browser-result.json)
- The final production export rechecked long Box breathing guidance at 320 × 568, including active, manually paused, and background-paused states. The environment control stayed fully visible without scrolling. The 430 × 932 dark layout also fit with its guidance and ring positioned higher. The rerun recorded zero browser exceptions. [Final measurements](../work/guided-player-qa/final-geometry.json), [compact light layout](../work/guided-player-qa/320x568-light-paused-background.png), [large dark layout](../work/guided-player-qa/430x932-dark-ready.png)
- The Chrome flow started, paused, resumed, restarted, and abandoned Box breathing. A simulated background event paused the timer and excluded inactive time. Changing Ocean Calm to Forest Sanctuary during playback switched ambient tracks, and muting stopped playback. With an isolated SQLite API and a test-only accelerated clock, repeated taps saved one 180-second Slow breathing completion, visible in Journey. An abandoned grounding technique and a 10-minute Timed Practice left the completion count unchanged. [Completion evidence](../work/guided-player-qa/journey-saved-breathing.png)
- Chrome exercised a 320 × 415 viewport with 1.65× simulated CSS text and reached the environment sheet by scrolling. A separate 390 × 844 Chrome run simulated 59 px top and 34 px bottom safe-area insets. These runs cover layout behavior in the browser.
- A Pixel 3a API 33 emulator showed all ready-state controls in the initial viewport at approximately 393 × 807 dp in light mode with gesture navigation and 321 × 659 dp in dark mode with three-button navigation. Android verified environment changes, the sound toggle, pause/resume, background pause, restart, leave confirmation, and dismissing the sheet with system Back. [Android measurements](../work/guided-player-android/native-results.json), [narrow Android screenshot](../work/guided-player-android/dark-narrow-three-button-ready.png)
- At approximately 321 × 568 dp with 1.5× Android system text and three-button navigation, the title wrapped, phase text moved below the ring, and the environment selector and its stacked options were reachable by scrolling. The run entered through the technique’s Start practice button and used Android Back to dismiss the sheet and leave the player. [Large-text Android screenshot](../work/guided-player-android/dark-short-large-text-sheet.png), [result](../work/guided-player-android/native-short-results.json)
- TypeScript and Prettier passed. Moment (15), wellness (7), navigation (19), progress (22), and backend integration (119) tests passed. Expo production exports succeeded for web, Android, and iOS. Android Gradle `:app:lintVitalRelease` passed. Windows cannot run the iOS simulator or an Xcode build. Physical-device rendering, audio output, and frame pacing remain unverified.

For native iOS follow-up, open Explore → Guided Techniques → Box breathing on a small iPhone and on a Dynamic Island model. Check the ready and longest instruction with standard and enlarged text, open and dismiss the environment sheet, and switch away mid-practice. Confirm the timer stays paused on return, audio follows the sound control, and saving a full practice adds one Journey record.

## Brand headers and native app icons

- `src/SolaceBrandHeader.tsx` shares Today’s 30 × 21.6 dp mark, 24 sp Cormorant Garamond semibold wordmark, 28 sp line height, default tracking, and 6 dp gap. It is used by `Discover.tsx`, `Explore.tsx`, `Journey.tsx`, and `ProfileHome.tsx` under `src/screens/`. The wordmark scales up to 1.5× and fits on one line. Existing action rows and per-screen ink remain in their original positions.
- Production Chrome checked light and dark at widths of 320, 390, and 430 CSS pixels. Today matched its original geometry. The other three headers matched Today’s measured mark, wordmark, gap, and vertical alignment. Existing header action positions matched baseline, and control taps opened their expected destinations. The Solace landing brand and intro pixels matched baseline in all six cases. [Chrome results](../work/brand-header-qa/browser-result.json)
- The Pixel 3a API 33 emulator checked all four headers at about 393 dp in light mode with 1.0× text and about 321 dp in dark mode with 1.5× text. Wordmark bounds matched across all four headers in each configuration. Today’s Reminders and Moment, Explore search and toolkit, Journey options, and Edit Profile opened normally. The Solace landing still offered Companion and Journal. [Android measurements](../work/brand-android-headers/bounds.json)
- `assets/app-icons/` contains six 1024 × 1024 PNGs. The existing three-petal art produced the cream and midnight-plum compositions, transparent native iOS dark, grayscale iOS tinted, and transparent Android color and monochrome layers. Simulated masks at 96, 48, and 24 px kept the lotus visible. Android artwork measured 61.82 dp across its furthest points in the 66 dp safe area. [Asset provenance](../assets/ARTWORK.md), [mask previews](../work/brand-icon-qa/icon-mask-preview.png)
- `app.json` uses Expo’s native icon configuration. The installed SDK generated the default, dark, and tinted iOS AppIcon catalog in an isolated fixture. It generated Android legacy, round, adaptive, and monochrome resources across five densities. The existing Android project was updated with Expo’s icon generator. Native package inspection verified `com.solacewellness.app`, display name `Solace`, an embedded JavaScript bundle, and a signed x86-64 APK with the adaptive and monochrome resources. [iOS asset inspection](../work/brand-icon-qa/ios-prebuild/asset-evidence.json), [Expo app icon configuration](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/#app-icon)
- The freshly installed Android release showed the cream adaptive icon under the Pixel launcher’s circular mask, both in the app drawer and on Home. Tapping it opened `com.solacewellness.app/.MainActivity`. The themed-icon switch returned to Home while the launcher continued rendering its color icons, so installed monochrome rendering remains open. Its shape, safe area, and packaged adaptive XML reference passed their separate checks. [Installed color icon](../work/brand-native-qa/launcher-home-color.png), [packaged adaptive XML](../work/brand-native-qa/packaged-adaptive.xml.txt)
- TypeScript, Prettier, 19 navigation tests, 16 routine tests, 78 session-state tests, 10 native configuration tests, and 119 backend tests passed. Expo production exports passed for web, Android, and iOS. Gradle `:app:assembleRelease :app:lintVitalRelease` passed for the local x86-64 QA build.

### Native rebuild and acceptance

Android on Windows can use `./scripts/build-android.ps1 -ApiUrl "https://your-configured-api"` with the actual HTTPS API. Install the resulting new native APK. Android’s themed icon uses the launcher’s themed-icon setting and palette. [Android adaptive icon behavior](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)

On a Mac, sync the generated catalog with `node scripts/runtime.cjs expo prebuild --platform ios --no-install` using the existing signing workflow, then rebuild and install with `npm run ios -- --device` or Xcode. Check Light, Dark, and Tinted from the iOS Home Screen appearance controls. Native iOS installation and physical-device rendering remain open. [Apple asset catalog appearances](https://developer.apple.com/documentation/xcode/configuring-your-app-icon?changes=_3)

## Wellness Plan and Guided Programs

- Create Your Wellness Plan opens a three-day builder with goal, practice-type, and 5-, 10-, or 15-minute choices. Users can swap an activity in the preview, save a draft plan, then start and resume it. Guided Programs opens a separate library for Better Sleep, Stress Relief, Mindful Mornings, and Building Focus. Timed Practice remains a single-session builder.
- Both flows use the existing Moment player and authenticated `plans` and `sessions` records. Journey credits a configured day from one saved full practice for that plan and day. Started plans preserve their original practice schedule. Legacy plans can still reopen, edit titles, and keep or change their manual checklist marks.
- TypeScript and Prettier passed. Automated coverage passed 18 navigation, 78 session-state, 16 routine, 7 wellness, 22 progress, 15 Moment, and 119 backend tests. Backend tests cover concurrent duplicate submissions, changed environment, full-duration and canonical activity validation, private program enrollment, cross-account isolation, Journey time, and legacy records.
- Production Chrome showed identical target-card pixels, artwork, text, layout, and ordering at 390 CSS pixels in dark mode and 320 in light mode. The first whole-frame captures matched the pre-change images byte for byte in both themes. A repeat dark capture differed only in recommendation thumbnails above the two target cards. The new light-mode builder and program library also fit 320 CSS pixels without horizontal overflow. [Browser evidence](../work/plan-qa/browser-result.json)
- The browser run used the production Moment player and an isolated SQLite API, with test-only clock acceleration for timed practices. The personalized flow saved an edited preview, started, resumed, saved its first practice once despite repeated taps, and reopened from Journey at 1 of 3 days. It completed the two remaining days with one session each and showed 3 of 3 days in Journey. All four curated program previews opened. Better Sleep completed all three days, persisted after reload, and awarded no credit for an abandoned attempt. The legacy plan kept its existing checkmarks and updated in place. Timed Practice opened independently. Chrome reported zero runtime exceptions. [Completed personalized plan](../work/plan-qa/completed-personalized-plan.png)
- Android release lint passed after bundling. Production Expo exports passed for web, Android, and iOS. The shared plan contract uses an explicit TypeScript source extension for Metro and the server compiler emits the Node-compatible JavaScript extension.
- The Pixel 3a API 33 Android emulator passed setup, preview, activity swap, save, and hardware Back in light mode at approximately 393 dp. The isolated API confirmed the chosen goal, ten-minute duration, and swapped activity. The emulator also opened Guided Programs, started Better Sleep, resumed into the actual player, and returned through the detail and library to Explore via hardware Back. [Personalized preview](../work/plan-android-qa/personal-preview.png), [program started](../work/plan-android-qa/program-started.png)
- Native iOS navigation, physical devices, and full-duration native playback remain unverified. Android device acceptance should check the same start, pause, resume, save, and Back flow with dark mode and larger system text. On iOS, also confirm the leading-edge Back gesture in the builder, library, and details.

## Tab reselection and root reset

- Switching tabs by tap or bar drag restores the selected tab’s open screen. Tapping the active tab returns to its root, including the Solace chooser. Tapping a root again keeps the same screen instance. Immersive practices retain their existing exit and save controls. Journal drafts are preserved, and root reset asks before discarding unsaved form changes.
- Production Chrome runs at 390 × 844 passed in dark mode with normal motion and light mode with Reduce Motion. With an isolated API, the runs covered Today Toolkit, Companion and Journal, Explore Timed Practice, Journey history, and Profile settings. They verified retained screen identity and scroll position, swipes that select a different tab or settle back on the same tab, exact Journal draft recovery, cancelling and confirming an unsaved reminder reset, and confirming an active Moment exit. Chrome reported zero runtime exceptions. [Dark run](../work/tab-root-reset-qa/browser-result.json), [light run](../work/tab-root-reset-qa/browser-light-result.json)
- A delayed Journal save reproduced a stuck saving indicator when the server finished while Today was open. Both final Chrome runs returned to the confirmed saved entry. A deletion finishing on Today returned to the unavailable-entry state without a stuck deletion indicator. [Reproduction](../work/tab-root-reset-qa/browser-before-late-save-result.json)
- A Pixel 3a Android API 33 emulator using the QA app and a local Metro bundle passed switch, restore, and reset from Today Mood Check-in, Solace Companion, Explore Guided Techniques, Journey practice detail, and Profile Appearance & Preferences. It also passed rapid repeated taps, a burst of taps through all five tabs, Journal draft recovery, swiping to a retained tab and settling on the same tab, Android Back, and both choices on the native unsaved Profile name prompt. A running Moment hid the rail, hardware Back opened the leave confirmation, Keep going resumed, and Leave without saving returned to Today. [Reset confirmation](../work/tab-root-reset-android/profile-dirty-confirmation.png), [resumed Moment](../work/tab-root-reset-android/practice-resumed.png)
- TypeScript, Prettier and Android release lint passed. Automated suites passed 17 navigation, 78 session-state, 7 wellness, 16 routine, 15 Moments, 8 native configuration, 10 offline, 22 progress, 21 voice, and 116 backend integration tests. Production Expo exports passed for web, Android, and iOS.
- Physical verification remains open. On an iPhone and Android phone, open a detail on each tab, switch away by tap and swipe, and confirm the detail and scroll return. Reselect to open each root. Repeat with a Journal draft, an unsaved form, and an active practice. Check the spotlight during rapid input, the iOS leading-edge gesture, Android system Back, and the rail after backgrounding. Verifying Liquid Glass and the iOS edge gesture on an installed build requires an iPhone or an iOS simulator.

The navigation changes are in `App.tsx`, `src/Navigation.tsx`, `src/navigation-motion.ts`, `src/navigation-reset.ts`, and `src/store.tsx`. Form and request lifecycle changes are in `src/screens/AmbientMixerImpl.tsx`, `Habits.tsx`, `HabitsEditor.tsx`, `Journal.tsx`, `JournalReflection.tsx`, `JourneyGoal.tsx`, `Moments.tsx`, `Profile.tsx`, and `Wellness.tsx`. Regression coverage is in `scripts/test-navigation.cjs` and `scripts/test-session-state.cjs`. `README.md` and `docs/REQUIREMENTS.md` describe the interaction.

## Journey Latest Activity — 7 November 2026

- The card uses Journey’s calendar panel colors and border, 17 dp corners, and 16 dp padding. The production browser measured 104 pixels at standard text at 320 and 430 widths in light and dark mode. At 320 with simulated 140% text it grew to 193 pixels without clipping. The adjacent metrics and calendar retained their measured styling, geometry, and 16-pixel gaps relative to the card.
- Browser fixtures verified saved mood check-ins, Solace Moments, guided practices, Journal entries, habit completions, reflective check-ins, saved reflections, and completed resource guides. The date and activity type matched each record, and right-edge taps opened the original destinations. Habit navigation retains both the habit ID and completion day. Progress and provider tests cover protected Journal redaction and pending device records. The card keeps the Waiting to sync label for pending records.
- Week, Month and All time used the active calendar period with no additional requests. Empty periods and a new account showed a static card with no chevron. A SQLite and browser restart restored the saved record and selected period. [Browser measurements and routes](../work/journey-latest-activity-qa/browser-result.json)
- The Android API 33 Pixel 3a emulator matched in both themes at 393 dp (104 dp tall) and at 320 dp with 130% system text (183 dp tall with readable wrapped text). Week displayed the empty card and All time showed the saved practice in all four configurations. Standard light also verified Month empty, tapping the card body to open the saved practice, and Android Back. [Narrow Android capture](../work/journey-latest-activity-android/narrow-large-dark.png)
- TypeScript, formatting, Android release lint, 22 progress tests, 14 navigation tests, 74 session-state tests and 116 backend tests passed. Production web and iOS JavaScript exports passed. Native iOS layout and Dynamic Type still need device or simulator testing.

The implementation is in `src/screens/Journey.tsx` and `src/journey-analytics.ts`, with regressions in `scripts/test-progress.cjs`. The behavior is documented in `README.md` and `docs/REQUIREMENTS.md`.

## Today Explore More card layout — 7 November 2026

- Production browser checks at 320 and 430 pixels measured equal 144-pixel upper cards, a 116-pixel Check-Ins card, and 12-pixel horizontal and vertical gaps in both themes. At 320 pixels with simulated 140% text, the upper row grew to 181 pixels and Check-Ins to 127 pixels with no text clipping or horizontal overflow. The cards kept their two-plus-one layout.
- Pointer taps near the card corners opened Guided Programs, Wellness Toolkit, and Check-Ins. Back returned to Today from each destination. Daily Pause kept its height, width, padding, styling, and 24-pixel separation from the preceding card in all six browser comparisons. [Browser evidence](../work/today-explore-more-qa/browser-result.json)
- The Android API 33 Pixel 3a emulator measured 144, 144, and 116 dp at its standard 393 dp width and approximately 174, 174, and 123 dp at 320 dp with 130% system text. Both themes matched at each width, including the 12 dp gaps. All three card bodies opened their original destinations and Android Back returned to Today.
- TypeScript, Prettier, Android release lint, 16 routine tests, 14 navigation tests, 116 backend tests, and the production web and iOS JavaScript exports passed. Native iOS layout and Dynamic Type still need an iPhone or simulator.

## Automatic biometric unlock — 7 November 2026

- Solace shows its privacy cover and starts one native biometric attempt when an enrolled device requires an app lock. The provider tests cover cold launch, iOS-style inactive/active events, repeated renders and tab changes, short and long background trips, cancellation, failed proof, manual retry, logout and account switching. A separate Journal lock remains manual.
- Successful device proof still requires an active server session for the same account before Solace displays protected screens. Tests cover expired cold and warm sessions, cross-account proof and token mismatch, missing enrollment, and enrollment lost during a prompt. A temporary session-check failure kept Solace locked and a successful manual retry after recovery restored the prior route.
- Rendered light and dark fallback tests verify the existing title, retry when available, and sign-in recovery. The neutral privacy surface has no unlock actions. The enrollment-bound proof keeps its existing recovery through normal Solace sign-in.
- TypeScript, formatting, 74 session-state tests, 14 navigation and rendered UI tests, eight native-configuration tests, and 116 backend tests passed. Production Expo exports passed for web, Android and iOS. Android ARM64 release assembly, release lint, signature verification, and the embedded bundle check passed with a reserved QA API address.
- Physical-device acceptance still needs an enrolled iPhone and Android phone. With app lock set to Immediately and then one minute, open a detail screen, background for less and more than the threshold, and confirm the app either stays open or prompts once and restores the detail. Cold-launch again, cancel the prompt, retry, and check the app switcher for protected content. Repeat after an enrollment change and with a revoked session. The iOS native build and Face ID/Touch ID behavior need Xcode and a device.

## Wellness Tools and Timed Practice — 7 November 2026

The two bottom Explore accordions were the baseline. Their links and the original practice picker were mapped before replacement. Production browser comparisons at widths of 320 and 430 pixels in both themes found identical geometry and styles for the Explore sections above the replacement cards. At 430 pixels and standard text size, the new cards measured 140 pixels tall with a 16-pixel gap. Both sides of each card used the same navigation action.

| Wellness Tools item | Existing destination |
| --- | --- |
| Browse all practices | Explore’s complete, searchable practice catalog |
| Ambient Sound Mixer | Ambient mixer with the existing sound layers |
| Solace Moments | Moment creation |
| Gentle Movement | Three-minute guided movement in the Moment player |
| Guides & Resources | Existing wellness resource guides |
| Sleep Wind-Down Guide | Existing four-step self-paced guide |
| Five-Senses Exercise | Self-paced grounding |
| Reflective Check-Ins | Mood, worry, and self-compassion questionnaires |
| Daily Affirmation | Today’s affirmation |
| Daily Challenge | Today’s challenge |
| Breathing Exercise | Slow breathing technique detail and player |
| Gratitude Journal | Existing Journal editor with an optional prompt |
| Mood Check-in | Daily mood check-in |

| Timed focus | Existing player mode |
| --- | --- |
| Calm | Paced breathing with natural breathing breaks |
| Focus | Sensory grounding |
| Sleep | Quiet rest and wind-down |
| Energy | Gentle seated movement with rest intervals |

- The production browser opened all 13 tools, including the Browse shortcut and the gratitude prompt. Back restored the selected filter and scroll position, and the existing editor retained an unsaved draft. The library rendered all five groups once. Relax, Move, and Grow displayed their relevant groups.
- All 16 builder configurations opened the existing Moment player with exact durations. Calm at five minutes used `1:00`, `2:30`, and `1:30`. The builder restored the selected focus and duration on Back. Longer sessions vary their stages and include breaks where appropriate.
- A browser test clock advanced the existing player through a complete five-minute session. Paused time and a simulated background gap did not accrue. Exit before completion saved zero records. An injected 503 followed by rapid retry made two requests and saved one 300-second record with feedback. Journey immediately showed the new activity, and the completion screen’s return action restored the builder choices.
- At 320 pixels with simulated 140% text, both pages had no horizontal overflow and the final tool and Start Practice remained reachable. The browser also opened the mixer and player with their artwork requests returning 404s.
- On the Android API 33 emulator at 393 dp in dark mode, Move filtered to Gentle Movement and system Back restored the library filter and Explore position. A 20-minute Sleep session opened, paused, resumed, and paused again when backgrounded. Leaving without saving returned to the builder with Sleep and 20 minutes selected. At 320 dp with 130% system text, the last tool and Start Practice both scrolled fully clear of the navigation overlay.
- TypeScript and formatting passed. Navigation passed 12 tests, session state passed 65, Moments passed 15, and the backend passed 116. The backend tests cover account isolation and idempotent 20-minute persistence through the existing Journey data pipeline. Android release lint and production Expo web, Android, and iOS JavaScript exports passed.
- The API should be updated before distributing the updated client so it accepts the registered 15- and 20-minute session snapshots. Installed builds need the updated JavaScript bundle. No native modules or signing configuration were changed.
- Native iOS and physical-device checks remain open. On iPhone, open each entry, follow a tool and use swipe-back, check reachability with larger text, then complete and save a timed practice against the updated API. Repeat the save on a physical Android phone.

| Production web screenshots | Light | Dark |
| --- | --- | --- |
| Wellness Tools header and first groups | [Light](screenshots/wellness-tools-timed-practice/wellness-tools-light-430.png) | [Dark](screenshots/wellness-tools-timed-practice/wellness-tools-dark-430.png) |
| Wellness Tools lower groups | [Light](screenshots/wellness-tools-timed-practice/wellness-tools-lower-light-430.png) | [Dark](screenshots/wellness-tools-timed-practice/wellness-tools-lower-dark-430.png) |
| Timed Practice from header to Start Practice | [Light](screenshots/wellness-tools-timed-practice/timed-practice-full-light-430.png) | [Dark](screenshots/wellness-tools-timed-practice/timed-practice-full-dark-430.png) |

Implementation files are `App.tsx`, `src/routes.ts`, `src/screens/Explore.tsx`, `src/screens/ExploreFeatureHeader.tsx`, `src/screens/WellnessTools.tsx`, `src/wellness-tools.ts`, `src/screens/TimedPractice.tsx`, `src/screens/Moments.tsx`, `src/moments.ts`, `server/src/timed-practice-contract.ts`, and `server/src/validation.ts`. Test coverage is in `scripts/test-navigation.cjs`, `scripts/test-moments.cjs`, and `server/tests/timed-practice.test.ts`. Product notes are in `README.md`, `DESIGN.md`, and `docs/REQUIREMENTS.md`.

## Appearance and preferences cleanup — 7 November 2026

- The production web preview verified that Appearance & preferences no longer lists memories, reminders, privacy or About. The 320- and 430-pixel layouts matched in light and dark, with no horizontal overflow. At 430 pixels, the settings fit in one viewport.
- All four links opened their existing destinations from Profile and returned with one Back. Light, Dark and System controls worked. The sound and accessibility guidance and its Solace Moments link remained available. Opt-in and opt-out made one successful account update each. Dark appearance and the saved consent state survived reload, and the saved memory remained present after opt-out.
- The Android API 33 emulator opened all four Profile links and used system Back from each. Light and Dark appearance, the Solace Moments link, both directions of the approved-preferences switch, and Back from Settings passed on the emulator.
- TypeScript, Prettier, Android release lint, web and iOS production exports, 10 navigation tests, and 114 backend tests passed. Native iOS navigation and swipe-back remain unverified.

## Explore recommendations and destination cards — 7 November 2026

- The production web preview rendered four 74-pixel rows at 320 in light and dark mode, and four equal cards per grid at 370, 390, 408, 410, and 430 pixels. The 370- and 390-pixel grids reserved two lines for titles. The 408-, 410-, and 430-pixel grids measured 117 pixels per card. Explore More measured three 63-pixel horizontal rows with 12-pixel gaps. Text at 140% wrapped without clipping.
- The browser verified all seven existing destinations, including 3:00 for Breath Reset, 5:00 for Five Senses grounding, and 10:00 for Sleep Wind Down. One Back restored the exact scroll position after ordinary and rapid same-spot taps. The touch guard also passed with Reduce Motion. Four simulated image 404s showed activity icons in the reserved artwork areas, and an authenticated reload retained access to the cards.
- The Android API 33 emulator opened all seven destinations and returned to Explore with one system Back per card. The 320 dp light layout reflowed to single-column recommendations at 130% system text after a cold restart. The final 393 dp dark grid showed four equal 117 dp cards with the crescent and notebook visible in their artwork.
- TypeScript, Prettier, Android release lint, the web and iOS production JavaScript exports, 8 navigation tests, 65 session-state tests, and 114 backend tests passed. Native iPhone layout and swipe-back remain unverified.

## Journey Habit Progress card — 7 November 2026

- The production web preview matched Your Goal’s surface, border, and radius. The card measured 173 pixels at 320 in both themes (previously 212) and 156 at 430 in dark mode (previously 189). Both metrics and the Garden status remained readable at 140% rendered text.
- With persisted weekday and flexible schedules, the browser showed 5 actions and 80% for Week, 5 and 67% for Month, 11 and 83% for All time, and 3 and 75% for the previous week. Period changes made no API requests. The full card opened Habit Insights and Back restored Journey’s scroll position.
- A Today completion made one write and updated the weekly card to 6 actions and 100%. Garden changed from Growing plant to Blooming flower. Reopening the browser and SQLite restored the selected All time period, the updated totals, and the earned Garden stage. Separate empty accounts distinguished zero completed goals from a period without scheduled goals.
- The Android API 33 emulator rendered the saved Month summary at 320 dp in light mode with 130% system text. After a cold restart, the 393 dp dark layout restored Month, one completed action, 50% of scheduled goals met, and Sprout. The card opened Habit Insights and Android system Back returned to Journey.
- TypeScript, Prettier, Android release lint, the web and iOS production JavaScript exports, 65 session-state tests, 20 progress tests, and 114 backend tests passed. Native iOS layout remains unverified.

## Explore wellness feature cards — 7 November 2026

- The production web preview showed the shared cards between Featured Moment and Recommended for You. They measured 74 pixels each at 320 in light and dark and 82 each at 430 in dark, with a 12-pixel gap. At 140% rendered text both cards expanded without horizontal overflow or clipping.
- Browser taps on the artwork and right side of each card opened Guided Techniques and the Habits Dashboard. A rapid second tap initially reached a destination control during navigation. The scoped arrival guard passed the same-spot double-tap retest with normal motion and Reduce Motion. One Back restored the exact Explore scroll position, the open disclosure, and the selected Breathe filter when returning from the catalog.
- On the Android API 33 emulator, both cards expanded to about 143 dp with a 12 dp gap at 320 dp and 130% system text. Double taps opened each destination, and one hardware Back restored the Explore scroll position. A separate dark-mode pass verified the pair at 393 dp.
- TypeScript, Prettier, Android release lint, the web and iOS production JavaScript exports, 7 navigation tests, 64 session-state tests, and 114 backend tests passed. Native iOS layout and swipe-back remain unverified.

## Floating Companion composer — 7 November 2026

- The production web preview showed four individually tinted controls over the conversation at 320 × 640 in light mode and 390 × 844 in dark mode. The title was centered, the root Back button was absent, and the Journal handoff retained its Back destination. At 140% rendered text the composer stayed within the viewport.
- The browser verified multiline growth from 48 to 132 pixels, internal scrolling, one saved turn after rapid Send presses, failed-draft retry, Add actions, tab and conversation restoration, and access to the last suggestion. Browser keyboard coverage used a simulated viewport change. Voice coverage used synthetic audio and a local transcription fixture.
- The Android API 33 emulator exposed an edge-to-edge keyboard overlap. Frame-based keyboard avoidance kept the composer above the real keyboard on retest, hid the tab bar, and kept the multiline input capped at 132 logical units. Add dismissed the keyboard and opened the actions menu. A multiline message saved once, its suggestion opened, and Android Back and tab switching returned to the same conversation.
- The Android emulator handled microphone permission denial, then recorded and uploaded audio to an isolated transcription fixture after permission was granted. Using the reviewed transcript populated the draft without sending it. The web and Android runs used a local provider fixture for chat replies.
- The 320-unit Android light layout at 130% system text retained the centered title, floating controls, and overflow menu. Conversation history opened from the menu and Android Back returned to Companion. The visible New chat shortcut uses a shorter label on narrow screens and at larger text sizes. A separate dark-mode emulator pass verified the header and four floating controls.
- TypeScript, Prettier, Android release lint, iOS and web production JavaScript exports, 98 client tests, and 114 backend tests passed. Physical-device checks and native iOS keyboard, safe-area, and gesture checks remain pending.

## Today Explore More and Daily Pause — 7 November 2026

- Production web checks at 320 × 640 in dark mode and 430 × 932 in light mode verified the two tiles above Check-ins, a connected three-step row, and a full-width Daily Pause action. At 320 pixels, the Explore group went from 252 to 147 pixels tall and the Daily Pause card from 289 to 198. At 140% rendered text, the narrow web preview showed no clipping or horizontal overflow.
- The browser opened all three Explore destinations and returned to Today. Each Daily Pause action saved one record through the test API. Partial and full completion survived reloads, and the saved activity, duration, skip and enabled choices changed the next step as expected. The isolated browser test accelerated the Moment timer.
- The Android API 33 emulator passed Customize, next-step navigation and Android Back in the default-text dark layout and the light 320-unit layout at 130% system text. The narrow layout stacked the Explore cards, kept the Daily Pause markers aligned, and let the expanded Customize controls scroll above the tab bar. Native iPhone verification remains pending.
- TypeScript, Prettier, Android release lint, the iOS JavaScript export, and 114 backend tests passed. The 42 routine, navigation, Moment, and wellness tests passed, including a rendered Today check and one preference write after two rapid Customize save presses.

## Today’s Habits card — 7 November 2026

- Production web checks at 390 × 844 in dark mode and 320 × 568 in light mode found 24 logical units between Your Journey and Today’s Habits, matching surfaces and borders, and action heights of at least 48 units. The one-row card measured 115 units, down from 224. Long habit names wrapped at the compact width.
- The browser checks covered empty and unscheduled states, the three-row preview, header and row navigation, and saved completion and undo in Today, the Habits Dashboard, and Journey. The completed row remained available for undo with four scheduled habits.
- The Android API 33 emulator rendered the card in light and dark mode. Done and Undo updated the count in Today and the Habits Dashboard, and Android Back returned to the card. Native iOS appearance was not checked.
- TypeScript, formatting, Android release lint, 63 session and component tests, and 114 backend tests passed.

## Physical Android staging release — 7 November 2026

- Built the ARM64 Android release APK with the staging HTTPS API. Gradle assembly and release lint passed. Verified the APK signature, the embedded JavaScript bundle, and the staging API origin. The package installed on a physical Xiaomi 2312FRAFDI running Android 15 and cold-started with Metro stopped.
- Skipped onboarding and opened the Google sign-in browser. Cancelling returned to the signed-out app. Google account consent and the successful return from Google are deferred. Android resolves the Solace callback to the installed app.
- Signed in with a disposable staging account and opened Today, Solace, Journal, Explore, Journey, and Profile. Logged a habit completion from Today. After a cold restart the session restored and the Habits dashboard still showed the completion. Left the phone on Today with the disposable account signed in.
- The APK uses local test signing and a temporary HTTPS staging origin. This pass covers the physical Android smoke test.

## Solace Habits — 7 November 2026

[Habits, Companion, garden, schedule and device checks](HABITS_QA.md).

## First-launch walkthrough — 7 November 2026

[Onboarding, authentication, personalization and replay verification](ONBOARDING_QA.md).

## Gesture navigation pass — 7 November 2026

[Gesture, route, profiler and build results](NAVIGATION_GESTURES_QA.md). The [physical navigation checklist](PHYSICAL_DEVICE_QA_CHECKLIST.md#gesture-navigation-and-nested-transitions) covers both Android system navigation modes and iOS leading-edge Back and Liquid Glass.

## Performance and motion pass — 7 November 2026

[Emulator measurements, browser regressions and build results](PERFORMANCE_OPTIMIZATION_REPORT.md). The [physical Android and iPhone checklist](PHYSICAL_DEVICE_QA_CHECKLIST.md) covers native frame pacing, audio, keyboard, navigation and release memory.

## Companion, Journal and Guided Techniques

The [connected QA report](COMPANION_JOURNAL_TECHNIQUES.md) records navigation and persistence checks, live Gemini requests, rendered phone layouts, device checks and outstanding release gates.

The [finishing pass](COMPANION_JOURNAL_TECHNIQUES.md#finishing-pass) covers the compact chooser, keyboard navigation, Voice Talk reply placement, filtered Journal saves, excerpt consent and guided player controls.

The [everyday flow upgrades](COMPANION_JOURNAL_TECHNIQUES.md#everyday-flow-upgrades) cover direct Companion actions, visible Journal save status, guided pacing and the Latest activity link in Journey.

## Premium feature expansion — 6 November 2026

[Feature checklist, build checks and synthetic QA evidence](PREMIUM_EXPANSION.md). The browser completed a live Gemini chat-to-Moment journey, voice recording and playback, Daily Pause, weekly story edits, simultaneous ambient playback and a real milestone reveal. Native iOS signing and device acceptance are tracked in the checklist.

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

## Check-in next steps — 7 November 2026

| Status | Scenario | Observed result |
|---|---|---|
| Fixed and retested | Today → Low → Save → Try a short reset | In Chromium at 320 × 640, the confirmation offered Five-senses grounding and explained the recommendation. Paused, resumed, advanced all five steps and saved “Helped”. Journey opened the exact completion with two active seconds and retained it after reload. |
| Fixed and retested | Today → Stressed → Save → Try a short reset → Back | Opened the three-minute Slow breathing player. Back restored the same saved check-in confirmation. Leaving before starting produced zero completions. |
| Fixed and retested | Save and practice with the browser offline | The check-in reported “Kept in this tab” and the session save reported an unconfirmed state. The test server had zero records until reconnect. Reconnect synced one check-in and a manual retry saved one completion with its original duration and feedback. |
| Fixed and retested | Talk about this → Review → Companion → Send | At 320 × 640 dark and 390 × 844 light, the preview showed the mood and left the note off by default. Opt-in showed the exact note and cancelling reset the selection. Opening or editing the draft sent zero AI requests. One explicit Send posted the edited mood-only message and received a live Gemini reply. Opening an existing draft kept it intact, and the separate append action kept existing text and added only the approved check-in content. |

The previous success screen sent users back to Today to find another action. The confirmation now opens a registered technique and uses the saved record ID for the return path. Companion receives only an editable draft after review. Journal, memory consent, and the existing activity completion pipeline use their existing contracts.

**Android native smoke.** On the Pixel 3a API 33 emulator, the debug app loaded the updated bundle from Metro. A disposable account logged in and saved a Low check-in. After dismissing the first-check-in milestone, the reset opened the grounding player. Android Back restored the confirmation. The optional note appeared only when selected, and the native Companion composer contained the mood-only draft before Send.

Client TypeScript and Prettier passed. Server integration passed 92/92, session state 47/47, Journey progress 20/20, Moment clock 11/11 and wellness 7/7. Expo production exports succeeded for web, Android and iOS. The isolated Android release built with `assembleRelease` and `lintVitalRelease`, and the APK contains `assets/index.android.bundle`. The release installed and cold-launched to Welcome on the emulator. It used a reserved HTTPS host for packaging verification. Use the configured test API for a signed-device run.

**Blocked on physical devices.** No physical handset was detected and this Windows host cannot sign or run the iOS app. On a connected test phone with the current build and a test API, save a Low check-in with a synthetic note. Open the reset and return using the device’s back navigation. Open the review, toggle the note and confirm that only the chosen text reaches the editable draft. Repeat in both themes with larger text.

[Light confirmation](screenshots/checkin-next-step-light.png) · [Dark Companion review](screenshots/checkin-companion-review-dark.png)

## Android layout sizing — 7 November 2026

- **Fixed and retested.** At 393 dp wide and 1.17× system text in dark mode, open Today and inspect “How are you feeling today?” The previous tile-width heuristic split the picker into rows of three and two, with 64 dp tall tiles. After compacting Android gutters and tile padding, the same emulator shows five equal tiles in one row, approximately 64 × 56 dp each. The featured card and quick actions are shorter, and Journey is visible above the tab bar.
- **Fixed and retested.** At 320 dp and 1.4× system text in light mode, the five tiles measured approximately 52 × 58 dp and retained their full labels. Tapping Stressed opened the check-in with Stressed selected. Android Back returned to Today. The tab rail fit all five labels on one line, including Explore and Journey. Only these short labels fit to their available widths. The rest of the screen still follows Android text scaling.
- **Native smoke.** Used the Pixel 3a API 33 emulator at 440 dpi and the isolated debug app with a disposable account. Opened all five main tabs at 320 dp and 1.4×. Visually checked Explore’s tiles, Journey’s metrics and Profile’s rows, which expand for longer labels. Restored the emulator’s original display settings. A physical Android handset was unavailable. The new layout values apply only to Android.
- **Checks.** TypeScript, Prettier, 92 server integration tests and the web, Android and iOS production exports passed. The isolated Android APK passed `assembleRelease` and `lintVitalRelease`, then installed and cold-launched to Welcome on the emulator. It uses a reserved HTTPS origin for build QA.

[Android before](screenshots/ui-repair/android-sizing-before-today.png) · [Android after](screenshots/ui-repair/android-sizing-after-today.png) · [320 dp with larger text](screenshots/ui-repair/android-sizing-narrow-light.png)

## Google sign-in and Biometric Lock — 7 November 2026

| Area | Status | Evidence |
|---|---|---|
| Google login, signup and linking | Implemented but awaiting external configuration | Signed synthetic ID-token fixtures covered bad signature, issuer, audience, expiration and nonce, invalid and missing browser handoff, forwarded links, replay, cancellation, a provider failure, returning subjects, email conflicts, account linking, revoked sessions, deletion and isolation. Client tests covered verifier generation, exact callback parsing, aborted flows and completing a link after unlocking the same account. No personal Google account or live OAuth client was used. |
| Email/password and existing session | Implemented and verified | At 320 × 640 in Chromium light and dark, the Google action showed its unavailable state. Disposable email signup, reload, logout and returning login worked. A saved mood check-in launched the existing grounding player, completed once and reopened from Journey with its feedback. Native Android opened Welcome and Login with no biometric sign-in action on a fresh account. |
| Password recovery | Implemented but awaiting external configuration | The recovery screen carried the login email and reported missing SMTP without losing the draft. The mail fixture covered the same accepted response for known and unknown emails, resend throttling, hashed codes, expired and reused codes, changing the password and revoking old sessions. Live email delivery needs a configured SMTP provider. |
| Biometric Lock and Journal | Implemented but not fully verified | Provider tests covered unavailable hardware, no enrollment, opt-in and removal, cancel and enrollment invalidation, background timing, rapid transitions, lock recovery, protected draft checkpointing, cross-owner protection and Journal masking. Expo config introspection showed the Face ID usage description and Android biometric permissions. The Pixel 3a API 33 emulator showed no-enrollment guidance, then showed both switches and the native prompt after enrolling a test fingerprint. Cancelling kept the setting off. The fingerprint HAL accepted a match, but KeyMint rejected the protected write with `KEY_USER_NOT_AUTHENTICATED` (−26). Successful native activation and unlock, native app-switcher snapshots and Face ID/Touch ID still need physical-device verification. The enrollment-bound key uses normal Solace sign-in for recovery. |

TypeScript and Prettier passed. Client checks passed for Google flow (9), session state (57), native configuration (8), offline drafts (10), voice (21), reminders (8), Journey (20), Moments (11) and wellness (7). The backend suite passed 103 tests. Android Gradle debug and release builds and release lint succeeded. The isolated release APK contains its Hermes bundle, installed and cold-launched to Welcome on the emulator using a reserved API origin for package QA. Expo exported web, Android and iOS JavaScript bundles. Device and provider setup steps are in [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md).

## Realtime Voice Companion

### Implementation

- The Companion microphone and Voice Talk menu action open an audio-only WebRTC call. The chat menu retains recorded messages and edited transcripts. Live Voice Talk keeps the existing screen, lotus and themes. The lotus follows server-reported speech, thinking and playback events.
- The authenticated API exposes `POST /api/voice/realtime`, `POST /api/voice/realtime/:id/status` and `POST /api/voice/realtime/:id/end`. It negotiates SDP with OpenAI and controls the call through its own sideband WebSocket. The client receives SDP and Solace session state. An early sideband transport failure gets one retry on the same call within the original connection deadline.
- The default model is `gpt-realtime-2.1-mini` with the built-in `marin` voice. The OpenAI key and model settings stay in `server/.env`. SQLite records lease state, user usage and the service-wide reservation. Defaults are 5 minutes per session, 15 minutes per account per UTC day, 60 minutes per UTC day service-wide and one concurrent call per account. The app ends capture when it loses focus or leaves Voice Talk. The server also expires idle leases after 20 seconds without an authenticated heartbeat and attempts explicit provider hangup.
- User speech transcripts are written to the existing owner-scoped conversation. A fully played assistant turn is saved once. Interrupted assistant turns are omitted. Explicit urgent transcripts use Solace's local support guidance and close live voice. Existing approved preferences are bounded and checked for changes. Live voice excludes prior Journal discussion context and does not store microphone recordings.

### Local verification

- A live OpenAI transport test used a short synthetic voice sample and a disposable browser session. The configured key accessed the mini model, accepted audio-only SDP, attached the server sideband, produced a user transcript and remote audio, and accepted explicit hangup. The safety gate prevented generation before the server authorized the response.
- The configured project returned HTTP 200 for the optional `gpt-realtime-2.1` model lookup. Live audio tests used the mini model.
- The assembled browser app connected in an existing disposable conversation. Muting disabled the microphone track and unmuting restored it. Two synthetic turns went through Listening → Thinking → Speaking → Listening and both user and assistant transcripts were saved in the same conversation. Tapping End stopped the microphone and peer, returned to chat and got an HTTP 200 hangup from OpenAI. Reopening the conversation restored its transcripts and a second account could not access them.
- A separate live run verified interruption. Incoming speech cleared unfinished playback, the interrupted reply was omitted from history, and the next reply was saved. A simulated browser visibility change stopped the actual peer and microphone and received a provider hangup. A permission-denial fixture displayed microphone guidance before any provider request.
- Automated coverage includes the authenticated routes, cross-account isolation, duplicate starts, quota accounting, restart recovery, heartbeat expiry, ordered transcripts, interrupted output, safety guidance and missing provider configuration.
- Verified checks included 148 backend tests, 24 voice tests, 80 client session tests, 21 navigation tests, 12 native configuration tests, TypeScript and Prettier.
- Production Expo exports for Web, Android and iOS were generated with a placeholder HTTPS Solace API. A byte scan found no configured OpenAI key or direct OpenAI Realtime endpoint in any of the three client bundles.
- Android `:app:assembleRelease` and `:app:lintVitalRelease` passed for the isolated, minified x86_64 QA package. Expo's additive prebuild applies two WebRTC-specific R8 rules. One suppresses the missing optional AV1 decoder interface referenced only by its orphaned JNI wrapper. The other retains the `org.jni_zero.JniZero` class and its `init(boolean)` entry point, which the native library looks up by name. R8 removed the class from the first minified APK and the app aborted on startup. The final minified DEX contains the entry point, and the signed QA APK opened the welcome screen on the Android emulator. The APK included the Hermes bundle and x86_64 WebRTC library. The production app identifier and signing selection are unchanged.

### Native verification checklist

1. Build a new binary with the repository's Android or iOS native command and configure a reachable HTTPS Solace API. For a valid existing iOS project, use `node scripts/runtime.cjs expo prebuild --platform ios --no-install --no-clean` on a Mac and rebuild with the existing signing profile. The emulator APK uses a placeholder HTTPS endpoint and covered startup only.
2. Use a disposable account. Open an existing conversation, start live voice, grant the microphone and speak at least two turns. Verify natural replies, state changes and correct audio at the speaker and on wired or Bluetooth headphones.
3. Interrupt a spoken response, mute and unmute, then end. Confirm playback and the OS microphone indicator stop immediately. Reopen the conversation and verify available transcripts and that the interrupted reply was omitted.
4. Repeat with permission denied, airplane mode, app backgrounding, a phone call and an audio-route change. Confirm clear status and text fallback. Return to Voice Talk and ensure the app waits for a new start.
5. Verify the short test session limit and daily quota with a disposable configuration. Restore normal limits afterwards. Native audio routing and interruption behavior require physical-device verification.

### Files changed for Realtime Voice

- App and transport files include `src/screens/Core.tsx`, `src/screens/VoiceTalk.tsx`, `src/store.tsx`, `src/useRealtimeVoice.ts`, `src/realtime-voice-state.ts`, `src/realtime-rtc.ts`, `src/realtime-rtc.web.ts` and `src/realtime-rtc-core.ts`.
- Backend changes are in `server/src/realtime.ts`, `server/src/realtime-provider.ts`, `server/src/app.ts`, `server/src/ai.ts`, `server/src/config.ts`, `server/src/database.ts`, `server/src/index.ts` and `server/.env.example`.
- Native build and package changes are in `app.json`, `package.json`, `package-lock.json`, `scripts/build-android.ps1` and `scripts/with-realtime-android.cjs`.
- Tests were added or updated in `server/tests/realtime.test.ts`, `server/tests/realtime-provider.test.ts`, `server/tests/realtime-routes.test.ts`, `server/tests/startup.test.ts`, `scripts/test-voice.cjs`, `scripts/test-session-state.cjs` and `scripts/test-native-config.cjs`.
- Documentation is in `README.md`, `docs/REQUIREMENTS.md` and `docs/VERIFICATION.md`.

### Private Android release handoff

- The old temporary HTTPS staging hostname had expired. The updated API was started over TLS on Windows loopback with a fresh QA SQLite database. The private certificate is scoped to the USB QA APK, and the existing public HTTPS requirement remains the default for standard releases.
- The TLS smoke test verified email/password signup and login, authenticated Realtime capabilities, live SDP negotiation, incoming voice audio, transcript persistence, explicit hangup and disposal of the test account. TypeScript, 12 API configuration tests, 148 backend tests and the web export passed.
- ADB detected the physical ARM64 Xiaomi and verified `tcp:3164` forwarding over USB. [Setup and device steps](RELEASE.md#android-realtime-usb-qa)
- The minified ARM64 `Solace USB QA` APK passed release assembly, native lint, signature and alignment checks. It contains the Hermes bundle, ARM64 WebRTC library and loopback-scoped TLS certificate. The APK installed under its separate app ID and cold-launched on the physical Xiaomi. The API remained healthy after launch. Live microphone testing on the phone remains pending.

### Android microphone permission interruption

- Android can report a temporary system activity as backgrounded. Voice Talk used to cancel during the microphone permission prompt. The corrected native adapter waits for the app to resume before it opens the microphone, and Voice Talk exempts only the explicit permission phase from interruption handling. Genuine backgrounding still cancels the call. [React Native AppState](https://reactnative.dev/docs/appstate)
- TypeScript, formatting, 25 voice tests and four native permission tests passed. The corrected minified ARM64 USB APK passed release assembly, native lint, signature and alignment checks. The existing private HTTPS API stayed healthy.
- The corrected APK installed over the existing QA package and cold-launched on the physical Xiaomi. The USB forward was verified. Microphone retesting on the phone remains pending.
- Automatic approval review blocked the proposed public Cloudflare Quick Tunnel. The current APK continues to use the private USB route. [Android USB setup](RELEASE.md#android-realtime-usb-qa)

### Companion and Live Voice interface

- The attached full-screen lotus image was the Live Voice target. The other attachment showed the prior Companion screen. The new layout reframes the existing lotus, lake and breathing-ring assets. [Visual QA and viewport coverage](../design-qa.md#companion-and-live-voice--7-november-2026)
- The final Expo web export passed 13 layout checks and nine interaction scenarios in Chrome. The tests used a disposable account and fixture transcription and Realtime status. Verified behaviors include the overflow order, text persistence, editable transcription, retained drafts, real synthetic WebRTC track mute and release, elapsed time, narrow and enlarged layouts, and support and error recovery.
- A separate real OpenAI run used synthetic microphone audio. It received spoken output, persisted the turn, reopened the transcript, and closed the microphone, peer and provider call from End. Another live run confirmed that speaking cleared assistant audio. Its follow-up provider response was incomplete, so that run did not verify continuation through a completed reply.
- TypeScript, Prettier, 28 voice tests, 21 navigation tests, 80 session tests, 12 native configuration tests and 148 backend tests passed. The backend suite passed on rerun after a process-startup timeout during concurrent builds. Expo exported web and iOS bundles. The final minified Android x86_64 release passed lint and cold-launched to Welcome on the emulator with a reserved QA API address.
- Native Speaker applies a built-in output preference through Expo Audio. Hardware routing, Bluetooth, iOS runtime and live voice on a physical handset remain unverified. The browser shows its system-managed audio route as read-only.
- Interface changes are in `src/screens/Core.tsx`, `src/ChatComposer.tsx`, `src/VoiceControlsImpl.tsx`, `src/screens/VoiceTalk.tsx` and `src/screens/VoiceTalkArtwork.tsx`. Session and meter wiring is in `src/useRealtimeVoice.ts`, `src/realtime-rtc-core.ts`, `src/realtime-rtc.ts` and `src/realtime-rtc.web.ts`. Regression checks are in `scripts/test-voice.cjs` and `scripts/test-native-config.cjs`.

### Voice Companion dusk and dawn redesign

- The previous layout put an oversized lotus and a separate ring inside a short image crop. The new full-height artwork frames the centered lotus and thin halo against the same mountain and lake composition in both themes. Back and menu use a 34 dp circle within a 48 dp target. The side controls align with the End button, which now uses a hang-up icon. [Artwork provenance](../assets/ARTWORK.md#voice-companion-dusk-and-dawn)
- Five Chrome scenarios passed against the production Expo web export. The dark and light layouts fit at 393 × 853 with simulated 42 dp top and 30 dp bottom insets and at 320 × 568. The 320 × 480 layout with 1.65× CSS text could scroll to End and the status capsule without horizontal overflow. [Dark preview](../work/voice-reference-qa/393x853-dark-listening.png) · [Light preview](../work/voice-reference-qa/393x853-light-listening.png) · [Browser results](../work/voice-reference-qa/final-reference-result.json)
- The browser fixture exercised actual WebRTC tracks with synthetic audio. The waveform responded to microphone and assistant audio, elapsed time advanced, Mute changed the outgoing track, and End released media and returned to Companion. This pass covered the UI and media lifecycle using the fixture. Live provider and native speaker or Bluetooth routing remain separate checks.
- TypeScript and Prettier passed, along with 28 voice, 21 navigation, 12 native configuration, and 148 backend tests. The backend suite required local loopback access for its fixtures. The production iOS JavaScript export included both artwork files. Xcode and physical-device rendering are pending.
- The isolated Android release checkpoint passed Kotlin and Java compilation, R8 and `lintVitalRelease`. A final bundle run verified both current screen sources and byte-identical artwork in the release resources. Android device verification requires an updated APK. [Android bundle evidence](../work/voice-talk-artwork-native/android-release-bundle-evidence.json)

### Azure hosted demo

- Azure App Service runs the Expo web build and Node API on one HTTPS origin. The Central India Linux plan reports Free F1 and runs Node 24. App Service installs server dependencies from the lockfile. The deployment package excludes local databases and environment files. [Hosted Solace](https://solace-demo-240e1d22-d2e6b3cahbheh2ed.centralindia-01.azurewebsites.net)
- The demo starts with a fresh database at `/home/data/solace-demo.sqlite`, outside the deployment directory. OpenAI and Google OAuth credentials are managed in server-side App Service settings. The existing Google QA client uses the new exact Azure callback. The public web preview uses email and password, and the Google browser handoff belongs to the installed mobile app.
- The local package rehearsal passed web and API requests, audio byte ranges, signup and login, separate account sessions, and persistence across a process restart. The public HTTPS health check returned HTTP 200 after the ZIP deployment.
- The public browser rendered the Solace onboarding screen. Hosted smoke checks passed signup and login for two disposable accounts, separate account sessions, audio byte ranges, and deletion with session revocation. The package scan found neither configured provider secret. Google OAuth configuration returned `enabled: true` and redirected an authorization challenge to Google with PKCE and the exact Azure callback. A physical Google sign-in is still pending.
- A synthetic OpenAI text request returned a live reply and saved it. A Chrome WebRTC session using synthetic microphone audio received actual provider audio, saved both transcripts, and disconnected after hangup. The test account was deleted and its session was revoked. [Sanitized provider results](../work/managed-stage/smoke-azure-provider-result.json)
- The signed ARM64 Android release embeds the Azure HTTPS origin and uses Android's standard TLS trust. Release assembly, minification, `lintVitalRelease`, signature and 16 KB ZIP alignment checks passed. The package uses the existing local release test signer. Physical Android installation, Google sign-in and microphone behavior remain to be tested. [APK](../outputs/Solace-Android-Azure-arm64.apk) · [Build evidence](../work/azure-arm64-release/artifact-check.json)

### Azure iPhone build preparation

- Expo native configuration, TypeScript and local reminder tests passed. The iOS notification plugin omits the remote push entitlement so the Personal Team can sign an app that schedules local reminders. The production iOS Hermes export contains the live Azure endpoint. The configured OpenAI key was absent in the bundle scan, and the Azure health endpoint returned HTTP 200.
- The source archive includes the native build script and the shared modules imported from `server/src`. The package inspection found no environment files, databases, signing certificates or provisioning profiles. [Mac build instructions](RELEASE.md#install-the-azure-demo-on-a-personal-iphone) · [iOS build archive](../outputs/Solace-iOS-Azure-Build.zip)
- Xcode 27.2 built the Release target for a USB-connected iPhone running iOS 27.2. The remote session generated the project and installed CocoaPods with a UTF-8 locale. Signing completed in the local Mac session after the SSH session could not access the development key. The updated launcher targets the connected device explicitly and avoids Expo's interactive device picker.
- `codesign --verify --deep --strict` passed. The signed app contains the Azure API URL in its embedded bundle, and `devicectl` confirmed `com.solacewellness.app` is installed on the iPhone. The Personal Team provisioning profile expires at 08:16 UTC on 13 November 2026. Native sign-in, microphone behavior, live voice and reminder delivery still need on-device testing.

## Production UI consistency pass

| Issue | Root cause and change | Verification |
| --- | --- | --- |
| Today bottom edge | The floating rail drew a separate plum safe-area panel on Today. Removing that panel lets the existing root canvas continue below the rail. | Android and iOS rail interaction fixtures passed for selection, reselection, and swipe. Native visual checks remain. |
| Wellness Tools | An obsolete catalog shortcut opened a second library. The shortcut and catalog route were retired. The grouped library links to 13 tools, including the existing Quick Reflection route. | Navigation tests verified the tool registry and destination parameters. |
| Explore categories | Filter and search results used legacy rows. They now use the illustrated recommendation cards with a themed empty state. | Navigation tests verified illustrated results and real destinations for Breathe, Reflect, Sleep, Focus, and Move, plus the empty search state and All sections. |
| Little Milestones | The heading, icons, and lock indicators lacked a shared container. They now use Journey's panel styling with status badges attached to the corresponding icons. | Progress fixtures passed. The original milestone requirements, View All route, and earned-state source are retained. |
| Reflection | The prompt field, optional prompt, and footer used different containers and spacing. The optional field is now inside its own aligned card, and both actions are in the shared inset-aware scroll layout. | Routine, offline, and session-state suites passed. Real iOS and Android keyboard checks remain. |
| Companion composer | At the height cap, scroll handling could lose the end of the draft. Native multiline scrolling stays enabled and web measurement restores scroll position before ensuring the active caret remains visible. | Chrome confirmed single-line, multiline, pasted text, the end caret, and contraction at 320×400 dark and 393×740 light. Voice and session-state suites passed. |
| Explore page backgrounds | The cinematic theme applied plum to the page canvas as well as cards. Guided Techniques, Wellness Tools, and Timed Practice now use the base canvas while retaining the cinematic palette for surfaces and accents. | Android Release and unsigned iPhoneOS Release compiled. Verify transitions and safe-area edges on-device. |
| Garden | The floating dark pill was a decorative plot under an isolated seed marker. The seed stage now shows the landscape and communicates its state in the progress card. Earned plant stages still appear in the landscape. | Backend and progress suites passed. Browser checks opened the dashboard and full Garden in both themes. Growth and progress continue to use saved habit completions. |

TypeScript passed. Navigation passed 22 tests, session-state 80, voice 28, progress 22, Moments 15, wellness 7, routine 16, native config 13, offline 10, and backend 148. Expo web and iOS bundles exported. The arm64 Android Release assembled and passed `lintVitalRelease`. Xcode 27.2 built unsigned iPhoneOS Release before the final Garden polish. The Mac became unreachable for a repeat native build. Production deployment was not performed.

Chrome exercised Explore filters, all three nested canvases, the Wellness Tools Grow filter, Reflection draft retention and save, View All Milestones, and opening Garden in both themes. It used disposable accounts on a local database. [Screen results](../work/master-ui-qa/screen-result.json) · [Composer results](../work/master-ui-qa/composer-result.json)

Changed sources by issue:

- Bottom edge — [Navigation.tsx](../src/Navigation.tsx)
- Wellness Tools and Explore results — [WellnessTools.tsx](../src/screens/WellnessTools.tsx), [wellness-tools.ts](../src/wellness-tools.ts), [Explore.tsx](../src/screens/Explore.tsx), [routes.ts](../src/routes.ts), [App.tsx](../App.tsx)
- Milestones — [Journey.tsx](../src/screens/Journey.tsx)
- Reflection — [Wellness.tsx](../src/screens/Wellness.tsx)
- Composer — [ChatComposer.tsx](../src/ChatComposer.tsx)
- Explore canvases — [theme.tsx](../src/theme.tsx), [App.tsx](../App.tsx)
- Garden and Habits — [habits-ui.tsx](../src/habits-ui.tsx), [Habits.tsx](../src/screens/Habits.tsx), [HabitsInsights.tsx](../src/screens/HabitsInsights.tsx)
- Regression coverage — [test-navigation.cjs](../scripts/test-navigation.cjs)

Android runtime verification was blocked when the emulator disconnected during QA setup and the ADB client found an incompatible server. Physical-device verification and a live voice provider retest were outside the completed checks.

For physical follow-up, check all five bottom edges while switching and swiping tabs on iPhone and with both Android system navigation modes. In Reflection, open the optional field with the keyboard showing and scroll to both footer actions. In Companion, paste several paragraphs, type at the end, edit an earlier line, and send or reopen the draft. Repeat the dark-mode Explore transitions on a small phone and a Dynamic Island model with larger text. Verify a real habit completion still moves Garden progress and opens the earned stage after relaunch.

## Full QA and release review

The [full QA report](SOLACE_FULL_QA_REPORT.md), [screen inventory](QA_SCREEN_INVENTORY.md), [test matrix](SOLACE_QA_TEST_MATRIX.md), and [release assessment](SOLACE_RELEASE_READINESS.md) record the current reruns. One temporary Realtime status failure previously ended a healthy call. A bounded retry now preserves the call if status recovers and closes it if failure repeats. The original failure and final behavior were reproduced with synthetic Chrome WebRTC. A separate hosted smoke passed with one live text turn, one live Realtime turn, transcript persistence, hangup and disposable account cleanup.

## Visual sweep fixes

The [visual sweep report](SOLACE_VISUAL_SWEEP_REPORT.md) preserves the original observations. These were the fixes and follow-up checks on the updated source.

| Finding | Change and retest |
| --- | --- |
| A completed practice could disappear on Back | Classic grounding and breathing save the completed record before optional feedback. A failed save remains visible and can retry using the same ID. The browser completed grounding, used Back without feedback, and found one new grounding record in Journey. The isolated regression also covered failed save, retry and stable identity. [Journey evidence](../work/visual-sweep-fix/03-grounding-in-journey-after-back.txt) |
| Back discarded edits silently | Shared user-driven Back and tab reset use the guard. Successful save callbacks retain their ordinary navigation. In Chrome, Back from a dirty habit form prompted. Cancel kept the name, and Discard left the form. [Confirmation retest](../work/visual-sweep-fix/guard-test.json) |
| Today’s See All reused old filters | Today opens a fresh Explore entry. Ordinary tab switches still restore the existing view. Chrome verified both behaviors. [Explore retest](../work/visual-sweep-fix/explore-retest.json) |
| Journal tag overflow and generic error | The editor enforces the server’s 30-tag and 80-character limits, keeps removals accessible, and identifies invalid tags before saving. Journal headers use consistent circular Back controls. At 320 px, a long tag stayed within its card and the corrected entry saved. [Browser and voice evidence](../work/journal-fix/browser-result.json) |
| Category radio keyboard support and selected state | Explore, Techniques, Wellness Tools, Timed Practice and Journey use web roving focus, Space and arrow keys. Explore adds a checkmark and stronger selected outline. Chrome verified Space and Arrow Right in Explore. [Explore retest](../work/visual-sweep-fix/explore-retest.json) |
| Live Voice End could hold navigation | The local media closes and navigation returns immediately. End and history refresh finish independently. Chrome delayed the End response and verified the exit and release of microphone capture. [Browser and voice evidence](../work/journal-fix/browser-result.json) |
| Reminder status, account errors and timing | Profile distinguishes saved preferences from allowed and active device delivery. Cancellation runs after successful account exit. The test action allows for OS timing, and reminder editors use the same time format. Mocked reminders and account-state regressions covered denied permission, OS schedule state and failed deletion. |
| Native data export | Android saves a JSON file to a folder the user selects. iOS shares a temporary JSON file and removes the app's copy after the share interaction. The web continues to download JSON. The native file picker and share sheet still need physical verification. |
| Spacing, text scaling and copy | Today mood cards reflow with Android system text, and the Android rail lets captions wrap. The Technique CTA follows its instruction card, weekday headers align with date columns, Habit Reminders uses a single title and a styled empty state, and Today labels Guided Programs as multi-day. Native enlarged-text and layout checks remain open. |

App and server TypeScript checks and the repository format check passed. Nine targeted app suites passed 224 tests, and backend integration passed 149 tests. Expo exported web, Android and iOS bundles. The Android arm64 Release assembled and passed native lint, signature verification and 16 KB ZIP alignment. [Android package evidence](../work/visual-sweep-fix/artifact-check.json) · [Expo export log](../work/visual-sweep-fix/final-export.log)

Browser retests used synthetic accounts and local storage. No production deployment or commits were made. The updated APK was not installed on a physical device. Background notification delivery, tap routing, native export UI and enlarged-text checks remain open for this candidate.

## Final product experience and reliability

- Today keeps its existing mood card and adds first-check-in guidance. Saved check-ins offer one existing practice based on mood. The user can dismiss it or start it once. The separately consented Companion handoff stays available.
- Saved practices show their name and actual active duration, then offer a skippable follow-up. Supported practice IDs map to a stable, account-scoped check-in ID. The protected writing queue preserves the timestamp and reconciles a retry without duplicating the response. Journey practice details display the recorded mood and timestamp. Guided Moments still use their existing explicit save step and optional feedback.
- Voice connection loss offers Continue in Chat and Retry. Ending during session negotiation closes local media immediately, holds retries while the request settles, and finalizes a late session ID when available. History refreshes after cleanup. Speech never received or saved by the provider cannot be recovered.
- The isolated API integration test fetched populated and empty exports, wrote each response to an actual JSON file, and parsed it. It checked the follow-up's identity, timestamp and mood, attachment metadata, and account and token exclusion. Navigation tests exercised native file handling with mocked platform APIs. The native file picker and share sheet still need a device run.
- Reminder tests exercised destination validation, duplicate taps, permission denial and scheduling cleanup with mocked native APIs. ADB listed no connected phone. Both available emulator profiles already had Solace installed, so the clean-install check stopped before touching existing data. Background OS delivery, tapping a notification, and larger-text checks with TalkBack and VoiceOver remain unverified.
- App and server TypeScript checks, Prettier, Expo exports for web/Android/iOS, and Android arm64 Release and lintVitalRelease passed. APK checks confirmed the existing signer, 16 KB ZIP alignment, embedded Hermes and WebRTC, and the public Azure HTTPS API. The Mac SSH endpoint was unreachable, so no signed iOS build was produced. Production was untouched.

Evidence is in work/final-experience. For device acceptance, use a disposable account and the matching release. On both platforms, schedule the ten-second test reminder, background Solace, tap the notification and confirm Check-in opens. Export populated and empty accounts from Privacy & Data and parse the native files. Set larger system text, check all tab labels, mood choices and completion actions, then repeat with TalkBack or VoiceOver. In Voice, test a network drop, Retry, Continue in Chat, backgrounding and repeated End, including while connecting. Check that the microphone indicator clears and that the original conversation remains accessible.

Automated results: 209 app tests across routine (16), navigation (28), reminders (13), Moments (15), Voice (32), offline (10), native configuration (13) and session state (82). The first backend run timed out in one process-restart test during parallel builds. The restart suite passed 6/6 on rerun, then the full backend suite passed 150/150.

## Overnight stabilization candidate

The [overnight engineering report](SOLACE_OVERNIGHT_ENGINEERING_REPORT.md) records the starting Git checkpoint, confirmed defects, exact changes, browser captures, and release checklist. All 297 app and 154 backend checks passed, alongside app and server TypeScript, Prettier, and Expo exports for web, Android, and iOS. The signed ARM64 Android release passed native lint and package checks. Physical phone verification, signed iOS build, and production rollout remain separate gates.

A separate x86_64 Release assembled, passed Android native lint, fresh-installed on an empty emulator and reached the welcome screen. The ARM64 release stayed separate for physical-device testing.

## Haptic feedback

Today uses an Android effect supported below API 34 and a light iOS impact. Confirmed check-in and practice saves use native confirmation feedback. Profile → Appearance & Preferences → Test haptic feedback exercises the confirmation effect on the phone. The implementation uses platform effects and follows system haptics preferences.

App TypeScript, Prettier, the 16 routine and 30 navigation tests, and the web export passed. The platform mapping regression covers Android API 29 and 30, the iOS calls, the web no-op, and a native error. Only emulators were available, so physical vibration was not verified.
The signed ARM64 Android release passed native lint, signature and alignment verification, and a bundle check for the Test haptic feedback action. The APK is at work/haptics/Solace-Android-Release-arm64.apk.

## Companion recommendation cards

Companion renders the latest eligible suggestion with the canonical technique title, description, duration and existing artwork. Self-paced durations are estimates. The short reason names a topic only when the immediately preceding user turn mentions it and the existing explanation basis is the conversation. The info button opens the existing detailed explanation. Start practice uses the technique player with the original conversation ID and chat source. Not now dismisses only that assistant turn.

App TypeScript, formatting, 32 navigation tests, 86 session-state tests and eight focused recommendation and technique tests passed. The component tests exercise light and dark configurations, large text, full copy, disabled actions and artwork fallback with mocked native components. The session and API tests cover repeated starts, dismissal scope, the route back to chat and a single saved Journey completion. New build generation was deferred per the user’s request. Physical rendering, keyboard clearance and bottom-tab spacing still need a check on iOS and Android.

## Companion dark canvas

The Companion keyboard container and stationary transcript backing use the base dark canvas (#000000). The welcome scene fades into the same black, and dark message metadata lets the canvas show through. The top safe area and header retain their original plum backing. The chat theme, keyboard avoidance and composer inset rules stay in place.

App TypeScript, formatting, 32 navigation tests and 86 session-state tests passed. Calculated contrast is 12.21:1 for the muted transcript text against black and at least 11.32:1 for the existing header and bubble text pairs. iOS and Android keyboard, safe-area and scroll behavior were reviewed in source. Physical rendering and transition checks remain pending under the no-new-build constraint.

## Companion overflow and reply playback

The Conversations popover contains New Conversation and Conversation History. The two actions retain their existing callbacks, and the modal closes through the backdrop, close control, and platform Back handler. Its width and height account for the window and safe areas. Playback now sits beside the latest eligible reply’s metadata and uses the same speech handler and ownership checks.

Source checks confirmed the remaining entry points. Today and Explore open Moments, breathing and reflection. Explore opens Healthy Habit Builder, and Companion and the habit screens still offer the habit assistant in context. Profile and chat safety guidance link to human support.

App TypeScript, formatting, 34 navigation tests, 86 session-state tests, 34 voice tests, 16 routine tests, and two focused support and speech API tests passed. Mocked native tests cover compact bounds, both themes, menu dismissal, the conversation actions, and attachment of playback to the correct message. Physical rendering and playback remain to be checked on iOS and Android. No new build was created.

## Journal editor

The new and edit routes share the reference-inspired editor. The arched-window art sits behind native header controls. A keyboard-aware purple writing surface supports multiline input, a plain-text bullet tool and Unicode-aware word counting. The mood chips use the existing five saved values. Tag chips support adding, renaming and removing within the existing API limits. Bookmarking remains separate from saving.

The reflection switch offers excerpt selection after a confirmed account save. The existing reflection screen requires the user to choose and explicitly authorize the excerpt before sending it. Protected draft storage, retry identity and pending-sync states follow the existing Journal save path. Journal does not expose attachment, rich-text or dictation controls.

- TypeScript and Prettier passed. The project has no separate lint script.
- All 39 navigation tests passed, including mocked component checks for both themes, keyboard-responsive sizing, mood and tag controls, and save, retry, draft recovery and edit flows.
- All 86 session-state tests and 10 offline tests passed, including protected draft restore and retry coverage.
- All seven Journal and Journal AI integration tests passed with isolated databases and a mocked provider. They covered long entries, ownership, deletion and excerpt-only disclosure.
- All 13 native configuration tests passed. New builds were deferred. Native keyboard, caret, safe areas, large text and final visuals still need device verification on iOS and Android.

## Four-section Habits hub

The four sections share one canonical route and the existing habit records. The design uses a black dark-mode canvas, theme-specific card surfaces, optimized sunset and stage artwork, and the main navigation’s measured glass rail. Seed is the starting state. The four earned stages begin at 1, 5, 12 and 25 distinct completed habit-days. Corrections change the analytics without awarding repeat garden credit.

The Expo development preview used a local SQLite API and two disposable accounts. In the empty account, Explore opened the empty state. The editor created and saved a daily binary habit, a five-glass quantity habit and a flexible weekly habit. One glass stayed partial. A binary completion updated Today, Home, Journey and Garden. Undo and recompletion left Sprout earned once. Pause, resume, archive and restore preserved the habit. A reload restored progress. The populated account covered the four section taps, a horizontal swipe to Garden, archived filtering, active-section reselection from details, selected-date restoration after Back, Week and Month, theme switching, and return to Insights after changing main tabs. The draft exit confirmation appeared on reselection. The browser did not confirm the outcome after the dialog.

Two visual passes identified and corrected selected-label contrast and the light fallback tint. The dark page margin sampled black in all four captures. Browser evidence shows the fallback, while the availability-gated native glass needs iOS verification.

| Evidence | Result |
| --- | --- |
| App and server TypeScript, Prettier | Passed. The repository has no separate lint script. |
| Navigation, session state, reminders, Journey progress and insights | 42, 87, 13, 22 and 10 tests passed respectively. |
| Habits and Habit AI integration | 12 tests passed against temporary SQLite databases and a mocked provider. They covered ownership, concurrent writes, pinned time zones, historic target edits, idempotent growth and persistence after reopening. |
| Native configuration | 13 tests passed. |
| Browser screenshots | [Dark mode](../work/habits-four-screen-local/habits-dark.jpg) · [Light mode](../work/habits-four-screen-local/habits-light.jpg) · [Scrollable chart](../work/habits-four-screen-local/insights-trend-light.jpg) |
| Physical verification | Native glass and fallback appearance, OS Back and edge gestures, native reminder delivery, large text, VoiceOver and TalkBack remain pending. No native build was created, and no swipe video was captured. |

## Targeted Home refinement

Today’s Progress sits between mood check-in and Today’s Moment. It shares the existing Today’s Habits snapshot and reads the existing Daily Pause result. The ring divides completed eligible work by total eligible work. Flexible weekly habits, disabled Daily Pause and a skipped incomplete practice are excluded from the daily total. The card distinguishes an empty schedule from loading or failed data. View Details opens Journey.

The four Quick Actions stay in one row, with the original handlers, local illustrations and theme-specific contrast overlays. Home uses a 24 dp major section gap and a 12 dp gap between Today’s Moment and Quick Actions. The existing header, component internals and floating navigation clearance are preserved.

- TypeScript and Prettier passed. The repository has no separate lint script.
- All 171 targeted tests passed across routine, progress, navigation and session state. The component test covers section order, distinct decorative images, equal flex sizes, a single row at 150% text in mocked Android and iOS configurations, and the original destinations.
- A local Chrome preview at 360 × 800 showed equal 72 × 74 CSS px tiles in one row. Breathe opened the three-minute practice, Reflect opened the reflection form, Sleep opened Sleep Wind-Down, and Focus opened Five-Senses Grounding. View Details opened Journey.
- A disposable fixture showed 20% with one completed habit out of five combined targets. Undo and recompletion changed the value to 0% and back to 20%. Saving a mood check-in raised the value to 40%. At the bottom scroll position the last Daily Pause action cleared the floating navigation.
- Browser screenshots cover [dark progress](../work/today-targeted-qa/home-dark-progress.jpg), [dark actions](../work/today-targeted-qa/home-dark-actions.jpg), [light progress](../work/today-targeted-qa/home-light-progress.jpg) and [light actions](../work/today-targeted-qa/home-light-actions.jpg). Physical iOS and Android sizing, safe areas and system text scaling remain to be checked. No native build was created.

### Android phone build, 8 November 2026

Built the current ARM64 release, including the Home refinement. TypeScript, 13 native configuration checks, release assembly, release lint, signature verification and 16 KB ZIP alignment passed. The embedded Hermes bundle contains the new progress copy and the existing hosted HTTPS API origin. The API health check returned HTTP 200.

ADB installed the APK on a Xiaomi 2312FRAFDI running Android 15. A cold launch returned `Status: ok`, and the Solace window and Today navigation label were present. On-device practice completion, habit updates and Live Voice still need an interactive run. [APK](../outputs/Solace-Android-Home-Release-arm64.apk) · [Package checks](../work/android-home-phone/artifact-check.json) · [Launch log](../work/android-home-phone/launch.log)

## Final Android fixes

1. Home applied a 68 dp Android-only minimum height to the four Quick Actions. They now share a 110–125 dp responsive minimum, larger icons and overlays that leave more artwork visible. The 360 px preview measured four 72 × 110 px cards on one row. Breathe, Reflect, Sleep and Focus each opened their original destination and its Back button returned to Today. [Home capture](../work/android-final-fixes/home-dark-360.png)
2. The Journal date was a static label, the mood row wrapped, and the editor used the cinematic purple canvas. The editor now scrolls moods horizontally, uses the black dark canvas around the existing purple writing surface and opens a calendar from the date. The calendar derives dots from the authenticated snapshot, excludes pending device entries and opens saved entries by their existing IDs. In the isolated browser run, two saved entries shared one date, the second opened correctly, and a new entry saved on its chosen past date. An existing draft keeps its date. [Calendar](../work/android-final-fixes/calendar-dark-360.png) · [Dark editor](../work/android-final-fixes/journal-dark-360.png) · [Light editor](../work/android-final-fixes/journal-light-360.png)
3. The native Android ripple filled each rectangular tab touch target. Press feedback now changes content opacity while the circular spotlight remains a separate animated view. The navigation suite covers five tabs, the spotlight geometry, press and reselection, swipe settling, reversals and cancellation.
4. The old launch theme pointed to Expo's white placeholder drawable. An Android-only config plugin sets the existing lotus, cream and black resource variants, contrasting system icons, and a legacy starting-window drawable. The signed release built successfully and installed on an Android 13 emulator. Cold and warm launch checks passed in both appearances. The dark frame shows the system lotus. The light launcher transition shows the lotus on cream, and the following cream frame has dark status icons. [Dark launch](../work/android-final-fixes/final-native-yes-b.png) · [Light transition](../work/android-final-fixes/final-native-no-a.png) · [Light status icons](../work/android-final-fixes/final-native-no-b.png)

TypeScript, Prettier, 44 navigation/component tests, 10 draft and offline tests, 25 progress tests, 14 native configuration tests, all 156 backend tests, and Expo web and iOS JavaScript exports passed. Android release assembly, release lint, APK signature and 16 KB ZIP alignment passed. The [signed Android APK](../outputs/Solace-Android-Final-Fixes.apk) matches the previous APK certificate and contains the hosted HTTPS API and both ARM64 and x86-64 code. Install this APK over the previous Android build to see the new startup resources.

The current build was tested on an Android 13 emulator. Physical-device launch and signed-in UI, Android versions below 12, biometric restoration, large system text, screen readers and iPhone runtime behavior remain unverified. Azure and store deployment did not run.

### Final Azure rollout

Azure App Service deployment `81afba2c-bbc5-48f7-9840-4ce577a5dd49` reached `RuntimeSuccessful` on 8 November 2026. The public web page served the new build with the Journal calendar. HTTPS readiness returned 200, unauthenticated account state returned 401, and Google Sign-In configuration returned enabled. A disposable account registered, signed in, saved a dated Journal entry, and read it back through account state. The account was removed and its session was revoked.

Before rollout, all 156 backend regressions passed and the packaged host passed local web delivery, audio range requests, two-account isolation and SQLite persistence across restart. The prior deployment archive matched the former live bundle and was retained for rollback. A private pre-deployment SQLite backup stayed on Azure. The existing database path, provider credentials and app identifiers were retained.

Live text returned `AI_UNAVAILABLE` and Realtime session creation returned `REALTIME_RATE_LIMITED`. A direct server-side check with the configured OpenAI project returned HTTP 429 with `credit_balance_exhausted`. Rerun both provider smoke checks after the project has available credits.

The [final Android APK](../outputs/Solace-Android-Final.apk) matches the final-fix release byte for byte and its bundled source matches the current workspace. It embeds the live Azure HTTPS origin, uses the existing test signing certificate, and is suitable for sideloading. The Android 13 emulator evidence above applies to this APK. Physical installation of this candidate remains pending.

The [signed iPhone app archive](../outputs/Solace-iOS-Final-Device-App.zip) passed Xcode Release assembly and strict code signature verification. The embedded bundle contains the live Azure origin and the current Journal calendar. The app installed and launched on the connected iPhone 15 Pro Max. Apple Personal Team provisioning expires on 13 November 2026 at 08:16 UTC. In-app iPhone behavior and live AI remain separate from the launch check.

## Live Voice startup, greeting, and lotus layers

The previous startup endpoint returned the SDP answer after OpenAI created the call **and** the trusted server-side WebSocket attached. Only then could the app set the remote description and begin connecting ICE. The candidate releases the SDP after call creation and attaches the sideband concurrently. The app waits for both the usable peer with its remote audio track and the server’s active status before enabling conversation controls and starting the timer. Older clients and servers keep the serial contract. The Azure health samples ranged from 94 ms to 3.9 s, which shows request variability. These samples do not isolate a host cold start.

| Real-provider measurement | Runs | SDP POST median / slowest | Ready median / slowest |
| --- | ---: | ---: | ---: |
| Existing Azure release, browser WebRTC probe | 3 | 1.62 s / 2.62 s | 2.96 s / 6.69 s |
| Local backend, serial setup, same browser and provider | 3 | 1.38 s / 1.50 s | 2.77 s / 4.88 s |
| Local backend, overlapping setup, same browser and provider | 3 | 0.50 s / 0.52 s | 1.98 s / 3.16 s |

Times are elapsed from opening the probe or pressing the UI control, as applicable. The three paired-path samples use the same loopback backend and real OpenAI provider. “Slowest” is the observed maximum in a small sample. The parallel probe detected first non-silent incoming audio at a median of 3.97 s and a maximum of 4.32 s. The exported browser UI’s initial open took 1.54 s to lay out, 8.05 s to reach ready/listening, and 9.66 s for the decoded greeting. The warm Retry reached ready/listening in 1.82 s and audio in 2.81 s. The cold UI sample included a 4.09 s startup POST. The 2–3 s target is feasible in some conditions and remains unverified for cold native or Azure production starts. [Azure probe](../work/voice-speed-qa/baseline-result.json) · [Serial probe](../work/voice-speed-qa/serial-result.json) · [Parallel probe](../work/voice-speed-qa/parallel-result.json) · [Rendered UI results](../work/voice-speed-qa/ui-result.json)

The new authenticated media-ready acknowledgment arms one greeting per session. It uses a bounded first-name token from the existing account and falls back to “Hello. What brings you here today?” The existing Realtime voice speaks it as an out-of-band audio response. The server suppresses it if speech has started and cancels or clears queued greeting audio when the user speaks. There is no extra microphone, playback stack, saved greeting-only message, or recurring greeting on a transient ICE reconnect. Backgrounding releases audio and ends the call. A deliberate Retry after End or backgrounding starts a fresh call.

The rendered browser app received the personalized greeting from OpenAI over WebRTC. An isolated QA recording re-transcribed to “Hello, Avery. What brings you here today?” The test interrupted a second greeting with a real spoken light-mode request, observed the speech/thinking/playback transitions, and verified the theme preference and user voice turn persisted. It also exercised mute/unmute, cleanup, an injected startup 503 and Retry. Separate rendered lifecycle tests covered cancelling pending startup, repeated End, denial, backgrounding, and Continue in Chat. [Live audio and actions](../work/voice-speed-qa/ui-result.json) · [Lifecycle evidence](../work/voice-speed-qa/ui-lifecycle-result.json)

The old art was a flattened image with animated overlays. Separate dawn and night plates keep the original mountains, lake, reflection, and rings fixed. Only the original petal pixels and local glow/ripples move. Motion tracks actual session phase and available WebRTC stats. It becomes static when Reduce Motion is on or the screen is inactive. Browser fixture tests rendered both themes, compact and enlarged-text layouts, and the motion/lifecycle states with controlled WebRTC inputs. [Art provenance](../assets/ARTWORK.md) · [Visual QA](../work/live-voice-layers/lotus-layers-result.json) · [Dark speaking](../work/voice-speed-qa/dark-speaking.png) · [Light listening](../work/voice-speed-qa/light-listening.png)

The final signed Android QA APK passed release assembly and lint and ran on an Android API 33 x86_64 emulator against an isolated HTTPS API and live OpenAI. Two starts reached UI layout in 158 / 215 ms, ready in 2.27 / 1.97 s, listening in 2.27 / 1.97 s, and first measured non-silent audio in 3.79 / 4.08 s. The dark run included fresh app launch with permission already granted. The light run was warm. The emulator displayed Speaking, Listening, and Muted, accepted a speaker preference change, returned to Companion on End, and released the microphone on background before Android Back returned to Companion. Actual physical speaker routing and Bluetooth remain separate. [Dark timings](../work/voice-speed-qa/native-candidate/probe-marks.json) · [Light timings](../work/voice-speed-qa/native-candidate/light-marks.json) · [Dark speaking](../work/voice-speed-qa/native-candidate/dark-probe-1.png) · [Light listening](../work/voice-speed-qa/native-candidate/light-live-0.png) · [Background recovery](../work/voice-speed-qa/native-candidate/light-background-recovery.png)

Mobile and server TypeScript, formatting, 36 voice tests, four native permission tests, 47 navigation tests, eight Companion action tests, all 171 backend tests, server build, web export, and iOS JavaScript export passed. A live text request returned a provider-backed answer and its account-owned history was read back from the API before the disposable account was deleted. The iOS Mac SSH check timed out. Physical iPhone and Android phone playback, Bluetooth, system audio interruptions, and a native network handoff remain open. The installed standalone apps need updated builds and the matching server update to enable the new behavior. Existing native modules and signing configuration are sufficient. Azure and store releases were not changed.

Source files are `src/screens/VoiceTalk.tsx`, `src/screens/VoiceTalkArtwork.tsx`, `src/screens/Core.tsx`, `src/useRealtimeVoice.ts`, `src/realtime-rtc-core.ts`, `src/realtime-rtc.ts`, `src/realtime-rtc.web.ts`, `src/realtime-voice-state.ts`, `src/realtime-timing.ts`, `src/store.tsx`, `server/src/realtime.ts`, and `server/src/app.ts`. Regression coverage changed in `scripts/test-voice.cjs`, `scripts/test-navigation.cjs`, `server/tests/realtime.test.ts`, and `server/tests/realtime-routes.test.ts`. The four new night/dawn plate and petal assets are listed in [ARTWORK.md](../assets/ARTWORK.md).

## Live Voice lotus motion

Both approved JPEGs include the lotus, scenery, halos and reflection in the same image. The artwork now stays stationary. Small, translucent overlays share the image's cover crop and add a glow, halo and a single outward ripple per speaking phase. No asset files were changed. [Dark speaking](../work/voice-lotus-qa/393x853-dark-speaking.png) · [Light speaking](../work/voice-lotus-qa/393x853-light-speaking.png) · [Reduce Motion](../work/voice-lotus-qa/393x853-dark-reduced-motion.png)

The artwork and both waveforms share one WebRTC stats sampler. The sampler reads input only during confirmed, unmuted user speech and output only during the assistant speaking phase. Missing values settle to zero while the artwork uses a gentle phase-based treatment. The visual effects use native opacity and transforms. One slow ambient loop serves the active states, and the short ripple runs once per speaking phase. Backgrounding, route hiding, the voice options overlay and Reduce Motion stop visual animation and metering.

The local browser fixture exercised connecting, listening and speaking with loopback audio, thinking, mute and unmute, temporary disconnect and reconnect, unavailable stats, connection failure, Retry, End and background/foreground cleanup. It verified the same static image bounds during motion, both themes at 393 × 853 and 320 × 568, and reachable controls at 320 × 480 with enlarged text. The fixture reported zero browser exceptions. TypeScript, Prettier, 35 voice tests, all 156 backend tests, the web export and the iOS Hermes export passed. [Browser evidence](../work/voice-lotus-qa/lotus-result.json)

The Android Hermes release bundle matched the current sources. An isolated Android 13 release fixture with synthetic levels confirmed visible motion during listening and speaking, a quieter muted state, and identical resting and paused artwork frames. During the interaction and screenshot sequence, the software-rendered emulator reported 38 ms median and 61 ms p95 frame times, with 630 of 663 frames flagged as janky. That run could not isolate the animation cost. Physical-device frame timing, iOS runtime rendering and a live OpenAI call remain unverified for this update. [Android motion evidence](../work/lotus-motion-android/emulator-motion-evidence.json)

## Six-fix rollout

Azure App Service reported `RuntimeSuccessful` for deployment `9dc87a78-587f-4a65-9c42-c0955c605a81`. The package contains a fresh server compile and web export. The previous live bundle matched the retained rollback archive, and the private database backup was verified in Azure before upload. The package passed local web and API checks, audio byte ranges, account isolation and SQLite persistence across restart. [Deployment status](../work/master-six-rollout/deployment.json) · [Local package checks](../work/master-six-rollout/local-smoke.json)

The public site served the expected new web bundle and audio byte ranges. HTTPS readiness, rejection of anonymous account state, disposable registration and sign-in, account ownership, and a Companion Cancel action with the same action ID on retry passed. The test account was deleted and its session was revoked. The cancellation check does not call OpenAI. [Hosted checks](../work/master-six-rollout/hosted-smoke.json)

The iPhone Release build passed Xcode assembly and strict code signature verification on the Mac. The embedded Hermes bundle contains the public Azure origin and current Companion action and UI markers. `devicectl` confirmed installation and launch on the physical iPhone 15 Pro Max. The existing Apple Personal Team profile expires on 13 November 2026 at 08:16 UTC. Native feature interaction and live provider behavior remain separate from this launch check. [Signed iPhone app](../outputs/Solace-iOS-Companion-Actions-Device-App.zip) · [Mac build source](../outputs/Solace-iOS-Companion-Actions-Mac-Source.zip)

## iPhone Google sign-in return

The live Azure flow reached Google’s sign-in page using the registered HTTPS callback. A synthetic cancellation reached the Solace app URL and returned `GOOGLE_CANCELLED` when redeemed. Google accepted the configured OAuth client credentials in a token endpoint check with a deliberately invalid code. These checks did not establish the exact cause of the iPhone’s generic error.

The mobile client now accepts the same one-time handoff with an optional root slash or empty fragment. It still requires the Solace scheme and callback host, a single valid handoff parameter, and the app’s original verifier at redemption. It distinguishes browser launch, callback and completion errors without showing credential or URL details. TypeScript, 12 client OAuth tests and eight focused backend OAuth tests passed.

The updated iPhone Release build passed strict signature verification, and the embedded bundle contained the new Google return handling. The build installed and launched on the paired iPhone 15 Pro Max. The user then confirmed Google sign-in succeeded on that device. [Signed iPhone app](../outputs/Solace-iOS-Google-SignIn-Device-App.zip)

## Four-tab design and usability sweep

The sweep covers Today, Explore, Journey and Profile. Solace uses the same root brand row and the common shell; Companion, Journal and Live Voice flows were left out. The existing [screen inventory](QA_SCREEN_INVENTORY.md) and [prior visual sweep](SOLACE_VISUAL_SWEEP_REPORT.md) were the route and issue baselines. This is a local verification pass; it does not replace the earlier release or physical-device evidence.

| Area | What changed | Evidence |
| --- | --- | --- |
| Shared shell | The five roots use the same 30-point lotus, 24-point serif wordmark, gap, and safe-area offsets. Nested and illustrated headers use a common back/action button. The glass rail keeps its circular spotlight, uses opacity on a transparent touch target, and clears lateral as well as bottom safe areas. | [Root geometry and header actions](../work/four-tab-sweep/roots/browser-result.json); 320, 390 and 430 CSS px in both themes. The suite matched absolute lotus and wordmark bounds across all five tabs with no header action collision. Tap, drag, cancellation and reselection also have navigation regressions. |
| Today | Mood choices fit in one row at standard text on narrow phones and can wrap at larger sizes. Stacked Today’s Progress content now takes its natural height. Existing check-in, progress and shortcut destinations are retained. | [320 px dark](../work/four-tab-sweep/explore/dark-today-compact-progress.png) · [320 px light](../work/four-tab-sweep/explore/light-today-compact-progress.png). The measured ring clearance changed from a 46 px overlap to a 16 px gap. The browser saved a fixture mood and reached the next-step view. |
| Explore | The technique detail removes the gap before Start. Technique, Tools, timed sessions and plans reuse consistent headers and safer insets. The timed builder keeps its preview/actions stable and blocks repeated starts; player and mixer state changes are clearer and keyboard reachable. Existing artwork and destinations are retained. | [Browser workflow evidence](../work/four-tab-sweep/explore/explore-after.json); synthetic records and built-in plan previews only. |
| Journey and Habits | Equal, centered 48 px period controls, clearer calendar states and compact real-date cards at narrow widths. Goal, habit editor, management, Garden and insights reuse the shared presentation. Habits Today links to its existing Insights section instead of duplicating the full period and trend views. | [Journey/Habits results](../work/four-tab-sweep/journey-habits/journey-habits-result.json) · [Compact calendar](../work/four-tab-sweep/journey-habits/light-320-habit-calendar.png). Verified goal save, pause, resume and remove; a guarded habit draft; Journey Month opening Habit Insights; and habit completion updating Garden. |
| Profile | Edit Profile keeps identity, Google account linking and sign-out. Privacy & data is the single place for export, sync recovery and account deletion, linked from Edit Profile with unsaved-name protection. Appearance, memories, reminder scheduling and support use clearer grouping, tap targets, and lavender selection states. | [Profile results and captures](../work/profile-polish-baseline/results.json). Twenty states at 360 px dark and 320 px light; reminder and memory saves, name reset, nested Back and account-to-privacy navigation verified. |

Automated checks passed: application TypeScript, repository Prettier, navigation (46), Today routine (17), Journey/progress (25), session and retained state (87), Moments (15), wellness plans (7), ambient mixer (5), reminders (16), Google auth fixtures (12), native configuration (14) and backend integration (160). The first backend invocation could not connect to its loopback test servers in the sandbox; the permitted isolated rerun passed. Production-mode Expo web and Android/iOS Hermes bundle exports passed. Browser fixtures used isolated data and did not call the production API or live OpenAI.

[Header comparison in both themes](../work/four-tab-sweep/header-comparison.png) · [Explore's 50 passing scenarios](../work/four-tab-sweep/explore/explore-after.json) · [Journey activity history, milestones, goals and Moment checks in both themes](../work/four-tab-sweep/journey-extended/journey-result.json) · [Seven saved activity types opened and returned](../work/four-tab-sweep/journey-detail-final/journey-records.json).

Android release assembly and Gradle's release lint checks passed for the isolated QA app. Android 13 emulator cold starts reached onboarding in [light](../work/four-tab-sweep/android-light-start.png) and [dark](../work/four-tab-sweep/android-dark-start.png). This checks native launch, not signed-in use of the four tabs. The iOS check was a Hermes export; no iOS runtime or physical-device interaction was verified in this pass. Release-device checks still include native safe-area and gesture behavior, VoiceOver and TalkBack, large system text, background notification delivery, and native audio. No production deployment was performed.

## Nested-screen visual redesign

The [screen inventory, visual comparisons and QA report](NESTED_SCREEN_REDESIGN.md) records the Today, Explore, Journey and Profile redesign. It links matching fixture captures in both themes and separates the signed-in Android 13 emulator samples from browser and bundle verification. The test APK uses an isolated local API. Live providers and the standalone production release were outside this pass.

## Production rollout — 9 November 2026

- Azure is serving the new web bundle and the API health endpoint responded successfully. A disposable account verified registration, email sign-in, account-scoped state, repeatable Companion action handling and session revocation after cleanup. Byte-range audio delivery passed. The previous deployment package and a pre-deploy database backup were verified before rollout. [Hosted smoke results](../work/nested-redesign-production/hosted-smoke.json)
- The [Android production APK](../outputs/Solace-Android-Production-ARM64.apk) passed release assembly and signature verification. Its SHA-256 matches the APK already installed and cold-launched on the connected Android phone. It contains the Azure API URL and the updated Today and Explore code.
- The [signed iPhone IPA](../outputs/Solace-iOS-Production-Device.ipa) passed Xcode Release build, strict signature verification, archive validation and SHA-256 verification after transfer. The bundle contains the Azure URL and the same redesign markers. It was installed and launched on the connected iPhone 15 Pro Max. The Personal Team provisioning profile expires 13 November 2026 at 08:16 UTC and requires the provisioned device. Neither build was submitted to a store.
- App and server TypeScript, 160 backend integration tests, and the navigation, native configuration, Google auth fixture, reminder, voice lifecycle, Companion action and ambient mixer suites passed. This release smoke did not exercise a live OpenAI voice session or background reminder delivery on either phone.

## Companion agent action execution

- Reproduced the two failures against the previous Azure package. “Turn on light mode” and “Daily” failed its action gate. The last installed iPhone artifact was 1.0.0 (build 1), with the previous action protocol and the correct Azure origin. Its embedded Expo Updates configuration was disabled.
- A rendered browser app used the actual chat, habit, progress and reminder APIs and isolated SQLite. It passed both theme commands, reload persistence, the full walking clarification and typed approval sequence, one saved habit, completion, a real completion count, a saved daily 20:00 reminder, cancellation, seven destination launches and an automatically started three-minute breathing player. Browser reminder testing verified the stored preference. Device scheduling and delivery require mobile verification. [Browser evidence](../work/agent-browser-result.json)
- App and server TypeScript and the repository's Prettier check passed. The backend suite passed 163 tests, navigation 47, Companion actions 8, voice lifecycle 35, reminders 16 and native configuration 14. The Realtime suite includes mocked provider function events. Its HTTP flow persisted a walking habit through the real authenticated habit endpoint and verified result reporting, account isolation and retry deduplication.
- The Azure rollout passed a packaged local smoke test, verified the rollback package and backed up the production database. A disposable hosted account verified legacy light mode and walking proposals, version 2 confirmation, habit persistence and parsing 8 PM as 20:00. A real OpenAI text function call returned the authorized Profile destination. The test account was removed and its session revoked. [Hosted smoke evidence](../work/companion-agent-release/hosted-smoke.json)
- A real OpenAI Realtime session over WebRTC accepted a synthetic spoken light-mode command and delivered the validated theme action. Remote audio, the persisted transcript, hangup and disposable account cleanup all passed. [Realtime provider smoke](../work/companion-agent-release/live-voice-smoke.json)
- The hosted app itself passed a second live Realtime check with a synthetic microphone. The spoken theme command changed the app and saved the preference. The walking habit was absent before approval and persisted exactly once after spoken “Yes.” The final spoken command left the voice screen and opened Appearance & Preferences. [Hosted app voice evidence](../work/companion-agent-release/live-app-result.json)
- Android ARM64 assembly and release lint passed. The [updated APK](../outputs/Solace-Android-Companion-Agent-ARM64.apk) uses the same signing certificate as the last sideload release and contains the production API and new action dispatcher. No Android device was attached. The iOS Hermes export passed. The signing Mac was unreachable, so no updated signed iOS build was installed or run.

## Light mode redesign

- The [light appearance audit](LIGHT_MODE_AUDIT.md) records the image pipeline, palette, contrast measurements and reachable route families. The [Today Android comparison](../work/light-mode-qa/today-android-before-after.jpg) uses the standard-width Pixel 3a emulator. The Android 13 QA build ran with an isolated HTTPS API and disposable account. The broad updated capture recorded 24 states, including all five tabs in both themes, Companion, Journal, Toolkit, Appearance and reminders. Three script attempts did not reach their intended scroll targets. The focused follow-up passed all four captures, opened the Moment player using the primary button, and reached the check-in at about 320 dp with 1.35× system text. [Native capture results](../work/light-mode-qa/after-final/results.json)
- Fresh rendered browser comparisons used the previous release bundle and local fixtures. [Today and Solace](../work/light-today-solace) covered 38 pairs, including Today at 320, 390, 430 and 1140 CSS pixels, chat, conversation history, an action proposal, Journal, calendar and Voice connecting, unavailable and options. The disconnected Voice fallback was rechecked with a solid light text backing. Voice rendering used a synthetic microphone and offline API.
- [Explore](../work/light-explore/explore-light-report.md) captured 82 pairs in each theme, including practice players and completion. Ten interactive checks passed, covering filters, mixed audio playback, guided practice controls, plan saving and program enrollment. [Journey and Habits](../work/light-journey-profile/journey) captured 27 pairs per theme and passed Journey, Habit and saved activity navigation scenarios. [Profile](../work/light-journey-profile/profile) exercised its settings destinations, reminder editing, theme persistence, and consent changes.
- Dark regression evidence is scoped to the paired renders. Browser pixel comparisons found 69/82 exact Explore pairs, 24/27 exact Journey/Habits pairs, 17/18 exact Profile pairs and 11/19 exact Today/Solace pairs. The remaining browser captures had small raster, motion, or fixture differences in the reviewed comparisons. Native Appearance, Companion, Journal and Toolkit matched after the system-bar crop. Native Explore, Journey and Profile image pixels differed against the earlier Android QA binary. The first native Today capture also differed in scroll position, so it is excluded from dark equivalence claims. No dark palette or artwork source changed in this redesign.
- App and server TypeScript, Prettier, 163 backend tests, 47 navigation tests, 25 progress tests, eight Companion action tests, 35 voice lifecycle tests, 16 reminder tests, 14 native configuration tests, 15 Moment tests and seven wellness tests passed. Expo web, Android and iOS exports succeeded. Gradle QA release assembly and release lint succeeded. The signing Mac was unreachable. Physical devices, native iOS GlassView, installed reminder delivery, and an exhaustive pass over conditional account and live states remain unverified. The work is local and has not been deployed.

## Submission light-mode repair — 10 November 2026

- The first iPhone rebuild corrected the partial-width fade but exposed a dark strip at the top of Today and Solace. The final build replaces the stacked shades with a full-frame ivory mask and dark foreground ink. The original scene remains visible on the right. Three Explore entries now use separate in-flow reading and image areas, with a stacked layout for compact widths and larger text.
- Browser comparisons at 320, 375, and 430 pixels verified the card text stays off the images, the three Explore destinations open, and the four Today Quick Actions remain tappable after scrolling. The lowest sampled hero text contrast was 7.53:1. Nine dark-mode captures matched the preceding repair pixel for pixel. [Rendered checks](../work/submission-visual-hotfix/final/results.json) · [Contrast measurements](../work/submission-visual-hotfix/final/hero-contrast.json)
- App TypeScript, Prettier, 50 navigation tests, 27 progress tests, 14 native configuration tests and 187 backend integration tests passed. The backend tests needed permission to bind temporary local ports. [Automated checks](../work/submission-final-visual)
- The signed iOS Release build installed and launched on the paired iPhone 15 Pro Max. Both physical captures show dark status icons, readable hero copy and a continuous scene edge. The Personal Team IPA is provisioned for the paired device through 13 November 2026 at 08:16 UTC. [iOS artifact](../outputs/Solace-iOS-Submission-Device.ipa) · [Physical Today](../work/light-visual-submission-ios/today-physical.png) · [Physical Solace](../work/light-visual-submission-ios/solace-landing-physical.png)
- Android ARM64 release assembly and full release lint passed. The final APK retains the prior signing certificate, embeds the production HTTPS API, and contains the frozen hero mask and Hermes source. A physical Android device was unavailable. The native artifacts use the existing Azure onboarding deployment. [Android APK](../outputs/Solace-Android-Submission-ARM64.apk) · [Release verification](../work/submission-final-visual/android-verification.json)

## Companion keyboard transition — 10 November 2026

- The supplied iPhone recording shows the text field separating from its controls and the tab bar flashing near the header during keyboard dismissal. The shell and the Companion keyboard-avoidance wrapper were both scheduling layout changes. The iOS composer now shares a single native translation with the conversation transcript, and the shell restores the rail after keyboard dismissal.
- TypeScript, formatting, 51 navigation tests, 91 session-state tests, 14 native configuration tests and the Expo web export passed. The keyboard-frame test covers repeated events, a rapid reversal, floating keyboard geometry and Reduce Motion. A rendered browser check passed multiline input, draft retention through viewport changes and tab navigation, a single send, and recovery from an injected send failure. [Browser evidence](../work/composer-motion/results.json)
- The signed iOS Release build with the composer change installed and launched on the paired iPhone 15 Pro Max. The transferred IPA and its updated embedded Hermes bundle matched the build Mac's checksums. Physical keyboard motion is pending the user's check. The browser check used a simulated viewport resize. [Signed IPA](../outputs/Solace-iOS-Composer-Fix-Device.ipa) · [Bundle verification](../work/composer-ios-release/embedded-bundle-verification.json)
- The final signed Android ARM64 submission APK passed release assembly, full release lint, signing verification and 16 KiB alignment. Its Hermes bundle matches the updated source snapshot and embeds the production Azure URL. Installation was outside this build check. [Final APK](../outputs/Solace-Android-Final-Submission-ARM64.apk) · [Release verification](../work/composer-ios-release/android-verification.json)
