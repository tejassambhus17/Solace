# Solace design system

## Approved visual authority
`design/references/00-home-tabs-light.png` and `00-home-tabs-dark.png` establish the visual direction. Other sheets specify supporting flows. Device bezels in those images are presentation chrome; do not reproduce them inside the native app.

## Visual language
Warm ivory and blush surfaces, forest-green text, sage accents, and subtle apricot/lavender light. The latest user direction overrides the original forest-green dark mockup: dark mode uses a true black canvas, neutral charcoal surfaces, warm ivory text and champagne controls. Avoid green-tinted dark surfaces. Use theme tokens, never invert screenshots.

Editorial serif headings paired with readable sans serif body text. The selected Cormorant Garamond heading font approximates the approved references; Inter is the UI body face. Keep body text at least 14–16 points and important controls at least 44 points high.

Use real raster petal and botanical illustrations. Decorative images do not receive accessibility focus or block controls. Use a single consistent outlined icon family for navigation and actions.

## Screen composition
Four bottom destinations: Today, Solace, Journey, Profile. Detail screens have a clear back action. Onboarding and immersive activities can suppress tab navigation. On wide web previews, keep a centered readable mobile column.

Use generous spacing, rounded tactile surfaces, restrained elevation, and concise copy. Keep text away from botanical silhouettes. Use clear labels in addition to color for moods and selected states.

## Motion and accessibility
Breathing motion communicates a named phase and countdown in text. Respect reduced motion preferences. Loading, errors, completion, and selection have textual feedback. Keep screen reader labels on icon buttons and state on toggles.

## Artwork provenance
`assets/petal.png` and `assets/botanical.png` were created with the built-in image-generation tool for this app from the approved concept direction. They are separate production assets, not screenshots of the UI.

## Refinement implementation

Light surfaces now use blush ivory `#FBF0E8`, warm white `#FFF8F2`, and forest text `#183A2B`; dark uses `#000000`, `#111112` and `#1D1D1F`, with `#303033` borders and `#EBDFCB` primary actions. Keep fine warm borders, generous section spacing, restrained pill actions and editorial headings. Mood stones use softly lit organic oval geometry, paired with explicit mood labels. The approved rounded botanical cards remain the visual authority.

`assets/moment-light.png` and `assets/moment-dark.png` are separately generated production artwork for the featured activity, with text rendered in code. Their provenance and prompts are in `assets/ARTWORK.md`. Preserve the existing reference archive and source assets.

## Black-mode correction

The user's explicit November 5 correction takes precedence over the forest-dark reference. Large dark surfaces must be neutral RGB values, with no green cast. Keep color in mood indicators and the original petal artwork; supporting leaves become quiet champagne silhouettes. The featured dark activity is composed in code from the original transparent petal on charcoal, rather than the earlier green-backed moment-dark.png. Preserve that earlier artwork as source history.

Use local search and inline rename in conversation history. Show a real latest-conversation resume entry on Today when an account has one. Unsubmitted writing is an account-scoped in-memory draft, not a saved or device-persistent record; make that distinction explicit. Expired sessions hide authenticated screens and resume the same account's draft/route after sign-in.

## Native dark artwork and daily routine

The next pass adds production dark-petal.png, dark-stillness.png and dark-night.png through built-in ImageGen. Their smoky lavender/champagne material sits on neutral black/charcoal; broad green tint remains excluded. Artwork is decorative, with text and controls rendered separately and accessible names supplied on controls. Light mode keeps the original petal, and supporting botanical images stay faint and offset from text. See assets/DARK_ARTWORK.md for prompts and provenance.

Today uses a primary breathing moment, a real recent-conversation shortcut, a saved-toolkit entry and a quiet grounding feature. Supporting navigation is a divided list rather than repeated same-weight cards. Journey puts its factual weekly reflection before participation XP. My Toolkit has explicit saved/empty/removing states and remains account-scoped. Grounding is optional and immersive; step numbers describe the actual sequence, and users can skip any sense.
