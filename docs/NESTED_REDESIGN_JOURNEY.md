# Journey and Habits redesign

The Journey root and its routes were the starting point for the nested design pass. Browser captures used disposable accounts on the local API in Chrome at 390 × 844 dark and 320 × 667 light. The before bundle is the prior accepted four-tab export. Both runs use the same fixtures and screen sizes.

| Screen or route | Design changes |
|---|---|
| Weekly story · `reflection` with a week | Scenic cover, actual dated mood check-ins, and a ruled ledger for the existing weekly totals. Goal and helpfulness details appear when the account has them. |
| Journey archive · `journey-activity` | Scenic period cover, saved-entry count, dated groups, and ruled activity rows with distinct record types. Existing filters and list restoration carry into the new layout. |
| Mood record · `journey-checkin` | Mood petal and saved date lead the record. Notes, tags, and sync status are visually distinct. |
| Milestones · `journey-milestones` | Earned and upcoming groups, a dedicated award detail, and a separate optional streak preference. |
| Personal goal · `journey-goal` | Compact botanical introduction, ruled editing fields, a readable progress view, and a separate management area. |
| Habits · Today | A dated completion meter and the existing due and flexible habit actions. Create sits in the header on a populated account. |
| Habits · My Habits | Equal filter targets, a ruled habit list, and each habit’s actual weekly measure. |
| Habits · Insights | Centered Week and Month controls, a linear goal-completion summary, and a chart aligned to the week. Narrow monthly views use four equal date columns with weekday labels. |
| Habits · Garden | Stage artwork with the earned stage and progress, followed by a vertical path with real completion thresholds. |
| Habit detail, create, and edit | Botanical introductions, readable status and schedule, and distinct sections for progress, identity, goals, recurrence, and reminders. |
| Habit reminder list and editor | The list opens each saved habit. The editor separates saved time and recurrence from delivery controls and keeps the existing permission and save behavior. |

Before captures are in [`work/nested-redesign-journey/before`](../work/nested-redesign-journey/before/screens.json). After captures use the same names without the `before-` prefix in [`work/nested-redesign-journey/after`](../work/nested-redesign-journey/after/screens.json).

The final exported bundle passed all 16 paired browser scenarios with zero runtime exceptions. The fixture opened the weekly story and its actual mood data, moved from the archive to a saved mood and back, opened the earned milestone, saved/paused/resumed/removed a personal goal, and reached all four Habits sections. It also opened habit creation and edit, switched Insights to Month, traversed habit details and reminder editing, and saved a different time in each theme.

- Weekly story [before](../work/nested-redesign-journey/before/before-390-dark-weekly.png) and [after](../work/nested-redesign-journey/after/390-dark-weekly.png).
- Activity archive [before](../work/nested-redesign-journey/before/before-390-dark-archive.png) and [after](../work/nested-redesign-journey/after/390-dark-archive.png).
- Habits Garden [before](../work/nested-redesign-journey/before/before-390-dark-habit-garden.png) and [after](../work/nested-redesign-journey/after/390-dark-habit-garden.png).
- Habit reminder [before](../work/nested-redesign-journey/before/before-320-light-habit-reminder-saved.png) and [after](../work/nested-redesign-journey/after/320-light-habit-reminder-saved.png).

Client typecheck, Prettier, the 25 progress tests, and the 87 session-state tests passed. Browser reminder editing verifies saved preferences and screen behavior. Native scheduling and notification delivery require a device run.
