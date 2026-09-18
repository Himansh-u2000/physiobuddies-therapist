# Push notifications — status

Android push is configured end to end: the device registers an FCM token, taps deep-link into the
right screen, preferences are editable, and sign-out retires the token. The Firebase Android app
exists and `google-services.json` is in the repo, so a build produced from this tree can obtain a
token.

**One thing is left, and it is on the server side:** the backend needs the Firebase
service-account key in order to *send* anything. Until then the app will register successfully
and receive nothing. See "What is left" below, and the delivery risk noted at the end.

---

## What the app now does

| Piece | Where | Status |
| --- | --- | --- |
| Permission + Android channels | `src/lib/notifications/push.ts` | done |
| FCM token acquisition | `getDevicePushTokenAsync()`, Android only | done |
| `POST /notifications/device-token` | `notificationApi.registerPushToken` | done |
| `DELETE /notifications/device-token/:token` on logout | `auth.store.ts` → `unregisterDeviceToken` | done |
| Token rotation | `addPushTokenListener` → `syncRotatedToken`, retire the old row | done |
| Foreground display, cold-start taps, deep links | `src/lib/hooks/useNotifications.ts`, `links.ts` | done |
| Preferences UI (6 flags) | `src/app/notification-settings.tsx` | done |
| Unread badge (bell + app icon) | `useUnreadNotifications` | done |
| Firebase Android app + `google-services.json` | Firebase console → repo root | done |
| **Backend able to send (service-account key)** | backend / firebase-admin | **TODO — see below** |
| iOS / APNs | — | deferred, see "iOS" below |

The app degrades honestly if the Firebase config is ever missing: the notification settings screen
says *"Push isn't available in this build"* rather than silently doing nothing, and the in-app
notification list, preferences and unread badge all work regardless — they are polled, not pushed.

## Why the `NOTIFICATION_*` values in `.env.*` are not enough

The credentials already in the env files are the Firebase **Web** SDK config:

```
NOTIFICATION_APP_ID=1:162686649484:web:deaf5bb41c794fe5ece7a9    ← "web"
NOTIFICATION_VAPID_KEY=BOdyDH_…                                   ← web push only
```

A `web` app ID and a VAPID key are what the Firebase **JavaScript** SDK uses to subscribe a
*browser*. React Native does not use them at all — it registers through the native Firebase
Android SDK, which reads `google-services.json` and needs an **android** app ID
(`1:162686649484:android:…`). It cannot be fabricated: FCM rejects a registration for an app ID it
has never issued.

Same Firebase project (`physiobuddies-d6a31`), same sender ID — just a second app registered in
it, which now exists.

---

## Done: the Android app is registered

Completed 2026-08-20. `google-services.json` is at the repo root and committed, and the native
project has been regenerated against it. Verified by running the Google Services Gradle task,
which resolves the **android** app ID (not the web one):

```
google_app_id     1:162686649484:android:6bf509d5f514ac4cece7a9
gcm_defaultSenderId 162686649484
project_id        physiobuddies-d6a31
```

### The package name changed to `com.physiobuddies.therapist`

The app was `in.physiobuddies.therapist` on both platforms. The Firebase Android app was
registered as `com.physiobuddies.therapist`, and rather than re-register, **the app moved to
`com.`** — a product decision taken while the app is still in development, so no installed copy
and no store listing is affected. `app.json` (android *and* iOS, kept in step), the regenerated
`android/` project, and the build script all say `com.physiobuddies.therapist` now.

Two consequences worth knowing:

- **EAS will mint a new Android keystore** on the next cloud build, because credentials are keyed
  by package name. Any previously installed EAS build must be uninstalled before a new one will
  install (signature mismatch) — `adb uninstall in.physiobuddies.therapist`.
- **`npx expo prebuild -p android --clean` is required after a package change**, not just a plain
  prebuild: the Kotlin sources live under `android/app/src/main/java/<package path>/`, and a
  non-clean prebuild leaves the old `in/physiobuddies/` directory behind alongside the new one.
  Note `android/local.properties` is *not* regenerated — it carries this machine's `sdk.dir` and
  the load-bearing `cmake.dir` override, so back it up before a `--clean` and restore it after.

- **A plain prebuild can also move the files without rewriting what is inside them.** Observed
  2026-08-21: `MainActivity.kt` and `MainApplication.kt` were sitting in the new
  `com/physiobuddies/therapist/` directory while both still declared

  ```kotlin
  package `in`.physiobuddies.therapist
  ```

  The old name is a Kotlin keyword, so it is backtick-escaped, and the rename step does not
  rewrite it. Nothing complains until Kotlin compiles — **37 minutes in**, after all the native
  CMake work — with `Unresolved reference 'BuildConfig'`: AGP generates `BuildConfig` into the
  module's `namespace` (`com.physiobuddies.therapist`), which is not the package the file claims
  to be in. Had it compiled, the manifest's `android:name=".MainApplication"` would then have
  resolved to a class that does not exist and crashed at launch instead.

  Check it in one second, before committing to a build:

  ```
  grep -rn "^package" android/app/src/main/java
  ```

  Every line must match `app.json`'s `android.package`. If it does not, either re-run with
  `--clean` or fix the two `package` lines in place — the latter is the same end state and keeps
  the native build cache. Also clear the orphaned classes the old package left behind
  (`android/app/build/intermediates/**/in/physiobuddies/`) so they cannot be dexed into the APK.

### The local `android/` project must be regenerated before it has FCM

`android/` is git-ignored and generated, so a checkout that predates `google-services.json`
carries a native project with **no Firebase at all**: no `android/app/google-services.json`, no
`com.google.gms.google-services` Gradle plugin, and no
`com.google.firebase.messaging.default_notification_channel_id` meta-data for `defaultChannel`.
An APK built from it registers nothing and the settings screen reports *"Push isn't available in
this build"*. Check with:

```
ls android/app/google-services.json
```

Missing or stale (different from the root copy) → run `npx expo prebuild -p android` before
building. `scripts/build-local-apk.ps1` refuses to build in that state rather than producing a
silently push-less APK, and says the same thing.

### ⚠️ Never call `getDevicePushTokenAsync()` from a push-token listener

Android's `PushTokenModule.getDevicePushTokenAsync` emits `onDevicePushToken` on success
(`promise.resolve(token); onNewToken(token)`), so a listener that answers by re-registering
re-enters the fetch and emits again. That loop shipped once: the rotation listener called
`registerDeviceToken(true)`, and the app POSTed `/notifications/device-token` without end, which
starved every other request in the app and made unrelated screens look like they had no data.
`syncRotatedToken` exists for this — it uses the token the event already carried, never fetches,
and only POSTs a value that differs from the stored one. Pinned by
`src/lib/notifications/__tests__/push.test.ts`.

## What is left

### 1. Give the backend the FCM V1 credential
The **server** is the sender here, not Expo, so the service-account key goes to the backend team,
not to EAS:

Firebase console → **Project settings → Service accounts → Generate new private key** → hand the
downloaded JSON to whoever configures the API's firebase-admin credentials.

> Never commit that file. It is a private key that can push to every user and read the whole
> project — the opposite of `google-services.json`. `.gitignore` carries patterns for the usual
> filenames (`*service-account*.json`, `*-firebase-adminsdk-*.json`) so a stray download cannot
> be committed by accident.

> EAS credentials (`eas credentials -p android`) are only needed if something ever sends through
> **Expo's** push service. This app registers a raw FCM token with our own backend and does not
> use Expo's relay, so that step is not required.

### 2. Verify on a device
1. `npm run apk`, install it, sign in. (The script now preflights Firebase and refuses to build
   an APK that would silently have no push — it checks the file was applied to `android/` and
   that its package matches `app.json`.)
2. Profile → **Notification settings**. The banner should read **"Push notifications are on"**.
   Anything else names the reason.
3. Trigger a real event — the easiest is a booking on the seed patient account, which fires
   `booking.therapist_assigned` (an event with a `push` channel).
4. Background the app. The notification should appear in the tray, and tapping it should open
   that booking, not the app's home screen.

### Checklist
- [x] Android app registered inside `physiobuddies-d6a31`
- [x] `google-services.json` at the repo root
- [x] App package aligned to `com.physiobuddies.therapist`, native project regenerated
- [ ] Service-account key handed to the backend
- [ ] Test push received and its tap opened the right screen


---

## iOS

**The app side is built (2026-09-17). What's left is account setup only you can do — and it can
never be tested on the current iOS build.**

### Why the existing iOS build can't receive push, whatever the code does

The only iOS build so far is the EAS `ios-simulator` profile. Simulator builds are **unsigned**, so
they carry no `aps-environment` entitlement, and iOS refuses to issue a push token without one. The
notification settings screen reports this as "Push isn't available in this build". Testing push
needs a **signed device build** (EAS `development` / `preview` with `distribution: internal`, or
TestFlight) on a real iPhone.

### How iOS registers

`getDevicePushTokenAsync()` returns a raw **APNs** token on iOS, which the backend's firebase-admin
sender cannot address. So on iOS the app asks the Firebase iOS SDK for an **FCM** token instead,
via `@react-native-firebase/messaging` (`src/lib/notifications/iosFcm.ts`), and registers that.
The backend needs no change: its sender already builds a common `notification` block, which FCM
delivers to iOS. An APNs-shaped token is refused on every path, so a mistake can't put an
undeliverable row on the server.

RN Firebase is linked on **iOS only**. On Android it is excluded via
`package.json` → `expo.autolinking.android.exclude`: its Android side declares a second
`MESSAGING_EVENT` service and notification meta-data that clash with expo-notifications and fail the
manifest merge. Verified: `npx expo prebuild -p android` leaves `android/` byte-identical.

> Don't "simplify" that to a `react-native.config.js` with `platforms: { android: null }`. It looks
> right and does nothing — `expo-modules-autolinking`'s `deepObjectMerge` drops a `null` override
> when the package declares its own `platforms.android` object, which both RNFB packages do.
> Check with `npx expo-modules-autolinking react-native-config --platform android`.

### Steps

1. **Apple Developer Program** membership (needed for any signed device build).
2. **APNs key** — developer.apple.com → Certificates, IDs & Profiles → Keys → create a key with
   *Apple Push Notifications service (APNs)* → download the `.p8` (one download only), note the Key
   ID and your Team ID.
3. **Upload it to Firebase** — console.firebase.google.com → project `physiobuddies-d6a31` →
   Project settings → Cloud Messaging → *Apple app configuration* → upload the `.p8` with Key ID and
   Team ID. One auth key covers both sandbox and production.
4. **Register the iOS app in Firebase** — same project → Add app → iOS → bundle ID
   `com.physiobuddies.therapist` → download **`GoogleService-Info.plist`** and put it in
   `physiobuddies-therapist/` next to `google-services.json`. For EAS, upload it as a file secret
   and point `GOOGLE_SERVICES_PLIST` at it instead of committing it.
5. **Build for a real device** — `npx eas build -p ios --profile development` (or `preview`).
   `app.config.js` detects the plist and switches Firebase on; without it the build still succeeds
   and push reports "not configured".
6. **Check** — sign in on the iPhone, allow notifications, open Profile → Notification settings:
   it should say *Push notifications are on*. Then trigger a notification server-side.

### iOS build flags (already in `app.config.js`)

RN Firebase's documented CocoaPods route, chosen over its dynamic/SPM default because this app's
other pods (SQLCipher, Google Maps) are known to break under dynamic frameworks:

- `expo-build-properties` → `ios.useFrameworks: "static"`
- `ios.forceStaticLinking: ["RNFBApp", "RNFBMessaging"]` — required with Expo's precompiled React
  Native; add any RNFB module you install later
- `$RNFirebaseDisableSPM = true` in the Podfile (`plugins/withFirebaseIos.js`)

**None of this has been compiled yet** — there is no Mac here, and this app has never built for a
real iPhone. Expect the first device build to surface something iOS-specific.

## Server-side risk — resolved

The sender previously looked web-push-only. As of 2026-09-17 `firebase.service.ts` → `sendMulticast`
builds a top-level `notification: { title, body }` (plus `webpush` only for the link), which FCM
delivers natively to both Android and iOS. The foreground re-presentation in `useNotifications.ts`
stays as a harmless safety net.
