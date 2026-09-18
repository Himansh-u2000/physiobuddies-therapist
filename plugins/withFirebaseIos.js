/**
 * `@react-native-firebase/app`'s config plugin — the iOS half only.
 *
 * The package's own plugin registers iOS AND Android mods. Its Android mods add a second
 * google-services classpath/apply and copy `google-services.json`, all of which Expo already does
 * for this project; and the Firebase native modules are excluded from Android autolinking anyway
 * (`package.json` → `expo.autolinking.android.exclude`). Running them would change the committed
 * `android/` project for no benefit, so only the iOS mods are applied here.
 *
 * Two parts, because they have different preconditions:
 *
 *   - **Always:** `withIosDisableSPM` with `disableSPM: true`. The RNFB pods are linked on every iOS
 *     build, and this project links them statically (`expo-build-properties`, see app.config.js);
 *     RNFirebase's Swift Package Manager path requires DYNAMIC frameworks, so it must be switched
 *     off whenever the pods exist — not only once Firebase is configured.
 *   - **Only with a plist:** `withFirebaseAppDelegate` (calls `FirebaseApp.configure()` at launch)
 *     and `withIosGoogleServicesFile` (copies `GoogleService-Info.plist` into Xcode).
 *     `withIosGoogleServicesFile` THROWS when `ios.googleServicesFile` is unset, which would fail
 *     every iOS prebuild until the file is added.
 *
 * Loads the package's compiled `plugin/build/ios` entry, which is not a public API — its `exports`
 * map blocks the subpath, so it is required by file path from the package's (exported)
 * `package.json` location. Pinned by the installed version; if an upgrade moves it, this require
 * fails loudly at config time rather than silently skipping Firebase setup.
 */
const path = require("path");
const { withPlugins } = require("@expo/config-plugins");

const rnfbAppDir = path.dirname(require.resolve("@react-native-firebase/app/package.json"));
const ios = require(path.join(rnfbAppDir, "plugin", "build", "ios"));

module.exports = function withFirebaseIos(config, { configured = false } = {}) {
  const mods = [[ios.withIosDisableSPM, { ios: { disableSPM: true } }]];
  if (configured) {
    mods.push(ios.withFirebaseAppDelegate, ios.withIosGoogleServicesFile);
  }
  return withPlugins(config, mods);
};
