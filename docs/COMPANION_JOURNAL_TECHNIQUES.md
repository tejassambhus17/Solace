# Companion, Journal and Guided Techniques

## Implementation and navigation

The existing five tabs and platform tab bars remain in place. Solace opens with two choices on first entry. The last selected mode is stored per account on the device. The Companion menu and Journal header offer a direct way to switch modes and restore the prior conversation or Journal branch. Both themes share component geometry and use artwork suited to their palettes.

## Reference fidelity

The eight-panel collage is the visual source for the chooser, Companion, Journal welcome, Techniques library, technique detail, breathing player, Journal editor and populated Journal library. The reference screens use a scoped midnight-indigo palette, warm serif headings, illustrated full-bleed artwork, outlined plum surfaces and peach or lavender primary actions. Light mode uses the same layout with the established cream and forest palette. The status bar, safe areas and floating tab rail come from the actual platform. The immersive practice retains its dedicated exit. Journal insights require a separate consent step and library cards show real entries. Those choices account for differences from the collage’s chrome, toggle and sample records. The illustrations are new reference-guided artwork, so the captures demonstrate visual correspondence without establishing exact pixel parity. [Eight-screen capture](screenshots/companion-journal-techniques/solace-eight-screens-dark.jpg)

The built-in ImageGen tool created standalone artwork from the visual reference. The prompts asked for the following assets with the collage as visual input and no interface or lettering.

| Saved assets | Image direction |
|---|---|
| `assets/solace-companion-twilight.jpg` | Center a glowing peach and rose lotus with closed smiling eyes on a midnight lake, add concentric golden reflections, distant violet hills and an olive sprig. |
| `assets/solace-journal-twilight.jpg` | Place an open peach notebook and pen on a mossy bank, with a sprig on the blank page, layered violet mountains and a peach sunset on the lake. |
| `assets/guided-breathe.jpg`, `assets/guided-ground.jpg`, `assets/guided-rest.jpg`, `assets/guided-reflect.jpg` | Painted portraits for breathing, grounding, rest and reflection, using the collage’s poses, warm rim light, indigo twilight and botanical detail. |
| `assets/guided-breath-rings.png` | Transparent, soft lavender and peach orbital ribbons for the real breathing phase animation. |

| Starting point | Destination and return | Evidence |
|---|---|---|
| Solace tab | Choice screen, Companion, or My Journal. The switcher retains each mode’s route. | Session-state tests and Chromium fresh entry, switching and reload. |
| Companion | New chat, history, saved conversation, delete, turn-based voice or guided suggestion. | Chromium completed two real Gemini turns with prior-turn recall, reopen, new and delete. Voice provider and native checks are tracked separately below. |
| My Journal | Welcome or library, then create, open, edit, bookmark or delete. Editor returns to its source. | Chromium tested draft restore, multiline save, mood, tags, bookmarks, filters, reload, deletion and offline retry. |
| Journal entry | Reflect or discuss. Both actions show an excerpt chooser and disclosure. Discussion opens real Companion, with a route back to Journal. | Browser verified both declines issued zero provider requests, a real reflection, direct discussion and back to the original entry. API verified idempotency and follow-up. |
| Explore | Guided techniques, category filter, detail, then the existing Moment player. | Chromium verified eight categories, selected accessibility state, back restoration, and final library card access. |
| Companion recommendation or Journal grounding suggestion | Canonical technique detail, then the same player as Explore. | Shared registry and route tests. The browser opened Five-senses grounding from a live Journal suggestion and returned to the excerpt screen. |
| Technique player | Completion, optional feedback, Journey, or a writing prompt in a blank Journal editor where supported. Early exit returns to detail without recording completion. | Browser verified pause, resume, restart, abandonment, completion, reflection response and Journal handoff. Returning from the editor restored the originating practice detail. |
| Journey day history, goal evidence or saved reflections | Journal detail for the existing Journal record. Back returns to the originating tab and route. Legacy weekly stories use their original detail. | Navigation and server persistence tests. |
| Today breathing and Profile memory | Existing breathing and memory routes. | Existing flows stay on their original routes. |
| Native `solace://` | `companion`, `journal`, `techniques` and `techniques/<technique-id>`. Auth required. Invalid IDs are rejected. | Link parser tests and Android emulator opens for Companion, Journal and Box breathing. |

## Storage and privacy

Journal records use the existing account-scoped SQLite `reflections` collection. The `journal` kind adds title, mood, tags and bookmark fields. Legacy nonweekly reflections remain readable and can be upgraded in place. This preserves Journey’s record identity and weekly stories. Large multiline entries use the existing request-size and database boundaries. Native unsent drafts and eligible queued saves use the existing bounded SecureStore vault. Web drafts stay in the current tab’s memory. Authenticated cold launch requires an API connection.

The AI endpoints are `POST /api/journal/:id/reflect` and `POST /api/journal/:id/discuss`. The request includes excerpt offsets and an entry revision. The server checks owner, current revision, bounds, consent action and safety before provider use. It sends the chosen excerpt without the rest of the entry. Journal sharing bypasses automatic memory extraction and cross-provider fallback. The Companion conversation stores a provenance reference and the discussion, including the generated reply. The raw excerpt is omitted from chat history. Removing the source entry clears its link and resets future provider context for the conversation. The user can delete its visible conversation separately. Provider credentials remain server-side.

Eight practices share the existing Moment player, audio handling and completion pipeline. The player uses active elapsed time and pauses when the app backgrounds. A completed practice has a stable session ID and records only active seconds. Restart resets progress. Abandonment records no completion. Journey, goals and milestones read the existing session records.

## Reproduced defects and retests

| Severity | State and reproduction | Fix and evidence |
|---|---|---|
| P1 | Journal detail on Chromium. Delete a saved entry after reopening the app. The server removed it, but the detail route could remain open when the record vanished before the back action. | Kept the detail component mounted through the deletion transition. The second run returned to the library and the entry remained gone after reload. |
| P1 | Switch from a pending first Companion turn to Journal. The original conversation ID needs to attach to the cached Companion route when the reply arrives. | Route parameters can reconcile against the matching cached mode. The session-state regression proves the late response updates the correct mode and preserves the Journal route. |
| P1 | Complete Short reflection, open its Journal editor and go Back. Returning to the old immersive route could start a new player. | Exit the completed player before opening the editor and preserve its source route across modes. The browser returned to technique detail and confirmed the session total stayed at two. The provider test covers return to Companion’s detail. |
| P1 | On the Android emulator, tap the microphone in Voice Talk and respond to Android’s first permission prompt. Solace reported a discarded recording even though audio had yet to start. | Keep the permission request distinct from a running recording and wait for the activity to resume before starting. Android denial showed the text fallback, granting started recording with the OS indicator, and pressing Home during recording stopped it. Two new voice regressions passed. |
| P2 | At 320×640 in Chromium dark mode, select Grounding. The chip changed appearance but exposed no selected radio state to web accessibility. | Explicit radio state. The strict retest observed `aria-checked="true"` and could open the last tile clear of the tab bar. |
| P2 | At 120% text on the Android emulator, open Box breathing. The upper edge of the landscape created a visible horizontal boundary inside the breathing stage. | Matched the adjoining gradient colors at the artwork boundary in both themes. The final Chromium breathing capture shows the joined scene. The final native package was rebuilt. |

## Local evidence and release gates

- Chromium phone layouts at 320×640, 390×844 and 430 px wide across light, dark and emulated Reduce Motion. UI and provider tests used synthetic disposable accounts. [Screenshots](screenshots/companion-journal-techniques/)
- Real Gemini testing used the configured key on the local API. Journal question and grounding, handoff, prior-turn context, and transcription of synthetic audio passed. One earlier reflection request returned 502. A repeat of the same action and subsequent browser requests passed. The underlying provider cause remains unknown.
- Android Pixel 3a emulator, API 33, x86_64, 1080×2220 at 440 dpi. The debug build with Metro and a disposable loopback API passed fresh onboarding and signup, mood save and first milestone, first Solace choice, multiline Journal input with the native keyboard, protected draft recovery after force-stop, dark mode at 120% text size, a live Companion turn with the keyboard open, and microphone denial, grant and background cancellation. The emulator ran Box breathing through its full timer, recorded exactly 3:00 and opened Journey. The initial interaction pass used a zero animator duration scale. [Native breathing clip](screenshots/companion-journal-techniques/guided-android-breathing.mp4) · [Saved duration](screenshots/companion-journal-techniques/guided-android-completion.png)
- The project remains on `main`. Native builds use the existing Expo and React Native projects and signing configuration. Local QA uses a separate Android app ID and disposable SQLite database. Physical-device inventory after the build found no Android ADB device, no iPhone interface and no Xcode toolchain on this Windows host. Physical iOS/Android audio, gestures, reminder delivery, and final release performance remain blocked. Release acceptance still requires a reachable production HTTPS API and a final demo.

## Checks and source changes

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run server:typecheck`, `npm run server:build`, `npm run format:check` | Passed. |
| `npm run server:test` | 92 passed. The suite covers journal ownership, persistence, handoff consent boundaries, stale revisions, cancellation, duplicate requests, memory context deletion, and technique completion. |
| Client package tests | 180 passed across wellness, reminders, session state, insights, routine, offline writing, tooling, API configuration, voice, progress, Moments and native configuration. The tooling process check required loopback access. |
| Production Expo exports | Web, Android and iOS JavaScript exports passed. |
| Native Android | JDK 21, Gradle debug and release APK, `lintVitalRelease`, arm64 and x86_64. The 55,081,945-byte QA APK contains a 2,116,004-byte Hermes bundle and the reserved HTTPS QA origin. The loopback QA API address was absent from the bundle. The emulator installed it and opened Welcome with Metro stopped. |
| Native iOS | JavaScript export passed. Signed build and installed-device testing are blocked on this Windows host. |

Navigation and session state live in `App.tsx`, `src/routes.ts`, `src/experience-links.ts` and `src/store.tsx`. New screens are in `src/screens/SolaceHome.tsx`, `src/screens/SolaceModeSwitcher.tsx`, `src/screens/Journal.tsx`, `src/screens/JournalReflection.tsx`, `src/screens/Techniques.tsx` and `src/screens/GuidedBreathingPlayer.tsx`. Existing Companion, Explore, Journey and Moments screens share the routes, vault and `src/techniques.ts` registry. `src/theme.tsx` scopes the reference palette. `src/VoiceControlsImpl.tsx` and `src/voice-session.ts` handle the microphone permission transition. Server changes are in `server/src/app.ts`, `server/src/ai.ts`, `server/src/journal-ai.ts`, `server/src/journal-contract.ts`, `server/src/validation.ts` and the existing Moment contract and generation modules. Regression tests are in `server/tests` and the existing `scripts/test-moments.cjs`, `scripts/test-offline.cjs`, `scripts/test-session-state.cjs` and `scripts/test-voice.cjs` suites.

The seven added illustrations total 460,114 bytes. One cold launch of the standalone QA APK reported `TotalTime: 1737` from Android `am start -W` on the emulator. That measures the Android activity launch in this run. Long-list, audio and frame pacing benchmarks on physical release devices remain open.

## Manual device checks

1. On a physical Android phone and an iPhone, install a build pointed at an accessible QA API. Sign in with a fresh disposable account. Switch appearance to light and dark, increase text size, and repeat with Reduce Motion.
2. In Companion, start a voice turn with permission denied, grant permission, record, stop, and verify transcription, a real reply, audible playback, and stop controls. Leave during recording and playback. Retest with an audio route change.
3. In Journal, type a multiline draft with the keyboard open, background the app, then reopen it. Restart with the API reachable and recover the protected draft. Interrupt the network during save, retry, and check that the record appears only once. Sign out and verify a second account sees none of the first account’s private records or drafts.
4. Decline the sharing disclosure and check that no AI request is made. Share a selected excerpt, follow up in Companion, use Back, then delete the Journal source. Inspect the remaining conversation and verify future AI context does not reuse it.
5. Open a technique from Explore and a live Companion recommendation. Pause, background, resume, restart and complete a practice. Check active duration and optional feedback in Journey. Abandon a second practice and verify the total is unchanged. On Android use hardware Back. On iOS verify the available back and swipe behavior with the native tab overlay.
