# Solace nested screen design audit

The five reference tabs are Today, Solace, Explore, Journey, and Profile. The visual baseline uses the approved light and dark references and the existing route switch in `App.tsx`, including retained Solace modes, `WellnessScreen` aliases, parameterized records, and buttons that open a route under a different tab. The parent in the table describes a real entry point. A shared screen can have several.

**Ratings.** A matches the approved design. B needs minor polish. C needs substantial UI work. D has a demonstrated broken or incomplete experience. **Priority.** P1 blocks reading or finishing a primary task. P2 covers inconsistent hierarchy, spacing, or control presentation. P3 is an evidence or device follow-up. “Both” means the source uses the light and dark theme tokens. Rendered evidence is tracked separately.

## Reference and shared patterns

| Pattern | Existing visual authority | Nested application |
| --- | --- | --- |
| Type | Cormorant Garamond semibold for editorial titles and Inter for body and controls | Use the existing `AppText` variants. Use the heading scale for section labels and keep long titles wrappable. |
| Colors | `src/theme.tsx` cream and forest, graphite and ivory, and `ExperienceTheme` midnight/plum | Use semantic surface, border, and muted tokens. Use sage for progress, lavender for selection, and peach for warm accents. |
| Geometry | `src/layout.ts` gives 8/12/16/24 dp rhythm and the adaptive 16/24 dp gutters | Use a 48 dp back target, 24 dp card radius, measured tab clearance, and natural height for text and fields. |
| Artwork and motion | Approved scenic heroes, botanical illustrations, lotus, and motion preference | Keep their existing routes and scene-specific layouts. Keep decoration out of hit testing. |

## Initial route inventory

| Entry point and screen | Route | Rating | Existing function | Visual or responsive finding | Themes | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Today · Mood check-in and next steps | `checkin` | C | Select a mood, save note and tags, review next steps or prepare a Companion draft | Older title/field vocabulary and five fixed-width choices under large text | Both | P1 |
| Today · Daily Pause options and explanation | Today disclosure and recommendation modal | A | Configure activity, duration, skip and review why a practice was selected | Existing purpose-built presentation in the approved root | Both | P3 |
| Today/Solace · Moments composer and preview | `moments` | B | Request and preview a local or generated practice, choose an environment, start | Duplicate arrival heading and large gaps on the compact form | Both | P2 |
| Today/Explore/Solace · Moment player and completion | `moment-player` | A | Timer/steps, environment, audio, completion and optional feedback | Preserve the immersive designs and the recently verified breathing-player sheet | Both | P3 |
| Today/Explore · Classic breathing and feedback | `breathing`, `moment` alias, `feedback` | B | Follow timed breathing, pause or complete, record optional feedback | Legacy page header and compact feedback options under larger text | Both | P2 |
| Today/Explore · Grounding | `grounding` | B | Follow the five-senses prompts, skip, and optionally save | Legacy header and action spacing | Both | P2 |
| Today/Explore/Journey · Habit dashboard | `habits` | B | Today's progress, flexible goals, habit rows, schedule, library and garden | Generic shell repeats the dashboard headline | Both | P2 |
| Habits · Create or edit | `habit-create`, `habit-edit` | B | Save a validated habit with schedule, target and reminder | Step hierarchy and wrapping form choices need the same rhythm as the dashboard | Both | P2 |
| Habits · Habit library and details | `habit-library`, `habit-details` | B | Browse starters and filter habits, log progress, pause/archive/delete | Legacy generic shell around otherwise purpose-specific list and goal blocks | Both | P2 |
| Habits · Insights and garden | `habit-insights`, `habit-garden` | B | Weekly/monthly summaries and earned garden stage | Align headers and hierarchy while retaining art and actual records | Both | P2 |
| Profile/Habits · Habit reminder list and edit | `habit-reminders` with and without ID | B | Inspect and update reminders on actual habits | Similar wording across list/editor, subdued legacy shell | Both | P2 |
| Solace · Companion and action sheet | `chat` | A | Conversation, contextual actions, streaming status, voice, floating composer | Approved companion art and composer are protected | Both | P3 |
| Solace · Conversation history | `history` | B | Search, reopen, rename and delete conversations | List, empty and edit hierarchy differ from the approved Companion | Both | P2 |
| Solace · Voice Talk and transcript review | `voice-talk` | B | Record, review, send and play a turn | Preserve the companion stage and prioritize controls when text grows | Both | P2 |
| Solace · Journal library, editor and details | `journal`, `journal-editor`, `journal-entry` | B | Search, filter, write, save, read and delete | Keep the editor spacious and bring detail/back states into alignment | Both | P2 |
| Solace · Journal AI reflection and disclosure | `journal-reflect` | B | Optional private sharing, generate, save and link to Companion | Long consent and action states need readable grouping | Both | P2 |
| Solace · Habit suggestion | Companion sheet | B | Review suggested habit and open the existing editor | Large text and safe-area limits on a modal | Both | P2 |
| Explore · Full catalog, search and category filters | `explore-catalog`, root search controls | A | Browse real activities and saved content | Keep the approved Explore visual vocabulary | Both | P3 |
| Explore · Wellness Tools | `wellness-tools` | A | Filter categorized tools and open ten existing destinations | Recently approved illustrated library | Both | P3 |
| Explore · Timed Practice | `timed-practice` | A | Configure focus/duration and preview real steps | Recently approved adaptive builder | Both | P3 |
| Explore · Techniques and detail | `techniques`, `technique-detail` | A | Browse technique families and start working practices | Existing scenic layouts and responsive grids | Both | P3 |
| Explore/Today · Wellness Plan, guided programs and details | `plan`, `guided-programs`, `guided-program` | A | Configure a three-day plan, browse or enroll in a program, track activities | Recently approved illustrated flows. Existing narrow and larger layout evidence. | Both | P3 |
| Explore · Ambient Sound Mixer | `ambient-mixer` | B | Play layers, adjust volumes and manage presets | Slider panel hierarchy and crowded adjacent actions | Both | P2 |
| Explore/Journey · Reflective check-ins | `assessments`, `assessment`, `assessment-result` | C/D | Choose an assessment, answer, save and read the result | Legacy form hierarchy. Explore's labeled card opened the separate daily mood form, and the result's calming-habit action opened a plan. Missing or unknown assessment IDs silently selected another assessment. | Both | P1 |
| Explore · Guide library, guide and sleep shortcut | `resources`, `resource`, `sleep` alias | B/D | Browse guides, track steps and save to the toolkit | Legacy navigation and dense controls. A missing guide could open an unrelated default. | Both | P2 |
| Explore/Today · Toolkit | `toolkit` | B | Open and remove saved practices | Saved rows and empty state need consistent grouping | Both | P2 |
| Explore · Affirmation, challenge and saved affirmations | `affirmation`, `challenge`, `saved-affirmations` | B | Save an affirmation, complete or undo today's challenge | Preserve editorial quote while aligning controls and list rows | Both | P2 |
| Journey · History and filtered period/day views | `journey-activity` | C | Browse real history, filter by day or event type, open details | Plain divider list, cramped long titles, unframed empty state | Both | P2 |
| Journey · Mood check-in detail | `journey-checkin` | B | View the actual saved mood, note and tags | Plain unavailable text and legacy header | Both | P2 |
| Journey · Activity detail | `session-detail` | B | View saved session, active time and feedback | Legacy header around a data-led detail | Both | P2 |
| Journey · Weekly reflection and saved reflections | `reflection`, `reflections`, `reflection-detail` | B | Save or edit weekly/manual writing, reopen or delete existing records | Legacy shell and repeated arrival hierarchy | Both | P2 |
| Journey · Personal goal | `journey-goal` | B | Set, edit, pause or delete goal; read real progress | Form, progress, and archive actions need clearer grouping | Both | P2 |
| Journey · Milestones list and detail | `journey-milestones` with and without ID | B | Browse earned/locked records and optional streaks | Repeated title and ungrouped settings and award rows | Both | P2 |
| Journey · New milestone celebration | Global modal | A | Announce a newly earned milestone once | Existing reduced-motion-aware illustration | Both | P3 |
| Profile · Appearance & Preferences | `settings` | C | Choose appearance, sound, haptics and approved preferences; manage device locks | Flat old controls and insufficient grouping | Both | P1 |
| Profile · Edit Profile, Account and Privacy & Data | `account` and `section: privacy` | B | Update name/photo, link identity, export, sign out or request deletion | Dense independent form, account, and destructive sections | Both | P2 |
| Profile/Today · Gentle Reminders | `reminders` | B | Manage permission, time, repeat, edit and delete | Long inline editing needs consistent sections and wrap | Both | P2 |
| Profile · Approved AI memories | `memory` | B/D | Inspect, correct, remove, clear and disable personalization | The editor could appear below the entire list with no scroll to reveal it. Sources and sensitive actions also need clearer grouping. | Both | P1 |
| Profile/Solace · Human Support | `support` | B | Open external directories, read immediate safety information | Priority safety copy and directory rows need clearer grouping | Both | P2 |
| Profile · About and replay walkthrough | `about`, `onboarding-replay` | B/A | Read app and privacy details; replay walkthrough | About benefits from aligned controls; preserve cinematic walkthrough | Both | P2 |
| Profile · App and Journal biometric fallback | Access-gated screen and privacy cover | A | Unlock, recover or reauthenticate | Preserve approved privacy-safe state and native prompts | Both | P3 |
| Before tabs · Walkthrough, sign-in, sign-up, recovery and personalization | Auth/onboarding state, no tab route | A | Existing session, password, Google and optional onboarding paths | Reference flows outside the nested design change | Both | P3 |
| Global · Record deletion, unsaved navigation, network recovery and OS permissions | Local modal, inline confirmation, system dialog or session state | B | Confirm/cancel destructive actions, recover session, grant native permissions | App-owned treatment varies; system chrome is platform controlled | Both | P2 |

Route aliases, layout states, and system overlays are shown explicitly where they change the workflow. The final checklist records the evidence for each group.

The audit accounts for 56 named nested route IDs across 43 workflow groups, including route aliases and related state variants. The five approved main tabs were separately used as visual and navigation references. [Implementation and QA checklist](SOLACE_DESIGN_CONSISTENCY_REPORT.md)
