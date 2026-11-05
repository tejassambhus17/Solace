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
