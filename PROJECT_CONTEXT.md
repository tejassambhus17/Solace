# Project context

## Decision history
The user selected the botanical Solace concepts in `design/references/`. This is now an actual app development request, not an image-generation request. Preserve those designs while implementing real interactions.

## Constraints
- Deadline supplied by user: Tuesday 10 November 2026, 11:59 AM IST. Internal release work must finish earlier.
- Required technology: React Native with Expo, Node.js backend, database. SQLite is used for a self-contained persistent local backend; deployment requires a persistent disk.
- User wants all discussed features covered. Track exact coverage and verification separately; never promise a hackathon outcome.
- No provider credentials or hosting account were present at project creation. Configure live AI and public HTTPS hosting before submission.

## Structure
- `App.tsx`, `src/`: mobile application and shared web preview.
- `server/`: authenticated API, database, contextual companion integration, tests.
- `assets/`: production raster illustrations, with provenance.
- `design/references/`: approved generated mockups; source images include illustrative data.
- `docs/`: requirements, architecture, verification, deployment and demo guidance.
- `scripts/`: local development support.

## Source evidence
The 11-page PDF is included at the root. The uploaded guide was reviewed in the original chat: actual reference app appears mainly 05:09–06:44; the guide describes initial video shortlisting at 02:17–02:32. The original guide is not included in this folder, so timecoded notes are retained in the requirement matrix.

## Important ambiguities
The PDF's unexplained "follow, post, message" line is not enough to define a social product; organizer clarification is still required. Page 9 asks for APK + demo, while page 10 allows APK or TestFlight. Prepare APK + demo and support later TestFlight.

## Ownership during initial build
Foundation agent: Expo config, theme/UI/store and main screens. Backend agent: server. Wellness agent: content and wellness screens. Root: profile/reminders, assets, documentation, integration and verification.

## Latest user-directed navigation and platform pass
The user explicitly allowed another tab to reduce clutter. Current destinations are Today, Solace, Explore, Journey, Profile; this supersedes the earlier four-tab ordering rule while preserving the original relative order. Today owns the daily pause, Explore owns discovery, Profile owns private photos and settings. Keep the true-black base with restrained lilac/peach/sage accents. Native iOS glass and Android navigation are separate from web-preview visual evidence.

## Illustrated Today refinement
The user found the simplified home generic and the dark mode visually weak. The latest refinement restores botanical depth to Today using the existing light moment artwork and a matching newly generated charcoal/champagne counterpart. Keep the black page base, neutral graphite layers, warm primary actions, one shared mood tray, an illustrated daily-pause card and quiet factual steps. Light mode's warm/forest identity remains; its secondary text was strengthened slightly for contrast. Keep five tabs and all private save/consent/recovery behavior. See DESIGN.md and assets/DAILY_PAUSE_ARTWORK.md for the current visual authority and provenance.

## Master implementation brief and authentication priority
The master brief requests Today, Solace, Moments, Journey; the subsequently supplied workspace instructions preserve Today, Solace, Journey, Profile. Resolve the navigation difference before a future navigation change. Do not migrate the current five-tab interface during backend repair. Preserve the current working app while fixing separate root/server installation and simulator API configuration. On 5 November the user explicitly deferred Mac access and selected authentication repair before provider configuration. Actual local process/auth tests, Mac simulator checks and real-provider evaluation must be reported separately. Follow docs/IMPLEMENTATION_PLAN.md; do not introduce Docker or unrelated branch work.


## Latest execution direction — features before external setup

The user explicitly asked to implement the full app now without questions and defer setups. The locally verified authentication repair is no longer a blocker for feature implementation. Follow the supplied workspace's four-tab order (Today, Solace, Journey, Profile); Moments is a first-class detail experience from Today/chat, and it retains access to Explore's complete library. This resolves the earlier navigation difference for the current implementation.

The code now includes structured Moments/player, six-state petal companion, three ambient environments, explainable editable memories, calendar/time/helpfulness/weekly Journey, personal goals/optional streaks/actual-data milestones, turn-based recording/transcription/review and device TTS. Preserve the original design and working privacy/reminder/account flows. Live-provider configuration/evaluation, public hosting, native installs/device QA and demo are deliberately separate deferred work; never mark them verified from mocks or exports.

## Explore discoverability correction

The user reported that Explore and the existing tools were hard to find. Put a labeled Explore shortcut between Solace and Journey in the bottom bar. The four main tabs keep their existing order. Explore retains Back to the originating screen, and its library links lead directly to their named features.
