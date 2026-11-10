# Solace visual and functional sweep

This report preserves the original findings. The implementation and retest results are recorded in [Visual sweep fixes](VERIFICATION.md#visual-sweep-fixes).

## Scope

Fresh production-mode web export in the in-app browser at 320 and 360 CSS px, across light and dark themes. The local API used an in-memory database and synthetic accounts. The audit recorded 93 accessibility snapshots and 88 nonblank screenshot captures, including repeated states, detail pages, and before/after reproductions. The source review traced 44 directly invoked destinations against 60 registered routes. No dangling direct route name or live entry into the retired Explore catalog was found. See the [route inventory](QA_SCREEN_INVENTORY.md) for the full route map.

**Release finding.** Fix and retest the completed-practice loss before release. Background reminder delivery and tap routing remain the previously open physical-device gate. The user-reported native checks from the earlier pass are unchanged.

## Confirmed in the rendered app

| Priority | Screen | Finding and reproduction | Evidence |
| --- | --- | --- | --- |
| P1 | Explore → Wellness Tools → Five-Senses Exercise → Feedback | Complete the practice, then press the header Back button on “You took a moment.” Solace returns to the grounding start screen and the completed activity is absent from Journey. Feedback is described as optional, but the activity is first written by “Save and continue.” Classic breathing uses the same deferred save path, confirmed in source. | [Completed practice](../work/visual-sweep/53-grounding-feedback-dark.png), [return](../work/visual-sweep/54-grounding-back-without-save.png), [unchanged history](../work/visual-sweep/55-journey-grounding-not-recorded.png), [save path](../src/screens/Wellness.tsx#L1755) |
| P2 | Explore → Healthy Habit Builder → Create habit | Enter a habit name, press the header Back button, then reopen the form. The name is gone and no discard prompt appeared. The shell applies the unsaved-edit guard to active-tab reselection, while ordinary Back bypasses it. Journey Goal, Profile edits and Wellness Plan use the same guard pattern. Those additional flows were traced in source. | [Filled form](../work/visual-sweep/29-habit-draft-before-back.png), [tab guard](../App.tsx#L299), [form Back](../src/screens/HabitsEditor.tsx#L385) |
| P2 | Today → Explore More → See All | First select Breathe in Explore. Switch to Today and tap See All. Explore opens with Breathe still selected and only four results. The action reuses the retained tab with its filters. | [Result after tapping See All](../work/visual-sweep/62-see-all-still-breathe-light.png), [entry action](../src/screens/Discover.tsx#L847) |
| P2 | Solace → Journal → New Journal Entry | Add valid writing and one 81-character tag. The tag chip spills beyond the form and its remove icon is clipped at 320 CSS px. Save returns “Please check the information you entered,” with no hint that a tag exceeds the limit. The validator also rejects 31 unique tags. | [Overflow and generic error](../work/visual-sweep/77-journal-tag-validation-light.png), [editor](../src/screens/Journal.tsx#L1019), [validation](../server/src/validation.ts#L78) |
| P2 | Explore → category radios on web | With Breathe focused, Space and Arrow Right leave All selected. Enter selects Breathe. The same radio construction is used by Techniques, Wellness Tools and Timed Practice. The keyboard repro was performed in Explore. | [Keyboard result](../work/visual-sweep/keyboard-radio.json), [control](../src/screens/Explore.tsx#L779) |

## Confirmed in isolated component tests or source

| Priority | Screen | Finding and verification boundary | Evidence |
| --- | --- | --- | --- |
| P2 | Profile → Gentle reminders | With an enabled reminder and denied Android notification permission, the actual scheduler creates no local notification, but Profile still says **On**. Reproduced with the scheduler and Profile component under native mocks. Physical delivery remains unverified. | [Badge logic](../src/screens/ProfileHome.tsx#L71), [permission branch](../src/notifications.ts#L253) |
| P2 | Companion → Live Voice | Back or End on a new call with no conversation ID can leave the screen open until the End request resolves or reaches its 15-second timeout. An isolated component test reproduced the wait and showed that a second Back has no effect. An existing conversation exits immediately. | [Exit handler](../src/screens/VoiceTalk.tsx#L103), [request timeout](../src/store.tsx#L463) |
| P2 | Profile → Privacy & data → account deletion | Source shows reminders cancelled before the account deletion request. If deletion fails and the session stays active, the restoration effect does not rerun. The device consequence was not reproduced on a phone. | [Deletion order](../src/screens/Profile.tsx#L1675), [schedule restore](../App.tsx#L386) |
| P2 | Profile → Privacy & data → export | The page says “Download a copy.” The web path makes a JSON file, while native passes the JSON as text to the share sheet. Android's implementation uses a text share without an attachment. Large exports and available share destinations were not exercised on a phone. | [Export implementation](../src/screens/Profile.tsx#L1568), [screen](../work/visual-sweep/71-privacy-light.png) |
| P2 | Android Today and tab rail | Source confirms width-based text scaling caps for Today’s five mood labels and Android tab captions. Around 320 dp these labels can stay close to base size even if the OS is set substantially larger. This needs a native large-text visual check. | [Mood labels](../src/screens/Discover.tsx#L169), [tab labels](../src/Navigation.tsx#L180) |
| P3 | Profile → test reminder | “Send a test in 10 seconds” is more precise than Android can guarantee when exact alarms are unavailable. The installed Expo scheduler can schedule an inexact alarm. This does not establish missed delivery. | [Action label](../src/screens/Profile.tsx#L1228), [test schedule](../src/notifications.ts#L315) |

## Visual polish

| Priority | Screen | Finding | Evidence |
| --- | --- | --- | --- |
| P3 | Guided Techniques → Box breathing | A roughly 140 CSS px gap separates the instructions card from the Start practice button at the audited viewport. The button works, but it feels disconnected from the preceding content. The duration and timed-mode badges also use similar clock symbols. | [Technique detail](../work/visual-sweep/11-technique-detail-dark.png) |
| P3 | Journal | The library/editor uses a bare back chevron while entry detail and AI reflection use an outlined circular Back control. The actions are present and work. | [Library](../work/visual-sweep/46-journal-dark.png), [detail](../work/visual-sweep/47-journal-entry-dark.png) |
| P3 | Journey calendar | The outer weekday labels sit about 4 rendered px farther out than their corresponding date centers. The center aligns. This is a small alignment difference, and the date buttons remain correctly labeled. | [Calendar](../work/visual-sweep/02-journey-dark.png) |
| P3 | Explore in light mode | The selected category relies mainly on a lavender tint. The selected/unselected fills measure about 1.17:1 against one another. This compares the fills, not text contrast or formal accessibility conformance. | [Category pills](../work/visual-sweep/60-explore-light.png) |
| P3 | Profile → Habit reminders | The empty screen repeats “Habit reminders” and “Gentle reminders” in succession, then shows a mostly plain text block. The View your habits action is present. Enabled switches in the web reminder editor also show a bright default teal thumb against the Solace track. | [Empty state](../work/visual-sweep/34-habit-reminders-dark.png), [switch](../work/visual-sweep/33-reminders-dark.png) |
| P3 | Today → Guided Programs | The shortcut describes three-day plans, but Mindful Mornings is four days. | [Programs list](../work/visual-sweep/23-programs-dark.png), [shortcut copy](../src/explore-practices.ts#L177) |

## Coverage and boundaries

1. **Welcome and account entry.** Welcome, login, signup, recovery and Back rendered. Google was disabled by the local preview, so this sweep provides no new Google sign-in evidence.
2. **Today.** Main cards, mood check-in, reflection and reminder entry points rendered. See All reproduced the filter bug.
3. **Solace.** Companion, menu, history, saved chat, Journal library, entry, editor, AI sharing screen and Live Voice connecting view rendered. Journal tag and Live Voice exit findings are scoped above. No paid provider call was made in this sweep.
4. **Explore.** Featured and filtered views, techniques and player, Wellness Tools, timed builder and player, wellness plan, guided programs, saved toolkit, habits and Garden rendered. Grounding completion loss reproduced. No blanket missing borders or missing Back controls were found in the inspected views.
5. **Journey.** Overview, empty state, history, activity detail, goal, milestones, weekly story and saved lists rendered. Calendar alignment is minor. The completion persistence failure belongs to the feedback exit flow.
6. **Profile.** Account, reminders, habit reminders, memory, preferences, privacy, support and About rendered. Permission-denied and data export findings have the component or source evidence indicated above.

Fresh targeted tests passed for navigation (22), reminders (11), Journey progress (22), voice (30), native configuration (13), and the native microphone permission fixture (4). Those checks do not certify native rendering, assistive technology, physical delivery or hardware Back. Source-only variants and selected error paths were not all opened in the browser. Eight blank browser captures were excluded as evidence because their accessibility snapshots showed populated pages. Product code was not changed.
