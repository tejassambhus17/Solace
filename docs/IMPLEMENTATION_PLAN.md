# Master implementation milestones

Deadline supplied by the user: Tuesday, 10 November 2026 at 11:59 AM IST. Target feature completion Monday evening; reserve the final period for native builds, real-device checks, fixes, demo and submission verification.

## Current execution direction

Local backend/authentication repair was completed first. The user then explicitly requested feature implementation without questions and deferred external/provider/device setup. Feature work therefore continued across the milestones below. The feature checkpoint has 193 passing regressions, with exact commands and limits in VERIFICATION.md. Deferred Mac, live-provider and device checks are still unverified; they are release work rather than a reason to stop coding.

Use four main tabs in the workspace instruction order: **Today, Solace, Journey, Profile**. Moments is reached from Today or the Solace header. The Moments library keeps the earlier Explore practices, toolkit and resources available. No social/community features, Docker introduction or unnecessary branch creation is included.

## 1. Backend and authentication — implemented; local evidence recorded

Portable dual-lockfile setup, supported runtime selection, doctor checks, server-root environment/database resolution, safe listener-before-database initialization and owned-child dev readiness are implemented. Local signup/login/logout, account isolation, session restoration and history across actual API restarts were tested. Mac simulator signup and native credential restoration remain deferred.

## 2. Core journeys and navigation — implemented; native/live checks deferred

Accounts, mood tracking, conversation history/search/rename/continue/delete, protected-writing recovery, profile photos, optional memory, reminder preferences and private data controls remain available. The four-tab shell preserves access to the full library through Moments. Notification scheduling/tap routing remains implemented; installed-device delivery and a successful live AI conversation still need their separate acceptance runs.

## 3. Companion and Solace Moments — implemented

The reusable petal companion supports event-driven idle/listening/thinking/speaking/celebration/breathing states and reduced motion. Moment generation uses validated bounded structured data, clear provider labels and a human-support bypass for urgent distress. The immersive player supports active-time guidance, progress, pause/resume, exit protection, background pause, optional ambience and feedback, account persistence and explicit optional source-memory creation.

Local browser evidence includes a real saved 60-second curated Moment, a pause with the active clock held, environment switching and ambient playback status. Provider adapter/player regressions cover additional validation, timing, persistence and failure branches. Configured-provider generation and native interruptions/audio still need actual device/service verification.

## 4. Explainable memory and Journey — implemented

Memory has category/source explanations, correction, approval, individual/all removal, global consent and completion-prefill without autosave. Source deletion cascades derived memories. Edits/deletion/consent-off invalidate older provider conversation context without rewriting visible history; pending stale-context replies are rejected.

Journey adds a selectable calendar/day history, saved-practice time and helpfulness, truthful weekly facts/reflections, personal time goals, optional streaks and actual-record milestones. Browser checks include source-memory save/edit/consent, a persisted goal with pause/resume, an earned milestone and the labeled local weekly summary. Real-provider reflection quality and native accessibility remain acceptance work.

## 5. Voice, environments and gentle progress — implemented

Turn-based Expo Audio recording is permission-aware and bounded. The authenticated backend supports raw-audio transcription; native Expo configuration is checked for the microphone purpose, absence of an Android recording block and absence of background-audio entitlement; transcripts are reviewed before explicit manual chat sending. Failed requests can retry and typing remains available. Expo Speech playback uses actual lifecycle callbacks; cancellation/account/conversation transitions prevent stale transcript insertion. Voice runtime failures fall back to text without breaking Chat.

Forest Sanctuary, Ocean Calm and Twilight Sky have distinct lightweight scenes, optional locally bundled original ambience and persisted preferences. Personal goals, optional streaks and achievements use actual stored events and non-punitive wording. Native microphone/TTS/permission/interruption behavior and configured transcription remain unverified until the deferred setups are performed.

## 6. Acceptance and delivery — still pending external/device work

Run the user's 24 acceptance scenarios against the final installed artifacts and configured services. Complete these separately:

1. Configure and evaluate actual live chat, structured Moments, weekly reflections and voice transcription privately on the backend.
2. Deploy a publicly reachable HTTPS API with a persistent private database and production origins/proxy settings.
3. Build a new installable Android APK containing the new native modules and HTTPS configuration, then fresh-install/test it on a physical phone.
4. Verify the iOS simulator/build, native session restart, microphone, playback, permissions, safe areas, glass/accessibility and interruptions.
5. Verify reminder scheduling/edits/denial/background/closed delivery and notification tap navigation on the installed build.
6. Profile the real-device app, fix final defects, record the final build demo and verify submission artifacts before the deadline.

The old compilation-check APK and JavaScript/Hermes exports do not complete these tasks. Feature implementation is not a claim of production release readiness. Exact executed tests and browser evidence are maintained in VERIFICATION.md; do not infer unrun checks from the presence of code or mocks.
