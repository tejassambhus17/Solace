# Solace AI

A personal wellness companion built with React Native + Expo, a Node.js API and persistent SQLite storage. Solace connects a check-in, a conversation, a useful Moment and a gentle reflection, with personalization that the user controls.

## Current implementation

The source now includes the master-brief feature set: an expressive petal companion, structured Solace Moments, three ambient environments, consent-based memory, a calendar Journey, weekly reflections, personal goals, optional streaks and turn-based voice. The five tabs are **Today → Solace → Explore → Journey → Profile**. Explore includes Solace Moments, breathing, grounding, reflections, the saved toolkit, guides, reflective check-ins, plans, affirmations and challenges. Moments is also available from Today and the Solace header.

Local Gemini responses and physical Android QA have separate verification records. Public hosting and full native release acceptance remain separate work. See [requirements](docs/REQUIREMENTS.md), [the implementation milestones](docs/IMPLEMENTATION_PLAN.md) and [actual verification results](docs/VERIFICATION.md).

**Gemini is the primary text provider when configured.** Chat, Moments and weekly reflections use the server's configured Gemini model. Curated Moments, recorded weekly summaries and built-in companion replies remain available in offline mode. Voice transcription uses the existing OpenAI configuration, with typing available when transcription is unavailable.

## The daily experience

Today opens with a scenic greeting, actual check-in and Moment counts, and the latest recorded mood. Tap a watercolor petal to open the check-in, or start the five-minute Calm Reset. Daily Pause tracks check-in, Moment and reflection from saved activity and opens the next step. Quick Actions open breathing, reflection, sleep, and grounding.

The loved light theme remains blush-ivory and forest. Dark mode uses a black canvas, neutral graphite, warm ivory text, champagne actions and restrained lilac/peach/sage accents. Welcome, login, signup and Today have no upper-right profile shortcut. Typography and artwork follow [the existing design system](DESIGN.md), including [matched daily-pause artwork](assets/DAILY_PAUSE_ARTWORK.md).

The floating navigation respects safe-area and keyboard clearance. Each tab keeps its navigation stack while you switch. A circular spotlight follows the active tab and moves immediately when Reduce Motion is enabled. Supported iOS uses guarded native Liquid Glass, with blur and Reduce Transparency fallbacks. Android uses an opaque tonal surface.

## Solace Moments and the companion

The Solace tab opens with Companion and My Journal choices and remembers the last used mode for each account. Companion keeps the existing text, history and turn-based voice flows. My Journal supports drafts, saved entries, mood, tags, bookmarks and search. AI reflection and Companion handoff require selecting an excerpt and approving the provider disclosure. Explore opens Guided Techniques, which uses the same Moment player and Journey completion records. The navigation map, privacy behavior and device acceptance steps are in the [Companion, Journal and Guided Techniques QA report](docs/COMPANION_JOURNAL_TECHNIQUES.md).

Describe how you feel, review the suggested Moment and choose **Forest Sanctuary**, **Ocean Calm** or **Twilight Sky**. The generator returns bounded, schema-validated activity data: type, duration, steps, optional breathing rhythm and reflection prompts. It cannot send executable UI instructions. A configured provider uses structured output; the built-in alternative is explicitly curated. Urgent distress takes the human-support route instead of offering a generated activity.

The Make a Moment action in Chat carries the chosen feeling and conversation link into the activity, with an optional return to that conversation afterward. The immersive player has an active-time clock, guidance, progress, pause/resume, exit confirmation, background pause, environment switching and optional bundled ambient sound. Original synthesized sound loops are packaged locally. Playback status and failures are visible. Completion and helpfulness are saved to the authenticated account, with retry behavior that retains the result rather than claiming an unsuccessful save worked.

The recognizable petal companion has idle, listening, thinking, speaking, celebration and breathing states. Recording, requests, playback, practice timing and earned milestones drive these states. Reduced-motion settings are respected. No expression diagnoses the user's feelings.

## Conversation and voice

New chat opens with a woodland lotus scene, contextual quick replies, and a two-minute Guided Breath card. After the first send, the conversation uses a compact companion header. Saved conversations open in that layout with recorded timestamps and reply sources. The header opens Moments, history, and Voice Talk. The composer menu offers practices, support, and reply playback. Urgent replies provide a direct human support action. Unsent text stays in account-scoped memory across navigation and recoverable errors.

Explore opens with a twilight lake, compact category filters including Sleep, search, and a shortcut to the saved toolkit. Below the five-minute Calm Your Mind Moment, a two-column grid offers a three-minute Breath Reset, five-minute Five Senses grounding, Quick Reflection with a four-minute estimate for the self-paced journal, and a ten-minute Sleep Wind Down. Create Your Wellness Plan opens the editable three-day plan, which can be saved and reopened. Explore More links to Guided Programs, Wellness Toolkit, and Check-Ins. Its additional tools include the timed practice builder, where you can choose a focus and preview the steps before starting. A completed timed practice can be saved to Journey.

The microphone beside Send adds a reviewed transcript to the regular chat composer. The headset opens a dedicated Voice Talk screen for recording, reviewing and editing the transcript, explicitly sending a message, and hearing the reply. Both use permission-aware Expo Audio and the authenticated transcription endpoint. Typed text remains available if permission, recording or transcription fails. Explicit retry can reuse bounded audio held in memory. Solace attempts to delete native temporary audio after extraction and processes audio through the configured provider without storing it on the server.

Expo Speech handles reply playback. Voice Talk starts reading ordinary new replies aloud and offers stop and replay controls. It presents urgent guidance in text with a support action. Leaving the conversation, backgrounding or starting another operation stops the previous interaction. Verify microphone behavior, audio routing, interruptions and playback on an installed native build with the audio and speech modules.

## Memory you can explain and change

**Profile → What Solace remembers** shows saved preferences, categories, approval state and available source links. Users can add, correct, approve, remove or explicitly clear preferences, or turn personalization off. Activity completion may offer editable wording, but saving always requires an explicit action. Solace does not silently create memories.

Recommendations name the approved memory used when it influences a suggestion. Turning personalization off excludes saved preferences from new personalized suggestions. Editing/removing a memory, deleting a source that supplied one, or revoking personalization resets the older context used for future AI replies. Existing conversation text remains visible and exportable; it is not silently rewritten. Deleting a conversation or source session also removes its derived memories. Pending responses built from invalidated context are rejected rather than committed.

## Journey, goals and gentle milestones

Journey opens with a weekly view and remembers each account's Week, Month or All time preference on this device. Its calendar opens day-by-day history, and the summaries count distinct check-in days, completed Moments and actual active time. Prior-period comparisons appear when the previous period has activity. The saved story opens reflections, affirmations and check-ins.

Choose a calendar week to write a reflection or request an editable draft based on your saved activity and feedback. The local recorded summary is labeled when live AI is off. A configured provider receives counts to suggest a question. When there is no activity to summarize, Journey offers a guided prompt. Weekly reflections are only saved when you choose to save, and you can reopen, edit or delete them.

Set a goal for check-in days, completed Moments, mindful minutes or saved reflections, over a week, month or all time. Goals can be edited, paused, resumed or removed. Milestones such as the first check-in, three- and seven-day streaks, and first weekly reflection derive from saved records. Unsynced writing is marked as waiting to sync and does not count toward account milestones.

## Existing foundations retained

- Accounts: signup/login/logout, secure session handling, persisted history and server-enforced account isolation.
- Practices: timed breathing, optional five-senses grounding, journaling, three reflective assessments, five guidance categories, editable plans, affirmations and small challenges.
- Toolkit: private saved practices and resources, idempotent saves, export and deletion.
- Profile photos: system picker, client preparation and independent server JPEG normalization to 256px, input limits and metadata removal; photos remain private to the account.
- Reminders: private local notification schedules and destination routing. Browser preferences do not pretend to schedule native notifications.
- Data controls: approved memory, export, logout, account deletion, unsynced-writing retry/discard and theme preferences.

Profile shows the signed-in name and photo against mountain artwork for the active theme. **Edit Profile** opens name and photo controls. **Personalize Solace** groups reminders, saved memories, and appearance preferences, with badges based on the account’s reminder and memory records. **Privacy & Support** links to data export and deletion, human support, and About Solace. About explains Solace’s role and how the app handles conversations.

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

Only public connection configuration belongs in the root environment. Development defaults use iOS simulator `127.0.0.1:3001`, Android emulator `10.0.2.2:3001` and the web hostname on port 3001. A physical phone needs a reachable LAN or hosted address. An Android debug build can also use an explicit loopback address over USB reverse. Release clients require an explicit HTTPS API and reject loopback, private network addresses and local-only hostnames. Reload Expo after public configuration changes and rebuild installed release binaries.

Google sign-in on Android and iOS uses a system browser and the existing Solace session. To link an existing account, sign in first and open **Profile → Edit Profile → Google sign-in**. Google Cloud settings, the HTTPS callback, optional SMTP recovery and native rebuild steps are in the [authentication setup guide](docs/GOOGLE_AUTH_SETUP.md).

Use **Profile → Appearance & preferences → Biometric Lock** to protect an existing session, My Journal or both on an enrolled device. Solace can lock immediately or after one or five minutes in the background. You can recover access through your normal sign-in. The web preview keeps the email/password session for the current browser tab.

Provider credentials belong only in **server/.env** or the private server environment. Set `GEMINI_API_KEY` to use the default `gemini-3.1-flash-lite`, or set `GEMINI_MODEL` to a supported model, then restart the API. OpenAI handles text when only its key is configured. With both keys, `OPENAI_FALLBACK_ENABLED=true` opts into sending requests to OpenAI after transient Gemini failures. `AI_MODE=live` requires a key, `auto` selects live when configured, and `offline` uses the labeled built-in companion. See [server configuration](server/README.md).

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
src/screens/ProfileHome.tsx  grouped profile overview and account badges
src/screens/Profile.tsx      account, memory, reminders, privacy and About Solace
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
npm run test:google-auth
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

The November 6 stabilization pass includes an integrated two-account browser journey, matched defect retests, and checks on a USB-connected Android 15 handset. The report lists the exact scenarios, commands and outstanding release gates. [QA stabilization report](docs/QA_STABILIZATION.md) · [Verification record](docs/VERIFICATION.md)

The physical Android debug build passed signup, session restoration, mood saving, built-in chat and history checks using the local API over USB. The device pass also verified the chat keyboard fix. [Device verification](docs/VERIFICATION.md#physical-android-smoke-test--6-november-2026)

Today includes a five-minute Calm Reset, the recorded daily routine progress, and direct Explore More links to Guided Programs, Wellness Toolkit and Check-Ins. The full Explore library is available from See All and the bottom compass.

Submission still needs public HTTPS with a persistent database and production provider configuration, a rebuilt functional APK tested on a physical phone, iOS verification, native reminder tests and a demo recorded from the final build. The user's deadline is Tuesday, 10 November 2026 at 11:59 AM IST. See [release instructions](docs/RELEASE.md).

SQL.js currently supports one API instance with a private persistent disk. Use HTTPS, restricted origins/proxy settings and backups in deployment. SQLite is not application-encrypted. Large-account pagination and native performance profiling remain scaling work. Solace is an AI wellness companion, not a licensed therapist, diagnostic tool or emergency service. It makes no clinical, HIPAA or certification claim. Social feeds, public profiles, following, community messages, therapist booking, OAuth, email password reset and remote push infrastructure are outside the implemented scope.
