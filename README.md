# Physiobuddies Therapist

The therapist partner app — Expo SDK 56 / React Native 0.85 / React 19.2, New Architecture.

Therapists use it to run home, clinic and online physiotherapy visits: see their schedule, navigate
to a patient, start a visit with a patient-supplied OTP, record a clinical assessment, and get paid.

## Quick start

```bash
npm install
```

Then build and install a real APK — **not** `npx expo start` alone (see below):

```bash
npm run apk
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (~64 MB, ~2 min incremental).

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Sign in with **"Continue with email"** using the seed therapist:
`aarav@physiobuddies.com` / `Password@123`.

### Why not Expo Go?

**Expo Go cannot run this app at all.** It depends on native modules Expo Go doesn't bundle:
Google Sign-In, SQLCipher-encrypted SQLite, camera, biometrics, and the image/document pickers.
`npx expo start` is useful for a Metro server against an installed dev build, not on its own.

## Environments

There are **two** env files, both git-ignored, and neither holds a secret (`EXPO_PUBLIC_*` values
are inlined into the JS bundle and readable out of any APK):

| File | When it loads | API |
|---|---|---|
| `.env` | always | `https://api.dev.physiobuddies.in/api/v1` |
| `.env.production` | layered on top when `NODE_ENV=production` | `https://api.physiobuddies.in/api/v1` (not yet live) |

Both files also carry `EXPO_PUBLIC_SHOW_TEST_OTP`, which controls whether the app displays the
session OTP the backend echoes back to the therapist. It is a **testing affordance** — a real
one-time password shown to someone who isn't the patient — so `.env` sets it `true` and
`.env.production` (and the EAS production profile) pin it `false`.

`.env.production` must restate every key `.env` sets — an omitted key falls through to the dev
value rather than being unset. Cloud builds read neither file: their values live in
`eas.json > build.<profile>.env`. `scripts/build-local-apk.ps1` exports its values as real process
env vars, which win over both files, so a local release APK can be pointed at the dev backend.

**There is no mock mode.** The bundled fixtures and the `EXPO_PUBLIC_USE_MOCK_*` flags were removed
on 2026-08-18 — every service in `src/lib/api/services.ts` calls the backend unconditionally, so a
broken endpoint surfaces as a real error instead of as plausible-looking fake data.

There is no content-write flag either. Articles and FAQs were briefly read-only while the backend's
write routes were missing; those routes are live again and the app is wired straight to them.

## Scripts

| Command | What it does |
|---|---|
| `npm run apk` | Local release APK (arm64-v8a). `-Abi x86_64` for an emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm test` | Jest (`jest-expo`) |
| `npm run android` | `expo run:android` — debug build with Metro |

## Inspecting network traffic (the DevTools Network tab, on a phone)

There are three ways to see what the app sends and receives. Pick by what you're running.

**1. In-app network log — works in a release APK, which is the usual review build.**
Profile → Support → **Network log**. Every API call, newest first: method, absolute URL, request
payload, status, response body (already envelope-unwrapped, so it's what the mappers actually saw)
and duration. Tap a row to expand it; the header has Share (exports the whole log as text) and
Clear. `/auth/refresh` is logged too — a silently failing refresh 401s every *other* request and
looks like "the whole app is broken", so it's the first thing to check when everything fails at once.

Enabled by `EXPO_PUBLIC_ENABLE_NETWORK_LOG=true`, which `npm run apk` sets for you. It defaults to
`__DEV__` otherwise, so store builds don't ship it. Passwords, OTPs and refresh tokens are redacted
and the bearer token is truncated — the log is designed to be shareable. It is capped at 80
entries, never written to disk, and cleared on sign-out.

**2. Metro console — debug builds only** (`npm run android`, or `npm start` with a dev build).
Every request logs one line (`[api] GET /user → 200 (312ms)`); failures log status and message.

**3. React Native DevTools — debug builds only.** Shake the device → *Open DevTools*, then the
**Network** panel. Richer than the above (headers, timing waterfall) but it cannot attach to a
release APK, which is why the in-app log exists.

> `adb logcat -s ReactNativeJS:V` also surfaces the console lines over USB, but a release bundle
> strips most of them — reach for the in-app log instead.

## Layout

```
src/
├── app/            expo-router routes — (auth), (app), session/, patient/, learn/
├── components/     ui/ (design system), dashboard/, session/, appointments/, charts/
├── lib/
│   ├── api/        client.ts (axios + refresh), services.ts, mappers.ts, netlog.ts
│   ├── db/         SQLite + Drizzle: schema, migrations, repositories/, sync/
│   ├── hooks/      biometric, camera, location, network, notifications, file picker
│   └── stores/     zustand: auth, app, session
├── constants/      config.ts (colors, slots, storage keys), clinical.ts (assessment enums)
└── types/          domain types
```

**Architecture notes worth knowing before changing anything:**

- **SQLite is the only persistence layer.** TanStack Query hydrates *from* it; the Query cache is
  never persisted separately. Screens read cache-first, then refresh from the network.
- **Writes are offline-first.** Session drafts and assessments persist to SQLite immediately and
  flush through a retry/backoff queue (`lib/db/sync/`). Each row carries a client-generated
  idempotency key.
- **The response envelope is peeled once**, centrally, in `client.ts`'s interceptor. Services
  receive the payload, never `{ success, message, data }`.
- **Appointments are treatment *plans*; sessions are the individual visits.** Every lifecycle
  endpoint (OTP, end, assessment) takes a **session** id, not the plan id the list is keyed by —
  `Appointment.currentSessionId` is the one to pass. This is the most common source of 404s.

## Docs

| File | What it's for |
|---|---|
| [`../progress.md`](../progress.md) | **Live status** — phases, blockers, session log. The moving part |
| [`../implementation_plan.md`](../implementation_plan.md) | The stable plan: scope, architecture, phases, risks |
| [`../api_contract.md`](../api_contract.md) | Every endpoint the app uses, verified against the live server |
| [`BACKEND_TODO.md`](BACKEND_TODO.md) | What the backend still owes, and live defects the app works around |
| [`FCM_SETUP.md`](FCM_SETUP.md) / [`GOOGLE_SIGNIN_SETUP.md`](GOOGLE_SIGNIN_SETUP.md) | Credential setup |
| [`AGENTS.md`](AGENTS.md) | **Read the versioned Expo docs** before writing against any Expo API |

> The published swagger at `/api/v1/docs/` is **not** a reliable contract — it documents routes that
> don't exist, omits several that do, and types every response `data: any`. Use `api_contract.md`,
> or read the backend source.
