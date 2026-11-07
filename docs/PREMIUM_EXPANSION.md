# Solace premium feature verification

## Milestone 1 · AI, Moments and the companion

Chat now accepts an allowlisted structured practice choice and opens the existing Moment player directly. Legacy saved actions remain supported. The account-owned conversation link, idempotent completion, feedback and Journey records use the existing APIs. Companion motion uses distinct state cues, real optional recording input, reduced motion and foreground checks. Idle motion ends after two cycles.

Type checking passed. The targeted API and practice suites passed 34 checks, including a provider-stub schema exchange, unknown-action rejection, replay, isolation, one completion, helpfulness and reopening the saved suggestion. Live-provider and native motion verification are tracked separately below as they run.

## Milestone 2 · Voice and Daily Pause

Voice Talk preserves explicit recording and review, then sends the turn to the same saved chat as text. A microphone level drives the recording indicator where Expo supplies metering. Playback can be muted or interrupted. Cancellation aborts the upload and disconnects the provider request. Configured OpenAI transcription stays preferred. Gemini handles supported audio when Gemini is the only configured provider.

Daily Pause uses the existing wellness preference record to save the day's skip, replacement and supported duration, plus an ongoing on/off setting. It uses actual saved progress and can use the current check-in, time, and approved preferences and feedback. The dedicated tests passed against an HTTP API and a reopened SQLite database. The configured Gemini model also transcribed synthetic audio without printing the transcript or credentials.

## Milestone 3 · Weekly story and recommendation reasons

Journey shows the week's actual check-ins, completed Moments, minutes and helpfulness with optional local goal progress. Empty weeks open the manual writer. Drafting and regeneration are explicit, and the backend accepts one saved story per account and week. A disposable Chrome account passed generate, regenerate, edit, save, reopen after reload and delete at 320×640 dark and 430×840 light. The preview used the labeled recorded summary. A separate configured Gemini request returned a validated reflection question from synthetic counts.

“Why Solace suggested this” uses verified evidence references. Consent, current ownership and source revision are checked before a personalized reason appears. The sheet routes to the existing memory controls. Live Gemini suggested breathing for a synthetic conversation, and a second live turn used an approved grounding preference. Deleting that preference removed the personalized reason. The authenticated tests also covered forged provider choices, consent and deleted sources.

[Empty dark weekly story](screenshots/premium-expansion/weekly-story-empty-dark-320.png) · [Populated light weekly story](screenshots/premium-expansion/weekly-story-populated-light-430.png)

## Milestone 4 · Sound mixer and milestones

Explore opens the ambient mixer with four original loops, independent volumes, master playback, one saved favorite and an optional stop timer. The favorite uses a validated account-scoped preference record. App backgrounding, screen exit and voice audio release the mixer. Playback starts only after an explicit action.

The browser played two decoded layers with advancing audio clocks and independent gains, saved and restored a favorite after reload, and stopped both layers when hidden or when leaving. The 15-minute timer scheduled 900,000 ms. The browser test accelerated that one timeout and verified both layers stopped. Desktop drag and keyboard adjustment updated the visible and accessible slider values. A separate dark viewport test saved one real check-in, displayed the earned date and dismissed its celebration. Reload retained the milestone and did not replay the dialog. Existing qualification rules and local dates remain the source of truth. Celebration dismissal is remembered on the device for that account.

[Playing mix in light mode](screenshots/premium-expansion/ambient-mixer-playback-light-430.png) · [Desktop volume slider](screenshots/premium-expansion/ambient-mixer-range-desktop-900.png) · [First Check-in in dark mode](screenshots/premium-expansion/milestone-first-checkin-dark-320.png)

## Milestone 5 · Widget preparation

The app recognizes four allowlisted links: `solace://widget/today`, `/breathe`, `/affirmation`, and `/reminders`. A signed-out launch waits for authentication before opening a destination. Links carry no account identifiers, text or tokens. The native Expo config test verifies the scheme and the absence of an App Group entitlement.

The widget extension is blocked here. This workspace runs Windows, has no Xcode or generated iOS target, and has no verified signing team or App Group provisioning. On an eligible Mac build, generate the iOS project, add a WidgetKit extension, and provision a shared App Group for both targets. Keep that capability out of the Personal Team build. [Apple WidgetKit strategy](https://developer.apple.com/documentation/widgetkit/developing-a-widgetkit-strategy) · [Apple App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups) · [Provisioning capability matrix](https://developer.apple.com/help/account/reference/supported-capabilities-ios)

Publish only a dated affirmation, next enabled reminder time and coarse daily completion status to the shared container after authentication and widget opt-in. Clear it and request a timeline refresh on logout, expiry, account switching or deletion. Verify the signed extension in light and dark modes, the signed-out display, and all four destinations on device.

## Integrated evidence

- **Live chat journey.** A disposable Chrome account at 390×844 dark requested a synthetic breathing recommendation from configured Gemini, opened its explanation and the existing player, paused and held elapsed time, resumed all 180 active seconds, and saved one completed Moment with feedback. Journey showed one Moment and the same conversation reopened from history. An authenticated retry returned the same completion identity. [Explanation](screenshots/premium-expansion/flagship-chat-explanation.png) · [Saved Moment](screenshots/premium-expansion/flagship-moment-saved.png) · [Journey](screenshots/premium-expansion/flagship-journey-updated.png)
- **Voice Talk.** Chromium used a synthetic microphone file to exercise denied and granted permissions, actual recording, live Gemini transcription, editable review and explicit send. The live reply persisted to the same chat. Mute, speech playback start and Stop worked. [Voice Talk](screenshots/premium-expansion/voice-talk-verified.png)
- **Daily Pause.** A fresh browser account saved a real check-in, chose Rest for five minutes, skipped with no completion credit, reloaded, resumed, disabled and re-enabled the ritual, then saved one 300-second practice with an accelerated monotonic test clock. Today showed two of three recorded steps. Historical helpfulness now requires an approved memory tied to that session for both chat and Daily Pause. [Daily Pause](screenshots/premium-expansion/daily-ritual-verified.png)

## Feature checklist

| Feature | Status | Verification boundary |
| --- | --- | --- |
| AI → Moment → Journey | Fully implemented and end-to-end verified | Live browser flow plus authenticated backend replay and owner isolation. |
| Expressive companion | Implemented but not fully verified | Existing artwork, compact chat and distinct foreground cues. Native interruption and motion behavior still require device coverage. |
| Voice Talk | Implemented but not fully verified | Browser recording, configured Gemini, review, persistence and stop verified. Native microphone, audio routing, headphones and Bluetooth remain open. |
| Personalized Daily Pause | Fully implemented and end-to-end verified | Browser choice, skip, disable, restart, completed Moment and real progress. SQLite persistence and account isolation verified. |
| Weekly story | Fully implemented and end-to-end verified | Browser saved lifecycle and separate configured Gemini generation. |
| Explainable recommendations | Fully implemented and end-to-end verified | Browser sheet, real provider, and consent, deletion and source-validation checks. |
| Ambient sound mixer | Implemented but not fully verified | Browser simultaneous playback, volume, timer callback, background pause and saved mix. Native audio interruptions and device routing remain open. |
| Milestone celebrations | Fully implemented and end-to-end verified | Browser real unlock, earned date, dismissal and no replay after reload. |
| iOS widget | Blocked | App-side link routing is implemented. WidgetKit target, shared data and installation require eligible Xcode signing. |

The expansion uses existing chat, Moment, weekly insight, preference and record endpoints. The transcription endpoint also supports configured Gemini and can cancel provider work on disconnect. The existing SQLite JSON records accept ritual settings and a separate favorite mix, and the weekly writer guards against a second record for the same account and week. No table migration or new external runtime dependency is required.

The main interface changes are in `Core`, `Companion`, `Moments`, `VoiceTalk`, `VoiceControlsImpl`, `Discover`, `DailyRitualOptions`, `Journey`, `WeeklyStory`, `Wellness`, `RecommendationExplanation`, `AmbientMixerImpl` and `MilestoneCelebration`. `App.tsx` and `widget-links.ts` handle the new routes and the signed-out link handoff.

## Final build and regression checks

- Client and server type checks, formatting, 171 client tests across all 12 suites and 84 backend tests passed. The final consent changes passed their focused routine and chat-evidence regressions. The backend test command also compiles the server.
- Production web, Android and iOS JavaScript exports passed. Android debug and release Gradle builds passed with JDK 21 and arm64/x86_64 support. The 61,754,607-byte release archive contains a 2,033,980-byte Hermes bundle and the reserved HTTPS QA origin. The local API origin is absent. The reserved origin cannot support release sign-in.
- Android 13 Pixel 3a emulator debug QA verified the native breathing deep link held at Welcome before login and opened its destination afterward. Native player callbacks also switched the two-layer mixer from Play to Pause and back. The emulator was configured without audio output. [Signed-in link destination](screenshots/premium-expansion/android-emulator-widget-handoff.png) · [Native mixer](screenshots/premium-expansion/android-emulator-mixer-playing.png)
- The separately installed Android release reached Welcome and onboarding on the emulator with Metro stopped and its forwards removed. [Packaged launch](screenshots/premium-expansion/android-emulator-release-welcome.png)
- The final physical Android pass was attempted after the builds and automated checks. ADB returned `no devices found`, and the phone did not reconnect during the final check window. Physical-device behavior for this expansion remains unverified.

The current build still needs a reachable production HTTPS API and physical release acceptance. On the installed release, verify fresh sign-in, native microphone and playback interruption, headphones and Bluetooth, reminder scheduling and tap routing, long foreground sessions and the final demo. Native iOS verification requires Xcode, eligible signing and an installed iOS build.
