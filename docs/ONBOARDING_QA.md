# Solace first-launch walkthrough

The five illustrated pages introduce Solace, Companion, My Journal, Explore and Moments, and Journey. The walkthrough reuses approved light and dark artwork and supports swiping, progress announcements, Back, Next, Skip and Get started. Smaller screens and larger text can scroll the page content while keeping the actions reachable. Reduce Motion removes animated button-driven paging.

Get started opens account creation. Skip opens login. Both routes use the existing forms, Google sign-in and recovery. Solace saves the walkthrough decision on the installation before navigating. A restored or expired session takes the usual session path, and a recognized existing account marks the walkthrough complete for that installation. Signed-out installations with no prior completion marker can take or skip the new tour once.

After the first interactive sign-in for an account on that installation, the optional personalization step can enable the existing profile preference. Skip leaves the server preference alone. Choosing either action marks the account's prompt handled on the device. Accounts that already enabled personalization keep it. A pending deep link waits until the entry flow completes. Settings and About continue to expose the existing privacy controls.

**Replay introduction** in About Solace opens the same walkthrough and returns to About. Replay keeps the sign-in, completion and personalization choices intact. The walkthrough presents the wellness role and AI availability, keeps Journal excerpt consent separate and uses no microphone, notifications or biometric permission requests.

## Verification

| Check | Result |
| --- | --- |
| Chrome production preview | Eight scenarios passed against the real local Express API with in-memory SQLite. Verified all five pages, forward and reverse swipe, progress, Back/Next/Skip/Get started, signup and login, logout, reload, existing-session upgrade and replay. |
| Personalization and recovery | Two disposable accounts established that Skip leaves the preference off and explicit opt-in updates only the current account. Injected storage and API failures produced recoverable states. |
| Layout and permission prompts | Inspected all five pages at 390 × 844 dark and 320 × 568 light with Reduce Motion. Reframed the Welcome lotus and Explore ring and confirmed all default-size copy and actions fit the compact viewport. Browser instrumentation observed zero media or notification permission requests during the tour. |
| Android emulator | The API 33 debug build passed real swiping, hardware and on-screen Back, all five pages, Get started, a cold restart before authentication, email signup against a disposable API, Skip for now, Today, a signed-in restart and About replay with hardware Back. |
| Automated regressions | TypeScript and formatting passed, as did 90 existing client checks and 103 backend integration tests. |
| Build | Production web, Android and iOS Hermes exports passed. Android debug and release assembly and native release lint passed. The isolated x86_64 release APK opened the Welcome page on the Android emulator with Metro stopped. |

Browser and Android captures are in `work/onboarding-qa/`. All test accounts were disposable. Native iOS and physical-device testing remain open.

## Remaining device checks

- On a small iPhone, use VoiceOver and larger Dynamic Type. Verify that only the current slide is announced, the progress value updates, and Skip and Get started remain reachable.
- Repeat forward and backward gestures in light and dark with Reduce Motion enabled. Confirm signup, returning login and replay Back behavior on an installed iOS build.
- Use a configured HTTPS API to verify authenticated release flows and live Google sign-in. The walkthrough tests use disposable accounts and offline AI configuration.
