# Solace nested design consistency report

The [design audit](SOLACE_SCREEN_DESIGN_AUDIT.md) covers 56 named nested route IDs in 43 workflow groups, including route aliases and shared screens. The five main tabs form the visual reference. Current source inspection, archived native evidence, and new rendered QA are recorded separately.

## Implementation

- `src/ui.tsx` adds the opt-in nested `Screen` variant, `NestedHeader`, and `NestedState`. They use the existing `AppText`, `Card`, spacing, theme and inset system. Back uses a 48 dp target. Long titles wrap, and nested layouts can include lateral safe areas without changing the default screen shell.
- Profile groups appearance, sound, system accessibility guidance, biometric choices and personalization. The theme options stack at larger text sizes. Reminders and privacy separate routine actions from destructive confirmations. Editing a saved memory brings its editor into view. Appearance keeps the direct Profile links out of its settings groups.
- Solace preserves the conversation and floating composer. History, voice transport, Journal entry actions, explicit consent and the habit suggestion sheet use clearer hierarchy and reachable dismissal. The Journal editor, welcome art, and saved record contracts are retained.
- Explore and shared wellness pages use responsive mood and feedback choices, grouped guides and toolkit entries, refined ambient controls, and the common header language. The approved Wellness Tools, Timed Practice, Techniques and Plan/Program designs were retained. Explore's Reflective Check-ins label now opens assessments, and assessment results open the existing habit editor for the suggested habit. An unavailable guide or assessment gets its own recovery state.
- Journey uses activity type tints, readable history rows, a grouped streak setting and milestone list, and clearer goal states. Today entry routes use the refreshed Moments form and Habits screens. Habit forms, details and insights keep the same records and actions, with stronger visual grouping.

## Checklist

Each row identifies the checked route or state. The evidence column distinguishes a rendered entry, an exercised action, and source or earlier verification. See the audit for original ratings.

| Screen or overlay | Disposition | Verification |
| --- | --- | --- |
| Today, Solace, Explore, Journey, Profile | Protected visual references | Production browser baseline comparison at narrow/light and large/dark sizes. |
| Mood check-in, next steps and share review | Refined | Source and current wellness browser QA. |
| Daily Pause customization and recommendation explanation | Retained | Source and routine regressions. |
| Solace Moments composer and result preview | Refined | Current Chrome generated labeled built-in guidance. |
| Moment player, feedback, environment and exit | Retained | Source and current Moment unit checks. [Prior player verification](VERIFICATION.md#guided-techniques-breathing-player). |
| Classic breathing and feedback | Refined | Source and Moment timer tests. The updated feedback route was exercised from grounding. |
| Grounding and exit | Refined | Current wellness browser QA where noted. |
| Habit dashboard, library and details | Refined | Source and habit lifecycle QA. |
| Create and edit habit, save and cancel | Refined | Source and habit lifecycle QA. |
| Habit insights and Garden | Refined | Source and habit lifecycle QA. |
| Habit reminders, list and edit | Refined | Source and habit lifecycle QA. Native notification delivery is separate. |
| Companion chat and add/overflow menus | Menus refined | Current Solace browser QA. Companion composer and artwork retained. |
| Conversation history, search, edit and delete | Refined | Current Solace browser QA and session-state tests. |
| Voice Talk, transcript, discard and recovery | Refined | Current Solace browser QA of entry, mute and return. Voice logic suite. |
| Journal welcome, library and filter states | Purpose-built shell retained | Current Solace browser QA where noted. |
| Journal editor and draft | Existing editor retained | Current Solace browser QA and persistence tests. |
| Journal entry and delete confirmation | Refined | Current Solace browser QA where noted. |
| AI reflection and discussion consent | Refined | Current Solace browser QA verifies dismissal without submission. |
| Companion habit suggestion modal | Refined | Current Solace browser QA verifies open/dismiss. |
| Full catalog, search and category controls | Retained | Source and prior approved layout coverage. |
| Wellness Tools and filters | Retained | Source and current destination smoke. [Prior coverage](VERIFICATION.md#wellness-tools-and-timed-practice--7-november-2026). |
| Timed Practice builder | Retained | Source and all 16 Moment focus/duration tests. |
| Techniques library and detail | Retained | Source and wellness/browser entry checks. |
| Personalized plan, programs and details | Retained | Backend plan tests and [prior rendered completion QA](VERIFICATION.md#wellness-plan-and-guided-programs). |
| Ambient Sound Mixer, timer and saved presets | Refined | Current wellness browser QA and API owner-isolation regression. |
| Reflective check-in library, questions and results | Refined | Current wellness browser QA and navigation regression. |
| Guides, guide detail and Sleep Wind-Down | Refined | Current wellness browser QA where noted. |
| Wellness Toolkit saved and empty states | Refined | Current wellness browser QA and saved toolkit integration tests. |
| Affirmation, Daily Challenge and saved affirmations | Refined | Current wellness browser QA where noted. |
| Journey activity history and mood detail | Refined | Current Chrome route entry, populated and back checks. |
| Saved session detail | Refined | Chrome opened and returned from generated Moment, guided practice, and guide records. |
| Weekly reflection, history and saved detail | Refined | Chrome opened the saved weekly detail and returned. The editor and history also have source and persistence regressions. |
| Personal goal | Refined | Current Chrome lifecycle and backend persistence regressions. |
| Milestones and detail | Refined | Current Chrome route entry and back checks. |
| Milestone celebration | Retained | Source and milestone earning regressions. |
| Appearance & Preferences | Refined | Current Profile browser QA and Android smoke where noted. |
| Edit Profile, Account and Privacy & Data | Refined | Current Profile browser QA. Photo chooser and Google handoff require native/external follow-up. |
| Gentle Reminders | Refined | Current Profile browser QA of settings. Delivery still requires a device. |
| Approved memories and delete/clear confirmations | Refined | Current Profile browser QA and owner-scoping tests. |
| Human Support, About and onboarding replay | Nested settings refined | Current Profile browser QA of route entry. Live external directory handoff is separate. |
| Biometric settings, lock and privacy cover | Settings refinements | Browser platform notice and lock/session tests. Native biometric prompts need device verification. |
| Auth, signup, recovery and onboarding personalization | Retained | Source, backend auth and recovery tests. |
| Global errors, native permissions and unsaved navigation | Existing guards retained | Source, session-state/offline regressions, and covered flow-specific controls. |

## Evidence and limitations

- The before/after comparison rendered all five roots at 320 × 667 light and 430 × 932 dark. Seven screenshots were pixel-identical. The other three showed minor raster differences without a visible layout change. Eight pixels total differed by more than 8 of 255 in any RGB channel, with a maximum difference of 12. [Root comparison](../work/nested-design/root-pixel-diff.json)
- The same Chrome run opened populated Journey history, inspected the saved mood, opened a milestone and returned, and created, paused, resumed and removed a personal goal. The goal's presence and removal were checked against the account's API. Both themes generated a labeled built-in Moment from Today. [Journey results](../work/nested-design/journey-result.json), [history before](../work/nested-design/before-320-light-activity.png), [history after](../work/nested-design/320-light-activity.png)
- On the final export, seven saved-record cases verified the latest-activity card opened the right Moment, guided practice, Journal entry, assessment, weekly reflection, resource or habit detail and returned to Journey. [Saved-record routes](../work/nested-design/journey-records.json)
- Habit lifecycle checks exercised creation, completion, failure and undo, quantity progress, schedule editing, reminder preferences, pause/resume, archive and delete. The inherited long run reached Journey with an older button label. A focused run used the current Habit Progress entry, verified weekly and monthly views, earned a Garden sprout and confirmed the completed habit after reload in light and dark. [Lifecycle results](../work/habits-qa/browser-result.json), [focused habit results](../work/nested-design/habits-focused.json)
- Profile checks at 320 × 640 and 430 × 932 covered both themes, seven settings destinations and Back, theme persistence after reload, consent, reminder create/edit-open/delete, canceling account deletion, About replay, and external support link targets. At 320 px, tapping Edit moved the memory Save button from below the visible viewport at y771 to y398. [Profile results](../work/nested-design/profile-evidence/after-browser-result.json), [preferences](../work/nested-design/profile-evidence/after-preferences-light-320.png)
- The 14 Solace cases at 320 × 500 dark and 430 × 932 light covered options, conversation search/rename/reopen, Voice Talk entry/mute/return, habit-sheet entry and dismissal, Journal edit and discussion routing, and consent dismissal with zero provider POSTs. At 320 × 360 the consent content scrolled while Close stayed visible. [Solace results](../work/nested-design/solace-after.json)
- Chrome at 320 × 660 light and 430 × 932 dark verified toolkit and guide entry, real resource accordions, a save failure/retry, mood save, assessments through result and habit template, grounding feedback, affirmations and challenge undo. A dark mixer startup run exposed an intermittent false interruption while the audio was still loading. The final export passed eight focused checks. Two delayed WAV tracks played and paused twice in each theme, a favorite and timer configuration persisted, and the refined artwork loaded. [Wellness scenarios](../work/nested-design/explore-after.json), [final mixer and artwork retest](../work/nested-design/explore-release-focused.json)
- Pixel 3a API 33 emulator smoke verified the Moments editor, Appearance in light and dark, empty Journey history, and Android hardware Back on those routes at about 393 × 807 dp. At approximately 321 × 659 dp with three-button navigation and 1.35× system text, the theme choices stacked, the personalization heading wrapped at a word boundary, and the switch remained reachable by scrolling. Hardware Back returned to Profile. [Android results](../work/nested-design/android/native-results.json), [enlarged text](../work/nested-design/android/dark-narrow-enlarged-personalization.png)
- TypeScript, Prettier, and the scoped layout scan passed. The 241 app tests covered navigation, wellness, session state, voice, reminders, offline writing, Google auth, native configuration, insights, API configuration, progress, routine, and Moments. All 119 backend tests passed. Expo exported production web, Android, and iOS bundles. Gradle `:app:assembleRelease` and `:app:lintVitalRelease` passed for x86-64 with a reserved QA API hostname.

The browser and emulator used disposable local accounts and offline AI. The iOS bundle verifies packaging, while native iOS UI and installation require a Mac or a device build. Physical-device follow-up includes iPhone safe areas, VoiceOver/TalkBack, native keyboard and permission states, biometric prompts, live voice capture/playback, notification delivery and frame pacing. Several existing approved screens were checked at source and by earlier evidence, with detailed new coverage shown above.

## Files changed in this pass

- Shared UI: `src/ui.tsx`.
- Profile: `src/screens/Profile.tsx` and the settings card in `src/screens/DeviceLock.tsx`.
- Solace: `src/screens/Core.tsx`, `VoiceTalk.tsx`, `Journal.tsx`, `JournalReflection.tsx`, and `HabitAssistant.tsx`.
- Explore and wellness: `src/screens/Wellness.tsx`, `AmbientMixerImpl.tsx`, and the Reflective Check-ins destination in `Explore.tsx`.
- Journey, Today entry paths and habits: `src/screens/Journey.tsx`, `JourneyGoal.tsx`, `Moments.tsx`, `Habits.tsx`, `HabitsEditor.tsx`, and `HabitsInsights.tsx`.
- Regression tests: `scripts/test-navigation.cjs`.
- Documentation: this report, the design audit, `DESIGN.md`, `README.md`, `docs/REQUIREMENTS.md`, and `docs/VERIFICATION.md`.
