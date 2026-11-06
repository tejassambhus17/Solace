# Solace Google sign-in and biometric setup

**Status.** The hosted Google flow, identity verification, session issuance and account linking are implemented and covered by tests with synthetic signed tokens. Live Google sign-in still needs an owner-controlled Cloud project and reachable HTTPS API. A signed iOS build and physical Face ID or Touch ID testing still need a Mac and device. The web preview supports email/password and does not start Google mobile sign-in or biometric prompts.

## Project identifiers

| Setting                                           | Current source value        |
| ------------------------------------------------- | --------------------------- |
| Android application ID                            | `com.solacewellness.app`    |
| iOS bundle identifier                             | `com.solacewellness.app`    |
| Expo URL scheme                                   | `solace`                    |
| Return to the mobile app                          | `solace://google-auth`      |
| Google Web client callback path on the Solace API | `/api/auth/google/callback` |

`app.json` defines the identifiers and scheme. The local Android project uses the same package name. The app opens Solace’s HTTPS browser entry in the system browser. Solace’s server acts as the Google Web OAuth client, exchanges the authorization code with PKCE, verifies Google’s ID token and issues the usual Solace session. Google’s callback goes to the HTTPS API. On Android, the browser then shows **Open Solace**. On iOS, the browser session returns through `solace://google-auth`. The app-return URL contains only a one-time, two-minute browser proof. Redeeming it requires the separate proof retained by the original Solace app. It contains no Google token, Solace session token or account data.

## 1. Configure Google Auth Platform

1. Open the [Google Cloud project picker](https://console.cloud.google.com/projectselector2/home/dashboard). Select a project you control or choose **New Project**. Use a separate project for a production deployment and a separate test or staging project for development.
2. Open **Google Auth Platform → Branding** and choose **Get Started** if prompted. Set the app name to **Solace**, choose a monitored user-support email, enter an owner contact email and complete registration. In the **App domain** and **Authorized domains** sections, use the actual homepage, privacy policy and terms URLs and the domain you control. Complete domain and brand verification in the **Verification Center** when required for publishing.
3. Under **Audience**, choose **External** if people outside your Workspace organization need to sign in. Keep the development project in **Testing**. Select **Test users → Add users**, add the disposable Google accounts used for QA and save. **Internal** is suitable for a Workspace-only build whose testers belong to that organization.
4. Under **Data Access → Add or Remove Scopes**, use only `openid`, `https://www.googleapis.com/auth/userinfo.email` and `https://www.googleapis.com/auth/userinfo.profile`. The authorization request uses `openid email profile`. Solace reads the verified subject and email and uses the display name for new accounts. It does not request Gmail, Drive or background Google access.
5. Open **Google Auth Platform → Clients → Create client**. Choose **Web application** for the Solace HTTPS backend, enter a name that identifies the environment and add the exact callback URI under **Authorized redirect URIs**. The hosted server flow does not use Google’s JavaScript client, so leave **Authorized JavaScript origins** empty. Save the generated Web client ID and secret in your secret manager.

[Google Auth Platform setup](https://support.google.com/cloud/answer/15544987) · [Consent screen and test users](https://developers.google.com/workspace/guides/configure-oauth-consent) · [Manage OAuth clients](https://support.google.com/cloud/answer/15549257)

## 2. Set the exact HTTPS callback and environment variables

Choose the public, trusted HTTPS origin that serves the Solace API. Use this same origin for the mobile API and hosted OAuth browser entry. The callback URI is that origin plus `/api/auth/google/callback`. To generate the exact string on Windows, run this in PowerShell and enter your actual deployed origin when prompted.

```powershell
$solaceApiOrigin = [Uri](Read-Host 'Solace API HTTPS origin')
if ($solaceApiOrigin.Scheme -ne 'https' -or $solaceApiOrigin.AbsolutePath -ne '/' -or $solaceApiOrigin.Query -or $solaceApiOrigin.Fragment -or $solaceApiOrigin.UserInfo) {
  throw 'Enter the HTTPS origin without a path, query, fragment or credentials.'
}
$solaceApiBase = $solaceApiOrigin.GetLeftPart([UriPartial]::Authority)
$solaceGoogleCallback = "$solaceApiBase/api/auth/google/callback"
$solaceApiBase
$solaceGoogleCallback
```

Paste the printed callback URI into the Google **Authorized redirect URIs** and into `GOOGLE_OAUTH_REDIRECT_URI`. Use the issued values for the remaining backend variables.

| Location                                   | Variable                     | Value                                                                                                               |
| ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `server/.env` or server secret environment | `GOOGLE_OAUTH_CLIENT_ID`     | The Web application client ID issued in step 1. This is also the only Google token audience accepted by the server. |
| `server/.env` or server secret environment | `GOOGLE_OAUTH_CLIENT_SECRET` | The matching Web application client secret.                                                                         |
| `server/.env` or server secret environment | `GOOGLE_OAUTH_REDIRECT_URI`  | The exact callback URI printed above.                                                                               |
| Root `.env` or app build environment       | `EXPO_PUBLIC_API_URL`        | The HTTPS API origin printed by `$solaceApiBase`, without `/api`. This address is public.                           |

Restart the API after changing its variables. Reload the Expo development bundle after changing `EXPO_PUBLIC_API_URL` and rebuild installed release binaries. Check `GET /api/auth/google/config` on the deployed API before opening the app.

```powershell
Invoke-RestMethod "$solaceApiBase/api/auth/google/config"
```

An `enabled` value of `true` confirms that the three server values pass local configuration checks. Live authorization is a separate test. An `enabled` value of `false` leaves email/password sign-in available. Put neither OAuth secrets nor SMTP credentials in `EXPO_PUBLIC_*` variables. The Google Cloud OAuth secret and Gemini API key are separate credentials.

**Development.** Use a reachable HTTPS staging API and its test Web client for Google. Local HTTP or emulator loopback still works for email/password and backend fixture tests. A browser on the phone needs to reach the registered HTTPS origin itself.

**Release.** Use the production HTTPS API origin and the Web client from the corresponding production project. Keep hosted authorization and the Google callback on the same running API instance. In-progress flows expire after ten minutes and restart if the API process restarts. Keep the callback query, hosted browser-entry path, Cookie, Set-Cookie, Location and Authorization headers, and completion request body out of access logs and monitoring. Configure reverse proxies and tracing tools as well as application logs. [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies) · [OpenID Connect server flow](https://developers.google.com/identity/openid-connect/openid-connect)

## 3. Android and iOS OAuth registrations for native SDK integrations

Google’s client-registration policy distinguishes a Web server client from platform-specific native clients. In this build, the Android and iOS binaries open the hosted Solace browser entry, and the HTTPS backend owns the Google OAuth exchange. If registering native clients for your Google project or moving to a direct native Google SDK, follow the platform steps below. The current browser flow has no Android or iOS client ID variable. Keep the backend’s Web client ID and secret in the server configuration above. Confirm any platform registration requirements for the distribution route with Google before publishing. [Google’s client registration policy](https://developers.google.com/identity/protocols/oauth2/policies#register-an-appropriate-oauth-client)

### Android package and signing SHA-1

In **Clients → Create client → Android**, use package name `com.solacewellness.app` and the SHA-1 of the certificate that signs the specific installed build. A separate Android registration is needed for each distinct package and signing certificate combination that a direct native integration uses. A QA flavor with a different application ID uses its own actual package name.

From the repository root on Windows, get the Gradle signing report.

```powershell
Push-Location android
try { .\gradlew.bat :app:signingReport } finally { Pop-Location }
```

On macOS or Linux, run `(cd android && ./gradlew :app:signingReport)`. Copy the `SHA1` line for the relevant variant and confirm its keystore. The current repository’s local `release` variant uses debug signing. For a distributed release use the actual distribution certificate, either from the signed APK or from Play App Signing. Keep the keystore and its passwords private.

To verify the signer of an actual APK on Windows, build or obtain the APK first, then run the following from the repository root. Set `$solaceApk` to the path of the artifact you will install.

```powershell
$solaceSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$solaceApkSigner = Get-ChildItem (Join-Path $solaceSdk 'build-tools') -Filter 'apksigner.bat' -File -Recurse |
  Sort-Object { [version]($_.Directory.Name -replace '-.*$', '') } -Descending |
  Select-Object -First 1
$solaceApk = (Resolve-Path 'android/app/build/outputs/apk/release/app-release.apk').Path
& $solaceApkSigner.FullName verify --print-certs $solaceApk
```

Use the `certificate SHA-1 digest` of the APK signer. For Play-distributed builds, open **Play Console → App integrity → App signing** and copy the SHA-1 under **App signing key certificate**. The upload certificate signs the artifact sent to Play. The app signing key certificate identifies the build Play installs. [Google SHA-1 instructions](https://developers.google.com/android/guides/client-auth) · [Android apksigner](https://developer.android.com/tools/apksigner)

### iOS bundle ID and URL scheme

In **Clients → Create client → iOS**, enter `com.solacewellness.app`. Use the actual Apple Team ID and App Store ID if applicable and requested. In Xcode, the **Solace** target’s **Signing & Capabilities** shows the selected signing team. The **General** identity or `PRODUCT_BUNDLE_IDENTIFIER` build setting shows the actual bundle identifier for the configuration you are building.

The hosted browser flow uses only the `solace` app scheme already set in `app.json`. Confirm `CFBundleURLTypes` contains `solace` in the built iOS app’s Info.plist. A future direct Google iOS SDK integration would also use the **iOS URL scheme** displayed by its iOS OAuth client in Google Cloud and set `GIDClientID` to that iOS client ID. Google provides the reversed scheme for the specific client. [Google iOS client and URL scheme](https://developers.google.com/identity/sign-in/ios/start-integrating)

## 4. Rebuild and test the mobile binaries

Use a supported Node runtime, then run `npm run setup` from the repository root to install both lockfiles. Configure the API origin before building. The build includes Expo’s system browser, secure storage and local authentication native modules. Use an installed Solace build so those modules and `solace` deep links are available.

**Android development.** With Android SDK and Java installed, connect a test phone or boot an emulator, then run `node scripts/runtime.cjs expo run:android --device`. On a phone, enable USB debugging and accept the USB connection prompt. The checked-in manifest includes `android.permission.USE_BIOMETRIC`. The Expo config carries the permission for generated Android builds.

**Android release-style smoke.** From the root, set `EXPO_PUBLIC_API_URL` in `.env` or the shell environment. Run `cd android` and `./gradlew :app:assembleRelease :app:lintVitalRelease` on macOS/Linux or `.\gradlew.bat :app:assembleRelease :app:lintVitalRelease` in PowerShell. The APK is under `android/app/build/outputs/apk/release/`. Verify its signer before installing. A local debug-signed release-style APK is for QA. Use the production signing configuration for distributed release builds. [Expo local native builds](https://docs.expo.dev/guides/local-app-development/) · [Android signing](https://developer.android.com/studio/publish/app-signing)

**iOS on a Mac.** When `ios/` is absent, run `node scripts/runtime.cjs expo prebuild --platform ios` from the root. On an existing locally managed Xcode project, preserve the signing settings and apply the native config changes before rebuilding. The SecureStore and Local Authentication config plugins set `NSFaceIDUsageDescription` for generated projects. Verify that description and the `solace` URL type in the target’s Info.plist. Open the generated `.xcworkspace`, select the Solace target and keep its existing Personal Team and signing settings for local development. Pair the iPhone, enable Developer Mode and run `npm run ios -- --device` or build to the paired phone in Xcode. For a local release-style check, run `npm run ios -- --configuration Release --device`. For TestFlight or App Store builds, use your distribution signing team and **Product → Archive** in Xcode. [Expo iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/) · [Expo Local Authentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)

Before App Store submission, review Apple’s separate login-services requirement. An app that uses a third-party login for its primary account may need an equivalent privacy-preserving login option under guideline 4.8. [Apple App Review guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)

## 5. Run live Google and device QA

Use disposable accounts and synthetic private entries.

1. On Android, open **Continue with Google** from Login and Signup, select a Google test account in the browser, then tap **Open Solace**. On iOS, repeat and confirm the system authentication session returns to Solace. Cancel once and check that you stay signed out.
2. Complete sign-in, save a private Journal entry, close and reopen the app, and verify the same account and entry. Sign out, sign in again with Google and verify the same data. Use a second Google test account to verify it sees its own data.
3. Create an email/password account whose email matches a test Google account. Try Google sign-in before linking. Sign in with the password, open **Profile → Edit Profile**, and use **Link Google account**. Sign out and sign back in with Google. Confirm the original account and records remain. Try linking that same Google account to a different Solace account and confirm the conflict is rejected.
4. Under **Profile → Appearance & preferences → Biometric Lock**, verify activation requires supported enrolled biometrics. Enable **Lock Solace**. Try **Immediately**, **After 1 minute** and **After 5 minutes**, check short and long background trips, then force-close and reopen. Test failed and cancelled prompts and confirm protected content remains hidden. Try recovery with **Sign in again instead** and your normal sign-in. Read the confirmation about clearing device-only unsynced writing before signing out.
5. Enable **Lock My Journal** separately. Open it from Solace and from a saved Journal entry in Journey. Confirm Journal content requires unlock and the rest of the app remains available when only Journal lock is enabled. Change the enrolled biometric set on the test device and confirm the old proof requires recovery and new setup. Test unsupported or unenrolled conditions on a separate device or emulator.
6. Repeat startup and sign-in from the installed release-style build with Metro stopped and the app pointed at the configured HTTPS test API. Record device, OS version, signing variant and observed results without capturing credentials, prompts containing email addresses or private entries.

Biometric confirmation releases an account-bound proof from the device Keychain or Keystore and unlocks the existing Solace session. For enrolment changes or an unavailable prompt, Solace’s supported recovery path is normal sign-in. Device credential behavior depends on the system prompt and the protected biometric key. A device credential should not be assumed to release a key invalidated by an enrollment change.

## Optional email password recovery

For password-based accounts, **Forgot password?** can send a short-lived reset code through an authenticated SMTP server you control. In `server/.env` or the server secret environment, set `SMTP_HOST`, `SMTP_PORT` (defaults to `587`), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` (the provider-authorized sender address). Port `465` uses implicit TLS. Other ports require STARTTLS. Restart the API, request a code from a disposable password-based account, verify delivery and confirm that the new password works and the old one fails. Without SMTP configuration, recovery reports unavailable and normal login still works. Live SMTP delivery has not been verified.

## Troubleshooting

| Symptom                                    | What to check                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google sign-in unavailable                 | Check `/api/auth/google/config`, restart the server after editing its private environment and confirm the app points to that same HTTPS API origin.                                                                                              |
| `redirect_uri_mismatch`                    | Compare `GOOGLE_OAUTH_REDIRECT_URI` byte for byte with the Web client’s authorized redirect, including scheme, hostname, port and `/api/auth/google/callback`.                                                                                   |
| `invalid_client` or token exchange failure | Confirm the client ID and secret are from the same Web client and the intended Cloud project. Check the server can reach Google’s token and key endpoints.                                                                                       |
| Access blocked or tester denied            | Check the selected Cloud project, Audience and allowed test accounts. Choose the approved test account in the Google picker. A Workspace administrator can also restrict OAuth apps.                                                             |
| Browser does not reopen Solace             | On Android tap **Open Solace**. Check that the installed Solace binary registers `solace`, that a different build is not taking the scheme, and that the browser has not been replaced by a WebView. On iOS check the built Info.plist URL type. |
| Flow expired or invalid                    | Start again in the app. Verify the callback reached the same API process that created the flow. During account linking, keep the originating Solace session signed in.                                                                           |
| Email already in use                       | Sign in to the existing Solace account and link Google from **Edit Profile**. A matching email is insufficient to join accounts.                                                                                                                 |
| Biometric setup unavailable                | Confirm the device has an enrolled supported fingerprint or Face ID/Touch ID and that the installed binary contains the native modules and permission configuration. A newer enrollment may require sign-in and setup again.                     |
