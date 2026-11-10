# Solace light appearance audit

## iPhone contrast repair

The five supplied iPhone screenshots are the physical baseline. Today and Weekly Story used plum text over scenic images, relying on a pale `experimental_backgroundImage` wash behind the copy. Chromium painted that wash and the installed iPhone did not show it in the reading area. Solace and Explore retained legible text but showed harder image seams and lighter foregrounds against bright art. The native light glass also picked up saturated colors and visible content beneath it.

The repaired photo cards use a solidly backed reading area and explicitly scoped foreground colors. A bundled alpha mask blends the backing into the existing artwork. A second alpha mask handles short vertical photo-to-canvas transitions. Together the masks are 454 bytes. The original scenic photographs and natural colors are retained, with the light Solace notebook crop moved to show the open page. Contrast in the reading area does not depend on a gradient loading or on a theme-wide text color change.

| Tab | Light-mode repair | 390 px browser screenshots |
| --- | --- | --- |
| Today | The greeting, status bar and scenic card have a protected reading area. The duration has a solid-backed pill, and mood selection and daily progress have clearer accents. All four Quick Actions can scroll fully clear of the rail. | [Before](../work/light-critical/baseline/light-390-today-top.png) · [After](../work/light-critical/final/light-390-today-top.png) · [Moment and Quick Actions](../work/light-critical/final/light-390-today-moment.png) |
| Solace | The mountain hero and both choice cards have short image transitions and more defined borders. The Journal art is framed around the open notebook. | [Before](../work/light-critical/baseline/light-390-solace-top.png) · [After](../work/light-critical/final/light-390-solace-top.png) |
| Explore | The hero and Featured Moment have local photo backing, clearer selected filters, and more defined artwork and reading areas. The lotus and lake remain visible. | [Before](../work/light-critical/baseline/light-390-explore-top.png) · [After](../work/light-critical/final/light-390-explore-top.png) |
| Journey | Weekly Story's title and date have reliable photo backing with the same lotus and action. Future calendar dates are legible, and the period selector has a stable surface. Browser checks opened Weekly Story, returned to Journey, and switched to Month. | [Before](../work/light-critical/baseline/light-390-journey-top.png) · [After](../work/light-critical/final/light-390-journey-top.png) · [Weekly Story](../work/light-critical/final/light-390-journey-weekly-story.png) |
| Profile | Refined the portrait and dividers. Status badges move beneath their own copy in compact light layouts, leaving room for setting names and descriptions. Edit Profile opens its existing destination. | [Before](../work/light-critical/baseline/light-390-profile-top.png) · [After](../work/light-critical/final/light-390-profile-top.png) |

The light navigation uses a more defined veil over the existing iOS glass or blur and a stronger tonal background for Android and web. Its measured inset still supplies the scroll clearance. At 390 px, all five final actions cleared the browser rail, with at least 41 px of separation in the measured end positions. Quick Actions were fully reachable at 320, 390, and 430 px. The updated native material and OS safe areas remain open for device verification. [Browser measurements](../work/light-critical/final/results.json)

The final contrast probe sampled rendered pixels under the text after temporarily making the glyphs transparent. The minimum measured ratio at 390 px was 9.64:1 for Today’s welcome line, 11.52:1 for its Moment description, 6.33:1 for Explore’s Featured Moment description, and 11.82:1 for the Weekly Story date. The 12 paired 390 px dark captures were pixel-identical across the five tabs, including the Today Moment and Weekly Story. [Contrast and dark comparisons](../work/light-critical/final-comparison.json)

### Nested screens and verification

| Screen | Confirmed issue and repair | Evidence |
| --- | --- | --- |
| Journal calendar | The 320 px light grid hid Saturday horizontally. Smaller modal gutters fit all seven columns with a 44 px minimum width and 48 px height when text and space allow. The scrollable grid remains available when it is needed for larger text. A real saved-entry dot was still shown and a Saturday selection opened the corresponding empty-day state. | [Before](../work/light-critical-nested/light-09b-journal-calendar-320.jpg) · [After](../work/light-critical-nested/retest-light-journal-calendar-320-saturday.jpg) |
| Reflective check-in questionnaire | Next retained the previous scroll position, putting the new prompt 88 px above the viewport in the 320 px check. Changing questions now returns to the top and retains selected answers. Next and Back both put the prompt at 103 px. The resting dark screenshot was pixel-identical. | [Before](../work/light-critical/questionnaire-scroll-before/02-advance.png) · [After](../work/light-critical/questionnaire-scroll-after/02-advance.png) |
| Garden | On compact light layouts, the corner leaves crossed the Garden title and intention copy. The ornaments move up and away from the text while retaining the scene and decoration. The 320 px retest opened and cancelled the intention picker. | [Header before](../work/light-critical-nested/light-19b-garden-320.jpg) · [After](../work/light-critical-nested/retest-light-garden-320.jpg) · [Intention before](../work/light-critical-nested/light-19c-garden-intention-320.jpg) · [After](../work/light-critical-nested/retest-light-garden-intention-320.jpg) |

The screen inventory traces 63 routes and 16 modal and state families. It distinguishes rendered evidence from source review. The central pass inspected 50 nested screenshots at 320 and 390 px with no document-level horizontal overflow and recorded 28 distinct light routes and 10 dark routes including the main tabs. The compact dark calendar retains its existing horizontally scrollable grid. Explore added 20 captures, including the guide catalog and saved detail, assessment and result, guided programs, plan form and preview, and daily tools. Journey and Profile added 33 matched before-and-after cases per run, including history and saved details, milestones, goals, About, memories and reminder management. All 14 supplemental dark pairs were pixel-identical once the milestone art had loaded. [Route and state coverage](../work/light-critical-nested/coverage.md) · [Explore cases](../work/light-critical/explore-supplemental/results.json) · [Journey and Profile route audit](../work/light-journey-profile/nested/AUDIT.md)

TypeScript, Prettier, 187 server tests, 50 navigation tests, 27 progress tests, 15 Moment tests, and seven wellness tests passed. The revised source ran in the local browser preview. Native build, native rendering, OS large-text and VoiceOver or TalkBack verification remain open. Production deployment remains on the previous release.

## Earlier light-mode pass

The supplied iPhone Today screenshot is the visual reference for the problem. The review pairs the previous release with the redesigned app and separates the Android emulator, rendered web, and source-only checks.

## Artwork and material findings

| Finding | Cause | Change |
| --- | --- | --- |
| Green mountain haze | Natural green and mist in the 1040 × 518 source were compounded by a full-width green scrim that reached 83% opacity. | Today uses a local ivory reading lane with plum type. The sun, ridges, and right-side foliage retain their original color. |
| Dim Calm Reset lotus | The 1040 × 518 original scene was covered by a green gradient that reached 96% opacity. | Light mode gives the copy and action an ivory-lilac reading area and preserves the lotus focal point. At larger text sizes the art stacks above the controls. |
| Muddy Quick Actions | A second dark green treatment covered each thumbnail. | Each artwork has a clear image well and a separate label. The existing 312 px and 440 px sources are sized as thumbnails. |
| Washed-out guided and library art | Some light headers faded most of the photo toward cream or enlarged a small thumbnail into a cover. | Use a separate light text panel where appropriate, localized contrast where copy still overlays art, and higher-resolution existing sources for covers. |
| Flat glass over colorful cards | The iOS material previously let the backdrop color dominate. Android and web used a solid cream fallback. | A pale lavender glass tint, defined edge, and deeper ink distinguish the light rail. Older iOS keeps a blur-backed treatment and Reduce Transparency keeps an opaque fallback. The circular spotlight, gestures, and measured clearance stay in the existing rail. |
| Green text and cream surfaces | Legacy forest-green text, warm secondary fills, and several screen-local overrides were independent of the artwork. | The light palette uses `#FAF8FC` canvas, `#FFFFFF` cards, `#F3EDF8` raised surfaces, `#2B2038` ink, `#65586E` supporting copy, `#D8B4F0` action fill, and `#634579` focus and progress. |

The [image inventory](../work/light-mode-qa/artwork-inventory.csv) records 59 source references with dimensions, format, bytes, and whether an ICC profile was detected. The Journal window is 1170 × 543, Companion landscape 1040 × 518, Live Voice dawn 852 × 1846, Profile landscapes 1120 × 373, and Garden stages 764 × 337. Art changes select, crop, or stage existing artwork. There is no app-wide filter, sharpening, additional image dependency, or re-encoding of originals. Neither source inspection nor browser screenshots measure Retina decode quality or device frame timing.

## Screen and state inventory

The route families below come from `App.tsx`, `src/routes.ts`, the feature switches, and the modal call sites. A rendered representative does not cover every account, permission, or error variant in its family. Evidence lists distinguish those cases.

| Area | Reachable screens and states | Light-mode treatment |
| --- | --- | --- |
| Entry and account gate | Welcome, onboarding slides, login, signup, reset password, personalization, font/session loading, biometric and privacy cover | Shared palette, high-contrast progress and loading marks, existing onboarding photographs at their intended crops. |
| Today | Root, mood check-in and suggested next step, Daily Pause, Today's Progress, Today’s Moment, Quick Actions, reminders shortcut, reflection, activity handoffs | Local reading lanes and scene crops, legible mood selection, plum progress marks, artwork separated from the Quick Actions labels. |
| Solace | Landing, Companion welcome and populated transcript, chat composer, conversation menu, history/search/rename, recommendation and explanation, confirmation, transcription and playback states | Landscape with localized text protection, separate white reading panels, white assistant bubbles, lavender user bubbles, stronger input focus, and clearer proposal grouping. |
| Journal | Empty and populated library, search/filter/bookmarks, new editor, edit entry, draft information, entry detail, calendar, excerpt selector, reflection and consent | Correct image-frame proportions, pale lavender writing surface, plum writing and labels, shared modal surfaces and selected states. The journal-window scene retains its original lighting. |
| Live Voice | Ready, connecting, listening, speaking, interruption, mute, unavailable/error, options and app-action dialog | Existing dawn illustration, lotus animation, and audio-state treatment with light-edge chrome, plum controls, and a darker end-session action. |
| Explore discovery | Root, category filters and search, Wellness Tools, Guided Techniques, technique detail, Toolkit, resource library and guide detail | Light reading panels, crisper covers, restrained scrims and more defined selection contrast. |
| Explore practices | Moments composer/preview/player, guided breathing, standalone breathing, Five Senses, Sleep Wind Down, reflection, feedback, environment picker, completion and save | Stronger player chrome, local treatment of scenic backgrounds, lavender controls, and readable timing and progress. |
| Explore programs and utilities | Guided Program library/detail/enrollment, Wellness Plan form/preview, Timed Practice builder/player, Ambient Sound Mixer, reflective check-in list/form/result, affirmations/challenge | Existing high-resolution artwork, edited header composition, clear control and progress states. |
| Journey | Root, time range, calendar and date detail, activity history, check-in/session/reflection detail, saved reflections and affirmations, Weekly Story, personal goal, milestones and celebration | Clear chart hierarchy, plum progress marks, identifiable calendar categories, white and lilac cards, sunset art protected from cream wash. |
| Habits | Today, My Habits, Insights, Garden, create/edit/detail, habit reminders, habit assistant, confirmation | Higher-contrast data displays, clearer selection and next action, Garden art shown at full strength. |
| Profile | Root, edit, Gentle Reminders and time picker, Habit Reminders, approved memories, Appearance & Preferences, Privacy & Data, export/delete confirmation, Human Support, About | Neutral cards, fine dividers, defined lavender control states, and crisp artwork staging. Safety and destructive controls retain their roles. |

## Contrast and platform boundaries

Measured solid-color contrast was 14.56:1 for main ink on the canvas, 5.76:1 for secondary ink on the raised surface, 8.57:1 for action ink on lavender, and 7.90:1 for a plum focus outline against white. The selected rail pair was 7.70:1. The fallback rail's inactive ink was 7.43:1 against its approximate composite over black. The three selected Journey calendar dots measured 4.12:1, 3.99:1, and 5.50:1. These are scoped color checks. Image contrast, native glass, and screen-reader behavior require their own evidence.

Native light and dark screenshots, the rendered web comparisons, executed tests, and the remaining platform checks are linked from the [verification record](VERIFICATION.md#light-mode-redesign).
