# Testing the therapist app on an iPhone

**Short version: Expo Go cannot run this app.** Not "might be flaky" — it will fail. Anyone you
hand this to needs a real build, and on iOS that means an Apple Developer Program membership
(₹9,900 / $99 a year) unless they have a Mac.

This document is written to be forwarded to whoever owns the iPhone.

---

## 1. Why Expo Go doesn't work

Expo Go is a single pre-built app from the App Store. Its native side is fixed: it ships whatever
native modules Expo chose, and it **ignores `app.json`'s config plugins entirely**. This app's
native requirements aren't in it:

| What the app needs | Why Expo Go can't provide it |
|---|---|
| `expo-sqlite` with **SQLCipher** (`useSQLCipher: true`) | A config plugin that changes how SQLite is compiled. Expo Go has plain SQLite, so the encrypted database fails to open — the app dies at startup, before any screen |
| `@expo/ui` (`DateTimePicker`) | Ships its own native views (Kotlin/Swift); not in the Expo Go binary |
| `expo-updates` | Requires the build to be signed and channel-linked |
| Camera / location / Face ID / photo-library **permission strings** | Declared through config plugins into `Info.plist`; Expo Go has its own generic ones |
| `expo-apple-authentication` | Needs the Sign in with Apple entitlement on the build itself |

So "install Expo Go and scan the QR" is not an option here at any point. The QR-code workflow does
come back — but only *after* a development build is installed once (see §3).

---

## 2. Pick a path

| | What you get | Apple account? | Mac? |
|---|---|---|---|
| **A. iOS Simulator build** | Full app on a simulated iPhone on a Mac | **No** — free | **Yes** |
| **B. Internal distribution to a real iPhone** | Real app on the real device | **Yes** ($99/yr) | No |
| **C. TestFlight** | Same, but scales to many testers, Apple-reviewed | **Yes** ($99/yr) | No |

**If you just want to look at the UI and have access to any Mac → A. It's free and takes ~20
minutes.** If you need it on an actual iPhone → B. There is no free route to a physical iPhone that
doesn't involve a Mac and Xcode's 7-day personal signing, which isn't worth the trouble here.

> ⚠️ **This app has never been compiled for iOS — not once, not even unsigned.** Whichever path you
> pick, budget for the first build failing on something iOS-specific (a pod, an entitlement, a
> permission string). That's expected, not a sign anything is wrong.

---

## 3. Path B — real iPhone, step by step

Everything except the last two steps happens on the **developer's** machine.

### One-time setup

1. **Enrol in the Apple Developer Program** — <https://developer.apple.com/programs/enroll/>.
   ~$99/year, and approval usually takes **1–2 days**, so start this before you need it.

2. **Register the tester's iPhone.** From `physiobuddies-therapist/`:

   ```bash
   npx eas device:create
   ```

   Choose "Website" — EAS prints a URL and a QR code. The tester opens that link **in Safari on the
   iPhone** (not Chrome, not a desktop) and installs the small profile it offers. That registers
   the device's UDID against your Apple team. Apple allows 100 iPhones per year per account.

3. **Build it:**

   ```bash
   npx eas build --platform ios --profile preview
   ```

   `preview` is already configured in `eas.json` with `distribution: "internal"` and points at the
   dev API (`https://api.dev.physiobuddies.in/api/v1`). EAS will ask to create the signing
   credentials — say yes and let it manage them; it generates the distribution certificate and the
   ad-hoc provisioning profile with the registered device baked in. Expect **20–40 minutes** in the
   build queue.

### What the tester does

4. EAS finishes and prints an **install URL + QR code**. Send them either.
5. Tester opens it in **Safari** on the iPhone → tap **Install** → the app appears on the home
   screen.
6. First launch will say the developer is untrusted. **Settings → General → VPN & Device Management
   → [your team name] → Trust.** This is normal for internal builds.

### Sign in

```
Email:    aarav@physiobuddies.com
Password: Password@123
```

Seed therapist on the dev backend. Sign-in is **email + password only** — the Google button was
removed on 2026-08-17, and Sign in with Apple is not implemented server-side yet (`POST /auth/apple`
doesn't exist), so if an Apple button ever appears, it is expected to fail.

### Iterating after that

Once the build is on the device, JS-only changes no longer need a rebuild:

```bash
npx expo start
```

Scan the QR **with the iPhone camera** (not Expo Go) and it opens in the installed build, with
Metro live-reloading over the same Wi-Fi. A rebuild is only needed when a native module or an
`app.json` plugin changes.

---

## 4. Path A — simulator on a Mac (free)

```bash
npx eas build --platform ios --profile ios-simulator   # no Apple account needed
npx eas build:run --platform ios                       # downloads it and boots a simulator
```

The `ios-simulator` profile already exists in `eas.json`. Caveats: **Face ID, the camera, and real
GPS don't exist in the simulator** — biometric unlock, KYC/avatar capture and visit navigation can
only be smoke-tested there, not truly verified.

---

## 5. What to look at, and what's known-broken on iOS

Worth checking, since these are the things that differ from Android:

- **Face ID unlock** — the app re-locks after 2 minutes in the background. iOS emits
  `inactive` then `background`; the lock logic is written for that and unit-tested, but has never
  run on a device.
- **The `@expo/ui` date picker** (Time off → the calendar; and the treatment form's follow-up date).
  iOS presents it inline, Android as a dialog. Never exercised on iOS.
- **Safe-area insets** on a notched/Dynamic Island iPhone — every screen pads from
  `useSafeAreaInsets`, but no one has looked at it on hardware.
- **Gradient buttons have no shadow on iOS.** Known and deliberate: `overflow-hidden` clips RN
  shadows on iOS, and the fix (an outer shadow wrapper) was never verified on a running build.
- **Keyboard behaviour** — iOS uses `padding` for `KeyboardAvoidingView` where Android uses nothing.
  Worth checking the login form, the article comment box and the FAQ composer.

**Known limitations, not bugs — don't report these:**

- Push notifications don't arrive on any platform. The backend has no route that accepts a device
  token, so there is nothing to deliver to. The in-app notification list works and is polled.
- The Billing screen is empty or errors: `GET /payment/` returns 500 on the server right now.
- The seed account has **no upcoming appointments** — all 12 bookings are in the past. Appointments
  opens on "All" when Upcoming is empty; that's intended.
- FAQs and articles fetched from the server can't be edited or deleted (the API omits their `id`).

**If something does fail:** Profile → Support → **Network log** shows every request, its payload and
the error body, with a Share button. Send that export — it is far more useful than a description.
