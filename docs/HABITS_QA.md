# Solace Habits

Solace Habits adds private scheduled goals, progress history and a growing garden to the existing five-tab app. The garden uses existing Solace artwork and changes through Seed, Sprout, Growing, Blooming and Flourishing at 0, 1, 5, 12 and 25 earned habit-days.

## Navigation

| Entry | Destination |
| --- | --- |
| Explore → Healthy Habit Builder | Your habits dashboard, then Add habit, Habit library, details, insights or garden |
| Today → Today’s Habits | Up to three eligible habits with quick logging, plus View all habits and selected details |
| Journey → Habit Progress | Habit insights, with weekly, monthly and individual history |
| Companion → Plan a habit or Explore a suggested habit | A proposal sheet, followed by an editable create or edit screen after the user chooses Review |
| Profile → Habit reminders | Reminder preferences for active and paused habits through the existing notification coordinator |
| Local habit notification | Explore → Your habits → the identified active habit, or the dashboard when the habit is unavailable |

## Data and calculation rules

- Habits, progress and garden records use the authenticated owner and the existing SQLite records store. The `/api/habits` routes validate configuration and writes. `/api/state` and account export include the collections. Existing Journey and Moment records keep their original meaning.
- A habit’s creation time zone anchors its calendar. Daily and weekday schedules count actual due days. Flexible weekly targets count up to the specified quota and available days elapsed. They show separately from the fixed daily denominator. Pauses, archives and schedule or goal changes use dated revisions. An already logged day retains its original rules.
- Progress writes carry an expected revision and an absolute amount. Repeat requests cannot create a second occurrence or earn a second garden credit. Corrections update analytics. A linked breathing Moment must be complete, owned, recorded on the same habit day, and previously unclaimed. Its minutes are credited once and remain separate from Journey’s Moment totals.
- Pausing or archiving preserves history. Deleting a habit removes its configuration and history. Earned garden growth remains as an account aggregate. Minimal receipts prevent retries from recreating deleted records or crediting an already linked activity. Account deletion removes all of these records.
- Local reminders use the device clock and time zone. Fixed weekdays schedule those days. Daily and flexible weekly habits can use daily nudges. The habit calendar keeps its creation zone when travelling. Saving an enabled reminder for the first time or explicitly retrying may ask permission. A denied or failed native schedule leaves the habit saved and reports that delivery needs attention. [Expo notification trigger behavior](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)

## Companion and privacy

The Companion assistant supports a starter, small routine, simplification, frequency adjustment, restart and a short progress reflection. It uses the existing configured provider and labels built-in guidance when live AI is unavailable. Provider responses are constrained to validated proposals. Reviewing a proposal opens an editable form. Habit creation and changes require a separate explicit Save. Optional progress context requires personalization consent and the user’s selection. The safety route remains in place for urgent messages.

## Verification and remaining device checks

- All 114 backend tests passed. They cover SQLite reopen, cross-account isolation, export and account deletion, validation, retries, revision conflicts, schedule and goal history, calendar boundaries, breathing link deduplication and monotonic garden growth.
- The configured provider returned a valid habit proposal in a disposable live smoke test. The account had zero habits before explicit approval and one after Save. No production account data was used.
- All 220 client and runtime tests passed. Notification coordinator regressions cover replacement and cancellation, denied permission without automatic prompting, and validated notification taps. Session tests cover failed writes, repeat taps and preservation of the active conversation through Habit Insights.
- The production Chrome build passed 11 integrated scenarios using a disposable Express and SQLite API. Tested 390 × 844 dark and 320 × 568 light with Reduce Motion. The run verified Explore, custom and starter creation, Today write failure and retry, partial quantity and completed duration, undo, weekly schedule and reminder changes, Profile reminder disable, pause/resume/archive/delete, Journey weekly and monthly insights, garden growth and reload. The Companion review flow left the account unchanged until explicit Save.
- Companion-specific browser checks also covered the prefilled chat context, declining a proposed edit without changing its record, and a consented reflection using one confirmed completion.
- On the Android API 33 emulator, Profile saved a daily habit reminder after permission was enabled. The OS delivered it while the app was backgrounded. Tapping the notification opened the owned habit, completion saved through the API, and Back returned to the dashboard.
- Android testing exposed a shared Expo notification-channel warning. The channel passed `default` as a custom sound filename. Omitting the channel override uses the Android system sound. On retest the app restored the signed-in habit and retried and disabled device scheduling without the warning. Today’s undo and repeat completion passed. A cold restart at 130% system text size restored progress, and Today opened the dashboard with that progress visible.
- App and server TypeScript checks and the repository Prettier check passed. Expo produced production JavaScript bundles for web, Android and iOS. Android `assembleRelease` and `lintVitalRelease` passed. The isolated x86_64 APK included a Hermes bundle and a reserved HTTPS API origin and opened to Welcome with Metro stopped. Signed-in release testing needs a reachable HTTPS API. A native iOS build and iOS simulator checks require macOS and Xcode.
- On physical Android and iOS, enable and deny reminders, change a time, background the app through a scheduled delivery, tap it and verify the habit. Pause, archive and sign out and verify pending notifications are removed. Repeat after a device time-zone change. Check TalkBack or VoiceOver, large text and Reduce Motion on the dashboard, editor and garden.

## Files

- Shared contract and API — `server/src/habit-contract.ts`, `server/src/habits.ts`, `server/src/app.ts`, `server/tests/habits.test.ts`.
- AI — `server/src/habit-ai-contract.ts`, `server/src/habit-ai.ts`, `server/tests/habit-ai.test.ts`, `src/screens/HabitAssistant.tsx`, `src/screens/Core.tsx`.
- Screens and entry points — `src/screens/Habits.tsx`, `src/screens/HabitsEditor.tsx`, `src/screens/HabitsInsights.tsx`, `src/habits-ui.tsx`, `src/screens/HabitEntryPoints.tsx`, `src/screens/Discover.tsx`, `src/screens/Explore.tsx`, `src/screens/Journey.tsx`, `src/screens/ProfileHome.tsx`.
- State, routes and reminders — `App.tsx`, `src/routes.ts`, `src/store.tsx`, `src/notifications.ts`, `src/habit-reminders.ts`, `scripts/test-session-state.cjs`, `scripts/test-reminders.cjs`.
- Documentation — `README.md`, `docs/REQUIREMENTS.md`, `docs/VERIFICATION.md`, `docs/HABITS_QA.md`.
