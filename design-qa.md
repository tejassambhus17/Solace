# Solace visual QA

final result: passed

## Compact Explore phone reference — 6 November 2026

Compared the second supplied Explore image with the rendered dark screen at equivalent phone widths, below system chrome. Reviewed the light screen at 394 × 852 CSS pixels and checked the narrow and wide phone layouts at 320 and 430 pixels.

- The first render cut off Move and let lower tools peek around the navigation. The final chip row shows all six options at 394 pixels. At 320 pixels it can scroll sideways without widening the page, and the recommendations stack. The Explore scroll area ends above the floating bar.
- The twilight lotus, ring, and recommendation thumbnails use the existing art. Serif headings and compact controls preserve the reference hierarchy. A few recommendation titles can wrap, with room in the cards for both title and timing.
- The recommendation timers, journal, category filter, search, planner, toolkit, check-in, and secondary practice builder opened their working routes. The three-day plan saved to the local test account.

[Dark capture](docs/screenshots/explore-compact-dark.jpg) · [Light capture](docs/screenshots/explore-compact-light.jpg)

## Twilight Today phone reference — 6 November 2026

Compared the second supplied image with the live dark Today screen. The source crop starts below the status bar, excludes the phone frame, and was resized to 393 pixels wide. The browser captures measured 394 × 852 CSS pixels. Compared the top artwork and greeting, mood panel and feature, and the Journey, Explore More, and navigation region side by side. The browser preview uses a test account with a real saved Calm check-in.

- **Spacing and layout.** The first capture put Explore More about 30 pixels lower than the normalized reference and exposed part of the daily routine below the floating bar. Tightening the header, mood and feature spacing brought the section closer to the reference. Extending the bottom safe-area backing covered content below the rounded navigation edges. The final capture shows the Explore card titles above the bar, with more content available on scroll.
- **Typography and copy.** The serif greeting, feature and section titles follow the reference hierarchy. Inter handles body copy and controls. The layout shows the signed-in name, the current greeting and the five-minute timer. The progress bar and count come from saved records.
- **Palette and artwork.** The dark screen pairs a black canvas with plum surfaces, champagne actions and violet selections. The twilight lotus, stacked stones and mountain thumbnails are separate full-bleed assets. Light uses the sunrise artwork and watercolor petals. Both captures show readable labels and complete card titles.
- **Interactions and fit.** Verified the Calm check-in and its saved selection, five-minute Moment entry, four practice shortcuts, Journey, all three Explore More cards, and See All. No horizontal overflow at 320 pixels, 394 pixels or the 1536-pixel desktop viewport. Chrome reported zero error-level entries in the verified preview tab.

[Dark Today](docs/screenshots/twilight-today-dark.jpg) · [Light Today](docs/screenshots/twilight-today-light.jpg)

The reference uses iPhone system chrome and a glass rail. The browser capture uses the app’s web fallback. Native safe-area appearance and iOS glass remain device checks.

## Scenic redesign references — 6 November 2026

Compared the three latest supplied frames with the 390 × 845 CSS pixel browser preview. The captures show the app viewport and exclude the surrounding browser renderer. The current app uses actual names, stats, mood, and conversation state. The system status bar and device frame belong to the operating system.

- **Typography and layout.** Today preserves the illustrated greeting, stat row, mood strip, feature, and four quick actions. Explore preserves the category rail, feature, four illustrations, builder, and lower tools. Solace uses the forest header, conversational bubbles, two-minute card, and a single composer row. The lower Explore content scrolls above the bottom navigation.
- **Color and images.** New artwork follows the sunrise, violet lake, woodland lotus, and guided breath reference scenes. The app uses separate night artwork and dark surfaces. The generated images leave space for live text and working controls.
- **Controls.** Verified the mood route, focus carousel, Explore search and Move filter, custom durations, chat timestamps, and a complete Guided Breath session saved to Journey. The scene now scrolls with the transcript, and reply playback is accessible from the composer menu.

[Today](docs/screenshots/scenic-today-phone.png), [Solace](docs/screenshots/scenic-chat-phone.png), [Explore](docs/screenshots/scenic-explore-phone.png), and [dark comparison](docs/screenshots/scenic-dark-phone.png) show the verified views.

## Supplied Today and chat references — 6 November 2026

Reviewed the supplied left and right app frames and the separate watercolor mood strip against the app at 390 × 845 CSS pixels. The app captures are cropped only to remove browser renderer padding. The supplied device frame and status area are outside the comparison.

- **Typography and spacing.** The serif greeting, compact composer, two equal quick replies, and reset title preserve the reference hierarchy. The daily pause progress fits above navigation at the checked viewport. A two-line personal greeting is expected for the sample name.
- **Color and imagery.** The light view matches the cream, forest, and mauve palette. The five watercolor icons and right-aligned petals in the pause and reset artwork are raster assets with live text above them. The dark view uses black and graphite with matching reset art.
- **Controls and copy.** The mockup's sample mood and daily activity are replaced by the account's actual records. The paper plane and adjacent microphone fit in one composer row. The four chat header actions and bottom navigation are intentional additions for the working app.
- **Verified interactions.** Tested the mood control, both reset paths, focus from the talk quick reply, the voice availability state, text fallback, and saved chat history. Browser speech entered its speaking state. Live microphone and provider behavior still need a configured service and device test.

No unresolved priority layout issue was observed at the checked viewport. [Today](docs/screenshots/reference-today-phone.png), [Solace](docs/screenshots/reference-chat-phone.png), and [Voice Talk](docs/screenshots/reference-voice-phone.png) show the tested preview.

Scope: browser rendering of the React Native app, not native-device certification or APK release acceptance.

## Evidence
- Source: `design/references/00-home-tabs-light.png`, `00-home-tabs-dark.png`, and supporting approved concept sheets.
- Implementation: local Expo web preview at 127.0.0.1:8081, reviewed in light and dark themes. Phone viewport set to 393 × 852 CSS pixels for capture, then reset.
- Combined comparison: `docs/screenshots/design-comparison.png` places actual source crops beside actual app screenshots. Source phone bezels/status chrome were cropped; crops were fit proportionally, not stretched. Mockup aspect ratios differ and contain illustrative copy, so this is a composition/style comparison rather than a pixel-difference claim.
- Actual app captures: `today-light-phone.png`, `today-dark-phone.png`, `chat-dark.png`, `assessment-light.png`, and `settings-dark.png` in `docs/screenshots/`.

## Required surfaces
- **Typography:** editorial Cormorant Garamond headings and readable Inter controls/body retain the reference hierarchy. Fonts load from bundled assets. Text wraps naturally at 393px; no visible clipped primary control in tested screens.
- **Spacing/layout:** consistent page gutters, rounded surfaces, generous heading space, and four labeled bottom tabs. Primary mood/action regions remain prominent. Additional functional links scroll below the first viewport.
- **Colors/tokens:** warm ivory/forest palette and forest/ivory dark palette match the selected world. Selection and actions use clear foreground contrast. No claim of complete measured WCAG compliance is made.
- **Artwork:** actual generated transparent petal and botanical raster assets are used, not rasterized UI or handcrafted approximations of the illustration. The new reusable petal differs slightly in shape from the mockup; accepted as a production asset in the same visual system.
- **Copy/content:** personal greeting and actual account records replace illustrative mockup data. Offline companion disclosure, consent language and non-diagnostic assessments are visible. Real resource and privacy controls replace conceptual placeholders.

## Findings
No unresolved P0/P1/P2 visual issue observed in the tested browser journeys. Initial connection/CORS and conversation-continuity issues were functional defects; they were fixed and the journeys rerun successfully.

Accepted differences: native device bezel/status imagery is absent from app-owned content; greeting varies; additional required feature links extend the home scroll; buttons use theme tokens rather than mockup-only texture. Botanical contrast is quieter in dark mode (P3 visual refinement).

Follow-up acceptance is still required on an installed phone: keyboard/safe areas, large accessibility text, screen-reader reading order, native back behavior, and system theme transitions. Passing this browser QA is not proof of those behaviors.

## 5 November refinement

The current polish pass preserves the approved botanical direction and four-tab navigation. Added light/dark production artwork, sculpted labeled mood stones, a clearer editorial type scale, consistent form/touch states and botanical profile composition. Account entry and Today have no duplicate profile shortcut. Chat keeps its composer outside the message scroll region; drafts survive tab navigation.

Reviewed effective 390×845 phone and 1281×900 wide web preview. The first batched inspection found absent web selected-state semantics and text reaching into the featured flower at wide column widths; explicit ARIA states and a bounded text measure fix those. The confirmation pass showed correct selected mood/tab DOM states, readable artwork copy and no horizontal document overflow. Dedicated raw screenshots and a viewport-only contact sheet are in docs/screenshots/polish-*.png.

This evidence is from a browser preview of the shared mobile source, not an installed native build. See docs/VERIFICATION.md for executed journeys, automated checks and remaining physical-device work.

## True-black follow-up

Latest user instruction replaces the washed-out forest dark palette. Main dark surfaces are #000000 / #111112 / #1D1D1F, borders are neutral #303033, and primary controls use warm ivory #EBDFCB. Removed the large green-backed hero image from dark rendering and replaced it with isolated original petal art on charcoal. Supporting botanical images are restrained champagne silhouettes. Light mode stays ivory/blush.

Phone inspection confirmed the exact neutral RGB surface values in the rendered DOM, readable hero copy, clear selection borders and a consistent ivory action system. History now uses a quieter divided-list composition with title/message search and inline rename. Journal drafts have clear keep/discard actions; active detail tabs follow the point of entry. Evidence is in docs/screenshots/black-mode-*.png; token contrast and executed scenarios are in docs/VERIFICATION.md. Native visual/device verification remains pending.

## Dark artwork and personal-routine pass

Added three purpose-generated assets on the neutral black/charcoal palette: translucent petal, basalt/water stillness, and moonlit botanical art. Artwork now differentiates breathing, grounding/toolkit and sleep rather than repeating the same petal everywhere. Text remains in native components. Light-mode supporting art is softened and placed outside the grounding text measure.

The initial batched review covered phone dark flows and light supporting surfaces. Adjustments bounded light illustration away from text and moved weekly reflection above XP in Journey. The confirmation covered persisted toolkit data, saved/incomplete grounding counts and the wide layout. Dark surfaces remain neutral, and the four required tabs preserve their order and originating detail state. No horizontal document overflow or final browser console errors were recorded. Raw evidence and a viewport-only contact sheet are in docs/screenshots/premium-*.png.

The browser is a preview of shared mobile source. Native accessibility, background delivery and performance require the installed final build; no claim of class-leading performance or complete release readiness is made from visual review alone.
