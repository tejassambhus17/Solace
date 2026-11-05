# Requirements and coverage

Source: root 11-page PDF; reviewed guide narration and visible reference. "Implemented" means code exists, not necessarily externally/device verified. See VERIFICATION.md for actual evidence.

| Source | Capability | Implementation | Verification boundary |
|---|---|---|---|
| PDF2–3 | Splash, onboarding, signup/login | Core welcome, branded loading, forms, account API | Browser signup; native launch pending |
| PDF3–4 | Personal home and simple navigation | Today + four tabs | Browser navigation |
| PDF4–5 | Real contextual AI | Server Responses adapter, current chat context | Provider adapter stub tested; real key intentionally absent |
| PDF5–6 | Retained history, new, continue, delete | Conversation API + history UI | Backend integration; browser continuity |
| PDF5–6 | Consented personalized context | Approved memory UI, optional global consent, check-in context | Backend consent/source-deletion tests |
| PDF5 | AI actions connect to activities | Action card → activity → feedback → conversation | Browser journey test |
| PDF6–7 | Reminder preferences, timing, background, taps | Native local scheduling + server preferences | Browser preferences only; native delivery pending |
| PDF7–9 | Required stack and backend/database | React Native + Expo, Node + SQLite | TypeScript, web/Android bundling, API tests |
| PDF8 | Consistent visuals, transitions, feedback | Both themes, fonts, raster art, text states, breathing motion | Browser visual review; full native/a11y pending |
| PDF3,7; video05:09 | Mood, affirmations, recommendations | Check-in, daily affirmation, suggestions | API-backed saves |
| Video05:41–05:59 | Mood/anxiety/self-love assessments | Three four-question reflective flows + saved results | Pure logic tests; browser assessment |
| Video06:03–06:06 | Guided breathing | 1–3min timer, named phases, pause/end, optional feedback | Browser timer; interruption code reviewed |
| PDF5,7 | Reflection and self-care | Saved journal and guides | API validation + browser |
| Video06:08–06:42 | Mindfulness, anxiety, low mood, self-esteem, sleep | Five guides, interactive checklist, completion | Browser guide |
| Video06:15–06:30 | Nearby therapists/human help | External professional directory, country support directory | External URLs checked; no geolocation/booking claimed |
| PDF5,7 | Plans and daily challenges | Editable 3-step plan and completion tracking | API-backed saves |
| PDF3,7; video05:09 | Progress, streak, XP/level, milestones | Date-aware participation calculations and first/three-day check-in milestones | 7 pure regression tests |
| User | Profile fourth tab, light/dark/system | Four tabs and local theme persistence | Browser both themes |
| Product trust | Data export, memory removal, delete account | Profile + ownership scoped API | Backend integration tests |
| PDF9–10 | APK, demo, later TestFlight | EAS APK profile, local Android build, release and demo checklist | Compilation-check APK produced; functional phone build, demo and TestFlight pending |

## Ambiguities and additional boundaries
- PDF9's "follow, post, message" is undefined elsewhere. Social feed/follow was not inferred from this apparent leftover wording; ask organizers.
- The PDF explicitly says existing wellness examples need not all be copied. The user asked for them, so this implementation includes the discussed categories.
- "Self-love meter" is delivered as a non-diagnostic self-compassion reflection. XP measures participation, not emotional worth.
- A custom animated mascot, voice, widgets and dynamic ambient worlds were earlier proposals, not PDF requirements. The approved petal has purposeful breathing animation.
- Images are visual references with illustrative counts. The implementation calculates counts from actual account records.
- AI key, public hosting, final native build and device testing remain required for full hackathon delivery.

## 5 November refinement review

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

## Follow-up: black theme and useful continuity

Latest user direction: true black dark mode replaces the previous green direction. Light mode and the four-tab structure remain supported.

| Addition or fix | Implementation | Evidence boundary |
|---|---|---|
| Neutral black theme | #000000 canvas, charcoal layers, warm ivory controls; no green-backed featured artwork | Browser color inspection and phone/wide screenshots; native appearance pending |
| Search and name conversations | Search retained titles/message text; inline title editing through authenticated records API | Browser search/rename/reopen; concurrent rename/provider regression |
| Continue a recent conversation | Today resume entry uses account-owned latest activity | Browser navigation; no fabricated history |
| Protect unsaved writing | In-memory check-in, journal and feedback drafts; journal keep/discard; guards for saving fields | Browser navigation checks plus provider-state regressions; drafts do not survive app restart |
| Recover expired sessions | Invalid-token handling, reauthentication, same-account route/draft retention, different-account clearing | Provider-state regression harness; browser expiry flow where recorded |
| Prevent stale work | Serialize credential writes; ignore old-generation callbacks/snapshots; cancel late reminder IDs and navigation | Provider-state and mocked native coordination regressions; actual OS delivery remains pending |
| Match explicit reflection intent | Built-in starter reflection prompts suggest journaling, with urgent-support priority | Server regressions; built-in guidance remains explicitly distinct from live AI |

## Dark-artwork and useful-routine pass

| Addition | Implementation | Executed evidence / boundary |
|---|---|---|
| Generated dark artwork | Transparent petal, stillness and moonlit raster assets in black/charcoal palette; light-mode separation | Phone/wide browser review; native appearance pending |
| Personal saved toolkit | Persistent, owner-scoped favorites for guides and activities; save/remove/reopen | Browser save/reload/open/remove; duplicate/isolation/persistence/export/deletion server tests |
| Guided grounding | Optional five-senses sequence, skip/previous/exit, active-only duration, existing feedback and source-aware optional memory | Browser completed-with-skip and skip-all runs; native Back/interruption checks pending |
| Weekly review | Factual local-day summary, self-reported supportive activity count, optional journal prompt | 9 pure regressions and actual saved Journey browser facts; no diagnostic claims |
| Rendering efficiency | Cached search selectors, initial 30-row history with show-more, lower-frequency timer displays, near-bottom chat scrolling | Type/bundle checks; device performance profiling and full-snapshot scaling remain pending |

The grounding sequence follows the five-senses structure described by [Hull University Teaching Hospitals NHS Trust](https://www.hey.nhs.uk/wp/wp-content/uploads/2023/02/HEY1318-2022-5-4-3-2-1-Grounding-Technique.pdf), with original app wording and optional alternatives/skips. It is a self-care option, not a treatment claim.
