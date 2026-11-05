# Requirements and coverage

Sources: the original 11-page hackathon PDF, approved botanical references, the user's master implementation brief and the subsequently supplied workspace instructions. **Implemented** means working code exists; **verified** requires the actual check recorded in [VERIFICATION.md](VERIFICATION.md). No JavaScript export or provider stub counts as an installed-device or real-provider test.

## Current delivery scope

The user directed feature implementation to continue while deferring provider, hosting and device setup. The four main tabs are **Today, Solace, Journey, Profile**. The labeled **Explore** shortcut between Solace and Journey opens the practice library directly. Moments is available from Explore, Today and the Solace header.

| Source | Capability | Current implementation | Verification boundary |
|---|---|---|---|
| PDF2–3 / core | Splash, onboarding, accounts and sessions | Branded loading/welcome, signup/login/logout, server-validated sessions and recovery | Actual local browser auth/restart verified; native fresh installation and force-quit/relaunch pending |
| PDF3–4 / workspace | Personal home and four main tabs | Botanical Today/daily pause, Solace, Journey and Profile, with a persistent Explore library shortcut | Browser navigation evidence in VERIFICATION.md. Native materials and gestures remain pending. |
| PDF4–5 / core | Real contextual conversations | Server Responses adapter, bounded current conversation and consented context; explicitly labeled built-in companion | Adapter and failure/isolation tests plus actual built-in browser exchanges; real provider deferred |
| PDF5–6 / core | Conversation history | Start new, search, rename, continue, delete; recent-conversation entry and unsent-text recovery | Server/provider-state regressions and actual browser continuity; native storage lifecycle pending |
| Master 1 | Expressive companion | Reusable lightweight petal with idle, listening, thinking, speaking, celebration and breathing states driven by actual events; reduced-motion support | Source, lifecycle tests and browser activity states; native recording/playback animation correspondence pending |
| Master 2 | Structured Solace Moments | Authenticated generation with schema-validated activity type/title/duration/steps, bounded breathing rhythm, prompts and environment; live/curated labels | Server schema/provider-transport/safety/isolation tests and curated browser generation; actual configured provider deferred |
| Master 2 | Immersive activity player | Active-time progress, named steps, pause/resume, background pause, exit confirmation, environment/audio controls, completion, feedback, retryable persistence and optional explicit memory save | Player regressions and actual browser completion/pause/environment/ambience evidence; native interruption/audio pending |
| Master 3 | Explainable consent-based memory | View/add/correct/category/approve/delete/clear, actual source links, global consent; suggested wording always needs explicit save; explanation identifies used approved memories | Server consent/deletion/race tests plus browser source-memory save/edit/consent; real-provider personalization evaluation pending |
| Master 3 / privacy | Delete from active personalization | Conversation/source-session deletion cascades derived memories; memory edits/deletion and consent-off reset future AI history context while preserving visible/exportable conversations; stale-context replies rejected | Server privacy/isolation/race regressions; external provider retention is not claimed to be controlled by Solace |
| Master 4 | Mood and activity Journey | Selectable monthly calendar/day history, completed-practice minutes, reflections, optional helpfulness, truthful empty states | Progress/weekly helper tests and actual browser Journey updates; native accessibility pending |
| Master 4 | AI-assisted weekly reflection | Backend derives bounded weekly facts from saved records; live adapter or explicitly labeled recorded summary; no fabricated clinical patterns | Server facts/transport/change-race tests, local recorded summary browser flow; real AI output evaluation deferred |
| Master 5 | Turn-based voice | Expo Audio permission/record/stop, bounded authenticated raw-audio transcription, explicit transcript review/manual message send, retries, text fallback and Expo Speech callbacks; Expo permission configuration regression checks | Lifecycle and provider-adapter tests; actual microphone, permission denial, device routing and TTS playback remain native/device checks |
| Master 6 | Ambient environments | Forest Sanctuary, Ocean Calm and Twilight Sky, distinct lightweight scenes, purposeful motion, optional locally bundled original ambient loops and user preference | Browser switching and actual playback status observed; native sound/background/reduced-motion behavior pending |
| Master 7 | Gentle progress | Persisted personal time goals with pause/resume, optional streaks and earned first-Moment/three-reflection/five-pause/seven-day milestones | Pure actual-record/goal/date tests and browser saved goal/milestone flow; no wellbeing or competitive score |
| PDF3,7 | Mood, affirmations and daily recommendations | Mood tray, saved same-day state, curated daily pause/affirmation and explicit generated-Moment entry | API-backed saves, routine tests and browser flows; curated text is never labeled generated AI |
| Video05:41–05:59 | Reflective assessments | Three four-question mood/anxiety/self-compassion flows and saved results | Existing pure logic and browser checks; not diagnostic instruments |
| Video06:03–06:06 | Existing guided breathing/grounding | Timed breathing, optional five-senses grounding with skips/alternatives and honest incomplete counts | Existing tests/browser flows; native Back/background handling pending |
| PDF5,7 / video | Reflection, resources and plans | Journaling, five guides, interactive resource completion, personal toolkit, editable plan, affirmations and small challenges | Existing API/browser/isolation/export/deletion coverage retained |
| PDF6–7 / core | Scheduled reminders and tap routing | Private recurring local schedules, preference editing, cancellation and destination routing | Coordination tests/browser preference flow only; actual delivery/tap/denial/background checks pending |
| User / privacy | Profile photos and writing recovery | Private bounded JPEG normalization, metadata removal, account export/delete; protected native drafts and bounded retry queue; web memory-only | Server photo/vault/provider tests and browser photo/offline recovery; native picker/secure-storage lifecycle pending |
| Product trust | Account-scoped data and controls | Slow salted passwords, hashed tokens, server ownership, bounded input, export/deletion, honest provider labels | Integration and cross-account isolation regressions; production operations/security assessment separate |
| PDF7–9 | Required architecture | React Native + Expo Android/iOS app, web preview from the same source, Node API and persistent SQLite; portable dual-lockfile setup | Types, server integration/process checks and exports recorded separately from native builds |
| PDF9–10 | Final build and demo | EAS build configuration and release/demo instructions retained | New functional APK, physical-device testing, iOS verification, public HTTPS, real AI and final recording remain deferred release work |

## Latest reliability and usability checks

| Area | Hardening | Evidence |
|---|---|---|
| Signup and private state | Account creation rolls back if initial session creation fails. Account transitions protect local drafts and credentials from late writes. | Server integration and client lifecycle regressions. Browser signup and session restoration across API restart. |
| Chat and support | Unchanged retry requests replay the saved turn within 24 hours. History edits preserve message provenance and privacy boundaries. The latest support reply includes a direct route to human help. | Account-scoped replay, concurrency, deletion and distress regressions. Local outage recovery and support navigation in the browser. |
| Moments and Journey | Optional environment controls expand on demand. Changed feelings invalidate old previews. Canceling exit keeps a paused Moment paused. Calendar month and selected day stay in sync. | Focused helper tests and browser generation, pause, completion, feedback and calendar checks. |
| Reminder preferences | Four-digit time input, clear edit/reset, explicit delete confirmation, serialized restore and edit, deduplicated tap routing. | Coordination tests and browser preference saving and editing. Native scheduling, delivery and tap acceptance remain separate. |
| Preview and motion | Packaged web preview serves real audio MIME and byte ranges. Web motion uses its available driver, and mobile retains native animation. | Local HTTP smoke check, browser playback state and Expo exports. |
| Explore library | One-tap bottom shortcut, visible Moments and practice groups, direct Daily Challenge screen, and Back to the originating screen. | Browser opened all ten library destinations. Session-state regression covers repeated Explore and Back. |

## Current exclusions and limits

- No social feeds, public profiles, following, public posting or community messaging. The user's explicit scope resolves the PDF's unexplained social wording.
- No diagnoses, treatment promises, invented therapist listings/numbers or clinical/compliance certification claims. Human support opens verified external directories rather than claiming an appointment was made.
- No provider credential is included in public variables, client assets or source. Live chat/Moments/weekly output and voice transcription require private backend configuration and actual subsequent evaluation.
- New audio/speech/native-material modules require a rebuilt native binary. The old compilation-check APK is unchanged and does not contain these features.
- Web writing is tab-memory only, native writing is bounded/debounced and cold launch requires API session restoration. Unsynced entries do not earn account milestones.
- SQL.js remains single-instance with full account snapshots; public HTTPS, backups, real-device performance/accessibility and final-build acceptance are separate from feature implementation.

## Acceptance scenarios and evidence

The current feature checkpoint has **193 passing regressions**; exact commands/results are in VERIFICATION.md. The master brief's 24 checks remain the acceptance checklist. Local browser signup/login/logout/session restoration, mood/history flows, saved Moment completion/feedback, source-memory save/edit, Journey updates, environment switching/ambient playback, goals and earned milestones have actual local evidence. Server integration and pure-state tests cover additional isolation, malformed input, failure, deletion and lifecycle branches. Exact runs and limits belong in VERIFICATION.md.

Fresh native installation, native onboarding/restart, real provider responses, native microphone recording/playback, OS permission denial, scheduled/background notification delivery and notification-tap navigation must be checked on the rebuilt installed app. Android/iOS JavaScript exports do not close the Android/iOS native-build acceptance items. Mac simulator access, physical devices and service setup remain deferred by the user.

## Earlier implementation notes (historical)

The sections below preserve decisions and evidence from earlier 5 November passes. Their five-tab/curated-only/planned-feature descriptions record those earlier states. The current matrix and exclusions above supersede conflicting descriptions; original PDF and reference archives are unchanged.

## Earlier 5 November refinement review (historical)

Compared the current implementation with all 11 pages of the original brief and the approved light/dark concepts. Detailed priorities: [FEATURE_GAPS.md](FEATURE_GAPS.md).

| Area | Refinement implemented | Evidence / remaining boundary |
|---|---|---|
| Welcome, login, signup | Reference-led composition, visible field labels, password visibility control, AI role explanation, no profile shortcut | Browser signup, login screen and visibility control exercised |
| Today | Time-aware greeting, saved same-day mood, sculpted mood indicators, dedicated theme-specific artwork, 3-minute featured reset | Browser light/dark phone-width review; native appearance pending |
| Conversation | Fixed composer, in-memory account-scoped drafts, clear built-in/live label, preserved activity metadata | Browser draft navigation and suggested activity journey; live response label code-reviewed only |
| Recovery | Session-load retry after successful auth; committed deletions stay removed even if refresh fails; response-body timeout | Source reviewed; API regressions documented in VERIFICATION.md |
| History and privacy | Resume ordering uses last activity; activity/provider metadata survives edits; existing ownership/cascade constraints retained | Server integration tests; real provider not exercised |
| Wellness/Profile | Consistent headers, larger targets, selected state semantics, reminder editing coordination, clear external-link errors, reversible resource progress | Browser selected mood/tab semantics; native notification delivery still pending |

Required functionality is not equivalent to submission readiness. AI configuration, public HTTPS hosting, final installed-build verification, native reminders and the final demo remain outstanding.

## Earlier black-theme and continuity pass (historical)

Latest user direction: true black dark mode replaces the previous green direction. Light mode remains supported. The later user request adds Explore to simplify navigation, superseding the earlier four-tab constraint.

| Addition or fix | Implementation | Evidence boundary |
|---|---|---|
| Neutral black theme | #000000 canvas, charcoal layers, warm ivory controls; no green-backed featured artwork | Browser color inspection and phone/wide screenshots; native appearance pending |
| Search and name conversations | Search retained titles/message text; inline title editing through authenticated records API | Browser search/rename/reopen; concurrent rename/provider regression |
| Continue a recent conversation | Today resume entry uses account-owned latest activity | Browser navigation; no fabricated history |
| Protect unsaved writing | In-memory check-in, journal and feedback drafts; journal keep/discard; guards for saving fields | Browser navigation checks plus provider-state regressions; drafts do not survive app restart |
| Recover expired sessions | Invalid-token handling, reauthentication, same-account route/draft retention, different-account clearing | Provider-state regression harness; browser expiry flow where recorded |
| Prevent stale work | Serialize credential writes; ignore old-generation callbacks/snapshots; cancel late reminder IDs and navigation | Provider-state and mocked native coordination regressions; actual OS delivery remains pending |
| Match explicit reflection intent | Built-in starter reflection prompts suggest journaling, with urgent-support priority | Server regressions; built-in guidance remains explicitly distinct from live AI |

## Earlier dark-artwork and useful-routine pass (historical)

| Addition | Implementation | Executed evidence / boundary |
|---|---|---|
| Generated dark artwork | Transparent petal, stillness and moonlit raster assets in black/charcoal palette; light-mode separation | Phone/wide browser review; native appearance pending |
| Personal saved toolkit | Persistent, owner-scoped favorites for guides and activities; save/remove/reopen | Browser save/reload/open/remove; duplicate/isolation/persistence/export/deletion server tests |
| Guided grounding | Optional five-senses sequence, skip/previous/exit, active-only duration, existing feedback and source-aware optional memory | Browser completed-with-skip and skip-all runs; native Back/interruption checks pending |
| Weekly review | Factual local-day summary, self-reported supportive activity count, optional journal prompt | 9 pure regressions and actual saved Journey browser facts; no diagnostic claims |
| Rendering efficiency | Cached search selectors, initial 30-row history with show-more, lower-frequency timer displays, near-bottom chat scrolling | Type/bundle checks; device performance profiling and full-snapshot scaling remain pending |

The grounding sequence follows the five-senses structure described by [Hull University Teaching Hospitals NHS Trust](https://www.hey.nhs.uk/wp/wp-content/uploads/2023/02/HEY1318-2022-5-4-3-2-1-Grounding-Technique.pdf), with original app wording and optional alternatives/skips. It is a self-care option, not a treatment claim.

## Earlier daily pause, navigation and photos (historical)

| User request | Implementation | Evidence boundary |
|---|---|---|
| Reduce clutter | Today has one daily pause; Explore owns practices, toolkit and guidance; five clearly labeled tabs | Current checks in VERIFICATION.md; native large-text/keyboard review pending |
| Personalized daily routine | Curated local suggestions, explicit reasons, optional approved historical preferences, progress from actual saved records | Pure selector regressions; no AI or treatment claim |
| iOS Liquid Glass navigation | Expo native GlassView after both capability checks; native blur and Reduce Transparency fallback; app theme respected | Type/bundle checks only for native material; iOS device verification required |
| Android navigation | Floating opaque tonal rail, accessible selected labels, native ripple, safe-area and keyboard clearance | Android bundle check; installed-device gesture/keyboard checks pending |
| More life and color | Black/graphite base and champagne actions; restrained lilac/peach/sage accents; light blush/forest identity retained | Token contrast and actual browser evidence in VERIFICATION.md; native appearance pending |
| Profile photo | System picker, bounded client processing, server JPEG validation/re-encoding/metadata removal, private storage/export/removal | Server image/privacy/race regressions; native picker still pending |
| Offline writing protection | Native account vault for drafts and bounded check-in/reflection retry queue; honest unsynced states and retry/discard | Vault and provider harness tests; native secure-storage lifecycle pending; web is memory-only |

Production submission remains gated on real provider configuration, public HTTPS, a rebuilt installable APK, physical-device reminder tests and final demo. UI completion does not satisfy those external gates.

## Earlier botanical home and matched dark mode (historical)

This section records the preceding visual pass. The current matrix above supersedes its five-tab description; the original accounts, data/privacy controls and wellness capabilities remain.

| User request / capability | Current implementation | Evidence boundary |
|---|---|---|
| A more inviting home | Compact greeting, one cohesive mood tray, illustrated daily-pause hero, quiet conversation continuation and daily affirmation footer | Source implemented; current browser checks/screenshots recorded in VERIFICATION.md |
| Improve Your daily pause | One next-step CTA with correct routine route/parameters; quiet factual three-step path; explicit accessible progress value | Existing routine/provider regressions remain green; native assistive-technology behavior pending |
| Keep completed days welcoming | Completed pause retains progress and offers optional three-minute breathing | Source route uses durationSec:180; browser result recorded separately |
| Understand recommendations | Practice-stage Why this pause? expands the curated reason; historical context remains consent-gated | Selector regressions; no live AI or diagnosis claim |
| A changing daily detail | Stable-for-the-day existing affirmation appears on Today and opens its actual save flow | Existing daily-content logic and API-backed flow; no auto-save or generated-AI claim |
| Match light and dark visual quality | Original moment-light.png paired with new daily-pause-dark-v2.png; black/graphite and champagne dark tokens; loved warm/forest light identity retained | Built-in ImageGen provenance in assets/DAILY_PAUSE_ARTWORK.md; native visual projection pending |
| Maintain hero readability | Shared PauseArtwork and React Native 0.88 backgroundImage scrim; all text/controls in code; decorative imagery/icons excluded from assistive content | Type/build checks and current browser evidence; OS rendering/accessibility still requires device checks |
| Keep Explore clear | Illustrated breathing feature and quieter practice/tool rows; full toolkit/resources/plans/challenges/affirmations retained | Source implemented; current browser checks in VERIFICATION.md |
| Light secondary-text contrast | Muted text #626B5D; measured 4.54:1 on the raised light surface | Token measurement, not full-screen accessibility certification |

The 88-test automated suite, client/server type checks and server build passed for this pass. Exact final export/browser results belong in VERIFICATION.md. No native material, notification delivery, device performance, live-provider behavior or external release readiness is inferred from these checks.

Submission still requires live AI configuration/evaluation, public HTTPS hosting, a rebuilt installable APK tested on a physical device, verified native reminders and the final demo. Existing toolchain advisories and native navigation limitations remain recorded in VERIFICATION.md.

## Authentication repair checkpoint (5 November, historical)

At this checkpoint navigation was deliberately unchanged while authentication was repaired. The later explicit instruction to implement features with setup deferred supersedes that sequencing constraint. Current navigation is Today, Solace, Journey, Profile; Moments is a detail destination. The Mac/provider checks below remain unverified.

| Requirement | Repair implementation | Verification boundary |
|---|---|---|
| Missing server tsx | Explicit dual-lockfile setup includes dev/optional dependencies; startup detects missing tools with recovery guidance | Tooling fixture and actual local startup checks in VERIFICATION.md |
| Supported runtime | Validated runtime selection and project Node 24 baseline; Node 26 remains accepted where supported | Actual local runtime recorded; no assumed Mac execution |
| Correct client API | Central validated public URL, platform development defaults, actionable dev diagnostics and HTTPS release guard | Pure config and real AppProvider regressions; simulator networking deferred |
| Startup and persistence | Server-root private env/DB paths, ready signaling after API initialization, clear startup errors | Real child-process auth/history/restart tests; installed-client restart remains separate |
| Real AI | Existing adapter retained; missing required key fails clearly in live mode | No configured key here; actual provider request deferred |
| Advanced feature sequencing at that checkpoint | Companion, generated Moments, voice/environments/insights/achievements were tracked as planned | They are now implemented as described in the current matrix; live/device checks remain separate |

See [local repair commands](LOCAL_DEVELOPMENT.md), [milestones](IMPLEMENTATION_PLAN.md) and [executed verification](VERIFICATION.md).


Foundation repair checkpoint: clean dual-lockfile setup, doctor, client/server types, server build, 125 regressions and web/Android/iOS JavaScript exports passed. Actual browser signup, invalid/correct login, logout, session restoration and saved conversation continuation across a full API/Expo restart passed. These do not verify the deferred Mac simulator, real provider or native release gates. Full evidence is in the latest VERIFICATION.md section.
