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

> ⚠️ **The phone-number login on the first screen is mock-only.** It accepts any 6-digit code and
> mints a fake session that the real backend rejects. Use the email path. Tracked as blocker P1 in
> [`../progress.md`](../progress.md).

### Why not Expo Go?

**Expo Go cannot run this app at all.** It depends on native modules Expo Go doesn't bundle:
Google Sign-In, SQLCipher-encrypted SQLite, camera, biometrics, and the image/document pickers.
`npx expo start` is useful for a Metro server against an installed dev build, not on its own.

## Environments

The API base and per-domain mock flags come from `EXPO_PUBLIC_*` env vars — see `.env.development`.

| Env | API |
|---|---|
| development / staging | `https://api.dev.physiobuddies.in/api/v1` |
| production | `https://api.physiobuddies.in/api/v1` (not yet live) |

Mock flags are **per domain** (`EXPO_PUBLIC_USE_MOCK_*`), so individual features can run on fixtures
while the rest hit the real server. Today only **notifications** is mocked — its backend controllers
are empty method bodies that never respond, so a request there hangs rather than failing.

For a release build the flags must be **real process env vars**, not `.env` files: a release runs
with `NODE_ENV=production` and would otherwise load `.env.production`. `scripts/build-local-apk.ps1`
handles that.

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
│   ├── api/        client.ts (axios + refresh), services.ts, mappers.ts, mock.ts
│   ├── db/         SQLite + Drizzle: schema, migrations, repositories/, sync/
│   ├── hooks/      biometric, camera, location, network, notifications, file picker
│   └── stores/     zustand: auth, app, session
├── constants/      config.ts (colors, flags, slots), clinical.ts (assessment enums)
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
