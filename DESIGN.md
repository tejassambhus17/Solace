# Solace design system

## Current visual authority

The botanical references in `design/references/00-home-tabs-light.png` and `00-home-tabs-dark.png` establish the identity: editorial serif headings, readable sans serif text, sculpted petals and leaves, warm light, and generous spacing. Device bezels are presentation chrome, not app UI.

The latest supplied Today, Explore, and Solace frames define their scenic artwork, layout, and controls. Light uses ivory, muted olive, and violet accents. Dark uses black and graphite beneath individually generated night scenes, with champagne actions. Preserve all original reference images and source artwork.

## Theme tokens

Use semantic tokens from `src/theme.tsx` rather than screenshot inversion or per-screen color substitutions.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#FBF0E8` | `#000000` |
| Surface | `#FFF8F2` | `#141416` |
| Raised surface | `#EEE8D6` | `#202022` |
| Main text | `#183A2B` | `#F4EEE6` |
| Secondary text | `#626B5D` | `#B6B0AA` |
| Primary action | `#2D5038` | `#E7C7A8` |
| On-primary text | `#FFF9EC` | `#2B211A` |
| Border | `#E6DACE` | `#2C2B2F` |
| Hero base | `#F2E5D3` | `#181719` |

Lilac, peach and sage remain small accents and semantic activity tones. Dark pairs are `#211E27`/`#D7C8E6`, `#28201D`/`#E8C5AD`, and `#1D2521`/`#C0D3C6`. Avoid broad green tint and large saturated purple blocks. Color lives primarily in the botanical artwork, selected mood, icon details and the primary action.

The light secondary-text adjustment to `#626B5D` preserves the visual identity while reaching a measured 4.54:1 against the raised surface. Token measurements do not certify every image/text combination; record actual browser and native checks separately in `docs/VERIFICATION.md`.

## Typography and composition

Cormorant Garamond headings and Inter body/UI text retain the editorial identity. Reserve the largest headings for arrival and the featured practice. Supporting labels remain compact and readable. Use body text around 14–16 points and touch controls at least 44 points high, with native Android targets sized appropriately.

Keep four main tabs in order: **Today, Solace, Journey, Profile**. The labeled Explore compass between Solace and Journey opens the practice library as a secondary destination. Tapping it from a library detail returns to the open library. Back from Explore restores its originating screen. Auth and immersive activities may suppress the bar. Wide web previews remain a centered mobile column.

## Today and the daily pause

Today follows the latest phone reference. The dark arrival uses a violet lake scene and the light arrival uses the sunrise scene.

1. Scenic artwork extends into the top safe area. The lotus wordmark, personal greeting, Reminders and Moments controls sit inside the safe area.
2. Five mood choices use the same watercolor petals, dimensions, and spacing in both themes. The selected tile marks the latest saved check-in. Tapping a tile opens the existing check-in and uses a gentle haptic on supported devices. The tint transition respects Reduce Motion.

   Android phone widths use compact spacing and five equal mood tiles in one row when each target has at least 48 dp. The row reflows in narrower windows. Android also uses tighter cards on Today, Explore, Journey, and Profile. Larger text can still expand those cards.
3. **Today’s Moment** opens a five-minute Calm Reset and respects the saved environment. Four compact practice shortcuts follow it.
4. **Your Journey** shows a linear measure of the actual three-step daily routine. Explore More links to Guided Programs, Wellness Toolkit, Check-Ins and the full Explore library.

Your Daily Pause sits below Explore More and follows the next route from `pickDailyRoutine`. Completing it keeps the recorded progress and offers an optional three-minute breathing practice.

During the practice stage, **Why this pause?** expands the curated reason. Historical preferences/helpful feedback require personalization consent; directly supplied current-day mood can guide a local curated option. Keep these facts understandable without placing a paragraph of explanation in the default hero.

The three-step path is supported by actual saved account and device records. Its accessible progress value reports the real count out of three. The daily affirmation is available in Explore.

## Explore and supporting screens

Explore lets the twilight lake extend into the top safe area while the brand, title, search, and saved toolkit controls stay within reach. Six compact category chips include a dedicated Sleep filter. Illustrated recommendations use an even two-column grid and stack when width or system text size calls for more room. Breath Reset, Five Senses, and Sleep Wind Down use three-, five-, and ten-minute sessions respectively. Quick Reflection opens the self-paced journal with a four-minute estimate.

Create Your Wellness Plan opens the editable three-day plan. Explore More uses compact horizontal cards for Guided Programs, Wellness Toolkit, and Reflective Check-ins. The two illustrated cards at the bottom open Wellness Tools and Build a Timed Practice. Both dedicated screens share a botanical landscape header. Wellness Tools uses illustrated rows and category chips. The builder uses equal focus cards, duration choices, and a timeline drawn from the same configuration as the Moment player. Focus choices wrap into two rows when width or larger type calls for more space.

Journey emphasizes factual weekly history and reflection. Participation milestones remain optional/expandable; XP never measures emotional worth. Welcome, login, signup and Today have no upper-right profile shortcut.

## Profile

Profile opens with a compact scenic card that shows the signed-in name and photo. The cream sunrise and charcoal sunset artwork use the same card and typography. **Edit Profile** opens the existing name and photo controls.

**Personalize Solace** groups Gentle reminders, What Solace remembers, and Appearance & preferences. Reminder and memory badges reflect saved preferences and records. **Privacy & Support** groups direct access to account data controls, human support, and About Solace. About contains the AI wellness disclaimer and explains how the server and configured provider process conversations. A lotus and layered mountain scene frame the closing message.

## Artwork and implementation

Today’s twilight lotus, stacked stones, and three Explore thumbnails are documented in [artwork provenance](assets/ARTWORK.md). Text, progress, and controls are rendered separately. Keep the left reading zone clear.

Artwork and decorative icons are hidden from assistive technology and cannot intercept controls. Keep explicit accessible names, expanded/selected states, and progress values on meaningful UI. Bundling and browser rendering do not establish native scrim projection, VoiceOver/TalkBack behavior or device contrast.

Original petal, botanical, stillness and night assets remain available. Preserve the original green-backed `moment-dark.png` as history, not as current dark hero artwork. Provenance is in `assets/ARTWORK.md`, `assets/DARK_ARTWORK.md` and `assets/DAILY_PAUSE_ARTWORK.md`.

## Navigation, motion and native boundaries

The floating navigation rail shares its measured height with screen/composer clearance and respects safe-area insets. Native keyboards hide it. Supported iOS uses actual Expo GlassView only after both capability checks and with Reduce Transparency off; older supported iOS uses native blur, and the accessibility fallback is opaque. Android uses an opaque tonal capsule, selected icon indicator and native ripple. The web shows fallback layout, not proof of system glass.

This remains a custom tab/stack implementation, not UIKit native tab navigation. Native iOS edge-swipe back is not implemented; Android predictive-Back integration and installed-device keyboard/gesture behavior remain follow-up work. Keep these limits distinct from the working detail Back buttons/hardware-Back handling.

Breathing motion communicates a named phase/countdown and honors reduced motion. Do not add continuous decorative motion merely to create interest. Loading, errors, completion, optional consent and unsynced writing need explicit text states. Preserve recoverable user text and never imply an external operation succeeded before confirmation.

## Writing, privacy and release evidence

Native check-in/journal drafts and bounded unsynced writing use account-scoped SecureStore; chat/feedback drafts remain in memory. Draft writes debounce and can lose recent uncommitted edits under abrupt termination. Web writing is memory-only. See the README and verification record for retry/cleanup/cold-launch limits; do not describe all drafts as durable or synced.

Private profile photos have real choose/save/remove/cancel/error states and remain owner-scoped. Reminder delivery requires device verification. Real provider configuration, a public HTTPS API, a rebuilt installable APK tested on physical hardware, verified reminders and the final demo remain submission gates. UI refinement does not establish production release readiness.


## Moments, companion and Journey

Extend the established botanical world with the small petal companion; do not introduce another brand logo beside it in the chat header. Idle, listening, thinking, speaking, celebration and breathing states reflect actual interactions. Respect the OS reduced-motion setting from the first render. The companion does not infer a person's emotions.

Solace chat combines a woodland lotus scene with rounded bubbles, timestamps from saved turns, contextual quick replies, and a scenic two-minute Guided Breath card. The scene scrolls with the transcript below a fixed glass header. The composer row holds the action menu, draft, microphone, and paper plane. Voice Talk opens from the headset and centers the companion, recording control, editable draft, and spoken reply. The reply itself identifies its source. Urgent replies surface the support action alongside the response.

Moments uses one feeling field, three quiet environment choices and a validated activity preview with a clear source and optional explanation. The immersive player hides tabs, keeps Begin/Pause and sound controls in a safe-area footer, pauses on app backgrounding and environment changes, and confirms exit after starting. Forest uses the existing botanical image, Ocean uses calm geometric wave layers, and Twilight reuses moonlit art; all three preserve black app chrome in dark mode. Original synthesized ambience is optional and starts off. No therapeutic effect is attributed to art, sound or a completed timer.

Journey uses a compact mountain header, a Week / Month / All time switch, and three tinted cards over warm ivory or midnight plum. A week strip or month grid leads to selected-day history. Check-in, Moment and reflection markers have distinct colors and accessible text. The reflection card uses existing lotus artwork, followed by the personal goal, four milestone previews and the saved-story links. Milestones expand on request and celebrate earned records. Navigation retains its existing native styling.

Memory management exposes categories, canonical sources, corrections, individual removal, clear-all and revocable personalization. Voice transcripts stay in a review panel until the user adds them to the composer, with no automatic send or silent truncation. Playback shows waiting/speaking states from actual callbacks and offers a recoverable startup failure.
