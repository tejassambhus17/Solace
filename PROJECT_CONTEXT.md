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
