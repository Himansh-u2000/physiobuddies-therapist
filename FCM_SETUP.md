# FCM (Android push) setup — Phase 1 handoff

Everything in Phase 1 that can be automated is done. Firebase Cloud Messaging is the
one item that needs **your Google account** (creating a Firebase project and downloading
a client config file), so it is left as a short manual checklist below. APNs (iOS push)
is intentionally deferred to **Phase 8** — it needs an Apple Developer account.

Until these steps are done, remote push testing on Android in later phases is blocked.
Local notifications work fine without it.

> Why this can't be scripted: it requires signing into the Firebase console with your
> Google account and downloading `google-services.json`. `app.json` is deliberately left
> **without** a `googleServicesFile` reference so the first `eas build` doesn't fail on a
> missing file — you add that one line in step 3 once the file exists.

---

## 1. Create the Firebase project + Android app
1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `physiobuddies`).
   Google Analytics is optional.
2. In the project, **Add app → Android**.
3. **Android package name** must exactly match `app.json`:
   ```
   in.physiobuddies.therapist
   ```
4. Register the app and **download `google-services.json`**.

## 2. Drop the file into the repo
Place the downloaded file at the project root:
```
physiobuddies-therapist/google-services.json
```
It is Firebase *client* config (not a secret — it already ships inside the APK), so it is
safe to commit to this private repo. If you'd rather not commit it, add it as an EAS
file secret instead (`eas env:create --name GOOGLE_SERVICES_JSON --type file ...`) and
reference that — but committing is simplest here.

## 3. Point `app.json` at it (one line)
Add `googleServicesFile` inside the `android` block of `app.json`:
```jsonc
"android": {
  "package": "in.physiobuddies.therapist",
  "googleServicesFile": "./google-services.json",   // <-- add this line
  "adaptiveIcon": { ... }
}
```

## 4. Upload the FCM V1 credential to EAS
SDK 56 / `expo-notifications` uses **FCM V1** (the legacy server key is gone).
1. Firebase console → **Project settings → Service accounts → Generate new private key**
   → downloads a service-account JSON.
2. Upload it to EAS:
   ```
   eas credentials -p android
   ```
   Choose the build profile → **Push Notifications: Manage your FCM V1 Service Account Key**
   → **Upload a new key** → select the service-account JSON from step 1.
   (You can also do this from the project's **Credentials** page on expo.dev.)

## 5. Verify
- Build a development client (`eas build -p android --profile development`), install it.
- On first authenticated launch the app calls `Notifications.getExpoPushTokenAsync` and
  registers the token (see `src/lib/hooks/useNotifications.ts`) — it needs the real
  `projectId` (already set: `e73e2219-8f33-41f9-8f83-ccab827af8af`) **and** the FCM key.
- Send a test push from <https://expo.dev/notifications> to the printed
  `ExponentPushToken[...]`.

---

### Status checklist
- [ ] Firebase project created, Android app registered as `in.physiobuddies.therapist`
- [ ] `google-services.json` at repo root
- [ ] `googleServicesFile` line added to `app.json`
- [ ] FCM V1 service-account key uploaded to EAS
- [ ] Test push received on a dev build

Once all five are checked, flip the **FCM** checkbox in `../progress.md` (Phase 1).
