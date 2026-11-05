# Solace

A warm mobile wellness companion built in React Native + Expo with a Node.js API and a persistent SQLite database. It connects check-ins, conversations, calming activities and reflection, with optional user-approved personalization.

## Current status

The app is implemented for Android/iOS through Expo, with a working local web preview of the same React Native source. Light/dark themes, accounts, saved conversations, wellness activities and profile controls are implemented. Native installation and device behavior remain to be verified. See [the requirements matrix](docs/REQUIREMENTS.md) and [verification record](docs/VERIFICATION.md) for exact coverage and evidence.

**Live AI is not enabled in this checkout:** the user chose to continue without a provider key. The app labels its built-in companion responses. A real Responses API adapter is ready, but live-provider testing remains required. An Android compilation-check APK has been produced, but it is not a functional phone/submission build: it embeds the development emulator endpoint. A hosted HTTPS endpoint, rebuilt APK, device notification test, and submission video remain separate release steps. Hosting is deferred at the user’s request.

## Requirements

- Node **22.13 or newer**, preferably Node 24 LTS. Windows' default Node 20 is insufficient for the current Expo toolchain. On this machine, package scripts use an ignored local configuration pointing to the bundled Node 24. Other machines should install Node 24 or set SOLACE_NODE.
- npm; a phone with a matching Expo Go version for early testing, or an Expo development/preview build.
- An Expo account for cloud APK builds. Public HTTPS hosting for the backend before sharing the final APK.

## Quick start

```powershell
npm ci
npm --prefix server ci
Copy-Item .env.example .env
Copy-Item server/.env.example server/.env
npm run dev
```

Open the Expo web URL printed in the terminal (normally `http://127.0.0.1:8081`). The API runs on port 3001. Create an account; no production user or prefilled history is seeded. Test activity creates actual account data in `server/data/solace.sqlite`.

Alternatively run `npm run server` and `npm run web` in separate terminals. For the packaged preview run `npm run export:web`, then `npm run preview` (port 8082). `npm start` opens the Expo development server for phone/emulator testing. Stop development processes with Ctrl+C.

## Physical Android phone

1. Put phone and computer on the same trusted network.
2. Set `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3001` in root `.env` (the emulator default `10.0.2.2` is not a physical-phone address).
3. Start the backend, run `npm start -- --clear`, and open the project on the phone.
4. Allow only the needed local-network access if Windows asks. Never expose the development API publicly without deployment configuration.

Reminder delivery, notification taps, background behavior, keyboard/safe-area behavior and Android Back must be checked on the actual installed build. The web preview deliberately saves reminder preferences without pretending to schedule native notifications.

## Live AI

Set `OPENAI_API_KEY` in **server/.env**, never in root public variables. Set `OPENAI_MODEL` to a model available to your account, then restart the API. Use `AI_MODE=live` to require the real provider; `auto` uses the built-in companion when no key exists; `offline` always uses built-in responses. Provider failures produce a recoverable error, not undisclosed fallback. Current-conversation context is sent for chat; recent check-ins and approved preferences are added only when personalization is enabled. See [server documentation](server/README.md).

## Main features

- Today: mood check-in, personal greeting, affirmation, activity recommendations and quick access.
- Solace: conversation, actionable activity cards, new/reopen/continue/delete history and visible provider mode.
- Journey: saved check-ins, moments, feedback, reflections, assessments, factual XP and streaks.
- Wellness: three non-diagnostic reflective questionnaires; timed breathing; journaling; five resource guides; editable plan; affirmations and small challenges.
- Profile: themes, reminder types/time/days, approved memories, name update, data export, logout and account deletion.
- Notifications: native recurring local schedules with private copy and destination routing; browser limitation is explicit.

## Project map

```text
App.tsx                   app shell and four-tab navigation
src/theme.tsx             light/dark/system tokens
src/ui.tsx                shared mobile components
src/store.tsx             authenticated API state and secure session storage
src/content.ts            wellness content and pure progress logic
src/screens/Core.tsx      welcome, accounts, Today, chat, history, Journey
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
npm run test:wellness
npm run test:reminders
npm --prefix server run typecheck
npm --prefix server test
npm --prefix server run build
npm run export:web
npm run export:android
```

Native JS export verifies bundling, not APK installation or device APIs. Backend tests use an isolated test database and mock live-provider requests; they never require a real key. See the verification record before claiming release readiness.

## Build and submit

Follow [release instructions](docs/RELEASE.md). `eas.json` includes an APK preview profile. Set a public HTTPS API URL **before** building, sign into Expo, then run `npx eas-cli build --platform android --profile preview`. Fresh-install and verify the exact resulting APK. The PDF calls for an app build and demo video; it does not require source submission. The guide says video is used during initial shortlisting, so record a concise real-product journey plus brief coverage of the remaining sections.

## Privacy and operating limits

The prototype uses salted password hashes, hashed expiring sessions, server-enforced account isolation, explicit personalization, record validation, rate limits, and data export/deletion. SQLite data is not application-encrypted. Production requires HTTPS, a private persistent disk, backups, explicit web origins and trusted reverse-proxy configuration. Run only one API replica with the current SQL.js storage adapter. This is not a clinical or emergency service.

The country support page links to external directories; it does not invent practitioners, locate users automatically, or book appointments. Assessments are reflective check-ins, not validated diagnostic instruments. OAuth, password-reset email, remote push infrastructure and social feeds are not implemented or claimed.

Agent contributors must read [AGENTS.md](AGENTS.md), [project context](PROJECT_CONTEXT.md), and [design rules](DESIGN.md).
