# Feature comparison and release priorities

Reviewed 5 November 2026 against the original 11-page hackathon brief, approved design sheets, current application source, and local checks. Implemented means present in source; verified means an actual check recorded in VERIFICATION.md.

## Existing experience retained and refined

| Journey | Current implementation | Work in this pass |
|---|---|---|
| Start your space | Welcome, signup, login, secure sessions | More faithful botanical layout, explicit AI role, form labels, password visibility, session-load recovery; removed upper-right profile shortcut |
| Daily arrival | Greeting, check-in, featured activity, affirmation, tools | Time-aware greeting, same-day saved mood, organic mood stones, dedicated light/dark artwork; no duplicate profile control |
| Talk and act | Saved conversations, history, breathing/journal actions | Fixed composer, draft continuity, visible provider mode, activity metadata retained, latest-active history order |
| Reflect and return | Three reflective assessments, journal, breathing, optional feedback | Consistent type/spacing, selected semantics and larger controls; browser timer-to-feedback-to-conversation checked |
| Learn and practice | Five resource categories, sleep tools, plan, affirmations, challenge | More consistent headers and interaction states; saved resource progress can be cleared |
| See participation | Mood week, moments, reflections, factual XP/streak/milestones | Theme-consistent mood stones, improved empty state, compact visual hierarchy |
| Control your space | Profile, themes, optional memories, reminders, export/deletion | Botanical profile, clearer settings, reminder edits preserve scheduling coordination, external-link errors |

## Must finish before submission

| Priority | Gap | Concrete completion evidence |
|---|---|---|
| P0 | Real AI is unconfigured | Configure provider privately in server/.env; exercise contextual multi-turn replies, consent behavior, errors and activity suggestions against the actual provider |
| P0 | No public HTTPS API | Deploy the server with a persistent database disk, production origins/proxy configuration and HTTPS; verify account-scoped persistence after restart |
| P0 | No usable final phone build | Build a fresh installable APK against that HTTPS URL; fresh-install and test the exact artifact on a physical Android phone |
| P0 | Reminder delivery unverified | On that build, test permission denial, edits, foreground/background/closed delivery, logout cleanup and destination taps |
| P0 | Final demo missing | Record the final installed build, showing check-in → conversation → suggested activity → feedback → Journey, plus history and controls |
| P1 | Native UX evidence incomplete | Check keyboard, safe areas, Android Back, reduced motion, large text, system theme, interruptions and offline recovery on device |

The existing `outputs/solace-build-validation.apk` remains a compilation artifact with the development emulator endpoint. It has not been replaced or relabeled as a functional release. Prior decisions to defer hosting/provider configuration remain respected.

## Optional enhancements after those gates

- Expand real AI action routing beyond breathing and reflection to plans, affirmations and challenges, with explicit structured actions and tests.
- Add consent-controlled assessment context when it is useful and clearly explained.
- Consider restrained native haptic feedback after physical-device evaluation.
- Password reset needs real email delivery and recovery verification before a reset control can claim success. OAuth, remote push and social feeds are not implemented.

Home affirmations, the featured reset and resource content are curated, not dynamically generated AI recommendations. Voice, widgets, therapist booking and a social network are not established requirements. The brief's isolated “follow, post, message” line still needs organizer clarification.

## Follow-up improvements

The subsequent user-requested pass replaces the dark palette with true black/neutral charcoal, adds title/message search, inline conversation renaming and a latest-conversation resume entry. Check-in/journal/feedback drafts stay account-scoped in memory; session expiry supports same-account resumption. Concurrency fixes cover renamed chats during pending replies, stale credentials/snapshots and late reminder work after logout. These additions improve continuity and recovery, without changing the external release gates above.

## Added in the dark-artwork pass

- Account-persistent saved toolkit for known resources, breathing, reflection and grounding, including idempotent retry behavior and full export/deletion/isolation coverage.
- Optional five-senses grounding connected to feedback and Journey, with accessible alternatives, skipped-sense handling and honest incomplete-session counts.
- Seven-day factual review with a weekly reflection prompt, based entirely on stored records rather than invented AI insight.
- Three new production dark assets, cached history search data, bounded initial row rendering, fewer timer display renders and reader-aware chat scrolling.

These do not replace the existing live-provider/HTTPS/final-APK/device/demo gates. Full state snapshots and a single-replica SQLite adapter remain scaling limits; this pass does not claim native performance benchmarks or full offline persistence.

## Latest simplicity and native-material pass

Implemented the recommended curated daily pause and protected writing, then separated discovery into Explore under the user's explicit new-tab authorization. Today now offers one next step; Journey hides optional milestones until expanded. Added private profile photos with image validation, metadata stripping and account isolation. The black base now has restrained lilac/peach/sage semantic activity surfaces. Navigation uses guarded native Liquid Glass on supported iOS, native blur/opaque accessibility fallbacks and an Android tonal indicator/ripple treatment.

Native draft protection uses debounced SecureStore writes and a bounded retry queue; actual device force-quit/restore and keychain behavior still require verification. Web is intentionally memory-only. A cold offline launch still needs successful API session restoration before the private vault opens; this is protected writing during an authenticated session, not a complete offline account cache. Chat is not offline-queued.

The external release gates above remain. New native libraries require a rebuilt app. Native iOS glass, accessibility, photo permissions/cropping, large text, Android keyboard/gestures, reminders and final performance must be checked on installed hardware.
