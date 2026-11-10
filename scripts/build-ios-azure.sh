#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Run this command on the Mac with Xcode and your connected iPhone.' >&2
  exit 1
fi

xcode_version=$(xcodebuild -version | awk '/^Xcode / { print $2; exit }')
if [[ ! "$xcode_version" =~ ^([0-9]+)\.([0-9]+) ]] ||
   (( BASH_REMATCH[1] < 26 || (BASH_REMATCH[1] == 26 && BASH_REMATCH[2] < 4) )); then
  echo 'Solace requires Xcode 26.4 or later. Select it with xcode-select before building.' >&2
  exit 1
fi

node_runtime=$(node -p "require('./scripts/tooling.cjs').selectRuntime()")
export PATH="$(dirname "$node_runtime"):$PATH"
export EXPO_PUBLIC_API_URL='https://solace-demo-240e1d22-d2e6b3cahbheh2ed.centralindia-01.azurewebsites.net'
export EXPO_NO_DOTENV=1
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

if [[ ! -f node_modules/expo/package.json ]]; then
  "$node_runtime" scripts/runtime.cjs npm ci
fi

"$node_runtime" scripts/runtime.cjs expo prebuild --platform ios
"$node_runtime" scripts/runtime.cjs expo run:ios --configuration Release --device --no-bundler "$@"
