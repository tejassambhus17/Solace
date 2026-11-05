# Solace visual QA

final result: passed

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
