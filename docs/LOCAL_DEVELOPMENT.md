# Local backend and iOS simulator repair

The reported `server/node_modules/tsx/dist/cli.mjs` error means the development server cannot load its TypeScript runner. `tsx` is a dependency of the separate server package. Installing only the root package, copying Windows node_modules to a Mac, or installing the server with development dependencies omitted can produce this failure. A blank EXPO_PUBLIC_API_URL was not itself the cause: development builds have platform-specific local defaults.

## Install on the Mac

Run from the actual repository on that Mac:

```sh
cd /Users/tejas/Downloads/Solace
node --version
npm run setup
npm run doctor
```

`setup` performs lockfile-based npm installs for both the app and server, including development and platform-optional packages, then builds the server. It does not overwrite existing environment files or database records. Both package-lock.json files belong in the repository; node_modules directories do not.

The project records Node 24 in `.nvmrc` as the tested baseline. If nvm is already available, `nvm install` and `nvm use` select it. Node 26.13.0 is also an LTS release and is accepted by the installed Expo/React Native engines; the missing tsx file alone is not evidence of a Node 26 incompatibility. See [Node releases](https://nodejs.org/en/about/previous-releases). Do not replace system Node or upgrade/downgrade packages merely to hide a missing install.

## Start the API and app separately

Terminal 1:

```sh
cd /Users/tejas/Downloads/Solace
npm run server
```

Wait for the API-ready message. Terminal 2:

```sh
cd /Users/tejas/Downloads/Solace
curl --fail http://127.0.0.1:3001/api/health
EXPO_PUBLIC_API_URL=http://127.0.0.1:3001 npm run start -- --clear --localhost
```

Open or fully reload the existing Debug app in the simulator. The inline public URL applies to that Expo process and contains no credential. A simulator on the same Mac can use 127.0.0.1. A physical iPhone or remotely hosted simulator needs an address reachable from that device; its own loopback address is not the Mac.

For normal joint development, `npm run dev` supervises the API and Expo together; it must establish readiness from its own child process before opening Metro. Use separate terminals above when isolating a backend failure. `npm run ios` runs Expo's native iOS Debug build command and requires the Mac/Xcode/CocoaPods environment; it has not been run from Windows.

For a persistent setting, edit only EXPO_PUBLIC_API_URL in the root .env/.env.local. Keep the base URL without a trailing /api. Expo public values are embedded in the client bundle and require a full app reload after changes; installed Release binaries require a rebuild. [Expo environment documentation](https://docs.expo.dev/guides/environment-variables/).

## Configuration boundaries

- Root public configuration: EXPO_PUBLIC_API_URL. Keep provider credentials out of this file and all EXPO_PUBLIC variables.
- Private server configuration: server/.env or server process environment. PORT defaults to 3001 and HOST to 0.0.0.0. Relative DATABASE_PATH values resolve from server/, and the default database is server/data/solace.sqlite.
- Authentication works without an AI provider key. Built-in companion replies remain explicitly labeled. Real AI is a separate check after privately configuring the provider key in server/.env.
- `AI_MODE=live` requires `OPENAI_API_KEY`. OpenAI serves text and audio through the Node API. See the [OpenAI setup guide](OPENAI_MIGRATION.md) for model IDs and verification.
- Development defaults: iOS simulator 127.0.0.1:3001, Android emulator 10.0.2.2:3001, web browser hostname on port 3001. Explicit public configuration takes precedence. If the server port changes, configure the matching public URL too.
- Release builds require an explicit public HTTPS API. The app rejects loopback, private network addresses and local-only hostnames. An invalid release address shows a plain build-recovery message in the app. Diagnose it in build configuration.

If you choose a non-default Expo web port, set `ALLOWED_ORIGINS` for the API to include that exact origin and restart it. For example, a loopback preview on port 8091 can use `http://127.0.0.1:8091,http://localhost:8091`. Keep deployed origins explicit.

For a USB-connected Android phone, a debug app can use `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001` with `adb reverse tcp:3001 tcp:3001`. Reverse the debug app's Metro port separately, for example `adb reverse tcp:8081 tcp:8093` when the host Metro runs on 8093. Use a disposable database for QA and remove only the reverse mappings you added when finished.

For a compiled local web preview, use `npm run export:web:preview` then `npm run preview`. `npm run export:web` is the production export and must be paired with the deployed HTTPS API configuration before treating its output as a functional release.

## Verify actual authentication and persistence

On the Mac/simulator, record these outcomes separately:

1. Health request succeeds on the Mac and API startup stays alive.
2. A new account signs up from the simulator and reaches Today.
3. Log out; log back in with that account.
4. Quit/relaunch the app; session and private state return.
5. Create a conversation. Built-in responses may test storage, but do not count as real AI verification.
6. Restart the API using the same database. Reopen the app and conversation; history must remain.
7. Log out and confirm the old token no longer authorizes private requests.
8. Create a second synthetic account and confirm it cannot access the first account's records.

The automated process tests perform these server-side behaviors on an isolated temporary database, including real process restarts. They do not prove iOS SecureStore or simulator networking. The user explicitly deferred Mac access, so simulator signup and native restart verification remain pending.

## If connection still fails

- Missing dependency: rerun `npm run setup` from the repository, not only npm ci at its root. Do not copy node_modules from another OS.
- Port collision: identify the process using port 3001; do not kill unrelated Node processes. Stop the intended old API process or use a consistent server/public-client port pair.
- Health works on the Mac but not in the simulator: confirm Debug configuration, the embedded public URL, and a full reload. Read the Xcode networking error before changing native transport settings.
- An ATS cleartext error is different from a stopped server. Use the minimum local-development exception if the generated Debug target needs one; do not disable ATS globally to repair authentication. Production uses HTTPS. [React Native networking](https://reactnative.dev/docs/network), [Apple transport keys](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html#//apple_ref/doc/uid/TP40009251-SW33).
- A physical-device local-network permission denial requires OS permission recovery and a reachable LAN/HTTPS address; localhost does not solve it.

No Docker setup is required. Existing deployment artifacts are unrelated to this local repair.
