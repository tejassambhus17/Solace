# Solace premium feature verification

## Milestone 1 · AI, Moments and the companion

Chat now accepts an allowlisted structured practice choice and opens the existing Moment player directly. Legacy saved actions remain supported. The account-owned conversation link, idempotent completion, feedback and Journey records use the existing APIs. Companion motion uses distinct state cues, real optional recording input, reduced motion and foreground checks. Idle motion ends after two cycles.

Type checking passed. The targeted API and practice suites passed 34 checks, including a provider-stub schema exchange, unknown-action rejection, replay, isolation, one completion, helpfulness and reopening the saved suggestion. Live-provider and native motion verification are tracked separately below as they run.

## Milestone 2 · Voice and Daily Pause

Voice Talk preserves explicit recording and review, then sends the turn to the same saved chat as text. A microphone level drives the recording indicator where Expo supplies metering. Playback can be muted or interrupted. Cancellation aborts the upload and disconnects the provider request. Configured OpenAI transcription stays preferred. Gemini handles supported audio when Gemini is the only configured provider.

Daily Pause uses the existing wellness preference record to save the day's skip, replacement and supported duration, plus an ongoing on/off setting. It uses actual saved progress and can use the current check-in, time, and approved preferences and feedback. The dedicated tests passed against an HTTP API and a reopened SQLite database. The configured Gemini model also transcribed synthetic audio without printing the transcript or credentials.
