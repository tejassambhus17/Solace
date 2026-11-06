# Solace gesture navigation QA

## Interaction

The existing Today, Solace, Explore, Journey and Profile controls accept taps and bar-local horizontal drags. The single 36 pt circle tracks the finger between measured icon centers. An 8 pt direction threshold separates taps from intentional horizontal movement. Release chooses the nearest stop. At an exact midpoint it keeps the current tab if that tab is one of the two stops. Horizontal exits clamp to the end stops, and releases more than 20 pt above or below the bar cancel. Vertical intent, multi-touch movement and system cancellation preserve the current route. Selection, accessibility and the tab stack change on release. Reduce Motion keeps direct finger tracking and settles immediately.

The bar retains the existing iOS Liquid Glass host, blur fallback and opaque Reduce Transparency appearance. Android retains its tonal surface and native ripple. One indicator serves each platform. Tracking uses the existing scoped React Native responder and sends transform values without React state updates. Finger events still pass through JavaScript. Native settling and icon feedback use the compositor. Web uses a local touch-end tap path for browsers that omit the synthetic click immediately after a drag, while preserving mouse, keyboard and accessibility activation. [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) · [React Native animations](https://reactnative.dev/docs/animations)

Main-tab changes are immediate and preserve existing stacks and retained roots. Same-tab detail entries use an 8 pt, 155 ms transition. Journal writing and immersive screens remain stationary. The iOS leading-edge gesture recognizes an inward horizontal drag from the first 24 pt of an eligible detail and calls the existing router on release. It leaves the bar, vertical gestures, open keyboards, locked Journal and immersive confirmation flows alone. Android uses the existing system Back action and route-specific immersive guards.

Nested navigation ignores identical destinations, unwinds to existing ancestors with their saved view state and prevents a stale Back callback from popping another tab or record. A single URL subscription now handles experience and widget routes after sign-in and unlock. Reminder links start from Today. Native notification delivery remains a device check.

The supplied swipe recording was absent from the accessible attachments. The available Android clips were from earlier tab-tap, Companion and breathing QA. Implementation followed the specified drag interaction and the existing Solace styling.

## Route coverage

| Area | Reviewed source routes | Runtime evidence in this pass |
| --- | --- | --- |
| Today | Check-in, Daily Pause, featured Moment, quick actions and Journey links | Today tab, widget affirmation link and hardware Back to Today on Android. |
| Solace | Companion, voice, history, Journal editor and saved entries, and recommendation handoffs | Chrome verified a pending chat reply across two switches, retained composer and exact Journal draft restoration across tabs and Back. The welcome artwork layers leave together when compact chat appears. |
| Explore | Categories, Moments, guided techniques, wellness tools, timed practice and player | Chrome swiped the category rail without changing tabs and opened and closed the timed player. Android opened the Box breathing deep link, selected Explore and returned to the Techniques list using system Back. |
| Journey | Calendar, weekly reflections, goals, milestones and saved activity history | Tab selected through taps and drags. Provider regression tests verified ancestor restoration and record-scoped Back. |
| Profile | Edit Profile, settings, appearance, reminders, memory, privacy and support | Android Settings opened and returned with system Back. Light and dark, large viewport and compact viewport navigation were exercised in Chrome. |

## Performance evidence

- Chrome recorded the old circle staying at approximately x=55 as the finger moved from x=89 to x=329. After the change, all seven sampled circle centers matched the rounded finger coordinates.
- Warm Chrome sampling used three rounds of 25 taps. One instrumented baseline grew from 502 to 517 listeners with 981 DOM nodes stable. The final build stayed at 507 listeners and 982 nodes with one document, one state fetch and zero listener registrations left over. Direct, scoped web media-query subscriptions resolved a listener identity collision on repeated React Activity reveals. Native preference subscriptions use the existing API.
- Chrome touch release to selected DOM state was variable. The instrumented baseline p50 was 7.0 / 5.4 / 4.5 ms and p95 10.2 / 8.4 / 5.4 ms. The final run p50 was 7.6 / 6.5 / 6.2 ms and p95 15.2 / 13.9 / 13.2 ms. These browser timings include instrumentation and were higher in the final run.

The Android comparison used the same 1080 × 2220, API 33, 60 Hz emulator with dark appearance, default text size and normal motion. Each warm debug run used ADB to tap the five tabs in order five times with 120 ms pauses. `dumpsys gfxinfo` recorded the first reported app-window values below. Each run ended on Today. The different frame populations and process swap levels limit the comparison. The sample shows lower tail frame times and lower process PSS in this run, with continuing debug jank. Physical release frame pacing, tap latency and long-session memory remain open.

| Metric over three runs | Before | After |
| --- | --- | --- |
| Frame time p50 | 32 / 38 / 28 ms | 28 / 27 / 29 ms |
| Frame time p95 | 57 / 85 / 48 ms | 38 / 36 / 42 ms |
| Captured frames | 233 / 198 / 241 | 265 / 268 / 244 |
| After-run PSS | 327,761 / 343,560 / 359,071 KiB | 310,478 / 311,861 / 320,605 KiB |

## Tests and build status

- TypeScript and formatting checks passed. `npm run test:navigation` passed six geometry, direction, clamping, nearest-stop, RTL and edge Back tests. `npm run test:session-state` passed 59 tests in the integrated tree. The new router regressions reproduced before the fixes. Native configuration and reminder checks passed eight each, and the server suite passed 103 integration tests.
- Chrome production export passed five-tab taps and keyboard activation, slow and quick swipes, reversal, both sides of a midpoint, vertical rejection, system cancellation, outside release, immediate tap after drag, rapid distant selection, resizing, light and dark and Reduce Motion. One selected tab remained exposed throughout the run.
- The Android API 33 emulator passed slow and fast swipes, nearest-stop settling, vertical rejection, normal taps, keyboard dismissal, draft restoration on foreground resume, and experience/widget links with Back history. Gesture-mode edge Back returned to the Techniques list. The visible three-button Back control returned from Settings. Tab swipes also passed with three-button navigation, 1.3× text and Reduce Motion, and both appearances were exercised. Emulator settings were restored.
- Production web, Android and iOS JavaScript exports passed. Xcode, an iOS simulator and physical-device testing remain unavailable on this run.
- Android `:app:assembleRelease :app:lintVitalRelease` passed. The locally signed x86_64 APK contained a 2,229,128-byte Hermes bundle with the reserved HTTPS QA origin. The emulator cold-launched to Get started with Metro stopped. A reachable HTTPS API is still required for authenticated release interaction profiling.

## Changed files

- `src/Navigation.tsx`, `src/navigation-motion.ts`, `src/NavigationDetail.tsx` and `App.tsx` implement the gesture, transition and link changes.
- `src/store.tsx` fixes duplicate destinations and Back ownership. `src/Companion.tsx` fixes the web preference listener lifecycle.
- `scripts/test-navigation.cjs`, `scripts/test-session-state.cjs`, `scripts/runtime.cjs` and `package.json` cover regressions and register the test command.

The navigation changes were tested in the integrated working tree. The isolated source commit includes only the new navigation and listener changes. The widget-specific App changes remain beside the pre-existing local widget implementation.

## Device acceptance

Run the [physical-device navigation checklist](PHYSICAL_DEVICE_QA_CHECKLIST.md#gesture-navigation-and-nested-transitions) on an iPhone and an Android phone. iOS Liquid Glass compositing, iOS leading-edge Back, VoiceOver and TalkBack, production frame pacing and long-session native memory remain open. Android currently uses the portrait activity setting. The viewport rotation test applies to web.
