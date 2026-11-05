# Solace API

Node.js + TypeScript + Express API with a SQLite database through SQL.js. The API is for the Expo app in the parent directory.

## Run

From the repository root, run `npm run setup` and `npm run doctor`, then `npm run server`. Setup installs both lockfiles with development and platform-optional dependencies, builds this API, and creates only missing environment files. Existing files and database records are preserved. See [the Mac simulator repair guide](../docs/LOCAL_DEVELOPMENT.md).

For server-only development after that setup, `npm --prefix server run dev` watches TypeScript. For production, run `npm --prefix server run build` before `npm --prefix server start`; the start command runs compiled JavaScript and does not require tsx. Run these with a supported Node runtime; root `npm run server:build` selects the project's configured runtime automatically.

Defaults: port 3001, one SQLite file at `server/data/solace.sqlite`. Private `.env` loading and relative database paths are anchored to server/, regardless of the caller's working directory. PORT, HOST, AI_MODE and proxy-hop settings are validated before database access. The listener is reserved first so a second launch on a busy port cannot rewrite the running API's database. Requests during initialization return HTTP 503; readiness is announced only after database/app initialization. Failed initialization releases the port.

`GET /api/health` reports the active companion provider without disclosing credentials. Authentication needs no AI provider key. A healthy API does not by itself prove the client can reach it or a live AI request succeeds.

## Live AI and offline companion

Put `OPENAI_API_KEY` in **server/.env**, never an `EXPO_PUBLIC_*` variable. Configure `OPENAI_MODEL` for a model available to your provider account. The default `gpt-4.1-mini` is a configurable starting value, not an account availability guarantee. `AI_MODE=auto` uses the live Responses API when a key exists and a deterministic offline companion when it does not. `AI_MODE=live` requires a key. `AI_MODE=offline` never makes provider requests.

Offline responses are intentionally labeled `provider: "offline"`; they are not LLM responses. When a configured live service fails, the API returns a recoverable 502 and does not silently substitute offline output. Current conversation messages are sent for ordinary live chat. Approved preferences and recent mood/tag context are only added when `user.personalization` is true. No chat records are configured for provider-side storage (`store:false`), which does not constitute a broader provider-retention guarantee.

Integration follows [OpenAI's text generation documentation](https://developers.openai.com/api/docs/guides/text). The service uses direct HTTPS fetch to `/v1/responses`; no API SDK or client-side secret is required.

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
| POST | `/api/chat` | `{text,conversationId?}` → `{conversation,reply,provider,action?}` |
| GET | `/api/export` | Downloadable JSON for current account |
| DELETE | `/api/account` or `/api/auth/me` | Deletes account, sessions and records, 204 |

All non-public routes require `Authorization: Bearer <token>`. Tokens are random, stored as hashes and expire after 30 days. Passwords are scrypt-derived with independent random salts. Returned user objects never include password hashes. Body size, collection names, known fields, IDs and auth inputs are validated. Account ownership is imposed by the server, irrespective of any user identifier in JSON data.

The chat endpoint stores each successful user/assistant exchange together. Deleting a conversation also removes preferences whose `sourceConversationId` is that conversation. Session-derived preferences have owned source validation and are removed when their source session is deleted. An in-flight reply cannot recreate a deleted conversation or deleted account. One in-flight chat is allowed per account. Conversations are limited to 200 messages and 80,000 input characters before requesting a new conversation. Reminders store preferences only: native scheduling and delivery are performed by the Expo client, not this server.

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
