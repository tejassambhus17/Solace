# Solace API

Node.js + TypeScript + Express API with a SQLite database through SQL.js. The API is for the Expo app in the parent directory.

## Run

From the repository root, run `npm run setup` and `npm run doctor`, then `npm run server`. Setup installs both lockfiles with development and platform-optional dependencies, builds this API, and creates only missing environment files. Existing files and database records are preserved. See [the Mac simulator repair guide](../docs/LOCAL_DEVELOPMENT.md).

For server-only development after that setup, `npm --prefix server run dev` watches TypeScript. For production, run `npm --prefix server run build` before `npm --prefix server start`; the start command runs compiled JavaScript and does not require tsx. Run these with a supported Node runtime; root `npm run server:build` selects the project's configured runtime automatically.

Defaults: port 3001, one SQLite file at `server/data/solace.sqlite`. Private `.env` loading and relative database paths are anchored to server/, regardless of the caller's working directory. PORT, HOST, AI_MODE and proxy-hop settings are validated before database access. The listener is reserved first so a second launch on a busy port cannot rewrite the running API's database. Requests during initialization return HTTP 503; readiness is announced only after database/app initialization. Failed initialization releases the port.

`GET /api/health` reports the active companion provider without disclosing credentials. Authentication needs no AI provider key. A healthy API does not by itself prove the client can reach it or a live AI request succeeds.

## Live AI and offline companion

Put `OPENAI_API_KEY` in **server/.env** or the private server environment. Restart the API after changing configuration. The pinned OpenAI Node SDK handles Responses and Audio over the official OpenAI API.

- `OPENAI_CHAT_MODEL` defaults to `gpt-6.1-terra`. `OPENAI_LIGHT_MODEL` defaults to `gpt-6-luna` for structured generation. Model overrides are explicit.
- `AI_MODE=auto` uses OpenAI with a key and labeled built-in guidance otherwise. `AI_MODE=live` requires an OpenAI key. `AI_MODE=offline` disables provider requests. Live request failures return recoverable errors.
- Live chat sends bounded conversation turns. Approved preferences and recent mood/tag context require personalization consent. Responses use `store:false` and keep conversation records on Solace. Journal AI sends only an explicitly approved excerpt. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)

See the [model, privacy and usage configuration](../docs/OPENAI_MIGRATION.md).

## Routes

| Method | Route | Body / result |
|---|---|---|
| GET | `/api/health` | Public status and provider mode |
| POST | `/api/auth/register` | `{name,email,password}` → `{token,user}` |
| POST | `/api/auth/login` | `{email,password}` → `{token,user}` |
| GET | `/api/auth/me` | `{user}` |
| PATCH | `/api/auth/me` | `{name?,personalization?,avatar?}` → `{user}` |
| POST | `/api/auth/logout` | Revokes current token, 204 |
| GET | `/api/state` | `{user,data:{checkins,conversations,sessions,reflections,assessments,memories,reminders,plans,favorites}}` |
| GET | `/api/records/:collection` | `{records}` |
| POST | `/api/records/:collection` | Record body → `{record}`, 201 |
| PATCH | `/api/records/:collection/:id` | Changes → `{record}` |
| DELETE | `/api/records/:collection/:id` | Removes owned record, 204 |
| POST | `/api/chat` | `{text,conversationId?,requestId?}` → `{conversation,reply,provider,action?,appAction?}` |
| GET | `/api/export` | Downloadable JSON for current account |
| DELETE | `/api/account` or `/api/auth/me` | Deletes account, sessions and records, 204 |

All non-public routes require `Authorization: Bearer <token>`. Tokens are random, stored as hashes and expire after 30 days. Passwords are scrypt-derived with independent random salts. Returned user objects never include password hashes. Body size, collection names, known fields, IDs and auth inputs are validated. Account ownership is imposed by the server, irrespective of any user identifier in JSON data.

The chat endpoint stores each successful user/assistant exchange together. Saved conversations can be renamed without editing their message history. Deleting a conversation also removes preferences whose `sourceConversationId` is that conversation. Session-derived preferences have owned source validation and are removed when their source session is deleted. An in-flight reply cannot recreate a deleted conversation or deleted account. One provider chat is allowed in flight per account. Conversations are limited to 200 messages and 80,000 input characters before requesting a new conversation. Explicit distress receives local human-support guidance even when a provider request is pending or a conversation is full.

Clients can provide a UUID `requestId` and reuse it with the same text and original conversation ID when retrying. For 24 hours the API returns the saved exchange without another provider call, rejects changed input, and rejects retrying an exchange from a deleted conversation. The receipt contains IDs and an expiration timestamp. Expired receipts are pruned on startup and on later chat writes for that account. Account deletion removes its receipts.

Current clients send `X-Solace-App-Actions: 1` with chat or Realtime session creation. The backend validates proposed actions against a typed allowlist and the latest direct request. Text retries return the original proposal ID. Live Voice delivers an action through authenticated, revisioned session state only after a completed tool turn and uninterrupted playback of its acknowledgement. The mobile app handles confirmation and uses the existing authorized APIs and local reminder scheduler. Proposal acknowledgement is distinct from execution feedback. Journal discussion does not expose app tools.

Live provider response bodies are limited to 256 KiB. Malformed, refused, incomplete, or oversized replies surface as recoverable provider errors. Reminders store preferences on the server and the Expo client handles native scheduling and delivery.

## Deployment

Use one server process and a persistent private volume for `DATABASE_PATH`. SQL.js loads SQLite in process and writes through an atomic file replacement; this is suitable for a single-instance prototype, not concurrent replicas sharing one database file. For multi-instance scaling, migrate the storage adapter to managed PostgreSQL. Back up the database; it contains sensitive user information and is not application-encrypted. Serve the API over HTTPS in deployment, configure precise `ALLOWED_ORIGINS`, set host environment variables rather than checking `.env` into Git, and restrict filesystem access. Rate limits default to 180 API requests/minute and 30 authentication attempts per 15 minutes per source IP. Set `TRUST_PROXY_HOPS` to the exact number of controlled reverse-proxy hops (integer 0–3) only when the deployment topology is known and all incoming paths have that topology. Keep the default `0` for direct access or uncertain topology. The server rejects invalid values at startup and never enables blanket proxy trust; trusting an incorrect hop count can permit client-IP spoofing and weaken rate limits.

There is no email/password reset service or remote push delivery service configured. Do not claim email has been sent or that this API delivers device notifications. The offline distress route provides general human-support guidance without guessing helpline numbers; it is not a clinically validated risk classifier or emergency service.

The Dockerfile uses a Node 24 multi-stage build: the build stage runs lockfile-based `npm ci` and compiles TypeScript, while the non-root runtime stage installs only production dependencies and runs `node dist/index.js`. It does not install a runtime TypeScript tool. Mount a writable persistent volume at `/data` and provide secrets via deployment environment variables. Example behind exactly one known controlled proxy: set `TRUST_PROXY_HOPS=1`; direct deployments should use `TRUST_PROXY_HOPS=0`.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover auth, account isolation, malformed input, actual mobile payloads, calendar-day validation, rollback after failed disk persistence, consent, chat continuation, source-linked memory deletion, concurrent chat/deletion races, account export/deletion, offline labeling and the live provider adapter using a stub. Live provider access needs a valid configured key and a separate real-provider test. Tests bind loopback HTTP servers; an environment that blocks local sockets must allow loopback for them.

## Private profile photos

PATCH `/api/auth/me` accepts `avatar: "data:image/jpeg;base64,..."` or `null`. JPEG bytes are limited to 256 KiB, decoded at a maximum of 4,194,304 pixels (4096 per side), oriented, cropped to 256×256 and re-encoded without EXIF/GPS metadata. This route alone accepts up to 512 KiB JSON; other JSON limits remain unchanged. Remote URLs and filesystem paths are rejected. The normalized data URI is returned as `user.avatar` in authentication/state/export and stored in the user's existing private database row. `null` removes it. Existing databases gain a nullable column safely. Late photo processing revalidates the bearer session and cannot restore a removed/replaced image or deleted account. Tests use synthetic images and isolated databases.


## Generated Moments, weekly reflections and voice

- `GET /api/capabilities` (authenticated) reports configured `voiceTranscription`, `voiceSpeech`, and `aiProvider`. Availability reflects configuration. Provider errors remain recoverable.
- `POST /api/moments/generate` takes `{feeling, environment?}` and returns `{activity, provider, explanation, usedMemoryIds}`. The server requests strict structured output and validates type, duration, steps, breathing bounds and environment. Built-in mode labels curated templates `offline`. Serious-distress input returns human-support guidance.
- `POST /api/insights/weekly` takes optional `{endDate:"YYYY-MM-DD"}`. Counts come from the authenticated account's actual saved records; incomplete/future sessions are excluded. The live service receives aggregate participation counts only, never journal text. AI may phrase an optional reflection question; server-computed totals are always retained and no clinical trend is inferred. Empty accounts have a factual empty state.
- `POST /api/plans/preview` accepts `{goal, preferredFocuses, dailyMinutes}`. It returns three canonical activity choices and a source label. The existing Save action controls persistence.
- `POST /api/voice/transcribe` sends bounded, in-memory audio to OpenAI with `gpt-transcribe` by default and returns `{text,provider:"live"}`. `POST /api/voice/speech` synthesizes a saved, account-owned assistant reply as MP3 with `gpt-4o-mini-tts` and `marin` by default. The user can cancel playback and continue in text after a provider error. [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text) · [OpenAI Audio Speech](https://developers.openai.com/api/docs/guides/text-to-speech)

Structured Moments persist through the existing `sessions` collection with `kind:"generated"`, validated `activity`, selected `environment`, actual `durationSec`, `completed`, optional `provider` and optional self-reported `feedback`. A stable client ID and original creation timestamp make exact creation retries idempotent; a changed payload conflicts instead of adding another completion. The account-scoped `preferences` collection uses one `id:"wellness"` record with `environment`, `ambientEnabled` and `streaksEnabled`. `goals` records contain a title, weekly target of 5–210 minutes and an active flag. These records participate in state, export, persistence and account deletion. They do not create an emotional score or achievement by themselves.

Memory categories may be `preference`, `activity`, `goal` or `context`. Only approved, still-owned sources with active consent influence personalization. Generated recommendations report the actual memory ID and exact approved preference used to select their template. After asynchronous provider work, the API rechecks active authentication and any used memory/consent. Deleted/corrected memory or revoked consent cannot create a late personalized reply/activity.

Deleting or editing memory, removing a source that cascades to memory, or disabling personalization resets AI context in retained conversations. Visible/exported history remains intact. `contextResetMessageCount`, `contextResetAt` and a server-owned reset ID record this boundary; only subsequent messages are sent as conversation context. Renaming/patching cannot lower or remove it, and an in-flight reply using the earlier context is rejected. This prevents an older assistant quote of a deleted preference being silently fed back as active personalization. Ordinary new text explicitly sent by the user remains part of its current turn. Provider-side retention is governed separately by the provider; app-side deletion cannot retract an already transmitted request.

See the [verification record](../docs/VERIFICATION.md) for live and mocked test coverage.
