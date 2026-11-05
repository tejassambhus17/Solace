# Architecture

## Request path
The Expo app sends JSON with a Bearer session token to the Node API. Native tokens use SecureStore; web-preview tokens use browser storage. The API validates inputs, resolves the account from the token, and applies ownership to every query. Caller-provided user IDs cannot override ownership.

SQL.js keeps SQLite in memory with durable atomic file replacement on each mutation. Transactions restore the pretransaction snapshot if persistence fails. One process owns one database; this prototype must not run multiple replicas against the same file.

## Data model
Users and hashed expiring session tokens have dedicated tables. User-owned typed collections hold check-ins, conversations/messages, sessions/feedback, reflections, assessments, memories, reminder preferences, plans/challenges/affirmations, and toolkit favorites. Records receive server-generated ID/timestamp defaults when not supplied; ownership is always enforced by the server. Chat and its successful reply are saved as one exchange.

## Companion context
The live adapter sends the current conversation to a configurable Responses API. Personalization adds recent check-ins and approved memories only after global opt-in. The deterministic companion uses limited intent branches and is always labeled. A failed live call is an error, not a silently substituted built-in answer. A source-linked memory is removed with its source conversation/session.

## Reminder ownership
The backend stores preferences; the OS schedules local notifications. No server push claim is made. On mobile a permission request precedes scheduling; editing replaces scheduled IDs after preferences save, and deleting cancels them. Logout cancels this device's reminders. Signing in restores enabled preferences when OS permission is already granted. Scheduled IDs are tracked per account on the device, rather than using another phone’s IDs. Web only stores preferences. Device-specific schedules must be verified on the final build.

## Screens and state
The root shell keeps a navigation stack and four primary tabs. Activity details hide or retain navigation as appropriate. The API is the source of persistent account data; forms keep local drafts until save. Theme selection is device-local. Interruption pauses the breathing timer. Unknown future settings are not rendered as nonfunctional controls.

## Threat and reliability boundaries
No provider secrets in bundles; bounded inputs; rate-limited auth; scrypt passwords; hashed opaque sessions; sensitive records are not logged. Backups and disk encryption are operator responsibilities. There is no email recovery service configured. A production deployment needs TLS, a restricted CORS list, a trusted proxy setup, and real live-provider/device acceptance testing.


## Toolkit and weekly review

Favorites use the existing owner-scoped typed-record store. Their identity is deterministic per kind/target; POST retries return the existing record, and the client replaces by ID rather than duplicating it. Valid kinds are resource, breathing, reflection and grounding. Targets are limited to known resource IDs or the corresponding activity name. Changing target identity requires removing and adding the favorite; PATCH can edit its title. Favorites are included in state/export and account deletion. No private writing is copied into a favorite.

Grounding records actual foreground duration, senses tried, source and completion in the existing sessions collection through the feedback flow. The optional remembered preference names the actual activity. An all-skipped run remains incomplete.

src/insights.ts computes seven local-calendar-day facts from account records. It deduplicates repeated record IDs, excludes future/invalid/out-of-window activity, distinguishes repeat entries from distinct participation days, and counts supportive feedback only on completed activities. It does not infer clinical meaning or causal benefit.

## Rendering improvements and limits

History caches its search index by conversation-record identity, filters cached lowercase text, and mounts 30 rows initially with explicit show-more. It does not yet fetch paginated API pages. Chat scrolls automatically only near the bottom or after an explicit send; a Latest messages control handles off-bottom arrivals/layout changes. Breathing uses refs for precise foreground time and integer display seconds to avoid unnecessary component renders. Artwork is bundled, decorative and uses target-size native resize hints. These choices are source-reviewed; no physical-device FPS, memory or network benchmark has been claimed.
