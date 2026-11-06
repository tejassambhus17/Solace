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
