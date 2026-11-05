# Solace AI

A personal wellness companion built with React Native + Expo, a Node.js API and persistent SQLite storage. Solace connects a check-in, a conversation, a useful Moment and a gentle reflection, with personalization that the user controls.

## Current implementation

The source now includes the master-brief feature set: an expressive petal companion, structured Solace Moments, three ambient environments, consent-based memory, a calendar Journey, weekly reflections, personal goals, optional streaks and turn-based voice. The four main tabs are **Today → Solace → Journey → Profile**. Moments opens from Today or the Solace header; its library also keeps the earlier Explore practices and tools available.

The user explicitly asked to finish implementation while postponing provider, hosting and device setup. Those deferred setups no longer block feature coding. They remain verification and release work: an implemented adapter or a successful JavaScript export does not prove a real provider, installed native build or background reminder works. See [requirements](docs/REQUIREMENTS.md), [the implementation milestones](docs/IMPLEMENTATION_PLAN.md) and [actual verification results](docs/VERIFICATION.md).

**Live AI is not configured in this checkout.** Curated Moments, recorded weekly summaries and built-in companion replies are clearly labeled. Voice transcription reports unavailable when the backend cannot provide it; typing remains available. The older `outputs/solace-build-validation.apk` is a compilation artifact with a development emulator endpoint. It does not contain the current feature implementation and is not a functional submission build.

## The daily experience

Today keeps the botanical daily pause: a personal greeting, one mood tray, one illustrated next action, conversation continuity and a changing daily affirmation. Its three-step progress comes from saved check-ins, completed practices and reflections. The completed state keeps that progress and offers an optional breathing moment. There is no additional task to unlock and no implied clinical outcome.

The loved light theme remains blush-ivory and forest. Dark mode uses a black canvas, neutral graphite, warm ivory text, champagne actions and restrained lilac/peach/sage accents. Welcome, login, signup and Today have no upper-right profile shortcut. Typography and artwork follow [the existing design system](DESIGN.md), including [matched daily-pause artwork](assets/DAILY_PAUSE_ARTWORK.md).

The floating navigation respects safe-area and keyboard clearance. Supported iOS uses guarded native Liquid Glass, with blur and Reduce Transparency fallbacks. Android uses an opaque tonal surface, selected indicators and native ripple. Browser rendering does not establish native-material or gesture behavior.

## Solace Moments and the companion

Describe how you feel, review the suggested Moment and choose **Forest Sanctuary**, **Ocean Calm** or **Twilight Sky**. The generator returns bounded, schema-validated activity data: type, duration, steps, optional breathing rhythm and reflection prompts. It cannot send executable UI instructions. A configured provider uses structured output; the built-in alternative is explicitly curated. Urgent distress takes the human-support route instead of offering a generated activity.

The Make a Moment action in Chat carries the chosen feeling and conversation link into the activity, with an optional return to that conversation afterward. The immersive player has an active-time clock, guidance, progress, pause/resume, exit confirmation, background pause, environment switching and optional bundled ambient sound. Original synthesized sound loops are packaged locally. Playback status and failures are visible. Completion and helpfulness are saved to the authenticated account, with retry behavior that retains the result rather than claiming an unsuccessful save worked.

The recognizable petal companion has idle, listening, thinking, speaking, celebration and breathing states. Recording, requests, playback, practice timing and earned milestones drive these states. Reduced-motion settings are respected. No expression diagnoses the user's feelings.

## Conversation and voice

Chat supports new conversations, continuing and deleting old conversations, title/message search, inline renaming and a recent-conversation entry. Replies distinguish live AI from the built-in companion. Unsent text stays in account-scoped memory across navigation; recoverable errors keep the text available.

Turn-based voice uses Expo Audio for permission-aware recording, a bounded authenticated backend transcription endpoint and an explicit transcript-review step. **A transcript is never automatically sent as a chat message.** The user chooses whether to add it, then sends the message. Typed text remains available if permission, recording or transcription fails. Explicit retry can reuse bounded audio kept in memory; native temporary-file cleanup is attempted after extraction. The server does not persist source audio. Audio is processed by the configured provider, whose service policies remain separate from Solace's storage behavior.

Optional reply playback uses Expo Speech with actual start/stop/error callbacks. Leaving the conversation, backgrounding or starting another operation stops the previous interaction. Native microphone behavior, audio routing, interruptions and playback still need installed-device testing. The new audio/speech modules require a fresh native binary. Missing compiled audio modules show text/quiet fallbacks without evaluating those native libraries.

## Memory you can explain and change

**Profile → What Solace remembers** shows saved preferences, categories, approval state and available source links. Users can add, correct, approve, remove or explicitly clear preferences, or turn personalization off. Activity completion may offer editable wording, but saving always requires an explicit action. Solace does not silently create memories.

Recommendations name the approved memory used when it influences a suggestion. Turning personalization off excludes saved preferences from new personalized suggestions. Editing/removing a memory, deleting a source that supplied one, or revoking personalization resets the older context used for future AI replies. Existing conversation text remains visible and exportable; it is not silently rewritten. Deleting a conversation or source session also removes its derived memories. Pending responses built from invalidated context are rejected rather than committed.

## Journey, goals and gentle milestones

Journey includes a selectable monthly calendar, day-by-day mood/activity history, completed-practice minutes, saved reflections and self-reported helpfulness. The seven-day review uses actual account records. The weekly-reflection adapter can summarize those facts with a configured AI provider; the local recorded summary is labeled when live AI is off. Neither route supplies diagnoses, invented mood patterns or a wellbeing score.

Personal weekly time goals can be changed, paused and resumed. Check-in streaks are optional. Milestones include a first Moment, three reflections, five mindful pauses and seven distinct check-in days; they come from real saved records. Quiet days never delete achievements. Unsynced writing stays visible with a waiting-to-sync label but does not earn account milestones. Celebrations acknowledge an earned milestone, not a fabricated achievement.

## Existing foundations retained

- Accounts: signup/login/logout, secure session handling, persisted history and server-enforced account isolation.
- Practices: timed breathing, optional five-senses grounding, journaling, three reflective assessments, five guidance categories, editable plans, affirmations and small challenges.
- Toolkit: private saved practices and resources, idempotent saves, export and deletion.
- Profile photos: system picker, client preparation and independent server JPEG normalization to 256px, input limits and metadata removal; photos remain private to the account.
- Reminders: private local notification schedules and destination routing. Browser preferences do not pretend to schedule native notifications.
- Data controls: approved memory, export, logout, account deletion, unsynced-writing retry/discard and theme preferences.

Native check-in/journal drafts use bounded account-scoped SecureStore. Up to ten submitted check-ins/reflections can wait for retry after recoverable connection errors. Draft writes debounce 650ms and attempt protection when leaving the app; abrupt termination before a successful write can lose recent edits. Web writing is memory-only for the open tab. Cold launch still needs online API session restoration; chat and complete account snapshots are not placed in the protected writing vault.

An unchanged chat draft reuses its request ID after a connection failure during the current app session. The API can replay its saved turn for up to 24 hours, including across API restarts. Editing the draft starts a new request. Chat drafts and pending request IDs live in app memory.

## Local setup

The app and server have separate lockfiles. Root-only `npm ci` does not install the server's tsx dependency. The tested runtime is Node 24 LTS; the runtime wrapper validates compatible versions and never silently runs Expo on Windows' default Node 20. See [Mac/simulator repair instructions](docs/LOCAL_DEVELOPMENT.md).

```powershell
npm run setup
npm run doctor
npm run dev
```

Setup installs both lockfiles with development/platform packages, compiles the API and creates only missing environment files. Existing environment files and database records are preserved. The dev supervisor verifies its own API child before starting Expo. Private server configuration and relative database paths are anchored to `server/`; a busy-port failure cannot rewrite the running API's database.

The API normally uses port 3001 and Expo web uses 8081. Separate terminals can run `npm run server` and `npm run web`. A packaged local preview uses `npm run export:web:preview`, then `npm run preview` on port 8082. Stop the owned development processes with Ctrl+C.

Only public connection configuration belongs in the root environment. Development defaults use iOS simulator `127.0.0.1:3001`, Android emulator `10.0.2.2:3001` and the web hostname on port 3001. A physical phone needs a reachable LAN or hosted address. Release clients require an explicit HTTPS API and reject loopback/emulator addresses. Reload Expo after public configuration changes; rebuild installed release binaries.

Provider credentials belong only in **server/.env** or the private server environment. Configure the provider model for the account, then restart the API. `AI_MODE=live` requires credentials, `auto` selects live when configured, and `offline` uses the labeled built-in companion. Configured-provider failures produce recoverable errors instead of an undisclosed fallback. See [server configuration](server/README.md). Never commit environment files, keys or local database records.

## Project map

```text
App.tsx                    app shell and four-tab navigation
src/Navigation.tsx         platform-aware floating navigation
src/screens/Discover.tsx   Today and the daily pause
src/screens/Moments.tsx    generation, library and immersive player
src/Companion.tsx          event-driven petal character
src/Environment.tsx        forest, ocean and twilight visual environments
src/moments.ts             activity guards and active-time player helpers
src/screens/Journey.tsx    calendar, summaries, goals and milestones
src/progress.ts            recorded participation and calendar helpers
src/VoiceControls.tsx      recording, transcript review and reply playback
src/voice-session.ts       cancellable account/conversation-scoped voice turn
src/screens/Core.tsx       welcome, accounts, chat and history
src/screens/Wellness.tsx   original activities, resources and reflections
src/screens/Profile.tsx    account, photos, memory, reminders and data controls
src/store.tsx              authenticated state, API and protected sessions
src/offline.ts             bounded protected-writing vault
src/notifications.ts       native local reminders and tap routing
server/src/                auth, persistence, AI, Moments, weekly and voice API
assets/                    original/botanical illustrations and ambient loops
docs/                      requirements, verification and release guides
```

## Checks and release work

```powershell
npm run typecheck
npm run server:typecheck
npm run server:test
npm run test:tooling
npm run test:api-config
npm run test:session-state
npm run test:moments
npm run test:progress
npm run test:voice
npm run test:native-config
npm run test:routine
npm run test:offline
npm run test:insights
npm run test:wellness
npm run test:reminders
npm run server:build
npm run export:web:preview
npm run export:android
npm run export:ios
```

**205 regressions passed in the latest hardening pass**, alongside client and server type checks and web, Android and iOS exports. The local browser run covered account restoration, interrupted chat recovery, human-support navigation, mood and Moment saves, and reminder preference editing. Provider adapters were tested with controlled responses. Verify microphone access, permission prompts, background notifications and installed app behavior on native devices. See [VERIFICATION.md](docs/VERIFICATION.md).

Submission still needs a real provider, public HTTPS with a persistent database, a rebuilt functional APK tested on a physical phone, iOS verification, native reminder tests and a demo recorded from the final build. The user's deadline is Tuesday, 10 November 2026 at 11:59 AM IST. [Release instructions](docs/RELEASE.md) cover those deferred operations. No new Docker setup or branch is required.

SQL.js currently supports one API instance with a private persistent disk. Use HTTPS, restricted origins/proxy settings and backups in deployment. SQLite is not application-encrypted. Large-account pagination and native performance profiling remain scaling work. Solace is an AI wellness companion, not a licensed therapist, diagnostic tool or emergency service. It makes no clinical, HIPAA or certification claim. Social feeds, public profiles, following, community messages, therapist booking, OAuth, email password reset and remote push infrastructure are outside the implemented scope.
