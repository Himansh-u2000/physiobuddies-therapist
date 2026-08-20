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
 */
module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const candidate = fromEnv || path.join(__dirname, "google-services.json");
  const googleServicesFile = fs.existsSync(candidate) ? candidate : undefined;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
