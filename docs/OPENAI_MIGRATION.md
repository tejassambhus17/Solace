# Solace OpenAI migration

## Configuration

Install from the existing server lockfile, use Node 22.13+ and keep the project key in `server/.env` or the hosting platform’s private server environment. Restart the Node API after changing these settings. The Expo app continues to use only the Solace API address.

| Setting | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `openai` | The single live provider. Startup rejects other values. |
| `OPENAI_API_KEY` | Empty | An OpenAI project key with API billing and model access. |
| `OPENAI_CHAT_MODEL` | `gpt-6.1-terra` | Companion and selected Journal discussion via Responses. |
| `OPENAI_LIGHT_MODEL` | `gpt-6-luna` | Strict structured Responses for Moments, Journal, plans, habits, and weekly prompts. |
| `OPENAI_TRANSCRIPTION_MODEL` | `gpt-transcribe` | Turn-based file transcription. |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | Turn-based Audio Speech output. |
| `OPENAI_TTS_VOICE` | `marin` | Built-in speech voice. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Official OpenAI API. An official regional OpenAI API URL is accepted. |
| `AI_MODE` | `auto` | `auto` uses a configured key and otherwise serves labeled built-in guidance. `live` requires a key at startup. `offline` disables provider requests. |
| `OPENAI_USAGE_LOG` | `false` | When enabled, emits changed aggregate text usage every minute and at graceful shutdown. |

Use `npm run server:build` and `npm run server` from the repository root. Keep the deployed SQLite path and volume when rolling out the API. Set `AI_MODE=live` for a deployment intended to require AI. Remove the legacy `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_FALLBACK_ENABLED`, and `OPENAI_MODEL` entries from your deployment settings. The new configuration ignores them. Use the chat and light model variables for overrides. Each model needs access in the deployed OpenAI project. Failed access returns an explicit error and keeps the configured model.

All four default models were listed by the locally configured OpenAI project and exercised through the Solace API. `gpt-transcribe` is the documented replacement for the deprecated GPT-4o Mini Transcribe model. The existing Audio Speech workflow uses `gpt-4o-mini-tts`, which OpenAI schedules for removal on **January 6, 2027**. OpenAI’s successor uses a different API. Before the cutoff, migrate the server synthesis transport while retaining the turn-based client. [OpenAI models](https://developers.openai.com/api/docs/models) · [File transcription](https://developers.openai.com/api/docs/guides/speech-to-text) · [Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)

## AI feature inventory

| Feature | Existing entry | Migration and data boundary |
| --- | --- | --- |
| Companion text and practice suggestions | `POST /api/chat` | Terra streams upstream. Solace collects the final structured reply and validates it before returning or persisting it. The client still receives one validated turn. Conversation IDs, history, receipt replay, allowlisted activities and local urgent-support handling stay in the existing pipeline. |
| Memory and personalization | Account preferences, approved memories and current chat | Owner-scoped, approved and consented context only. Memory deletion/correction or revoked consent advances the local context boundary. A late reply using invalid context cannot persist. |
| Voice recording and transcript | `POST /api/voice/transcribe` | Expo records locally. The SDK sends the bounded recording to OpenAI. The editable transcript enters the existing chat only after the user sends it. |
| Spoken replies | `POST /api/voice/speech` | Tap-to-play sends IDs to Solace. The backend resolves a saved, owned, eligible assistant reply and sends only that text to OpenAI. The private MP3 is transient. The client stops and releases audio on cancellation; built-in offline replies use device speech. |
| Personalized Moments and explanation | `POST /api/moments/generate` | Luna returns strict, validated activity content. Explanations use Solace's real evidence, and completion uses the existing activity record. |
| Journal prompts, reflections and discussion | `POST /api/journal/:id/reflect` and `/discuss` | An explicit selection and current revision authorize the exact excerpt. Reflection uses Luna, and discussion uses Terra. The unselected entry and unrelated memories stay private. |
| Personalized wellness plans | `POST /api/plans/preview` | Luna selects three focus values from the user's choices. Solace resolves them into canonical activities of the requested duration. Save/Start remain user actions. Built-in previews have a visible source label. |
| Habit and routine suggestions, adjustments and reflection | `POST /api/habits/suggest` | Luna chooses from the existing typed contract. Saved progress requires opt-in. The result is a proposal for user review. |
| Weekly Journey story | `POST /api/insights/weekly` | Luna can phrase an optional question from saved aggregate counts. The numbers and factual summary come from existing deterministic analytics. |
| Daily Pause, guided program catalog, progress and milestones | Existing local selectors and records | Daily Pause scheduling and explanations retain their curated, deterministic behavior. No automatic AI request is made during tab navigation. |
| Google Sign-In | Google OAuth and linking routes | Separate authentication flow and credentials. Backend and client configuration remain independent of OpenAI. |

## Privacy and cost controls

- The official `openai` Node SDK is pinned in the server lockfile. API keys, audio uploads, response parsing, and provider error handling stay on the server. The migration removed the Gemini REST and failover branches. The repo had no Gemini SDK to uninstall. A legacy shell-secret scrubber still strips old provider credentials from Metro.
- Responses set `store:false` and use bounded, locally stored history. Default text models use an explicit cache mode with no cache breakpoint. Solace does not create an OpenAI conversation or store provider-side response IDs. API training and retention are governed by the OpenAI project's data controls, including applicable abuse monitoring retention. `store:false` alone does not configure Zero Data Retention. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- The default server limits authenticated text-generation traffic to 24 requests per account per minute across live routes. The existing voice limits, request-size bounds and in-flight locks apply separately. Local urgent support and saved idempotent chat replays do not spend the live-generation budget.
- Provider calls have a 30-second deadline, feature-specific output-token caps and bounded response bodies. Eligible nonstreaming requests can retry one explicit transient rejection after a short delay when authorization and context are current. Ambiguous transport failures, streamed Companion turns, journal excerpt requests and quota exhaustion are returned without automatic resubmission. The app keeps drafts and exposes text alternatives.
- Optional usage logs contain process-local totals by configured model and workflow with input, cached-input and output tokens. Standard Terra/Luna text cost estimates cover supported pricing tiers and do not include audio. The OpenAI project’s usage and billing reports are authoritative, including after API restarts. [OpenAI pricing](https://developers.openai.com/api/docs/pricing)

## Verification

- The [live smoke](../work/openai-migration/live-result.json) used synthetic input and a disposable SQLite database. It verified real multi-turn context, duplicate receipt replay, saved conversation reopen, approved memory use and exclusion after deletion, a validated Moment and saved completion, Journal excerpt isolation, plan preview without a write, a habit suggestion, and a weekly prompt from saved counts. The API returned a private MP3 and then transcribed that synthetic audio.
- The [production Chrome voice check](../work/openai-migration/voice-browser.json) used synthetic MP3 input to verify visible AI speech disclosure, actual player start, speaking state, Stop, audio cleanup, and rate-limit text fallback.
- The [production Chrome plan check](../work/openai-migration/plans-evidence/browser-result.json) used the labeled built-in mode and exercised preview, editing, saving, starting, completion in Journey, and existing program and legacy records. Live plan generation was verified separately by the synthetic API smoke.
- TypeScript, Prettier, 260 app and tooling tests, and 131 backend tests passed. OAuth tests covered the existing Google flow using fixtures. Expo production exports passed for web, Android and iOS. Gradle `:app:assembleRelease` and `:app:lintVitalRelease` passed for the x86-64 Android QA build.
- Native microphone permission, audio output and interruption, live Google account sign-in, and native iOS execution remain separate device checks. The local tests used disposable records and did not deploy the API.

## Files changed

- Provider service and configuration: `server/src/openai-service.ts`, `generation.ts`, `config.ts`, `index.ts`, `server/.env.example`, `server/package.json`, and `server/package-lock.json`. Removed the legacy `server/src/provider-response.ts`.
- Backend feature wiring: `server/src/ai.ts`, `app.ts`, `habit-ai.ts`, `journal-ai.ts`, `moments.ts`, `weekly.ts`, `voice.ts`, and `wellness-plan-ai.ts`.
- Client and tooling: `src/store.tsx`, `src/VoiceControlsImpl.tsx`, `src/screens/Core.tsx`, `VoiceTalk.tsx`, `WellnessPlans.tsx`, `JournalReflection.tsx`, `Profile.tsx`, and `scripts/dev-supervisor.cjs`.
- Tests: `server/tests/openai-service.test.ts`, `openai-fixture.ts`, `wellness-plan-ai.test.ts`, `api.test.ts`, `chat-practices.test.ts`, `features.test.ts`, `habit-ai.test.ts`, `journal-ai.test.ts`, `startup.test.ts`, `voice-provider.test.ts`, and `scripts/test-tooling.cjs`.
- Documentation: this report, `README.md`, `server/README.md`, `docs/GOOGLE_AUTH_SETUP.md`, `LOCAL_DEVELOPMENT.md`, `PREMIUM_EXPANSION.md`, `RELEASE.md`, `REQUIREMENTS.md`, and `VERIFICATION.md`.
