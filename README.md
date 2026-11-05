# Solace

A warm mobile wellness companion built in React Native + Expo with a Node.js API and a persistent SQLite database. It connects check-ins, conversations, calming activities and reflection, with optional user-approved personalization.

## Backend setup and Mac simulator repair

The app and server have separate lockfile installs. Run `npm run setup`, then `npm run doctor`; root-only npm ci does not install server/tsx. The setup uses the selected supported Node runtime, installs platform binaries and development tools, and builds the server. See [the Mac/local repair guide](docs/LOCAL_DEVELOPMENT.md) for the simulator URL, two-terminal startup and actual authentication/restart checks. No Docker is required.

The root public URL is for the client; credentials stay in server/.env. Blank public values use local defaults only in development. Release builds require a configured HTTPS API. Use `npm run export:web:preview` for a local static preview. The latest [implementation plan](docs/IMPLEMENTATION_PLAN.md) records the navigation requirements and sequential milestones; advanced work stays behind foundation acceptance. Local signup/login/logout, session restoration and conversation history across a full API/Expo restart now pass in the browser; 125 regressions pass after a clean install. Mac simulator and real-provider verification are deferred, not passed.

## Current status

The app is implemented for Android/iOS through Expo, with a working local web preview of the same React Native source. Light/dark themes, accounts, saved conversations, wellness activities and profile controls are implemented. Native installation and device behavior remain to be verified. See [the requirements matrix](docs/REQUIREMENTS.md) and [verification record](docs/VERIFICATION.md) for exact coverage and evidence.

**Live AI is not enabled in this checkout:** provider configuration is deferred while authentication repair is prioritized. The app labels its built-in companion responses. A real Responses API adapter is ready, but live-provider testing remains required. An Android compilation-check APK has been produced, but it is not a functional phone/submission build: it embeds the development emulator endpoint. A hosted HTTPS endpoint, rebuilt APK, device notification test, and submission video remain separate release steps. Hosting is deferred at the user’s request.

## Botanical home and dark-mode refinement

Today now pairs a compact greeting and one mood tray with an illustrated **Your daily pause**. The hero uses a matched botanical composition in each theme, one next-step action, and a quiet three-step path based on actual saved check-ins, completed practices and reflections. When the pause is complete, its action offers an optional three-minute breathing moment. It does not assign more work or reset completed progress.

During the practice stage, **Why this pause?** expands the curated suggestion's explanation. A daily affirmation adds a changing editorial note and opens the existing affirmation save flow. Suggestions and kind words are curated; the artwork does not imply live AI or a promised emotional outcome.

Light mode keeps its blush-ivory and forest identity. Dark mode keeps a black canvas with neutral graphite layers, warm ivory text, champagne actions and quieter lilac/peach/sage accents. The light secondary text was slightly darkened for contrast. Explore uses an illustrated breathing feature followed by clear practice/tool rows, keeping the full library available without repeating a catalogue on Today.

The dark hero is `assets/daily-pause-dark-v2.png`, paired with the original `assets/moment-light.png`; prompts and provenance are in [daily pause artwork](assets/DAILY_PAUSE_ARTWORK.md). Text and controls remain code-rendered. See [the design contract](DESIGN.md), [feature comparison](docs/FEATURE_GAPS.md), and [verification record](docs/VERIFICATION.md) for exact implementation and evidence. The preceding UI verification recorded 88 passing tests; native rendering and installed-device behavior remain separate checks.

Welcome, login, signup and Today have no upper-right profile shortcut. Chat retains unsent messages across navigation in memory and distinguishes built-in guidance from live AI. Conversation history supports title/message search, inline renaming and resumption of the most recent conversation. The updated JavaScript exports do **not** update the old APK in `outputs/`.

## A simpler daily experience

Five destinations now separate daily care from the activity library: **Today → Solace → Explore → Journey → Profile**. The user explicitly approved adding a tab to reduce clutter. Today shows a mood tray, one illustrated next routine step, a conversation shortcut and the daily affirmation. Explore contains practices, saved toolkit, guides, plans and affirmations. No profile shortcut appears on welcome, login, signup or Today.

The daily pause uses real check-in, completed-activity and reflection records. Suggestions are curated locally, with an expandable explanation during the practice stage. Current-day mood can guide the suggestion; approved preferences and prior helpful feedback are considered only with personalization enabled. Completing the routine never implies a clinical outcome.

Navigation floats above content with measured safe-area clearance. iOS uses the actual system Liquid Glass material when both Expo capability checks succeed, a native blur fallback on older supported iOS, and an opaque fallback for Reduce Transparency. Android uses a solid tonal navigation surface with clear selected states and native ripple feedback. Web shows the fallback layout, not proof of iOS glass. These new native modules require rebuilding the development/production app.

**Profile → Your account** supports choosing, changing and removing a private profile photo. The selected image is prepared as a 256px JPEG, then decoded, re-encoded and stripped of metadata again on the server. Photos remain account-scoped, appear in export and are removed with the account. Solace does not request camera/microphone access for this feature.

Check-in and journal drafts use account-scoped SecureStore on native. Recoverable connection errors queue at most 10 submitted check-ins/reflections for retry. Entries clearly say they are waiting to sync, and Your account offers retry/discard controls. Web writing remains in memory for the open preview only; it is not silently written to unencrypted browser storage. Native draft writes debounce 650ms and attempt protection when leaving the app; abrupt termination before commit can lose recent edits. Cold offline launch still needs API session restoration. Native vault limits, failure recovery and actual OS persistence are documented separately from browser verification. Chat and full account snapshots are never placed in this vault.

## Personal toolkit and weekly review

Save breathing, reflection, grounding and resource guides to **Your toolkit**. Favorites persist privately with the account, survive reload, appear in data export and are deleted with the account. Repeated saves are idempotent. Five-senses grounding offers five optional steps, accessible alternatives and an exit; feedback and Journey record actual participation. Skipping every sense does not count as a completed moment.

Journey now offers a factual seven-day review and an optional weekly reflection prompt. It uses saved records and self-reported feedback, never a wellbeing score or inferred diagnosis. New black-mode petal, stillness and moonlit artwork appears across the app; exact prompts and paths are in [dark artwork provenance](assets/DARK_ARTWORK.md).

Search data is cached between query edits, history initially renders 30 rows with an explicit show-more control, breathing display updates avoid fractional-second rerenders, and chat preserves reading position when the reader is away from the bottom. These are implementation improvements, not measured device performance guarantees. Account state is still fetched as a full snapshot; large-account pagination and native performance profiling remain future scaling work.

## Requirements

- Node **24.3+ LTS** is the tested baseline; the installed Expo toolchain also supports Node 22.13+ and 26+. Windows' default Node 20 is insufficient for the current Expo toolchain. On this machine, package scripts use an ignored local configuration pointing to the bundled Node 24. Other machines should install Node 24 or set SOLACE_NODE.
- npm; a phone with a matching Expo Go version for early testing, or an Expo development/preview build.
- An Expo account for cloud APK builds. Public HTTPS hosting for the backend before sharing the final APK.

## Quick start

```powershell
npm run setup
npm run doctor
npm run dev
```

Setup creates missing environment files from the examples and preserves existing files. Edit private provider configuration only in `server/.env`.

Open the Expo web URL printed in the terminal (normally `http://127.0.0.1:8081`). The API runs on port 3001. Create an account; no production user or prefilled history is seeded. Test activity creates actual account data in `server/data/solace.sqlite`.

Alternatively run `npm run server` and `npm run web` in separate terminals. For the local packaged preview run `npm run export:web:preview`, then `npm run preview` (port 8082). `npm start` opens the Expo development server for phone/emulator testing. Stop development processes with Ctrl+C.

## Physical Android phone

1. Put phone and computer on the same trusted network.
2. Set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3001` in root `.env` (the emulator default `10.0.2.2` is not a physical-phone address).
3. Start the backend, run `npm start -- --clear`, and open the project on the phone.
4. Allow only the needed local-network access if Windows asks. Never expose the development API publicly without deployment configuration.

Reminder delivery, notification taps, background behavior, keyboard/safe-area behavior and Android Back must be checked on the actual installed build. The web preview deliberately saves reminder preferences without pretending to schedule native notifications.

## Live AI

Set `OPENAI_API_KEY` in **server/.env**, never in root public variables. Set `OPENAI_MODEL` to a model available to your account, then restart the API. Use `AI_MODE=live` to require the real provider; `auto` uses the built-in companion when no key exists; `offline` always uses built-in responses. Provider failures produce a recoverable error, not undisclosed fallback. Current-conversation context is sent for chat; recent check-ins and approved preferences are added only when personalization is enabled. See [server documentation](server/README.md).

## Main features

- Today: compact personal greeting, mood tray, illustrated daily pause with real progress, curated explanation, conversation continuity and daily affirmation.
- Explore: illustrated breathing feature, grounding, writing, private toolkit, guides, plans, challenges and affirmations.
- Solace: conversation, actionable activity cards, new/reopen/continue/delete history and visible provider mode.
- Journey: saved check-ins, moments, feedback, reflections, assessments, factual XP/streaks and a seven-day review.
- Wellness: reflective questionnaires; timed breathing; optional five-senses grounding; journaling; five guides; private saved toolkit; editable plan; affirmations and small challenges.
- Profile: private profile photo, name, themes, reminders, approved memories, unsynced writing, export, logout and deletion.
- Notifications: native recurring local schedules with private copy and destination routing; browser limitation is explicit.

## Project map

```text
App.tsx                   app shell and five-tab navigation
src/Navigation.tsx        platform-aware floating navigation
src/screens/Discover.tsx  Today, daily pause and affirmation entry
src/screens/Explore.tsx   illustrated practice and resource discovery
src/routine.ts            curated daily pause selector
src/offline.ts            bounded account-scoped protected writing vault
src/theme.tsx             light/dark/system tokens
src/ui.tsx                shared mobile components
src/store.tsx             authenticated API state and secure session storage
src/content.ts            wellness content and pure progress logic
src/screens/Core.tsx      welcome, accounts, chat, history, Journey
src/screens/Wellness.tsx  assessments, activities, resources, plans
src/screens/Profile.tsx   profile, settings, memory, reminders, data controls
src/notifications.ts      native scheduling and tap handling
server/src/               API, SQLite persistence, auth, provider integration
assets/                   generated petal and botanical illustrations
design/references/        approved light/dark mockups
docs/                     requirements, verification, architecture and release
```

## Checks

```powershell
npm run typecheck
npm run test:tooling
npm run test:api-config
npm run test:wellness
npm run test:reminders
npm run test:session-state
npm run test:insights
npm run test:routine
npm run test:offline
npm run server:typecheck
npm run server:test
npm run server:build
npm run export:web
npm run export:android
npm run export:ios
```

Native JS export verifies bundling, not APK installation or device APIs. Backend tests use an isolated test database and mock live-provider requests; they never require a real key. See the verification record before claiming release readiness.

## Build and submit

Follow [release instructions](docs/RELEASE.md). `eas.json` includes an APK preview profile. Set a public HTTPS API URL **before** building, sign into Expo, then run `npx eas-cli build --platform android --profile preview`. Fresh-install and verify the exact resulting APK. The PDF calls for an app build and demo video; it does not require source submission. The guide says video is used during initial shortlisting, so record a concise real-product journey plus brief coverage of the remaining sections.

## Privacy and operating limits

The prototype uses salted password hashes, hashed expiring sessions, server-enforced account isolation, explicit personalization, record validation, rate limits, and data export/deletion. SQLite data is not application-encrypted. Production requires HTTPS, a private persistent disk, backups, explicit web origins and trusted reverse-proxy configuration. Run only one API replica with the current SQL.js storage adapter. This is not a clinical or emergency service.

The country support page links to external directories; it does not invent practitioners, locate users automatically, or book appointments. Assessments are reflective check-ins, not validated diagnostic instruments. OAuth, password-reset email, remote push infrastructure and social feeds are not implemented or claimed.

Agent contributors must read [AGENTS.md](AGENTS.md), [project context](PROJECT_CONTEXT.md), and [design rules](DESIGN.md).
