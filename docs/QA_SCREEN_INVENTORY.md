# Solace QA screen inventory

The navigation source is [App.tsx](../App.tsx), [routes.ts](../src/routes.ts), and the per-tab stack in [store.tsx](../src/store.tsx). The submission sweep traced 62 registered route IDs, including the legacy `moment` alias, the current wellness-goal editor, and What helped me. A nested route stays under the tab that opened it unless the interaction explicitly switches tabs. The table records one representative entry when several exist. Authentication, locks, sheets, and inline states have no route ID. The [final submission report](SOLACE_FINAL_SUBMISSION_QA.md) separates current runtime results from older observations in this inventory.

**Evidence key.** Browser means rendered in this pass. Automated means the current suites exercise the route, data contract, or lifecycle. Source means traced in the current code. See the [test matrix](SOLACE_QA_TEST_MATRIX.md) for evidence and limits. Native rendering remains a separate gate.

| Screen | Parent / entry point | Route or state | Purpose / dependency | Visual and verification status |
| --- | --- | --- | --- | --- |
| Startup, offline recovery, retry | Cold launch with stored session | Session shell | SecureStore, session validation, retry or sign out | Source and session-state tests. Native interrupted startup open. |
| Welcome and walkthrough | First launch or About | Walkthrough, `onboarding-replay` | Local completion preference | Source. Replay reachable. Fresh installed app open. |
| Login | After walkthrough or sign-out | Auth login | Auth login, Google OAuth | Browser form and Azure API login. Native OAuth open. |
| Signup | Login switch | Auth signup | Registration, secure session | Azure API disposable account. Native form open. |
| Password recovery and reset | Login or reset link | Auth recovery/reset | Password request/reset, mailer and signed link | Automated lifecycle. Live delivery open. |
| Personalized onboarding and welcome | New account after authentication | Goal selection and welcome states | Multi-select wellness goals, persist once and show a first practice option | Current browser demo saved two choices and continued to Today. Device account permutations open. |
| Wellness-goal editor | Profile, Your Wellness Goals | `wellness-goals` | Read and edit goals for the signed-in account | Current Profile browser destination and server validation. Physical edit open. |
| App and Journal privacy gates | Launch/resume or entering Journal | Covers and unlock screens | Device authentication, secure local policy | Automated fallback and lifecycle. Face ID and Android biometrics open. |
| Today | Today tab | `today` | Greeting, mood, daily pause, moment, habits, shortcuts, account state | Browser, both themes. Native bottom edge open. |
| Daily Pause options and explanation | Today Daily Pause | Inline and sheet | Practice preferences, skip and recommendation rationale | Automated routine and source. Full sheet interactions open. |
| Mood check-in and next step | Today moods or Wellness Tools | `checkin`, saved inline recommendation and review | Save mood, note and tags, offer real practice or review a draft for Companion | Current browser demo and Android QA. All mood and network permutations open. |
| Solace Moments | Today, Companion menu, Wellness Tools | `moments` | Configure, preview, AI generation or built-in practice | Browser builder and automated API. Provider-generated browser completion open. |
| Moment player, completion and recheck | Moment preview, techniques, timed builder, guided plan, authorized Companion action | `moment-player` and completion states | Timer, player type, environment, completed session and optional emotional recheck | Current browser demo saved one real session and recheck. Native audio route open. |
| Classic breathing | Today Breathe, Explore Breath Reset | `breathing`, legacy `moment` alias | Timer, pause, completion and sessions | Canonical route has current automated coverage. Alias has no independent first-party entry found. |
| Breathing feedback | Classic breathing completion | `feedback` | Record optional feedback on saved session | Source and progress tests. Full browser flow open. |
| Grounding and feedback | Wellness Tools Five-Senses Exercise | `grounding` | Guided steps, optional session record | Browser and backend. Native audio/keyboard open. |
| Habit dashboard | Today habits or Explore Healthy Habit Builder | `habits` | Daily progress, plan and garden, habits API | Browser dashboard. Native layout open. |
| Habit editor | Dashboard Create, starter, detail edit | `habit-create`, `habit-edit` | Goal, schedule and reminder | Browser create and backend edit. See matrix for schedule editing. |
| Habit library | Dashboard library | `habit-library` | Find starters or existing habits | Source and habit navigation coverage. |
| Habit details | Dashboard row or notification | `habit-details` | Log progress, edit, pause/archive/delete | Browser logging/undo and backend. Notification tap open. |
| Habit insights | Dashboard or Journey Habit Progress | `habit-insights` | Weekly/monthly habits and streaks | Progress tests. Native layout open. |
| Garden, intention picker and growth detail | Dashboard Open Garden | `habit-garden`, inline intention and contributor views | Real earned stage, weekly intention, and activity history | Current browser demo credited one real completed session. Native device changes to intention open. |
| Habit reminders | Habit detail or Profile reminders | `habit-reminders`, with or without ID | List and edit device schedules | Automated schedule model. Native delivery open. |
| Solace landing | Solace tab | `solace` | Choose Companion or Journal | Browser and retained-mode navigation tests. |
| Companion | Solace landing | `chat` | Text, recommendation, floating composer, dictation and menu | Browser composer in both themes. Azure live text via API. |
| Conversation history | Companion menu | `history` | Search, rename, reopen, delete | Browser and backend. See matrix. |
| Live Voice and options | Companion Live Voice control | `voice-talk` | WebRTC, controls, safe fallback, saved transcript | Live Azure synthetic turn and local browser fixture. Native audio routing open. |
| Companion habit assistant | Companion menu Plan a habit | Sheet | Review a draft from habits suggestion API | Source and backend. Full sheet flow open. |
| Journal library | Solace landing | `journal` | Search, filter, browse private writing | Browser reopened a saved entry after reload. Search and filter variants not all exercised. |
| Journal entry | Journal list or saved Journey item | `journal-entry` | Read, delete or open editor | Browser read and deleted disposable writing. Backend isolation passed. |
| Journal editor | Journal new/edit or Gratitude Journal | `journal-editor` | Draft, save, offline recovery | Browser created and edited multiline Unicode writing. Automated persistence and navigation guards. Native interrupted editing open. |
| Journal AI reflection | Journal entry optional AI | `journal-reflect` | Explicit disclosure, generate/discuss and save | Automated consent and owner scope. Live journal content deliberately excluded. |
| Explore | Explore tab | `explore` | Featured content, illustrated filters, search, saved entry point | Browser both themes and all-category automated navigation. |
| Wellness Tools | Bottom of Explore | `wellness-tools` | Grouped tools and filter chips | Browser both themes. Catalog route retired and no live call site found. |
| Timed Practice | Bottom of Explore | `timed-practice` | Four focuses and four durations | Browser preview and 16 tested configurations. Native timing/audio open. |
| Techniques | Explore Guided Techniques | `techniques` | Browse and filter technique families | Browser both themes. |
| Technique detail | Technique card or authorized link | `technique-detail` | Read guidance and open canonical player | Browser and validated backend snapshots. |
| Personalized Wellness Plan | Explore plan banner | `plan` | Preview, edit, start and track personal plan | Browser and backend previews and persistence. |
| Guided Programs | Explore More or Today | `guided-programs` | Browse curated multi-day programs | Browser confirmed distinct destination. Backend catalog tests. |
| Guided Program detail | Program card | `guided-program` | Preview, enroll, resume and track | Browser and backend enrollment/idempotency. |
| Ambient Sound Mixer | Wellness Tools | `ambient-mixer` | Play layers and manage presets | Browser interface and preference writes. Physical audio/background open. |
| Reflective Check-ins | Explore More or Wellness Tools | `assessments` | Choose reflective questionnaire | Browser and navigation tests. |
| Questionnaire | Check-ins list | `assessment` | Answer and save a valid assessment | Browser and backend. |
| Questionnaire result | Submission or saved result | `assessment-result` | Read summary and open next step | Browser and navigation tests. |
| Guides & Resources | Wellness Tools or check-in follow-up | `resources` | Discover five resource categories | Browser guide navigation and source. |
| Guide detail | Resource card | `resource` | Read steps and save to toolkit | Browser save/reopen. |
| Sleep Wind-Down Guide | Wellness Tools | `sleep` | Open canonical sleep guide | Registry/navigation and source. |
| Saved Wellness Toolkit | Explore header or Explore More | `toolkit` | Open/remove saved items | Browser and backend. |
| Daily Affirmation | Wellness Tools | `affirmation` | Read/save affirmation | Browser and backend. |
| Daily Challenge | Wellness Tools | `challenge` | Complete and undo today's activity | Browser and backend. |
| Journey overview | Journey tab | `journey` | Period summaries, latest activity, story and habits | Browser both themes, period/date tests. |
| Activity history | Journey View history | `journey-activity` | Filter records and open details | Browser and progress tests. |
| Saved check-in | Journey activity history | `journey-checkin` | Read owned check-in | Automated route and data handling. |
| Session detail | Journey activity or latest activity | `session-detail` | Read owned session and feedback | Automated owner scope and source. |
| What helped me | Journey What helped me | `practice-insights` | Own session list, rechecks, supporting mood and practice replay | Current browser demo verified sparse state and saved session. Both themes verified self-paced replay. |
| Reflection editor and Weekly Story | Today Reflect, Companion menu or Journey | `reflection` | Write/save, optional needs, weekly prompt and offline draft | Browser draft/reopen/save in both themes. |
| Reflections library | Journey Saved story | `reflections` | Reopen owned reflections or Journal entries | Route and backend tests. |
| Reflection detail | Reflections list or history | `reflection-detail` | Read, edit or delete | Backend and source. |
| Saved affirmations | Journey or Daily Affirmation | `saved-affirmations` | List and remove saved quotations | Browser and source. |
| Personal goal | Journey Your goal | `journey-goal` | Add/edit/pause/delete goals and read progress | Browser and goal progress tests. |
| Milestones | Journey Little milestones | `journey-milestones`, with or without ID | Earned/locked states, detail and streak preference | Browser and progress tests. |
| Milestone celebration | Newly earned milestone | Global modal | Show real award once, honor motion setting | Source. Screen reader announcement open. |
| Profile | Profile tab | `profile` | Settings, account, reminders and privacy | Browser and route tests. |
| Appearance & Preferences | Profile | `settings` | Light/dark/system, sound, haptics, consent and device lock | Browser preference and reload, automated lock policy. Native prompts open. |
| Edit Profile, Account, Privacy & Data | Profile links | `account`, including privacy section | Name, avatar, Google link, export, sign-out/delete | Browser preference/forms and automated auth. Native photo and Google open. |
| Gentle Reminders | Profile or Today bell | `reminders` | Create/change/delete reminders and manage permission | Browser and scheduler tests. Physical delivery open. |
| Approved AI memories | Profile | `memory` | Review, edit, delete and revoke consent | Browser and backend tests. |
| Find Human Support | Profile or Companion | `support` | Safety guidance and directory links | Browser and automated safety contracts. External destinations outside local coverage. |
| About Solace | Profile | `about` | About, disclosures and walkthrough replay | Source and Profile navigation tests. |
| Confirmation, feedback and network states | Destructive controls, editor guard, audio options, invalid deep links | Modal, sheet, alert, inline | Confirmation, recovery and OS permissions | Representative browser/automated coverage. Full focus and assistive technology open. |

## Integrations and route hygiene

- The API mounts authentication and recovery, Google, account, state/export, generic records, habits, plan preview, Moment generation, weekly insight, journal reflection/discussion, chat, and Realtime/transcription/speech endpoints. The app uses bearer authentication. Cross-account checks exercise owner scoping on the API. SQLite persists server records. Native session secrets use SecureStore, and encrypted device storage protects eligible drafts. Browser sessions use session storage. Browse-only data and device preferences have distinct lifecycles.
- Reminder taps enter Today or the Habit Details path. Supported external link patterns are in [the experience link handler](../src/experience-links.ts), [the widget link handler](../src/widget-links.ts), and [App.tsx](../App.tsx). OS permissions and iOS/Android back behavior require device-specific verification.
- The old Explore catalog no longer has a registered route or entry. The older `moment` alias still shares classic breathing. No removal was made during this audit because code search cannot exclude older links or integrations. A source fallback to Today is not counted as a reachable destination.
