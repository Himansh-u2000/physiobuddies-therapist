const fs = require("fs");
const path = require("path");

/**
 * Dynamic layer over `app.json` — which stays the source of truth for everything static and is
 * handed to this function as `config` (Expo reads the static config first, then passes it to a
 * dynamic config that exports a function).
 *
 * It exists for exactly one thing: **`android.googleServicesFile` must only be set when the file
 * is actually there.**
 *
 * `expo-notifications` gets its Android push token from Firebase Cloud Messaging, which needs
 * `google-services.json` bundled at build time. But naming that file in a static `app.json`
 * makes every `expo prebuild` / `eas build` / `npm run apk` fail outright when it is missing —
 * which is why FCM_SETUP.md deliberately left the line out, and why push has never worked.
 *
 * Neither half of that is acceptable on its own, so the choice is made at config time:
 *
 *   - file absent  → key omitted, the build succeeds exactly as before, and the app reports
 *                    `not-configured` on the notification settings screen instead of pretending.
 *   - file present → key set, FCM is configured, `getDevicePushTokenAsync()` returns a real
 *                    token and registration goes through.
 *
 * So finishing push is now genuinely a matter of dropping the file in — no code change follows
 * it. See FCM_SETUP.md for where to get it.
 *
 * `GOOGLE_SERVICES_JSON` is honoured too: that is the path EAS materialises a file-type secret
 * at, so cloud builds can supply the file without it ever being committed.
 *
 * ## Google Maps key — same conditional shape, same reason
 *
 * `react-native-maps` renders through the Maps SDK for Android, which reads
 * `com.google.android.geo.API_KEY` from the manifest. Without it the MapView draws a blank grey
 * rectangle — strictly worse than showing no map at all — so the key is read from the
 * environment and `mapsEnabled` is published alongside it, letting the route screen fall back to
 * an address card instead of rendering that grey box.
 *
 * Read from `GOOGLE_MAPS_API_KEY`, deliberately WITHOUT the `EXPO_PUBLIC_` prefix: this value is
 * consumed here at config time and baked into the native manifest, so it does not also need to
 * be inlined into the JS bundle. It still ships inside the APK — that is unavoidable with the
 * Maps SDK — so restrict it in Google Cloud by package name AND signing SHA-1. Note the local
 * review build signs with the DEBUG keystore, whose SHA-1 differs from the EAS one; both need
 * listing or the map renders blank on one of them.
 */
module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const candidate = fromEnv || path.join(__dirname, "google-services.json");
  const googleServicesFile = fs.existsSync(candidate) ? candidate : undefined;

  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || undefined;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      ...(mapsApiKey ? { config: { googleMaps: { apiKey: mapsApiKey } } } : {}),
    },
    extra: {
      ...config.extra,
      // Read at runtime via expo-constants so the UI can decide between a real map and the
      // fallback card. A boolean rather than the key itself: the screen only needs to know
      // whether a map can render, and copying a credential into `extra` would put it in the JS
      // bundle for no benefit.
      mapsEnabled: Boolean(mapsApiKey),
    },
  };
};
