param(
  [Parameter(Mandatory=$true)][string]$ApiUrl
)
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if(!$ApiUrl.StartsWith('https://')){throw 'A reachable HTTPS API is required. Cleartext release transport is not enabled.'}
if(!$env:JAVA_HOME){$taskJava=Get-ChildItem -LiteralPath (Join-Path $env:ProgramFiles 'Java') -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name -like 'jdk-21*'} | Select-Object -First 1;if($taskJava){$env:JAVA_HOME=$taskJava.FullName}}
if(!$env:JAVA_HOME){throw 'Set JAVA_HOME to JDK 21 before building.'}
if(!$env:ANDROID_HOME){$env:ANDROID_HOME=Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'}
if(!(Test-Path -LiteralPath $env:ANDROID_HOME)){throw 'Set ANDROID_HOME to an installed Android SDK.'}
$env:EXPO_PUBLIC_API_URL=$ApiUrl
$env:GRADLE_USER_HOME=Join-Path (Get-Location) 'work\gradle'
$env:PATH=(Join-Path $env:JAVA_HOME 'bin')+';'+$env:PATH
if(Test-Path -LiteralPath '.solace-runtime.json'){$taskRuntime=Get-Content .solace-runtime.json -Raw|ConvertFrom-Json;$env:PATH=(Split-Path -Parent $taskRuntime.node)+';'+$env:PATH}
& node scripts/runtime.cjs expo prebuild --platform android --no-install
if($LASTEXITCODE -ne 0){throw 'Expo Android prebuild failed.'}
& node scripts/patch-native.cjs
if($LASTEXITCODE -ne 0){throw 'Native compatibility patch failed. Review the pinned versions.'}
& .\android\gradlew.bat -p android :app:createBundleReleaseJsAndAssets --rerun-tasks '-PreactNativeArchitectures=arm64-v8a' --no-daemon --console=plain
if($LASTEXITCODE -ne 0){throw 'Release JavaScript rebundling failed.'}
& .\android\gradlew.bat -p android assembleRelease '-PreactNativeArchitectures=arm64-v8a' '-Pandroid.enableMinifyInReleaseBuilds=false' --no-daemon --console=plain
if($LASTEXITCODE -ne 0){throw 'Android build failed. Review the build output; do not automatically accept unknown SDK licenses.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskApkPath=Join-Path (Get-Location) 'android/app/build/outputs/apk/release/app-release.apk'
$taskArchive=[System.IO.Compression.ZipFile]::OpenRead($taskApkPath)
try{$taskEntry=$taskArchive.GetEntry('assets/index.android.bundle');if(!$taskEntry){throw 'APK has no bundled JavaScript.'};$taskStream=$taskEntry.Open();$taskMemory=New-Object System.IO.MemoryStream;try{$taskStream.CopyTo($taskMemory);if(![System.Text.Encoding]::UTF8.GetString($taskMemory.ToArray()).Contains($ApiUrl)){throw 'Expected HTTPS API address was not found in the APK bundle; do not distribute this build.'}}finally{$taskStream.Dispose();$taskMemory.Dispose()}}finally{$taskArchive.Dispose()}
New-Item -ItemType Directory -Force -Path outputs | Out-Null
Copy-Item -LiteralPath android\app\build\outputs\apk\release\app-release.apk -Destination outputs\solace-local-preview.apk
Write-Output 'Saved outputs\solace-local-preview.apk. This uses the generated development signing key and is not a store-signed production build. Install and verify it on the target phone.'

