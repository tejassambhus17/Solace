# Solace first-launch walkthrough

## Single-screen introduction and optional goals

The signed-out welcome presents four illustrated features and distinct Get started and Log in actions. About can replay the welcome without touching device or account progress. The device still saves the introduction decision before entering auth. After authentication, pending accounts can choose goals or use Skip for now to finish without preferences. The API stores an empty goal list and account completion together. A retry cannot erase later edits. Chosen goals keep the existing personalized first action, with a direct path to Today. Profile shares the redesigned goal cards.

The welcome and picker use the existing logo, illustration assets, typography and lavender accent on white or black. Scrollable content and safe-area-aware actions support short screens. Goal choices retain semantic checkboxes, keyboard selection on web, and reduced-motion selection feedback.

The final Chromium preview rendered both screens at 320, 390 and 430 px in both themes. The short 320 px view keeps the welcome headline, the first two feature titles and Get started in the initial viewport. All four tiles fit at 390 and 430 px. The first render review caught images inheriting their intrinsic heights on web. Explicit responsive photo heights corrected the crops and brought the content back into view.

| Screen | Light | Dark |
| --- | --- | --- |
| Welcome | [320 px](../work/onboarding-redesign/final/intro-light-320.png) · [390 px](../work/onboarding-redesign/final/intro-light-390.png) · [430 px](../work/onboarding-redesign/final/intro-light-430.png) | [320 px](../work/onboarding-redesign/final/intro-dark-320.png) · [390 px](../work/onboarding-redesign/final/intro-dark-390.png) · [430 px](../work/onboarding-redesign/final/intro-dark-430.png) |
| Goal picker | [320 px](../work/onboarding-redesign/final/goals-light-320.png) · [390 px](../work/onboarding-redesign/final/goals-light-390.png) · [430 px](../work/onboarding-redesign/final/goals-light-430.png) | [320 px](../work/onboarding-redesign/final/goals-dark-320.png) · [390 px](../work/onboarding-redesign/final/goals-dark-390.png) · [430 px](../work/onboarding-redesign/final/goals-dark-430.png) |
| Selected goals | [390 px](../work/onboarding-redesign/final/goals-light-390-selected.png) | [390 px](../work/onboarding-redesign/final/goals-dark-390-selected.png) |

The browser run used the current Express API and a disposable SQLite fixture. It verified first signup without a Today flash, multi-select across a theme change, selection retention after a failed save, and the personalized first action after retry. A completed account bypassed both steps after reload and sign-in. Profile edits and About replay preserved saved state. A second pending account could skip with exactly zero goals and retain its records without seeing the other account’s data. [Browser results](../work/onboarding-redesign/final/browser-result.json) · [First recommendation](../work/onboarding-redesign/final/recommendation-dark-390.png)

TypeScript, Prettier, 187 server tests, 50 navigation tests, and 91 session-state tests passed. The changes are in source and a local web preview. The updated client and optional-goals API need to ship together when released. Native builds, device verification, and deployment were held.

## Earlier five-page walkthrough

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
