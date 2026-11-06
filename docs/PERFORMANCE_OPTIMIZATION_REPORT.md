# Solace performance and motion report

## Scope and baseline

This pass covers Today, Solace, Explore, Journey, Profile, their nested flows, and the shared motion, audio and artwork they use. The repository uses React Native 0.88.1, Expo SDK 58, React 19.3, Hermes, a custom router, React Native Animated, and React Native Image. The five-tab shell and iOS Liquid Glass implementation remain in use.

The Android profiling target was an API 33 emulator at 1080 × 2220 pixels, 440 dpi, 60 Hz, dark appearance and default text size. The tab harness warmed all five tabs, then sent 25 taps in five rounds with 120 ms between shell input commands. It checked that Today was the only selected tab after each run. `dumpsys gfxinfo … framestats` and `dumpsys meminfo` were captured around each run. This is a diagnostic sample from a Metro-backed debug build on a shared Windows host. Reported frame counts cover the frames Android captured during this workload and cannot be used to infer delivered FPS or touch latency.

The pre-change scheduler trace covered 16.58 seconds. It attributed approximately 9,220 ms of scheduled CPU to the busiest React Native JS thread, 3,825 ms to the app main thread, and 2,029 ms to RenderThread. The longest observed JS scheduling slice was about 229 ms. Thread CPU times can overlap. The trace shows work on both sides of the bridge and cannot attribute it to individual React commits or establish GPU overdraw. An attempt to attach the Hermes sampling inspector failed at the local Metro DevTools handshake. Chrome row counts below measure rendered browser rows, independently of the native frame sample.

## Bottlenecks and changes

| Area | Root cause and change | Status |
| --- | --- | --- |
| Tabs and startup | Retain the Solace surface and preserve conversation scroll while leaving the tab. Keep the tab surface mounted through keyboard and immersive transitions. Memoize the tab controls and drive the single fixed circular spotlight with one short native transform that snaps to the selected route on geometry and lifecycle changes. Start session restoration alongside font loading. | Implemented. Emulator route-selection and release startup checks are separate from physical Liquid Glass and touch-latency checks. |
| Companion and chat | Move repeated lotus motion off JS phase restarts, keep artwork and decorative layers together, window the inverted transcript, and limit auto-follow to readers near the latest message. Preserve input, transcript position and conversation state. Pause or cancel invisible voice and animation work. | Fixed and verified in browser regression. Native keyboard, microphone and playback timing await device QA. |
| Journal and Journey | Large saved history rendered all rows and could clamp a deep scroll position on return. Use windowed lists, apply pending scroll offsets after sufficient content is measured, and cancel pending restoration when the reader takes control. Keep existing filters, record destinations and entry actions. | Fixed and verified in a synthetic browser session. |
| Today, Explore and Techniques | Replace per-frame disclosure height updates with normal layout and a short native-opacity reveal, retaining both Explore menus. Use size-appropriate art, stable mood-petal mappings, and deduplicated passive scroll updates. | Fixed and verified for Explore controls in the browser. Cross-device rendering awaits device QA. |
| Moments and guided breathing | Update elapsed labels on whole seconds and drive the breathing visual from native phase transforms. Freeze phase, timer and sound when paused or backgrounded. Restart from a consistent clock and avoid counting abandonment. | Fixed and verified in browser completion, pause, resume, restart and abandonment checks and unit tests. |
| Audio, voice and celebrations | Load ambient tracks on demand, keep mixer position changes out of React rendering, avoid redundant updates, and limit recording label updates to seconds while the meter uses native transforms. Clean up recording, speech and animation ownership on hide or exit. Scope milestone motion to its foreground presentation. | Browser cancellation and ambient playback passed. OS audio interruptions, Bluetooth, native TTS and haptics await device QA. |
| Profile and shared artwork | Keep the existing sized avatar path. Reuse smaller variants for small brand art and journal cards. Remove two unreferenced artwork imports from the production graph. | Source and export checks passed. Profile settings transitions and image memory await device QA. |

## Measured evidence

| Warm tab workload | Baseline | Optimized |
| --- | --- | --- |
| Normal motion, frame time p50 | 36 / 34 / 32 ms | 29 / 30 / 32 ms |
| Normal motion, frame time p95 | 65 / 57 / 48 ms | 53 / 53 / 53 ms |
| Normal motion, captured frame counts | 15 / 15 / 14 | 242 / 244 / 237 |
| Reduced motion, frame time p50 | 32 / 36 / 29 ms | 25 / 26 / 31 ms |
| Reduced motion, frame time p95 | 48 / 61 / 48 ms | 36 / 38 / 57 ms |
| Reduced motion, captured frame counts | 17 / 15 / 17 | 67 / 51 / 65 |
| Reduced motion, after-run process PSS | 369,432 / 371,656 / 371,578 KiB | 351,873 / 345,813 / 351,831 KiB |

All measured runs ended on the requested tab. The medians are directionally lower across the three debug samples. Frame populations differ sharply, partly because the new indicator and companion run compositor motion. The optimized normal-motion debug runs still reported janky frames. PSS includes retained views, caches and the debug runtime. These samples establish neither a release speedup nor a long-cycle memory bound.

The optimized diagnostic trace covered 20.25 seconds. The busiest JS thread used approximately 8,304 ms of scheduled CPU and its longest observed slice was 117 ms. The main thread used approximately 2,924 ms and RenderThread approximately 7,111 ms. RenderThread work increased in this run alongside the much larger captured frame population. Profile GPU and compositor work on matched physical-device traces before changing the approved layered artwork. GPU values with the emulator's 4,950 ms outlier were excluded from interpretation.

- A previous web preview rendered all 150 Journal rows and all 150 Journey history rows for a synthetic account. At 390 × 844 with dark appearance and Reduce Motion, the optimized build rendered 20 and 23 rows respectively after 650 ms. The Journal and Journey returned to exactly 1,400 and 1,833 px after deep item navigation. Search and Favorites passed. A 4,219-character multiline draft was restored after leaving the editor and could be edited further. Both lower Explore disclosure controls opened and closed at 320 × 640.
- Small petal artwork is now 512 × 468 and 184,208 bytes in small surfaces versus 1,312 × 1,199 and 1,265,008 bytes. Small foliage is 642 × 428 and 116,529 bytes versus 1,536 × 1,024 and 1,506,104 bytes. Both Journal thumbnails are 260 × 336 and are 7,606 and 23,497 bytes. The original larger art remains for its intended uses.
- Dark and light browser scenarios at 320–390 px covered a pending send across tabs, failed send with preserved draft, exactly one saved retry, a restored 80-message transcript, search across 40 saved conversations, repeated opening and closing of the player, and synthetic microphone cancellation across tab changes. The browser tests used disposable synthetic data and the local companion fallback. They did not exercise live AI, real microphone hardware or platform speech.
- The browser also completed Today low mood → grounding → pause → resume → feedback → exact two-second update in Journey → reload. Timed breathing tested audio staying unloaded until enabled, clock and audio pause/resume, foreground policy, reset to zero and abandonment without a completion.
- On the Android emulator, synthetic send, native keyboard dismissal, a draft retained across Journey and Solace, background and resume, and switching from Companion to My Journal passed. The animation setting was restored after testing.
- Android release `am start -W` reported cold launch `TotalTime` of 1,291 / 750 / 665 ms before and 1,455 / 765 / 655 ms after. The optimized APK launched to the welcome action on all three attempts with Metro stopped. These OS timings are noisy and do not measure the first interactive JS frame. The baseline APK included ARM64 and x86_64 while the optimized smoke APK included only x86_64. APK sizes are therefore excluded from the performance comparison.

## Automated and build checks

| Check | Result |
| --- | --- |
| Client and server TypeScript, formatting | Passed. The repository has no standalone JavaScript lint script. |
| Client unit and regression suites | 207 passed, including 13 Moments, 21 voice, 20 progress and 57 session-state checks. |
| Backend integration suite | 103 passed. |
| Production Expo web, Android and iOS exports | Passed. An iOS export verifies the JS bundle and assets. |
| Android `:app:assembleRelease :app:lintVitalRelease` | Passed with local QA signing. The x86_64 APK contained a 2,221,484-byte Hermes bundle with the expected HTTPS origin. Installed and started three times with Metro stopped. |
| Native iOS build, Instruments and physical-device QA | Blocked locally. The Windows host has no Xcode, and physical testing was deferred. |
| Authenticated release-style smoke | Blocked. The local QA APK used a reserved HTTPS test origin. Provide a reachable HTTPS API to run login, provider, and protected-flow checks in the release build. |

## Files changed

- Startup and shared UI — `App.tsx`, `src/Navigation.tsx`, `src/ui.tsx`.
- Companion and voice — `src/Companion.tsx`, `src/VoiceControlsImpl.tsx`, `src/screens/Core.tsx`, `src/screens/ChatDetails.tsx`, `src/screens/VoiceTalk.tsx`.
- Lists and discovery — `src/list-scroll.ts`, `src/screens/Discover.tsx`, `src/screens/Explore.tsx`, `src/screens/Journal.tsx`, `src/screens/Journey.tsx`, `src/screens/Techniques.tsx`.
- Activity and audio — `src/breathing-motion.ts`, `src/moments.ts`, `src/Environment.tsx`, `src/AmbientSoundImpl.tsx`, `src/MilestoneCelebration.tsx`, `src/screens/Moments.tsx`, `src/screens/GuidedBreathingPlayer.tsx`, `src/screens/Wellness.tsx`, `src/screens/AmbientMixerImpl.tsx`, `scripts/test-moments.cjs`.
- Graphics — `assets/petal-compact.png`, `assets/botanical-compact.png`, `assets/journal-thumbnail-dark.jpg`, `assets/journal-thumbnail-light.jpg`.

`8359654` commits the isolated tab, lists and artwork work. `cdb8554` commits the isolated clock, sound and animation lifecycle work. The integrated tree also contains Companion retention, chat, voice and the shared Moment player changes. Those changes overlap existing uncommitted work and were verified in the integrated tree. They remain there for review alongside the earlier edits.

## Remaining verification

The emulator can reveal repeatable behavior and useful diagnostic signals. The physical checklist covers frame pacing, native graphics, memory stability, audio interruptions, keyboard behavior, biometric resume and the standalone authenticated journey. Keep OS, signing, API origin, thermal conditions and the workload consistent when comparing builds. See [physical-device QA](PHYSICAL_DEVICE_QA_CHECKLIST.md).
