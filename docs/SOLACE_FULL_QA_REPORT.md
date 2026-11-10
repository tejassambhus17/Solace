# Solace full QA report

## Executive summary

The pass traced 68 screen and workflow groups from the registered route switch, entry controls, state gates and overlays. The [screen inventory](QA_SCREEN_INVENTORY.md) distinguishes rendered, automated and source-only coverage. The [test matrix](SOLACE_QA_TEST_MATRIX.md) records the specific scenarios exercised. Representative browser flows covered all five tabs and both themes, including narrow and enlarged layouts. A separate one-account, one-turn-per-mode Azure smoke test verified live text and Realtime audio. Release readiness remains gated on the physical-device checks.

## Confirmed defect

| Issue | Severity | Reproduction and root cause | Fix and retest |
| --- | --- | --- | --- |
| QA-01 · One failed status poll ended healthy Live Voice calls | P1 | In a connected Chrome WebRTC fixture, return one HTTP 503 from the authenticated status endpoint. The polling loop sent the transient request error straight to terminal cleanup. Microphone state changed from live to ended. [Before](../work/full-qa/voice-heartbeat-before.json) | An abortable 600 ms backoff retries the same status request once for a network error or HTTP 408/502/503/504. Authorization errors and terminal session events take the normal path. The existing server lease and billing controls still govern the call. Chrome confirmed the same call survived one 503 and that two consecutive 503s ended one call and released the microphone. Unit tests cover success, retry exhaustion, missing session and cancellation. [After](../work/full-qa/voice-heartbeat-after.json) |

Changed code is in [useRealtimeVoice.ts](../src/useRealtimeVoice.ts), [realtime-voice-state.ts](../src/realtime-voice-state.ts) and [test-voice.cjs](../scripts/test-voice.cjs). No backend contract or production setting changed. The older voice-menu and Grounding-title assertions were fixture drift. The habit editor passed when exercised with a pointer click and a fresh selection. These were not counted as app defects.

## Previous eight fixes

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Today bottom rail | All five tabs rendered at 320 light and 430 dark. No separate Today-only strip was observed | Browser compositing. Native system insets and transition flashes remain open. [Root run](../work/full-qa/audit-6.log) |
| Wellness Tools | No Browse All Practices, Grow filter and direct reflection route work | Browser and current registry. [Tool run](../work/full-qa/timed-retest.log) |
| Explore filtered cards | Breathe rendered with illustrations. All five non-All filters passed route fixtures, and the All card stack rendered | Browser and navigation. [Breathe](../work/full-qa/audit-0/explore-breathe-dark.png) |
| Little Milestones | Earned/locked section and View All route work | Browser and deterministic records. [Dark](../work/full-qa/audit-0/journey-milestones-dark.png) |
| Reflection | Aligned optional card, draft retention and save in both themes | Browser scrolling and footer. Native IME remains open. [Light](../work/full-qa/audit-0/reflection-light.png) |
| Companion input | Grows from 48 px and caps at 96 px on the 320×400 browser, or 132 px at 393×740. End caret stays visible and the field contracts | Browser only for geometry. [Results](../work/full-qa/audit-1/composer-result.json) |
| Explore canvases | Guided Techniques, Wellness Tools, and Timed Practice have black dark-mode page canvases and cream light-mode canvases | Browser. [Wellness Tools dark](../work/full-qa/audit-0/wellness-tools-dark.png) |
| Habits and Garden | Seed stage has no floating decoration and actual completions update Garden | Browser and local persistence. [Garden dark](../work/full-qa/audit-0/garden-dark.png), [habit results](../work/full-qa/audit-4/browser-result.json) |

## Performance

On one production-mode Chrome export at 360×740 dark, the harness made 20 tab selections with zero API fetches after the starting screen was ready. Selection confirmation took 80–166 ms including DevTools and pointer delays. Chrome reported 598 ms cumulative script execution and 34 layouts over the measured interaction window, plus long tasks of 150, 71 and 61 ms across startup and interaction. Heap snapshots before and after retained-tab visits were 9.2 and 21.3 MB. The sample did not control garbage collection or isolate image memory. It cannot establish a memory leak, frame rate, native startup cost, or a before/after optimization gain. The voice retry is a reliability fix. No speculative visual-performance edits were made. [Raw metrics](../work/full-qa/perf/composer-result.json)

## Checks executed

- App and server TypeScript, repository Prettier check, and the 275 app/tooling tests passed. The dev startup tooling test needed local socket access and passed on the isolated rerun. The 148-test backend integration suite passed.
- Expo production-mode exports for web, Android and iOS passed. Android Gradle `:app:assembleRelease` and `:app:lintVitalRelease` passed. The APK has the same signing certificate as the prior Azure artifact, 16 KB ZIP alignment, embedded Hermes and native WebRTC, and the intended public HTTPS endpoint. [Package verification](../work/full-qa/artifact-check.json)
- Browser flows used local SQLite, Chrome DevTools and synthetic data. Existing fixture selectors were updated in the scratch runs to match the current navigation and titles. Tests that asserted only source behavior were recorded separately from rendered checks. [Test matrix](SOLACE_QA_TEST_MATRIX.md)

## Security and accessibility

- Source and integration checks covered hashed sessions, native SecureStore use, request bounds, owner-scoped data, password recovery, OAuth callback checks, no-store API responses, and revoked session access. Realtime tests cover per-user/global budgets, concurrent calls, timeout, stale authorization and hangup reservation. Journal refusal produced no POST in either browser theme. Approved excerpts and memory exclusions are covered separately by backend tests. No private entries or real user data were sent in the provider smoke test.
- Browser coverage included reduced motion, enlarged text, pointer reachability, keyboard text entry, visible focus, empty and loading states, and several short viewports. This did not certify VoiceOver, TalkBack, Dynamic Type, focus trapping across all sheets, or contrast for every artwork/text combination.
- The Azure health probe returned HTTP 200 over HTTPS. The disposable production test confirmed login, one live text reply, one WebRTC turn, transcript persistence, hangup, and account token revocation. Production quotas, database restarts, credentials and infrastructure were left untouched. [Sanitized evidence](../work/full-qa/smoke-azure-provider-result.json)

## Platform limits

The notes below describe the original audit environment. The user subsequently reported checking native sign-in and biometrics, Live Voice, navigation and keyboard behavior, and physical installation and launch. The [current release assessment](SOLACE_RELEASE_READINESS.md) tracks native reminder delivery and tap routing as the only open critical gate.

- The final web, Android and iOS Expo bundles exported. iOS Mac SSH timed out in this pass. The earlier unsigned Xcode build is historical evidence only. Final signed iOS launch, Face ID, Dynamic Island insets, keyboard and real audio remain unverified.
- On the Android emulator, installation and the Activity launch command succeeded. The UI probe could not confirm the onboarding screen, so no Android visual or runtime flow is counted as passed. A repeat was stopped when the emulator reported the package already installed. No existing app data was cleared.
- Further checks include production Google login with a disposable Google account, native notifications and tapping a notification, physical long-chat/keyboard behavior, real audio handoff and barge-in, and complete per-screen assistive technology review. Release assessment is **NOT READY FOR RELEASE** while these critical gates remain open.
