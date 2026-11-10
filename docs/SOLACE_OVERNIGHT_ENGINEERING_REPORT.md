# Solace overnight engineering report

## Starting point

Branch `main` started at `ac56553b6af4898af7fcda3d29beed2371965284`. The working tree already held substantial unstaged edits, deleted build artifacts, and untracked source and release files. The local checkpoint in [work/overnight-baseline-20261108-005109](../work/overnight-baseline-20261108-005109/) contains the starting HEAD, porcelain status, binary-capable working-tree patch, index patch, and a validated archive of untracked files. It uses Git's existing index and diff formats and leaves the branch, index, ignored environment files, and user data in place. Changes remain in the working tree for review because several fixes depend on pre-existing uncommitted source.

Reviewed the product and design sources, the full QA and test matrix, the visual sweep and its fixes, release readiness, and the prior performance report. The approved layout and artwork remain the visual baseline.

## Confirmed issues and fixes

| Area | Fault and repair | Regression evidence |
| --- | --- | --- |
| Account data refresh | Overlapping state reads could let an older result replace a newer snapshot. Responses are now ordered without overriding newer local writes. Invalid collection shapes fail before updating saved state. | Delayed refresh ordering and malformed nested snapshot fixtures. |
| Save acknowledgement | A successful HTTP status with a missing or mismatched record could be treated as saved or break the client. Record acknowledgement checks preserve retry identity and the protected writing queue. | Malformed and mismatched acknowledgement, offline reconciliation and account isolation fixtures. |
| Practice timing | A tab switch or notification can hide a retained practice without an OS background event. The display timer stopped, but the active clock could keep accruing time. Hiding the player now freezes it and returning requires Resume. | Retained player hide and resume fixture, existing clock, completion and Journey tests. |
| Realtime response validation | Invalid status could overwrite the last known conversation and reenter polling. Session ID, shape and revision checks now fail closed and end the known call while preserving valid history. A native mute exception also closes capture so the displayed mute state cannot misrepresent live audio. | Baseline fixture reproduced the wrong chat target and two polls. The new hook retained the correct target, used one poll and issued one End. Native mute failure and existing repeated End, late negotiation and background fixtures passed. |
| Realtime teardown on the API | A storage error while recording the hangup attempt could leave an active provider call open. The service attempts one best-effort hangup while retaining conservative usage accounting. | Forced SQLite write failure with a mocked active provider call. |
| Azure health endpoint | The deployment probe shared the general IP limit and could return 429 after that quota was exhausted. The no-store health route now bypasses that quota. General client throttling runs before JSON parsing, while endpoint-specific quotas stay in place. | Probe after exhausting a client's quota, plus existing configuration and startup tests. |
| API shutdown | Incomplete connections could hold the process open and cleanup errors could escape as rejected promises. Shutdown now handles errors explicitly, emits sanitized failure messages, and bounds the local drain to 35 seconds. | Compiled child-process shutdown, forced storage failure, stuck drain and restart fixtures. |
| Wellness-plan AI | A transient provider error could be retried after the originating session was revoked. The retry now rechecks authorization before resending inputs. | Revoked-session retry fixture with a mocked provider. |

## Performance work

- The app provider creates one writing vault instead of constructing a new unused vault on each render. The regression measured one vault through 20 extra provider renders.
- Habit detail skips the linked-session scan when the selected habit and day cannot use it. Eligible candidates are recomputed when the relevant saved records, day or timezone change, independently of typing in the progress field.
- Approved-memory source checks stop when they have selected the same existing limits of ten text/Moment or five Realtime entries. The selected context, model and personality are unchanged.
- The malformed Voice status fixture sent one status request before cleanup versus two on the checkpointed implementation. This fault-case count is separate from real voice latency.
- Reviewed retained-tab effects, memoized Explore filters, windowed chat history, lotus and breathing animation drivers, artwork use, and audio cleanup. No new physical-device frame, process memory or end-to-end latency measurement supports a broader speedup claim.

## Visual regression evidence

These screenshots were captured fresh from the starting release export in the in-app browser using an isolated, offline local API. The overnight implementation does not change their layout, artwork, color tokens or navigation rail. The screenshots cover a desktop-hosted 480 px mobile column and do not establish native keyboard, safe-area or accessibility behavior.

| Step | Observed result |
| --- | --- |
| 1. Today and bottom rail | The separate purple strip was absent in the inspected viewport. [Dark](../work/overnight/01-today-dark.png) and [light](../work/overnight/09-today-light.png). |
| 2. Reflect | The input and cards aligned in one column and both bottom actions stayed reachable. [Reflection](../work/overnight/02-reflection-dark.png). |
| 3. Explore filter and Wellness Tools | Breathe used illustrated results. Wellness Tools kept its black dark background and the accessible control list contained no Browse All Practices action. [Explore](../work/overnight/04-explore-breathe-dark.png) and [Wellness Tools](../work/overnight/05-wellness-tools-dark.png). |
| 4. Journey | Little milestones kept the compact card, lock markers and View all. [Journey](../work/overnight/06-journey-dark.png). |
| 5. Companion | A synthetic three-line draft stayed inside the composer. Reselecting Solace returned to the chooser. [Composer](../work/overnight/07-companion-multiline-dark.png). |
| 6. Garden | The empty-account garden showed its stage and backdrop with no visible artwork artifact in the captured view. [Garden](../work/overnight/08-garden-dark.png). |
| 7. Rebuilt candidate | Opened and closed the environment options, began a Moment, cancelled the exit confirmation and resumed, then deliberately left the test activity. A Calm check-in saved to the isolated API. Keyboard focus stayed on Continue while the milestone dialog was open, and Continue returned to the saved check-in. [Milestone dialog](../work/overnight/10-candidate-checkin-saved.png). |

## Verification

| Check | Result |
| --- | --- |
| App unit and component suites | 293 passed across the 14 package suites, plus 4 standalone Realtime native-permission mocks, for 297 total. The first tooling run could not complete its local socket smoke under the restricted runner. The loopback-enabled rerun passed all 18 tooling cases. |
| Backend integration and process suites | 154 passed, including schema and authorization checks, isolated export, plan retry, Realtime, and actual process restart and shutdown. Provider calls in these tests used fixtures. |
| TypeScript, formatting and whitespace | App and server TypeScript, Prettier and scoped diff checks passed. |
| Expo bundles | Web, Android and iOS release-mode exports passed. |
| Android release | ARM64 assembly and `lintVitalRelease` passed. The existing signer, 16 KB ZIP alignment, embedded Hermes bundle, WebRTC native library and production HTTPS configuration were verified. The ARM64 APK installed on the x86_64 emulator, but that emulator searched for the x86_64 React Native library. The archive contains `lib/arm64-v8a/libreactnative.so`; ARM64 phone launch remains unverified. [APK](../work/overnight/Solace-Android-Release-arm64.apk) and [package evidence](../work/overnight/artifact-check.json). |
| Android emulator | A separate x86_64 Release passed assembly and native lint, installed on an empty emulator, and cold-launched to the welcome screen. Android reported 4,165 ms for this one Activity launch. [Launch log](../work/overnight/android-x86-launch.log). |
| Signed iOS build | The iOS JavaScript bundle exported. The authorized Mac SSH endpoint was unreachable, so native compilation, signing and installation remain open for this revision. |

## Files changed in this pass

- App and persistence. `src/store.tsx`, `src/screens/Moments.tsx`, `src/screens/Habits.tsx`, `src/useRealtimeVoice.ts`, and `src/realtime-voice-state.ts`.
- Backend. `server/src/app.ts`, `server/src/index.ts`, `server/src/realtime.ts`, and `server/src/wellness-plan-ai.ts`.
- Tests. `scripts/test-session-state.cjs`, `scripts/test-navigation.cjs`, `scripts/test-voice.cjs`, and `server/tests/api.test.ts`, `realtime.test.ts`, `startup.test.ts`, and `wellness-plan-ai.test.ts`.
- Records. This report, `README.md`, `docs/VERIFICATION.md`, and `docs/REQUIREMENTS.md`. Local build, test, screenshot and checkpoint evidence is under `work/`.

## Security and production risks

Reviewed provider credentials, protected session and draft storage, account-owned routes and export, explicit AI memory consent, and rate/usage controls. The provider fixes preserve the existing bounded conversation context, model configuration and usage safeguards. No paid provider traffic, production load tests, infrastructure changes, schema changes, user-data deletion or rollout were performed.

SQLite still depends on a single API process and durable private storage. The app does not add its own database encryption. IP throttling and aggregate text-token accounting remain process-local. Azure's actual shutdown grace, warmup and storage configuration require separate verification before a backend rollout. The local 35-second deadline does not establish that Azure gives the process that long.

Native writing is debounced and only receives a best-effort checkpoint when the app backgrounds. Unsaved chat, plan and guided activity state can still be lost on process termination. Account-confirmed records and protected pending writing follow their existing recovery paths. Native force-quit recovery, system notification delivery and tap routing, real microphone and Bluetooth behavior, keyboard and safe-area layouts, large text, and screen readers remain separate acceptance checks.

## Release checklist

- [ ] Review the overnight changes against the checkpoint and keep the last healthy Azure and signed app artifacts for rollback.
- [ ] Install the exact signed candidate on physical Android and build/sign the matching iOS revision. Verify upgrade, cold start, session restoration and retained private data.
- [ ] Use disposable accounts for background reminder delivery and tap routing, JSON export, Journal recovery, a practice interrupted by navigation, and one controlled Live Voice interruption and cleanup check. Check light/dark, keyboard, larger text, TalkBack and VoiceOver.
- [ ] Before an authorized backend rollout, verify the health probe, shutdown grace, persistent volume and restore drill on staging. Confirm that rollback preserves the SQLite volume and existing signing identities.
- [ ] Record the final demo and sign off the release matrix before publishing.
