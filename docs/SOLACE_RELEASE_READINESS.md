# Solace release readiness

**NOT READY FOR RELEASE**

The candidate passed local automated and browser checks plus the bounded Azure provider smoke. The user reported checking four native gates. Native background reminder delivery and tap routing remain open.

The [subsequent visual sweep fixes](VERIFICATION.md#visual-sweep-fixes) include the classic-practice completion blocker, ordinary Back protection, and reminder permission and account-exit handling. The grounding blocker passed its local retest. Earlier device evidence applies to the build tested at that time. The updated candidate still needs the affected native reminder, navigation, large-text and JSON export checks.

| Measure | Result |
| --- | --- |
| Confirmed P0 | 0 in tested paths |
| Confirmed P1 | 1 found, 1 fixed and retested locally, 0 open in tested paths |
| Confirmed P2 | 0 filed in tested paths |
| Confirmed P3 | 0 app defects filed. Test harness corrections tracked separately |
| Critical pass rate | 15 of 16 gates checked (93.75%). This includes 11 QA passes and four user-reported device passes. [Gate list](SOLACE_QA_TEST_MATRIX.md) |
| Live backend | Azure HTTPS, disposable login, live text, one Realtime WebRTC turn, transcript persistence, hangup and token revocation passed |
| Android | Signed arm64 Release passed lint and package checks. The user reported physical installation and launch, sign-in and biometrics, Live Voice, and navigation and keyboard checks. [APK](../work/full-qa/Solace-Android-Release-arm64.apk) |
| iOS | Final Expo bundle exported. Native coverage for the four checked gates is user-reported |
| Rollback readiness | Prior signed Android artifact retained. Production API was not changed. Signed iOS rollback installation and database-restore drill were not exercised |

## Candidate release notes

- Live Voice can recover from a single short status request outage without starting a new call. Further failure or a terminal session state closes the active call through existing cleanup.
- The eight previous visual fixes were rechecked against fresh browser renders and navigation fixtures. Physical safe areas and keyboard rendering remain release gates.
- No schema migration, credential change, identifier change, or backend rollout is required for this client fix.

## Remaining gate

On Android and iPhone, schedule a reminder with a disposable account, background the app, confirm the notification fires, and tap it. Verify that it opens the intended Today or Habit Details screen. Review the platform evidence and sign off before publishing.

## Rollback

- Retain the [prior signed Android artifact](../outputs/Solace-Android-Azure-arm64.apk) and its signing identity. If replacing a published build, rebuild the known prior source with a higher version code using the same signing identity. Verify upgrade and retained data on a disposable account before distribution. Avoid uninstalling the app or clearing its data as a rollback technique.
- For iOS, retain the last approved signed artifact or rebuild that source with compatible provisioning and the required build number. Verify the prior binary installs and the session can be restored before rollout.
- The API remained on its current deployment. If a later backend rollout is needed, retain the last known healthy artifact and test restoration using an isolated copy of persistent storage. Do not overwrite live SQLite from a backup without an approved recovery decision and a verified backup.
