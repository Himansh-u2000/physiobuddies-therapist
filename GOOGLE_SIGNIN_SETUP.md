# Google Sign-In setup — Phase 2 handoff

> ## ⚠️ SUPERSEDED — Google Sign-In was removed from this app on 2026-08-17
>
> The native module, the `app.json` plugin entry, `src/lib/auth/googleSignIn.ts` and the
> `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` variable are all gone; login is email/password only.
> `POST /auth/google` still exists server-side for the web client. The `.env.development.local`
> and `.env.development` files this checklist refers to no longer exist either — there are two
> env files now, `.env` and `.env.production`. Kept only as the record of how the flow worked,
> in case Google login is ever restored.
>
> If it ever is: the package name / bundle id below is **out of date**. The app moved to
> `com.physiobuddies.therapist` on 2026-08-20 (see FCM_SETUP.md), so any OAuth client would have
> to be created against `com.`, not the `in.` shown here.

The app-side Google Sign-In is fully wired; it just needs your OAuth client IDs. This is the
one auth item that needs your Google account, so it's a short checklist (like `FCM_SETUP.md`).

## How the flow works (why it needs the *Web* client ID)

Your backend implements the **authorization-code** flow:

```
auth.controller.ts → validateSchema(GoogleLoginSchema, req.query)   // POST /auth/google?code=…
auth.service.ts    → oauth2Client.getToken(code)                    // redirect_uri: 'postmessage'
googleClient.ts    → new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'postmessage')
```

So the native app must return a **`serverAuthCode`** issued for the **Web** OAuth client, and the
backend exchanges it server-side with that Web client's secret. The app is configured with
`webClientId` + `offlineAccess: true` (see `src/lib/auth/googleSignIn.ts`) to produce that code.

> **Key rule:** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) **must equal** `GOOGLE_CLIENT_ID` (backend
> `.env`). Same Web client on both sides — otherwise the backend can't exchange the code.

Also note: **Google login is login-only.** The backend rejects unknown Google accounts with
"No user found … Please sign up first" — the therapist must already exist (registered via
email/OTP signup) for Google to work.

## Your SHA-1 vs SHA-256 question

- The **Android OAuth client** in Google Cloud Console takes a **SHA-1** fingerprint — that's the
  field Google gives you, and it's how Google matches your APK's signature to the client. SHA-1 is
  what makes Google Sign-In work.
- **SHA-256** is required separately for **Play Integrity / App Check** (add it in Firebase). It is
  NOT used for the Google Sign-In cert match.
- Best practice: register **both** SHA-1 and SHA-256 in Firebase; put the **SHA-1** on the Android
  OAuth client. (The plan's SMS-Retriever "app hash" — a SHA-256-derived string — is now out of
  scope since login isn't phone-OTP.)

## Steps

### 1. Create the OAuth clients (Google Cloud Console → APIs & Services → Credentials)
1. **Web application** client — you likely already have this (it's your backend's `GOOGLE_CLIENT_ID`).
   Reuse it. Its client ID is what goes in the app env below.
2. **Android** client:
   - Package name: `in.physiobuddies.therapist`
   - SHA-1: get it from EAS (next step). Android clients have no secret.
3. **iOS** client (defer to Phase 8): bundle id `in.physiobuddies.therapist`. Its **reversed**
   client ID (`com.googleusercontent.apps.XXXX`) replaces the `iosUrlScheme` placeholder in
   `app.json`.

### 2. Get the Android signing SHA-1 from EAS
```
eas credentials -p android
```
Select the app → Keystore → it prints the **SHA-1 Fingerprint**. Paste that into the Android OAuth
client (step 1.2). If no keystore exists yet, let EAS generate one first. For a quick local debug
build, also add the debug keystore SHA-1.

### 3. Provide the Web client ID — kept OUT of git

The Web client ID is **not committed**. The tracked `.env.*` files and `eas.json` keep
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` **blank on purpose**; the real value is supplied from two
git-free places, one per surface:

| Surface | Where the value lives | How to set it |
|---|---|---|
| **Local dev** (`expo start`) | `.env.development.local` — gitignored via `.env*.local` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com` |
| **EAS cloud builds** (all profiles) | EAS project env store, linked by each profile's `"environment"` in `eas.json` | `eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<web-client-id>.apps.googleusercontent.com" --environment development --environment preview --environment production --visibility plaintext --scope project --type string` |

`.env.development.local` overrides the blank `.env.development` (`.local` has the highest env
precedence), so local runs pick it up with no other change. EAS builds pull it from the store because
each build profile now declares `"environment": "development" | "preview" | "production"`.

> **Status:** for this developer's machine both are already configured — the local file exists and the
> EAS var is set across development/preview/production. A **new developer** only needs to recreate
> `.env.development.local` (the EAS var is shared on the project). To rotate the value, update the
> local file and re-run `eas env:update` (or delete + `eas env:create`).

When the var resolves empty (e.g. a fresh clone with no `.local` file), the Google button shows a
friendly "not configured" message instead of crashing.

### 4. (iOS, Phase 8) replace the iosUrlScheme placeholder
In `app.json`, the google-signin plugin currently has:
```jsonc
["@react-native-google-signin/google-signin", { "iosUrlScheme": "com.googleusercontent.apps.PLACEHOLDER-REVERSED-IOS-CLIENT-ID" }]
```
Replace the placeholder with your iOS client's reversed ID. (Android ignores this; it only matters
for iOS Google Sign-In.)

### 5. Verify (dev build — not Expo Go)
- `eas build -p android --profile development`, install, set `EXPO_PUBLIC_USE_MOCK_AUTH=false`.
- On the login screen tap **Continue with Google** → native picker → app posts the `serverAuthCode`
  to `POST /auth/google?code=…` → backend returns `{ accessToken, refreshToken }`.
- If you get "No user found, please sign up first", the Google email isn't a registered therapist.

---

> **Client IDs are not written down in this repo.** The live values live in
> `.env.development.local` (git-ignored) and the EAS project env store. This file refers to them by
> Google Cloud **project number** only — enough to tell two clients apart in a checklist, useless on
> its own. Read the real value with `eas env:list` or from `.env.development.local`.

### Status checklist
- [x] Web OAuth client ID matches backend `GOOGLE_CLIENT_ID` — both are the **Web** client from
  Google Cloud project `22438999008` (backend value confirmed by the user 2026-07-30; app
  `.env.development.local` updated to match — it previously held a client from a DIFFERENT project
  `252219918789`, which would have 500'd the code exchange).
- [ ] **Android OAuth client** created in the **same Google Cloud project** (`22438999008`) with:
  - Package name: `in.physiobuddies.therapist`
  - SHA-1 (local `npm run apk` debug-signing cert): `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
  - Also add the **EAS** keystore SHA-1 for cloud builds (`eas credentials -p android`).
  - This is the only remaining blocker for Google login — without it the native sign-in fails with `DEVELOPER_ERROR`.
- [x] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` provided out-of-git — `.env.development.local` (local) + forwarded into `npm run apk` by `scripts/build-local-apk.ps1`.
- [ ] **EAS env var** still holds the OLD client (from project `252219918789`) — update it for cloud
  builds: `eas env:update` (or delete + `eas env:create`) → set to the project-`22438999008` Web
  client. Not needed for local `npm run apk`.
- [ ] (Phase 8) iOS client created + `iosUrlScheme` placeholder replaced
- [ ] Google login verified end-to-end on a dev build. **Tester's Google email must be a registered
  therapist** (backend rejects unknown Google accounts: "please sign up first") — register your real
  Google email via email/OTP signup first, since the seed logins aren't real Google accounts.
