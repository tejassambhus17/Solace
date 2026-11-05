# Solace agent instructions

## Product and source of truth
- Read `PROJECT_CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`, and `docs/REQUIREMENTS.md` before changing a user journey.
- The hackathon brief is `Solace_AI_Hackathon_Task.pdf`. Approved visual targets are in `design/references/`.
- Ship a React Native + Expo mobile app and a Node.js API with a persistent database. The web build is a preview of the same mobile source.
- Preserve four main tabs, in this order: Today, Solace, Journey, Profile.
- Support light, dark, and device theme preferences.

## Engineering rules
- Keep API keys in `server/.env`. Never place provider secrets in Expo public variables, source, logs, or commits.
- All private data must be scoped to the authenticated account on the server. Verify cross-account isolation when changing storage.
- Store passwords only as slow salted hashes and session tokens only as hashes.
- No UI control may claim an external operation succeeded when it did not. Clearly distinguish live AI from the local companion fallback.
- Conversation deletion also removes memories derived from that conversation. Memory consent is optional and revocable.
- Avoid diagnosis, treatment promises, invented therapist listings, and unverified emergency numbers.
- Keep user text through recoverable errors. Make loading, empty, disabled, and retry states understandable.
- Reminders need native-device verification; a browser preview cannot prove background delivery.
- Do not mark a feature verified merely because it renders or compiles.

## Collaboration and verification
- Agents share the working tree. Agree file ownership before editing; never overwrite another agent's work.
- Run type checks, server integration tests, and the web export for relevant changes. Use `docs/VERIFICATION.md` to record actual results and remaining device checks.
- Preserve the original reference archive and PDF. Generate assets in `assets/`, scratch in `work/`.
- Update the README and requirements matrix when behavior, configuration, or limitations change.
- Use the project's package scripts. Node 22.13+ is the supported runtime; do not silently use the Windows default Node 20.

## Completion bar
A complete submission requires real provider configuration, a publicly reachable HTTPS API, an installable APK tested on a physical device, verified reminder behavior, and a demo recorded from the final build. Keep these separate from local preview completion.

## Latest execution priority
- The local backend/authentication repair is verified. The user subsequently directed full feature implementation without questions and deferred external setups. Continue implementation; keep Mac simulator, real-provider, deployment and device checks explicitly separate from local evidence.
- Follow docs/IMPLEMENTATION_PLAN.md for the six milestones. Keep completed local checks distinct from native/external gates.
- Do not introduce Docker or unnecessary branches. Commit coherent completed work to the existing branch after review/testing; never commit credentials or local environment files.
