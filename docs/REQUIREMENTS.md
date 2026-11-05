# Requirements and coverage

Source: root 11-page PDF; reviewed guide narration and visible reference. "Implemented" means code exists, not necessarily externally/device verified. See VERIFICATION.md for actual evidence.

| Source | Capability | Implementation | Verification boundary |
|---|---|---|---|
| PDF2–3 | Splash, onboarding, signup/login | Core welcome, branded loading, forms, account API | Browser signup; native launch pending |
| PDF3–4 | Personal home and simple navigation | Illustrated Today/daily pause + five focused tabs (latest user override) | Current browser evidence in VERIFICATION.md; native appearance pending |
| PDF4–5 | Real contextual AI | Server Responses adapter, current chat context | Provider adapter stub tested; real key intentionally absent |
| PDF5–6 | Retained history, new, continue, delete | Conversation API + history UI | Backend integration; browser continuity |
| PDF5–6 | Consented personalized context | Approved memory UI, optional global consent, check-in context | Backend consent/source-deletion tests |
| PDF5 | AI actions connect to activities | Action card → activity → feedback → conversation | Browser journey test |
| PDF6–7 | Reminder preferences, timing, background, taps | Native local scheduling + server preferences | Browser preferences only; native delivery pending |
| PDF7–9 | Required stack and backend/database | React Native + Expo, Node + SQLite | TypeScript, web/Android bundling, API tests |
| PDF8 | Consistent visuals, transitions, feedback | Both themes, fonts, raster art, text states, breathing motion | Browser visual review; full native/a11y pending |
| PDF3,7; video05:09 | Mood, affirmations, recommendations | Cohesive mood tray, stable daily affirmation entry, curated daily pause | API-backed saves and selector tests; latest browser evidence in VERIFICATION.md |
| Video05:41–05:59 | Mood/anxiety/self-love assessments | Three four-question reflective flows + saved results | Pure logic tests; browser assessment |
| Video06:03–06:06 | Guided breathing | 1–3min timer, named phases, pause/end, optional feedback | Browser timer; interruption code reviewed |
| PDF5,7 | Reflection and self-care | Saved journal and guides | API validation + browser |
| Video06:08–06:42 | Mindfulness, anxiety, low mood, self-esteem, sleep | Five guides, interactive checklist, completion | Browser guide |
| Video06:15–06:30 | Nearby therapists/human help | External professional directory, country support directory | External URLs checked; no geolocation/booking claimed |
| PDF5,7 | Plans and daily challenges | Editable 3-step plan and completion tracking | API-backed saves |
| PDF3,7; video05:09 | Progress, streak, XP/level, milestones | Date-aware participation calculations and first/three-day check-in milestones | 7 pure regression tests |
| User, latest override | Simple navigation; optional new tab; light/dark/system | Today, Solace, Explore, Journey, Profile; theme persistence | Browser checks recorded in VERIFICATION; native checks pending |
| Product trust | Data export, memory removal, delete account | Profile + ownership scoped API | Backend integration tests |
| PDF9–10 | APK, demo, later TestFlight | EAS APK profile, local Android build, release and demo checklist | Compilation-check APK produced; functional phone build, demo and TestFlight pending |

## Ambiguities and additional boundaries
- PDF9's "follow, post, message" is undefined elsewhere. Social feed/follow was not inferred from this apparent leftover wording; ask organizers.
- The PDF explicitly says existing wellness examples need not all be copied. The user asked for them, so this implementation includes the discussed categories.
- "Self-love meter" is delivered as a non-diagnostic self-compassion reflection. XP measures participation, not emotional worth.
- A custom animated mascot, voice, widgets and dynamic ambient worlds were earlier proposals, not PDF requirements. The approved petal has purposeful breathing animation.
- Images are visual references with illustrative counts. The implementation calculates counts from actual account records.
- AI key, public hosting, final native build and device testing remain required for full hackathon delivery.

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

## Daily pause, simpler navigation and private photos

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

## Current botanical home and matched dark-mode redesign

This section and DESIGN.md supersede earlier visual descriptions above. The existing accounts, data/privacy controls, five-tab order and wellness capabilities are retained.

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

## Master brief: foundation repair and deferred native checks

The master brief requests Today, Solace, Moments, Journey, while the later workspace instructions preserve Today, Solace, Journey, Profile. Resolve that difference before a future navigation change. The current five-tab interface remains untouched during authentication repair. The user explicitly deferred Mac simulator access and prioritized authentication before real-provider configuration.

| Requirement | Repair implementation | Verification boundary |
|---|---|---|
| Missing server tsx | Explicit dual-lockfile setup includes dev/optional dependencies; startup detects missing tools with recovery guidance | Tooling fixture and actual local startup checks in VERIFICATION.md |
| Supported runtime | Validated runtime selection and project Node 24 baseline; Node 26 remains accepted where supported | Actual local runtime recorded; no assumed Mac execution |
| Correct client API | Central validated public URL, platform development defaults, actionable dev diagnostics and HTTPS release guard | Pure config and real AppProvider regressions; simulator networking deferred |
| Startup and persistence | Server-root private env/DB paths, ready signaling after API initialization, clear startup errors | Real child-process auth/history/restart tests; installed-client restart remains separate |
| Real AI | Existing adapter retained; missing required key fails clearly in live mode | No configured key here; actual provider request deferred |
| Advanced feature sequencing | Companion, generated Moments, voice/environments/insights/achievements tracked in implementation plan | Planned; no rendering-only or stub success claims |

See [local repair commands](LOCAL_DEVELOPMENT.md), [milestones](IMPLEMENTATION_PLAN.md) and [executed verification](VERIFICATION.md).


Foundation repair checkpoint: clean dual-lockfile setup, doctor, client/server types, server build, 125 regressions and web/Android/iOS JavaScript exports passed. Actual browser signup, invalid/correct login, logout, session restoration and saved conversation continuation across a full API/Expo restart passed. These do not verify the deferred Mac simulator, real provider or native release gates. Full evidence is in the latest VERIFICATION.md section.
