# Architecture

## Request path
The Expo app sends JSON with a Bearer session token to the Node API. Native tokens use SecureStore; web-preview tokens use browser storage. The API validates inputs, resolves the account from the token, and applies ownership to every query. Caller-provided user IDs cannot override ownership.

SQL.js keeps SQLite in memory with durable atomic file replacement on each mutation. Transactions restore the pretransaction snapshot if persistence fails. One process owns one database; this prototype must not run multiple replicas against the same file.

## Data model
Users and hashed expiring session tokens have dedicated tables. User-owned typed collections hold check-ins, conversations/messages, sessions/feedback, reflections, assessments, memories, reminder preferences, and plans/challenges/affirmations. Records receive server-generated ID/timestamp defaults when not supplied; ownership is always enforced by the server. Chat and its successful reply are saved as one exchange.

## Companion context
The live adapter sends the current conversation to a configurable Responses API. Personalization adds recent check-ins and approved memories only after global opt-in. The deterministic companion uses limited intent branches and is always labeled. A failed live call is an error, not a silently substituted built-in answer. A source-linked memory is removed with its source conversation/session.

## Reminder ownership
The backend stores preferences; the OS schedules local notifications. No server push claim is made. On mobile a permission request precedes scheduling; editing replaces scheduled IDs after preferences save, and deleting cancels them. Logout cancels this device's reminders. Signing in restores enabled preferences when OS permission is already granted. Scheduled IDs are tracked per account on the device, rather than using another phone’s IDs. Web only stores preferences. Device-specific schedules must be verified on the final build.

## Screens and state
The root shell keeps a navigation stack and four primary tabs. Activity details hide or retain navigation as appropriate. The API is the source of persistent account data; forms keep local drafts until save. Theme selection is device-local. Interruption pauses the breathing timer. Unknown future settings are not rendered as nonfunctional controls.

## Threat and reliability boundaries
No provider secrets in bundles; bounded inputs; rate-limited auth; scrypt passwords; hashed opaque sessions; sensitive records are not logged. Backups and disk encryption are operator responsibilities. There is no email recovery service configured. A production deployment needs TLS, a restricted CORS list, a trusted proxy setup, and real live-provider/device acceptance testing.

