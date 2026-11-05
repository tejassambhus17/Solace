// Windows NDK/CMake compatibility for the pinned Expo SDK. Applied after prebuild.
// CMake launches clang++.exe by its 8.3 path when the SDK path has spaces. With
// -no-canonical-prefixes, clang loses C++ driver mode and fails to link libc++.
// AGP's 1024-character object path limit also exceeds common Windows path limits.
const fs = require('node:fs');
const path = require('node:path');
if (process.platform !== 'win32') process.exit(0);
const root = path.resolve(__dirname, '..');
const expoVersion = require(path.join(root, 'node_modules/expo-modules-core/package.json')).version;
const reactNativeVersion = require(path.join(root, 'node_modules/react-native/package.json')).version;
if (expoVersion !== '58.0.30' || reactNativeVersion !== '0.88.1') {
  throw new Error(`Native patch requires expo-modules-core 58.0.30 and react-native 0.88.1; found ${expoVersion} and ${reactNativeVersion}. Review compatibility before building.`);
}
const marker = 'SOLACE_WINDOWS_CMAKE_COMPAT';
function patchFile(relative, needle, replacement) {
  const file = path.join(root, relative);
  const original = fs.readFileSync(file, 'utf8');
  if (original.includes(marker)) {
    const upgraded = original.replaceAll('-DCMAKE_OBJECT_PATH_MAX=180', '-DCMAKE_OBJECT_PATH_MAX=240');
    if (upgraded !== original) fs.writeFileSync(file, upgraded);
    return;
  }
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const normalized = original.replace(/\r\n/g, '\n');
  if (normalized.split(needle).length !== 2) throw new Error(`Expected a unique native configuration in ${relative}; review before patching.`);
  fs.writeFileSync(file, normalized.replace(needle, replacement).replace(/\n/g, eol));
}
patchFile('node_modules/expo-modules-core/android/build.gradle', '        def cppArguments = [', `        // ${marker}\n        def cppArguments = [\n          "-DCMAKE_OBJECT_PATH_MAX=240",\n          "-DCMAKE_CXX_FLAGS=--driver-mode=g++",`);
patchFile('android/app/build.gradle', '    defaultConfig {', `    defaultConfig {\n        // ${marker}\n        externalNativeBuild {\n            cmake {\n                arguments "-DCMAKE_OBJECT_PATH_MAX=240", "-DCMAKE_CXX_FLAGS=--driver-mode=g++"\n            }\n        }`);
console.log('Applied Windows CMake compatibility settings.');
