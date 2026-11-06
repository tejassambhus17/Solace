# Solace physical-device QA

## Prepare both devices

1. Use a release or profile build on an Android phone and an iPhone. Build with the intended HTTPS API origin and a disposable account. The Windows Android preview script is `scripts/build-android.ps1 -ApiUrl $apiUrl` with `$apiUrl` set to that HTTPS origin. For an iPhone, use the existing app scheme in Xcode on a Mac with the intended API origin and signing configured. Close Metro before launching each build. Confirm the app starts, signs in, and restores the session after a cold restart.
2. Record device model, OS, display refresh rate, build commit, build type, API environment, appearance, text size, Reduce Motion and battery/thermal conditions. Keep these the same across builds. Use synthetic messages and entries in any screen recording.
3. Run one small-layout pass, one larger-layout pass, light and dark, normal and large text, and with Reduce Motion on. Repeat touch and animation timing with Reduce Motion off. Compare three equivalent cold launches and three warm runs.

## Interaction checklist

| Flow | Steps and pass condition |
| --- | --- |
| Tabs | Tap Today → Solace → Explore → Journey → Profile → Today five times rapidly, then repeat in reverse. Every tap selects the corresponding route, the Android highlight remains circular and centered, and iOS shows one native selected indicator. Repeat after closing the keyboard, leaving a player and resuming the app. |
| Today | Select all five mood petals in both themes. Art and order match. Scroll from the hero to the final action and check that it clears the floating bar. Open a Moment, return, and check that art and layout do not flash. |
| Companion | Open welcome, start a new chat, send multiple synthetic messages, reopen history, and switch tabs while a reply is pending. There is one coherent lotus artwork, compact chat remains readable, and one response is saved. At the latest message, check that incoming replies stay visible. While reading old messages, ensure new content does not pull the list to the bottom. |
| Keyboard and long chat | Show and dismiss the keyboard several times, compose a multiline draft, open a history item, scroll quickly through a long transcript and return. The composer stays above the keyboard, draft is preserved and the selected tab remains correct. Verify Android hardware back and iOS swipe-back. |
| Voice | Deny microphone access once, allow it and record, cancel a recording, send a recording, play and interrupt a reply, then exit or switch tabs during processing/playback. Verify real speech, synchronized indicators and no background recording or playback. Repeat using Bluetooth/headphones, and during an audio interruption. Verify text fallback if the provider or network fails. |
| Journal | Write and edit a long entry, navigate away mid-edit, return, save and reopen after a restart. Check search and Favorites, deep list position after open/back, keyboard and final action, and optional Journal unlock if enabled. |
| Explore and techniques | Open and close both lower menus, use a category, scroll vertically and swipe a carousel, open a timed practice, then return. Verify saved/filter state and that the final item can move above the tab bar. |
| Moments, breathing and mixer | Start a timed practice with sound off, enable sound, pause, resume, restart, background and return, then finish one and abandon a second. Pause freezes the animation, clock and sound. A completed activity creates one record, abandonment creates none, and the mixer releases audio on stop or exit. Check Reduce Motion leaves meaningful phase and timing feedback. |
| Journey | Change period, move calendar dates, deep-scroll history, open and return, and confirm the completed Moment and duration. Trigger a test milestone once and check that leaving the screen stops the animation. |
| Profile and resume | Change appearance, test settings with large text, enable device lock and Journal lock if available, background briefly, then beyond the lock threshold. Verify no private-content flash, an understandable cancellation state, clean unlock, and a smooth return to the previous route. |
| Network and recovery | Disable network during a message and a save. Restore it and retry. Expect an actionable error, retained input, no duplicate records and no synthetic provider success. |
| Repeated cycles | Repeat tabs, chat/editor open/close, keyboard, and a start/stop audio loop for three rounds of 20 cycles. Wait 30 seconds after each round, record memory and check that sound, timers or recording do not outlive their screens. Investigate repeatable upward growth or increasing stalls. |

## Capture comparable traces

- Android: obtain the installed application ID with `adb shell pm list packages solace`. Use `adb shell dumpsys gfxinfo PACKAGE reset` before a run, `adb shell dumpsys gfxinfo PACKAGE framestats` after it, and `adb shell dumpsys meminfo PACKAGE` after the idle period. Capture a System Trace in Android Studio or Perfetto for repeatable long frames, with main, RenderThread and Hermes JS scheduling visible. [Android dumpsys reference](https://developer.android.com/tools/dumpsys)
- iPhone: profile the installed build from Xcode using Animation Hitches for dropped or late frames, Time Profiler for thread work and Allocations for repeated-cycle memory. Capture matching actions and compare three runs after a warmup. Record `First screen interactive` separately from OS launch reporting. [Apple responsiveness guidance](https://developer.apple.com/documentation/xcode/improving-app-responsiveness)
- File each issue with the device, build, settings, exact action sequence, expected result, actual result and a short scrubbed recording or trace. Classify it as fixed and verified, awaiting physical verification, blocked or still unresolved. Attach profiler evidence for performance claims.
