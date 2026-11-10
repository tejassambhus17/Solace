# Profile nested screen redesign

## Route inventory and visual baseline

The Profile links use `ProfileHome.tsx` and the existing route switch in `App.tsx`. The browser baseline uses synthetic accounts and the previous four-tab web bundle. Settings reached from Today or another tab keep that tab’s navigation history.

| Screen and route | Current issues in the baseline | New composition | Function to retain |
|---|---|---|---|
| Edit Profile · `account` | The photo, editable fields and sign-in are three visually equal cards. The first viewport does not show a recognizable personal identity. | Scenic portrait area with the actual avatar and an identity form, followed by sign-in and device controls. | Add, remove and change photo, save or reset name, link Google, open Privacy, sign out with pending-write safeguards. |
| Gentle Reminders · `reminders` | The editable time is buried between reminder type and weekday chips. Each saved reminder reads like a settings form. | Time-led schedule with the live 12-hour selection, then explicit day and reminder type controls. Saved reminders lead with the time and delivery state. | Set and edit time, repeat days and type. Save, edit, delete, enable, restore and test notifications. Keep web and device delivery distinct. |
| Reminder clock · `reminders` modal | The clock does its job but its header, columns and current selection look like separate blocks. | Live time readout, named wheel columns, a clear selected row, and one commit action. | Adjust hour, minute and AM/PM. Cancel without writing, confirm, and handle native Back or the accessible dismiss control. |
| What Solace remembers · `memory` | Consent and an empty list occupy most of the first viewport, with the add form visually below both. The same card frame repeats for every record. | Consent dashboard with an explicit policy state, a compact empty state, and an accessible preference editor. Saved entries read as one review list. | Turn personalization on or off, approve, add, edit, remove, clear, and view a record’s source when present. |
| Appearance & preferences · `settings` | Three almost identical theme radios require users to imagine the difference. Sound, haptics, device protection and consent use competing card headings. | Visual theme previews with clear selection, then grouped settings and device protection. | Light, Dark and System selection, ambient sound link, device haptic test, biometric controls, and approved-preference toggle. |
| Privacy & data · `account` with `section: privacy` | Export and permanent deletion are equally prominent boxed actions. Local writing protection appears only when a queue is present. | An export-led account-data area, pending-writing recovery when needed, and a separated deletion area with the existing second step. | Private JSON export, pending-write retry/removal, and explicit account deletion confirmation. |
| Find human support · `support` | Urgent guidance is first, while the directory links sit below the optional country input and most of the reading copy. | Urgent guidance first, two distinct support routes immediately below, then the optional location field. | Existing directory URLs, optional country input without automatic sharing, and Back to the real origin. |
| About Solace · `about` | Equal cards flatten the difference between product identity, safety, privacy and links. Version text is at the end. | Branded scenic introduction with version, then editorial sections for the product, safety, and AI processing. | Keep safety wording, Privacy and human support links, and replay the existing introduction. |
| Habit reminders · `habit-reminders` | Shared Habits schedule management includes list and habit-specific edit states. | The Habits implementation owns the redesign. | Keep the Profile entry point, native scheduling and return route. |
| Introduction replay | Opens the shared onboarding walkthrough. | Reviewed as a linked existing experience. | Preserve replay and return behavior. |
| Biometric lock and recovery | Device settings are embedded in Appearance. System and recovery interfaces are shared. | Retain the installed biometric flow and established recovery screens. | Preserve separate app and Journal controls and native enrollment state. |

## Matched web captures

The previous and redesigned production-mode web exports were opened on isolated local accounts. Dark captures use 360 × 760 CSS pixels. Light captures use 320 × 760. These screenshots show the React Native Web projection. The comparison includes the sections reached by scrolling and the actual modal states.

| Screen | Dark before | Dark after | Light before | Light after |
|---|---|---|---|---|
| Edit Profile | [Before](../work/profile-redesign/before/dark-account.png) | [After](../work/profile-redesign/after/dark-account.png) | [Before](../work/profile-redesign/before/light-account.png) | [After](../work/profile-redesign/after/light-account.png) |
| Appearance | [Before](../work/profile-redesign/before/dark-appearance.png) | [After](../work/profile-redesign/after/dark-appearance.png) | [Before](../work/profile-redesign/before/light-appearance.png) | [After](../work/profile-redesign/after/light-appearance.png) |
| Gentle Reminders | [Before](../work/profile-redesign/before/dark-reminders.png) | [After](../work/profile-redesign/after/dark-reminders.png) | [Before](../work/profile-redesign/before/light-reminders.png) | [After](../work/profile-redesign/after/light-reminders.png) |
| Reminder clock | [Before](../work/profile-redesign/before/dark-reminder-time.png) | [After](../work/profile-redesign/after/dark-reminder-time.png) | [Before](../work/profile-redesign/before/light-reminder-time.png) | [After](../work/profile-redesign/after/light-reminder-time.png) |
| Memory overview | [Before](../work/profile-redesign/before/dark-memory.png) | [After](../work/profile-redesign/after/dark-memory.png) | [Before](../work/profile-redesign/before/light-memory.png) | [After](../work/profile-redesign/after/light-memory.png) |
| Memory, saved | [Before](../work/profile-redesign/before/dark-memory-review.png) | [After](../work/profile-redesign/after/dark-memory-review.png) | [Before](../work/profile-redesign/before/light-memory-review.png) | [After](../work/profile-redesign/after/light-memory-review.png) |
| Privacy & data | [Before](../work/profile-redesign/before/dark-privacy.png) | [After](../work/profile-redesign/after/dark-privacy.png) | [Before](../work/profile-redesign/before/light-privacy.png) | [After](../work/profile-redesign/after/light-privacy.png) |
| Find support | [Before](../work/profile-redesign/before/dark-support.png) | [After](../work/profile-redesign/after/dark-support.png) | [Before](../work/profile-redesign/before/light-support.png) | [After](../work/profile-redesign/after/light-support.png) |
| About | [Before](../work/profile-redesign/before/dark-about.png) | [After](../work/profile-redesign/after/dark-about.png) | [Before](../work/profile-redesign/before/light-about.png) | [After](../work/profile-redesign/after/light-about.png) |

The [baseline manifest](../work/profile-redesign/before/results.json) and [redesigned manifest](../work/profile-redesign/after/results.json) also identify Profile root, Habit reminders, biometric settings, About replay, and the dark privacy confirmation. Habit reminders is owned by the shared Habits redesign.

## Profile verification

- The final browser run captured 27 states with no uncaught errors or measured horizontal overflow among visible controls. It exercised Account to Privacy and Back, a blocked Privacy transition with an unsaved name, name reset and save, JSON export, cancellation of the deletion confirmation, a clock change from 8 PM to 9 PM, saving and reopening the reminder, the empty memory state, adding a saved preference and cancelling Forget, saved theme changes, and About replay. The exported file parsed as JSON and contained the authorized fixture record. The second fixture account and password were excluded.
- TypeScript and the full navigation suite passed, including 47 navigation tests. The reminder suite passed 16 tests, including native scheduler mocks and all 1,440 clock minutes. Scoped formatting passed and the layout detector returned no findings.
- Device biometrics, notification delivery, the system photo picker, live Google OAuth, native file sharing, external resource availability, VoiceOver, and TalkBack remain unverified in this pass. The browser test cancelled destructive confirmations.
